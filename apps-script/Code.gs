/**
 * Backend Google Sheets untuk aplikasi Bon Pendampingan.
 * 1) Buka Google Sheet kosong > Extensions > Apps Script > hapus isi bawaan, tempel file ini.
 * 2) Ganti APP_KEY di bawah dengan kata sandi rahasia Anda (aplikasi web menyediakan kode yang sudah terisi).
 * 3) Deploy > New deployment > Web app: Execute as "Me", Who has access "Anyone" > Deploy > salin URL /exec.
 * Data hanya terbaca bila request membawa APP_KEY yang benar.
 */
const APP_KEY = 'GANTI_DENGAN_KATA_SANDI';

const COLS = {
  Klien: ['id', 'nama', 'jk', 'tempat_lahir', 'tgl_lahir', 'agama', 'suku', 'pendidikan', 'pekerjaan', 'kawin', 'alamat', 'perkara', 'pasal', 'asal_lembaga'],
  Status: ['id', 'klien_id', 'status', 'tgl_alih', 'layanan', 'pk_id'],
  Dokumen: ['id', 'klien_id', 'status_id', 'jenis', 'nomor', 'tgl_dokumen', 'perkara', 'tempat', 'pidana'],
  Kegiatan: ['id', 'dokumen_id', 'tgl_sprint', 'tgl_pel', 'staf', 'hasil', 'monev', 'link_sprint', 'bon'],
  PK: ['id', 'nama', 'nama_singkat', 'nip', 'alias'],
  PKRiwayat: ['id', 'pk_id', 'mulai', 'golongan', 'tipe', 'jenjang'],
  Kepala: ['id', 'nama', 'nip', 'mulai'],
  Pengaturan: ['key', 'value'],
};
const OUT = { Klien: 'klien', Status: 'status', Dokumen: 'dokumen', Kegiatan: 'kegiatan', PK: 'pk', PKRiwayat: 'riwayat', Kepala: 'kepala' };

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.ttd) return ttdHalaman_(String(p.ttd));       // halaman ponsel PK: tanpa kata sandi, token acak = kredensial
  return handle_(p);
}
function doPost(e) { return handle_(JSON.parse(e.postData.contents)); }

// ---- Tanda tangan PK lewat ponsel (tautan/QR). Gambar dititipkan sementara di cache (maks 6 jam), lalu diambil aplikasi.
const TTD_TTL = 21600, TTD_MAX = 90000;
function ttdBaru_() {
  const token = Utilities.getUuid().replace(/-/g, '').slice(0, 14);
  CacheService.getScriptCache().put('ttd_' + token, JSON.stringify({ s: 'wait' }), TTD_TTL);
  return { ok: true, token: token, url: ScriptApp.getService().getUrl() + '?ttd=' + token };
}
function ttdCek_(token) {
  const raw = CacheService.getScriptCache().get('ttd_' + String(token || ''));
  if (!raw) return { ok: true, status: 'expired' };
  const o = JSON.parse(raw);
  return o.s === 'ok' ? { ok: true, status: 'ok', img: o.img } : { ok: true, status: 'wait' };
}
// dipanggil dari halaman ponsel lewat google.script.run
function ttdKirim(token, dataUrl) {
  const cache = CacheService.getScriptCache(), key = 'ttd_' + String(token || ''), raw = cache.get(key);
  if (!raw || JSON.parse(raw).s !== 'wait') return { success: false, message: 'Tautan sudah dipakai atau kedaluwarsa.' };
  const s = String(dataUrl || '');
  if (s.length > TTD_MAX || !/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(s)) return { success: false, message: 'Gambar tanda tangan tidak valid atau terlalu besar.' };
  cache.put(key, JSON.stringify({ s: 'ok', img: s }), TTD_TTL);
  return { success: true };
}
function ttdHalaman_(token) {
  const raw = CacheService.getScriptCache().get('ttd_' + token), aktif = raw && JSON.parse(raw).s === 'wait';
  let html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'
    + 'body{margin:0;font:15px system-ui,sans-serif;background:#f6f7f8;color:#1f2937;padding:16px}h3{margin:0 0 4px}p{color:#6b7280;margin:0 0 10px}'
    + 'canvas{width:100%;height:240px;border:1px dashed #9ca3af;border-radius:10px;background:#fff;touch-action:none;display:block}'
    + 'button{height:42px;padding:0 18px;margin:12px 8px 0 0;border-radius:8px;border:1px solid #3f5f7f;background:#fff;color:#3f5f7f;font:inherit;font-weight:600}'
    + 'button.p{background:#3f5f7f;color:#fff}#m{margin-top:12px;font-weight:600}</style></head><body>';
  if (!aktif) return HtmlService.createHtmlOutput(html + '<h3>Tanda tangan PK</h3><p>Tautan ini sudah dipakai atau kedaluwarsa. Minta tautan baru dari petugas.</p></body></html>').setTitle('Tanda tangan PK');
  html += '<h3>Tanda tangan Pembimbing Kemasyarakatan</h3><p>Tanda tangani di kotak, lalu tekan Kirim. Cukup sekali; berlaku untuk semua laporan dalam satu BON.</p><canvas id="c" width="900" height="360"></canvas>'
    + '<button id="u">Ulangi</button><button id="k" class="p">Kirim</button><div id="m"></div>'
    + '<script>var T=' + JSON.stringify(token) + ',c=document.getElementById("c"),x=c.getContext("2d"),m=document.getElementById("m"),d=false,n=0;'
    + 'x.lineWidth=5;x.lineCap="round";x.lineJoin="round";x.strokeStyle="#000";'
    + 'function p(e){var r=c.getBoundingClientRect();return[(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]}'
    + 'c.onpointerdown=function(e){d=true;n++;c.setPointerCapture(e.pointerId);var a=p(e);x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(a[0]+.1,a[1]);x.stroke()};'
    + 'c.onpointermove=function(e){if(!d)return;var a=p(e);x.lineTo(a[0],a[1]);x.stroke()};'
    + 'c.onpointerup=c.onpointercancel=function(){d=false};'
    + 'document.getElementById("u").onclick=function(){x.clearRect(0,0,c.width,c.height);n=0};'
    // potong ke tepi coretan agar rapi & kecil
    + 'function crop(){var w=c.width,h=c.height,D=x.getImageData(0,0,w,h).data,a=w,b=h,r=0,t=0,i,j;for(j=0;j<h;j++)for(i=0;i<w;i++)if(D[(j*w+i)*4+3]>20){if(i<a)a=i;if(i>r)r=i;if(j<b)b=j;if(j>t)t=j}'
    + 'a=Math.max(0,a-8);b=Math.max(0,b-8);r=Math.min(w-1,r+8);t=Math.min(h-1,t+8);var o=document.createElement("canvas");o.width=r-a+1;o.height=t-b+1;o.getContext("2d").drawImage(c,a,b,o.width,o.height,0,0,o.width,o.height);return o}'
    + 'document.getElementById("k").onclick=function(){if(!n){m.textContent="Tanda tangani dulu.";return}var o=crop(),s=o.toDataURL("image/png");'
    + 'while(s.length>85000){var q=document.createElement("canvas");q.width=Math.round(o.width*.8);q.height=Math.round(o.height*.8);q.getContext("2d").drawImage(o,0,0,q.width,q.height);o=q;s=o.toDataURL("image/png")}'
    + 'this.disabled=true;google.script.run.withSuccessHandler(function(r){m.textContent=r.success?"Terkirim. Anda boleh menutup halaman ini.":r.message}).withFailureHandler(function(){m.textContent="Gagal mengirim, coba lagi."}).ttdKirim(T,s)};'
    + '</script></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('Tanda tangan PK').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// aksi tanpa kata sandi untuk halaman TTD di ponsel (ttd.html): token acak sekali pakai adalah satu-satunya kredensial
function ttdPublik_(req) {
  const cache = CacheService.getScriptCache(), k = 'ttd_' + String(req.token || ''), raw = cache.get(k);
  if (req.action === 'ttdada') return { ok: true, status: !raw ? 'expired' : (JSON.parse(raw).s === 'wait' ? 'wait' : 'used') };
  const r = ttdKirim(req.token, req.img);
  return r.success ? { ok: true } : { ok: false, error: r.message };
}

function handle_(req) {
  if (req.action === 'ttdada' || req.action === 'ttdkirim') return json_(ttdPublik_(req));
  const key = APP_KEY !== 'GANTI_DENGAN_KATA_SANDI' ? APP_KEY : PropertiesService.getScriptProperties().getProperty('APP_KEY');
  if (!key || req.key !== key) return json_({ ok: false, error: 'unauthorized' });
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    switch (req.action) {
      case 'all': {
        const o = { ok: true, settings: settings_() };
        Object.keys(OUT).forEach(n => o[OUT[n]] = rows_(n));
        return json_(o);
      }
      case 'upsert': upsert_(req.sheet, req.row); return json_({ ok: true });
      case 'bulk': (req.rows || []).forEach(r => upsert_(req.sheet, r)); return json_({ ok: true, n: (req.rows || []).length });
      case 'remove': remove_(req.sheet, req.id); return json_({ ok: true });
      case 'ttdbaru': return json_(ttdBaru_());
      case 'ttdcek': return json_(ttdCek_(req.token));
      case 'settings': upsert_('Pengaturan', { key: 'settings', value: JSON.stringify(req.settings) }); return json_({ ok: true });
      default: return json_({ ok: false, error: 'aksi tidak dikenal' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function sheet_(name) {
  if (!COLS[name]) throw new Error('sheet tidak valid: ' + name);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, COLS[name].length).setValues([COLS[name]]).setFontWeight('bold');
    sh.getRange(1, 1, sh.getMaxRows(), COLS[name].length).setNumberFormat('@'); // teks: tanggal tidak berubah jadi Date
    sh.setFrozenRows(1);
  } else {
    // kolom baru (mis. perkara/pasal/asal_lembaga) ditambahkan ke header sheet lama tanpa mengubah data
    const have = sh.getRange(1, 1, 1, COLS[name].length).getValues()[0];
    if (have.join('|') !== COLS[name].join('|')) sh.getRange(1, 1, 1, COLS[name].length).setValues([COLS[name]]).setFontWeight('bold');
  }
  return sh;
}

function str_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}

function rows_(name) {
  const sh = sheet_(name), cols = COLS[name];
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, cols.length).getValues()
    .filter(r => r[0] !== '')
    .map(r => { const o = {}; cols.forEach((c, i) => o[c] = str_(r[i])); return o; });
}

function settings_() {
  const r = rows_('Pengaturan').filter(x => x.key === 'settings')[0];
  return r ? JSON.parse(r.value) : null;
}

function upsert_(name, row) {
  const sh = sheet_(name), cols = COLS[name];
  const vals = cols.map(c => str_(row[c]));
  const last = sh.getLastRow();
  const ids = last < 2 ? [] : sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0]));
  const i = ids.indexOf(vals[0]);
  const target = i >= 0 ? i + 2 : last + 1;
  sh.getRange(target, 1, 1, cols.length).setNumberFormat('@').setValues([vals]);
  // buang baris kembar dengan id yang sama
  for (let j = ids.length - 1; j > i && i >= 0; j--) if (ids[j] === vals[0]) sh.deleteRow(j + 2);
}

function remove_(name, id) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0]));
  for (let i = ids.length - 1; i >= 0; i--) if (ids[i] === String(id)) sh.deleteRow(i + 2); // semua baris ber-id sama
}
