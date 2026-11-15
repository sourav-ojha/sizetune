const L = require('./lib.cjs'); const G=L.FIX+'/.generated'; const o={load:{},proc:{}};
(async () => {
  const b = await L.launch();
  for (const cpu of [1]) for (const r of L.ROUTES) {
    const ctx=await b.newContext({viewport:{width:390,height:844}}); const page=await ctx.newPage(); await page.addInitScript(L.INIT);
    const cdp=await ctx.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    const reqs=[]; cdp.on('Network.responseReceived',e=>reqs.push({id:e.requestId,url:e.response.url,type:e.type,status:e.response.status,mime:e.response.mimeType,enc:e.response.headers['content-encoding']||e.response.headers['Content-Encoding']||''}));
    const fin={}; cdp.on('Network.loadingFinished',e=>fin[e.requestId]=e.encodedDataLength);
    const dec={}; cdp.on('Network.dataReceived',e=>dec[e.requestId]=(dec[e.requestId]||0)+e.dataLength);
    await page.goto(L.BASE+r,{waitUntil:'networkidle'}); await page.waitForTimeout(1500);
    const rows=reqs.map(x=>({...x,transfer:fin[x.id]||0,decoded:dec[x.id]||0}));
    const sum=(f)=>rows.filter(f).reduce((a,x)=>[a[0]+x.transfer,a[1]+x.decoded],[0,0]);
    const m=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];const p=Object.fromEntries(performance.getEntriesByType('paint').map(e=>[e.name,Math.round(e.startTime)]));return {ttfb:Math.round(n.responseStart),dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd),fcp:p['first-contentful-paint'],lcp:window.__lcp,cls:+window.__cls.toFixed(4),lt:window.__lt,tbt:window.__lt.reduce((a,x)=>a+Math.max(0,x.d-50),0)}});
    o.load[r]={reqs:rows.length,js:sum(x=>x.type==='Script'||/javascript/.test(x.mime)),css:sum(x=>x.type==='Stylesheet'),font:sum(x=>x.type==='Font'),doc:sum(x=>x.type==='Document'),img:sum(x=>x.type==='Image'),all:sum(()=>true),third:rows.filter(x=>!x.url.startsWith(L.BASE)).length,files:rows.map(x=>x.url.replace(L.BASE,'')+' '+x.transfer+'/'+x.decoded+' '+x.enc),...m};
    await ctx.close();
  }
  // processing
  for (const [name,f,route] of [['12MP',G+'/photo-12mp.jpg','/resize-image-to-20kb/'],['36MP',G+'/device-pack/02-photo-36mp.jpg','/resize-image-to-20kb/'],['48MP',G+'/device-pack/03-smooth-48mp.jpg','/resize-image-to-20kb/'],['12MP-sig',G+'/photo-12mp.jpg','/resize-signature/']]) for (const cpu of [1,4]) {
    const ctx=await b.newContext({viewport:{width:390,height:844}}); const page=await ctx.newPage(); await page.addInitScript(L.INIT);
    const cdp=await ctx.newCDPSession(page); await cdp.send('Performance.enable'); if(cpu>1) await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
    await page.goto(L.BASE+route,{waitUntil:'networkidle'});
    const heap=async()=>{const m=await cdp.send('Runtime.getHeapUsage');return Math.round(m.usedSize/1e6)};
    const targets=async()=>{const t=await cdp.send('Target.getTargets'); return t.targetInfos.filter(x=>/worker/.test(x.type)).map(x=>x.type)}; 
    const h0=await heap(); 
    const t0=Date.now(); await page.setInputFiles('[data-testid=file]',f);
    await page.waitForSelector('[data-testid=file-info], [data-testid=crop-section]',{timeout:60000}); const tSel=Date.now()-t0;
    await page.waitForTimeout(800); const afterSel=await page.evaluate(()=>({lt:window.__lt.length, gaps:window.__gaps.slice()}));
    const h1=await heap(); const ltBefore=await page.evaluate(()=>window.__lt.length);
    const t1=Date.now(); await page.evaluate(()=>{window.__lt=[];window.__gaps=[]}); await page.click('[data-testid=run]');
    let wk=[]; for(let i=0;i<6;i++){ await page.waitForTimeout(60); const w=page.workers().length; wk.push(w); }
    await page.waitForSelector('[data-testid=result]',{timeout:120000}); const tRun=Date.now()-t1; await page.waitForTimeout(1500);
    const m=await page.evaluate(()=>({lt:window.__lt,gaps:window.__gaps,mem:performance.memory&&Math.round(performance.memory.usedJSHeapSize/1e6)}));
    const h2=await heap(); const wAfter=page.workers().length;
    await page.click('[data-testid=reset]'); await page.waitForTimeout(1500);
    if(cdp){ try{await cdp.send('HeapProfiler.collectGarbage')}catch(e){} }
    const h3=await heap(); const wReset=page.workers().length;
    o.proc[`${name}@cpu${cpu}`]={selectMs:tSel,runMs:tRun,heapMB:{start:h0,afterSelect:h1,afterResult:h2,afterReset:h3},workersDuring:wk,workersAfterResult:wAfter,workersAfterReset:wReset,ltRun:m.lt,gapsRun:m.gaps,ltTotalMs:m.lt.reduce((a,x)=>a+x.d,0),tbt:m.lt.reduce((a,x)=>a+Math.max(0,x.d-50),0),selectLT:afterSel.lt,selectGaps:afterSel.gaps};
    await ctx.close();
  }
  require('fs').writeFileSync(L.OUT+'/perf.json',JSON.stringify(o,null,1));
  for(const [r,v] of Object.entries(o.load)) console.log(r,'reqs',v.reqs,'js',v.js,'css',v.css,'font',v.font,'doc',v.doc,'all',v.all,'3p',v.third,'fcp',v.fcp,'lcp',JSON.stringify(v.lcp),'cls',v.cls,'tbt',v.tbt,'ttfb',v.ttfb,'load',v.load);
  for(const [k,v] of Object.entries(o.proc)) console.log(k,JSON.stringify({select:v.selectMs,run:v.runMs,heap:v.heapMB,wk:v.workersDuring,wA:v.workersAfterResult,wR:v.workersAfterReset,lt:v.ltRun,gaps:v.gapsRun,tbt:v.tbt,selLT:v.selectLT,selGaps:v.selectGaps}));
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
