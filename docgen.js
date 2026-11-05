/* Pembuat dokumen: SP, BON, Laporan. Semua jalan di browser; foto tidak pernah diunggah. */
const Doc = (() => {
  const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

  const pad = n => String(n).padStart(2, '0');
  const parse = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const tgl = iso => { if (!iso) return ''; const d = parse(iso); return `${pad(d.getDate())} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
  const hari = iso => iso ? HARI[parse(iso).getDay()] : '';
  const umur = (lahir, pada) => {
    const a = parse(lahir), b = parse(pada);
    let u = b.getFullYear() - a.getFullYear();
    if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) u--;
    return u;
  };
  const rupiah = n => 'Rp. ' + Number(n).toLocaleString('id-ID');
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const cache = {};
  async function tpl(name) {
    if (!cache[name]) {
      const r = await fetch('templates/' + name + '?v=' + Date.now());
      if (!r.ok) throw new Error('Template tidak ditemukan: ' + name);
      cache[name] = await r.arrayBuffer();
    }
    return cache[name];
  }
  async function open(name) { return JSZip.loadAsync(await tpl(name)); }

  // ganti {tag} yang dikenal saja (supaya ${nomor_naskah} milik e-office tidak tersentuh)
  const fill = (xml, map) => xml.replace(/\{(\w+)\}/g, (m, k) => (k in map ? esc(map[k]) : m));
  const stripComments = xml => xml.replace(/<!--\/?[A-Za-z0-9]*-->/g, '');
  const out = zip => zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

  const ttlSp = (k) => `${k.tempat_lahir}, ${tgl(k.tgl_lahir)}`;
  const ttlLap = (k, pel) => `${k.tempat_lahir}, ${tgl(k.tgl_lahir)}/ ${umur(k.tgl_lahir, pel)} Tahun`;
  const jenisKet = j => j === 'PUTUSAN' ? '(Pendampingan Pelaksanaan Putusan)' : '(Pendampingan Pemenuhan Hak Tahanan)';

  // ------------------------------------------------------------------ SP
  async function sp(keg, k, s) {
    const zip = await open('sp.docx');
    let x = await zip.file('word/document.xml').async('string');
    x = keg.dasar && keg.dasar.trim() ? x.replace(/<!--\/?D5-->/g, '') : x.replace(/<!--D5-->[\s\S]*?<!--\/D5-->/, '');
    x = fill(stripComments(x), {
      dasar_putusan: (keg.dasar || '').trim(),
      sp_pk_nama: s.sp_pk_nama, sp_pk_nip: s.sp_pk_nip, sp_pk_pangkat: s.sp_pk_pangkat, sp_pk_jabatan: s.sp_pk_jabatan,
      nama: k.nama, ttl_sp: ttlSp(k), alamat: k.alamat, perkara: k.perkara,
      tgl_sp: tgl(keg.tgl_sp || keg.tgl_pel), kepala_nama: s.kepala_nama,
    });
    zip.file('word/document.xml', x);
    return out(zip);
  }

  // ------------------------------------------------------------------ BON
  async function bon(items, s, tglBon) {
    // items: [{keg, k}] sudah terurut
    const zip = await open('bon.docx');
    let x = await zip.file('word/document.xml').async('string');
    const m = x.match(/<!--ROW-->([\s\S]*?)<!--\/ROW-->/);
    const rows = items.map(({ keg, k }, i) => fill(m[1], {
      no: i + 1, nama: k.nama, jenis: jenisKet(keg.jenis), status: keg.status_klien,
      tgl_sp: tgl(keg.tgl_sp || keg.tgl_pel), tgl_pel: tgl(keg.tgl_pel),
      uang: rupiah(s.uang), ket: keg.ket || s.ket,
    })).join('');
    x = x.replace(m[0], rows);
    x = fill(stripComments(x), {
      total: rupiah(s.uang * items.length), ppk_nama: s.ppk_nama, ppk_nip: s.ppk_nip,
      tgl_bon: tgl(tglBon), pk_nama_gelar: s.pk_nama_gelar, pk_nip: s.pk_nip,
    });
    zip.file('word/document.xml', x);
    return out(zip);
  }

  // ------------------------------------------------------------------ LAPORAN
  const PB = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  function paraAround(xml, idx) {
    const re = /<w:p[ >]/g; let st = -1, mm;
    while ((mm = re.exec(xml)) && mm.index < idx) st = mm.index;
    return [st, xml.indexOf('</w:p>', idx) + 6];
  }

  async function toJpeg(file) {
    const bmp = await createImageBitmap(file);
    const max = 1600, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * sc), h = Math.round(bmp.height * sc);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    return { buf: await blob.arrayBuffer(), w, h };
  }

  function drawing(rid, n, w, h) {
    const maxW = 4216180, maxH = 4000000;
    let cx = maxW, cy = Math.round(maxW * h / w);
    if (cy > maxH) { cy = maxH; cx = Math.round(maxH * w / h); }
    return `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${9000 + n}" name="Foto ${n}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${9000 + n}" name="foto${n}.jpeg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }

  function defaultHasil(keg) {
    if (keg.jenis === 'PUTUSAN') return [
      'Klien Dewasa dalam kondisi sehat jasmani dan Rohani',
      `Klien dipidana penjara selama ${keg.pidana || '...'}`,
      'Putusan klien telah dieksekusi oleh Pihak Kejaksaan',
      'Tidak ada hak-hak klien yang dilanggar selama proses pelaksanaan putusan berjalan.',
    ];
    const l = [
      'Klien Dewasa dalam kondisi sehat jasmani dan Rohani',
      'Klien telah dicek kondisi kesehatannya.',
      'Klien tidak memiliki alergi',
      'Kebutuhan pakaian dan makanan klien tercukupi dengan baik.',
    ];
    if (keg.sudah_putusan) l.push('Saat ini klien telah mendapatkan putusan namun putusan tersebut belum dieksekusi pihak kejaksaan');
    l.push('Tidak ada hak-hak klien yang dilanggar selama proses pelaksanaan peradilan.');
    return l;
  }

  // items: [{keg, k, photos:[{file, caption}]}]
  async function laporan(items, s) {
    const zip = await open('laporan.docx');
    let x = await zip.file('word/document.xml').async('string');
    const fotoRow = await (await fetch('templates/laporan_fotorow.xml?v=' + Date.now())).text();
    const b0 = x.indexOf('<w:body>') + 8, b1 = x.lastIndexOf('<w:sectPr');
    const head = x.slice(0, b0), tail = x.slice(b1), mid = x.slice(b0, b1);
    const [ms, me] = paraAround(mid, mid.indexOf('@@PUTUSAN@@'));
    const secs = { HAK: mid.slice(0, ms), PUTUSAN: mid.slice(me) };

    let rels = await zip.file('word/_rels/document.xml.rels').async('string');
    let ct = await zip.file('[Content_Types].xml').async('string');
    if (!/Extension="jpeg"/i.test(ct)) ct = ct.replace('<Override', '<Default Extension="jpeg" ContentType="image/jpeg"/><Override');
    let n = 0;

    const parts = [];
    for (const { keg, k, photos } of items) {
      let sec = secs[keg.jenis === 'PUTUSAN' ? 'PUTUSAN' : 'HAK'];
      // bullet hasil
      const lines = (keg.hasil && keg.hasil.trim() ? keg.hasil.split('\n').map(l => l.trim()).filter(Boolean) : defaultHasil(keg));
      const hi = sec.indexOf('{hasil}');
      const [hs, he] = paraAround(sec, hi);
      const hp = sec.slice(hs, he);
      sec = sec.slice(0, hs) + lines.map(l => hp.replace('{hasil}', esc(l))).join('') + sec.slice(he);
      // foto
      let rowsXml = '';
      for (const ph of photos || []) {
        n++;
        const { buf, w, h } = await toJpeg(ph.file);
        zip.file(`word/media/foto${n}.jpeg`, buf, { createFolders: false });
        rels = rels.replace('</Relationships>', `<Relationship Id="rIdF${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/foto${n}.jpeg"/></Relationships>`);
        rowsXml += fill(fotoRow, { caption: ph.caption || '' })
          .replace(/<w:r>\s*<w:t>@@IMG@@<\/w:t>\s*<\/w:r>/, drawing('rIdF' + n, n, w, h));
      }
      const ti = sec.lastIndexOf('</w:tbl>');
      if (rowsXml && ti >= 0) sec = sec.slice(0, ti) + rowsXml + sec.slice(ti);
      sec = fill(sec, {
        tgl_pelaksanaan: tgl(keg.tgl_pel), tgl_laporan: tgl(keg.tgl_pel), pk_nama_gelar: s.pk_nama_gelar, pk_nama: s.pk_nama,
        nama: k.nama, jk: k.jk, ttl_lap: ttlLap(k, keg.tgl_pel), agama: k.agama, suku: k.suku,
        pendidikan: k.pendidikan, pekerjaan: k.pekerjaan, kawin: k.kawin, perkara: k.perkara,
        status_klien: keg.status_klien, alamat: k.alamat, putusan: keg.putusan || '',
        hari: hari(keg.tgl_pel), tempat: keg.tempat || s.tempat,
        staf: keg.staf || (keg.jenis === 'PUTUSAN' ? s.staf_putusan : s.staf_hak),
      });
      parts.push(sec);
    }
    zip.file('word/document.xml', head + parts.join(PB) + tail);
    zip.file('word/_rels/document.xml.rels', rels);
    zip.file('[Content_Types].xml', ct);
    return out(zip);
  }

  return { tgl, hari, parse, pad, BULAN, HARI, sp, bon, laporan, defaultHasil, rupiah };
})();


