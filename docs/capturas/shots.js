// Capturas reais + validação automática do site local (Playwright, chromium já instalado no Mac).
// Uso: node docs/capturas/shots.js   (servidor local em http://localhost:8765)
const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const base = 'http://localhost:8765';
const out = __dirname + '/';
const fs = require('fs');
for (const f of fs.readdirSync(out)) if (f.endsWith('.png')) fs.unlinkSync(out + f);

(async () => {
  const browser = await chromium.launch();
  const problemas = [];
  const ctxDe = (opts, extra = {}) => browser.newContext({ viewport: opts.viewport, deviceScaleFactor: 2, isMobile: !!opts.mobile, hasTouch: !!opts.mobile, ...extra });
  const abrir = async (ctx, url) => {
    const page = await ctx.newPage();
    const erros = [];
    page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    page.on('pageerror', e => erros.push('pageerror: ' + e.message));
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.fonts.ready);
    const larg = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
    if (larg.scroll > larg.inner) problemas.push(`${url} @${larg.inner}px: rolagem horizontal (${larg.scroll})`);
    if (erros.length) problemas.push(`${url} @${larg.inner}px: console: ${erros.join(' | ')}`);
    return page;
  };
  const shot = async (name, opts, url, fn) => {
    const ctx = await ctxDe(opts); const page = await abrir(ctx, url);
    if (fn) await fn(page); else await page.screenshot({ path: out + name + '.png', fullPage: true });
    await ctx.close();
  };
  const desk = { viewport: { width: 1440, height: 900 } };
  const m390 = { viewport: { width: 390, height: 844 }, mobile: true };
  const m375 = { viewport: { width: 375, height: 812 }, mobile: true };
  const evento = '/treinos/evento/?t=open-drift-session';

  // ---- Home ----
  await shot('home-desktop-1440', desk, '/');
  await shot('home-mobile-390', m390, '/');
  await shot('home-mobile-375', m375, '/');
  for (const [tag, o] of [['desktop', desk], ['mobile', m390]]) {
    await shot('sec-' + tag, o, '/', async p => {
      for (const [k, sel] of Object.entries({ hero: '.hero-home', proximo: '.proximo', exp: '.exp', escolinha: '.escola', instagram: '.insta-bloco', rodape: 'footer' })) {
        const el = p.locator(sel).first(); if (!(await el.count())) continue;
        await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(250); await el.screenshot({ path: out + `sec-${k}-${tag}.png` });
      }
    });
  }
  await shot('menu', m390, '/', async p => {
    await p.screenshot({ path: out + 'home-mobile-390-primeira-dobra.png' });
    await p.click('#abrirMenu'); await p.waitForTimeout(400);
    await p.screenshot({ path: out + 'menu-mobile-aberto.png' });
    await p.locator('#abrirMenu').screenshot({ path: out + 'menu-icone-x.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const fechado = await p.evaluate(() => document.getElementById('menuMobile').hidden);
    if (!fechado) problemas.push('menu mobile não fechou com Escape');
  });

  // ---- Página do treino ----
  await shot('treino-desktop-1440', desk, evento);
  await shot('treino-mobile-390', m390, evento);
  for (const [tag, o] of [['desktop', desk], ['mobile', m390]]) {
    await shot('tsec-' + tag, o, evento, async p => {
      for (const [k, sel] of Object.entries({ participar: '.participar', confirmar: '.confirmar', ficha: '.ficha' })) {
        const el = p.locator(sel).first(); if (!(await el.count())) { problemas.push(`treino: seção ${k} não encontrada`); continue; }
        await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(250); await el.screenshot({ path: out + `treino-${k}-${tag}.png` });
      }
      // estado de sucesso do formulário (sem enviar nada ao banco)
      await p.evaluate(() => { document.getElementById('formulario').style.display = 'none'; document.getElementById('ok').classList.add('on'); });
      await p.locator('.cartao').screenshot({ path: out + `treino-form-ok-${tag}.png` });
    });
  }

  // ---- Páginas compartilhadas ----
  for (const [n, u] of [['treinos', '/treinos/'], ['escolinha', '/escolinha/'], ['sobre', '/sobre/'], ['admin', '/admin/']]) {
    await shot(`pag-${n}-desktop`, desk, u);
    await shot(`pag-${n}-mobile`, m390, u);
  }

  // ---- Textos de botões e links (home + treino) ----
  const ctx = await ctxDe(m390); const page = await abrir(ctx, '/');
  const textos = await page.evaluate(() => ({
    navCta: document.getElementById('navCta').textContent + ' -> ' + document.getElementById('navCta').getAttribute('href'),
    heroCta: document.getElementById('heroCta').textContent + ' -> ' + document.getElementById('heroCta').getAttribute('href'),
    cardBotoes: [...document.querySelectorAll('#destaque .btn')].map(b => b.textContent + ' -> ' + b.getAttribute('href')),
    cardNota: document.querySelector('#destaque .nota-lista')?.textContent,
    cardAvisos: [...document.querySelectorAll('#destaque .avisos > span')].map(s => s.textContent.replace(/\s+/g, ' ').trim()),
    botoesQuebrando: [...document.querySelectorAll('.btn')].filter(b => b.getBoundingClientRect().height > 70).map(b => b.textContent.trim()),
    menuCtaRemovido: !document.getElementById('menuCta'),
  }));
  // links internos respondem?
  const links = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/"], a[href^="./"]')].map(a => a.getAttribute('href').split('#')[0]))]);
  for (const l of links) {
    if (/^\/treinos\/[a-z0-9-]+\/$/.test(l) && !l.includes('evento')) continue; // rota do 404.html, só no GitHub Pages
    const r = await page.request.get(base + l); if (r.status() !== 200) problemas.push(`link ${l} -> ${r.status()}`);
  }
  await ctx.close();
  const ctx2 = await ctxDe(m390); const p2 = await abrir(ctx2, evento);
  const textosTreino = await p2.evaluate(() => ({
    heroBotoes: [...document.querySelectorAll('.hero .btn')].map(b => b.textContent.trim()),
    participar: [...document.querySelectorAll('.participar .bloco')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
    seguranca: document.querySelector('.participar .seguranca')?.textContent.replace(/\s+/g, ' ').trim(),
    formSub: document.querySelector('#formulario .sub')?.textContent, formNota: document.querySelector('#formulario .nota')?.textContent,
    okTitulo: document.getElementById('okTitulo')?.textContent, okTexto: document.querySelector('#ok p')?.textContent,
    botoesQuebrando: [...document.querySelectorAll('.btn')].filter(b => b.getBoundingClientRect().height > 70).map(b => b.textContent.trim()),
  }));
  await ctx2.close();

  // ---- Simulação: um dia depois do treino ----
  const ctx3 = await ctxDe(m390); const p3 = await ctx3.newPage();
  await p3.clock.install({ time: new Date('2026-09-21T12:00:00-03:00') });
  await p3.goto(base + '/', { waitUntil: 'networkidle' }); await p3.waitForTimeout(1500);
  await p3.screenshot({ path: out + 'home-mobile-390-apos-evento.png' });
  const apos = await p3.evaluate(() => ({ nav: document.getElementById('navCta').textContent, hero: document.getElementById('heroCta').textContent, barraOculta: document.getElementById('barraContagem').hidden, card: document.getElementById('destaque').textContent.replace(/\s+/g, ' ').trim().slice(0, 80) }));
  await ctx3.close();
  await browser.close();

  console.log('TEXTOS HOME:', JSON.stringify(textos, null, 1));
  console.log('TEXTOS TREINO:', JSON.stringify(textosTreino, null, 1));
  console.log('APOS EVENTO:', JSON.stringify(apos));
  console.log('PROBLEMAS:', problemas.length ? problemas : 'nenhum');
})().catch(e => { console.error(e); process.exit(1); });
