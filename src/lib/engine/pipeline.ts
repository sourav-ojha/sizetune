/**
 * One job: validate -> header -> limits -> plan -> decode (maybe reduced) -> alpha -> format -> search -> result.
 * Environment-agnostic (Env is injected); used by the worker and by the main-thread fallback.
 * Never logs image data or metadata. Never does network I/O.
 */
import { EngineError, type ProcessHooks, type ProcessOptions, type ProcessResult } from './types';
import { resolveLimits, type FullLimits } from './limits';
import { normalizeOptions, hasSizeTarget } from './options';
import { readHeader } from './header';
import { hasMagic } from './sniff';
import { resolveGeometry, type Rect } from './dims';
import { byteWindow } from './window';
import { planDecode, resolveFormat } from './plan';
import { fitSearch, Q_MIN } from './search';
import { buildMessage, NOTES } from './messages';
import { stripIccProfile, isStructurallyValidJpeg } from './jpeg';
import { RunContext } from './context';
import type { DecodedImage, Env } from './env';

export interface PipelineConfig {
  limits?: Partial<FullLimits>;
  mode?: 'worker' | 'main-thread';
  now?: () => number;
}

const isEngineError = (e: unknown): e is EngineError => e instanceof EngineError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'EngineError');

function mapDecodeError(e: unknown): EngineError {
  if (isEngineError(e)) return e;
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
  if (e instanceof RangeError || /memory|allocation|too large/.test(msg)) return new EngineError('out_of_memory', 'The browser ran out of memory while opening this image. Try a smaller image or close other tabs.');
  return new EngineError('corrupt', 'This image could not be opened. The file may be damaged.');
}

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
  if (srcPixels > limits.maxPixels) throw new EngineError('too_many_pixels', `This image has ${Math.round(srcPixels / 1e6)} megapixels; the limit is ${Math.round(limits.maxPixels / 1e6)}. Please choose a smaller image.`);

  const win = byteWindow(opts.minKb, opts.maxKb);
  const notes: string[] = [];
  if (win.conflict) notes.push(NOTES.kbConflict(opts.minKb as number));
  if (header.animated) notes.push(NOTES.animated);

  let srcW = header.width, srcH = header.height;
  let geom = resolveGeometry(srcW, srcH, opts);
  const plan = planDecode(srcW, srcH, geom, win.lo, win.hi, limits);

  progress({ stage: 'decoding' });
  let img: I | null = null;
  try {
    try {
      img = await ctx.race(env.decode(file, plan.reduced ? plan.width : undefined), (late) => late.close());
    } catch (e) {
      throw mapDecodeError(e);
    }
    if (!(img.width > 0 && img.height > 0)) throw new EngineError('corrupt', 'This image could not be opened. The file may be damaged.');

    // Reconcile orientation with what the browser actually produced (it is the source of truth for pixels).
    let orientationApplied = true;
    const headerLandscape = srcW > srcH, bmpLandscape = img.width > img.height;
    if (srcW !== srcH && img.width !== img.height && headerLandscape !== bmpLandscape) {
      if (header.orientation >= 5) { orientationApplied = false; notes.push(NOTES.orientationUnknown); }
      [srcW, srcH] = [srcH, srcW];
      geom = resolveGeometry(srcW, srcH, opts);
    }
    const k = img.width / srcW; // source px -> decoded px
    const src: Rect = { x: geom.src.x * k, y: geom.src.y * k, width: Math.min(img.width, geom.src.width * k), height: Math.min(img.height, geom.src.height * k) };

    // Base output size: free dims are capped by what we decoded (never upscale beyond the working bitmap).
    let baseW = geom.baseWidth, baseH = geom.baseHeight;
    let memoryReduced = false;
    if (!geom.fixed && (src.width < baseW - 0.5 || src.height < baseH - 0.5)) {
      const f = Math.min(src.width / baseW, src.height / baseH);
      baseW = Math.max(1, Math.round(baseW * f)); baseH = Math.max(1, Math.round(baseH * f));
      memoryReduced = true;
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
    const finalHead = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    if (!hasMagic(finalHead, fmt.mime)) throw new EngineError('encode_unsupported', 'The browser produced an unexpected file type.');
    if (strip && !isStructurallyValidJpeg(new Uint8Array(await blob.arrayBuffer()))) throw new EngineError('encode_unsupported', 'The browser produced an invalid JPEG.');
    if ((out.status === 'ok' || out.status === 'raised') && !(blob.size >= win.lo && blob.size <= win.hi)) throw new Error('internal: success outside window'); // unreachable by construction

    if (lossy && best.quality !== null && best.quality < Q_MIN && (out.status === 'ok' || out.status === 'raised')) notes.push(NOTES.lowQuality(best.quality));
    if (fmt.mime === 'image/png' && !hasAlpha && opts.format === 'auto' && hasSizeTarget(opts) && (best.scale < 0.999 || out.status === 'above_max' || out.status === 'above_max_fixed')) notes.push(NOTES.pngTryJpeg);
    if (memoryReduced && best.scale >= 0.999) notes.push(NOTES.reduced(best.width, best.height, header.width, header.height));

    const message = buildMessage({
      status: out.status, reason: out.reason, mime: fmt.mime, lossless: !lossy, fixed: geom.fixed, allowEnlarge: !!opts.allowEnlarge,
      minKb: opts.minKb, maxKb: opts.maxKb, lo: win.lo, hi: win.hi, maxEncodes,
      best, gapAbove: out.gapAbove, maxProbe: out.maxQualityProbe,
    });
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
