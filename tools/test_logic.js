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
const EXPOSE = '\n;globalThis.T={data:()=>data,setData:d=>data=d,check,suggest,sFor,kepalaAt,riwayatAt,pangkatOf,libur:()=>libur,buildLibur,itemFor};';
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
console.log('ok logika');

