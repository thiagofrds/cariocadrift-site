// Capturas reais + medições da E.2 aplicada nas páginas reais (servidor local em :8765).
// Uso: node docs/capturas/capturas-e2.js   → docs/capturas/e2/*.png e relatório JSON no stdout
const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const base = 'http://localhost:8765';
const out = path.join(__dirname, 'e2'); fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (f.endsWith('.png')) fs.unlinkSync(path.join(out, f));
const R = { ok: [], falha: [] };
const ok = m => R.ok.push(m), falha = m => R.falha.push(m);
const paginas = { home: '/', treinos: '/treinos/', evento: '/treinos/evento/?t=open-drift-session', escolinha: '/escolinha/', caronas: '/caronas/', sobre: '/sobre/', naoexiste: '/treinos/evento/?t=slug-que-nao-existe' };
const vps = { d1440: [{ width: 1440, height: 900 }, false], m390: [{ width: 390, height: 844 }, true], m375: [{ width: 375, height: 812 }, true], m360: [{ width: 360, height: 640 }, true] };

(async () => {
  const browser = await chromium.launch();
  for (const [vn, [vp, mobile]] of Object.entries(vps)) {
    for (const [pn, url] of Object.entries(paginas)) {
      if (vn === 'm360' && pn !== 'home' && pn !== 'evento') continue;
      if (vn === 'm375' && (pn === 'naoexiste' || pn === 'caronas')) continue;
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
      const p = await ctx.newPage(); const erros = [];
      p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); }); p.on('pageerror', e => erros.push('pageerror: ' + e.message));
      await p.goto(base + url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); await p.evaluate(() => document.fonts.ready);
      const tag = `${pn}-${vn}`;
      // rolagem horizontal
      const l = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth }));
      l.s > l.i ? falha(`${tag}: rolagem horizontal ${l.s}>${l.i}`) : ok(`${tag}: sem rolagem horizontal`);
      // console
      erros.length ? falha(`${tag}: console: ${erros.join(' | ')}`) : ok(`${tag}: sem erros de console`);
      // primeira dobra (home e evento): logo, título do evento e botão visíveis sem rolar
      if (pn === 'home' || pn === 'evento') {
        const sel = pn === 'home' ? { logo: '.hero .marca .logo', titulo: '#destaque h2', botao: '#destaque .btn.am' } : { logo: '.top .logo', titulo: '.hero h1', botao: '.hero .acoes .btn.am' };
        const m = await p.evaluate(sel => { const r = {}; for (const [k, s] of Object.entries(sel)) { const e = document.querySelector(s); r[k] = e ? Math.round(e.getBoundingClientRect().bottom) : null; } return r; }, sel);
        const dentro = Object.entries(m).filter(([k, v]) => v !== null && v <= vp.height).map(([k]) => k);
        m.botao !== null && m.botao <= vp.height ? ok(`${tag}: botão principal na primeira dobra (fundo em ${m.botao}px de ${vp.height})`) : falha(`${tag}: botão principal fora da primeira dobra (${JSON.stringify(m)})`);
        m.titulo !== null && m.titulo <= vp.height ? ok(`${tag}: título do evento na primeira dobra`) : falha(`${tag}: título do evento fora da dobra (${m.titulo})`);
      }
      // créditos: toda figure.foto com "Sergio Photos RJ"
      const cred = await p.evaluate(() => { const fs = [...document.querySelectorAll('figure.foto')]; return { total: fs.length, sem: fs.filter(f => !/Sergio Photos RJ/.test(f.textContent) && !f.closest('.hero') ).length, semHero: fs.filter(f => f.closest('.hero') && !/Sergio Photos RJ/.test(f.textContent) && !f.querySelector('.quadro img[src*="supabase"]')).length }; });
      if (cred.total) (cred.sem + cred.semHero) === 0 ? ok(`${tag}: ${cred.total} fotos com crédito Sergio Photos RJ`) : falha(`${tag}: ${cred.sem + cred.semHero} foto(s) sem crédito`);
      // marca d'água: nenhuma foto do acervo com object-position que corte a base (aceita "center bottom" ou auto)
      const corte = await p.evaluate(() => [...document.querySelectorAll('img[src*="/assets/fotos/"]')].filter(i => { const cs = getComputedStyle(i); return cs.objectFit === 'cover' && !/100%$|bottom/.test(cs.objectPosition); }).map(i => i.getAttribute('src')));
      corte.length ? falha(`${tag}: fotos com recorte que pode cobrir a base: ${corte.join(', ')}`) : ok(`${tag}: nenhuma foto do acervo recortada na base`);
      // conteúdo do evento
      if (pn === 'home' || pn === 'evento') {
        const txt = await p.locator('main').textContent();
        for (const [k, re] of Object.entries({ 'data 20.09': /20\.09/, 'horário 9h às 18h': /9h às 18h/, 'RJ Race Park': /RJ Race Park/, 'Ingressos no local': /Ingressos no local/i, 'pilotos convidados': /pilotos convidados/i, 'Caronas pagas': /Caronas pagas/i, 'Capacete': /Capacete/i, 'Open Drift Session': /Open Drift Session/ }))
          re.test(txt) ? ok(`${tag}: "${k}" presente`) : falha(`${tag}: "${k}" ausente`);
        /Comprar ingresso|checkout|Inscrever/i.test(txt) ? falha(`${tag}: texto de checkout ou inscrição indevido`) : ok(`${tag}: sem checkout nem inscrição pública`);
      }
      // refinamentos: instagram novo em todo lugar, sem o antigo; créditos do fotógrafo preservados
      const html = await p.content();
      /cariocadrift_[^a-z]/.test(html) ? falha(`${tag}: ainda há @cariocadrift_ antigo`) : ok(`${tag}: sem o Instagram antigo`);
      const igLinks = await p.evaluate(() => [...document.querySelectorAll('a[href*="instagram.com"]')].map(a => a.getAttribute('href')).filter(h => !/instagram\.com\/(reel|p)\//.test(h)));  // reels/posts do banco (ex.: vídeo da pista) não são o perfil
      igLinks.length && igLinks.every(h => h === 'https://www.instagram.com/cariocadriftculture/') ? ok(`${tag}: ${igLinks.length} link(s) do Instagram apontam para @cariocadriftculture`) : (igLinks.length ? falha(`${tag}: links do Instagram divergentes: ${[...new Set(igLinks)].join(', ')}`) : ok(`${tag}: sem links de Instagram`));
      if (pn === 'home') {
        const mapa = await p.evaluate(() => { const i = document.querySelector('.onde img'); i.scrollIntoView(); return { nat: i.naturalWidth / i.naturalHeight, ren: i.clientWidth / i.clientHeight, fit: getComputedStyle(i).objectFit, cortado: i.clientWidth < i.naturalWidth * 0 }; });
        Math.abs(mapa.nat - mapa.ren) < 0.01 && mapa.fit !== 'cover' ? ok(`${tag}: mapa inteiro, proporção preservada (${mapa.ren.toFixed(3)} vs ${mapa.nat.toFixed(3)})`) : falha(`${tag}: mapa cortado: ${JSON.stringify(mapa)}`);
        const esc = await p.locator('.escola').textContent();
        !/R\$|10x|módulos|Chevette|Nissan/.test(esc) && /estruturação/.test(esc) && /sob consulta/i.test(esc) ? ok(`${tag}: escolinha na home sem preços, com "em estruturação" e "Valores sob consulta"`) : falha(`${tag}: bloco da escolinha na home ainda comercial`);
        (await p.locator('#participar a[href="/caronas/"]').count()) === 1 ? ok(`${tag}: "Consultar caronas" leva a /caronas/`) : falha(`${tag}: link de caronas não aponta para /caronas/`);
        const part = await p.locator('#participar').textContent();
        /R\$ 30/.test(part) && /R\$ 15/.test(part) && /R\$ 80/.test(part) && /sob consulta/i.test(part) && /no local/i.test(part) ? ok(`${tag}: resumo de valores (30/15/80, caronas sob consulta, venda no local)`) : falha(`${tag}: resumo de valores incompleto`);
        await p.locator('.onde').screenshot({ path: path.join(out, `${tag}-mapa.png`) });
      }
      if (pn === 'evento') {
        const val = await p.locator('#valores').textContent().catch(() => '');
        /R\$ 30/.test(val) && /R\$ 15/.test(val) && /R\$ 80/.test(val) && /Sob consulta/.test(val) && /somente no local/i.test(val) && /exclusiva para pilotos convidados/i.test(val) && !/por veículo|por pessoa|por período/i.test(val) ? ok(`${tag}: bloco de valores completo, estacionamento sem especificação`) : falha(`${tag}: bloco de valores incompleto`);
        (await p.locator('.participar a[href="/caronas/"]').count()) === 1 ? ok(`${tag}: "Consultar caronas" leva a /caronas/`) : falha(`${tag}: link de caronas do evento errado`);
      }
      if (pn === 'caronas') {
        const t = await p.locator('main').textContent();
        /paga/i.test(t) && /disponibilidade/i.test(t) && /confirma/i.test(t) && /direct/i.test(t) && !/R\$/.test(t) && !/garantid[ao] /i.test(t.replace('Não há reserva garantida','')) ? ok(`${tag}: caronas pagas, sujeitas a disponibilidade e confirmação, sem preço nem reserva garantida`) : falha(`${tag}: texto de caronas fora da regra`);
        (await p.locator('a.btn.am[href="https://www.instagram.com/cariocadriftculture/"]').count()) === 1 ? ok(`${tag}: CTA de contato pelo canal oficial`) : falha(`${tag}: CTA de contato ausente`);
      }
      if (pn === 'naoexiste') (await p.locator('#naoAchado').isVisible()) ? ok(`${tag}: slug inexistente mostra "Treino não encontrado"`) : falha(`${tag}: slug inexistente sem estado de erro`);
      await p.screenshot({ path: path.join(out, `${tag}-dobra.png`) });
      if (pn !== 'naoexiste') await p.screenshot({ path: path.join(out, `${tag}.png`), fullPage: true });
      // menu mobile e dock
      if (mobile && pn === 'home' && vn === 'm390') {
        await p.click('#abrirMenu'); await p.waitForTimeout(400); await p.screenshot({ path: path.join(out, 'home-m390-menu.png') });
        const itens = await p.locator('#menuMobile li').allTextContents();
        /Ingressos/.test(itens.join()) && /Carioca Media/.test(itens.join()) && (await p.locator('#menuMobile .breve a').count()) === 0 ? ok('menu mobile: itens "em breve" presentes e sem link') : falha('menu mobile: itens em breve errados');
        await p.keyboard.press('Escape'); await p.waitForTimeout(300);
        (await p.evaluate(() => document.getElementById('menuMobile').hidden)) ? ok('menu mobile fecha com Escape') : falha('menu mobile não fechou');
        const d0 = await p.evaluate(() => document.getElementById('dock')?.classList.contains('on'));
        await p.evaluate(() => document.querySelector('.exp').scrollIntoView()); await p.waitForTimeout(600);
        const d1 = await p.evaluate(() => document.getElementById('dock')?.classList.contains('on'));
        await p.screenshot({ path: path.join(out, 'home-m390-dock.png') });
        await p.evaluate(() => document.querySelector('footer').scrollIntoView()); await p.waitForTimeout(600);
        const d2 = await p.evaluate(() => document.getElementById('dock')?.classList.contains('on'));
        (!d0 && d1 && !d2) ? ok('dock: escondida no hero, visível no meio, escondida no rodapé') : falha(`dock: hero=${d0} meio=${d1} rodapé=${d2}`);
        await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500); const topo0 = await p.evaluate(() => document.getElementById('topo').classList.contains('marca-oculta'));
        await p.evaluate(() => document.querySelector('.exp').scrollIntoView()); await p.waitForTimeout(500);
        const topo1 = await p.evaluate(() => document.getElementById('topo').classList.contains('marca-oculta'));
        (topo0 && !topo1) ? ok('cabeçalho mobile: logo do topo escondida no hero e visível ao rolar') : falha(`cabeçalho mobile: hero=${topo0} rolado=${topo1}`);
      }
      if (!mobile && pn === 'home') {
        const nav = await p.locator('.top nav li').allTextContents();
        nav.length === 6 && (await p.locator('.top nav .breve a').count()) === 0 ? ok('nav desktop: 6 itens, "em breve" sem link') : falha('nav desktop: ' + nav.join('|'));
        const cta = await p.locator('#navCta').textContent();
        /Treino 20\.09/.test(cta) ? ok(`nav desktop: CTA "${cta.trim()}"`) : falha(`nav desktop: CTA "${cta}"`);
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
