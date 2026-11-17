// Shared JSON-LD builders (underscore prefix: not a route).
const SITE = 'https://sizetune.com';

export function webApplicationLd(name: string, path: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    url: SITE + path,
    description,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}

export const publisherLd = { '@type': 'Organization', name: 'SizeTune', url: SITE + '/' };

/** Wrapper class for long-form copy (Tailwind utilities only; no inline styles). */
export const proseClass =
  'space-y-4 text-[1.0625rem] leading-relaxed text-slate-700 [&_h2]:mt-12 [&_h2]:border-t [&_h2]:border-slate-200 [&_h2]:pt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-950 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900 [&_a]:font-medium [&_a]:text-teal-800 [&_a]:underline [&_a]:decoration-teal-300 [&_a]:underline-offset-4 hover:[&_a]:decoration-teal-700 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-6 [&_li]:marker:text-teal-700 [&_strong]:text-slate-900';

export interface Crumb { name: string; href: string }

/** Breadcrumb trail for an indexable page: Home > section > page. Empty for the home page. */
export function breadcrumbTrail(path: string, title: string, tools: { href: string; title: string }[]): Crumb[] {
  if (path === '/') return [];
  const home: Crumb = { name: 'Home', href: '/' };
  const own = title.replace(/\s*\|\s*SizeTune$/, '');
  if (path === '/tools/') return [home, { name: 'All tools', href: '/tools/' }];
  if (path === '/guides/') return [home, { name: 'Guides', href: '/guides/' }];
  if (path.startsWith('/guides/')) return [home, { name: 'Guides', href: '/guides/' }, { name: own, href: path }];
  const tool = tools.find((t) => t.href === path);
  if (tool) return [home, { name: 'All tools', href: '/tools/' }, { name: tool.title, href: path }];
  return [home, { name: own, href: path }];
}

export function breadcrumbLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.href })),
  };
}

/** Site-level entity markup for the home page. */
export const websiteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'SizeTune',
  url: SITE + '/',
  inLanguage: 'en',
  publisher: publisherLd,
};
