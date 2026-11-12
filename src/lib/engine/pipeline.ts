/**
 * One job: validate -> header -> limits -> plan -> decode (maybe reduced) -> alpha -> format -> search -> result.
 * Environment-agnostic (Env is injected); used by the worker and by the main-thread fallback.
 * Never logs image data or metadata. Never does network I/O.
 */
import { EngineError, type ProcessHooks, type ProcessOptions, type ProcessResult } from './types';
import { resolveLimits, type FullLimits } from './limits';
import { normalizeOptions, hasSizeTarget, outputTooLargeMessage } from './options';
import { readHeader } from './header';
import { hasMagic } from './sniff';
import { resolveGeometry, type Geometry, type Rect } from './dims';
import { byteWindow } from './window';
import { planDecode, resolveFormat } from './plan';
import { fitSearch, Q_MIN } from './search';
import { buildMessage, NOTES } from './messages';
import { stripIccProfile, isStructurallyValidJpeg } from './jpeg';
import { RunContext } from './context';
import { classifyBrowserError } from './errors';
import { assertComplete } from './complete';
import type { DecodedImage, Env } from './env';

export interface PipelineConfig {
  limits?: Partial<FullLimits>;
  mode?: 'worker' | 'main-thread';
  now?: () => number;
}

const isEngineError = (e: unknown): e is EngineError => e instanceof EngineError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'EngineError');

/** Decode failures: only a genuine allocation failure is out_of_memory; anything else is corrupt (see errors.ts). */
function mapDecodeError(e: unknown, pixels: number): EngineError {
  if (isEngineError(e)) return e;
  return classifyBrowserError(e, 'decode', pixels);
}

/** Output limits apply to the RESOLVED geometry (a derived side or lockAspect:false can make it huge). */
function checkOutput(g: Geometry, limits: FullLimits): Geometry {
  // Free dimensions are bounded by the (reduced) decode; only user-fixed sizes can ask for a huge canvas.
  if (g.fixed && (g.baseWidth > limits.maxSide || g.baseHeight > limits.maxSide || g.baseWidth * g.baseHeight > limits.maxOutputPixels)) {
    throw new EngineError('invalid_options', outputTooLargeMessage(limits));
  }
  return g;
}
const mp = (px: number) => (px / 1e6).toFixed(1);

