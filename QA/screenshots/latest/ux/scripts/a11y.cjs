const L = require('./lib.cjs'); const FX=L.FIX; const o={};
(async () => {
  const b = await L.launch();
  // axe on every route, light & dark, 2 widths
  o.axe={};
  for (const [w,scheme] of [[1280,'light'],[390,'light'],[1280,'dark']]) {
    const ctx = await b.newContext({viewport:{width:w,height:900},colorScheme:scheme}); const page=await ctx.newPage();
    for (const r of L.ROUTES){ await page.goto(L.BASE+r,{waitUntil:'networkidle'}); const a=await L.axe(page); o.axe[`${r}@${w}/${scheme}`]={v:a.violations.map(v=>v.id+'x'+v.count+':'+v.nodes[0].t), inc:a.incomplete.map(v=>v.id+'x'+v.count)}; }
    await ctx.close();
  }
  // zoom 200/400, reduced-motion, forced-colors
  o.zoom={};
  for (const [name,vw,vh,dpr] of [['200%',640,450,2],['400%',320,225,4]]) {
    const ctx=await b.newContext({viewport:{width:vw,height:vh},deviceScaleFactor:dpr}); const page=await ctx.newPage();
    for (const r of L.ROUTES){ await page.goto(L.BASE+r,{waitUntil:'networkidle'}); const m=await page.evaluate(()=>({hs:document.documentElement.scrollWidth>document.documentElement.clientWidth, sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth, headerH:Math.round(document.querySelector('header').getBoundingClientRect().height), sticky:getComputedStyle(document.querySelector('header')).position})); o.zoom[`${r}@${name}`]=m; if(r==='/'||r==='/resize-signature/'){ await page.screenshot({path:`${L.SHOTS}/${L.slug(r)}-zoom${name.replace('%','')}.jpg`,type:'jpeg',quality:60}); } }
    await ctx.close();
  }
  o.motion={};
  { const ctx=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}); const page=await ctx.newPage(); await page.goto(L.BASE+'/',{waitUntil:'networkidle'});
    o.motion.reduce = await page.evaluate(()=>{ const bad=[]; for(const e of document.querySelectorAll('*')){const c=getComputedStyle(e); if((c.animationName!=='none'&&parseFloat(c.animationDuration)>0.01)||(parseFloat(c.transitionDuration)>0.01 && c.transitionProperty!=='none')) bad.push(e.tagName+'.'+String(e.className).slice(0,30)+' '+c.animationName+' '+c.transitionDuration);} return {n:bad.length, sample:bad.slice(0,5), scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior}; });
    await ctx.close(); }
  { const ctx=await b.newContext({viewport:{width:1280,height:900}}); const page=await ctx.newPage(); await page.goto(L.BASE+'/',{waitUntil:'networkidle'});
    o.motion.normal = await page.evaluate(()=>{ let n=0; for(const e of document.querySelectorAll('*')){const c=getComputedStyle(e); if(c.animationName!=='none'||parseFloat(c.transitionDuration)>0) n++;} return {animOrTransition:n, hasReduceRule:[...document.styleSheets].some(s=>{try{return [...s.cssRules].some(r=>String(r.conditionText||'').includes('prefers-reduced-motion'))}catch(e){return false}})}; });
    await ctx.close(); }
  // forced colors
  o.forced={};
  { const ctx=await b.newContext({viewport:{width:1280,height:900},forcedColors:'active'}); const page=await ctx.newPage();
    for (const r of ['/','/resize-signature/']){ await page.goto(L.BASE+r,{waitUntil:'networkidle'}); await page.screenshot({path:`${L.SHOTS}/${L.slug(r)}-forced-colors.jpg`,type:'jpeg',quality:60});
      if(r==='/') { await page.setInputFiles('[data-testid=file]',FX+'/photo-1200x800.jpg'); await page.waitForTimeout(800); await page.screenshot({path:`${L.SHOTS}/home-forced-colors-uploaded.jpg`,type:'jpeg',quality:60,fullPage:true}); await page.click('[data-testid=run]'); await page.waitForSelector('[data-testid=result]'); await page.waitForTimeout(500); await page.screenshot({path:`${L.SHOTS}/home-forced-colors-result.jpg`,type:'jpeg',quality:60,fullPage:true}); }
      o.forced[r]=await page.evaluate(()=>matchMedia('(forced-colors: active)').matches); }
    await ctx.close(); }
  // unmet states
  o.unmet={};
  { const ctx=await b.newContext({viewport:{width:390,height:844}}); const page=await ctx.newPage(); await page.addInitScript(L.INIT);
    await page.goto(L.BASE+'/resize-signature/',{waitUntil:'networkidle'});
    await page.setInputFiles('[data-testid=file]',FX+'/signature-140x60.png'); await page.waitForTimeout(800);
    await page.click('[data-testid=preset-30]'); // keep
    await page.click('[data-testid=advanced] summary'); const mk=page.locator('[data-testid=min-kb], input[data-testid=minKb], [data-testid=advanced] input[type=text]').first(); await mk.fill('15'); await page.click('[data-testid=run]'); await page.waitForSelector('[data-testid=result],[data-testid=error]'); await page.waitForTimeout(500);
    o.unmet.belowMin=await page.evaluate(()=>({status:document.querySelector('[data-testid=result]')?.dataset.status, text:document.querySelector('[data-testid=result]')?.innerText.slice(0,1500), live:document.querySelector('[data-testid=status]').textContent, focus:document.activeElement?.getAttribute('data-testid')}));
    await page.screenshot({path:`${L.SHOTS}/signature-state-below-min.png`,fullPage:true}); o.unmet.axeBelow=(await L.axe(page)).violations.map(v=>v.id+'x'+v.count);
    await ctx.close(); }
  { const ctx=await b.newContext({viewport:{width:390,height:844}}); const page=await ctx.newPage();
    await page.goto(L.BASE+'/resize-image-to-20kb/',{waitUntil:'networkidle'});
    await page.setInputFiles('[data-testid=file]',FX+'/noise-256.png'); await page.waitForTimeout(800);
    await page.fill('[data-testid=target]','1'); await page.click('[data-testid=run]'); await page.waitForSelector('[data-testid=result],[data-testid=error]',{timeout:60000}); await page.waitForTimeout(500);
    o.unmet.aboveMax=await page.evaluate(()=>({status:document.querySelector('[data-testid=result]')?.dataset.status, text:document.querySelector('[data-testid=result]')?.innerText.slice(0,1400), live:document.querySelector('[data-testid=status]').textContent, focus:document.activeElement?.getAttribute('data-testid'), fmt:document.querySelector('[data-testid=auto-note]')?.textContent}));
    await page.screenshot({path:`${L.SHOTS}/image-state-above-max.png`,fullPage:true}); o.unmet.axeAbove=(await L.axe(page)).violations.map(v=>v.id+'x'+v.count);
    await ctx.close(); }
  require('fs').writeFileSync(L.OUT+'/a11y.json',JSON.stringify(o,null,1));
  console.log(JSON.stringify(o,null,1).slice(0,9000));
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
