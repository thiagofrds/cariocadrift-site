const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const base = 'http://localhost:8765/docs/propostas/e1/'; const out = __dirname + '/capturas/';
(async () => {
  const browser = await chromium.launch(); const problemas = [];
  const abre = async (vp, mobile, url) => { const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile }); const p = await ctx.newPage(); const erros = []; p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); }); await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); await p.evaluate(() => document.fonts.ready); const l = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth })); if (l.s > l.i) problemas.push(`${vp.width}x${vp.height} ${url}: rolagem horizontal ${l.s}`); if (erros.length) problemas.push(`${vp.width}: ${erros.join(' | ')}`); return { ctx, p }; };
  let r = await abre({ width: 1440, height: 900 }, false, base);
  await r.p.screenshot({ path: out + 'e1-1440-dobra.png' }); await r.p.screenshot({ path: out + 'e1-1440.png', fullPage: true }); await r.ctx.close();
  r = await abre({ width: 1440, height: 900 }, false, base + '?hero=video'); await r.p.screenshot({ path: out + 'e1-1440-video-dobra.png' }); await r.ctx.close();
  // primeira dobra mobile em várias alturas: o botão principal precisa estar visível
  const dobras = [];
  for (const [w, h] of [[390, 844], [390, 700], [375, 812], [375, 667], [360, 640]]) {
    r = await abre({ width: w, height: h }, true, base);
    const v = await r.p.evaluate(() => { const b = document.getElementById('ctaHero').getBoundingClientRect(); const t = document.querySelector('.hero .evento h2').getBoundingClientRect(); return { botaoVisivel: b.bottom <= innerHeight, botaoBottom: Math.round(b.bottom), tituloVisivel: t.bottom <= innerHeight, altura: innerHeight }; });
    dobras.push(`${w}x${h}: título ${v.tituloVisivel ? 'ok' : 'FORA'}, botão ${v.botaoVisivel ? 'ok' : 'FORA'} (fim do botão em ${v.botaoBottom}px de ${v.altura})`);
    await r.p.screenshot({ path: out + `e1-${w}x${h}-dobra.png` });
    if (h === 844 || h === 812) await r.p.screenshot({ path: out + `e1-${w}.png`, fullPage: true });
    await r.ctx.close();
  }
  await browser.close(); console.log('DOBRAS:\n' + dobras.join('\n')); console.log('PROBLEMAS:', problemas.length ? problemas : 'nenhum');
})();
