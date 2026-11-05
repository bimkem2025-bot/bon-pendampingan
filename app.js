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
const KEG_LABEL = { HAK: 'Pemenuhan Hak Tahanan', PUTUSAN: 'Pelaksanaan Putusan' };
const STATUS_SARAN = ['AI', 'AII', 'AIII', 'AIV', 'AV', 'BI', 'BIIa', 'BIIb', 'BIII'];
const PANGKAT = { 'I/a': 'Juru Muda', 'I/b': 'Juru Muda Tk.I', 'I/c': 'Juru', 'I/d': 'Juru Tk.I', 'II/a': 'Pengatur Muda', 'II/b': 'Pengatur Muda Tk.I', 'II/c': 'Pengatur', 'II/d': 'Pengatur Tk.I', 'III/a': 'Penata Muda', 'III/b': 'Penata Muda Tk.I', 'III/c': 'Penata', 'III/d': 'Penata Tk.I', 'IV/a': 'Pembina', 'IV/b': 'Pembina Tk.I', 'IV/c': 'Pembina Utama Muda', 'IV/d': 'Pembina Utama Madya', 'IV/e': 'Pembina Utama' };
const JENJANG = { PK: ['Ahli Pertama', 'Ahli Muda', 'Ahli Madya', 'Ahli Utama'], APK: ['Terampil', 'Mahir', 'Penyelia'] };
const TIPE_LABEL = { PK: 'Pembimbing Kemasyarakatan', APK: 'Asisten Pembimbing Kemasyarakatan' };
const EXT_ID_DEFAULT = '12Y_RCIY0F4sH0qrbU0pHgbQ2W1m_2ZQctJrQgBIHK_c';
const BULAN_TAB = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const SETTING_FIELDS = [
  ['ppk_nama', 'Nama PPK'], ['ppk_nip', 'NIP PPK'],
  ['uang', 'Besar uang per kegiatan (Rp)'], ['tempat', 'Tempat default'], ['staf_hak', 'Petugas default: Hak Tahanan'], ['staf_putusan', 'Petugas default: Pelaksanaan Putusan'],
  ['ext_id', 'ID Google Sheet jadwal PK lain'],
];
const DEFAULT_SETTINGS = {
  ppk_nama: '', ppk_nip: '',
  uang: 170000, tempat: 'Lapas Sintang', staf_hak: '', staf_putusan: '', ext_id: EXT_ID_DEFAULT, libur: DEFAULT_LIBUR,
};
const SHEETS = { Klien: 'klien', Status: 'status', Dokumen: 'dokumen', Kegiatan: 'kegiatan', PK: 'pk', PKRiwayat: 'riwayat', Kepala: 'kepala' };
const emptyData = () => ({ klien: [], status: [], dokumen: [], kegiatan: [], pk: [], riwayat: [], kepala: [], settings: { ...DEFAULT_SETTINGS } });

let data = emptyData();
let ext = { rows: [], t: 0 };       // jadwal PK lain (dibaca langsung dari Google Sheet)
let libur = new Map();
const photos = new Map();           // kegiatan.id -> [{file,url,caption}]
const ui = { tab: 'klien', klien: null, cal: { y: new Date().getFullYear(), m: new Date().getMonth() }, sel: null, drag: null };

// ============================================================ penyimpanan
const conn = () => JSON.parse(localStorage.getItem('bon_conn') || '{}');
const remote = () => !!conn().url;
let pending = 0;
function lockUi(on) {                     // layar terkunci selama ada proses ke Google Sheets
  pending += on ? 1 : -1;
  const e = $('#lock'); if (!e || !e.showPopover) return;
  $('#lock-t').textContent = pending > 1 ? `Memproses ${pending} permintaan…` : (on ? 'Menyimpan ke Google Sheets…' : '');
  if (pending > 0 && !e.matches(':popover-open')) e.showPopover(); else if (pending <= 0 && e.matches(':popover-open')) e.hidePopover();
}
async function api(body) {
  const { url, key } = conn();
  lockUi(true);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, key }) });
    const j = await r.json(); if (!j.ok) throw new Error(j.error || 'gagal'); return j;
  } finally { lockUi(false); }
}
const saveLocal = () => localStorage.setItem('bon_data', JSON.stringify(data));
function status(t) { $('#status').textContent = t; }
function toast(t, ms = 3500) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, ms); }
const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { console.error(e); toast('Gagal: ' + e.message, 6000); } };

const readLocal = () => { try { return JSON.parse(localStorage.getItem('bon_data') || 'null'); } catch { return null; } };
// baris dengan id kembar digabung (yang terakhir dipakai) dan dibersihkan juga di Sheet\nconst dedupe = (sh, list) => { const m = new Map(); list.forEach(r => { if (m.has(r.id)) legacyQ.push([sh, r]); m.set(r.id, r); }); return [...m.values()]; };\nconst norm = d => { const o = emptyData(); Object.keys(SHEETS).forEach(s => o[SHEETS[s]] = dedupe(s, (d && d[SHEETS[s]]) || [])); o.settings = { ...DEFAULT_SETTINGS, ...((d && d.settings) || {}) }; return o; };
function banner() {
  const b = $('#banner');
  if (remote() && !banner.err) { b.hidden = true; return; }
  b.hidden = false; b.className = '';
  b.innerHTML = banner.err ? `<span>⚠ Gagal terhubung ke Google Sheets (${esc(banner.err)}). Data yang tampil adalah salinan di browser ini.</span><button id="bn-set">Periksa koneksi</button>`
    : `<span>⚠ Belum tersambung ke Google Sheets: data hanya di browser ini dan bisa hilang. Sambungkan sekarang (±3 menit), data yang sudah ada ikut terkirim otomatis.</span><button class="pri" id="bn-set">Sambungkan</button>`;
  $('#bn-set').onclick = () => $('#b-set').click();
}
async function load() {
  const local = readLocal();
  banner.err = '';
  if (remote()) {
    status('Memuat dari Google Sheets…');
    try {
      const j = await api({ action: 'all' });
      const remoteData = norm(j); if (!j.settings) remoteData.settings = { ...DEFAULT_SETTINGS, ...((local && local.settings) || {}) };
      data = remoteData;
      await syncUp(local);
      status('Tersambung: Google Sheets Anda');
    } catch (e) { banner.err = e.message; data = norm(local); status('Offline: salinan lokal'); }
  } else { data = norm(local); status('Belum tersambung ke Sheets'); }
  migrateLegacy();
  saveLocal(); buildLibur(); banner();
  flushLegacy().catch(e => console.error(e));
}
// kirim baris lokal yang belum ada di Sheets (migrasi data yang sudah diketik sebelum tersambung)
async function syncUp(local) {
  if (!local) return;
  let n = 0;
  for (const sh of Object.keys(SHEETS)) {
    const have = new Set((data[SHEETS[sh]] || []).map(x => x.id)), rows = (local[SHEETS[sh]] || []).filter(x => x.id && !have.has(x.id));
    if (!rows.length) continue;
    for (let i = 0; i < rows.length; i += 40) await api({ action: 'bulk', sheet: sh, rows: rows.slice(i, i + 40) });
    data[SHEETS[sh]].push(...rows); n += rows.length;
  }
  if (local.settings && !Object.keys(data.settings).some(k => k !== 'libur' && data.settings[k] && data.settings[k] !== DEFAULT_SETTINGS[k])) { data.settings = { ...data.settings, ...local.settings }; await api({ action: 'settings', settings: data.settings }); }
  if (n) toast(`${n} data lokal dikirim ke Google Sheets.`, 6000);
}
// dokumen lama yang masih membawa status_klien ketikan -> jadikan entitas Status
function migrateLegacy() {
  data.dokumen.forEach(d => {
    const code = d.status_klien;
    if (d.status_id || !code) return;
    let st = data.status.find(s => s.klien_id === d.klien_id && s.status === code);
    if (!st) { st = { id: uid(), klien_id: d.klien_id, status: code, tgl_alih: d.tgl_dokumen || '', layanan: /^\s*b/i.test(code) ? 'PUTUSAN' : 'HAK', pk_id: (data.pk[0] || {}).id || '' }; data.status.push(st); legacyQ.push(['Status', st]); }
    d.status_id = st.id; legacyQ.push(['Dokumen', d]);
  });
  // perkara yang dulu diketik per dokumen -> pindah ke klien (sekali)
  data.klien.forEach(k => {
    if (k.perkara || k.pasal) return;
    const d = data.dokumen.find(x => x.klien_id === k.id && x.perkara); if (!d) return;
    const i = d.perkara.indexOf('/'); k.perkara = (i < 0 ? d.perkara : d.perkara.slice(0, i)).trim(); k.pasal = i < 0 ? '' : d.perkara.slice(i + 1).trim();
    legacyQ.push(['Klien', k]);
  });
}
const legacyQ = [];
const hapus = (...a) => remove(...a);
async function flushLegacy() { while (legacyQ.length) { const [s, r] = legacyQ.shift(); if (remote()) await api({ action: 'upsert', sheet: s, row: r }); } saveLocal(); }
async function upsert(sheet, row) {
  const list = data[SHEETS[sheet]]; const i = list.findIndex(x => x.id === row.id);
  i >= 0 ? list[i] = row : list.push(row);
  saveLocal(); if (remote()) await api({ action: 'upsert', sheet, row });
}
async function remove(sheet, id) {
  const k = SHEETS[sheet]; data[k] = data[k].filter(x => x.id !== id);
  saveLocal(); if (remote()) await api({ action: 'remove', sheet, id });
}
async function saveSettings() { saveLocal(); if (remote()) await api({ action: 'settings', settings: data.settings }); }
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
  const st = dok && stOf(dok);
  if (dok && !st) return { ok: false, why: 'Dokumen belum terhubung ke status klien' };
  if (st && st.tgl_alih && date < st.tgl_alih) return { ok: false, why: `Tidak boleh sebelum tanggal alih status ${st.status} (${Doc.tgl(st.tgl_alih)})` };
  return { ok: true, soft: di.st === 'un' ? di.why : '' };
}
function suggest(dok, from) {
  let d = from || todayIso(); if (dok && dok.tgl_dokumen && d <= dok.tgl_dokumen) d = addDays(dok.tgl_dokumen, 1);
  const st = dok && stOf(dok); if (st && st.tgl_alih && d < st.tgl_alih) d = st.tgl_alih;
  for (let i = 0; i < 400; i++, d = addDays(d, 1)) { const c = check(dok, d); if (c.ok && !c.soft) return d; }
  return null;
}
function prevWorkday(date) { let d = addDays(date, -1); for (let i = 0; i < 10; i++, d = addDays(d, -1)) { const w = Doc.parse(d).getDay(); if (w && w < 6 && !libur.has(d)) return d; } return date; }

