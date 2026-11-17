import type { IconSourceId } from './iconSets';

/** Official pages the icon sizes come from. Imported only by server-rendered components: tool pages must not carry third-party URLs. */
export const ICON_SOURCES: Record<IconSourceId, { title: string; url: string; read: string }> = {
  'google-favicon': { title: 'Google Search Central: define a favicon to show in search results', url: 'https://developers.google.com/search/docs/appearance/favicon-in-search', read: 'The favicon must be square, at least 8 by 8 px, and Google recommends larger than 48 by 48 px. ICO and PNG are among the supported formats.' },
  'mdn-icons': { title: 'MDN Web Docs: the icons member of a web app manifest', url: 'https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons', read: 'Lists the sizes, type and purpose fields of manifest icons, and the purpose values monochrome, maskable and any.' },
  'web-dev-manifest': { title: 'web.dev: add a web app manifest', url: 'https://web.dev/articles/add-manifest', read: 'Chromium needs at least a 192 by 192 px and a 512 by 512 px icon, and each manifest icon needs src, sizes and type.' },
  'android-adaptive': { title: 'Android Developers: adaptive icons', url: 'https://developer.android.com/develop/ui/views/launch/icon_design_adaptive', read: 'Layers are 108 by 108 dp, and the safe zone that is never clipped is 66 by 66 dp in the centre.' },
  'google-play-icon': { title: 'Android Developers: Google Play icon design specifications', url: 'https://developer.android.com/distribute/google-play/resources/icon-design-specifications', read: 'A 512 by 512 px, 32-bit PNG up to 1,024 KB, as a full square without rounded corners, preferably without transparency.' },
  'apple-hig': { title: 'Apple Human Interface Guidelines: app icons', url: 'https://developer.apple.com/design/human-interface-guidelines/app-icons', read: 'iOS, iPadOS and macOS app icons are 1,024 by 1,024 px, and the system scales smaller variants. The newest change-log entry is dated October 28, 2026.' },
};
