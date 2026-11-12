/** True when any pixel is not fully opaque. Pure: takes RGBA bytes. */
export function hasTransparentPixel(rgba: Uint8ClampedArray | Uint8Array): boolean {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 255) return true;
  return false;
}

/**
 * Looks at an already-decoded preview <img> (downscaled to ~1 MP, like the engine does) to see whether it really has transparent pixels.
 * A PNG header only says an alpha CHANNEL exists, which is true for many fully opaque screenshots. On failure we assume transparency
 * (the safe direction: the UI then asks before flattening).
 */
export function probeAlpha(img: HTMLImageElement): boolean {
  try {
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!(w0 > 0 && h0 > 0)) return true;
    const k = Math.min(1, Math.sqrt(1_000_000 / (w0 * h0)));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return true;
    ctx.drawImage(img, 0, 0, w, h);
    const found = hasTransparentPixel(ctx.getImageData(0, 0, w, h).data);
    c.width = 0; c.height = 0;
    return found;
  } catch {
    return true;
  }
}
