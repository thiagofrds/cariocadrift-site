// Jornada completa do Clube no DEV, pela prévia local: entrar → solicitar associação → admin aprova → área de membro →
// admin encerra. Roda no desktop (1440) e no celular (390), com capturas de cada passo em docs/capturas/dev/jornada-*.png.
// A criação da conta pela tela depende do código por e-mail (ver ETAPA-B-PLANO §9); aqui a conta de QA já existe.
// Uso: QA_SENHAS_DIR=... node docs/capturas/qa-jornada-dev.js
const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const BASE = process.env.QA_BASE || 'http://localhost:8766', DIR = process.env.QA_SENHAS_DIR, OUT = path.join(__dirname, 'dev');
const senha = u => fs.readFileSync(path.join(DIR, 'senha-qa-' + u), 'utf8').trim();
const ADMIN = 'qa-dev-admin@cariocadrift.com.br', PILOTO = 'qa-dev-piloto@cariocadrift.com.br', PILOTO_ID = '33fabc2e-6abc-47aa-8ac3-6aad0024ccc2';
const res = []; const ok = (n, c, x) => { res.push(c); console.log((c ? 'OK    ' : 'FALHA ') + n + (x !== undefined ? '  · ' + x : '')); };
(async () => {
  const b = await chromium.launch();
  for (const mobile of [false, true]) {
    const tag = mobile ? 'm390' : 'd1440', dialogs = []; let resposta = null;
    const ctx = async () => { const c = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, locale: 'pt-BR' }); const p = await c.newPage(); p.on('dialog', d => { dialogs.push(d.message()); d.accept(resposta || undefined); }); return [c, p]; };
    const shot = (p, n) => p.screenshot({ path: path.join(OUT, `jornada-${n}-${tag}.png`), fullPage: true });
    const ir = (p, u) => p.goto(BASE + u + (u.includes('?') ? '&' : '?') + 'env=dev', { waitUntil: 'networkidle' });
    const visivel = (p, id) => p.$eval('#' + id, e => !e.hidden && e.offsetParent !== null).catch(() => false);
    console.log(`\n== ${mobile ? 'celular 390' : 'desktop 1440'}`);
    // 1. usuário entra e pede associação pelo Club
    let [c, p] = await ctx();
    await ir(p, '/clube/'); ok(`${tag} 1. visitante vê a entrada do Club com "Criar conta ou entrar"`, await visivel(p, 'entrada') && (await p.textContent('#entradaAcoes')).includes('Criar conta')); await shot(p, '1-club-visitante');
    await ir(p, '/conta/'); await p.fill('#lEmail', PILOTO); await p.fill('#lSenha', senha('piloto')); await shot(p, '2-entrar'); await p.click('#entrar'); await p.waitForTimeout(2500);
    ok(`${tag} 2. entra em Minha Conta`, await visivel(p, 'minhaConta'));
    await ir(p, '/clube/'); const st0 = await visivel(p, 'status');
    if (st0) { await p.click('#denovo'); } else { await p.click('#irSolicitar'); } await p.waitForTimeout(600);
    ok(`${tag} 3. tela de solicitar mostra nome e @`, await visivel(p, 'solicitar') && (await p.textContent('#solNome')).includes('@qapiloto'));
    await p.fill('#solMsg', `Jornada ${tag}: quero fazer parte do Club.`); await shot(p, '3-solicitar'); await p.click('#solEnviar'); await p.waitForTimeout(2500);
    ok(`${tag} 4. pedido enviado → "Solicitação em análise" com jornada`, (await p.textContent('#stTitulo')) === 'Solicitação em análise' && (await p.textContent('#stJornada')).includes('Decisão da organização')); await shot(p, '4-pendente');
    await c.close();
    // 2. admin aprova
    [c, p] = await ctx();
    await ir(p, '/admin/'); await p.fill('#email', ADMIN); await p.fill('#senha', senha('admin')); await p.click('#entrar'); await p.waitForTimeout(3000);
    await p.click('[data-aba=clube]'); await p.waitForTimeout(2500);
    ok(`${tag} 5. painel lista o pedido com a mensagem`, (await p.textContent('#tbPendentes')).includes(`Jornada ${tag}`)); await shot(p, '5-admin-pendente');
    await p.click(`button[data-aprovar="${PILOTO_ID}"]`); await p.waitForTimeout(2500); await p.click('[data-csub=membros]'); await p.waitForTimeout(400);
    ok(`${tag} 6. aprovado → Membros`, (await p.textContent('#tbMembros')).includes('@qapiloto') && (await p.textContent('#tbMembros')).includes('Membro')); await shot(p, '6-admin-membros');
    await c.close();
    // 3. usuário acessa a área de membro
    [c, p] = await ctx();
    await ir(p, '/conta/'); await p.fill('#lEmail', PILOTO); await p.fill('#lSenha', senha('piloto')); await p.click('#entrar'); await p.waitForTimeout(2500);
    ok(`${tag} 7. Minha Conta mostra Membro com link para a área`, (await p.textContent('#clubeStatus')) === 'Membro' && (await p.textContent('#clubeAcoes')).includes('Entrar na área')); await shot(p, '7-conta-membro');
    await ir(p, '/clube/'); ok(`${tag} 8. área do membro com cartão`, await visivel(p, 'membro') && (await p.textContent('#mHandle')) === 'qapiloto'); await shot(p, '8-club-membro');
    await c.close();
    // 4. admin encerra
    [c, p] = await ctx();
    await ir(p, '/admin/'); await p.fill('#email', ADMIN); await p.fill('#senha', senha('admin')); await p.click('#entrar'); await p.waitForTimeout(3000);
    await p.click('[data-aba=clube]'); await p.waitForTimeout(2500); await p.click('[data-csub=membros]'); await p.waitForTimeout(400);
    resposta = `Encerramento da jornada ${tag}`; await p.click(`button[data-encerrar="${PILOTO_ID}"]`); await p.waitForTimeout(2500); resposta = null;
    ok(`${tag} 9. encerrada no painel`, (await p.textContent('#tbMembros')).includes('Encerrada')); await p.click('[data-csub=historico]'); await p.waitForTimeout(300); await shot(p, '9-admin-historico');
    ok(`${tag} 10. histórico tem aprovada e encerrada`, (await p.textContent('#tbHistorico')).includes('aprovada') && (await p.textContent('#tbHistorico')).includes('encerrada'));
    await c.close();
    // 5. usuário vê o encerramento
    [c, p] = await ctx();
    await ir(p, '/conta/'); await p.fill('#lEmail', PILOTO); await p.fill('#lSenha', senha('piloto')); await p.click('#entrar'); await p.waitForTimeout(2500);
    ok(`${tag} 11. Minha Conta: Encerrada com motivo`, (await p.textContent('#clubeStatus')) === 'Encerrada' && (await p.textContent('#clubeTxt')).includes(`jornada ${tag}`));
    await ir(p, '/clube/'); ok(`${tag} 12. Club: "Associação encerrada", pode pedir de novo`, (await p.textContent('#stTitulo')) === 'Associação encerrada' && !!(await p.$('#denovo'))); await shot(p, '10-club-encerrada');
    await c.close();
  }
  await b.close();
  const f = res.filter(x => !x).length; console.log(`\n${res.length - f}/${res.length} casos OK`); process.exit(f ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(2); });
