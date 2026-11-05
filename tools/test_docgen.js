// node tools/test_docgen.js  -> tulis hasil uji ke folder out/ (diabaikan git)
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const JSZip = require(path.join(root, 'lib/jszip.min.js'));
const fakeJpg = fs.readFileSync(path.join(root, 'out', 'foto.jpg'));
const ctx = { JSZip, console, Date, createImageBitmap: async () => ({ width: 1200, height: 900 }), document: { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob: cb => cb({ arrayBuffer: async () => fakeJpg.buffer.slice(fakeJpg.byteOffset, fakeJpg.byteOffset + fakeJpg.length) }) }) }, fetch: async u => {
  const b = fs.readFileSync(path.join(root, u.split('?')[0]));
  return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length), text: async () => b.toString('utf8') };
} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'docgen.js'), 'utf8') + ';this.Doc=Doc', ctx);
const D = ctx.Doc;
const s = { pk_nama_gelar: 'PK Uji, S.Sos', pk_nama: 'PK Uji', pk_nip: '1', ppk_nama: 'PPK Uji', ppk_nip: '2', kepala_nama: 'KEPALA UJI', sp_pk_nama: 'SPPK', sp_pk_nip: '3', sp_pk_pangkat: 'III/c', sp_pk_jabatan: 'Ahli', uang: 170000, tempat: 'Lapas Sintang', ket: 'Di Lapas Sintang', staf_hak: 'Staf A', staf_putusan: 'Staf B' };
const k = n => ({ nama: n, jk: 'Laki-laki', tempat_lahir: 'Sintang', tgl_lahir: '2000-04-14', agama: 'Islam', suku: 'Jawa/Indonesia/WNI', pendidikan: 'SMA', pekerjaan: 'Swasta', kawin: 'Belum Menikah', perkara: 'Perkara X & Y', alamat: 'Jl. Uji <1>' });
const items = [
  { keg: { jenis: 'HAK', status_klien: 'AV', tgl_pel: '2026-11-09', tgl_sp: '2026-11-06', sudah_putusan: '1', dasar: 'Petikan Putusan X' }, k: k('Uji Satu'), photos: [{ file: {}, caption: 'Pendampingan Pemenuhan Hak' }, { file: {}, caption: 'Foto 2' }] },
  { keg: { jenis: 'PUTUSAN', status_klien: 'BI', tgl_pel: '2026-11-10', tgl_sp: '2026-11-10', putusan: '1/K/2026 / 01 Januari 2026', pidana: '03 (tiga) tahun' }, k: k('Uji Dua'), photos: [] },
];
(async () => {
  fs.mkdirSync(path.join(root, 'out'), { recursive: true });
  const w = async (n, b) => fs.writeFileSync(path.join(root, 'out', n), Buffer.from(await b.arrayBuffer()));
  await w('sp.docx', await D.sp(items[0].keg, items[0].k, s));
  await w('bon.docx', await D.bon(items, s, '2026-11-12'));
  await w('laporan.docx', await D.laporan(items, s));
  console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });

