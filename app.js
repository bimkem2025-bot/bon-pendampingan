/* Bon Pendampingan v2: Klien -> Dokumen (sumber hukum) -> Kegiatan (jadwal). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = Doc.pad;
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => iso(new Date());
const addDays = (s, n) => { const d = Doc.parse(s); d.setDate(d.getDate() + n); return iso(d); };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const DOC_LABEL = { SP_HAN: 'Surat Penahanan (SP Han)', PUTUSAN_PN: 'Putusan Pengadilan Negeri', PUTUSAN_PT: 'Putusan Pengadilan Tinggi', PUTUSAN_MA: 'Putusan Mahkamah Agung', PENETAPAN: 'Penetapan' };
const DOC_SHORT = { SP_HAN: 'SP Han', PUTUSAN_PN: 'Putusan PN', PUTUSAN_PT: 'Putusan PT', PUTUSAN_MA: 'Putusan MA', PENETAPAN: 'Penetapan' };
const KEG_LABEL = { HAK: 'Pemenuhan Hak', PUTUSAN: 'Pelaksanaan Putusan' };
const kind = status => /^\s*b/i.test(status || '') ? 'PUTUSAN' : 'HAK'; // A* = tahanan, B* = narapidana
const EXT_ID_DEFAULT = '12Y_RCIY0F4sH0qrbU0pHgbQ2W1m_2ZQctJrQgBIHK_c';
const BULAN_TAB = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const SETTING_FIELDS = [
  ['pk_nama_gelar', 'Nama PK (lengkap + gelar)'], ['pk_nama', 'Nama PK singkat'], ['pk_nip', 'NIP PK'], ['pk_alias', 'Nama PK di sheet jadwal (mis. Tuffa)'],
  ['ppk_nama', 'Nama PPK'], ['ppk_nip', 'NIP PPK'], ['kepala_nama', 'Nama Kepala Bapas'],
  ['sp_pk_nama', 'PK di SP: nama'], ['sp_pk_nip', 'PK di SP: NIP'], ['sp_pk_pangkat', 'PK di SP: pangkat'], ['sp_pk_jabatan', 'PK di SP: jabatan'],
  ['uang', 'Besar uang per kegiatan (Rp)'], ['tempat', 'Tempat default'], ['staf_hak', 'Petugas default: Hak Tahanan'], ['staf_putusan', 'Petugas default: Pelaksanaan Putusan'],
  ['ext_id', 'ID Google Sheet jadwal PK lain'],
];
const DEFAULT_SETTINGS = {
  pk_nama_gelar: '', pk_nama: '', pk_nip: '', pk_alias: '', ppk_nama: '', ppk_nip: '', kepala_nama: '',
  sp_pk_nama: '', sp_pk_nip: '', sp_pk_pangkat: '', sp_pk_jabatan: '',
  uang: 170000, tempat: 'Lapas Sintang', staf_hak: '', staf_putusan: '', ext_id: EXT_ID_DEFAULT, libur: DEFAULT_LIBUR,
};
const SHEETS = { Klien: 'klien', Dokumen: 'dokumen', Kegiatan: 'kegiatan' };

let data = { klien: [], dokumen: [], kegiatan: [], settings: { ...DEFAULT_SETTINGS } };
let ext = { rows: [], t: 0 };       // jadwal PK lain (dibaca langsung dari Google Sheet)
let libur = new Map();
const photos = new Map();           // kegiatan.id -> [{file,url,caption}]
const ui = { tab: 'klien', klien: null, cal: { y: new Date().getFullYear(), m: new Date().getMonth() }, sel: null, drag: null };

// ============================================================ penyimpanan
const conn = () => JSON.parse(localStorage.getItem('bon_conn') || '{}');
const remote = () => !!conn().url;
async function api(body) {
  const { url, key } = conn();
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, key }) });
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'gagal'); return j;
}
const saveLocal = () => localStorage.setItem('bon_data', JSON.stringify(data));
function status(t) { $('#status').textContent = t; }
function toast(t, ms = 3500) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, ms); }
const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { console.error(e); toast('Gagal: ' + e.message, 6000); } };

async function load() {
  if (remote()) {
    status('Memuat dari Google Sheets…');
    const j = await api({ action: 'all' });
    data = { klien: j.klien, dokumen: j.dokumen || [], kegiatan: j.kegiatan, settings: { ...DEFAULT_SETTINGS, ...(j.settings || {}) } };
    status('Tersambung: Google Sheets Anda');
  } else {
    const d = JSON.parse(localStorage.getItem('bon_data') || 'null');
    if (d) data = { klien: d.klien || [], dokumen: d.dokumen || [], kegiatan: d.kegiatan || [], settings: { ...DEFAULT_SETTINGS, ...d.settings } };
    status('Data tersimpan di browser ini');
  }
  buildLibur();
}
async function upsert(sheet, row) {
  const list = data[SHEETS[sheet]]; const i = list.findIndex(x => x.id === row.id);
  i >= 0 ? list[i] = row : list.push(row);
  remote() ? await api({ action: 'upsert', sheet, row }) : saveLocal();
}
async function remove(sheet, id) {
  const k = SHEETS[sheet]; data[k] = data[k].filter(x => x.id !== id);
  remote() ? await api({ action: 'remove', sheet, id }) : saveLocal();
}
async function saveSettings() { remote() ? await api({ action: 'settings', settings: data.settings }) : saveLocal(); }

// ============================================================ jadwal PK lain
function parseCsv(t) {
  const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n') { r.push(f); rows.push(r); r = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  return rows;
}
const dmy = s => { const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` : ''; };

async function loadExt(force) {
  const c = JSON.parse(localStorage.getItem('bon_ext') || 'null');
  if (c && !force && Date.now() - c.t < 10 * 60e3) { ext = c; return; }
  const id = data.settings.ext_id || EXT_ID_DEFAULT; if (!id) return;
  status('Memuat jadwal PK lain…');
  const rows = [];
  const res = await Promise.all(BULAN_TAB.map(async (tab, mi) => {
    try {
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${tab}`);
      if (!r.ok) return [];
      return parseCsv(await r.text()).map(x => ({ x, mi }));
    } catch { return []; }
  }));
  res.flat().forEach(({ x, mi }) => {
    if (!/^\d+$/.test((x[0] || '').trim())) return;
    let pel = dmy(x[5]); if (!pel) return;
    // jaga-jaga bila hari/bulan tertukar: bulan harus sama dengan nama tab
    if (+pel.slice(5, 7) !== mi + 1 && +pel.slice(8, 10) === mi + 1) pel = `${pel.slice(0, 4)}-${pad(+pel.slice(8, 10))}-${pad(+pel.slice(5, 7))}`;
    const biaya = (x[6] || '').trim();
    rows.push({ tgl: pel, nama: (x[1] || '').trim(), jenis: (x[2] || '').trim(), tempat: (x[3] || '').trim(), pk: (x[7] || '').trim() || (biaya && !/\d/.test(biaya) ? biaya : '') });
  });
  if (!rows.length) { status(remote() ? 'Tersambung: Google Sheets Anda' : 'Data tersimpan di browser ini'); toast('Jadwal PK lain tidak terbaca (cek ID sheet dan izin lihat).'); return; }
  ext = { rows, t: Date.now() };
  localStorage.setItem('bon_ext', JSON.stringify(ext));
  status((remote() ? 'Tersambung: Google Sheets Anda' : 'Data tersimpan di browser ini') + ` · jadwal PK lain: ${rows.filter(r => r.nama).length} kegiatan`);
}

// ============================================================ aturan tanggal
function buildLibur() {
  libur = new Map();
  (data.settings.libur || '').split('\n').forEach(l => { const m = l.trim().match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/); if (m) libur.set(m[1], m[2] || 'Libur'); });
}
const extMax = () => ext.rows.reduce((a, r) => r.tgl > a ? r.tgl : a, '');
function occupancy(date, exceptKegId) {
  const e = ext.rows.filter(r => r.tgl === date && r.nama);
  const mine = data.kegiatan.filter(g => g.tgl_pel === date && g.id !== exceptKegId);
  return { e, mine };
}
function dayInfo(date, exceptKegId) {
  const w = Doc.parse(date).getDay();
  if (w === 0 || w === 6) return { st: 'off', why: 'Akhir pekan' };
  if (libur.has(date)) return { st: 'off', why: 'Libur: ' + libur.get(date) };
  const { e, mine } = occupancy(date, exceptKegId);
  if (mine.length) return { st: 'me', why: 'Sudah ada kegiatan Anda di tanggal ini' };
  if (e.length) return { st: 'ext', why: 'Sudah dipilih PK lain: ' + [...new Set(e.map(x => x.pk || 'PK lain'))].join(', ') };
  const listed = ext.rows.some(r => r.tgl === date);
  if (!listed && ext.rows.length && date <= extMax()) return { st: 'un', why: 'Tidak ada baris di sheet jadwal' };
  return { st: 'free', why: '' };
}
// apakah dokumen ini boleh dilaksanakan pada tanggal tsb
function check(dok, date, exceptKegId) {
  const di = dayInfo(date, exceptKegId);
  if (di.st === 'off' || di.st === 'me' || di.st === 'ext') return { ok: false, why: di.why };
  if (dok && dok.tgl_dokumen && date <= dok.tgl_dokumen) return { ok: false, why: `Harus setelah tanggal dokumen (${Doc.tgl(dok.tgl_dokumen)})` };
  return { ok: true, soft: di.st === 'un' ? di.why : '' };
}
function suggest(dok, from) {
  let d = from || todayIso(); if (dok && dok.tgl_dokumen && d <= dok.tgl_dokumen) d = addDays(dok.tgl_dokumen, 1);
  for (let i = 0; i < 400; i++, d = addDays(d, 1)) { const c = check(dok, d); if (c.ok && !c.soft) return d; }
  return null;
}
function prevWorkday(date) { let d = addDays(date, -1); for (let i = 0; i < 10; i++, d = addDays(d, -1)) { const w = Doc.parse(d).getDay(); if (w && w < 6 && !libur.has(d)) return d; } return date; }

// ============================================================ relasi
const klienOf = id => data.klien.find(k => k.id === id);
const dokOf = id => data.dokumen.find(d => d.id === id);
const kegOfDok = id => data.kegiatan.filter(g => g.dokumen_id === id);
function dokLabel(d) { return `${DOC_SHORT[d.jenis] || d.jenis} ${d.nomor || ''} · ${Doc.tgl(d.tgl_dokumen)}`; }
function itemFor(g) {
  const d = dokOf(g.dokumen_id), k = klienOf(d && d.klien_id); if (!d || !k) return null;
  const jenis = kind(d.status_klien), putusanDoc = d.jenis.startsWith('PUTUSAN') || d.jenis === 'PENETAPAN';
  const keg = {
    jenis, status_klien: d.status_klien, tgl_sp: g.tgl_sprint, tgl_pel: g.tgl_pel, staf: g.staf,
    putusan: d.nomor ? `${d.nomor} / ${Doc.tgl(d.tgl_dokumen)}` : '', pidana: d.pidana,
    dasar: `${DOC_LABEL[d.jenis] || 'Dokumen'} Nomor : ${d.nomor || '-'} Tanggal ${Doc.tgl(d.tgl_dokumen)}`,
    hasil: g.hasil, sudah_putusan: jenis === 'HAK' && putusanDoc ? '1' : '', tempat: d.tempat, ket: d.tempat ? 'Di ' + d.tempat : '',
  };
  return { keg, k: { ...k, perkara: d.perkara }, g, d, photos: photos.get(g.id) || [] };
}

// ============================================================ tab
$$('#tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
function showTab(t) {
  ui.tab = t;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('main > section').forEach(s => s.hidden = s.id !== 'tab-' + t);
  ({ klien: renderKlien, kalender: renderKalender, unduh: renderUnduh })[t]();
}

// ============================================================ dialog
function dialog(html, onSubmit, opts = {}) {
  const f = $('#dlg-form'); f.innerHTML = html + `<div class="acts">${opts.extra || ''}<button type="button" value="x" id="dlg-x">Batal</button><button class="pri" value="ok">${opts.ok || 'Simpan'}</button></div>`;
  $('#dlg-x').onclick = () => $('#dlg').close();
  f.onsubmit = guard(async e => {
    e.preventDefault();
    const o = {}; [...f.elements].forEach(x => { if (x.name) o[x.name] = x.type === 'checkbox' ? (x.checked ? '1' : '') : x.value.trim(); });
    if (await onSubmit(o) !== false) $('#dlg').close();
  });
  $('#dlg').showModal();
  return f;
}
const field = (name, label, v = '', extra = '') => `<label>${label}<input name="${name}" value="${esc(v)}" ${extra}></label>`;

// ============================================================ KLIEN & DOKUMEN
$('#k-cari').oninput = renderKlien;
$('#k-baru').onclick = () => editKlien(null);

function renderKlien() {
  const q = $('#k-cari').value.toLowerCase();
  $('#k-list').innerHTML = data.klien.filter(k => k.nama.toLowerCase().includes(q)).sort((a, b) => a.nama.localeCompare(b.nama))
    .map(k => `<div class="item ${k.id === ui.klien ? 'on' : ''}" data-id="${k.id}"><b>${esc(k.nama)}</b><small>${data.dokumen.filter(d => d.klien_id === k.id).length} dokumen</small></div>`).join('')
    || '<p class="hint">Belum ada klien. Klik + untuk menambah.</p>';
  $$('#k-list .item').forEach(e => e.onclick = () => { ui.klien = e.dataset.id; renderKlien(); });
  const k = klienOf(ui.klien), pane = $('#k-detail');
  if (!k) { pane.innerHTML = '<p class="hint">Pilih klien di kiri, atau tambah klien baru.</p>'; return; }
  const docs = data.dokumen.filter(d => d.klien_id === k.id).sort((a, b) => (a.tgl_dokumen || '').localeCompare(b.tgl_dokumen || ''));
  pane.innerHTML = `
    <div class="row between"><h2>${esc(k.nama)}</h2><div class="row"><button id="k-ubah">Ubah data</button><button id="k-hapus" class="danger">Hapus</button></div></div>
    <p class="hint">${esc(k.tempat_lahir)}, ${Doc.tgl(k.tgl_lahir)} · ${esc(k.agama)} · ${esc(k.pekerjaan)} · ${esc(k.alamat)}</p>
    <div class="row between" style="margin-top:14px"><h3>Dokumen &amp; status</h3><button id="d-baru" class="pri">+ Dokumen</button></div>
    <table><thead><tr><th>Dokumen</th><th>Status</th><th>Kegiatan</th><th></th></tr></thead><tbody>
    ${docs.map(d => {
      const gs = kegOfDok(d.id), g = gs[0];
      return `<tr><td>${esc(dokLabel(d))}<br><small class="hint">${esc(d.perkara)}</small></td><td><span class="tag ${kind(d.status_klien) === 'PUTUSAN' ? 'b' : ''}">${esc(d.status_klien)}</span></td>
      <td>${KEG_LABEL[kind(d.status_klien)]}<br><small class="hint">${g && g.tgl_pel ? 'Dijadwalkan ' + Doc.tgl(g.tgl_pel) : 'Belum dijadwalkan'}</small></td>
      <td style="white-space:nowrap"><button data-ed="${d.id}">Ubah</button> <button data-del="${d.id}" class="danger">×</button></td></tr>`;
    }).join('') || '<tr><td colspan="4" class="hint">Belum ada dokumen. Tambah dokumen sumber hukum (SP Han, putusan, penetapan).</td></tr>'}
    </tbody></table>`;
  $('#k-ubah').onclick = () => editKlien(k);
  $('#k-hapus').onclick = guard(async () => {
    if (data.dokumen.some(d => d.klien_id === k.id)) return toast('Hapus dulu dokumen klien ini.');
    if (confirm('Hapus ' + k.nama + '?')) { await remove('Klien', k.id); ui.klien = null; renderKlien(); }
  });
  $('#d-baru').onclick = () => editDokumen(null, k);
  $$('[data-ed]', pane).forEach(b => b.onclick = () => editDokumen(dokOf(b.dataset.ed), k));
  $$('[data-del]', pane).forEach(b => b.onclick = guard(async () => {
    if (!confirm('Hapus dokumen ini beserta jadwalnya?')) return;
    for (const g of kegOfDok(b.dataset.del)) await remove('Kegiatan', g.id);
    await remove('Dokumen', b.dataset.del); renderKlien();
  }));
}

function editKlien(k) {
  k = k || {};
  dialog(`<h2>${k.id ? 'Ubah klien' : 'Klien baru'}</h2><div class="grid">
    <div class="w2">${field('nama', 'Nama lengkap', k.nama, 'required')}</div>
    <label>Jenis kelamin<select name="jk"><option ${k.jk === 'Perempuan' ? '' : 'selected'}>Laki-laki</option><option ${k.jk === 'Perempuan' ? 'selected' : ''}>Perempuan</option></select></label>
    ${field('tempat_lahir', 'Tempat lahir', k.tempat_lahir, 'required')}
    ${field('tgl_lahir', 'Tanggal lahir', k.tgl_lahir, 'type="date" required')}
    ${field('agama', 'Agama', k.agama || 'Islam')}
    ${field('suku', 'Suku/Bangsa/Kewarganegaraan', k.suku, 'placeholder="Jawa/Indonesia/WNI"')}
    ${field('pendidikan', 'Pendidikan terakhir', k.pendidikan)}
    ${field('pekerjaan', 'Pekerjaan', k.pekerjaan)}
    ${field('kawin', 'Status perkawinan', k.kawin || 'Belum Menikah')}
    <div class="w2"><label>Alamat<textarea name="alamat" rows="2">${esc(k.alamat)}</textarea></label></div></div>`,
  async o => { const row = { id: k.id || uid(), ...o }; await upsert('Klien', row); ui.klien = row.id; renderKlien(); });
}

function editDokumen(d, k) {
  d = d || {};
  const f = dialog(`<h2>${d.id ? 'Ubah dokumen' : 'Dokumen baru'} · ${esc(k.nama)}</h2><div class="grid">
    <label>Jenis dokumen<select name="jenis">${Object.entries(DOC_LABEL).map(([v, l]) => `<option value="${v}" ${d.jenis === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    ${field('nomor', 'Nomor dokumen', d.nomor)}
    ${field('tgl_dokumen', 'Tanggal dokumen', d.tgl_dokumen, 'type="date" required')}
    ${field('status_klien', 'Status klien / no. register', d.status_klien, 'required placeholder="A2, BI, AV…"')}
    <div class="w2">${field('perkara', 'Perkara', d.perkara, 'placeholder="Narkotika/ Pasal 114 (1) UU RI No. 35 Tahun 2009"')}</div>
    ${field('tempat', 'Tempat pendampingan', d.tempat || data.settings.tempat)}
    ${field('pidana', 'Lama pidana (untuk putusan)', d.pidana, 'placeholder="03 (tiga) tahun"')}</div>
    <p class="hint" id="kg-info"></p>`,
  async o => { await upsert('Dokumen', { id: d.id || uid(), klien_id: k.id, ...o }); renderKlien(); });
  const upd = () => { $('#kg-info').textContent = 'Kegiatan: ' + KEG_LABEL[kind(f.elements.status_klien.value)] + ' (A = tahanan, B = narapidana)'; };
  f.elements.status_klien.oninput = upd; upd();
}

// ============================================================ KALENDER
$('#c-prev').onclick = () => { ui.cal.m--; if (ui.cal.m < 0) { ui.cal.m = 11; ui.cal.y--; } renderKalender(); };
$('#c-next').onclick = () => { ui.cal.m++; if (ui.cal.m > 11) { ui.cal.m = 0; ui.cal.y++; } renderKalender(); };
$('#c-today').onclick = () => { const n = new Date(); ui.cal = { y: n.getFullYear(), m: n.getMonth() }; renderKalender(); };
$('#c-ext').onclick = guard(async () => { await loadExt(true); renderKalender(); toast('Jadwal PK lain diperbarui.'); });
$('#c-saran').onclick = () => {
  const d = dokOf(ui.sel); if (!d) return toast('Pilih dulu klien di daftar kiri.');
  const s = suggest(d); if (!s) return toast('Tidak ada tanggal yang cocok.');
  const dt = Doc.parse(s); ui.cal = { y: dt.getFullYear(), m: dt.getMonth() }; renderKalender(); toast('Saran: ' + Doc.hari(s) + ', ' + Doc.tgl(s) + ' — klik tanggalnya untuk menjadwalkan.', 6000);
};

function queue() { return data.dokumen.filter(d => !kegOfDok(d.id).some(g => g.tgl_pel)).sort((a, b) => (a.tgl_dokumen || '').localeCompare(b.tgl_dokumen || '')); }

function renderKalender() {
  const q = queue(), box = $('#q-list');
  if (ui.sel && !q.some(d => d.id === ui.sel)) ui.sel = null;
  box.innerHTML = q.map(d => {
    const k = klienOf(d.klien_id) || { nama: '?' };
    return `<div class="item chip ${d.id === ui.sel ? 'on' : ''}" draggable="true" data-id="${d.id}"><b>${esc(k.nama)}</b>
      <small><span class="tag ${kind(d.status_klien) === 'PUTUSAN' ? 'b' : ''}">${esc(d.status_klien)}</span>${KEG_LABEL[kind(d.status_klien)]} · terbit ${Doc.tgl(d.tgl_dokumen)}</small></div>`;
  }).join('') || '<p class="hint">Semua dokumen sudah dijadwalkan. Tambah dokumen di tab Klien &amp; Dokumen.</p>';
  $$('.chip', box).forEach(c => {
    c.onclick = () => { ui.sel = ui.sel === c.dataset.id ? null : c.dataset.id; renderKalender(); };
    c.ondragstart = e => { ui.drag = c.dataset.id; e.dataTransfer.setData('text/plain', c.dataset.id); e.dataTransfer.effectAllowed = 'move'; document.body.classList.add('drag'); mark(dokOf(ui.drag)); };
    c.ondragend = () => { ui.drag = null; document.body.classList.remove('drag'); };
  });

  const { y, m } = ui.cal;
  $('#c-judul').textContent = `${Doc.BULAN[m]} ${y}`;
  const g = $('#c-grid'); g.innerHTML = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(h => `<div class="dh">${h}</div>`).join('');
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  g.insertAdjacentHTML('beforeend', '<div class="day empty"></div>'.repeat(lead));
  const n = new Date(y, m + 1, 0).getDate();
  for (let dd = 1; dd <= n; dd++) {
    const s = iso(new Date(y, m, dd)), di = dayInfo(s), { e, mine } = occupancy(s);
    const tags = [
      ...mine.map(kg => { const dk = dokOf(kg.dokumen_id), kl = dk && klienOf(dk.klien_id); return `<span class="t m" title="${esc(kl && kl.nama)}">${esc(kl ? kl.nama.split(' ')[0] : '?')}</span>`; }),
      ...e.slice(0, 2).map(r => `<span class="t e" title="${esc(r.pk + ' · ' + r.nama)}">${esc(r.pk || 'PK lain')}</span>`),
      ...(di.st === 'off' && libur.has(s) ? [`<span class="t" title="${esc(libur.get(s))}">${esc(libur.get(s))}</span>`] : []),
    ].join('');
    g.insertAdjacentHTML('beforeend', `<div class="day ${di.st} ${s === todayIso() ? 'today' : ''}" data-date="${s}" title="${esc(di.why)}"><span class="n">${dd}</span>${tags}</div>`);
  }
  $$('.day[data-date]', g).forEach(c => {
    const s = c.dataset.date;
    c.onclick = () => { if (c.classList.contains('me')) return openKegiatan(data.kegiatan.find(k => k.tgl_pel === s)); if (ui.sel) schedule(ui.sel, s); };
    c.ondragover = e => { if (ui.drag) { e.preventDefault(); c.classList.add('hover'); } };
    c.ondragleave = () => c.classList.remove('hover');
    c.ondrop = e => { e.preventDefault(); c.classList.remove('hover'); const id = e.dataTransfer.getData('text/plain') || ui.drag; document.body.classList.remove('drag'); schedule(id, s); };
  });
  mark(dokOf(ui.sel));
}
// tandai hari valid/tidak untuk dokumen yang sedang dipilih/diseret
function mark(d) {
  $$('.day[data-date]').forEach(c => { c.classList.remove('ok', 'no'); if (d) c.classList.add(check(d, c.dataset.date).ok ? 'ok' : 'no'); });
}

const schedule = guard(async (dokId, date) => {
  const d = dokOf(dokId); if (!d) return;
  const c = check(d, date);
  if (!c.ok) return toast('Tidak bisa: ' + c.why, 5000);
  if (c.soft && !confirm(c.soft + '. Tetap jadwalkan?')) return;
  const sprint = Math.max(0, 0) || (prevWorkday(date) > d.tgl_dokumen ? prevWorkday(date) : date);
  const g = kegOfDok(dokId)[0] || { id: uid(), dokumen_id: dokId };
  await upsert('Kegiatan', { ...g, tgl_pel: date, tgl_sprint: g.tgl_sprint && g.tgl_sprint >= d.tgl_dokumen && g.tgl_sprint <= date ? g.tgl_sprint : sprint, staf: g.staf || '', hasil: g.hasil || '' });
  ui.sel = null; renderKalender();
  const k = klienOf(d.klien_id); toast(`${k ? k.nama : ''}: pelaksanaan ${Doc.hari(date)}, ${Doc.tgl(date)}`);
});

function openKegiatan(g) {
  if (!g) return;
  const d = dokOf(g.dokumen_id), k = klienOf(d.klien_id), j = kind(d.status_klien);
  dialog(`<h2>${esc(k.nama)}</h2><p class="hint">${KEG_LABEL[j]} · ${esc(dokLabel(d))}</p><div class="grid">
    ${field('tgl_pel', 'Tanggal pelaksanaan', g.tgl_pel, `type="date" min="${addDays(d.tgl_dokumen, 1)}"`)}
    ${field('tgl_sprint', 'Tanggal sprint', g.tgl_sprint, `type="date" min="${d.tgl_dokumen}"`)}
    ${field('staf', 'Petugas pendamping (kosong = default)', g.staf)}
    <div class="w2"><label>Isi hasil laporan (satu baris = satu poin; kosong = otomatis)<textarea name="hasil" rows="5">${esc(g.hasil)}</textarea></label></div></div>
    <p class="hint">Sprint harus di antara tanggal dokumen (${Doc.tgl(d.tgl_dokumen)}) dan tanggal pelaksanaan.</p>`,
  async o => {
    if (o.tgl_pel !== g.tgl_pel) { const c = check(d, o.tgl_pel, g.id); if (!c.ok) { toast('Tanggal pelaksanaan: ' + c.why, 5000); return false; } }
    if (o.tgl_sprint < d.tgl_dokumen || o.tgl_sprint > o.tgl_pel) { toast('Sprint harus antara tanggal dokumen dan pelaksanaan.', 5000); return false; }
    await upsert('Kegiatan', { ...g, ...o }); renderKalender();
  }, { extra: '<button type="button" id="g-lepas" class="danger">Batalkan jadwal</button>' });
  $('#g-lepas').onclick = guard(async () => { await remove('Kegiatan', g.id); $('#dlg').close(); renderKalender(); });
}

// ============================================================ UNDUH
const JENIS_FOTO = { HAK: 'Pendampingan Pemenuhan Hak', PUTUSAN: 'Pendampingan Pelaksanaan Putusan' };
$('#p-bulan').onchange = renderUnduh;

function renderUnduh() {
  const items = data.kegiatan.filter(g => g.tgl_pel && itemFor(g)).sort((a, b) => a.tgl_pel.localeCompare(b.tgl_pel));
  const months = [...new Set(items.map(g => g.tgl_pel.slice(0, 7)))];
  const sel = $('#p-bulan'), keep = sel.value;
  sel.innerHTML = '<option value="">Semua bulan</option>' + months.map(m => `<option value="${m}">${Doc.BULAN[+m.slice(5) - 1]} ${m.slice(0, 4)}</option>`).join('');
  sel.value = months.includes(keep) ? keep : '';
  const list = items.filter(g => !sel.value || g.tgl_pel.startsWith(sel.value));
  const box = $('#p-list');
  box.innerHTML = list.map(g => {
    const it = itemFor(g);
    return `<div class="krow" data-id="${g.id}"><input type="checkbox" class="pc" checked>
      <div><b>${esc(it.k.nama)}</b><br><span class="tag ${it.keg.jenis === 'PUTUSAN' ? 'b' : ''}">${esc(it.d.status_klien)}</span>${KEG_LABEL[it.keg.jenis]}<br><small class="hint">${Doc.hari(g.tgl_pel)}, ${Doc.tgl(g.tgl_pel)} · sprint ${Doc.tgl(g.tgl_sprint)}</small></div>
      <div><div class="drop">Seret foto ke sini atau <u>klik untuk memilih</u><input type="file" accept="image/*" multiple hidden></div><div class="thumbs"></div></div></div>`;
  }).join('') || '<p class="hint">Belum ada kegiatan terjadwal. Jadwalkan di tab Kalender.</p>';
  $$('.krow', box).forEach(row => {
    const id = row.dataset.id, g = data.kegiatan.find(x => x.id === id), drop = $('.drop', row), inp = $('input[type=file]', row), th = $('.thumbs', row);
    const draw = () => {
      th.innerHTML = '';
      (photos.get(id) || []).forEach((p, i) => {
        const el = document.createElement('div');
        el.innerHTML = `<img src="${p.url}"><input value="${esc(p.caption)}" title="Keterangan foto"><button type="button" class="x">×</button>`;
        $('input', el).oninput = e => p.caption = e.target.value;
        $('.x', el).onclick = () => { photos.get(id).splice(i, 1); draw(); };
        th.append(el);
      });
    };
    const add = files => {
      const l = photos.get(id) || [], j = kind(dokOf(g.dokumen_id).status_klien);
      [...files].filter(f => f.type.startsWith('image/')).forEach(f => l.push({ file: f, url: URL.createObjectURL(f), caption: JENIS_FOTO[j] }));
      photos.set(id, l); draw();
    };
    drop.onclick = () => inp.click();
    inp.onchange = () => { add(inp.files); inp.value = ''; };
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => add(e.dataTransfer.files));
    draw();
  });
  const last = list.length ? list[list.length - 1].tgl_pel : todayIso();
  if (!$('#p-tglbon').dataset.set) $('#p-tglbon').value = addDays(last, 1);
  $('#p-tglbon').onchange = () => $('#p-tglbon').dataset.set = '1';
  $('#p-info').textContent = list.length ? `${list.length} kegiatan` : '';
}

function chosen() {
  const ids = $$('.krow').filter(r => $('.pc', r).checked).map(r => r.dataset.id);
  const it = ids.map(id => itemFor(data.kegiatan.find(g => g.id === id))).filter(Boolean);
  if (!it.length) toast('Centang minimal satu kegiatan.');
  return it;
}
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
const safe = s => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, ' ').slice(0, 40);
function busy(btn, fn) { btn.onclick = guard(async () => { const it = chosen(); if (!it.length) return; btn.disabled = true; try { await fn(it); } finally { btn.disabled = false; } }); }
const warnSet = () => { if (!data.settings.pk_nama_gelar) toast('Lengkapi data PK/PPK di Pengaturan (⚙) agar tanda tangan terisi.', 5000); };

busy($('#p-sp'), async it => {
  warnSet(); const s = data.settings;
  if (it.length === 1) return download(await Doc.sp(it[0].keg, it[0].k, s), `SP ${safe(it[0].k.nama)}.docx`);
  const zip = new JSZip();
  for (const x of it) zip.file(`SP ${x.keg.tgl_pel} ${safe(x.k.nama)}.docx`, await Doc.sp(x.keg, x.k, s));
  download(await zip.generateAsync({ type: 'blob' }), 'SP Pendampingan.zip');
});
busy($('#p-bon'), async it => { warnSet(); download(await Doc.bon(it, data.settings, $('#p-tglbon').value || todayIso()), 'Bon Pendampingan Dewasa.docx'); });
busy($('#p-lap'), async it => { warnSet(); download(await Doc.laporan(it, data.settings), 'Laporan Pendampingan Dewasa.docx'); });

// ============================================================ PENGATURAN
$('#b-set').onclick = () => {
  const c = conn(), s = data.settings;
  dialog(`<h2>Pengaturan</h2>
    <h3>Penyimpanan</h3><p class="hint">Kosong = data hanya di browser ini. Isi untuk memakai Google Sheets Anda (lihat README).</p>
    <div class="grid"><div class="w2">${field('url', 'URL Web App Apps Script', c.url)}</div>${field('key', 'Kata sandi (APP_KEY)', c.key, 'type="password"')}</div>
    <h3>Pejabat &amp; aturan</h3><div class="grid">${SETTING_FIELDS.map(([k, l]) => field('s_' + k, l, s[k])).join('')}</div>
    <label>Libur nasional &amp; cuti bersama (<code>YYYY-MM-DD nama</code> per baris)<textarea name="libur" rows="6">${esc(s.libur)}</textarea></label>
    <div class="row" style="margin-top:10px"><button type="button" id="s-exp">Ekspor JSON</button><label class="inline"><button type="button" id="s-impb">Impor JSON</button><input type="file" id="s-imp" accept=".json" hidden></label></div>`,
  async o => {
    SETTING_FIELDS.forEach(([k]) => data.settings[k] = k === 'uang' ? Number(o['s_' + k]) || 0 : o['s_' + k]);
    data.settings.libur = o.libur; buildLibur();
    const was = remote(); localStorage.setItem('bon_conn', JSON.stringify({ url: o.url, key: o.key }));
    if (o.url && !was && (data.klien.length || data.dokumen.length) && confirm('Kirim data lokal ke Google Sheets Anda?')) {
      for (const k of data.klien) await api({ action: 'upsert', sheet: 'Klien', row: k });
      for (const d of data.dokumen) await api({ action: 'upsert', sheet: 'Dokumen', row: d });
      for (const g of data.kegiatan) await api({ action: 'upsert', sheet: 'Kegiatan', row: g });
    }
    await saveSettings(); await load(); await loadExt(true); showTab(ui.tab); toast('Pengaturan tersimpan.');
  });
  $('#s-exp').onclick = () => download(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), 'bon-data.json');
  $('#s-impb').onclick = () => $('#s-imp').click();
  $('#s-imp').onchange = guard(async e => {
    const f = e.target.files[0]; if (!f) return; const d = JSON.parse(await f.text());
    for (const k of d.klien || []) await upsert('Klien', k);
    for (const x of d.dokumen || []) await upsert('Dokumen', x);
    for (const g of d.kegiatan || []) await upsert('Kegiatan', g);
    toast('Data diimpor.'); $('#dlg').close(); showTab(ui.tab);
  });
};

// ============================================================ mulai
guard(async () => { await load(); showTab('klien'); loadExt(false).then(() => { if (ui.tab === 'kalender') renderKalender(); }).catch(() => {}); })();
