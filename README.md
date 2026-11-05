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
6. **Unduh**: per kegiatan tekan *Pratinjau SP* / *Pratinjau Laporan* (seret foto ke baris itu), lihat hasilnya, lalu *Unduh PDF* satu per satu (Word tetap tersedia untuk disunting). BON: centang kegiatan satu PK, *Pratinjau BON*. PDF berukuran F4 dengan kop seperti project Reg-2026 (`assets/kop.png`, `pdfdoc.js`, html2pdf).

## Aturan tanggal
- Tanggal dokumen < tanggal pelaksanaan; tanggal alih status ≤ tanggal pelaksanaan.
- Tanggal dokumen ≤ tanggal sprint ≤ tanggal pelaksanaan.
- Yang menghalangi hanya: akhir pekan, libur nasional/cuti bersama (daftar di Pengaturan), dan jadwal Anda sendiri di hari itu.
- Sheet "Kontrol Surat Tugas" hanyalah **kuota monev**. Tanggal yang sudah terisi PK lain artinya jatah monev hari itu terpakai; kegiatan tetap boleh dilaksanakan, hanya tanpa jatah monev. Tanggal yang tidak ada di sheet = idle. Tombol **↻ Tarik jatah monev dari sheet** di Kalender mengambil data terbaru. "Saran tanggal" mengutamakan hari yang masih punya jatah monev.

## Menyimpan data (Google Sheets)
Backend Google Sheets sudah tertanam di aplikasi; yang diisi sekali per perangkat hanya kata sandi. Browser menyimpan salinan cadangan dan langsung menampilkannya saat dibuka, lalu menyegarkan dari Sheet di latar belakang. Ekspor/impor JSON ada di Pengaturan. Deploy kode skrip: `powershell -File tools\push-script.ps1` (clasp, konfigurasi rahasia di `apps-script/.local.json`).
## Template dokumen
`templates/*.docx` dibuat dari dokumen asli: `python tools/build_templates.py <folder-dokumen-asli>` (butuh `lxml`).
Skrip membuang data klien dan nama penulis, lalu memasang tag `{nama}` dst. Dokumen asli jangan di-commit (sudah di `.gitignore`).
`${nomor_naskah}` dan `${ttd_pengirim}` di SP sengaja dibiarkan (diisi sistem e-office).

## Uji
`node tools/test_logic.js` (aturan tanggal, PK/Kepala, muat backend) dan `node tools/test_docgen.js` menghasilkan contoh dokumen di `out/` (perlu `out/foto.jpg` sembarang JPEG).


## Paket BON, TTD PK, Template
- Rekap: centang pelaksanaan (satu PK) lalu **Buat paket BON**. Per paket: unggah BON bertanda tangan (halaman pertama), **Minta TTD PK** (QR/tautan ke ponsel, gambar hitam, sekali untuk semua laporan dalam paket; atau gambar di layar / unggah), lalu **Gabung & unduh PDF** = BON + per pelaksanaan (Sprint + Laporan bertanda tangan & foto + Lampiran). BON sendiri tidak diberi TTD elektronik.
- Per pelaksanaan: link Sprint (kolom Sheet link_sprint) atau berkas Sprint, dan Lampiran dari lokal. Berkas, foto, dan TTD hanya di browser (IndexedDB), tidak dikirim ke server; hanya penitipan sementara TTD dari ponsel lewat cache Apps Script (maks 6 jam, sekali pakai).
- Tab Unduh: unduh semua SP (ZIP) dan semua Laporan yang sudah ada foto (ZIP).
- Tab Template: editor teks kaya dengan placeholder ${...}.

