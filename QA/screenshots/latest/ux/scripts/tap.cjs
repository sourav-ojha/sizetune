const L = require('./lib.cjs');
const probe = () => {
  const parse=c=>{const m=c.match(/[\d.]+/g);return m?m.map(Number):null};
  // use canvas to resolve oklch etc
  const cv=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
  const rgba=c=>{cv.clearRect(0,0,1,1);cv.fillStyle='#000';cv.fillStyle=c;cv.fillRect(0,0,1,1);const d=cv.getImageData(0,0,1,1).data;return [d[0],d[1],d[2],d[3]/255]};
  const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
  const bgOf=el=>{let layers=[];for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e);if(cs.backgroundImage!=='none'&&e!==document.body&&e!==document.documentElement)return {grad:true};const c=rgba(cs.backgroundColor);if(c[3]>0){layers.push(c);if(c[3]>=1)break}}
    let base=[255,255,255];for(const l of layers.reverse()){base=base.map((v,i)=>l[i]*l[3]+v*(1-l[3]))}return {rgb:base}};
  const low=[];let n=0,grad=0;
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(w.nextNode()){const t=w.currentNode;if(!t.textContent.trim())continue;const el=t.parentElement;const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none'||el.closest('.sr-only'))continue;const r=el.getBoundingClientRect();if(!r.width)continue;
    const bg=bgOf(el);if(bg.grad){grad++;continue}const fg=rgba(cs.color);const fgb=fg.slice(0,3).map((v,i)=>fg[3]*v+(1-fg[3])*bg.rgb[i]);const L1=lum(fgb),L2=lum(bg.rgb);const cr=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);n++;const size=parseFloat(cs.fontSize),bold=parseInt(cs.fontWeight)>=700;const large=size>=24||(size>=18.66&&bold);if(cr<(large?3:4.5))low.push({t:t.textContent.trim().slice(0,40),cr:+cr.toFixed(2),size});}
  const small=[];for(const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,summary,[role=slider],[tabindex="0"]')){const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden')continue;let tgt=el;if(el.matches('input[type=radio],input[type=checkbox],input[type=file]'))tgt=el.closest('label')||el;const r=tgt.getBoundingClientRect();if(!r.width||!r.height)continue;if(el.tagName==='A'&&cs.display==='inline'&&el.closest('p,li'))continue;if(r.width<44||r.height<44)small.push((el.getAttribute('data-testid')||el.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height))}
  return {checked:n,gradientSkipped:grad,low,small};
};
(async()=>{const b=await L.launch();
 for (const [r,f] of [['/resize-image-to-20kb/',L.FIX+'/photo-1200x800.jpg'],['/resize-signature/',L.FIX+'/signature-1200x400.png']]) {
  const page=await (await b.newContext({viewport:{width:390,height:844}})).newPage(); await page.goto(L.BASE+r,{waitUntil:'networkidle'});
  console.log(r,'initial',JSON.stringify(await page.evaluate(probe)));
  await page.setInputFiles('[data-testid=file]',f); await page.waitForTimeout(800); await page.click('[data-testid=advanced] summary'); await page.waitForTimeout(200);
  console.log(r,'uploaded+advanced',JSON.stringify(await page.evaluate(probe)));
  await page.screenshot({path:`${L.SHOTS}/${L.slug(r)}-state-uploaded-390.png`,fullPage:true});
  await page.click('[data-testid=run]'); await page.waitForSelector('[data-testid=result]'); await page.waitForTimeout(500);
  console.log(r,'result',JSON.stringify(await page.evaluate(probe)));
 } await b.close();})();
