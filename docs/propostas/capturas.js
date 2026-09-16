// Capturas reais das propostas A e B em 1440, 390 e 375 (Playwright, chromium local).
const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const base = 'http://localhost:8765/docs/propostas/';
const out = __dirname + '/capturas/';
require('fs').mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const problemas = [];
  for (const prop of ['a', 'b', 'c']) for (const [nome, vp, mobile] of [['1440', { width: 1440, height: 900 }, false], ['390', { width: 390, height: 844 }, true], ['375', { width: 375, height: 812 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage(); const erros = []; p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    await p.goto(`${base}${prop}/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); await p.evaluate(() => document.fonts.ready);
    const l = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth }));
    if (l.s > l.i) problemas.push(`${prop}@${nome}: rolagem horizontal ${l.s}`);
    if (erros.length) problemas.push(`${prop}@${nome}: ${erros.join(' | ')}`);
    await p.screenshot({ path: `${out}${prop}-${nome}.png`, fullPage: true });
    if (nome !== '1440') await p.screenshot({ path: `${out}${prop}-${nome}-dobra.png` });
    await ctx.close();
  }
  await browser.close();
  console.log('PROBLEMAS:', problemas.length ? problemas : 'nenhum');
})();
