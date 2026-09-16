const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const base = 'http://localhost:8765/docs/propostas/e2/'; const out = __dirname + '/capturas/';
(async () => {
  const browser = await chromium.launch(); const problemas = [];
  const abre = async (vp, mobile, url) => { const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile }); const p = await ctx.newPage(); const erros = []; p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); }); await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); await p.evaluate(() => document.fonts.ready); const l = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth })); if (l.s > l.i) problemas.push(`${vp.width}: rolagem horizontal ${l.s}`); if (erros.length) problemas.push(`${vp.width}: ${erros.join(' | ')}`); return { ctx, p }; };
  let r = await abre({ width: 1440, height: 900 }, false, base);
  await r.p.screenshot({ path: out + 'e2-1440-dobra.png' }); await r.p.screenshot({ path: out + 'e2-1440.png', fullPage: true });
  await r.p.locator('.top').screenshot({ path: out + 'e2-header-desktop.png' }); await r.p.locator('.exp').screenshot({ path: out + 'e2-experiencia-1440.png' }); await r.ctx.close();
  for (const m of ['local', 'gratuito', 'online']) { r = await abre({ width: 1440, height: 900 }, false, base + '?modalidade=' + m); await r.p.locator('.hero .evento').screenshot({ path: out + `e2-modalidade-${m}.png` }); await r.ctx.close(); }
  r = await abre({ width: 390, height: 844 }, true, base);
  await r.p.screenshot({ path: out + 'e2-390-dobra.png' }); await r.p.screenshot({ path: out + 'e2-390.png', fullPage: true });
  await r.p.locator('.top').screenshot({ path: out + 'e2-header-mobile-topo.png' });
  await r.p.evaluate(() => window.scrollTo(0, 700)); await r.p.waitForTimeout(500); await r.p.locator('.top').screenshot({ path: out + 'e2-header-mobile-rolado.png' });
  await r.p.evaluate(() => window.scrollTo(0, 0)); await r.p.waitForTimeout(300); await r.p.click('#abrirMenu'); await r.p.waitForTimeout(300); await r.p.screenshot({ path: out + 'e2-menu-mobile.png' }); await r.ctx.close();
  r = await abre({ width: 375, height: 667 }, true, base); await r.p.screenshot({ path: out + 'e2-375x667-dobra.png' }); await r.p.screenshot({ path: out + 'e2-375.png', fullPage: true });
  const v = await r.p.evaluate(() => { const b = document.getElementById('ctaHero').getBoundingClientRect(); return b.bottom <= innerHeight ? 'botão na dobra' : 'botão FORA'; }); console.log('375x667:', v); await r.ctx.close();
  await browser.close(); console.log('PROBLEMAS:', problemas.length ? problemas : 'nenhum');
})();