// ============================================================ relasi
const klienOf = id => data.klien.find(k => k.id === id);
const dokOf = id => data.dokumen.find(d => d.id === id);
const kegOfDok = id => data.kegiatan.filter(g => g.dokumen_id === id);
const stOf = d => data.status.find(s => s.id === d.status_id);
const kind = d => (stOf(d) || {}).layanan || 'HAK';
const stCode = d => (stOf(d) || {}).status || '?';
const pkOf = id => data.pk.find(p => p.id === id);
function stLabel(s) { return `${s.status} · alih ${Doc.tgl(s.tgl_alih)} · ${KEG_LABEL[s.layanan]}`; }
function dokLabel(d) { return `${DOC_SHORT[d.jenis] || d.jenis} ${d.nomor || ''} · ${Doc.tgl(d.tgl_dokumen)}`; }

// data PK/Kepala yang berlaku pada tanggal tertentu (riwayat berperiode)
const riwayatPk = pkId => data.riwayat.filter(r => r.pk_id === pkId).sort((a, b) => a.mulai.localeCompare(b.mulai));
function riwayatAt(pkId, date) { const l = riwayatPk(pkId); return [...l].reverse().find(r => r.mulai <= date) || l[0]; }
function kepalaAt(date) { const l = [...data.kepala].sort((a, b) => a.mulai.localeCompare(b.mulai)); return [...l].reverse().find(r => r.mulai <= date) || l[0]; }
const pangkatOf = gol => PANGKAT[gol] ? `${PANGKAT[gol]} / ${gol}` : gol;
const jabatanOf = r => `${TIPE_LABEL[r.tipe] || TIPE_LABEL.PK} ${r.jenjang || ''}`.trim();
function sFor(pkId, date) {
  const pk = pkOf(pkId), r = pk && riwayatAt(pkId, date), kp = kepalaAt(date), s = { ...data.settings };
  s.kepala_nama = kp ? kp.nama : '';
  if (pk) {
    s.pk_nama_gelar = pk.nama; s.pk_nama = pk.nama_singkat || pk.nama; s.pk_nip = pk.nip;
    s.sp_pk_nama = pk.nama; s.sp_pk_nip = pk.nip;
    if (r) { s.pk_label = TIPE_LABEL[r.tipe] || TIPE_LABEL.PK; s.sp_pk_pangkat = pangkatOf(r.golongan); s.sp_pk_jabatan = jabatanOf(r); }
  }
  return s;
}
const perkaraOf = (k, d) => [k.perkara, k.pasal].filter(Boolean).join('/ ') || (d && d.perkara) || '';
function itemFor(g) {
  const d = dokOf(g.dokumen_id), k = klienOf(d && d.klien_id); if (!d || !k) return null;
  const st = stOf(d) || {}, jenis = kind(d), putusanDoc = d.jenis.startsWith('PUTUSAN') || d.jenis === 'PENETAPAN';
  const keg = {
    jenis, status_klien: st.status || '', tgl_sp: g.tgl_sprint, tgl_pel: g.tgl_pel, staf: g.staf,
    putusan: d.nomor ? `${d.nomor} / ${Doc.tgl(d.tgl_dokumen)}` : '', pidana: d.pidana,
    dasar: `${DOC_LABEL[d.jenis] || 'Dokumen'} Nomor : ${d.nomor || '-'} Tanggal ${Doc.tgl(d.tgl_dokumen)}`,
    hasil: g.hasil, sudah_putusan: jenis === 'HAK' && putusanDoc ? '1' : '', tempat: d.tempat, ket: d.tempat ? 'Di ' + d.tempat : '',
  };
  return { keg, k: { ...k, perkara: perkaraOf(k, d) }, g, d, st, pk_id: st.pk_id, photos: photos.get(g.id) || [] };
}

