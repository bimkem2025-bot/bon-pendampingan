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
  Kegiatan: ['id', 'dokumen_id', 'tgl_sprint', 'tgl_pel', 'staf', 'hasil', 'monev', 'link_sprint'],
  PK: ['id', 'nama', 'nama_singkat', 'nip', 'alias'],
  PKRiwayat: ['id', 'pk_id', 'mulai', 'golongan', 'tipe', 'jenjang'],
  Kepala: ['id', 'nama', 'nip', 'mulai'],
  Pengaturan: ['key', 'value'],
};
const OUT = { Klien: 'klien', Status: 'status', Dokumen: 'dokumen', Kegiatan: 'kegiatan', PK: 'pk', PKRiwayat: 'riwayat', Kepala: 'kepala' };

function doGet(e) { return handle_(e.parameter || {}); }
function doPost(e) { return handle_(JSON.parse(e.postData.contents)); }

function handle_(req) {
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
