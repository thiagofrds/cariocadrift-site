// QA de ponta a ponta da Carona Radical: formulário no site (local, banco de produção) → aba Carona Radical do painel.
// Uso: QA_EMAIL=... QA_SENHA=... node docs/capturas/qa-carona.js   (registros "TESTE QA carona*" apagados por qa-conta.js apagar)
const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const base = 'http://localhost:8765', out = path.join(__dirname, 'e2');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const S = env.SUPABASE_SECRET_KEY, URL = 'https://trkwfwvqzfvscqwwldpv.supabase.co/rest/v1';
const R = { ok: [], falha: [] }; const ok = m => R.ok.push(m), falha = m => R.falha.push(m);
const TEL = { evento: '21900019011', geral: '21900019012' };
(async () => {
  const b = await chromium.launch();
  // limpeza prévia de rodadas anteriores
  await fetch(`${URL}/interessados_carona?telefone=in.(${Object.values(TEL).join(',')})`, { method: 'DELETE', headers: { apikey: S, Authorization: `Bearer ${S}` } });
  await fetch(`${URL}/tentativas_carona?telefone=in.(${Object.values(TEL).join(',')})`, { method: 'DELETE', headers: { apikey: S, Authorization: `Bearer ${S}` } });
  for (const [nome, vp, mob, tel, url] of [['m390', { width: 390, height: 844 }, true, TEL.evento, '/caronas/?treino=open-drift-session'], ['d1440', { width: 1440, height: 900 }, false, TEL.geral, '/caronas/']]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: mob, hasTouch: mob }); const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    await p.goto(base + url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    (await p.locator('#cartaoLista').isVisible()) && !(await p.locator('#cartaoEmBreve').isVisible()) ? ok(`[${nome}] formulário visível, aviso "em breve" oculto`) : falha(`[${nome}] formulário não apareceu`);
    if (url.includes('treino=')) (/Open Drift Session/.test(await p.locator('#treinoAlvoForm').textContent()) ? ok(`[${nome}] treino de origem identificado no formulário`) : falha(`[${nome}] treino de origem ausente`));
    await p.click('#enviar'); await p.waitForTimeout(300);
    (await p.locator('#erroNome').textContent()).length && (await p.locator('#erroTel').textContent()).length && (await p.locator('#erroConsent').textContent()).length ? ok(`[${nome}] validação de nome, telefone e consentimento`) : falha(`[${nome}] validação falhou`);
    await p.fill('#nome', 'TESTE QA carona ' + nome); await p.fill('#tel', tel); await p.check('#consent');
    await p.screenshot({ path: path.join(out, `carona-form-preenchido-${nome}.png`) });
    await p.click('#enviar'); await p.waitForTimeout(2500);
    const okVis = await p.locator('#ok').evaluate(e => getComputedStyle(e).display) === 'block', okTxt = await p.locator('#ok').textContent();
    okVis && /Interesse registrado!/.test(okTxt) && /não garante vaga/.test(okTxt) ? ok(`[${nome}] envio concluído com a mensagem exata`) : falha(`[${nome}] envio não concluiu: ${okTxt.slice(0, 80)}`);
    await p.screenshot({ path: path.join(out, `carona-form-ok-${nome}.png`) });
    const rows = await fetch(`${URL}/interessados_carona?select=nome,evento,consentimento,origem&telefone=eq.${tel}`, { headers: { apikey: S, Authorization: `Bearer ${S}` } }).then(r => r.json());
    rows.length === 1 && rows[0].consentimento && rows[0].origem === 'site' && rows[0].evento === (url.includes('treino=') ? 'open-drift-session' : null) ? ok(`[${nome}] registro gravado com treino=${rows[0].evento} e consentimento`) : falha(`[${nome}] registro inesperado: ${JSON.stringify(rows)}`);
    // reenvio: duplicata silenciosa, mesma mensagem
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    await p.fill('#nome', 'TESTE QA carona repetido'); await p.fill('#tel', tel); await p.check('#consent'); await p.click('#enviar'); await p.waitForTimeout(2500);
    /Interesse registrado!/.test(await p.locator('#ok').textContent()) ? ok(`[${nome}] reenvio do mesmo telefone mostra a mesma confirmação`) : falha(`[${nome}] reenvio com resposta diferente`);
    (await fetch(`${URL}/interessados_carona?select=id&telefone=eq.${tel}`, { headers: { apikey: S, Authorization: `Bearer ${S}` } }).then(r => r.json())).length === 1 ? ok(`[${nome}] reenvio não gravou linha nova`) : falha(`[${nome}] reenvio gravou linha`);
    erros.length ? falha(`[${nome}] console: ${erros.join(' | ')}`) : ok(`[${nome}] sem erros de console`);
    await ctx.close();
  }
  // ---------- painel: Leads › Carona Radical ----------
  const email = process.env.QA_EMAIL, senha = process.env.QA_SENHA;
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  await p.goto(base + '/admin/', { waitUntil: 'networkidle' }); await p.fill('#email', email); await p.fill('#senha', senha); await p.click('#entrar'); await p.waitForTimeout(2500);
  await p.click('[data-aba=leads]'); await p.waitForTimeout(1200); await p.click('[data-sub=carona]'); await p.waitForTimeout(2000);
  let txt = await p.locator('#tbCarona').textContent();
  /TESTE QA carona m390/.test(txt) && /TESTE QA carona d1440/.test(txt) && /Open Drift Session/.test(txt) && /Interesse geral/.test(txt) && /Site · Carona Radical/.test(txt) ? ok('painel: os dois registros aparecem com origem e treino/geral') : falha('painel: registros não listados: ' + txt.slice(0, 120));
  await p.screenshot({ path: path.join(out, 'admin-leads-carona-lista.png') });
  await p.fill('#buscaLeads', 'd1440'); await p.waitForTimeout(400); txt = await p.locator('#tbCarona').textContent();
  /d1440/.test(txt) && !/m390/.test(txt) ? ok('painel: pesquisa por nome filtra') : falha('painel: pesquisa não filtrou');
  await p.fill('#buscaLeads', TEL.evento.slice(6)); await p.waitForTimeout(600);   // fragmento exclusivo do telefone do m390 await p.waitForTimeout(400); txt = await p.locator('#tbCarona').textContent();
  /m390/.test(txt) && !/d1440/.test(txt) ? ok('painel: pesquisa por telefone filtra') : falha('painel: pesquisa por telefone não filtrou');
  await p.fill('#buscaLeads', ''); await p.selectOption('#filtroTreino', 'open-drift-session'); await p.waitForTimeout(400); txt = await p.locator('#tbCarona').textContent();
  /m390/.test(txt) && !/d1440/.test(txt) ? ok('painel: filtro por treino mostra só o interesse do Open Drift Session') : falha('painel: filtro por treino errado');
  await p.selectOption('#filtroTreino', ''); await p.waitForTimeout(300);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('#csvCarona')]);
  if (dl) { const csv = fs.readFileSync(await dl.path(), 'utf8'); /"nome","telefone","treino","origem","consentimento","quando"/.test(csv) && /TESTE QA carona m390/.test(csv) && /site-carona/.test(csv) ? ok(`painel: CSV da carona baixa com cabeçalho e registros (${dl.suggestedFilename()})`) : falha('painel: CSV sem conteúdo esperado'); } else falha('painel: CSV não baixou');
  p.once('dialog', d => d.accept());
  await p.locator('#tbCarona tr', { hasText: 'TESTE QA carona d1440' }).locator('button[data-del]').click(); await p.waitForTimeout(2000);
  !/d1440/.test(await p.locator('#tbCarona').textContent()) ? ok('painel: apagar registro da carona') : falha('painel: apagar falhou');
  (await fetch(`${URL}/interessados_carona?select=id&telefone=eq.${TEL.geral}`, { headers: { apikey: S, Authorization: `Bearer ${S}` } }).then(r => r.json())).length === 0 ? ok('painel: exclusão refletida no banco') : falha('painel: registro ainda no banco');
  await p.click('#sair'); await ctx.close(); await b.close();
  // limpeza
  const d = await fetch(`${URL}/interessados_carona?telefone=in.(${Object.values(TEL).join(',')})`, { method: 'DELETE', headers: { apikey: S, Authorization: `Bearer ${S}`, Prefer: 'return=representation' } }).then(r => r.json());
  const t = await fetch(`${URL}/tentativas_carona?telefone=in.(${Object.values(TEL).join(',')})`, { method: 'DELETE', headers: { apikey: S, Authorization: `Bearer ${S}`, Prefer: 'return=representation' } }).then(r => r.json());
  ok(`limpeza: ${d.length} registro(s) e ${t.length} tentativa(s) de teste apagados`);
  console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
