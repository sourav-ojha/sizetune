/** Third audit N1: "FF 00" must be stray bytes (libjpeg), not a segment — otherwise a COM payload can hide a fake 1×1 SOF. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseHeader, readHeader } from '../../src/lib/engine/header';
import { assertComplete } from '../../src/lib/engine/complete';
import { inspectFile, tiffHasGps } from '../../src/lib/engine/inspect';
import { runPipeline } from '../../src/lib/engine/pipeline';
import { EngineError } from '../../src/lib/engine/types';
import { jpegBytes } from './bytes';
import { fakeEnv, base, jpg } from './fake-env';

const mkBlob = (parts: unknown[]) => new Blob(parts as BlobPart[]);
const be16 = (n: number) => [(n >> 8) & 255, n & 255];

/** SOI | FF 00 00 08 | COM(len) { fake SOF0 1×1 } | real SOF0 6016×6016 ... | EOI. Our old parser read FF00 as a segment of length 8 and landed on the fake SOF. */
function crafted(): Uint8Array {
  const real = jpegBytes({ width: 6016, height: 6016 }); // SOI, APP0, SOF0, SOS, data, EOI
  const fakeSof = [0xff, 0xc0, ...be16(17), 8, ...be16(1), ...be16(1), 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0];
  const com = [0xff, 0xfe, ...be16(4 + fakeSof.length), 0x20, 0x20, ...fakeSof]; // 2 pad bytes: fake SOF lands at offset 12
  return new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x00, 0x08, ...com, ...real.slice(2)]);
}

describe('N1: FF 00 is junk, exactly like libjpeg', () => {
  it('crafted file parses as the real 6016×6016 image (pixel limits apply to the real frame)', async () => {
    const b = crafted();
    // sanity: the fake SOF sits exactly where "FF00 + length 8" would have jumped
    expect(b[12]).toBe(0xff); expect(b[13]).toBe(0xc0); // = 2 + 2 + 8: where 'FF00 len 8' would jump
    const r = parseHeader(b, b.length);
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.info.width, r.info.height]).toEqual([6016, 6016]);
    const blob = mkBlob([b]);
    await expect(assertComplete(blob, await readHeader(blob))).resolves.toBeUndefined();
    expect(await inspectFile(blob)).toMatchObject({ width: 6016, height: 6016 });
    await expect(inspectFile(blob, { maxPixels: 30_000_000 })).rejects.toMatchObject({ code: 'too_many_pixels' });
  });
  it('FF00 pairs count toward the 64 KB stray budget', () => {
    const j = jpegBytes({ width: 10, height: 10 });
    const many = new Uint8Array([...j.slice(0, 20), ...new Array(40 * 1024).fill(0).flatMap(() => [0xff, 0x00]), ...j.slice(20)]); // 80 KB of FF00
    expect(parseHeader(many, many.length)).toMatchObject({ ok: false, reason: 'corrupt' });
    const few = new Uint8Array([...j.slice(0, 20), 0xff, 0x00, 0xff, 0x00, 0x00, 0x01, ...j.slice(20)]);
    const r = parseHeader(few, few.length);
    expect(r.ok && r.info.width).toBe(10);
  });
  it('reserved markers 0x02–0xBF are rejected (libjpeg: unknown marker)', () => {
    const j = jpegBytes({ width: 10, height: 10 });
    for (const m of [0x02, 0x4f, 0xbf]) {
      const b = new Uint8Array([...j.slice(0, 20), 0xff, m, 0x00, 0x04, 0, 0, ...j.slice(20)]);
      expect(parseHeader(b, b.length), m.toString(16)).toMatchObject({ ok: false, reason: 'corrupt' });
    }
  });
  it('the decoded-vs-header guard still rejects a bitmap far larger than its header', async () => {
    const f = fakeEnv({ inflate: 100 });
    await expect(runPipeline(jpg(1, 1), base, f.env)).rejects.toMatchObject({ code: 'corrupt' });
    expect(f.images.every((i) => i.closed)).toBe(true);
  });
  it('fuzz: FF00 / FF00+length / stray injections at segment boundaries never change the dimensions', async () => {
    const FIX = path.join(import.meta.dirname, '../fixtures');
    const seeds = ['photo-200x230.jpg', 'exif6-gps.jpg', 'progressive-640x480.jpg', 'cmyk-300x200.jpg'].map((n) => new Uint8Array(fs.readFileSync(path.join(FIX, n))));
    let s = 99;
    const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const boundaries = (b: Uint8Array) => {
      const out: number[] = []; let i = 2;
      while (i + 4 <= b.length) { out.push(i); const m = b[i + 1]; if (m === 0xda) break; i += 2 + ((b[i + 2] << 8) | b[i + 3]); }
      return out;
    };
    let same = 0, rejected = 0;
    for (let k = 0; k < 1200; k++) {
      const src = seeds[k % seeds.length];
      const truth = parseHeader(src, src.length);
      if (!truth.ok) throw new Error('seed must parse');
      const bs = boundaries(src);
      const at = bs[Math.floor(R() * bs.length)];
      const kind = Math.floor(R() * 4);
      const inj = kind === 0 ? [0xff, 0x00] : kind === 1 ? [0xff, 0x00, 0x00, (R() * 256) | 0] : kind === 2 ? new Array(1 + Math.floor(R() * 20)).fill(0).map(() => ((R() * 255) | 0) & 0xfe) : [0xff, 0xff, 0xff, 0x00];
      const b = new Uint8Array([...src.slice(0, at), ...inj, ...src.slice(at)]);
      const r = parseHeader(b, b.length);
      if (r.ok) {
        expect([r.info.width, r.info.height, r.info.orientation], JSON.stringify({ k, at, inj })).toEqual([truth.info.width, truth.info.height, truth.info.orientation]);
        same++;
      } else { expect(['corrupt', 'unsupported']).toContain(r.reason); rejected++; } // stray bytes right after SOI fail the FF D8 FF signature check
      try { await inspectFile(mkBlob([b])); } catch (e) { expect(e).toBeInstanceOf(EngineError); }
    }
    expect(same).toBeGreaterThan(1000);
    void rejected; void tiffHasGps;
  });
});
