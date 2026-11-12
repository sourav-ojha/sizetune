/** Byte builders for header/magic tests. They produce structurally valid headers (not decodable images). */
const u16be = (n: number) => [(n >> 8) & 255, n & 255];
const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16le = (n: number) => [n & 255, (n >> 8) & 255];
const u24le = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
const u32le = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Minimal TIFF/EXIF APP1 payload with IFD0 { Orientation }. `le` selects II vs MM byte order. */
export function exifApp1(orientation: number, le = false): number[] {
  const s16 = le ? u16le : u16be;
  const s32 = le ? u32le : u32be;
  const tiff = [
    ...(le ? ascii('II') : ascii('MM')),
    ...s16(42),
    ...s32(8), // IFD0 offset
    ...s16(1), // 1 entry
    ...s16(0x0112), ...s16(3), ...s32(1), ...s16(orientation), 0, 0,
    ...s32(0), // next IFD
  ];
  const payload = [...ascii('Exif'), 0, 0, ...tiff];
  return [0xff, 0xe1, ...u16be(payload.length + 2), ...payload];
}

export function jpegBytes(o: { width: number; height: number; orientation?: number; le?: boolean; padApp?: number; sof?: number; components?: number }): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  out.push(0xff, 0xe0, ...u16be(16), ...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0);
  if (o.orientation) out.push(...exifApp1(o.orientation, o.le));
  if (o.padApp) {
    // big APP segments (up to 65533 bytes payload each) before SOF, like real camera files with thumbnails
    let left = o.padApp;
    while (left > 0) {
      const n = Math.min(left, 65000);
      out.push(0xff, 0xed, ...u16be(n + 2), ...new Array(n).fill(0x20));
      left -= n;
    }
  }
  const nc = o.components ?? 3;
  const sof = [8, ...u16be(o.height), ...u16be(o.width), nc];
  for (let i = 0; i < nc; i++) sof.push(i + 1, 0x11, 0);
  out.push(0xff, o.sof ?? 0xc0, ...u16be(sof.length + 2), ...sof);
  out.push(0xff, 0xda, ...u16be(8), 1, 1, 0, 0, 63, 0, 0x12, 0x34, 0xff, 0xd9);
  return new Uint8Array(out);
}

function crc32(bytes: number[]): number {
  let c = -1;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ -1) >>> 0;
}
function pngChunk(type: string, data: number[]): number[] {
  const td = [...ascii(type), ...data];
  return [...u32be(data.length), ...td, ...u32be(crc32(td))];
}
export function pngBytes(o: { width: number; height: number; colorType?: number; tRNS?: boolean; acTL?: boolean; bigChunk?: number }): Uint8Array {
  const out = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  out.push(...pngChunk('IHDR', [...u32be(o.width), ...u32be(o.height), 8, o.colorType ?? 2, 0, 0, 0]));
  if (o.bigChunk) out.push(...pngChunk('zTXt', new Array(o.bigChunk).fill(1)));
  if (o.acTL) out.push(...pngChunk('acTL', [...u32be(2), ...u32be(0)]));
  if (o.colorType === 3) out.push(...pngChunk('PLTE', [0, 0, 0, 255, 255, 255]));
  if (o.tRNS) out.push(...pngChunk('tRNS', [0]));
  out.push(...pngChunk('IDAT', [0x78, 0x9c, 3, 0, 0, 0, 0, 1]));
  out.push(...pngChunk('IEND', []));
  return new Uint8Array(out);
}

function riff(chunks: number[]): Uint8Array {
  return new Uint8Array([...ascii('RIFF'), ...u32le(chunks.length + 4), ...ascii('WEBP'), ...chunks]);
}
export function webpVp8(width: number, height: number): Uint8Array {
  const data = [0x10, 0x02, 0x00, 0x9d, 0x01, 0x2a, ...u16le(width & 0x3fff), ...u16le(height & 0x3fff), 0, 0];
  return riff([...ascii('VP8 '), ...u32le(data.length), ...data]);
}
export function webpVp8l(width: number, height: number, alpha: boolean): Uint8Array {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14) | ((alpha ? 1 : 0) << 28);
  const data = [0x2f, ...u32le(bits >>> 0), 0, 0, 0];
  return riff([...ascii('VP8L'), ...u32le(data.length), ...data]);
}
export function webpVp8x(width: number, height: number, flags: { alpha?: boolean; anim?: boolean }): Uint8Array {
  const f = (flags.alpha ? 0x10 : 0) | (flags.anim ? 0x02 : 0);
  const data = [f, 0, 0, 0, ...u24le(width - 1), ...u24le(height - 1)];
  return riff([...ascii('VP8X'), ...u32le(data.length), ...data]);
}
export const asciiBytes = (s: string) => new Uint8Array(ascii(s));
