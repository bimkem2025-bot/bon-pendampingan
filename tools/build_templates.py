"""Bangun templates/*.docx dari dokumen asli (data klien dibuang, diganti {tag}).

Pakai:  python tools/build_templates.py <folder-dokumen-asli>
Dokumen asli TIDAK boleh masuk repo (berisi data pribadi). Template hasilnya aman.
"""
import copy, os, re, sys, zipfile
from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
q = lambda t: '{%s}%s' % (W, t)

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'templates')
os.makedirs(OUT, exist_ok=True)


def find(prefix):
    for f in os.listdir(SRC):
        if f.lower().endswith('.docx') and f.lower().startswith(prefix.lower()):
            return os.path.join(SRC, f)
    sys.exit('Tidak ketemu dokumen yang diawali: ' + prefix)


def ptext(p):
    out = []
    for e in p.iter(q('t'), q('tab')):
        out.append('\t' if e.tag == q('tab') else (e.text or ''))
    return ''.join(out)


def retag(p, text):
    """Ganti seluruh isi paragraf dengan `text` (\\t = tab), pakai format run pertama."""
    first = None
    for r in p.iter(q('r')):
        if r.find(q('t')) is not None or r.find(q('tab')) is not None:
            first = r
            break
    rpr = first.find(q('rPr')) if first is not None else None
    for ch in list(p):
        if ch.tag != q('pPr'):
            p.remove(ch)
    for i, part in enumerate(text.split('\t')):
        if i:
            r = etree.SubElement(p, q('r'))
            if rpr is not None:
                r.append(copy.deepcopy(rpr))
            etree.SubElement(r, q('tab'))
        if part:
            r = etree.SubElement(p, q('r'))
            if rpr is not None:
                r.append(copy.deepcopy(rpr))
            t = etree.SubElement(r, q('t'))
            t.text = part
            t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')


def set_value(p, tag):
    """'Label\\t: nilai' -> 'Label\\t: {tag}'"""
    t = ptext(p)
    i = t.find(':')
    retag(p, (t[:i + 1] + ' ' if i >= 0 else '') + tag)


def paras(root):
    return list(root.iter(q('p')))


def load(path):
    z = zipfile.ZipFile(path)
    files = {n: z.read(n) for n in z.namelist()}
    return files


def save(files, name):
    core = 'docProps/core.xml'
    if core in files:  # buang nama penulis dari metadata
        s = files[core].decode('utf8')
        s = re.sub(r'(<dc:creator>)[^<]*(</dc:creator>)', r'\1\2', s)
        s = re.sub(r'(<cp:lastModifiedBy>)[^<]*(</cp:lastModifiedBy>)', r'\1\2', s)
        files[core] = s.encode('utf8')
    with zipfile.ZipFile(os.path.join(OUT, name), 'w', zipfile.ZIP_DEFLATED) as z:
        # [Content_Types].xml harus pertama
        order = sorted(files, key=lambda n: (n != '[Content_Types].xml', n))
        for n in order:
            z.writestr(n, files[n])


def strip_body_media(files):
    """Buang relasi gambar milik isi dokumen + file media yang tidak dipakai lagi."""
    rel = 'word/_rels/document.xml.rels'
    s = files[rel].decode('utf8')
    s = re.sub(r'<Relationship [^>]*relationships/image"[^>]*/>', '', s)
    files[rel] = s.encode('utf8')
    used = set()
    for n, b in files.items():
        if n.endswith('.rels'):
            for m in re.finditer(rb'Target="(media/[^"]+)"', b):
                used.add('word/' + m.group(1).decode())
    for n in list(files):
        if n.startswith('word/media/') and n not in used:
            del files[n]


def body_of(files):
    root = etree.fromstring(files['word/document.xml'])
    return root, root.find('w:body', NS)


def put(files, root):
    files['word/document.xml'] = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)


