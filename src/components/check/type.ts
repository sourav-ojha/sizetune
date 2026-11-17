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
    if (ascii(head, 8, 'heic') || ascii(head, 8, 'heix') || ascii(head, 8, 'hevc') || ascii(head, 8, 'mif1')) return { kind: null, label: 'HEIC' };
  }
  if ((head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0) || (head[0] === 0x4d && head[1] === 0x4d && head[2] === 0 && head[3] === 0x2a)) return { kind: null, label: 'TIFF' };
  const text = new TextDecoder().decode(head.subarray(0, 200)).trimStart().toLowerCase();
  if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) return { kind: null, label: 'SVG' };
  return { kind: null, label: 'Unknown' };
}
