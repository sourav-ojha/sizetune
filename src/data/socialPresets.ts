/**
 * The ONE list of social image presets (FEATURE-009 FR-4). Edit a preset here and every page updates.
 * A preset is listed only when the platform's own help page states its size. Each names that page (full URLs are in socialSources.ts) and the date it was last read.
 * To update: open the source page, compare the numbers, change them here and set `checkedOn`.
 */
export type PlatformId = 'instagram' | 'linkedin' | 'youtube';
export type SourceId = 'ig-photo' | 'ig-reel' | 'li-profile' | 'li-pages' | 'yt-thumbnails' | 'yt-branding';

export interface Preset {
  id: string;
  platform: PlatformId;
  label: string;
  width: number;
  height: number;
  /** One plain sentence on what the platform says about this size. */
  note: string;
  /** Which source list entry (src/data/socialSources.ts) backs this size, and its short name. No URL here: tool pages must not carry third-party URLs. */
  source: { id: SourceId; name: string };
  /** ISO date the source page was last read. */
  checkedOn: string;
  /** Byte cap the platform publishes, in KB (YouTube thumbnails). Applied as the default maximum size. */
  maxKb?: number;
  /** How the picture is fitted when this size is chosen. Only set where the size is about keeping the whole picture; otherwise the person's choice stays. */
  fit?: 'pad';
}

export const PLATFORMS: Array<{ id: PlatformId; name: string }> = [
  { id: 'instagram', name: 'Instagram' },
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'youtube', name: 'YouTube' },
];

const CHECKED = '2026-11-17';
const IG_PHOTO = { id: 'ig-photo', name: 'Instagram Help Center' } as const;
const IG_REEL = { id: 'ig-reel', name: 'Instagram Help Center' } as const;
const LI_PROFILE = { id: 'li-profile', name: 'LinkedIn Help' } as const;
const LI_PAGES = { id: 'li-pages', name: 'LinkedIn Help' } as const;
const YT = { id: 'yt-thumbnails', name: 'YouTube Help' } as const;
const YT_BRAND = { id: 'yt-branding', name: 'YouTube Help' } as const;

export const PRESETS: Preset[] = [
  { id: 'ig-feed-square', platform: 'instagram', label: 'Feed photo, square', width: 1080, height: 1080, note: 'Photos are kept at a width of 1,080 px, and a square sits inside the supported ratio range.', source: IG_PHOTO, checkedOn: CHECKED },
  { id: 'ig-feed-portrait', platform: 'instagram', label: 'Feed photo, portrait (3:4)', width: 1080, height: 1440, note: 'The tallest ratio the page lists is 3:4, which is 1,080 px wide and 1,440 px high.', source: IG_PHOTO, checkedOn: CHECKED },
  { id: 'ig-feed-landscape', platform: 'instagram', label: 'Feed photo, landscape (1.91:1)', width: 1080, height: 566, note: 'The widest ratio the page lists is 1.91:1, which is 1,080 px wide and 566 px high.', source: IG_PHOTO, checkedOn: CHECKED },
  { id: 'ig-reel-cover', platform: 'instagram', label: 'Reel cover', width: 420, height: 654, note: 'The recommended size for a Reel cover photo is 420 by 654 px, a ratio of 1:1.55.', source: IG_REEL, checkedOn: CHECKED },
  { id: 'ig-feed-nocrop', platform: 'instagram', label: 'Feed photo, whole picture (no crop)', width: 1080, height: 1080, note: 'Keeps your whole picture and places it on a 1,080 px square, with colour bars where it does not fill the frame, so Instagram has nothing to crop. You can still switch to a blurred background.', source: IG_PHOTO, checkedOn: CHECKED, fit: 'pad' },
  { id: 'li-profile-cover', platform: 'linkedin', label: 'Profile cover image', width: 1584, height: 396, note: 'The recommended size is 1584 by 396 px, as a JPG or PNG under 8 MB.', source: LI_PROFILE, checkedOn: CHECKED },
  { id: 'li-company-logo', platform: 'linkedin', label: 'Company Page logo', width: 400, height: 400, note: 'The recommended logo size is 400 by 400 px (minimum 268 by 268), as PNG or JPEG under 3 MB.', source: LI_PAGES, checkedOn: CHECKED },
  { id: 'li-link-image', platform: 'linkedin', label: 'Shared link image', width: 1200, height: 627, note: 'Images attached to a post with a link use a 1.91:1 ratio, 1,200 by 627 px.', source: LI_PAGES, checkedOn: CHECKED },
  { id: 'yt-video-thumb', platform: 'youtube', label: 'Video thumbnail', width: 3840, height: 2160, note: 'Recommended 3840 by 2160 px (16:9), at least 640 px wide. The limit is 2 MB on mobile and 50 MB on desktop, so 2 MB is the default here.', source: YT, checkedOn: CHECKED, maxKb: 2000 },
  { id: 'yt-shorts-thumb', platform: 'youtube', label: 'Shorts thumbnail', width: 2160, height: 3840, note: 'Recommended 2160 by 3840 px (9:16). The same 2 MB mobile and 50 MB desktop limits apply.', source: YT, checkedOn: CHECKED, maxKb: 2000 },
  { id: 'yt-banner', platform: 'youtube', label: 'Channel banner', width: 2560, height: 1440, note: 'Recommended 2560 by 1440 px (16:9, minimum 2048 by 1152), with text and logos inside the safe area of 1235 by 338 px. The file must be 6 MB or smaller. It is cropped on some screens, so keep the key part in the middle.', source: YT_BRAND, checkedOn: '2026-11-19', maxKb: 6000 },
];

export const presetsFor = (platform: PlatformId): Preset[] => PRESETS.filter((p) => p.platform === platform);