export async function runPipeline<I extends DecodedImage>(file: Blob, input: ProcessOptions, env: Env<I>, hooks: ProcessHooks = {}, cfg: PipelineConfig = {}): Promise<ProcessResult> {
  const limits = resolveLimits(cfg.limits);
  const now = cfg.now ?? (() => Date.now());
  const t0 = now();
  const ctx = new RunContext(hooks.signal, limits.timeoutMs, now);
  const progress = hooks.onProgress ?? (() => {});
  const opts = normalizeOptions(input, limits);
  ctx.check();
  progress({ stage: 'reading' });

  if (!(file instanceof Blob)) throw new EngineError('invalid_options', 'No file was given.');
  if (file.size > limits.maxFileBytes) throw new EngineError('too_large_bytes', `This file is larger than ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB. Please choose a smaller image.`);
  const header = await ctx.race(readHeader(file));
  const srcPixels = header.width * header.height;
  if (srcPixels > limits.maxPixels) throw new EngineError('too_many_pixels', `This image has ${mp(srcPixels)} megapixels; the limit is ${mp(limits.maxPixels)}. Please choose a smaller image.`);

  await ctx.race(assertComplete(file, header)); // truncated files are refused before decoding (some browsers paint them grey)

  const win = byteWindow(opts.minKb, opts.maxKb);
  if (win.lo > win.hi) throw new EngineError('invalid_options', 'The minimum and maximum sizes are too close together to be met. Please widen the range.');
  const notes: string[] = [];
  if (win.conflict) notes.push(NOTES.kbConflict(opts.minKb as number));
  if (header.animated) notes.push(NOTES.animated);

  let srcW = header.width, srcH = header.height;
  let geom = checkOutput(resolveGeometry(srcW, srcH, opts), limits);
  const plan = planDecode(srcW, srcH, geom, win.lo, win.hi, limits);

  progress({ stage: 'decoding' });
  let img: I | null = null;
  try {
    try {
      img = await ctx.race(env.decode(file, plan.reduced ? plan.width : undefined), (late) => late.close());
    } catch (e) {
      throw mapDecodeError(e, plan.reduced ? plan.width * plan.height : srcW * srcH);
    }
    if (!(img.width > 0 && img.height > 0)) throw new EngineError('corrupt', 'This image could not be opened. The file may be damaged.');
    // The decoded bitmap must not be bigger than the header promised (limits were enforced on the header).
    if (img.width * img.height > srcW * srcH * 1.01 + 1) throw new EngineError('corrupt', 'The image data does not match its header. The file may be damaged.');
    // A browser that ignores resize-at-decode returns the full size: redraw it at the planned working size (keeping the
    // bitmap's own aspect, whatever its orientation) instead of failing, and release the big one at once.
    if (plan.reduced && img.width * img.height > plan.width * plan.height * 1.01 + 1) {
      const big: I = img;
      const tw = Math.max(1, Math.round(Math.sqrt((plan.width * plan.height * big.width) / big.height)));
      const th = Math.max(1, Math.round((tw * big.height) / big.width));
      try {
        img = await ctx.race(env.downscale(big, tw, th), (late) => late.close());
      } finally {
        big.close();
      }
    }

    // Reconcile orientation with what the browser actually produced (it is the source of truth for pixels).
    let orientationApplied = true;
    const headerLandscape = srcW > srcH, bmpLandscape = img.width > img.height;
    if (srcW !== srcH && img.width !== img.height && headerLandscape !== bmpLandscape) {
      if (header.orientation >= 5) { orientationApplied = false; notes.push(NOTES.orientationUnknown); }
      [srcW, srcH] = [srcH, srcW];
      geom = checkOutput(resolveGeometry(srcW, srcH, opts), limits);
    }
    const k = img.width / srcW; // source px -> decoded px
    const src: Rect = { x: geom.src.x * k, y: geom.src.y * k, width: Math.min(img.width, geom.src.width * k), height: Math.min(img.height, geom.src.height * k) };

    // Base output size: free dims are capped by what we decoded (never upscale beyond the working bitmap).
    let baseW = geom.baseWidth, baseH = geom.baseHeight;
    if (!geom.fixed && (src.width < baseW - 0.5 || src.height < baseH - 0.5)) {
      const f = Math.min(src.width / baseW, src.height / baseH);
      baseW = Math.max(1, Math.round(baseW * f)); baseH = Math.max(1, Math.round(baseH * f));
    }
    if (geom.upscaled) notes.push(NOTES.upscaled);

    const hasAlpha = header.alphaPossible ? await ctx.race(env.hasAlpha(img)) : false;
    const canWebp = opts.format === 'webp' || (opts.format === 'auto' && header.mime === 'image/webp') ? await ctx.race(env.canEncode('image/webp')) : false;
    const fmt = resolveFormat(opts.format, header.mime, hasAlpha, opts.background, canWebp);
    notes.push(...fmt.notes);
    const lossy = fmt.mime !== 'image/png';

    // Optional ICC strip: probe once that a stripped JPEG still decodes here.
    let strip = false;
    if (opts.stripIcc && fmt.mime === 'image/jpeg') {
      const probe = await ctx.race(probeIccStrip(env, img));
      strip = probe === 'strip';
      if (probe === 'unsafe') notes.push(NOTES.iccKept);
    }

    const maxEncodes = limits.maxEncodes;
    let n = 0;
    const encode = async (w: number, h: number, q: number | null) => {
      ctx.check();
      progress({ stage: 'encoding', attempt: ++n, total: maxEncodes });
      const raw = await ctx.race(env.render(img as I, src, w, h, fmt.fill, fmt.mime, q === null ? undefined : q / 100));
      const head = new Uint8Array(await ctx.race(raw.slice(0, 16).arrayBuffer()));
      if (!hasMagic(head, fmt.mime)) throw new EngineError('encode_unsupported', `This browser could not save the image as ${fmt.mime === 'image/webp' ? 'WebP' : fmt.mime === 'image/png' ? 'PNG' : 'JPEG'}.`);
      let blob = raw;
      if (strip) {
        const stripped = stripIccProfile(new Uint8Array(await ctx.race(raw.arrayBuffer())));
        if (stripped) blob = new Blob([stripped as BlobPart], { type: 'image/jpeg' });
      }
      if (env.yieldToEventLoop) await env.yieldToEventLoop();
      ctx.check();
      return { blob, bytes: blob.size };
    };

    const out = await fitSearch(
      {
        baseWidth: baseW, baseHeight: baseH, fixed: geom.fixed, lossy, lo: win.lo, hi: win.hi, hasTarget: hasSizeTarget(opts),
        strategy: opts.strategy, maxEncodes, minSide: limits.minSide, fixedQuality: opts.quality,
        allowEnlarge: !!opts.allowEnlarge, maxEnlargePixels: limits.maxOutputPixels,
      },
      encode,
    );
    const best = out.best;
    const blob = best.blob;
    // Final checks on the real bytes (never trust bookkeeping).
    const finalHead = new Uint8Array(await ctx.race(blob.slice(0, 16).arrayBuffer()));
    if (!hasMagic(finalHead, fmt.mime)) throw new EngineError('encode_unsupported', 'The browser produced an unexpected file type.');
    if (strip && !isStructurallyValidJpeg(new Uint8Array(await ctx.race(blob.arrayBuffer())))) throw new EngineError('encode_unsupported', 'The browser produced an invalid JPEG.');
    if ((out.status === 'ok' || out.status === 'raised') && !(blob.size >= win.lo && blob.size <= win.hi)) throw new Error('internal: success outside window'); // unreachable by construction

    if (lossy && best.quality !== null && best.quality < Q_MIN && (out.status === 'ok' || out.status === 'raised')) notes.push(NOTES.lowQuality(best.quality));
    if (fmt.mime === 'image/png' && !hasAlpha && opts.format === 'auto' && hasSizeTarget(opts) && (best.scale < 0.999 || out.status === 'above_max' || out.status === 'above_max_fixed')) notes.push(NOTES.pngTryJpeg);
    // Disclose the reduced decode whenever it limited the detail available to the output (free or fixed dims, crops).
    if (plan.reduced && (best.width > src.width * 0.98 || best.height > src.height * 0.98)) notes.push(NOTES.reduced(img.width, img.height, srcW, srcH));

    const message = buildMessage({
      status: out.status, reason: out.reason, mime: fmt.mime, lossless: !lossy, fixed: geom.fixed, allowEnlarge: !!opts.allowEnlarge,
      minKb: opts.minKb, maxKb: opts.maxKb, lo: win.lo, hi: win.hi, maxEncodes,
      best, gapAbove: out.gapAbove, maxProbe: out.maxQualityProbe,
    });
    ctx.check(); // an abort that arrived during the final checks must not resolve
    return {
      status: out.status,
      blob,
      mime: fmt.mime,
      width: best.width,
      height: best.height,
      bytes: blob.size,
      quality: lossy ? best.quality : null,
      attempts: out.attempts,
      window: { minBytes: win.lo > 0 ? win.lo : null, maxBytes: Number.isFinite(win.hi) ? win.hi : null },
      source: { bytes: file.size, width: srcW, height: srcH, mime: header.mime, hasAlpha, orientationApplied },
      notes,
      message,
      mode: cfg.mode,
      originalFits: hasSizeTarget(opts) ? file.size >= win.lo && file.size <= win.hi : undefined,
      elapsedMs: Math.round(now() - t0),
    };
  } finally {
    img?.close();
    env.release();
  }
}

/** 'strip' = removing the ICC APP2 keeps a decodable JPEG here; 'nothing' = this encoder writes no ICC; 'unsafe' = decode test failed. */
async function probeIccStrip<I extends DecodedImage>(env: Env<I>, img: I): Promise<'strip' | 'nothing' | 'unsafe'> {
  const raw = await env.render(img, { x: 0, y: 0, width: Math.min(8, img.width), height: Math.min(8, img.height) }, 8, 8, '#ffffff', 'image/jpeg', 0.9);
  const stripped = stripIccProfile(new Uint8Array(await raw.arrayBuffer()));
  if (!stripped) return 'nothing';
  let probe: I | null = null;
  try {
    probe = await env.decode(new Blob([stripped as BlobPart], { type: 'image/jpeg' }));
    return probe.width === 8 && probe.height === 8 ? 'strip' : 'unsafe';
  } catch {
    return 'unsafe';
  } finally {
    probe?.close();
  }
}
