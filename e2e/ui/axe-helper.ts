import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { Page } from '@playwright/test';

const require = createRequire(import.meta.url);
const AXE_SRC = fs.readFileSync(path.join(path.dirname(require.resolve('axe-core')), 'axe.min.js'), 'utf8');

export interface AxeNode { target: string; html: string; summary: string }
export interface AxeViolation { id: string; impact: string; help: string; nodes: AxeNode[] }

/**
 * Runs axe-core inside the page by EVALUATING its source over CDP (no <script> injection, so the page's CSP is untouched).
 * Rules: WCAG 2.0/2.1/2.2 A+AA and axe best practices, including color-contrast and target-size.
 */
export async function runAxe(page: Page, context?: string): Promise<AxeViolation[]> {
  await page.evaluate(AXE_SRC);
  return page.evaluate(async (ctx) => {
    // @ts-expect-error axe is defined by the evaluated source
    const res = await window.axe.run(ctx ? document.querySelector(ctx) : document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      resultTypes: ['violations'],
    });
    return res.violations.map((v: any) => ({
      id: v.id, impact: v.impact, help: v.help,
      nodes: v.nodes.map((n: any) => ({ target: n.target.join(' '), html: String(n.html).slice(0, 160), summary: String(n.failureSummary).replace(/\s+/g, ' ').slice(0, 220) })),
    }));
  }, context ?? null);
}

/**
 * Justified false positives ONLY. Each entry needs a reason; everything else must be zero.
 * (kept empty unless a finding is proven to be an axe limitation)
 */
export const ALLOW: Array<{ id: string; target?: RegExp; reason: string }> = [];

export function unexpected(v: AxeViolation[]): AxeViolation[] {
  return v
    .map((x) => ({ ...x, nodes: x.nodes.filter((n) => !ALLOW.some((a) => a.id === x.id && (!a.target || a.target.test(n.target)))) }))
    .filter((x) => x.nodes.length > 0);
}

export const format = (v: AxeViolation[]) => v.map((x) => `[${x.impact}] ${x.id}: ${x.help}\n` + x.nodes.slice(0, 6).map((n) => `    ${n.target}\n      ${n.html}\n      ${n.summary}`).join('\n')).join('\n');
