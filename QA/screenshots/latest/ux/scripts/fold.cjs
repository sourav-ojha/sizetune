const L = require('./lib.cjs');
(async () => {
  const b = await L.launch();
  for (const [w,h] of [[390,844],[1440,900]]) {
    const page = await (await b.newContext({viewport:{width:w,height:h}})).newPage();
    for (const r of ['/','/resize-signature/']) {
      await page.goto(L.BASE + r, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `${L.OUT}/fold-${L.slug(r)}-${w}.png` });
      // where is the dropzone relative to the fold
      console.log(r, w, await page.evaluate(() => { const d=document.querySelector('[data-testid=dropzone]').getBoundingClientRect(); const bt=document.querySelector('[data-testid=run]').getBoundingClientRect(); return {dropTop:Math.round(d.top),dropBottom:Math.round(d.bottom),runTop:Math.round(bt.top), runDisabled:document.querySelector('[data-testid=run]').disabled}; }));
    }
  }
  await b.close();
})();
