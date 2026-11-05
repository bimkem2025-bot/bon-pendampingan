# Bon Pendampingan

Web app statis (GitHub Pages) untuk membuat **SP/Sprint**, **BON**, dan **Laporan** pendampingan yang saling terhubung.
Dokumen dibuat di browser; foto tidak pernah diunggah. Repo ini hanya berisi kode dan template kosong, **tanpa data klien**.

## Alur
1. **Klien**: isi identitas klien sekali (unik).
2. **PK & Kepala** (sekali di awal): PK (nama, NIP, gol/ruang -> pangkat otomatis, tipe PK/APK, jenjang) wajib lengkap. Bila ada kenaikan pangkat/jenjang,
   tambahkan *perubahan* dengan tanggal berlakunya; Kepala maksimal 2 periode. SP/BON/Laporan memakai data yang berlaku pada tanggal dokumennya.
3. **Status klien**: per klien tambah status (mis. AIII, BI), **tanggal alih status**, layanan (*Pemenuhan Hak Tahanan* atau *Pelaksanaan Putusan*), dan PK.
   Tanggal pelaksanaan tidak boleh lebih awal dari tanggal alih status.
4. **Dokumen hukum**: pilih dulu status yang mana, lalu isi SP Han/putusan/penetapan beserta tanggalnya.
5. **Kalender**: seret klien ke tanggal (atau klik lalu klik tanggal); *Saran tanggal* memilih hari idle terdekat.
6. **Unduh**: centang kegiatan, seret foto, unduh SP (zip), BON (satu PK), Laporan.

## Aturan tanggal
- Tanggal dokumen < tanggal pelaksanaan; tanggal alih status ≤ tanggal pelaksanaan.
- Tanggal dokumen ≤ tanggal sprint ≤ tanggal pelaksanaan.
- Hari kerja non-libur, satu kegiatan per hari, dan hari yang belum dipilih PK lain (sheet "Kontrol Surat Tugas", ID di Pengaturan).
  Hari kerja tanpa baris di sheet ditandai kuning (boleh dipilih setelah konfirmasi).

## Menyimpan data (Google Sheets)
Data utama ada di Google Sheet Anda; browser hanya menyimpan salinan cadangan. Pengaturan (⚙) → **Buat kode skrip** menyiapkan kode Apps Script lengkap dengan kata sandi:
1. Google Sheet baru → **Extensions → Apps Script**, tempel kode, Save.
2. **Deploy → New deployment → Web app**: *Execute as: Me*, *Access: Anyone*. Salin URL `/exec`.
3. Tempel URL di Pengaturan → Simpan. Tab Klien, Status, Dokumen, Kegiatan, PK, PKRiwayat, Kepala dibuat otomatis, dan data yang sudah ada di browser ikut terkirim.

Data hanya terbaca bila membawa kata sandi yang benar. Ekspor/impor JSON tersedia di Pengaturan.
## Template dokumen
`templates/*.docx` dibuat dari dokumen asli: `python tools/build_templates.py <folder-dokumen-asli>` (butuh `lxml`).
Skrip membuang data klien dan nama penulis, lalu memasang tag `{nama}` dst. Dokumen asli jangan di-commit (sudah di `.gitignore`).
`${nomor_naskah}` dan `${ttd_pengirim}` di SP sengaja dibiarkan (diisi sistem e-office).

## Uji
`node tools/test_docgen.js` menghasilkan contoh dokumen di `out/` (perlu `out/foto.jpg` sembarang JPEG).

