const L = require('./lib.cjs');
(async () => {
  const b = await L.launch(); const page = await (await b.newContext({viewport:{width:390,height:800}})).newPage();
  for (const r of L.ROUTES) {
    await page.goto(L.BASE + r, { waitUntil: 'networkidle' });
    const t = await page.evaluate(() => {
      const hs=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h=>h.tagName+(h.classList.contains('sr-only')?'(sr)':'')+': '+h.textContent.trim().slice(0,80));
      const lm=[...document.querySelectorAll('header,nav,main,footer,aside,section[aria-label],[role]')].map(e=>e.tagName+(e.getAttribute('role')?'[role='+e.getAttribute('role')+']':'')+(e.getAttribute('aria-label')?'('+e.getAttribute('aria-label')+')':''));
      return { title: document.title, lang: document.documentElement.lang, hs, lm, text: document.body.innerText.slice(0,3500) };
    });
    console.log('=====', r, '\n', t.title, t.lang, '\n', t.hs.join('\n '), '\n', t.lm.join(' | '), '\n----\n', r==='/'||r.includes('resize')? t.text : t.text.slice(0,500));
  }
  await b.close();
})();
