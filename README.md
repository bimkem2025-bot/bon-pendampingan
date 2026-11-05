# Bon Pendampingan

Web app statis (GitHub Pages) untuk membuat **SP/Sprint**, **BON**, dan **Laporan** pendampingan yang saling terhubung.
Dokumen dibuat di browser; foto tidak pernah diunggah. Repo ini hanya berisi kode dan template kosong, **tanpa data klien**.

## Alur
1. **Klien & Dokumen**: isi klien sekali (unik), lalu tambah dokumen sumber hukum per klien (SP Han, putusan PN/PT/MA, penetapan)
   beserta tanggal dokumen dan status/no. register. Status `A*` = tahanan → *Pendampingan Pemenuhan Hak*; `B*` = narapidana → *Pelaksanaan Putusan*.
   Satu klien boleh punya banyak dokumen (mis. putusan PN, lalu PT, lalu MA).
2. **Kalender**: seret klien dari daftar "Perlu dijadwalkan" ke tanggal (atau klik klien lalu klik tanggal). Tombol *Saran tanggal* memilih hari idle terdekat.
3. **Unduh**: centang kegiatan, seret foto ke kotak foto, unduh SP (zip), BON, dan Laporan.

## Aturan tanggal
- Tanggal dokumen < tanggal pelaksanaan (tidak boleh sama hari).
- Tanggal dokumen ≤ tanggal sprint ≤ tanggal pelaksanaan (sprint default: hari kerja sebelum pelaksanaan, bisa diubah dengan klik kegiatan di kalender).
- Pelaksanaan hanya di hari kerja non-libur, satu kegiatan per hari, dan hari yang belum dipilih PK lain.
- Jadwal PK lain dibaca langsung dari Google Sheet "Kontrol Surat Tugas" (ID di Pengaturan; sheet harus bisa dilihat siapa pun dengan link).
  Hari kerja yang tidak punya baris di sheet ditandai kuning (boleh dipilih setelah konfirmasi).

## Menyimpan data
Default: di browser ini (localStorage). Disarankan memakai Google Sheets Anda:
1. Buat Google Sheet baru → **Extensions → Apps Script**, tempel `apps-script/Code.gs`.
2. **Project Settings → Script properties** → tambah `APP_KEY` (kata sandi rahasia).
3. **Deploy → New deployment → Web app**: *Execute as: Me*, *Access: Anyone*. Salin URL `/exec`.
4. Di aplikasi: ⚙ Pengaturan → tempel URL dan kata sandi. Tab `Klien`, `Dokumen`, `Kegiatan` dibuat otomatis.

Data hanya terbaca bila membawa `APP_KEY` yang benar. Ekspor/impor JSON tersedia di Pengaturan sebagai cadangan.

## Template dokumen
`templates/*.docx` dibuat dari dokumen asli: `python tools/build_templates.py <folder-dokumen-asli>` (butuh `lxml`).
Skrip membuang data klien dan nama penulis, lalu memasang tag `{nama}` dst. Dokumen asli jangan di-commit (sudah di `.gitignore`).
`${nomor_naskah}` dan `${ttd_pengirim}` di SP sengaja dibiarkan (diisi sistem e-office).

## Uji
`node tools/test_docgen.js` menghasilkan contoh dokumen di `out/` (perlu `out/foto.jpg` sembarang JPEG).
