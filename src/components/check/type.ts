import { sniffImage, type SniffKind } from '../tool/sniff';

export interface RealType { kind: SniffKind | null; label: string }

const ascii = (b: Uint8Array, at: number, s: string): boolean => {
  if (b.length < at + s.length) return false;
  for (let i = 0; i < s.length; i++) if (b[at + i] !== s.charCodeAt(i)) return false;
  return true;
};

/** What the file really is, judged from its first bytes and never from its name. `kind` is set only for formats SizeTune can read. */
export function realType(head: Uint8Array): RealType {
  const s = sniffImage(head);
  if (s.kind) return { kind: s.kind, label: s.kind === 'jpeg' ? 'JPEG' : s.kind === 'png' ? 'PNG' : 'WebP' };
  if (ascii(head, 0, 'GIF87a') || ascii(head, 0, 'GIF89a')) return { kind: null, label: 'GIF' };
  if (ascii(head, 0, '%PDF')) return { kind: null, label: 'PDF' };
  if (ascii(head, 0, 'BM')) return { kind: null, label: 'BMP' };
  if (ascii(head, 4, 'ftyp')) {
    if (ascii(head, 8, 'avif') || ascii(head, 8, 'avis')) return { kind: null, label: 'AVIF' };
    if (ascii(head, 8, 'heic') || ascii(head, 8, 'heix') || ascii(head, 8, 'hevc')) return { kind: null, label: 'HEIC' };
    if (ascii(head, 8, 'mif1') || ascii(head, 8, 'msf1')) return { kind: null, label: 'HEIC or AVIF' }; // a generic image-file brand used by both
  }
  if ((head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0) || (head[0] === 0x4d && head[1] === 0x4d && head[2] === 0 && head[3] === 0x2a)) return { kind: null, label: 'TIFF' };
  const text = new TextDecoder().decode(head.subarray(0, 200)).trimStart().toLowerCase();
  if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) return { kind: null, label: 'SVG' };
  return { kind: null, label: 'Unknown' };
}

const EXT_LABEL: Record<string, string> = {
  jpg: 'JPEG', jpeg: 'JPEG', jpe: 'JPEG', jfif: 'JPEG', png: 'PNG', webp: 'WebP', gif: 'GIF', bmp: 'BMP', pdf: 'PDF',
  heic: 'HEIC', heif: 'HEIC', avif: 'AVIF', tif: 'TIFF', tiff: 'TIFF', svg: 'SVG',
};

/** A warning when the file name's ending disagrees with the real contents, or null. Unknown endings and no ending never warn. */
export function nameMismatch(ext: string, rt: RealType): string | null {
  const named = EXT_LABEL[ext.toLowerCase()];
  if (!named) return null;
  const ok = named === rt.label || (rt.label === 'HEIC or AVIF' && (named === 'HEIC' || named === 'AVIF'));
  if (ok) return null;
  return `The name ends in .${ext.toLowerCase()}, but the contents are ${rt.label === 'Unknown' ? 'not a format SizeTune recognises' : rt.label}. A portal that checks the contents may reject it.`;
}
