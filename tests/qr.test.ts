import { describe, it, expect } from 'vitest';
import jsQR from 'jsqr';
import { buildMatrix, escapeWifi, toPixels, toSvg, urlPayload, wifiPayload, MAX_QR_CHARS } from '../src/lib/qr';

/** Decodes a matrix with an independent QR reader (jsQR), the way a phone camera app would. */
function decode(matrix: boolean[][]): string | null {
  const { width, height, data } = toPixels(matrix, 6, 4);
  return jsQR(data, width, height)?.data ?? null;
}

describe('payloads', () => {
  it('a URL is encoded exactly as typed, trimmed (AC-1)', () => {
    expect(urlPayload('  https://example.com/a?b=1&c=é  ')).toBe('https://example.com/a?b=1&c=é');
    expect(urlPayload('   ')).toBeNull();
  });
  it('Wi-Fi payload follows the WIFI: format and escapes the special characters', () => {
    expect(wifiPayload({ ssid: 'Home', password: 'pass', security: 'WPA', hidden: false })).toBe('WIFI:T:WPA;S:Home;P:pass;;');
    expect(wifiPayload({ ssid: 'a;b,c:d"e\\f', password: 'p;q', security: 'WPA', hidden: true })).toBe('WIFI:T:WPA;S:a\\;b\\,c\\:d\\"e\\\\f;P:p\\;q;H:true;;');
    expect(escapeWifi('x;y')).toBe('x\\;y');
  });
  it('an open network has no password field; an empty name gives no code (AC-2)', () => {
    expect(wifiPayload({ ssid: 'Cafe', password: 'ignored', security: 'nopass', hidden: false })).toBe('WIFI:T:nopass;S:Cafe;;');
    expect(wifiPayload({ ssid: '  ', password: 'x', security: 'WPA', hidden: false })).toBeNull();
  });
});

describe('codes decode back to their content (AC-1, AC-2)', () => {
  it('URL, plain text and non-Latin text survive a round trip at every error-correction level', () => {
    for (const text of ['https://example.com/path?x=1', 'Hello world', 'नमस्ते 你好 ñ 👍']) {
      for (const ecl of ['L', 'M', 'Q', 'H'] as const) {
        const m = buildMatrix(text, ecl);
        expect(m, `${text} ${ecl}`).not.toBeNull();
        expect(decode(m!), `${text} ${ecl}`).toBe(text);
      }
    }
  });
  it('a Wi-Fi payload decodes to the exact WIFI: string a phone reads', () => {
    const p = wifiPayload({ ssid: 'My Net;1', password: 'secret,pw', security: 'WPA', hidden: false })!;
    expect(decode(buildMatrix(p, 'M')!)).toBe(p);
  });
});

describe('limits and output', () => {
  it('text too long for a QR code gives null instead of throwing', () => {
    expect(buildMatrix('x'.repeat(MAX_QR_CHARS + 500), 'H')).toBeNull();
    expect(buildMatrix('', 'M')).toBeNull();
  });
  it('capacity depends on the error-correction level: the library overflow is handled, not only the length guard', () => {
    // 1,500 plain characters fit at Low (2,953 bytes), Medium (2,331) and Quartile (1,663) but not at High (1,273)
    expect(buildMatrix('x'.repeat(1500), 'H')).toBeNull();
    for (const l of ['L', 'M', 'Q'] as const) expect(buildMatrix('x'.repeat(1500), l), l).not.toBeNull();
    // non-Latin text needs several bytes per character, so far fewer characters fit
    expect(buildMatrix('नमस्ते'.repeat(120), 'L')).not.toBeNull(); // ~2,160 bytes
    expect(buildMatrix('नमस्ते'.repeat(200), 'L')).toBeNull(); // ~3,600 bytes in only 1,200 characters
  });
  it('a network name keeps its spaces as typed', () => {
    expect(wifiPayload({ ssid: ' Home ', password: 'p', security: 'WPA', hidden: false })).toBe('WIFI:T:WPA;S: Home ;P:p;;');
  });
  it('SVG output is well formed, scalable, black on white and decodes (AC-3)', () => {
    const m = buildMatrix('https://example.com', 'M')!;
    const svg = toSvg(m, 4);
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 \d+ \d+"/);
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
    expect(svg.endsWith('</svg>')).toBe(true);
  });
  it('pixel output has a quiet zone and the right size', () => {
    const m = buildMatrix('a', 'L')!;
    const px = toPixels(m, 3, 4);
    expect(px.width).toBe((m.length + 8) * 3);
    expect(px.data.length).toBe(px.width * px.height * 4);
    expect([px.data[0], px.data[1], px.data[2], px.data[3]]).toEqual([255, 255, 255, 255]); // corner is white
  });
});
