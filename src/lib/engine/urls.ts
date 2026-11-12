/**
 * Object URLs are the UI's job; the engine never creates any. This helper holds at most ONE URL and revokes the previous
 * one whenever a new blob is shown, and on `revoke()` (call it on unmount / new file).
 */
export interface ObjectUrlSlot { set(blob: Blob): string; revoke(): void; readonly current: string | null }

export function createObjectUrlSlot(): ObjectUrlSlot {
  let url: string | null = null;
  return {
    set(blob) {
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      return url;
    },
    revoke() {
      if (url) URL.revokeObjectURL(url);
      url = null;
    },
    get current() { return url; },
  };
}

/** File name for downloads matching the VERIFIED output type. */
export function outputFileName(base: string, mime: string): string {
  const stem = base.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'image';
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return `${stem}-sizetune.${ext}`;
}
