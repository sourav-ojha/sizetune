const L=require('./lib.cjs');(async()=>{const b=await L.launch();
for(const [w,h] of [[320,568],[375,667],[390,844],[1440,900]]){const page=await(await b.newContext({viewport:{width:w,height:h}})).newPage();
 for(const r of ['/','/resize-image-to-20kb/','/resize-signature/']){await page.goto(L.BASE+r,{waitUntil:'networkidle'});console.log(w+'x'+h,r,await page.evaluate(()=>{const l=document.querySelector('[data-testid=file]').closest('label').getBoundingClientRect();return 'chooseBtn top '+Math.round(l.top)+' bottom '+Math.round(l.bottom)+' visibleInFold '+(l.bottom<=innerHeight)}));}}
const page=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
await page.goto(L.BASE+'/resize-image-to-20kb/',{waitUntil:'networkidle'});await page.setInputFiles('[data-testid=file]',L.FIX+'/.generated/photo-12mp.jpg');await page.waitForTimeout(700);
console.log('runBtn after upload top',await page.evaluate(()=>Math.round(document.querySelector('[data-testid=run]').getBoundingClientRect().top)),'scrollY',await page.evaluate(()=>scrollY));
await page.click('[data-testid=run]');await page.waitForSelector('[data-testid=result]');await page.waitForTimeout(600);
console.log(await page.evaluate(()=>({t:document.querySelector('[data-testid=result]').innerText.slice(0,500),dl:document.querySelector('[data-testid=download]').getBoundingClientRect().top, scrollY, vh:innerHeight, headTop:Math.round(document.querySelector('[data-testid=result-heading]').getBoundingClientRect().top)})));
await b.close()})();
