import type { BrowserContext, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import globalSetup from './global-setup';

export const ORIGIN = 'http://engine.test';
const ROOT = path.resolve(import.meta.dirname, '../..');
const BUNDLE = path.join(ROOT, '.tmp/engine-e2e');
const FIX = path.join(ROOT, 'tests/fixtures');
const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic' };

export interface HarnessOptions {
  /** JS executed in the worker BEFORE the real worker module (e.g. to stub convertToBlob). */
  workerPrelude?: string;
  /** JS executed in the page before the engine loads (addInitScript). */
  pageInit?: string;
}

/** Serve the blank harness page, the engine bundle, the worker and fixtures from a fake origin. Records every request. */
let bundled: Promise<void> | null = null;
export async function openHarness(page: Page, context: BrowserContext, o: HarnessOptions = {}) {
  // Rebuild once per test process so the suite also works under the repo-wide playwright.config.ts (no globalSetup there).
  await (bundled ??= globalSetup());
  const requests: Array<{ method: string; url: string }> = [];
  context.on('request', (r) => requests.push({ method: r.method(), url: r.url() }));
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort(); // nothing may leave the page
    const p = url.pathname;
    const js = (body: string) => route.fulfill({ status: 200, contentType: 'text/javascript', body });
    if (p === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset=utf-8><title>engine harness</title><script type="module" src="/harness.js"></script>' });
    if (p === '/harness.js') return js(fs.readFileSync(path.join(import.meta.dirname, 'harness-page.js'), 'utf8'));
    if (p === '/engine.js') return js(fs.readFileSync(path.join(BUNDLE, 'engine.js'), 'utf8'));
    if (p === '/worker-real.js') return js(fs.readFileSync(path.join(BUNDLE, 'worker-real.js'), 'utf8'));
    if (p === '/worker-prelude.js') return js(o.workerPrelude ?? '');
    // The engine creates `new Worker(new URL('./compress.worker.ts', import.meta.url))`: serve a tiny module that runs the prelude first.
    if (p === '/compress.worker.ts') return js(`import './worker-prelude.js';\nimport './worker-real.js';\n`);
    if (p.startsWith('/fixtures/')) {
      const rel = decodeURIComponent(p.slice('/fixtures/'.length));
      const f = path.join(FIX, rel);
      if (!f.startsWith(FIX) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] ?? 'application/octet-stream', body: fs.readFileSync(f) });
    }
    return route.fulfill({ status: 404, body: 'nf' });
  });
  if (o.pageInit) await page.addInitScript(o.pageInit);
  await page.goto(ORIGIN + '/');
  await page.waitForFunction(() => (window as unknown as { harnessReady?: boolean }).harnessReady === true);
  return { requests };
}

/** Resident memory (MB) of the Chrome process tree launched by Playwright (the browser root has --remote-debugging-pipe). */
export function chromeTreeRssMb(): number {
  const ps = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,command='], { maxBuffer: 1e8 }).toString().split('\n')
    .map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)).filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ pid: +m[1], ppid: +m[2], rss: +m[3], cmd: m[4] }));
  const roots = ps.filter((p) => /Google Chrome/.test(p.cmd) && /--remote-debugging-pipe/.test(p.cmd) && !/--type=/.test(p.cmd));
  const ids = new Set(roots.map((r) => r.pid));
  let grew = true;
  while (grew) { grew = false; for (const p of ps) if (!ids.has(p.pid) && ids.has(p.ppid)) { ids.add(p.pid); grew = true; } }
  return ps.filter((p) => ids.has(p.pid)).reduce((a, p) => a + p.rss, 0) / 1024;
}

export type RunResult = {
  ok: boolean; code?: string; message: string; wallMs: number;
  status: string; bytes: number; blobSize: number; mime: string; width: number; height: number; quality: number | null; attempts: number;
  window: { minBytes: number | null; maxBytes: number | null }; source: { width: number; height: number; hasAlpha: boolean; orientationApplied: boolean; bytes: number; mime: string };
  notes: string[]; mode: string; elapsedMs: number; magic: string; decoded: { w?: number; h?: number; error?: string };
  hasTestCam: boolean; hasModel9: boolean; hasExifApp1: boolean; hasIcc: boolean; originalFits?: boolean;
};

/** Run processImage in the page. `input` is a fixture name or { large: [w, h] } (generated in the page, not committed). */
export async function run(page: Page, input: string | { large: [number, number] }, opts: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<RunResult> {
  return page.evaluate(([input, opts, extra]) => (window as unknown as { run: (i: unknown, o: unknown, e: unknown) => Promise<unknown> }).run(input, opts, extra), [input, opts, extra] as const) as Promise<RunResult>;
}

export const BASE = { format: 'jpeg', strategy: 'quality-first', lockAspect: true, fit: 'contain', background: 'white' };
