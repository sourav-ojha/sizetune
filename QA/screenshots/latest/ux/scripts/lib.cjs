const { createRequire } = require('module');
const REPO = '/Users/sourav/workspace/personal/automated-niche-website-discovery/sizetune';
const req = createRequire(REPO + '/package.json');
const pw = req('@playwright/test');
const fs = require('fs'); const path = require('path');
const AXE = fs.readFileSync(path.join(path.dirname(req.resolve('axe-core')), 'axe.min.js'), 'utf8');
const BASE = 'https://sizetune-staging.subhamojha9.workers.dev';
const ROUTES = ['/', '/resize-image-to-20kb/', '/resize-signature/', '/guides/photo-size-for-online-forms/', '/about/', '/privacy/', '/terms/'];
const SHOTS = REPO + '/QA/screenshots/latest/ux';
const FIX = REPO + '/tests/fixtures';
const OUT = __dirname + '/out';
const slug = (r) => r === '/' ? 'home' : r.replace(/^\/|\/$/g, '').replace(/\//g, '_');
async function launch(name = 'chromium') {
  const t = pw[name];
  const opts = name === 'chromium' ? { channel: 'chrome' } : {};
  return t.launch(opts);
}
async function axe(page, ctx) {
  await page.evaluate(AXE);
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] }, resultTypes: ['violations','incomplete'] });
    const m = (a) => a.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0,6).map(n => ({ t: n.target.join(' '), h: String(n.html).slice(0,140), s: String(n.failureSummary).replace(/\s+/g,' ').slice(0,200) })), count: v.nodes.length }));
    return { violations: m(r.violations), incomplete: m(r.incomplete) };
  });
}
module.exports = { pw, req, fs, path, AXE, BASE, ROUTES, SHOTS, FIX, OUT, slug, launch, axe, REPO };
module.exports.INIT = `
window.__lt=[];window.__cls=0;window.__lcp=null;window.__gaps=[];window.__events=[];
try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push({s:Math.round(e.startTime),d:Math.round(e.duration)})}).observe({type:'longtask',buffered:true})}catch(e){}
try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:'layout-shift',buffered:true})}catch(e){}
try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp={t:Math.round(e.startTime),el:(e.element&&e.element.tagName)+'.'+String(e.element&&e.element.className).slice(0,40),size:e.size}}).observe({type:'largest-contentful-paint',buffered:true})}catch(e){}
(function loop(){let last=performance.now();function f(t){const g=t-last;if(g>100)window.__gaps.push({s:Math.round(t),g:Math.round(g)});last=t;requestAnimationFrame(f)}requestAnimationFrame(f)})();
document.addEventListener('DOMContentLoaded',()=>{const st=document.querySelector('[data-testid=status]');
 const obsT=()=>{ if(!st) return; new MutationObserver(()=>{window.__events.push({t:Math.round(performance.now()),live:st.textContent})}).observe(st,{childList:true,characterData:true,subtree:true}); };
 obsT();
 new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){if(n.nodeType===1&&(n.getAttribute('role')==='alert'||n.querySelector&&n.querySelector('[role=alert]')))window.__events.push({t:Math.round(performance.now()),alert:(n.textContent||'').slice(0,120)})}}).observe(document.body,{childList:true,subtree:true});
});
`;
module.exports.focusInfo = `(() => { const a=document.activeElement; if(!a||a===document.body) return {tag:'BODY'}; const cs=getComputedStyle(a); const lab=a.closest('label'); const cs2=lab?getComputedStyle(lab):null; const r=a.getBoundingClientRect(); return {tag:a.tagName, tid:a.getAttribute('data-testid'), name:(a.getAttribute('aria-label')||a.textContent||a.value||a.id||'').trim().slice(0,40), type:a.type, outline:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor, shadow:cs.boxShadow==='none'?'':cs.boxShadow.slice(0,50), labelOutline: cs2? cs2.outlineStyle+' '+cs2.outlineWidth:'', inView: r.bottom>0&&r.top<innerHeight, fixedHeader: null}; })()`;
