/**
 * Files each icon mode produces (FEATURE-010). One list; the tool, the snippet and the sources guide all read it.
 * `source.type` is honest: 'official' means a platform page we read states it; 'convention' means common practice with no official page read.
 * Full URLs are in iconSources.ts, which only the sources guide imports: tool pages must not carry third-party URLs.
 */
export type IconSourceId = 'google-favicon' | 'mdn-icons' | 'web-dev-manifest' | 'android-adaptive' | 'google-play-icon' | 'apple-hig';
export type IconMode = 'favicon' | 'app';

export interface IconFile {
  mode: IconMode;
  file: string;
  /** Side in pixels; for the ICO the largest image. 0 for the manifest. */
  size: number;
  kind: 'png' | 'ico' | 'manifest';
  /** ICO only: the sizes packed inside. */
  ico?: number[];
  /** Fill transparent areas with the chosen colour (the store icon and maskable icon must be opaque). */
  opaque?: boolean;
  /** Logo is scaled into the safe zone (66 of 108, from Android's adaptive icon guidance) on a full-bleed background. */
  maskable?: boolean;
  source: { id: IconSourceId; name: string; type: 'official' | 'convention' };
  note: string;
}

export const ICON_MODES: Array<{ id: IconMode; label: string; blurb: string }> = [
  { id: 'favicon', label: 'Favicon', blurb: 'For the browser tab, bookmarks and search results.' },
  { id: 'app', label: 'App icon', blurb: 'For installable web apps (PWA), Android, the Play Store and Apple.' },
];

export const ICON_FILES: IconFile[] = [
  { mode: 'favicon', file: 'favicon.ico', size: 48, kind: 'ico', ico: [16, 32, 48], source: { id: 'google-favicon', name: 'Google Search Central', type: 'official' }, note: 'ICO is a supported favicon format. The 16, 32 and 48 px images inside are common practice, not stated by Google.' },
  { mode: 'favicon', file: 'favicon-48x48.png', size: 48, kind: 'png', source: { id: 'mdn-icons', name: 'MDN Web Docs', type: 'official' }, note: '48 by 48 px is a common size for tabs and bookmarks, and it is the size Google says to go above.' },
  { mode: 'favicon', file: 'favicon-96x96.png', size: 96, kind: 'png', source: { id: 'google-favicon', name: 'Google Search Central', type: 'official' }, note: 'Google recommends a favicon larger than 48 by 48 px, and requires it to be square.' },
  { mode: 'app', file: 'icon-192.png', size: 192, kind: 'png', source: { id: 'web-dev-manifest', name: 'web.dev', type: 'official' }, note: 'Chromium needs at least a 192 by 192 px and a 512 by 512 px icon for an installable web app.' },
  { mode: 'app', file: 'icon-512.png', size: 512, kind: 'png', source: { id: 'web-dev-manifest', name: 'web.dev', type: 'official' }, note: 'The 512 by 512 px icon is the second one Chromium requires.' },
  { mode: 'app', file: 'icon-maskable-512.png', size: 512, kind: 'png', opaque: true, maskable: true, source: { id: 'android-adaptive', name: 'Android Developers', type: 'official' }, note: 'A maskable icon (purpose "maskable"). The logo is scaled to sit inside a central circle on a full-bleed background, so a circular mask does not clip a square logo. Android keeps adaptive icon logos inside the middle 66 of 108; this is a little tighter.' },
  { mode: 'app', file: 'play-store-512.png', size: 512, kind: 'png', opaque: true, source: { id: 'google-play-icon', name: 'Google Play icon specifications', type: 'official' }, note: 'Google Play asks for a 512 by 512 px PNG up to 1,024 KB, a full square with no rounded corners, and prefers a background colour to transparency, so this one is opaque.' },
  { mode: 'app', file: 'apple-1024.png', size: 1024, kind: 'png', opaque: true, source: { id: 'apple-hig', name: 'Apple Human Interface Guidelines', type: 'official' }, note: 'Apple specifies 1,024 by 1,024 px for iOS, iPadOS and macOS app icons and scales smaller sizes itself. The system applies the rounded mask.' },
  { mode: 'app', file: 'apple-touch-icon.png', size: 180, kind: 'png', opaque: true, source: { id: 'apple-hig', name: 'Apple Human Interface Guidelines', type: 'convention' }, note: 'A 180 by 180 px icon is the common size for a website added to an iPhone home screen. No official page we read states that size.' },
  { mode: 'app', file: 'site.webmanifest', size: 0, kind: 'manifest', source: { id: 'web-dev-manifest', name: 'web.dev', type: 'official' }, note: 'A web app manifest listing the icons, with the sizes and types web.dev says each icon needs.' },
];

export const filesFor = (mode: IconMode): IconFile[] => ICON_FILES.filter((f) => f.mode === mode);
