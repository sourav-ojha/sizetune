// Generates public/og-default.png (1200x630) from an inline SVG using sharp. No external assets or fonts.
// Usage: node scripts/gen-og.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og-default.png');
const font = "font-family=\"Helvetica, Arial, 'DejaVu Sans', sans-serif\"";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f8fafc"/>
  <rect x="0" y="0" width="16" height="630" fill="#0f172a"/>
  <text x="80" y="130" ${font} font-size="40" font-weight="700" fill="#0f172a">SizeTune</text>
  <text x="80" y="290" ${font} font-size="84" font-weight="700" fill="#0f172a">Resize an image</text>
  <text x="80" y="390" ${font} font-size="84" font-weight="700" fill="#0f172a">to a size in KB</text>
  <text x="80" y="470" ${font} font-size="36" fill="#334155">Photos and signatures, processed in your browser.</text>
  <rect x="80" y="520" width="150" height="56" rx="12" fill="#0f172a"/>
  <text x="155" y="559" ${font} font-size="30" font-weight="700" fill="#f8fafc" text-anchor="middle">20 KB</text>
  <rect x="250" y="520" width="150" height="56" rx="12" fill="#e2e8f0"/>
  <text x="325" y="559" ${font} font-size="30" font-weight="700" fill="#0f172a" text-anchor="middle">50 KB</text>
  <rect x="420" y="520" width="150" height="56" rx="12" fill="#e2e8f0"/>
  <text x="495" y="559" ${font} font-size="30" font-weight="700" fill="#0f172a" text-anchor="middle">100 KB</text>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile(out);
console.log('wrote', out);