// ============================================================ tab
$$('#tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
function showTab(t) {
  ui.tab = t;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('main > section').forEach(s => s.hidden = s.id !== 'tab-' + t);
  ({ klien: renderKlien, pejabat: renderPejabat, kalender: renderKalender, unduh: renderUnduh })[t]();
}

// ============================================================ dialog
function dialog(html, onSubmit, opts = {}) {
  const f = $('#dlg-form'); f.innerHTML = html + `<div class="acts">${opts.extra || ''}<button type="button" value="x" id="dlg-x">Batal</button><button class="pri" value="ok">${opts.ok || 'Simpan'}</button></div>`;
  $('#dlg-x').onclick = () => $('#dlg').close();
  f.onsubmit = async e => {
    e.preventDefault();
    if (f.dataset.busy) return;                       // cegah klik ganda / data dobel
    const ok = $('.pri', f), label = ok.textContent;
    f.dataset.busy = '1'; ok.disabled = true; ok.textContent = 'Menyimpan…';
    try {
      const o = {}; [...f.elements].forEach(x => { if (x.name) o[x.name] = x.type === 'checkbox' ? (x.checked ? '1' : '') : x.value.trim(); });
      if (await onSubmit(o) !== false) $('#dlg').close();
    } catch (err) { console.error(err); toast('Gagal: ' + err.message, 6000); }
    finally { delete f.dataset.busy; ok.disabled = false; ok.textContent = label; }
  };
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
    .map(k => `<div class="item ${k.id === ui.klien ? 'on' : ''}" data-id="${k.id}"><b>${esc(k.nama)}</b><small>${data.status.filter(s => s.klien_id === k.id).map(s => s.status).join(', ') || 'belum ada status'} · ${data.dokumen.filter(d => d.klien_id === k.id).length} dokumen</small></div>`).join('')
    || '<p class="hint">Belum ada klien. Klik + untuk menambah.</p>';
  $$('#k-list .item').forEach(e => e.onclick = () => { ui.klien = e.dataset.id; renderKlien(); });
  const k = klienOf(ui.klien), pane = $('#k-detail');
  if (!k) { pane.innerHTML = '<p class="hint">Pilih klien di kiri, atau tambah klien baru.</p>'; return; }
  const docs = data.dokumen.filter(d => d.klien_id === k.id).sort((a, b) => (a.tgl_dokumen || '').localeCompare(b.tgl_dokumen || ''));
  const sts = data.status.filter(s => s.klien_id === k.id).sort((a, b) => (a.tgl_alih || '').localeCompare(b.tgl_alih || ''));
  pane.innerHTML = `
    <div class="row between"><h2>${esc(k.nama)}</h2><div class="row"><button id="k-ubah">Ubah data</button><button id="k-gabung">Gabung ke klien lain</button><button id="k-hapus" class="danger">Hapus</button></div></div>
    <p class="hint">${esc(k.tempat_lahir)}, ${Doc.tgl(k.tgl_lahir)} · ${esc(k.agama)} · ${esc(k.pekerjaan)} · ${esc(k.alamat)}</p>
    <p class="hint"><b>Perkara:</b> ${esc(perkaraOf(k)) || '—'} · <b>Asal lembaga:</b> ${esc(k.asal_lembaga) || '—'}</p>
    <div class="row between" style="margin-top:14px"><h3>1. Perubahan status klien</h3><button id="s-baru" class="pri">+ Status</button></div>
    <table><thead><tr><th>Status</th><th>Tgl alih status</th><th>Layanan</th><th>PK</th><th></th></tr></thead><tbody>
    ${sts.map(s => `<tr><td><span class="tag ${s.layanan === 'PUTUSAN' ? 'b' : ''}">${esc(s.status)}</span></td><td>${Doc.tgl(s.tgl_alih)}</td><td>${KEG_LABEL[s.layanan]}</td><td>${esc((pkOf(s.pk_id) || {}).nama_singkat || (pkOf(s.pk_id) || {}).nama || '—')}</td>
      <td style="white-space:nowrap"><button data-sed="${s.id}">Ubah</button> <button data-sdel="${s.id}" class="danger">×</button></td></tr>`).join('')
      || '<tr><td colspan="5" class="hint">Belum ada status. Tambah status (mis. AIII) dengan tanggal alihnya; ini batas awal tanggal pelaksanaan.</td></tr>'}
    </tbody></table>
    <div class="row between" style="margin-top:18px"><h3>2. Dokumen hukum</h3><button id="d-baru" class="pri">+ Dokumen</button></div>
    <table><thead><tr><th>Dokumen</th><th>Status</th><th>Kegiatan</th><th></th></tr></thead><tbody>
    ${docs.map(d => {
      const g = kegOfDok(d.id)[0];
      return `<tr><td>${esc(dokLabel(d))}</td><td><span class="tag ${kind(d) === 'PUTUSAN' ? 'b' : ''}">${esc(stCode(d))}</span></td>
      <td>${KEG_LABEL[kind(d)]}<br><small class="hint">${g && g.tgl_pel ? 'Dijadwalkan ' + Doc.tgl(g.tgl_pel) : 'Belum dijadwalkan'}</small></td>
      <td style="white-space:nowrap"><button data-ed="${d.id}">Ubah</button> <button data-del="${d.id}" class="danger">×</button></td></tr>`;
    }).join('') || '<tr><td colspan="4" class="hint">Belum ada dokumen. Tambah status dulu, lalu dokumen sumber hukum (SP Han, putusan, penetapan) untuk status itu.</td></tr>'}
    </tbody></table>`;
  $('#s-baru').onclick = () => editStatus(null, k);
  $$('[data-sed]', pane).forEach(b => b.onclick = () => editStatus(data.status.find(s => s.id === b.dataset.sed), k));
  $$('[data-sdel]', pane).forEach(b => b.onclick = guard(async () => {
    if (data.dokumen.some(d => d.status_id === b.dataset.sdel)) return toast('Status ini dipakai dokumen; hapus/ubah dokumennya dulu.');
    if (confirm('Hapus status ini?')) { await remove('Status', b.dataset.sdel); renderKlien(); }
  }));
  $('#k-ubah').onclick = () => editKlien(k);
  $('#k-hapus').onclick = guard(async () => {
    const ds = data.dokumen.filter(d => d.klien_id === k.id), ss = data.status.filter(s => s.klien_id === k.id);
    const gs = ds.flatMap(d => kegOfDok(d.id));
    if (!confirm(`Hapus ${k.nama}${ds.length + ss.length ? ` beserta ${ss.length} status, ${ds.length} dokumen, ${gs.length} jadwal` : ''}? Tidak bisa dibatalkan.`)) return;
    for (const g of gs) await hapus('Kegiatan', g.id);
    for (const d of ds) await hapus('Dokumen', d.id);
    for (const s of ss) await hapus('Status', s.id);
    await hapus('Klien', k.id); ui.klien = null; renderKlien(); toast('Klien dihapus.');
  });
  $('#k-gabung').onclick = () => {
    const lain = data.klien.filter(x => x.id !== k.id).sort((a, b) => a.nama.localeCompare(b.nama));
    if (!lain.length) return toast('Tidak ada klien lain.');
    dialog(`<h2>Gabung ke klien lain</h2><p class="hint">Semua status, dokumen, dan jadwal milik <b>${esc(k.nama)}</b> dipindah ke klien yang dipilih, lalu klien ini dihapus. Pilih klien yang datanya ingin dipertahankan.</p>
      <label>Gabung ke<select name="ke">${lain.map(x => `<option value="${x.id}" ${x.nama.toLowerCase() === k.nama.toLowerCase() ? 'selected' : ''}>${esc(x.nama)} · ${esc(x.tempat_lahir)}, ${Doc.tgl(x.tgl_lahir)}</option>`).join('')}</select></label>`,
    async o => {
      for (const s of data.status.filter(x => x.klien_id === k.id)) await upsert('Status', { ...s, klien_id: o.ke });
      for (const d of data.dokumen.filter(x => x.klien_id === k.id)) await upsert('Dokumen', { ...d, klien_id: o.ke });
      await hapus('Klien', k.id); ui.klien = o.ke; renderKlien(); toast('Digabung.');
    }, { ok: 'Gabung' });
  };
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
    <div class="w2"><label>Alamat<textarea name="alamat" rows="2">${esc(k.alamat)}</textarea></label></div>
    <div class="w2"><h3>Perkara (melekat pada klien)</h3></div>
    ${field('perkara', 'Perkara', k.perkara, 'placeholder="Narkotika"')}
    ${field('asal_lembaga', 'Asal lembaga', k.asal_lembaga, 'placeholder="Rutan Kelas IIB Sintang"')}
    <div class="w2">${field('pasal', 'Pasal', k.pasal, 'placeholder="Pasal 114 (1) UU RI No. 35 Tahun 2009"')}</div></div>`,
  async o => { const row = { ...k, id: k.id || uid(), ...o }; await upsert('Klien', row); ui.klien = row.id; renderKlien(); });
}

function editStatus(s, k) {
  s = s || {};
  if (!data.pk.length) { toast('Isi dulu data PK di tab "PK & Kepala".', 5000); return showTab('pejabat'); }
  const last = data.status.filter(x => x.klien_id === k.id).sort((a, b) => b.tgl_alih.localeCompare(a.tgl_alih))[0];
  dialog(`<h2>${s.id ? 'Ubah status' : 'Perubahan status'} · ${esc(k.nama)}</h2><div class="grid">
    <label>Status (kode)<input name="status" list="st-saran" value="${esc(s.status)}" required placeholder="mis. AIII" autocomplete="off"><datalist id="st-saran">${STATUS_SARAN.map(x => `<option>${x}</option>`).join('')}</datalist></label>
    ${field('tgl_alih', 'Tanggal alih status', s.tgl_alih, 'type="date" required')}
    <label>Layanan pendampingan<select name="layanan">${Object.entries(KEG_LABEL).map(([v, l]) => `<option value="${v}" ${(s.layanan || (last && last.layanan === 'HAK' ? 'PUTUSAN' : 'HAK')) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>PK pendamping<select name="pk_id">${data.pk.map(p => `<option value="${p.id}" ${(s.pk_id || (data.pk[0] || {}).id) === p.id ? 'selected' : ''}>${esc(p.nama_singkat || p.nama)}</option>`).join('')}</select></label></div>
    <p class="hint">Tanggal alih status menjadi batas paling awal tanggal pelaksanaan pendampingan untuk status ini.</p>`,
  async o => { await upsert('Status', { id: s.id || uid(), klien_id: k.id, ...o }); renderKlien(); });
}

function editDokumen(d, k) {
  d = d || {};
  const sts = data.status.filter(s => s.klien_id === k.id).sort((a, b) => a.tgl_alih.localeCompare(b.tgl_alih));
  if (!sts.length) return toast('Tambah dulu status klien (mis. AIII) sebelum mengisi dokumen hukum.', 5000);
  dialog(`<h2>${d.id ? 'Ubah dokumen' : 'Dokumen baru'} · ${esc(k.nama)}</h2><div class="grid">
    <div class="w2"><label>Untuk status<select name="status_id">${sts.map(s => `<option value="${s.id}" ${(d.status_id || sts[sts.length - 1].id) === s.id ? 'selected' : ''}>${esc(stLabel(s))}</option>`).join('')}</select></label></div>
    <label>Jenis dokumen<select name="jenis">${Object.entries(DOC_LABEL).map(([v, l]) => `<option value="${v}" ${d.jenis === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    ${field('nomor', 'Nomor dokumen', d.nomor)}
    ${field('tgl_dokumen', 'Tanggal dokumen', d.tgl_dokumen, 'type="date" required')}
    ${field('tempat', 'Tempat pendampingan', d.tempat || k.asal_lembaga || data.settings.tempat)}
    ${field('pidana', 'Lama pidana (untuk putusan)', d.pidana, 'placeholder="03 (tiga) tahun"')}</div>`,
  async o => { await upsert('Dokumen', { ...d, id: d.id || uid(), klien_id: k.id, ...o }); renderKlien(); });
}

// ============================================================ PK & KEPALA
function renderPejabat() {
  const box = $('#pj');
  const pkCard = p => {
    const rs = riwayatPk(p.id);
    return `<div class="card"><div class="row between"><div><b>${esc(p.nama)}</b><br><small class="hint">NIP ${esc(p.nip)}${p.alias ? ' · di sheet jadwal: ' + esc(p.alias) : ''}</small></div>
      <div class="row"><button data-pk-ed="${p.id}">Ubah</button><button data-pk-up="${p.id}" class="pri">+ Perubahan pangkat/jenjang</button></div></div>
      <table><thead><tr><th>Berlaku sejak</th><th>Pangkat / Gol.</th><th>Jabatan</th><th></th></tr></thead><tbody>
      ${rs.map((r, i) => `<tr><td>${Doc.tgl(r.mulai)}${i ? '' : ' <small class="hint">(awal)</small>'}</td><td>${esc(pangkatOf(r.golongan))}</td><td>${esc(jabatanOf(r))}</td>
        <td style="white-space:nowrap"><button data-rw-ed="${r.id}">Ubah</button> ${i ? `<button data-rw-del="${r.id}" class="danger">×</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  };
  const kp = [...data.kepala].sort((a, b) => a.mulai.localeCompare(b.mulai));
  box.innerHTML = `<div class="row between"><h2>Pembimbing Kemasyarakatan (PK / APK)</h2><button id="pk-baru" class="pri">+ PK baru</button></div>
    <p class="hint">Isi awal wajib lengkap. Bila dalam 1 tahun ada kenaikan pangkat atau jenjang, tambahkan perubahan dengan tanggal berlakunya; SP, BON, dan Laporan otomatis memakai data yang berlaku pada tanggal dokumen.</p>
    ${data.pk.map(pkCard).join('') || '<p class="hint">Belum ada PK.</p>'}
    <div class="row between"><h2>Kepala Bapas</h2>${kp.length < 2 ? '<button id="kp-baru" class="pri">+ Periode</button>' : ''}</div>
    <p class="hint">Maksimal 2 periode berdasarkan tanggal mulai. Tanda tangan memakai Kepala yang berlaku pada tanggal dokumen.</p>
    <div class="card"><table><thead><tr><th>Berlaku sejak</th><th>Nama</th><th>NIP</th><th></th></tr></thead><tbody>
    ${kp.map(r => `<tr><td>${Doc.tgl(r.mulai)}</td><td>${esc(r.nama)}</td><td>${esc(r.nip)}</td><td style="white-space:nowrap"><button data-kp-ed="${r.id}">Ubah</button> <button data-kp-del="${r.id}" class="danger">×</button></td></tr>`).join('') || '<tr><td colspan="4" class="hint">Belum ada Kepala.</td></tr>'}</tbody></table></div>`;
  $('#pk-baru').onclick = () => editPk(null);
  if ($('#kp-baru')) $('#kp-baru').onclick = () => editKepala(null);
  $$('[data-pk-ed]', box).forEach(b => b.onclick = () => editPk(pkOf(b.dataset.pkEd)));
  $$('[data-pk-up]', box).forEach(b => b.onclick = () => editRiwayat(null, pkOf(b.dataset.pkUp)));
  $$('[data-rw-ed]', box).forEach(b => b.onclick = () => { const r = data.riwayat.find(x => x.id === b.dataset.rwEd); editRiwayat(r, pkOf(r.pk_id)); });
  $$('[data-rw-del]', box).forEach(b => b.onclick = guard(async () => { if (confirm('Hapus perubahan ini?')) { await hapus('PKRiwayat', b.dataset.rwDel); renderPejabat(); } }));
  $$('[data-kp-ed]', box).forEach(b => b.onclick = () => editKepala(data.kepala.find(x => x.id === b.dataset.kpEd)));
  $$('[data-kp-del]', box).forEach(b => b.onclick = guard(async () => { if (confirm('Hapus periode Kepala ini?')) { await hapus('Kepala', b.dataset.kpDel); renderPejabat(); } }));
}

// bagian form pangkat/jenjang (dipakai PK baru dan perubahan)
function riwayatFields(r) {
  r = r || {};
  return `<label>Tipe<select name="tipe">${Object.entries(TIPE_LABEL).map(([v, l]) => `<option value="${v}" ${r.tipe === v ? 'selected' : ''}>${v} · ${l}</option>`).join('')}</select></label>
    <label>Jenjang<select name="jenjang"></select></label>
    <label>Gol/ruang<select name="golongan" required><option value="">— pilih —</option>${Object.keys(PANGKAT).map(g => `<option ${r.golongan === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
    <label>Pangkat (otomatis)<input name="pangkat" readonly></label>`;
}
function wireRiwayat(f, r) {
  const fill = () => {
    const t = f.elements.tipe.value, cur = f.elements.jenjang.value || (r && r.jenjang) || '';
    f.elements.jenjang.innerHTML = JENJANG[t].map(j => `<option ${j === cur ? 'selected' : ''}>${j}</option>`).join('');
    f.elements.pangkat.value = PANGKAT[f.elements.golongan.value] || '';
  };
  f.elements.tipe.onchange = () => { f.elements.jenjang.innerHTML = ''; fill(); };
  f.elements.golongan.onchange = fill; fill();
}

function editPk(p) {
  p = p || {};
  const f = dialog(`<h2>${p.id ? 'Ubah PK' : 'PK baru'}</h2><div class="grid">
    <div class="w2">${field('nama', 'Nama lengkap + gelar', p.nama, 'required')}</div>
    ${field('nama_singkat', 'Nama singkat (untuk laporan)', p.nama_singkat, 'required')}
    ${field('nip', 'NIP', p.nip, 'required inputmode="numeric"')}
    ${field('alias', 'Nama di sheet jadwal (mis. Tuffa)', p.alias)}
    ${p.id ? '' : `<div class="w2"><h3>Data awal (wajib lengkap)</h3></div>${field('mulai', 'Berlaku sejak', '', 'type="date" required')}<span></span>${riwayatFields()}`}</div>`,
  async o => {
    const id = p.id || uid();
    await upsert('PK', { id, nama: o.nama, nama_singkat: o.nama_singkat, nip: o.nip, alias: o.alias });
    if (!p.id) await upsert('PKRiwayat', { id: uid(), pk_id: id, mulai: o.mulai, golongan: o.golongan, tipe: o.tipe, jenjang: o.jenjang });
    renderPejabat();
  });
  if (!p.id) wireRiwayat(f);
}
function editRiwayat(r, p) {
  r = r || {};
  const prev = riwayatPk(p.id).filter(x => x.id !== r.id).pop();
  const f = dialog(`<h2>${r.id ? 'Ubah' : 'Perubahan pangkat/jenjang'} · ${esc(p.nama_singkat || p.nama)}</h2><div class="grid">
    ${field('mulai', 'Berlaku sejak (tanggal batas)', r.mulai, 'type="date" required')}<span></span>${riwayatFields(r.id ? r : prev)}</div>
    <p class="hint">Dokumen bertanggal sebelum tanggal ini tetap memakai data sebelumnya.</p>`,
  async o => {
    const first = riwayatPk(p.id)[0];
    if (first && first.id !== r.id && o.mulai <= first.mulai) { toast('Tanggal harus setelah data awal (' + Doc.tgl(first.mulai) + ').', 5000); return false; }
    await upsert('PKRiwayat', { id: r.id || uid(), pk_id: p.id, mulai: o.mulai, golongan: o.golongan, tipe: o.tipe, jenjang: o.jenjang }); renderPejabat();
  });
  wireRiwayat(f, r.id ? r : prev);
}
function editKepala(r) {
  r = r || {};
  dialog(`<h2>${r.id ? 'Ubah' : 'Periode'} Kepala Bapas</h2><div class="grid"><div class="w2">${field('nama', 'Nama lengkap + gelar', r.nama, 'required')}</div>
    ${field('nip', 'NIP', r.nip, 'required')}${field('mulai', 'Berlaku sejak', r.mulai, 'type="date" required')}</div>`,
  async o => {
    if (data.kepala.some(x => x.id !== r.id && x.mulai === o.mulai)) { toast('Tanggal mulai sama dengan periode lain.', 5000); return false; }
    await upsert('Kepala', { id: r.id || uid(), ...o }); renderPejabat();
  });
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
      <small><span class="tag ${kind(d) === 'PUTUSAN' ? 'b' : ''}">${esc(stCode(d))}</span>${KEG_LABEL[kind(d)]} · terbit ${Doc.tgl(d.tgl_dokumen)}</small></div>`;
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
  const d = dokOf(g.dokumen_id), k = klienOf(d.klien_id), j = kind(d);
  dialog(`<h2>${esc(k.nama)}</h2><p class="hint">${KEG_LABEL[j]} · ${esc(dokLabel(d))}</p><div class="grid">
    ${field('tgl_pel', 'Tanggal pelaksanaan', g.tgl_pel, `type="date" min="${[addDays(d.tgl_dokumen, 1), (stOf(d) || {}).tgl_alih || ''].sort().pop()}"`)}
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
      <div><b>${esc(it.k.nama)}</b><br><span class="tag ${it.keg.jenis === 'PUTUSAN' ? 'b' : ''}">${esc(it.stCode(d))}</span>${KEG_LABEL[it.keg.jenis]}<br><small class="hint">${Doc.hari(g.tgl_pel)}, ${Doc.tgl(g.tgl_pel)} · sprint ${Doc.tgl(g.tgl_sprint)}</small></div>
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
      const l = photos.get(id) || [], j = kind(dokOf(g.dokumen_id));
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
function pkCheck(it, date) {
  const miss = it.filter(x => !pkOf(x.pk_id) || !riwayatAt(x.pk_id, date(x)));
  if (miss.length) { toast('Data PK belum lengkap untuk: ' + [...new Set(miss.map(x => x.k.nama))].join(', ') + '. Isi di tab "PK & Kepala".', 6000); return false; }
  if (!kepalaAt(date(it[0]))) { toast('Isi data Kepala Bapas di tab "PK & Kepala".', 6000); return false; }
  return true;
}
const spDate = x => x.keg.tgl_sp || x.keg.tgl_pel;

busy($('#p-sp'), async it => {
  if (!pkCheck(it, spDate)) return;
  const one = x => Doc.sp(x.keg, x.k, sFor(x.pk_id, spDate(x)));
  if (it.length === 1) return download(await one(it[0]), `SP ${safe(it[0].k.nama)}.docx`);
  const zip = new JSZip();
  for (const x of it) zip.file(`SP ${x.keg.tgl_pel} ${safe(x.k.nama)}.docx`, await one(x));
  download(await zip.generateAsync({ type: 'blob' }), 'SP Pendampingan.zip');
});
busy($('#p-bon'), async it => {
  const tglBon = $('#p-tglbon').value || todayIso();
  if (new Set(it.map(x => x.pk_id)).size > 1) return toast('BON hanya untuk satu PK. Centang kegiatan milik satu PK saja.', 6000);
  if (!pkCheck(it, () => tglBon)) return;
  download(await Doc.bon(it, sFor(it[0].pk_id, tglBon), tglBon), 'Bon Pendampingan Dewasa.docx');
});
busy($('#p-lap'), async it => {
  if (!pkCheck(it, x => x.keg.tgl_pel)) return;
  download(await Doc.laporan(it.map(x => ({ ...x, s: sFor(x.pk_id, x.keg.tgl_pel) })), data.settings), 'Laporan Pendampingan Dewasa.docx');
});

// ============================================================ PENGATURAN
$('#b-set').onclick = () => {
  const c = conn(), s = data.settings;
  const f = dialog(`<h2>Pengaturan</h2>
    <h3>Penyimpanan: Google Sheets ${remote() && !banner.err ? '✓ tersambung' : '(belum tersambung)'}</h3>
    <p class="hint">Data utama tersimpan di Google Sheet Anda; browser hanya menyimpan salinan cadangan. Data yang sudah terlanjur diketik di browser ini otomatis dikirim saat tersambung.</p>
    <div class="grid"><div class="w2">${field('url', 'URL Web App Apps Script (…/exec)', c.url)}</div>${field('key', 'Kata sandi (APP_KEY)', c.key)}
    <div style="align-self:end"><button type="button" id="s-kode">Buat kode skrip</button></div></div>
    <div id="s-kodebox" hidden><p class="hint"><b>Langkah:</b> (1) buat Google Sheet baru → Extensions → Apps Script, hapus isinya, tempel kode di bawah, Save. (2) Deploy → New deployment → Web app: Execute as <i>Me</i>, access <i>Anyone</i> → Deploy → izinkan akses. (3) Salin URL <code>/exec</code> ke kolom di atas, lalu Simpan.</p>
    <textarea class="code" id="s-kode-t" readonly></textarea><button type="button" id="s-salin">Salin kode</button></div>
    <h3>Aturan umum</h3><div class="grid">${SETTING_FIELDS.map(([k, l]) => field('s_' + k, l, s[k])).join('')}</div>
    <label>Libur nasional &amp; cuti bersama (<code>YYYY-MM-DD nama</code> per baris)<textarea name="libur" rows="6">${esc(s.libur)}</textarea></label>
    <p class="hint">PK, pangkat/jenjang, dan Kepala diatur di tab "PK &amp; Kepala".</p>
    <div class="row" style="margin-top:10px"><button type="button" id="s-exp">Ekspor JSON (cadangan)</button><label class="inline"><button type="button" id="s-impb">Impor JSON</button><input type="file" id="s-imp" accept=".json" hidden></label></div>`,
  async o => {
    SETTING_FIELDS.forEach(([k]) => data.settings[k] = k === 'uang' ? Number(o['s_' + k]) || 0 : o['s_' + k]);
    data.settings.libur = o.libur;
    const had = Object.keys(SHEETS).some(sh => (data[SHEETS[sh]] || []).length);
    if (had && o.url && !remote()) download(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), 'bon-data-cadangan.json'); // jaring pengaman sebelum migrasi
    localStorage.setItem('bon_conn', JSON.stringify({ url: o.url, key: o.key }));
    saveLocal();
    await load();
    if (banner.err) { toast('Gagal tersambung: ' + banner.err, 7000); return false; }
    await saveSettings(); await loadExt(true); showTab(ui.tab); toast(remote() ? 'Tersambung dan tersimpan di Google Sheets.' : 'Pengaturan tersimpan (belum tersambung ke Sheets).', 5000);
  });
  $('#s-kode').onclick = guard(async () => {
    const key = f.elements.key.value || (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : uid() + uid()); f.elements.key.value = key;
    const src = await (await fetch('apps-script/Code.gs?v=' + Date.now())).text();
    $('#s-kode-t').value = src.replace("const APP_KEY = 'GANTI_DENGAN_KATA_SANDI'", `const APP_KEY = '${key}'`); $('#s-kodebox').hidden = false;
  });
  $('#s-salin').onclick = () => { $('#s-kode-t').select(); navigator.clipboard && navigator.clipboard.writeText($('#s-kode-t').value); toast('Kode disalin.'); };
  $('#s-exp').onclick = () => download(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), 'bon-data.json');
  $('#s-impb').onclick = () => $('#s-imp').click();
  $('#s-imp').onchange = guard(async e => {
    const f2 = e.target.files[0]; if (!f2) return; const d = JSON.parse(await f2.text());
    for (const sh of Object.keys(SHEETS)) for (const r of d[SHEETS[sh]] || []) await upsert(sh, r);
    toast('Data diimpor.'); $('#dlg').close(); showTab(ui.tab);
  });
};
// ============================================================ mulai
guard(async () => { await load(); showTab('klien'); loadExt(false).then(() => { if (ui.tab === 'kalender') renderKalender(); }).catch(() => {}); })();