# ---------------------------------------------------------------- SP
def build_sp():
    files = load(find('1. SP'))
    root, body = body_of(files)
    P = paras(root)
    retag(P[43], '{dasar_putusan}')
    retag(P[51], '{sp_pk_nama}')
    retag(P[56], '{sp_pk_nip}')
    retag(P[61], '{sp_pk_pangkat}')
    retag(P[66], '{sp_pk_jabatan}')
    retag(P[79], '{nama}')
    retag(P[86], '{ttl_sp}')
    retag(P[93], '{alamat}')
    retag(P[100], '{perkara}')
    retag(P[112], 'Sintang, {tgl_sp}')
    retag(P[117], '{kepala_nama}')
    # baris dasar ke-5 boleh dibuang bila kosong -> bungkus dengan komentar penanda
    row = P[43].xpath('ancestor::w:tr', namespaces=NS)
    if row:
        row = row[0]
        row.addprevious(etree.Comment('D5'))
        row.addnext(etree.Comment('/D5'))
    put(files, root)
    strip_body_media(files)
    save(files, 'sp.docx')


# ---------------------------------------------------------------- BON
def build_bon():
    files = load(find('Bon'))
    root, body = body_of(files)
    tbls = body.findall('w:tbl', NS)
    main = tbls[0]
    rows = main.findall('w:tr', NS)
    # baris data pertama = rows[1]; baris terakhir = JUMLAH
    data = rows[1]
    cells = data.findall('w:tc', NS)
    tags = ['{no}', '{nama}', '{jenis}', '{status}', '{tgl_sp}', '{tgl_pel}', '{uang}', '{ket}']
    # sel nama memuat 2 paragraf (nama + jenis); sel lain 1
    flat = []
    for tc in cells:
        flat.extend(tc.findall('w:p', NS))
    # urutan paragraf di baris: no, nama, jenis, status, tgl sp, tgl pel, uang, ket
    vals = [t for t in tags]
    for p, v in zip(flat, vals):
        retag(p, v)
    for r in rows[2:-1]:
        main.remove(r)
    data.addprevious(etree.Comment('ROW'))
    data.addnext(etree.Comment('/ROW'))
    # JUMLAH
    for p in paras(rows[-1]):
        if ptext(p).strip().startswith('Rp'):
            retag(p, '{total}')
    # tanda tangan
    for p in paras(root):
        t = ptext(p).strip()
        if t.startswith('Dayat'):
            retag(p, '{ppk_nama}')
        elif t.startswith('NIP. 198803'):
            retag(p, 'NIP. {ppk_nip}')
        elif t.startswith('Tuffahati'):
            retag(p, '{pk_nama_gelar}')
        elif t.startswith('NIP. 199805'):
            retag(p, 'NIP. {pk_nip}')
        elif t.startswith('Sintang,'):
            retag(p, 'Sintang, {tgl_bon}')
    put(files, root)
    strip_body_media(files)
    save(files, 'bon.docx')


# ---------------------------------------------------------------- LAPORAN
LABELS = {
    'Nama': '{nama}', 'Jenis Kelamin': '{jk}', 'Tempat dan Tanggal lahir': '{ttl_lap}',
    'Agama': '{agama}', 'Suku/Bangsa/Kewarganegaraan': '{suku}', 'Pendidikan Terakhir': '{pendidikan}',
    'Pekerjaan': '{pekerjaan}', 'Status Perkawinan': '{kawin}', 'Perkara': '{perkara}',
    'Status Klien': '{status_klien}', 'Alamat/ Tempat Tinggal': '{alamat}',
    'Nomor Putusan/ Tanggal Putusan': '{putusan}',
}
FREE = {
    'Waktu Pelaksanaan': '{tgl_pelaksanaan}', 'Nama PK': '{pk_nama_gelar}', 'Hari': '{hari}',
    'Tanggal': '{tgl_pelaksanaan}', 'Tempat': '{tempat}', 'Pembimbing Kemasyarakatan': '{pk_nama}',
    'Klien': '{nama}',
}


def tag_section(els):
    """Beri tag pada satu bagian laporan (daftar elemen body)."""
    hasil_state = 0
    for el in els:
        tag = etree.QName(el).localname
        if tag == 'tbl':
            for tr in el.findall('w:tr', NS):
                tcs = tr.findall('w:tc', NS)
                if len(tcs) == 4:
                    lab = ptext(tcs[1]).strip()
                    if lab in LABELS:
                        retag(tcs[3].find('w:p', NS), LABELS[lab])
                for p in paras(tr):
                    t = ptext(p).strip()
                    if t.startswith('Sintang,'):
                        retag(p, 'Sintang, {tgl_laporan}')
                    elif t.startswith('Tuffahati'):
                        retag(p, '{pk_nama_gelar}')
            continue
        t = ptext(el).strip()
        if t.startswith('IV.'):
            hasil_state = 1
            continue
        if hasil_state == 1:
            if t:
                if hasil_state == 1 and not getattr(tag_section, '_seen', False):
                    pass
            continue
        lab = t.split('\t')[0].split(':')[0].strip()
        if lab in FREE:
            set_value(el, FREE[lab])
        elif lab.startswith('Staf Subsi'):
            set_value(el, '{staf}')


