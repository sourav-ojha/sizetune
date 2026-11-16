# Remediation evidence (fix/audit-remediation)

- ST-010: `st010-before.png` / `st010-after.png`, Playwright WebKit, /resize-signature/. Select heights before 26 / 26 px, after 44 / 44 px (`AUDIT/tmp-remediation/webkit-select.mjs`, scratch, not committed).
- ST-013: desktop 1280x800 home CLS, 4 runs each, Chrome PerformanceObserver. Before 0.0157 0.0498 0.0498 0.0498; after (metric-matched fallback face) 0.0002 x4. A `<link rel=preload>` also gave 0.0000 but verify:privacy forbids a preload before Astro's CSP meta, so it was dropped.
- ST-004: Playwright route appends `import('https://example.com/probe.js')` to the worker script. Old header `connect-src 'none'`: 1 outbound request. New header: 0 outbound requests; tool still produces results (e2e green).
