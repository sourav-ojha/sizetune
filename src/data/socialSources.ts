import type { SourceId } from './socialPresets';

/**
 * Official pages the presets come from. Kept apart from socialPresets.ts on purpose: the tool bundle imports the presets, and tool pages
 * must not carry third-party URLs (scripts/verify-privacy.mjs). Only the sources guide page imports this file.
 */
export const SOURCES: Record<SourceId, { title: string; url: string }> = {
  'ig-photo': { title: 'Instagram Help: image resolution of photos you share on Instagram', url: 'https://help.instagram.com/1631821640426723/' },
  'ig-reel': { title: 'Instagram Help: Reel size and aspect ratios on Instagram', url: 'https://help.instagram.com/1038071743007909/' },
  'li-profile': { title: 'LinkedIn Help: add or change the cover image on your profile', url: 'https://www.linkedin.com/help/linkedin/answer/a568217/add-or-change-the-background-photo-on-your-profile' },
  'li-pages': { title: 'LinkedIn Help: image specifications for your LinkedIn Pages and Career Pages', url: 'https://www.linkedin.com/help/linkedin/answer/a563309/image-specifications-for-your-linkedin-pages-and-career-pages' },
  'yt-thumbnails': { title: 'YouTube Help: add custom thumbnails on YouTube', url: 'https://support.google.com/youtube/answer/72431' },
  'yt-branding': { title: 'YouTube Help: manage your channel branding (banner image guidelines)', url: 'https://support.google.com/youtube/answer/10456525' },
};
