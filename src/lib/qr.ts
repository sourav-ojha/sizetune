// QR code content and rendering (FEATURE-018). Pure functions: no network, no storage. Encoding is done by the MIT-licensed
// qrcode-generator library; SVG and pixel output are written here, so the library's own SVG helper is never called.
import qrcode from 'qrcode-generator';

export type Ecl = 'L' | 'M' | 'Q' | 'H';
export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

// The library turns text into bytes one character at a time; make it UTF-8 so accents, scripts and emoji scan back correctly.
qrcode.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s));

/** More text than any QR code can hold at the lowest error correction (version 40, byte mode, level L is 2,953 bytes). */
export const MAX_QR_CHARS = 2000;

/** The text is encoded exactly as typed, trimmed. Null when empty. */
export function urlPayload(input: string): string | null {
  const t = input.trim();
  return t === '' ? null : t;
}

/** Escapes the characters that are special inside a WIFI: payload. */
export function escapeWifi(s: string): string {
  return s.replace(/([\\;,:"])/g, '\\$1');
}

export interface WifiInput { ssid: string; password: string; security: WifiSecurity; hidden: boolean }

/** The widely supported WIFI:T:<type>;S:<name>;P:<password>;H:true;; format that phone cameras offer to join. Null without a network name. */
export function wifiPayload(w: WifiInput): string | null {
  const ssid = w.ssid.trim();
  if (ssid === '') return null;
  const parts = [`T:${w.security}`, `S:${escapeWifi(ssid)}`];
  if (w.security !== 'nopass') parts.push(`P:${escapeWifi(w.password)}`);
  if (w.hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

/** The module grid (true = dark) for the text at an error-correction level, or null when it is empty or too long for a QR code. */
export function buildMatrix(text: string, ecl: Ecl): boolean[][] | null {
  if (text === '' || text.length > MAX_QR_CHARS) return null;
  try {
    const qr = qrcode(0, ecl); // 0 = smallest version that fits
    qr.addData(text, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
  } catch {
    return null; // the library throws when the data does not fit
  }
}

/** Scalable SVG, black modules on a white background with a quiet zone of `margin` modules on every side. */
export function toSvg(matrix: boolean[][], margin = 4): string {
  const n = matrix.length, size = n + margin * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!matrix[r][c]) { c++; continue; }
      let end = c;
      while (end < n && matrix[r][end]) end++;
      d += `M${c + margin} ${r + margin}h${end - c}v1h-${end - c}z`; // one rectangle per horizontal run keeps the file small
      c = end;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 10}" height="${size * 10}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#ffffff"/><path d="${d}" fill="#000000"/></svg>`;
}

/** RGBA pixels, `cell` pixels per module, with a quiet zone of `margin` modules. Used for the PNG and for scanning in tests. */
export function toPixels(matrix: boolean[][], cell: number, margin = 4): { width: number; height: number; data: Uint8ClampedArray } {
  const n = matrix.length, side = (n + margin * 2) * cell;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!matrix[r][c]) continue;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const i = (((r + margin) * cell + y) * side + (c + margin) * cell + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  return { width: side, height: side, data };
}
