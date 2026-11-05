// Uji logika app.js (status, batas tanggal, PK/Kepala berperiode) tanpa browser: node tools/test_logic.js
const fs = require('fs'), vm = require('vm');
const el = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : (k === 'dataset' ? {} : el), set: () => true, apply: () => el });
const store = {};
const ctx = {
  console, setTimeout, clearTimeout, URL, Date, JSON, Math, Promise, Set, Map, Object, Array, String, Number, RegExp, Error,
  document: new Proxy({}, { get: () => el }), localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = v },
  fetch: async () => ({ ok: false }), confirm: () => true, crypto: { randomUUID: () => 'x' },
};
ctx.window = ctx; vm.createContext(ctx);
const src = ['holidays.js', 'docgen.js', 'app.js'].map(f => fs.readFileSync(f, 'utf8')).join('\n');
const EXPOSE = '\n;globalThis.T={setExt:e=>ext=e,dayInfo,DEFAULT_LIBUR,data:()=>data,setData:d=>data=d,check,suggest,sFor,kepalaAt,riwayatAt,pangkatOf,libur:()=>libur,buildLibur,itemFor,load,banner:()=>banner.err,saved:()=>store};';
vm.runInContext(src.replace(/guard\(async \(\) => \{ await load\(\);[\s\S]*$/, '') + EXPOSE, ctx);
const T = ctx.T; const assert = require('assert');
T.setData({ klien: [{ id: 'k', nama: 'A', tempat_lahir: 'X', tgl_lahir: '1990-01-01' }], status: [{ id: 's1', klien_id: 'k', status: 'AIII', tgl_alih: '2026-11-16', layanan: 'HAK', pk_id: 'p' }],
  dokumen: [{ id: 'd1', klien_id: 'k', status_id: 's1', jenis: 'SP_HAN', nomor: '1', tgl_dokumen: '2026-11-10' }], kegiatan: [],
  pk: [{ id: 'p', nama: 'Budi, S.H.', nama_singkat: 'Budi', nip: '1' }],
  riwayat: [{ id: 'r1', pk_id: 'p', mulai: '2026-01-01', golongan: 'III/a', tipe: 'PK', jenjang: 'Ahli Pertama' }, { id: 'r2', pk_id: 'p', mulai: '2026-07-01', golongan: 'III/b', tipe: 'PK', jenjang: 'Ahli Muda' }],
  kepala: [{ id: 'a', nama: 'Kepala Lama', nip: '1', mulai: '2026-01-01' }, { id: 'b', nama: 'Kepala Baru', nip: '2', mulai: '2026-09-01' }], settings: { libur: '' } });
T.buildLibur();
const d = T.data().dokumen[0];
assert.strictEqual(T.check(d, '2026-11-13').ok, false, 'sebelum alih status harus ditolak'); // Jumat 13 Nov
assert.strictEqual(T.check(d, '2026-11-16').ok, true, 'tepat tgl alih (Senin) boleh');
assert.strictEqual(T.suggest(d, '2026-11-11'), '2026-11-16');
assert.strictEqual(T.sFor('p', '2026-03-01').sp_pk_pangkat, 'Penata Muda / III/a');
assert.strictEqual(T.sFor('p', '2026-07-01').sp_pk_jabatan, 'Pembimbing Kemasyarakatan Ahli Muda');
assert.strictEqual(T.sFor('p', '2026-03-01').kepala_nama, 'Kepala Lama');
assert.strictEqual(T.sFor('p', '2026-10-01').kepala_nama, 'Kepala Baru');
// jatah monev: tanggal terisi PK lain tetap boleh; tanggal yang tidak ada di sheet = idle; libur/cuti bersama tetap menghalangi
T.setExt({ rows: [{ tgl: '2026-11-17', nama: 'Klien X', pk: 'Ani' }], t: 1 });
assert.strictEqual(T.check(d, '2026-11-17').ok, true, 'monev terisi PK lain tidak boleh menghalangi');
assert.ok(T.check(d, '2026-11-17').noMonev, 'harus ditandai tanpa jatah monev');
assert.strictEqual(T.dayInfo('2026-11-18').st, 'free', 'tanggal tak ada di sheet = idle');
assert.strictEqual(T.suggest(d, '2026-11-17'), '2026-11-18', 'saran memilih hari yang masih punya jatah monev');
T.data().settings.libur = T.DEFAULT_LIBUR; T.buildLibur();
assert.strictEqual(T.check(d, '2026-12-24').ok, false, 'cuti bersama Natal menghalangi');
assert.strictEqual(T.check(d, '2026-12-23').ok, true);
T.data().settings.libur = ''; T.buildLibur();// muat dari backend palsu: baris kembar harus melebur dan tidak ada galat
(async () => {
  const calls = [];
  ctx.fetch = async (u, o) => { const b = JSON.parse(o.body); calls.push(b.action); return { json: async () => b.action === 'all' ? { ok: true, klien: [{ id: 'k1', nama: 'Dobel' }, { id: 'k1', nama: 'Dobel' }, { id: 'k2', nama: 'Lain' }], status: [], dokumen: [], kegiatan: [], pk: [], riwayat: [], kepala: [], settings: null } : { ok: true } }; };
  store.bon_key = 'rahasia';
  await T.load();
  assert.strictEqual(T.banner(), '', 'tidak boleh ada galat koneksi: ' + T.banner());
  assert.strictEqual(T.data().klien.length, 2, 'baris kembar harus melebur');
  console.log('ok logika + muat backend');
})().catch(e => { console.error(e); process.exit(1); });


