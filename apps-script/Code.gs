/**
 * Backend Google Sheets untuk aplikasi Bon Pendampingan.
 * Pasang: buka Sheet Anda > Extensions > Apps Script > tempel file ini.
 * Project Settings > Script properties > tambah APP_KEY = (kata sandi rahasia Anda).
 * Deploy > New deployment > Web app: Execute as "Me", Access "Anyone". Salin URL /exec.
 * Data hanya terbaca bila request membawa APP_KEY yang benar.
 */
const COLS = {
  Klien: ['id', 'nama', 'jk', 'tempat_lahir', 'tgl_lahir', 'agama', 'suku', 'pendidikan', 'pekerjaan', 'kawin', 'alamat'],
  Dokumen: ['id', 'klien_id', 'jenis', 'nomor', 'tgl_dokumen', 'status_klien', 'perkara', 'tempat', 'pidana'],
  Kegiatan: ['id', 'dokumen_id', 'tgl_sprint', 'tgl_pel', 'staf', 'hasil'],
  Pengaturan: ['key', 'value'],
};

function doGet(e) { return handle_(e.parameter || {}); }
function doPost(e) { return handle_(JSON.parse(e.postData.contents)); }

function handle_(req) {
  const key = PropertiesService.getScriptProperties().getProperty('APP_KEY');
  if (!key || req.key !== key) return json_({ ok: false, error: 'unauthorized' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (req.action) {
      case 'all': return json_({ ok: true, klien: rows_('Klien'), dokumen: rows_('Dokumen'), kegiatan: rows_('Kegiatan'), settings: settings_() });
      case 'upsert': upsert_(req.sheet, req.row); return json_({ ok: true });
      case 'remove': remove_(req.sheet, req.id); return json_({ ok: true });
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
  if (!COLS[name]) throw new Error('sheet tidak valid');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, COLS[name].length).setValues([COLS[name]]).setFontWeight('bold');
    sh.getRange(1, 1, sh.getMaxRows(), COLS[name].length).setNumberFormat('@'); // teks, supaya tanggal tidak berubah jadi Date
    sh.setFrozenRows(1);
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
}

function remove_(name, id) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0]));
  const i = ids.indexOf(String(id));
  if (i >= 0) sh.deleteRow(i + 2);
}

