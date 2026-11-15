const L = require('./lib.cjs');
(async()=>{ for (const name of ['firefox','webkit']) { const b=await L.launch(name); const ctx=await b.newContext({viewport:{width:390,height:844}}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 for (const r of ['/resize-image-to-20kb/','/resize-signature/']) { await page.goto(L.BASE+r,{waitUntil:'networkidle'}); const hs=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  const a=await L.axe(page); await page.setInputFiles('[data-testid=file]',L.FIX+'/photo-1200x800.jpg'); await page.waitForTimeout(800); await page.click('[data-testid=run]'); await page.waitForSelector('[data-testid=result],[data-testid=error]',{timeout:60000}); await page.waitForTimeout(400);
  const res=await page.evaluate(()=>({h:document.querySelector('[data-testid=result-heading]')?.textContent, e:document.querySelector('[data-testid=error]')?.textContent, f:document.activeElement?.getAttribute('data-testid')}));
  const a2=await L.axe(page); await page.screenshot({path:`${L.SHOTS}/${name}-${L.slug(r)}-result-390.jpg`,type:'jpeg',quality:60,fullPage:true});
  console.log(name,r,'hscroll',hs,'axe',a.violations.map(v=>v.id).join(','),'/',a2.violations.map(v=>v.id).join(','),JSON.stringify(res)); }
 console.log(name,'errs',errs); await b.close(); } })().catch(e=>{console.error(e);process.exit(1)});
