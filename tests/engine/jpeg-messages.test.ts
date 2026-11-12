import { describe, it, expect } from 'vitest';
import { stripIccProfile, isStructurallyValidJpeg } from '../../src/lib/engine/jpeg';
import { buildMessage, formatKb, type MessageInput } from '../../src/lib/engine/messages';
import { RunContext } from '../../src/lib/engine/context';
import { createObjectUrlSlot, outputFileName } from '../../src/lib/engine/urls';
import { jpegBytes, app2Icc, iccProfile } from './bytes';

function withIcc(): Uint8Array {
  const j = jpegBytes({ width: 8, height: 8 });
  return new Uint8Array([...j.slice(0, 20), ...app2Icc(iccProfile('sRGB', 'mluc')), ...j.slice(20)]); // after SOI+APP0
}

describe('ICC strip', () => {
  it('removes only the ICC APP2 and keeps a structurally valid JPEG', () => {
    const src = withIcc();
    expect(isStructurallyValidJpeg(src)).toBe(true);
    const out = stripIccProfile(src)!;
    expect(out.length).toBe(src.length - app2Icc(iccProfile('sRGB', 'mluc')).length);
    expect(isStructurallyValidJpeg(out)).toBe(true);
    expect(Array.from(out)).toEqual(Array.from(jpegBytes({ width: 8, height: 8 })));
  });
  it('returns null when there is no ICC or the file is malformed', () => {
    expect(stripIccProfile(jpegBytes({ width: 8, height: 8 }))).toBeNull();
    expect(stripIccProfile(withIcc().slice(0, 40))).toBeNull();
    expect(stripIccProfile(new Uint8Array([1, 2, 3]))).toBeNull();
  });
  it('does not touch a non-ICC APP2', () => {
    const j = jpegBytes({ width: 8, height: 8 });
    const seg = [0xff, 0xe2, 0, 6, 1, 2, 3, 4];
    expect(stripIccProfile(new Uint8Array([...j.slice(0, 20), ...seg, ...j.slice(20)]))).toBeNull();
  });
});

const M = (o: Partial<MessageInput>): MessageInput => ({
  status: 'ok', reason: 'in_window', mime: 'image/jpeg', lossless: false, fixed: false, allowEnlarge: false, lo: 20_480, hi: 50_000, minKb: 20, maxKb: 50, maxEncodes: 20,
  best: { bytes: 50_483, width: 1004, height: 565, quality: 60, enlarged: false, scale: 0.3 }, ...o,
});

describe('messages', () => {
  it('formatKb uses 1024 and one decimal', () => {
    expect(formatKb(50_483)).toBe('49.3 KB');
    expect(formatKb(900)).toBe('900 bytes');
  });
  it('ok / raised / below_min / above_max wording with real numbers', () => {
    expect(buildMessage(M({}))).toBe('49.3 KB – within 20–50 KB. Quality 60%, 1004×565 px.');
    expect(buildMessage(M({ status: 'raised', best: { bytes: 21_914, width: 200, height: 230, quality: 97, enlarged: false, scale: 1 } })))
      .toBe('Your minimum is 20 KB. We raised JPEG quality to 97% to reach 21.4 KB. The picture looks the same; the file just stores more detail.');
    expect(buildMessage(M({ status: 'below_min', reason: 'min_unreachable', fixed: true, lo: 10_240, hi: 20_000, minKb: 10, maxKb: 20, best: { bytes: 4762, width: 140, height: 60, quality: 100, enlarged: false, scale: 1 } })))
      .toBe('At 140×60 px this image is at most 4.7 KB (4,762 bytes) even at maximum quality, so the 10 KB minimum (10,240 bytes) cannot be met at these dimensions. Check whether the portal really requires these exact dimensions; larger dimensions would give a bigger file.');
    expect(buildMessage(M({ status: 'above_max', reason: 'max_unreachable', minKb: undefined, lo: 0, maxKb: 1.5, hi: 1500, best: { bytes: 2007, width: 75, height: 98, quality: 1, enlarged: false, scale: 0.05 } })))
      .toBe('Cannot go below 2.0 KB (2,007 bytes) for this image (smallest result: 75×98 px at quality 1%), which is above your 1.5 KB limit (1,500 bytes). Increase the limit or use a simpler image.');
    expect(buildMessage(M({ status: 'above_max_fixed', reason: 'max_unreachable', minKb: undefined, lo: 0, maxKb: 1.4, hi: 1400, fixed: true, best: { bytes: 1536, width: 200, height: 230, quality: 1, enlarged: false, scale: 1 } })))
      .toMatch(/^At 200×230 px the smallest JPEG is 1.5 KB \(1,536 bytes\) \(quality 1%\), which is above your 1.4 KB limit \(1,400 bytes\)\./);
    expect(buildMessage(M({ mime: 'image/png', lossless: true, best: { bytes: 40_000, width: 500, height: 400, quality: null, enlarged: false, scale: 0.5 } }))).toMatch(/PNG is lossless, so the size was reached by reducing the pixel dimensions only/);
  });
});

describe('RunContext', () => {
  it('race rejects on abort and hands the late value to onLate', async () => {
    const ac = new AbortController();
    const ctx = new RunContext(ac.signal, 10_000);
    let late: number | null = null;
    const p = ctx.race(new Promise<number>((r) => setTimeout(() => r(42), 30)), (v) => (late = v));
    ac.abort();
    await expect(p).rejects.toMatchObject({ code: 'cancelled' });
    await new Promise((r) => setTimeout(r, 50));
    expect(late).toBe(42);
  });
  it('race rejects with timeout at the deadline', async () => {
    const ctx = new RunContext(undefined, 20);
    await expect(ctx.race(new Promise(() => {}))).rejects.toMatchObject({ code: 'timeout' });
  });
});

describe('url helpers', () => {
  it('slot revokes the previous URL', () => {
    const revoked: string[] = [];
    let n = 0;
    const g = globalThis as unknown as { URL: typeof URL };
    const orig = { c: g.URL.createObjectURL, r: g.URL.revokeObjectURL };
    g.URL.createObjectURL = () => `blob:${++n}`;
    g.URL.revokeObjectURL = (u: string) => { revoked.push(u); };
    try {
      const s = createObjectUrlSlot();
      s.set(new Blob()); s.set(new Blob()); s.revoke();
      expect(revoked).toEqual(['blob:1', 'blob:2']);
      expect(s.current).toBeNull();
    } finally { g.URL.createObjectURL = orig.c; g.URL.revokeObjectURL = orig.r; }
  });
  it('download name follows the verified mime', () => {
    expect(outputFileName('My Photo.HEIC.jpg', 'image/webp')).toBe('My-Photo.HEIC-sizetune.webp');
    expect(outputFileName('', 'image/png')).toBe('image-sizetune.png');
  });
});
