import { zipSync, type Zippable } from 'fflate';

export interface ZipFile { name: string; data: Uint8Array }

/** Keeps only the last path segment, so a file name cannot place itself outside the archive's top folder. */
const base = (n: string): string => n.split(/[\\/]/).pop() || 'file';

/** Safe, unique names for a batch: duplicates get -2, -3 ... before the extension. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const name = base(raw);
    const n = (seen.get(name.toLowerCase()) ?? 0) + 1;
    seen.set(name.toLowerCase(), n);
    if (n === 1) return name;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)}-${n}${name.slice(dot)}` : `${name}-${n}`;
  });
}

/** One ZIP, stored without compression (the pictures inside are already compressed). Synchronous: no worker is created. */
export function makeZip(files: ZipFile[]): Uint8Array {
  const z: Zippable = {};
  for (const f of files) z[f.name] = [f.data, { level: 0 }];
  return zipSync(z);
}
