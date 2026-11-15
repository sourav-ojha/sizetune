const L = require('./lib.cjs');
(async () => {
  const b = await L.launch();
  const res = {};
  for (const w of [320,375,390,768,1024,1440]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const r of L.ROUTES) {
      const errs = [];
      page.removeAllListeners('console'); page.removeAllListeners('pageerror');
      page.on('console', m => { if (['error','warning'].includes(m.type())) errs.push(m.type()+': '+m.text()); });
      page.on('pageerror', e => errs.push('pageerror: '+e.message));
      await page.goto(L.BASE + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${L.SHOTS}/${L.slug(r)}-${w}.jpg`, fullPage: true, type: 'jpeg', quality: 60 });
      const m = await page.evaluate(() => {
        const de = document.documentElement; const vw = de.clientWidth;
        const over = []; 
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el); if (cs.display==='none'||cs.visibility==='hidden') continue;
          const rc = el.getBoundingClientRect(); if (!rc.width) continue;
          if (cs.position==='fixed') continue;
          if (rc.right > vw + 1 || rc.left < -1) { if (!el.closest('.sr-only') && !(cs.position==='absolute' && el.className.toString().includes('sr-only'))) over.push(el.tagName+'.'+String(el.className).slice(0,50)+' r='+Math.round(rc.right)); }
        }
        // tap targets
        const small = [];
        for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,summary,[role=button],textarea')) {
          const cs = getComputedStyle(el); if (cs.display==='none'||cs.visibility==='hidden') continue;
          let rc = el.getBoundingClientRect();
          if (el.matches('input[type=file]')) rc = (el.closest('label')||el).getBoundingClientRect();
          if (!rc.width||!rc.height) continue;
          if (el.closest('.sr-only')&&!el.matches('input')) continue;
          // inline links in text are exempt-ish; record anyway with flag
          const inline = el.tagName==='A' && cs.display==='inline';
          if (rc.width < 44 || rc.height < 44) small.push({ t: el.tagName+':'+(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,30), w: Math.round(rc.width), h: Math.round(rc.height), inline });
        }
        // clipped text: elements w/ overflow hidden and scrollWidth>clientWidth
        const clip = [];
        for (const el of document.querySelectorAll('body *')) { const cs=getComputedStyle(el); if ((cs.overflow==='hidden'||cs.overflowX==='hidden') && el.scrollWidth>el.clientWidth+1 && cs.textOverflow!=='ellipsis') clip.push(el.tagName+'.'+String(el.className).slice(0,40)); }
        return { sw: de.scrollWidth, vw, hscroll: de.scrollWidth > vw, over: over.slice(0,8), small, clip: clip.slice(0,5), h: de.scrollHeight };
      });
      res[`${r}@${w}`] = { ...m, errs };
    }
    await ctx.close();
  }
  require('fs').writeFileSync(L.OUT + '/shots.json', JSON.stringify(res, null, 1));
  for (const [k,v] of Object.entries(res)) console.log(k, 'hscroll', v.hscroll, 'sw', v.sw, 'vw', v.vw, 'over', v.over.length, 'small', v.small.filter(s=>!s.inline).length, 'clip', v.clip.length, 'errs', v.errs.length);
  await b.close();
})();
