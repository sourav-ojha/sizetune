/** Pure display helpers. Sizes are shown as exact bytes plus KB with 1 KB = 1,024 bytes, the same convention as the engine's own messages (limits are applied as max x 1,000 bytes, see describeWindow). */

const nf = new Intl.NumberFormat('en-US');

export const formatInt = (n: number): string => nf.format(Math.round(n));

export const formatBytesExact = (bytes: number): string => `${formatInt(bytes)} bytes`;

/** KB (1,024 bytes) with sensible precision: 18.4 KB, 112 KB, 1.52 MB. */
export function formatKb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  if (bytes < 1024) return `${formatInt(bytes)} bytes`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 100 ? kb.toFixed(1) : formatInt(kb)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** "18.4 KB (18,372 bytes)" – the exact byte count is the truth, the KB figure is the convenience. */
export function formatSize(bytes: number): string {
  return bytes < 1024 ? formatBytesExact(bytes) : `${formatKb(bytes)} (${formatBytesExact(bytes)})`;
}

export const formatDims = (w: number, h: number): string => `${formatInt(w)} × ${formatInt(h)} px`;

/** Honest percentage text: smaller, larger or unchanged. */
export function formatChange(originalBytes: number, outputBytes: number): string {
  if (!(originalBytes > 0)) return '';
  const pct = ((originalBytes - outputBytes) / originalBytes) * 100;
  if (outputBytes === originalBytes) return 'same size as the original';
  if (pct > 0) return pct < 1 ? 'less than 1% smaller than the original' : `${Math.round(pct)}% smaller than the original`;
  const up = -pct;
  return up < 1 ? 'less than 1% larger than the original' : `${Math.round(up)}% larger than the original`;
}

/** Describes the byte window the engine aimed for, e.g. "under 20,000 bytes (20 × 1,000)". */
export function describeWindow(w: { minBytes: number | null; maxBytes: number | null }, minKb?: number, maxKb?: number): string {
  const parts: string[] = [];
  if (w.minBytes != null && w.maxBytes != null) {
    parts.push(`between ${formatInt(w.minBytes)} and ${formatInt(w.maxBytes)} bytes`);
  } else if (w.maxBytes != null) {
    parts.push(`under ${formatInt(w.maxBytes)} bytes`);
  } else if (w.minBytes != null) {
    parts.push(`at least ${formatInt(w.minBytes)} bytes`);
  }
  let basis = '';
  if (maxKb != null && w.maxBytes != null) basis += ` (maximum: ${trimNum(maxKb)} × 1,000 bytes`;
  if (minKb != null && w.minBytes != null) basis += `${basis ? ', ' : ' ('}minimum: ${trimNum(minKb)} × 1,024 bytes`;
  if (basis) basis += ')';
  return parts.length ? `Aimed for ${parts[0]}${basis}` : '';
}

const trimNum = (n: number): string => (Number.isInteger(n) ? formatInt(n) : String(n));

export function extForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    default: return 'img';
  }
}

/** photo.final.HEIC -> "photo.final-sizetune.jpg"; strips paths and unsafe characters; never empty. */
export function suggestFilename(originalName: string, mime: string, suffix = 'sizetune'): string {
  const leaf = originalName.split(/[\\/]/).pop() ?? '';
  const dot = leaf.lastIndexOf('.');
  const stem = dot > 0 ? leaf.slice(0, dot) : leaf;
  const clean = stem
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 60);
  return `${clean || 'image'}-${suffix}.${extForMime(mime)}`;
}

/** Parses the e.g. "#aabbcc" colour; returns lower-case #rrggbb or null. */
export function normalizeHex(v: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

/** Upload cap as people read it in a file manager ("25 MB"). */
export function formatCap(bytes: number): string {
  const mib = bytes / (1024 * 1024);
  return `${Number.isInteger(mib) ? mib : mib.toFixed(1)} MB`;
}
