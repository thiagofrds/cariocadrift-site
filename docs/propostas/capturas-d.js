// Capturas da proposta D: desktop inteira + primeira dobra, 390 inteira + dobra, 375 inteira, header e menu aberto.
const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const url = 'http://localhost:8765/docs/propostas/d/';
const out = __dirname + '/capturas/';
(async () => {
  const browser = await chromium.launch(); const problemas = [];
  const abre = async (vp, mobile) => { const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile }); const p = await ctx.newPage(); const erros = []; p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); }); await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); await p.evaluate(() => document.fonts.ready); const l = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth })); if (l.s > l.i) problemas.push(`${vp.width}: rolagem horizontal ${l.s}`); if (erros.length) problemas.push(`${vp.width}: ${erros.join(' | ')}`); return { ctx, p }; };
  let { ctx, p } = await abre({ width: 1440, height: 900 }, false);
  await p.screenshot({ path: out + 'd-1440-dobra.png' }); await p.screenshot({ path: out + 'd-1440.png', fullPage: true });
  await p.locator('.top').screenshot({ path: out + 'd-header-desktop.png' }); await ctx.close();
  ({ ctx, p } = await abre({ width: 390, height: 844 }, true));
  await p.screenshot({ path: out + 'd-390-dobra.png' }); await p.screenshot({ path: out + 'd-390.png', fullPage: true });
  await p.locator('.top').screenshot({ path: out + 'd-header-mobile.png' });
  await p.click('#abrirMenu'); await p.waitForTimeout(300); await p.screenshot({ path: out + 'd-menu-aberto.png' }); await ctx.close();
  ({ ctx, p } = await abre({ width: 375, height: 812 }, true));
  await p.screenshot({ path: out + 'd-375.png', fullPage: true }); await ctx.close();
  await browser.close(); console.log('PROBLEMAS:', problemas.length ? problemas : 'nenhum');
})();
