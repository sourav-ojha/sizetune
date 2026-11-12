/**
 * Size-target search (compression-review §7, ADR D11). Pure: the encoder is injected, so this runs in a worker, on the
 * main thread, or under test with fake encoders.
 *
 * - Byte window [lo, hi] (see window.ts). Success (ok/raised) is ONLY reported for a candidate whose real size is in the window.
 * - Integer quality bisect (browsers quantise quality to whole percent), continuous scale search (no ladder), no q=0.05 last resort.
 * - Phase A: fixed dims (q95 -> q40 -> bisect). Phase B: scale search at q60, then q refine. Minimum: q95 -> q100 raise,
 *   optional enlarge (more pixels) only when dims are free and allowed. q below 40 only at the floor (fixed dims or 64 px side).
 * - Every candidate is remembered; the final pick is made from all of them, so a non-monotone encoder cannot cause a false claim.
 */
import type { ResultStatus, Strategy } from './types';

export interface SearchParams {
  baseWidth: number;
  baseHeight: number;
  /** User fixed the output dimensions: never change pixels. */
  fixed: boolean;
  /** JPEG/WebP (true) or PNG (false: pixels are the only knob). */
  lossy: boolean;
  lo: number;
  hi: number;
  hasTarget: boolean;
  strategy: Strategy;
  maxEncodes: number;
  /** Free-dimension floor: the shorter side never goes below this (unless the base is already smaller). */
  minSide: number;
  /** Quality for "no target" and for dimensions-first (default 85). */
  fixedQuality?: number;
  allowEnlarge?: boolean;
  maxEnlargePixels?: number;
}

export interface Candidate<B> {
  width: number;
  height: number;
  quality: number | null;
  bytes: number;
  blob: B;
  scale: number;
  /** Produced while raising quality/pixels to reach the minimum. */
  raised: boolean;
  enlarged: boolean;
}

/** Candidate metadata without the encoded bytes. */
export type CandidateInfo = Omit<Candidate<unknown>, 'blob'>;
/** Internal: the Blob is dropped (null) as soon as the candidate can no longer be the result. */
type Cand<B> = CandidateInfo & { blob: B | undefined; released: boolean };

export type SearchEncoder<B> = (width: number, height: number, quality: number | null) => Promise<{ blob: B; bytes: number }>;

export type OutcomeReason = 'no_target' | 'in_window' | 'min_unreachable' | 'window_gap' | 'max_unreachable' | 'budget_exhausted';

export interface SearchOutcome<B> {
  status: ResultStatus;
  reason: OutcomeReason;
  best: Candidate<B>;
  attempts: number;
  /** For window_gap: the smallest candidate above the maximum (metadata only). */
  gapAbove?: CandidateInfo;
  /** Highest-quality result at full (non-enlarged) dimensions, if probed (for "at most X KB even at maximum quality"). */
  maxQualityProbe?: CandidateInfo;
  /** Every encode performed (metadata only: Blobs of rejected candidates are released during the search). */
  candidates: CandidateInfo[];
  /** Most candidate Blobs held at once (memory diagnostics; <= 3 retained + the one just encoded). */
  peakRetained: number;
}

export const Q_CAP = 95;
export const Q_MIN = 40;
export const Q_SCALE = 60;
export const DEFAULT_QUALITY = 85;
const FILL = 0.94;
const MAX_ENLARGE = 4;

class BudgetExhausted extends Error {}

interface Tag { raised?: boolean }

class Search<B> {
  attempts = 0;
  exhausted = false;
  readonly cands: Cand<B>[] = [];
  private readonly cache = new Map<string, Cand<B>>();
  maxProbe?: Cand<B>;
  peakRetained = 0;
  private readonly minScale: number;

  constructor(private readonly p: SearchParams, private readonly encode: SearchEncoder<B>) {
    this.minScale = Math.min(1, p.minSide / Math.min(p.baseWidth, p.baseHeight));
  }

