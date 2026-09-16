// Capturas da proposta E: vídeo no hero + variantes fotográficas (3129, 3126), em 1440, 390 e 375.
const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const base = 'http://localhost:8765/docs/propostas/e/';
const out = __dirname + '/capturas/';
(async () => {
  const browser = await chromium.launch(); const problemas = [];
  const abre = async (vp, mobile, url) => { const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile }); const p = await ctx.newPage(); const erros = []; p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); }); await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); await p.evaluate(() => document.fonts.ready); await p.evaluate(async () => { for (const v of document.querySelectorAll('video')) { if (getComputedStyle(v).display === 'none') continue; v.muted = true; try { await v.play(); } catch (e) {} for (let i = 0; i < 40 && (!v.videoWidth || v.currentTime < 1.5); i++) await new Promise(r => setTimeout(r, 100)); v.pause(); } }); await p.waitForTimeout(400); await p.evaluate(() => { for (const v of document.querySelectorAll('video')) { if (getComputedStyle(v).display === 'none' || !v.videoWidth) continue; const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); const i = document.createElement('img'); i.src = c.toDataURL('image/jpeg', .9); i.className = v.className; i.style.cssText = getComputedStyle(v).cssText; i.style.position = 'absolute'; i.style.inset = '0'; i.style.width = '100%'; i.style.height = '100%'; i.style.objectFit = 'cover'; i.style.zIndex = '-2'; v.replaceWith(i); } }); const l = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth })); if (l.s > l.i) problemas.push(`${vp.width} ${url}: rolagem horizontal ${l.s}`); if (erros.length) problemas.push(`${vp.width} ${url}: ${erros.join(' | ')}`); return { ctx, p }; };
  // vídeo no hero
  let r = await abre({ width: 1440, height: 900 }, false, base);
  await r.p.screenshot({ path: out + 'e-1440-dobra.png' }); await r.p.screenshot({ path: out + 'e-1440.png', fullPage: true });
  await r.p.locator('.exp').screenshot({ path: out + 'e-experiencia-1440.png' }); await r.ctx.close();
  r = await abre({ width: 390, height: 844 }, true, base);
  await r.p.screenshot({ path: out + 'e-390-dobra.png' }); await r.p.screenshot({ path: out + 'e-390.png', fullPage: true });
  // barra fixa: some com o botão do hero visível, aparece depois
  const d0 = await r.p.evaluate(() => document.getElementById('dock').classList.contains('on'));
  await r.p.evaluate(() => document.querySelector('.ficha').scrollIntoView()); await r.p.waitForTimeout(500);
  const d1 = await r.p.evaluate(() => document.getElementById('dock').classList.contains('on'));
  await r.p.screenshot({ path: out + 'e-390-dock.png' });
  await r.p.evaluate(() => document.querySelector('footer').scrollIntoView()); await r.p.waitForTimeout(500);
  const d2 = await r.p.evaluate(() => document.getElementById('dock').classList.contains('on'));
  console.log('DOCK: no hero=' + d0 + ' / na ficha=' + d1 + ' / no rodapé=' + d2);
  await r.ctx.close();
  r = await abre({ width: 375, height: 812 }, true, base); await r.p.screenshot({ path: out + 'e-375.png', fullPage: true }); await r.ctx.close();
  // variantes fotográficas do hero
  for (const foto of ['3129', '3126']) {
    r = await abre({ width: 1440, height: 900 }, false, base + '?hero=' + foto); await r.p.screenshot({ path: out + `e-hero-foto-${foto}-1440.png` }); await r.ctx.close();
    r = await abre({ width: 390, height: 844 }, true, base + '?hero=' + foto); await r.p.screenshot({ path: out + `e-hero-foto-${foto}-390.png` }); await r.ctx.close();
  }
  await browser.close(); console.log('PROBLEMAS:', problemas.length ? problemas : 'nenhum');
})();
