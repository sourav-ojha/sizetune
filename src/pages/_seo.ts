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
  'space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6';
