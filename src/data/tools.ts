// The single list of published tools (FEATURE-012 FR-5). The hub page, the related-tools block and the tests read it.
// Add a tool here once its page exists; the hub and the sitemap pick it up. No URLs to other sites belong in this file.
export type FamilyKey = 'size' | 'signature' | 'convert' | 'social' | 'calculators' | 'text' | 'generators';

export const FAMILIES: Record<FamilyKey, { label: string; blurb: string }> = {
  size: { label: 'Resize a photo to a size in KB', blurb: 'For forms that name a maximum file size.' },
  signature: { label: 'Signatures', blurb: 'Crop to the ink and fit a small limit.' },
  convert: { label: 'Convert, rotate and check', blurb: 'Change a format, fix the direction or test a file before you upload.' },
  social: { label: 'Social images and icons', blurb: 'Sizes for feeds, thumbnails and websites.' },
  text: { label: 'Text tools', blurb: 'Count words and characters, change case or make filler text.' },
  generators: { label: 'Generators', blurb: 'Make a code you can print or share.' },
  calculators: { label: 'Date and time calculators', blurb: 'Work out an age, the days between two dates or a Unix timestamp.' },
};

export interface Tool {
  href: string;
  title: string;
  blurb: string;
  family: FamilyKey;
  /** Hrefs of related tools; when omitted, the other tools of the same family are used. */
  related?: string[];
}

