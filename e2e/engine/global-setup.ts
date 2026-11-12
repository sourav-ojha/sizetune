import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const BUNDLE_DIR = path.join(ROOT, '.tmp/engine-e2e'); // .tmp/ is git-ignored

/** Bundle the engine (page module + worker module) with the esbuild that vite already depends on. */
export default async function globalSetup() {
  const require = createRequire(path.join(ROOT, 'package.json'));
  const esbuild = require('esbuild') as typeof import('esbuild');
  fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });
  fs.mkdirSync(BUNDLE_DIR, { recursive: true });
  const common = { bundle: true, format: 'esm' as const, target: 'es2022', sourcemap: false, logLevel: 'warning' as const, minify: false };
  await esbuild.build({ ...common, entryPoints: [path.join(ROOT, 'src/lib/engine/index.ts')], outfile: path.join(BUNDLE_DIR, 'engine.js') });
  await esbuild.build({ ...common, entryPoints: [path.join(ROOT, 'src/lib/engine/compress.worker.ts')], outfile: path.join(BUNDLE_DIR, 'worker-real.js') });
  if (!fs.existsSync(path.join(ROOT, 'tests/fixtures/exif6-gps.jpg')) || !fs.existsSync(path.join(ROOT, 'tests/fixtures/.generated/photo-12mp.jpg'))) {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/gen-fixtures.mjs')], { stdio: 'inherit' });
  }
}
