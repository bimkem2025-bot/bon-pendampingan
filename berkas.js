/* Berkas paket BON: disimpan di browser (IndexedDB), digabung jadi satu PDF. Berkas tidak pernah dikirim ke server.
   Butuh pdf-lib dan qrcode-generator. */
const Berkas = (() => {
  const DB = 'bon_berkas', ST = 'f';
  const db = () => new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  const tx = async (mode, fn) => { const d = await db(); return new Promise((ok, no) => { const t = d.transaction(ST, mode), q = fn(t.objectStore(ST)); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); }); };
  const key = (id, slot) => id + ':' + slot;
  // satu berkas: {name,type,blob}; daftar berkas/objek lain disimpan apa adanya lewat putRaw
  const putRaw = (id, slot, val) => tx('readwrite', s => s.put(val, key(id, slot)));
  const getRaw = (id, slot) => tx('readonly', s => s.get(key(id, slot)));
  const put = (id, slot, file) => putRaw(id, slot, { name: file.name || slot, type: file.type, blob: file });
  const get = getRaw;
  const del = (id, slot) => tx('readwrite', s => s.delete(key(id, slot)));
  // daftar berkas (Lampiran boleh lebih dari satu)
  const list = async (id, slot) => (await getRaw(id, slot)) || [];
  const add = async (id, slot, file) => { const l = await list(id, slot); l.push({ name: file.name || slot, type: file.type, blob: file }); await putRaw(id, slot, l); return l; };
  const removeAt = async (id, slot, i) => { const l = await list(id, slot); l.splice(i, 1); await putRaw(id, slot, l); return l; };

  const F4 = [612.28, 936.0];                              // 215,9 x 330,2 mm dalam poin
  const bytesOf = async f => new Uint8Array(await (f.blob || f).arrayBuffer());
  async function toJpeg(blob) {
    const bmp = await createImageBitmap(blob), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0);
    return new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
  }
  // PDF apa adanya; gambar dijadikan satu halaman F4
  async function asPdf(rec) {
    const isPdf = rec.type === 'application/pdf' || /\.pdf$/i.test(rec.name || '');
    if (isPdf) return PDFLib.PDFDocument.load(await bytesOf(rec), { ignoreEncryption: true });
    const doc = await PDFLib.PDFDocument.create();
    const img = /png/i.test(rec.type) ? await doc.embedPng(await bytesOf(rec)) : await doc.embedJpg(await toJpeg(rec.blob || rec));
    const sc = Math.min((F4[0] - 60) / img.width, (F4[1] - 60) / img.height, 1);
    doc.addPage(F4).drawImage(img, { x: (F4[0] - img.width * sc) / 2, y: F4[1] - 30 - img.height * sc, width: img.width * sc, height: img.height * sc });
    return doc;
  }
  async function merge(recs) {
    const out = await PDFLib.PDFDocument.create();
    for (const r of recs) { const d = await asPdf(r); (await out.copyPages(d, d.getPageIndices())).forEach(p => out.addPage(p)); }
    return out.save();
  }
  // QR untuk tautan tanda tangan ponsel
  function qrCanvas(text, size = 220) {
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    const n = qr.getModuleCount(), cell = Math.max(2, Math.floor(size / (n + 8))), q = cell * (n + 8);
    const c = document.createElement('canvas'); c.width = c.height = q; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, q, q); g.fillStyle = '#000';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) g.fillRect((x + 4) * cell, (y + 4) * cell, cell, cell);
    return c;
  }
  const dataUrl = blob => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
  return { put, get, del, putRaw, getRaw, list, add, removeAt, merge, asPdf, qrCanvas, dataUrl };
})();
