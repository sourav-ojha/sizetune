export interface ManifestIcon { src: string; sizes: string; type: string; purpose?: string }
export interface ManifestInput { name: string; backgroundColor: string; icons: ManifestIcon[] }

/** A web app manifest. JSON.stringify does the escaping, so any name is safe. */
export function buildManifest({ name, backgroundColor, icons }: ManifestInput): string {
  const trimmed = name.trim() || 'My app';
  return JSON.stringify({
    name: trimmed,
    short_name: trimmed.length <= 12 ? trimmed : trimmed.slice(0, 12).trim(),
    start_url: '/',
    display: 'standalone',
    background_color: backgroundColor,
    theme_color: backgroundColor,
    icons,
  }, null, 2) + '\n';
}
