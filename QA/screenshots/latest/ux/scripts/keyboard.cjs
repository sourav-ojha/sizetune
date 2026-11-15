const L = require('./lib.cjs');
const route = process.argv[2];
(async () => {
  const b = await L.launch(); const ctx = await b.newContext({viewport:{width:1280,height:900}, acceptDownloads:true}); const page = await ctx.newPage();
  await page.addInitScript(L.INIT);
  await page.goto(L.BASE + route, { waitUntil: 'networkidle' });
  const seq = [];
  for (let i=0;i<40;i++){ await page.keyboard.press('Tab'); const f = await page.evaluate(L.focusInfo); seq.push(f); if (f.tid==='run' ) break; }
  console.log('PRE-UPLOAD TAB ORDER'); seq.forEach((f,i)=>console.log(i+1, f.tag, f.tid||'', JSON.stringify(f.name), f.outline, f.shadow, f.labelOutline, f.inView));
  // keyboard file pick: focus file input and Enter
  await page.focus('[data-testid=file]');
  console.log('file input focus:', JSON.stringify(await page.evaluate(L.focusInfo)));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  await fc.setFiles((process.env.F||L.FIX + '/.generated/photo-12mp.jpg'));
  await page.waitForSelector('[data-testid=file-card],[data-testid=crop-section]', {timeout: 30000});
  await page.waitForTimeout(600);
  console.log('after pick focus:', JSON.stringify(await page.evaluate(L.focusInfo)));
  console.log('status live:', await page.textContent('[data-testid=status]'));
  // tab to run
  const seq2=[]; for (let i=0;i<80;i++){ await page.keyboard.press('Tab'); const f = await page.evaluate(L.focusInfo); seq2.push(f); if (f.tid==='run') break; }
  console.log('POST-UPLOAD TAB ORDER'); seq2.forEach((f,i)=>console.log(i+1, f.tag, f.tid||'', f.type||'', JSON.stringify(f.name), f.outline, f.shadow, f.inView));
  await page.screenshot({path:`${L.OUT}/kb-${L.slug(route)}-ready.png`});
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  console.log('after Enter on run (processing) focus:', JSON.stringify(await page.evaluate(L.focusInfo)));
  await page.waitForSelector('[data-testid=result]', {timeout: 90000});
  await page.waitForTimeout(800);
  console.log('after result focus:', JSON.stringify(await page.evaluate(L.focusInfo)));
  console.log('events', JSON.stringify(await page.evaluate(()=>window.__events)));
  await page.screenshot({path:`${L.OUT}/kb-${L.slug(route)}-result.png`, fullPage:true});
  const seq3=[]; for (let i=0;i<12;i++){ await page.keyboard.press('Tab'); const f = await page.evaluate(L.focusInfo); seq3.push(f); if (f.tid==='reset') break; }
  console.log('RESULT TAB ORDER'); seq3.forEach((f,i)=>console.log(i+1, f.tag, f.tid||'', JSON.stringify(f.name), f.outline, f.inView));
  // reset via keyboard
  await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  console.log('after reset focus:', JSON.stringify(await page.evaluate(L.focusInfo)));
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
