const L = require('./lib.cjs');
const FX=L.FIX, G=L.FIX+'/.generated';
const out={};
(async () => {
  const b = await L.launch();
  for (const route of ['/resize-image-to-20kb/','/resize-signature/']) {
    const ctx = await b.newContext({viewport:{width:390,height:844}}); const page = await ctx.newPage();
    await page.addInitScript(L.INIT);
    await page.goto(L.BASE+route,{waitUntil:'networkidle'});
    const s = L.slug(route); const R = out[s]={};
    R.axe_initial = await L.axe(page);
    const pick = async (f)=>{ await page.setInputFiles('[data-testid=file]', f); await page.waitForTimeout(1200); };
    const snap = async (n)=>page.screenshot({path:`${L.SHOTS}/${s}-state-${n}.png`,fullPage:true});
    R.runDisabledNoFile = await page.evaluate(()=>{const r=document.querySelector('[data-testid=run]');return {disabled:r.disabled, ariaDisabled:r.getAttribute('aria-disabled'), hintNear: !!document.querySelector('[data-testid=run]').parentElement.textContent.match(/choose|add/i)}});
    // errors
    const errs = {};
    for (const [n,f] of Object.entries({svg:FX+'/svg-renamed.png',gif:FX+'/gif-renamed.jpg',heic:FX+'/heic-header.heic',corrupt:FX+'/corrupt-truncated.jpg',garbage:FX+'/corrupt-garbage.jpg',big40:G+'/device-pack/09-too-large-40mb.jpg',mp48:G+'/device-pack/03-smooth-48mp.jpg',mp36:G+'/device-pack/02-photo-36mp.jpg'})) {
      await pick(f);
      let r = await page.evaluate(()=>({err:document.querySelector('[data-testid=error]')?.textContent, notice:document.querySelector('[data-testid=notice]')?.textContent, hasFile:!!document.querySelector('[data-testid=file-info]'), live:document.querySelector('[data-testid=status]').textContent, focus:document.activeElement?.getAttribute('data-testid')||document.activeElement?.tagName, runDis:document.querySelector('[data-testid=run]').disabled}));
      // if file accepted try run
      if (r.hasFile && !r.err) { const dis = r.runDis; if(!dis){ await page.click('[data-testid=run]'); try{ await page.waitForSelector('[data-testid=result],[data-testid=error]',{timeout:60000}); }catch(e){r.timeout=true} await page.waitForTimeout(500); r.afterRun = await page.evaluate(()=>({err:document.querySelector('[data-testid=error]')?.textContent,res:document.querySelector('[data-testid=result-heading]')?.textContent, focus:document.activeElement?.getAttribute('data-testid')||document.activeElement?.tagName, live:document.querySelector('[data-testid=status]').textContent, btns:[...document.querySelectorAll('[data-testid=retry],[data-testid=use-jpeg],[data-testid=start-over]')].map(x=>x.textContent)})); } }
      errs[n]=r;
      if(['svg','corrupt','big40'].includes(n)) { await snap('err-'+n); R['axe_err_'+n]=await L.axe(page); }
      if(n==='corrupt' || n==='mp48'){} 
    }
    R.errors=errs;
    // invalid input
    await pick(FX+'/photo-1200x800.jpg');
    await page.fill('[data-testid=target]','abc'); await page.waitForTimeout(200);
    R.invalidAbc = await page.evaluate(()=>({txt:document.body.innerText.match(/(Fix the highlighted[^\n]*|[^\n]*(number|valid)[^\n]*)/gi), runDis:document.querySelector('[data-testid=run]').disabled, invalid:document.querySelector('[data-testid=target]').getAttribute('aria-invalid')}));
    await snap('invalid');
    R.axe_invalid = await L.axe(page);
    await page.fill('[data-testid=target]','0'); R.invalid0 = await page.evaluate(()=>document.querySelector('[data-testid=target]').closest('div').textContent);
    // unreachable: 1 KB
    await page.fill('[data-testid=target]','1'); await page.click('[data-testid=run]'); await page.waitForSelector('[data-testid=result],[data-testid=error]',{timeout:60000}); await page.waitForTimeout(500);
    R.oneKB = await page.evaluate(()=>({status:document.querySelector('[data-testid=result]')?.dataset.status, heading:document.querySelector('[data-testid=result-heading]')?.textContent, text:document.querySelector('[data-testid=result]')?.innerText.slice(0,900), live:document.querySelector('[data-testid=status]').textContent, focus:document.activeElement?.getAttribute('data-testid')}));
    await snap('result-unmet'); R.axe_unmet=await L.axe(page);
    // recover: change target
    await page.click('[data-testid=preset-50]'); await page.waitForTimeout(300);
    R.afterChange = await page.evaluate(()=>({result:!!document.querySelector('[data-testid=result]'), focus:document.activeElement?.getAttribute('data-testid')}));
    // cancel mid-run with 36MP
    await pick(G+'/device-pack/02-photo-36mp.jpg');
    await page.click('[data-testid=run]'); await page.waitForTimeout(120);
    const hadCancel = await page.$('[data-testid=cancel]');
    if (hadCancel){ await page.keyboard.press('Escape'); await page.waitForTimeout(600);}
    R.cancel = await page.evaluate(()=>({cancelBtn:!!document.querySelector('[data-testid=cancel]'), result:!!document.querySelector('[data-testid=result]'), err:document.querySelector('[data-testid=error]')?.textContent, focus:document.activeElement?.getAttribute('data-testid'), live:document.querySelector('[data-testid=status]').textContent, had:true}));
    R.hadCancel=!!hadCancel;
    // success + axe
    await pick(FX+'/photo-1200x800.jpg'); await page.click('[data-testid=preset-50]'); await page.click('[data-testid=run]'); await page.waitForSelector('[data-testid=result]',{timeout:60000}); await page.waitForTimeout(600);
    R.axe_result=await L.axe(page); await snap('result-ok');
    R.workers = page.workers().length;
    R.events = await page.evaluate(()=>window.__events);
    await ctx.close();
  }
  require('fs').writeFileSync(L.OUT+'/states.json',JSON.stringify(out,null,1));
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
