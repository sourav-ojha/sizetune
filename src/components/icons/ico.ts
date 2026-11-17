export interface IcoImage { size: number; data: Uint8Array }
export interface IcoEntry { width: number; height: number; bytes: number; offset: number }

/** Builds a .ico whose images are PNG files (supported by every current browser). `size` is the square side, 1 to 256. */
export function buildIco(images: IcoImage[]): Uint8Array {
  if (!images.length) throw new Error('ICO needs at least one image');
  for (const i of images) if (!Number.isInteger(i.size) || i.size < 1 || i.size > 256) throw new Error('ICO images are at most 256 px');
  const head = 6 + 16 * images.length;
  const out = new Uint8Array(head + images.reduce((n, i) => n + i.data.length, 0));
  const v = new DataView(out.buffer);
  v.setUint16(0, 0, true);
  v.setUint16(2, 1, true); // type 1 = icon
  v.setUint16(4, images.length, true);
  let offset = head;
  images.forEach((img, k) => {
    const e = 6 + 16 * k;
    out[e] = img.size === 256 ? 0 : img.size; // 0 means 256
    out[e + 1] = img.size === 256 ? 0 : img.size;
    out[e + 2] = 0; // no palette
    out[e + 3] = 0;
    v.setUint16(e + 4, 1, true); // colour planes
    v.setUint16(e + 6, 32, true); // bits per pixel
    v.setUint32(e + 8, img.data.length, true);
    v.setUint32(e + 12, offset, true);
    out.set(img.data, offset);
    offset += img.data.length;
  });
  return out;
}

/** Reads the directory back (used by the tests and to check a result). */
export function readIcoDirectory(ico: Uint8Array): IcoEntry[] {
  const v = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);
  const n = v.getUint16(4, true);
  const out: IcoEntry[] = [];
  for (let k = 0; k < n; k++) {
    const e = 6 + 16 * k;
    out.push({ width: ico[e] || 256, height: ico[e + 1] || 256, bytes: v.getUint32(e + 8, true), offset: v.getUint32(e + 12, true) });
  }
  return out;
}
