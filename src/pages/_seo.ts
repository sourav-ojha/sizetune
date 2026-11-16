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