def build_laporan():
    files = load(find('LAPORAN'))
    root, body = body_of(files)
    kids = list(body)
    titles = [i for i, e in enumerate(kids)
              if etree.QName(e).localname == 'p' and ptext(e).strip().startswith('LAPORAN HASIL')]
    # bagian Hak = judul pertama .. sebelum page-break; bagian Putusan = judul terakhir .. sebelum sectPr
    sect = kids[-1]
    hak_start = titles[0]
    hak_end = next(i for i in range(hak_start, len(kids))
                   if kids[i].xpath('.//w:br[@w:type="page"]', namespaces=NS))
    put_start = titles[-1]
    hak = kids[hak_start:hak_end]
    putu = kids[put_start:len(kids) - 1]

    # foto row (contoh) dari tabel lampiran bagian yang memuat gambar
    foto_row = None
    for e in kids:
        if etree.QName(e).localname == 'tbl' and e.xpath('.//w:drawing', namespaces=NS):
            foto_row = copy.deepcopy(e.findall('w:tr', NS)[1])
            break
    assert foto_row is not None
    dr = foto_row.xpath('.//w:drawing', namespaces=NS)[0]
    run = dr.getparent()
    para = run.getparent()
    para.remove(run)
    r2 = etree.SubElement(para, q('r'))
    t2 = etree.SubElement(r2, q('t'))
    t2.text = '@@IMG@@'
    cap = foto_row.findall('w:tc', NS)[1].find('w:p', NS)
    retag(cap, '{caption}')
    xml = etree.tostring(foto_row, encoding='unicode')
    with open(os.path.join(OUT, 'laporan_fotorow.xml'), 'w', encoding='utf8') as f:
        f.write(xml)

    # buang baris data tabel foto di kedua bagian (header tetap)
    for sec in (hak, putu):
        for e in sec:
            if etree.QName(e).localname == 'tbl' and ptext(e).strip().startswith('Foto'):
                for tr in e.findall('w:tr', NS)[1:]:
                    e.remove(tr)

    # bullet hasil: pertahankan 1 paragraf bertanda {hasil}
    for sec in (hak, putu):
        i = next(k for k, e in enumerate(sec)
                 if etree.QName(e).localname == 'p' and ptext(e).strip().startswith('IV.'))
        j = i + 1
        first = None
        while j < len(sec) and etree.QName(sec[j]).localname == 'p' and ptext(sec[j]).strip():
            if first is None:
                first = sec[j]
                retag(first, '{hasil}')
            else:
                body.remove(sec[j])
            j += 1
        sec[:] = [e for e in sec if e.getparent() is body or e in (first,)]

    tag_section(hak)
    tag_section(putu)

    # LAMPIRAN selalu mulai di halaman baru (di dokumen asli bergantung pada paragraf kosong)
    for sec in (hak, putu):
        for e in sec:
            if etree.QName(e).localname == 'p' and ptext(e).strip() == 'LAMPIRAN':
                ppr = e.find('w:pPr', NS)
                if ppr is None:
                    ppr = etree.Element(q('pPr'))
                    e.insert(0, ppr)
                if ppr.find('w:pageBreakBefore', NS) is None:
                    pos = 0
                    for i, c in enumerate(ppr):
                        if c.tag in (q('pStyle'), q('keepNext'), q('keepLines')):
                            pos = i + 1
                    ppr.insert(pos, etree.Element(q('pageBreakBefore')))

    # susun ulang body: HAK + penanda + PUTUSAN + sectPr
    for e in list(body):
        body.remove(e)
    for e in hak:
        body.append(e)
    mark = etree.SubElement(body, q('p'))
    r = etree.SubElement(mark, q('r'))
    etree.SubElement(r, q('t')).text = '@@PUTUSAN@@'
    for e in putu:
        body.append(e)
    body.append(sect)
    put(files, root)
    strip_body_media(files)
    save(files, 'laporan.docx')


if __name__ == '__main__':
    build_sp()
    build_bon()
    build_laporan()
    print('OK ->', os.path.abspath(OUT))
