const L=require('./lib.cjs');(async()=>{const b=await L.launch();const page=await(await b.newContext()).newPage();await page.addInitScript(L.INIT);
const seen=new Map();
for(const r of L.ROUTES){await page.goto(L.BASE+r,{waitUntil:'networkidle'});const ls=await page.evaluate(()=>[...document.querySelectorAll('a[href]')].map(a=>({h:a.getAttribute('href'),t:(a.textContent||'').trim().slice(0,30),cur:a.getAttribute('aria-current'),tgt:a.target})));
 console.log(r,'aria-current:',ls.filter(l=>l.cur).map(l=>l.t+'='+l.cur).join(','),'| new-tab:',ls.filter(l=>l.tgt).map(l=>l.t).join(','));
 for(const l of ls) if(!seen.has(l.h)) seen.set(l.h,r);}
for(const h of seen.keys()){ if(h.startsWith('mailto:')||h.startsWith('#')) {console.log('skip',h);continue;} const u=new URL(h,L.BASE+'/'); const res=await page.request.get(u.href); console.log(res.status(),h);}
// 404 page + anchor
await page.goto(L.BASE+'/nope/',{waitUntil:'networkidle'});console.log('404 title',await page.title(), await page.evaluate(()=>document.querySelector('h1')?.textContent));
// alert fires
await page.goto(L.BASE+'/resize-image-to-20kb/',{waitUntil:'networkidle'});await page.setInputFiles('[data-testid=file]',L.FIX+'/svg-renamed.png');await page.waitForTimeout(600);console.log('alert events',JSON.stringify(await page.evaluate(()=>window.__events)));
const al=await page.evaluate(()=>{const e=document.querySelector('[role=alert]');return {present:!!e, focus:document.activeElement.tagName}});console.log(al);
// multi-file
await page.reload({waitUntil:'networkidle'});await page.setInputFiles('[data-testid=file]',[L.FIX+'/photo-1200x800.jpg',L.FIX+'/photo-200x230.jpg']);await page.waitForTimeout(800);console.log('multi notice:',await page.textContent('[data-testid=notice]').catch(()=>null));
await b.close()})();