export const TOOLS: Tool[] = [
  { href: '/', title: 'Image resizer', family: 'size', blurb: 'Reduce any photo to the KB limit you choose, with a preview and the real before and after sizes.' },
  { href: '/resize-image-to-20kb/', title: 'Resize to 20 KB', family: 'size', blurb: 'Opens the resizer with 20 KB as the maximum, with tips for keeping faces readable.' },
  { href: '/resize-image-to-50kb/', title: 'Resize to 50 KB', family: 'size', blurb: 'Opens the resizer with 50 KB as the maximum, with advice for portraits versus document scans.' },
  { href: '/resize-image-to-100kb/', title: 'Resize to 100 KB', family: 'size', blurb: 'Opens the resizer with 100 KB as the maximum, for photos that need more detail than 20 KB allows.' },
  { href: '/resize-signature/', title: 'Resize a signature (20 KB)', family: 'signature', blurb: 'Crop a signature to the ink, put it on white and shrink it to your limit.' },
  { href: '/resize-signature-to-10kb/', title: 'Signature to 10 KB', family: 'signature', blurb: 'The signature tool with a 10 KB maximum already set.' },
  { href: '/webp-to-jpg/', title: 'WebP to JPG', family: 'convert', blurb: 'Turn a WebP picture into a JPG, with an optional size limit.', related: ['/png-to-jpg/', '/check-image-size/', '/'] },
  { href: '/avif-jfif-to-jpg/', title: 'AVIF and JFIF to JPG', family: 'convert', blurb: 'Turn an AVIF or JFIF picture into a JPG or PNG in your browser, when a form will not take it.', related: ['/webp-to-jpg/', '/png-to-jpg/', '/'] },
  { href: '/png-to-jpg/', title: 'PNG to JPG', family: 'convert', blurb: 'Turn a PNG into a JPG on a background colour you pick, with an optional size limit.', related: ['/webp-to-jpg/', '/check-image-size/', '/'] },
  { href: '/rotate-image/', title: 'Rotate or flip an image', family: 'convert', blurb: 'Turn a picture the right way up or mirror it, then save it under a size limit.', related: ['/', '/check-image-size/', '/webp-to-jpg/'] },
  { href: '/check-image-size/', title: 'Check an image', family: 'convert', blurb: 'See whether a file passes a size, pixel and format rule before you upload it.', related: ['/', '/rotate-image/', '/resize-image-to-100kb/'] },
  { href: '/instagram-image-resizer/', title: 'Instagram image sizes', family: 'social', blurb: 'Fit a picture to common Instagram post, story and profile shapes.' },
  { href: '/linkedin-image-resizer/', title: 'LinkedIn image sizes', family: 'social', blurb: 'Fit a picture to common LinkedIn profile, banner and post shapes.' },
  { href: '/youtube-thumbnail-resizer/', title: 'YouTube thumbnail resizer', family: 'social', blurb: 'Make a 16:9 thumbnail and keep it under the upload limit.' },
  { href: '/favicon-generator/', title: 'Favicon and app icon generator', family: 'social', blurb: 'Make an ICO, a PNG set, a web manifest and a ZIP from one image.', related: ['/instagram-image-resizer/', '/linkedin-image-resizer/', '/'] },
  { href: '/date-calculators/', title: 'Date and time calculators', family: 'calculators', blurb: 'Age from a date of birth, days between two dates, and Unix timestamps with a time zone.', related: ['/', '/check-image-size/', '/resize-image-to-20kb/'] },
  { href: '/text-tools/', title: 'Word counter, case converter and filler text', family: 'text', blurb: 'Count words and characters as you type, change the case of a text, or make neutral filler text of a set length.', related: ['/date-calculators/', '/', '/check-image-size/'] },
  { href: '/qr-code-generator/', title: 'QR code generator', family: 'generators', blurb: 'Make a QR code for a web address, text or Wi-Fi network and download it as PNG or SVG.', related: ['/text-tools/', '/', '/check-image-size/'] },
  { href: '/signature-maker/', title: 'Signature maker', family: 'signature', blurb: 'Draw or type a signature, save it as a transparent PNG or white JPG, and resize it to a size in KB.' },
  { href: '/text-to-handwriting/', title: 'Text to handwriting', family: 'text', blurb: 'Write typed text out in a handwriting font on plain, ruled or squared paper, one image per page.', related: ['/signature-maker/', '/text-tools/', '/'] },
  { href: '/add-name-date-to-photo/', title: 'Add name and date to a photo', family: 'convert', blurb: 'Put a name and date on a strip under a photo or on the photo, then save a JPG or resize it to a size in KB.', related: ['/', '/rotate-image/', '/check-image-size/'] },
  { href: '/merge-photo-and-signature/', title: 'Merge photo and signature', family: 'signature', blurb: 'Put a photo and a signature on one picture, stacked or side by side, and shrink it to a size limit.', related: ['/resize-signature/', '/signature-maker/', '/'] },
  { href: '/crop-shapes/', title: 'Crop shapes and aspect ratio', family: 'convert', blurb: 'Cut a photo out along a drawn line, round the corners of a square, or change the aspect ratio by cropping or adding a border.', related: ['/', '/rotate-image/', '/resize-signature/'] },
  { href: '/join-images/', title: 'Join images', family: 'convert', blurb: 'Join several pictures into one, side by side, one under another or in a grid, then shrink it to a KB limit.', related: ['/merge-photo-and-signature/', '/', '/crop-shapes/'] },
  { href: '/blur-pixelate-censor/', title: 'Blur, pixelate or black out', family: 'convert', blurb: 'Hide a face, number or text in a photo with a rectangle or brush, then pixelate, blur or black it out.', related: ['/crop-shapes/', '/', '/check-image-size/'] },
  { href: '/photo-effects/', title: 'Photo effects, border and logo', family: 'convert', blurb: 'Turn a photo grayscale, black and white or pixel art, add a border, and place your logo, then resize it to a KB limit.', related: ['/add-name-date-to-photo/', '/', '/crop-shapes/'] },
  { href: '/colour-picker-from-image/', title: 'Colour picker from an image', family: 'convert', blurb: 'Click any spot on a picture to read its colour as HEX, RGB and HSL, then copy it.', related: ['/photo-effects/', '/crop-shapes/', '/'] },
  { href: '/kb-mb-size-converter/', title: 'KB and MB size converter', family: 'size', blurb: 'Convert bytes, KB, MB and GB and see the 1,000 and 1,024 answers side by side.', related: ['/', '/check-image-size/', '/resize-image-to-100kb/'] },
];

const byHref = new Map(TOOLS.map((t) => [t.href, t]));

/** Related tools for a page path; empty (never throws) for unknown paths or when none exist. */
export function relatedTools(href: string): Tool[] {
  const self = byHref.get(href);
  if (!self) return [];
  const hrefs = self.related ?? TOOLS.filter((t) => t.family === self.family).map((t) => t.href);
  const out = hrefs.filter((h) => h !== href && byHref.has(h)).map((h) => byHref.get(h)!);
  if (out.length < 2) for (const t of TOOLS) if (t.href !== href && !out.includes(t) && out.length < 3) out.push(t);
  return out.slice(0, 4);
}

/** Families that have at least one tool, in display order. */
export function toolsByFamily() {
  return (Object.keys(FAMILIES) as FamilyKey[])
    .map((k) => ({ key: k, ...FAMILIES[k], tools: TOOLS.filter((t) => t.family === k) }))
    .filter((g) => g.tools.length > 0);
}
