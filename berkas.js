/* Berkas pengajuan: Sprint, Laporan bertanda tangan QR, Lampiran -> disimpan di browser (IndexedDB), digabung jadi satu PDF.
   Semua jalan di browser; berkas tidak pernah diunggah ke server. Butuh pdf-lib, pdf.js, qrcode-generator. */
const Berkas = (() => {
  const DB = 'bon_berkas', ST = 'f';
  const db = () => new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  const tx = async (mode, fn) => { const d = await db(); return new Promise((ok, no) => { const t = d.transaction(ST, mode), q = fn(t.objectStore(ST)); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); }); };
  const key = (id, slot) => id + ':' + slot;
  const put = (id, slot, file) => tx('readwrite', s => s.put({ name: file.name || slot, type: file.type, blob: file }, key(id, slot)));
  const get = (id, slot) => tx('readonly', s => s.get(key(id, slot)));
  const del = (id, slot) => tx('readwrite', s => s.delete(key(id, slot)));
  async function has(id) { const o = {}; for (const s of ['sprint', 'laporan', 'lampiran']) o[s] = !!(await get(id, s)); return o; }

  const F4 = [612.28, 936.0];                              // 215,9 x 330,2 mm dalam poin
  async function bytesOf(f) { return new Uint8Array(await (f.blob || f).arrayBuffer()); }

  // PDF apa adanya; gambar dijadikan satu halaman
  async function asPdf(rec) {
    const isPdf = rec.type === 'application/pdf' || /\.pdf$/i.test(rec.name || '');
    if (isPdf) return PDFLib.PDFDocument.load(await bytesOf(rec), { ignoreEncryption: true });
    const doc = await PDFLib.PDFDocument.create();
    const bytes = await bytesOf(rec);
    const img = /png/i.test(rec.type) ? await doc.embedPng(bytes) : await doc.embedJpg(await toJpeg(rec.blob || rec));
    const sc = Math.min((F4[0] - 60) / img.width, (F4[1] - 60) / img.height, 1);
    const pg = doc.addPage(F4); pg.drawImage(img, { x: (F4[0] - img.width * sc) / 2, y: F4[1] - 30 - img.height * sc, width: img.width * sc, height: img.height * sc });
    return doc;
  }
  async function toJpeg(blob) {
    const bmp = await createImageBitmap(blob), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0);
    return new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
  }
  async function merge(recs) {
    const out = await PDFLib.PDFDocument.create();
    for (const r of recs) { const d = await asPdf(r); (await out.copyPages(d, d.getPageIndices())).forEach(p => out.addPage(p)); }
    return out.save();
  }

  // cap tanda tangan QR: kotak putih berisi QR + teks, dibuat sebagai PNG
  function stampPng(lines, qrText) {
    const qr = qrcode(0, 'M'); qr.addData(qrText); qr.make();
    const n = qr.getModuleCount(), cell = 6, qs = n * cell, pad = 14, W = 560, H = qs + pad * 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.strokeStyle = '#111'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
    g.fillStyle = '#000';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) g.fillRect(pad + x * cell, pad + y * cell, cell, cell);
    g.font = '24px "Times New Roman",serif'; g.textBaseline = 'top'; let ty = pad + 4;
    lines.forEach((l, i) => { g.font = (i === 1 ? 'bold ' : '') + '24px "Times New Roman",serif'; wrap(g, l, W - qs - pad * 3).forEach(w => { g.fillText(w, pad * 2 + qs, ty); ty += 30; }); });
    return { url: c.toDataURL('image/png'), ratio: H / W };
  }
  function wrap(g, text, max) {
    const out = []; let cur = '';
    for (const w of String(text).split(' ')) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  // tempel cap pada halaman `page` (0-based); x,y,w dalam pecahan 0..1 dari lebar/tinggi halaman (y dari atas)
  async function stamp(rec, st, lines, qrText) {
    const doc = await asPdf(rec), p = doc.getPage(st.page), { width, height } = p.getSize();
    const { url, ratio } = stampPng(lines, qrText);
    const img = await doc.embedPng(await (await fetch(url)).arrayBuffer());
    const w = st.w * width, h = w * ratio;
    p.drawImage(img, { x: st.x * width, y: height - st.y * height - h, width: w, height: h });
    return doc.save();
  }

  // pratinjau halaman PDF di <canvas> lewat pdf.js
  let pdfjsReady = false;
  async function render(rec, pageNo, canvas, maxW) {
    if (!pdfjsReady) { pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js'; pdfjsReady = true; }
    const bytes = await bytesOf(rec);
    const doc = await pdfjsLib.getDocument({ data: bytes }).promise, pg = await doc.getPage(Math.min(pageNo + 1, doc.numPages));
    const v0 = pg.getViewport({ scale: 1 }), sc = maxW / v0.width, v = pg.getViewport({ scale: sc });
    canvas.width = v.width; canvas.height = v.height;
    await pg.render({ canvasContext: canvas.getContext('2d'), viewport: v }).promise;
    return { pages: doc.numPages, ratio: stampRatio };
  }
  let stampRatio = 0.25;
  const setRatio = (lines, qr) => { stampRatio = stampPng(lines, qr).ratio; return stampRatio; };

  return { put, get, del, has, merge, stamp, render, setRatio, stampPng, asPdf };
})();
