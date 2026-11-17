export interface ZipFile { name: string; data: Uint8Array }

/** Keeps only the last path segment, so a file name cannot place itself outside the archive's top folder. */
const base = (n: string): string => n.split(/[\\/]/).pop() || 'file';

/** Safe, unique names for a batch: a repeated name gets -2, -3 ... before the extension, and no name is ever handed out twice. */
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    const name = base(raw);
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let candidate = name;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${stem}-${n}${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

/** Standard CRC-32 (the checksum ZIP stores for every file). */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * One ZIP with every file stored, not compressed (the pictures inside are already compressed). A small writer of our own, about a
 * kilobyte on the wire, because the images in a batch gain nothing from deflate and this keeps the tool pages light. Names are UTF-8.
 * No ZIP64: it refuses more than 65,535 files or 4 GB, far beyond what a batch holds.
 */
export function makeZip(files: ZipFile[]): Uint8Array {
  if (files.length > 0xffff) throw new Error('too many files for a ZIP');
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = (Math.max(0, now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const entries = files.map((f) => ({ name: enc.encode(f.name), data: f.data, crc: crc32(f.data), offset: 0 }));
  let size = 22;
  for (const e of entries) size += 30 + e.name.length + e.data.length + 46 + e.name.length;
  if (size > 0xffffffff) throw new Error('ZIP would be larger than 4 GB');
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  let p = 0;
  for (const e of entries) {
    e.offset = p;
    v.setUint32(p, 0x04034b50, true); v.setUint16(p + 4, 20, true); v.setUint16(p + 6, 0x0800, true); v.setUint16(p + 8, 0, true);
    v.setUint16(p + 10, dosTime, true); v.setUint16(p + 12, dosDate, true); v.setUint32(p + 14, e.crc, true);
    v.setUint32(p + 18, e.data.length, true); v.setUint32(p + 22, e.data.length, true); v.setUint16(p + 26, e.name.length, true); v.setUint16(p + 28, 0, true);
    out.set(e.name, p + 30); p += 30 + e.name.length;
    out.set(e.data, p); p += e.data.length;
  }
  const dir = p;
  for (const e of entries) {
    v.setUint32(p, 0x02014b50, true); v.setUint16(p + 4, 20, true); v.setUint16(p + 6, 20, true); v.setUint16(p + 8, 0x0800, true); v.setUint16(p + 10, 0, true);
    v.setUint16(p + 12, dosTime, true); v.setUint16(p + 14, dosDate, true); v.setUint32(p + 16, e.crc, true);
    v.setUint32(p + 20, e.data.length, true); v.setUint32(p + 24, e.data.length, true); v.setUint16(p + 28, e.name.length, true);
    v.setUint16(p + 30, 0, true); v.setUint16(p + 32, 0, true); v.setUint16(p + 34, 0, true); v.setUint16(p + 36, 0, true); v.setUint32(p + 38, 0, true); v.setUint32(p + 42, e.offset, true);
    out.set(e.name, p + 46); p += 46 + e.name.length;
  }
  v.setUint32(p, 0x06054b50, true); v.setUint16(p + 4, 0, true); v.setUint16(p + 6, 0, true);
  v.setUint16(p + 8, entries.length, true); v.setUint16(p + 10, entries.length, true); v.setUint32(p + 12, p - dir, true); v.setUint32(p + 16, dir, true); v.setUint16(p + 20, 0, true);
  return out;
}
