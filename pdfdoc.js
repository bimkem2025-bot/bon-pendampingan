/* Dokumen versi PDF: kop surat dan ukuran kertas mengikuti project Reg-2026 (F4 215,9 x 330,2 mm, Times New Roman,
   kop dari gambar KOP). Isi dokumen sama dengan template Word. Semua dibuat di browser. */
const PdfDoc = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tgl = Doc.tgl, rp = n => Doc.rupiah(n).replace(/\s/g, ' ');

  const CSS = `<style>
.doc{font:11pt/1.4 "Times New Roman",Times,serif;color:#000;background:#fff}
.doc .pg{width:215.9mm;min-height:328mm;box-sizing:border-box;padding:9mm 20mm 10mm;background:#fff;page-break-after:always;overflow:hidden}
.doc .pg:last-child{page-break-after:auto}.doc.sm{font-size:10.5pt;line-height:1.34}.doc.sm .ttd .sp{height:16mm}.doc.sm p{margin-bottom:5px}
.doc .kop img{width:100%;height:auto;display:block}.doc .kop hr{border:0;border-top:2px solid #000;margin:3px 0 14px}
.doc h1{font-size:12.5pt;text-align:center;margin:0;font-weight:700}
.doc p{margin:0 0 7px;text-align:justify}.doc .c{text-align:center}.doc .r{text-align:right}.doc .b{font-weight:700}
.doc table{border-collapse:collapse;width:100%}.doc td,.doc th{vertical-align:top;padding:1px 0;border:0;color:#000;font-size:inherit;font-weight:inherit;letter-spacing:0;text-transform:none;text-align:left}.doc h1,.doc p{letter-spacing:0;text-transform:none;color:#000}
.doc .kv td:nth-child(1){white-space:nowrap;padding-right:1.5mm}.doc .kv td:nth-child(2){width:3mm;text-align:left}.doc .kv td:nth-child(3){width:100%;padding-left:1.5mm}
.doc .ls>tbody>tr>td:nth-child(1){width:27mm}.doc .ls>tbody>tr>td:nth-child(2){width:5mm;text-align:center}.doc .ls>tbody>tr>td:nth-child(3){width:8mm}.doc .ls>tbody>tr>td{text-align:justify}.doc .kv{width:auto}
.doc .id td:nth-child(1){width:9mm}.doc .id td:nth-child(2){white-space:nowrap;padding-right:1.5mm}.doc .id td:nth-child(3){width:3mm}.doc .id td:nth-child(4){width:100%}
.doc .gt th,.doc .gt td{border:1px solid #000;padding:4px 5px;font-size:10.5pt}.doc .gt th{text-align:center;font-weight:700;vertical-align:middle}.doc .gt td.c{text-align:center}.doc .gt td.r{text-align:right}.doc .gt td.b{font-weight:700}
.doc .ttd{margin-left:50%;text-align:center;margin-top:18px;page-break-inside:avoid}.doc .ttd .sp{height:21mm}
.doc .ttd2{display:flex;align-items:center;margin-top:14px;page-break-inside:avoid}.doc .ttd2 .l{width:45%}.doc .ttd2 .g{width:10%}.doc .ttd2 .r2{width:45%;text-align:left}
.doc .ttd2 img{display:block;height:41px;width:auto;margin:6px 0}
.doc .gt{table-layout:fixed}.doc .gt td.r,.doc .gt td.nw{white-space:nowrap}
.doc ul{margin:0 0 7px;padding-left:9mm}.doc ul li{text-align:justify}
.doc .foto{page-break-inside:avoid}.doc .foto td{border:1px solid #000;padding:6px;text-align:center;vertical-align:middle}.doc .foto img{max-width:100%;max-height:70mm;display:block;margin:0 auto}
</style>`;
  const kop = '<div class="kop"><img src="assets/kop.png" alt=""><hr></div>';
  const wrap = (pages, cls = "") => `<div class="doc ${cls}">${CSS}${pages}</div>`;
  const page = body => `<div class="pg">${body}</div>`;

  // ---------------------------------------------------------------- SP
  function sp(keg, k, s) {
    const put = keg.jenis === 'PUTUSAN';
    const kegiatan = put ? 'Pelaksanaan Putusan' : 'Pemenuhan Hak Tahanan/ Tersangka/ Terdakwa';
    const menimbang = [
      'bahwa berdasarkan tugas dan fungsi Balai Pemasyarakatan Kelas II Sintang terhadap klien anak adalah melaksanakan Bimbingan Kemasyarakatan;',
      'bahwa berdasarkan program kerja Balai Pemasyarakatan Kelas II Sintang tentang pendampingan pemeriksaan, penelitian kemasyarakatan dan pendampingan persidangan terhadap Anak yang Berkonflik dengan Hukum;',
      'bahwa tugas Pembimbing Kemasyarakatan untuk melaksanakan pendampingan pemeriksaan bagi Anak yang Berkonflik dengan Hukum;',
      'bahwa berdasarkan pertimbangan sebagaimana dimaksud dalam huruf a, dan huruf b, huruf c, dan huruf d, maka Kepala Balai Pemasyarakatan Kelas II Sintang mengeluarkan Surat Perintah.',
    ];
    const dasar = [
      'Undang – Undang Republik Indonesia Nomor 22 Tahun 2022 tentang Pemasyarakatan;',
      'Undang – Undang Republik Indonesia Nomor 11 Tahun 2012 tentang Sistem Peradilan Pidana Anak;',
      'Peraturan Menteri Hukum dan Hak Asasi Manusia RI Nomor 7 Tahun 2017 tentang Pedoman Penghitungan Kebutuhan Jabatan Fungsional Pembimbing Kemasyarakatan;',
      'Peraturan Menteri Hukum dan Hak Asasi Manusia Republik Indonesia Nomor 41 Tahun 2017 tentang Pelaksanaan Jabatan Fungsional Pembimbing Kemasyarakatan;',
    ];
    if (keg.dasar && keg.dasar.trim()) dasar.push(esc(keg.dasar.trim()));
    const ls = (label, items, mark) => `<table class="ls">${items.map((t, i) => `<tr><td>${i ? '' : label}</td><td>${i ? '' : ':'}</td><td>${mark(i)}</td><td>${t}</td></tr>`).join('')}</table>`;
    const kv = rows => `<table class="kv">${rows.map(([a, b, bold]) => `<tr><td>${a}</td><td>:</td><td${bold ? ' class="b"' : ''}>${esc(b)}</td></tr>`).join('')}</table>`;
    return wrap(page(`${kop}
      <h1>SURAT PERINTAH</h1><div class="c">Nomor: ${'$'}{nomor_naskah}</div>
      <h1 style="margin:2px 0 10px">KEPALA BALAI PEMASYARAKATAN KELAS II SINTANG</h1>
      ${ls('Menimbang', menimbang, i => 'abcd'[i] + '.')}
      <div style="height:6px"></div>
      ${ls('<b>Dasar</b>', dasar, i => (i + 1) + '.')}
      <h1 style="margin:10px 0">MEMERINTAHKAN</h1>
      <table class="ls"><tr><td>Kepada</td><td>:</td><td colspan="2" style="padding:0">${kv([['Nama', s.sp_pk_nama], ['NIP', s.sp_pk_nip], ['Pangkat', s.sp_pk_pangkat], ['Jabatan', s.sp_pk_jabatan]])}</td></tr></table>
      <div style="height:6px"></div>
      <table class="ls">
        <tr><td><b>Untuk</b></td><td>:</td><td>1.</td><td><b>Melaksanakan Pendampingan ${kegiatan} di Lapas/ Rutan terhadap klien atas nama :</b>
          <div style="margin-top:3px">${kv([['Nama', k.nama, 1], ['Tempat, Tgl Lahir', `${k.tempat_lahir}, ${tgl(k.tgl_lahir)}`], ['Alamat', k.alamat], ['Perkara', k.perkara]])}</div></td></tr>
        <tr><td></td><td></td><td>2.</td><td>Melaksanakan Pendampingan ${kegiatan} di Lapas/ Rutan Klien Dewasa.</td></tr>
        <tr><td></td><td></td><td>3.</td><td>Melaporkan hasil kegiatan kepada Kepala Balai Pemasyarakatan</td></tr>
      </table>
      <p style="margin-top:10px">Demikian Surat Perintah untuk dilaksanakan dan kepada semua pihak terkait dimohon bantuannya. Terima kasih.</p>
      <div class="ttd2"><div class="l">${'$'}{ttd_pengirim}</div><div class="g"></div><div class="r2">Sintang, ${tgl(keg.tgl_sp || keg.tgl_pel)}<br>Kepala,<img src="assets/ttd-el.png" alt=""><b>${esc(s.kepala_nama)}</b></div></div>`), "sm");
  }

  // ---------------------------------------------------------------- BON
  function bon(items, s, tglBon) {
    const cols = '<colgroup><col style="width:9mm"><col><col style="width:16mm"><col style="width:25mm"><col style="width:25mm"><col style="width:29mm"><col style="width:27mm"></colgroup>';
    const head = '<tr><th>No</th><th>Nama Klien</th><th>Status Klien</th><th>Tanggal Surat Perintah</th><th>Tanggal Pelaksanaan</th><th>Besar Uang (Rp.)</th><th>Keterangan</th></tr>';
    const row = ({ keg, k }, i) => `<tr><td class="c">${i + 1}</td><td>${esc(k.nama)}<br>${keg.jenis === 'PUTUSAN' ? '(Pendampingan Pelaksanaan Putusan)' : '(Pendampingan Pemenuhan Hak Tahanan)'}</td><td class="c">${esc(keg.status_klien)}</td>
      <td class="c">${tgl(keg.tgl_sp || keg.tgl_pel)}</td><td class="c">${tgl(keg.tgl_pel)}</td><td class="r">${rp(s.uang)}</td><td class="c">${esc(keg.ket || s.ket || '')}</td></tr>`;
    // 12 baris di halaman pertama, 14 di halaman lanjutan; halaman terakhir harus muat JUMLAH + tanda tangan
    const FIRST = 12, NEXT = 14, LAST1 = 7, LASTN = 10, chunks = [];
    for (let i = 0; i < items.length;) { const cap = chunks.length ? NEXT : FIRST; chunks.push(items.slice(i, i + cap)); i += cap; }
    if (!chunks.length) chunks.push([]);
    if (chunks[chunks.length - 1].length > (chunks.length === 1 ? LAST1 : LASTN)) chunks.push([]);
    let no = 0;
    const jumlah = `<tr><td colspan="5" class="c b">JUMLAH</td><td class="r b">${rp(s.uang * items.length)}</td><td></td></tr>`;
    const sign = `<p style="margin-top:12px">Demikian untuk diperiksa.</p>
      <table class="sg" style="margin-top:12px;page-break-inside:avoid">
        <tr><td style="width:50%"></td><td>Sintang, ${tgl(tglBon)}</td></tr>
        <tr><td>Mengetahui/Menyetujui<br>Pejabat Pembuat Komitmen,</td><td>Yang Mengajukan Biaya<br>${esc(s.pk_label || 'Pembimbing Kemasyarakatan')}</td></tr>
        <tr><td style="height:21mm"></td><td></td></tr>
        <tr><td class="b">${esc(s.ppk_nama)}</td><td class="b">${esc(s.pk_nama_gelar)}</td></tr>
        <tr><td>NIP. ${esc(s.ppk_nip)}</td><td>NIP. ${esc(s.pk_nip)}</td></tr></table>`;    const pages = chunks.map((c, pi) => {
      const last = pi === chunks.length - 1, first = pi === 0;
      const rows = c.map(it => row(it, no++)).join('');
      const intro = first ? `<div class="r">Dewasa</div>
      <p class="b" style="margin:10px 0 12px;text-align:left">Yth. Pejabat Pembuat Komitmen<br>&emsp;&emsp;Bapas Kelas II Sintang<br>di - <br>&emsp;&emsp;Sintang</p>
      <p>Dengan ini mengajukan biaya Pelaksanaan Kegiatan Pendampingan Tahanan Dewasa untuk program pendampingan pelaksanaan putusan dan pemenuhan hak tersangka untuk klien Dewasa atas nama :</p>` : `<p class="r" style="margin-bottom:6px">Lanjutan BON (halaman ${pi + 1} dari ${chunks.length})</p>`;
      return page(`${kop}${intro}<table class="gt">${cols}${head}${rows}${last ? jumlah : ''}</table>${last ? sign : ''}`);
    }).join('');
    return wrap(pages);
  }

  // ---------------------------------------------------------------- LAPORAN (1 kegiatan, foto lampiran)
  function laporan({ keg, k, photos }, s) {
    const put = keg.jenis === 'PUTUSAN';
    const judul = put ? 'PELAKSANAAN PUTUSAN KLIEN DEWASA' : 'PEMENUHAN HAK KLIEN DEWASA';
    const lines = keg.hasil && keg.hasil.trim() ? keg.hasil.split('\n').map(l => l.trim()).filter(Boolean) : Doc.defaultHasil(keg);
    const tglL = tgl(keg.tgl_pel), staf = keg.staf || (put ? s.staf_putusan : s.staf_hak);
    const lahir = `${k.tempat_lahir}, ${tgl(k.tgl_lahir)}/ ${umur(k.tgl_lahir, keg.tgl_pel)} Tahun`;
    const idr = [['Nama', k.nama], ['Jenis Kelamin', k.jk], ['Tempat dan Tanggal lahir', lahir], ['Agama', k.agama], ['Suku/Bangsa/Kewarganegaraan', k.suku],
      ['Pendidikan Terakhir', k.pendidikan], ['Pekerjaan', k.pekerjaan], ['Status Perkawinan', k.kawin], ['Perkara', k.perkara],
      put ? ['Nomor Putusan/ Tanggal Putusan', keg.putusan] : ['Status Klien', keg.status_klien], ['Alamat/ Tempat Tinggal', k.alamat]];
    const kv = rows => `<table class="kv w">${rows.map(([a, b]) => `<tr><td>${a}</td><td>:</td><td>${esc(b)}</td></tr>`).join('')}</table>`;
    const foto = (photos || []).map(p => `<tr class="foto"><td style="width:62%"><img src="${p.url}" alt=""></td><td>${esc(p.caption)}</td></tr>`).join('');
    const lamp = page(`<div class="r b">LAMPIRAN</div><h1>DOKUMENTASI</h1><h1 style="margin-bottom:10px">PENDAMPINGAN ${judul}</h1>
      <table class="gt" style="font-size:10.5pt"><tr><th>Foto</th><th>Keterangan</th></tr>${foto || '<tr><td colspan="2" class="c">(belum ada foto)</td></tr>'}</table>`);
    return wrap(page(`${kop}
      <h1>LAPORAN HASIL PENDAMPINGAN ${judul}</h1>
      <div style="margin:10px 0">${kv([['Status', put ? 'Pendampingan Pelaksanaan Putusan Klien Dewasa' : 'Pendampingan Pemenuhan Hak Klien Dewasa'], ['Waktu Pelaksanaan', tglL], ['Nama PK', s.pk_nama_gelar]])}</div>
      <p class="b" style="margin:0 0 2px">I. IDENTITAS</p>
      <table class="id">${idr.map(([a, b], i) => `<tr><td>${i + 1}.</td><td>${a}</td><td>:</td><td>${esc(b)}</td></tr>`).join('')}</table>
      <p class="b" style="margin:10px 0 2px">II. WAKTU DAN TEMPAT</p>
      <p style="margin:0 0 2px">&emsp;Telah dilakukan pelaksanaan Kegiatan ${put ? 'Pelaksanaan Putusan' : 'Pemenuhan Hak'} Klien Dewasa :</p>
      <div style="padding-left:8mm">${kv([['Hari', Doc.hari(keg.tgl_pel)], ['Tanggal', tglL], ['Tempat', keg.tempat || s.tempat]])}</div>
      <p class="b" style="margin:10px 0 2px">III. PIHAK YANG HADIR</p>
      ${kv([[s.pk_label || 'Pembimbing Kemasyarakatan', s.pk_nama], [put ? 'Staf Subsi Registrasi' : 'Staf Subsi Perawatan Tahanan', staf], ['Klien', k.nama]])}
      <p class="b" style="margin:10px 0 2px">IV. HASIL PENDAMPINGAN ${judul}</p>
      <ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <div class="ttd">Sintang, ${tglL}<br>${esc(s.pk_label || 'Pembimbing Kemasyarakatan')}<div class="sp"></div>${esc(s.pk_nama_gelar)}</div>`) + lamp);
  }
  const umur = (a, b) => { const x = Doc.parse(a), y = Doc.parse(b); let u = y.getFullYear() - x.getFullYear(); if (y.getMonth() < x.getMonth() || (y.getMonth() === x.getMonth() && y.getDate() < x.getDate())) u--; return u; };

  // ---------------------------------------------------------------- PDF
  const imgsReady = root => Promise.all([...root.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  async function toPdf(html, filename) {
    if (!window.html2pdf) throw new Error('Pustaka PDF belum termuat, muat ulang halaman.');
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-99999px;top:0;background:#fff';
    host.innerHTML = html; document.body.append(host);
    try {
      await imgsReady(host);
      await html2pdf().set({
        margin: 0, filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
        jsPDF: { unit: 'mm', format: [215.9, 330.2], orientation: 'portrait' },
        pagebreak: { mode: ['css'], avoid: ['tr'] },
      }).from(host.firstElementChild).save();
    } finally { host.remove(); }
  }

  // surat bebas dari editor template: isi HTML (sudah terisi data) + kop opsional
  function surat(body, withKop = true) { return wrap(page((withKop ? kop : '') + body)); }
  return { sp, bon, laporan, toPdf, surat };
})();
