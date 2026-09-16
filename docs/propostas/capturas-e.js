// Capturas da proposta E: vídeo no hero + variantes fotográficas (3129, 3126), em 1440, 390 e 375.
const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const base = 'http://localhost:8765/docs/propostas/e/';
const out = __dirname + '/capturas/';
(async () => {
  const browser = await chromium.launch(); const problemas = [];
  const abre = async (vp, mobile, url) => { const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile }); const p = await ctx.newPage(); const erros = []; p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); }); await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); await p.evaluate(() => document.fonts.ready); await p.evaluate(() => Promise.all([...document.querySelectorAll('video')].filter(v => getComputedStyle(v).display !== 'none').map(v => new Promise(r => { const seek = () => { v.pause(); v.currentTime = 2; v.onseeked = () => r(); }; if (v.readyState >= 2) seek(); else { v.preload = 'auto'; v.load(); v.oncanplay = seek; } setTimeout(r, 5000); })))); await p.waitForTimeout(400); const l = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth })); if (l.s > l.i) problemas.push(`${vp.width} ${url}: rolagem horizontal ${l.s}`); if (erros.length) problemas.push(`${vp.width} ${url}: ${erros.join(' | ')}`); return { ctx, p }; };
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