  private dims(s: number): [number, number] {
    return [Math.max(1, Math.round(this.p.baseWidth * s)), Math.max(1, Math.round(this.p.baseHeight * s))];
  }

  private async E(s: number, q: number | null, tag: Tag = {}): Promise<Cand<B>> {
    const [w, h] = this.dims(s);
    const key = `${w}x${h}@${q}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    if (this.attempts >= this.p.maxEncodes) throw new BudgetExhausted();
    this.attempts++;
    const r = await this.encode(w, h, q);
    const c: Cand<B> = { width: w, height: h, quality: q, bytes: r.bytes, blob: r.blob, scale: s, raised: !!tag.raised, enlarged: s > 1 && (w > this.p.baseWidth || h > this.p.baseHeight), released: false };
    this.cache.set(key, c);
    this.cands.push(c);
    this.peakRetained = Math.max(this.peakRetained, this.cands.filter((x) => !x.released).length);
    this.prune();
    return c;
  }

  /** The three candidates that can still become the result; everything else drops its Blob. */
  private picks() {
    const { hi } = this.p;
    let win: Cand<B> | undefined, fit: Cand<B> | undefined, above: Cand<B> | undefined;
    const normalWin = this.cands.filter((c) => this.inWin(c) && !c.raised);
    const raisedWin = this.cands.filter((c) => this.inWin(c) && c.raised);
    if (normalWin.length) win = normalWin.reduce((a, c) => (rank(c) > rank(a) ? c : a));
    else if (raisedWin.length) win = raisedWin.reduce((a, c) => (raiseRank(c) > raiseRank(a) ? c : a));
    for (const c of this.cands) {
      if (c.bytes <= hi) { if (!fit || c.bytes > fit.bytes) fit = c; } else if (!above || c.bytes < above.bytes) above = c;
    }
    return { win, fit, above };
  }

  private prune() {
    const { win, fit, above } = this.picks();
    for (const c of this.cands) if (c !== win && c !== fit && c !== above && !c.released) { c.blob = undefined; c.released = true; }
  }

  private inWin = (c: CandidateInfo) => c.bytes >= this.p.lo && c.bytes <= this.p.hi;
  private good = (c: CandidateInfo) => this.inWin(c) && (!Number.isFinite(this.p.hi) || c.bytes >= FILL * this.p.hi);
  private target() { return Math.max(this.p.hi * 0.97, (this.p.lo + this.p.hi) / 2); }

  async run(): Promise<void> {
    const p = this.p;
    if (!p.hasTarget) { await this.E(1, p.lossy ? p.fixedQuality ?? DEFAULT_QUALITY : null); return; }
    if (!p.lossy) return this.lossless();
    if (p.strategy === 'dimensions-first' && !p.fixed) return this.dimensionsFirst();
    return this.qualityFirst();
  }

  private async qualityFirst() {
    const { hi, lo, fixed } = this.p;
    const top = await this.E(1, Q_CAP);
    if (top.bytes <= hi) {
      if (top.bytes >= lo) return;
      return this.raise(Q_CAP);
    }
    const low = await this.E(1, Q_MIN);
    if (low.bytes <= hi) {
      const best = await this.bisectHighestQ(1, Q_MIN, Q_CAP);
      if (best.bytes >= lo || fixed) return; // fixed + gap: nothing honest left to try
      // window gap between two quality steps: with free dims, shrink the next step slightly into the window
      return this.scaleSearch((best.quality as number) + 1, false);
    }
    if (fixed) return this.floorQuality(1, Q_MIN);
    return this.scaleSearch(Q_SCALE, true);
  }

  private async dimensionsFirst() {
    const q = this.p.fixedQuality ?? DEFAULT_QUALITY;
    const c = await this.E(1, q);
    if (c.bytes <= this.p.hi) {
      if (c.bytes >= this.p.lo) return;
      return this.raise(q);
    }
    return this.scaleSearch(q, false);
  }

  private async lossless() {
    const c = await this.E(1, null);
    if (c.bytes <= this.p.hi) {
      if (c.bytes >= this.p.lo) return;
      this.maxProbe = c;
      if (this.p.allowEnlarge && !this.p.fixed) await this.enlarge(null);
      return;
    }
    if (this.p.fixed) return;
    return this.scaleSearch(null, false);
  }

  /** Highest q in [qFit, qNoFit) with bytes <= hi (qFit known to fit). */
  private async bisectHighestQ(s: number, qFit: number, qNoFit: number): Promise<Cand<B>> {
    let a = qFit, b = qNoFit;
    let best = await this.E(s, a);
    while (b - a > 1) {
      const m = (a + b) >> 1;
      const c = await this.E(s, m);
      if (c.bytes <= this.p.hi) { a = m; best = c; } else b = m;
    }
    return best;
  }

  /** At the floor (fixed dims, or 64 px side) go below q40 if that is the only way under the max. */
  private async floorQuality(s: number, qNoFit: number) {
    if (!this.p.lossy) return;
    const c1 = await this.E(s, 1);
    if (c1.bytes > this.p.hi) return;
    await this.bisectHighestQ(s, 1, qNoFit);
  }

  /** Minimum not reached at qBase (full dims): raise quality to <= 100, then (if allowed) add pixels. */
  private async raise(qBase: number) {
    const { lo, hi } = this.p;
    const max = await this.E(1, 100, { raised: true });
    if (max.bytes < lo) {
      this.maxProbe = max;
      if (this.p.allowEnlarge && !this.p.fixed) await this.enlarge(100);
      return;
    }
    // D11 step 5: the LOWEST q in (qBase, 100] whose size reaches lo (smallest honest raise); accept if <= hi.
    let a = qBase, b = 100;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      const c = await this.E(1, m, { raised: true });
      if (c.bytes >= lo) b = m; else a = m;
    }
    const lowest = await this.E(1, b, { raised: true });
    if (lowest.bytes <= hi) return;
    if (!this.p.fixed) return this.scaleSearch(b, false, { raised: true });
  }

  /** More pixels than the base (only with allowEnlarge and free dims). */
  private async enlarge(q: number | null) {
    const { lo, hi } = this.p;
    const sMax = Math.min(MAX_ENLARGE, Math.sqrt((this.p.maxEnlargePixels ?? 0) / (this.p.baseWidth * this.p.baseHeight)));
    if (!(sMax > 1.001)) return;
    const T = Number.isFinite(hi) ? Math.min(lo * 1.05, (lo + hi) / 2) : lo * 1.05;
    let aS = 1, aB = (await this.E(1, q, { raised: true })).bytes;
    let bS: number | null = null, bB = 0;
    for (let it = 0; it < 8; it++) {
      let s: number = bS === null ? aS * Math.sqrt(T / aB) * 1.02 : this.interp(aS, aB, bS, bB, T);
      s = Math.min(sMax, s);
      if (this.sameDims(s, aS) || (bS !== null && this.sameDims(s, bS))) break;
      const c = await this.E(s, q, { raised: true });
      if (this.inWin(c)) return;
      if (c.bytes < lo) { aS = s; aB = c.bytes; if (s >= sMax) return; } else { bS = s; bB = c.bytes; }
    }
  }

  private sameDims(a: number, b: number) {
    const [w1, h1] = this.dims(a), [w2, h2] = this.dims(b);
    return w1 === w2 && h1 === h2;
  }

  /** Log-space interpolation between (s1,b1) and (s2,b2) for target T, kept strictly inside the bracket. */
  private interp(s1: number, b1: number, s2: number, b2: number, T: number) {
    const lo = Math.min(s1, s2), hiS = Math.max(s1, s2);
    let k = Math.log(b2 / b1) / Math.log(s2 / s1);
    if (!Number.isFinite(k) || k <= 0.2) k = 1.9;
    let s = s1 * Math.pow(T / b1, 1 / k);
    const span = hiS - lo;
    if (!Number.isFinite(s)) s = (lo + hiS) / 2;
    return Math.min(hiS - span * 0.08, Math.max(lo + span * 0.08, s));
  }

  /**
   * Largest scale in [minScale, 1) whose size at quality q lies in the window, given that scale 1 at q is above hi.
   * Secant steps on log(bytes) vs log(scale), safeguarded to keep shrinking the bracket.
   */
  private async scaleSearch(q: number | null, refine: boolean, tag: Tag = {}) {
    const { hi, lo } = this.p;
    if (this.minScale >= 1) return this.floorQuality(1, q ?? Q_MIN);
    let hiS = 1;
    let hiB = (await this.E(1, q, tag)).bytes;
    if (hiB <= hi) return;
    let loS: number | null = null, loB = 0;
    const T = this.target();
    for (let it = 0; it < 12; it++) {
      let s: number;
      if (loS === null) {
        s = Math.max(this.minScale, Math.min(hiS * 0.995, hiS * Math.pow(T / hiB, 1 / 1.9)));
        if (this.sameDims(s, hiS)) break;
      } else {
        s = this.interp(loS, loB, hiS, hiB, T);
        if (this.sameDims(s, loS) || this.sameDims(s, hiS)) break;
      }
      const c = await this.E(s, q, tag);
      if (c.bytes > hi) {
        hiS = s; hiB = c.bytes;
        if (s <= this.minScale) return this.floorQuality(this.minScale, q ?? Q_MIN);
      } else {
        loS = s; loB = c.bytes;
        if (c.bytes >= lo && this.good(c)) break;
      }
      if (loS !== null && (hiS - loS) / hiS < 0.002) break;
    }
    if (refine && loS !== null && q !== null && q < Q_CAP) {
      const at = await this.E(loS, q, tag);
      if (!this.good(at)) await this.bisectHighestQ(loS, q, Q_CAP);
    }
  }

  finalize(): SearchOutcome<B> {
    const { fixed } = this.p;
    if (!this.cands.length) throw new Error('search produced no candidate'); // only if maxEncodes < 1
    const info = ({ blob: _b, released: _r, ...rest }: Cand<B>): CandidateInfo => rest;
    const withBlob = (c: Cand<B>): Candidate<B> => {
      if (c.released) throw new Error('internal: result Blob was released');
      return { ...info(c), blob: c.blob as B };
    };
    const base = { attempts: this.attempts, candidates: this.cands.map(info), maxQualityProbe: this.maxProbe && info(this.maxProbe), peakRetained: this.peakRetained };
    const { win, fit, above } = this.picks();
    if (win) return { ...base, status: win.raised ? 'raised' : 'ok', reason: this.p.hasTarget ? 'in_window' : 'no_target', best: withBlob(win) };
    const gapAbove = above && info(above);
    if (fit) {
      const reason: OutcomeReason = above ? 'window_gap' : this.exhausted ? 'budget_exhausted' : 'min_unreachable';
      return { ...base, status: 'below_min', reason, best: withBlob(fit), gapAbove };
    }
    return { ...base, status: fixed ? 'above_max_fixed' : 'above_max', reason: this.exhausted ? 'budget_exhausted' : 'max_unreachable', best: withBlob(above as Cand<B>) };
  }
}

/** Preference among in-window candidates: more pixels, then higher quality, then more bytes (closer to max). */
function rank(c: CandidateInfo) {
  return c.width * c.height * 1e6 + (c.quality ?? 0) * 1e3 + Math.min(999, c.bytes / 1e6);
}

/** Among raised candidates: no enlargement first, then most pixels, then LOWEST quality; enlarged ones: fewest pixels. */
function raiseRank(c: CandidateInfo) {
  if (c.enlarged) return -c.width * c.height;
  return 1e15 + c.width * c.height * 1e3 - (c.quality ?? 0);
}

export async function fitSearch<B>(p: SearchParams, encode: SearchEncoder<B>): Promise<SearchOutcome<B>> {
  const s = new Search(p, encode);
  try {
    await s.run();
  } catch (e) {
    if (!(e instanceof BudgetExhausted)) throw e;
    s.exhausted = true;
  }
  return s.finalize();
}
