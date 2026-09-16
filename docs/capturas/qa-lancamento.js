// QA de lançamento: fluxo do visitante (375/390/1440) e fluxo do painel com conta de teste.
// Uso: QA_EMAIL=... QA_SENHA=... node docs/capturas/qa-lancamento.js   (servidor local em :8765)
// Nunca imprime senhas. Dados criados são marcados "TESTE QA" e removidos pelo chamador.
const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const base = 'http://localhost:8765';
const out = __dirname + '/';
const R = { ok: [], falha: [], pendente: [] };
const ok = (m) => R.ok.push(m); const falha = (m) => R.falha.push(m);

(async () => {
  const browser = await chromium.launch();
  const novo = (vp, mobile) => browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile, permissions: ['clipboard-read', 'clipboard-write'] });

  // ---------- Visitante ----------
  for (const [nome, vp, mobile] of [['375', { width: 375, height: 812 }, true], ['390', { width: 390, height: 844 }, true], ['desktop', { width: 1440, height: 900 }, false]]) {
    const ctx = await novo(vp, mobile); const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/status of 409/.test(m.text())) erros.push(m.text()); }); p.on('response', r => { if (r.status() >= 400 && r.status() !== 409) erros.push(`HTTP ${r.status()} ${r.url()}`); });
    await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    // 1. identificar o próximo treino
    const card = await p.locator('#destaque').textContent();
    /Open Drift Session/.test(card) ? ok(`[${nome}] home identifica o próximo treino`) : falha(`[${nome}] card do próximo treino não mostra o evento`);
    /20/.test(card) && /9h às 18h/.test(card) && /RJ Race Park/.test(card) ? ok(`[${nome}] data, horário e local visíveis no card`) : falha(`[${nome}] data/horário/local ausentes no card`);
    /Ingressos no local/.test(card) ? ok(`[${nome}] ingressos no local visível`) : falha(`[${nome}] ingressos no local ausente`);
    /pilotos convidados/i.test(card) ? ok(`[${nome}] pista só pra convidados visível`) : falha(`[${nome}] regra de pilotos ausente`);
    /Caronas pagas/.test(card) ? ok(`[${nome}] caronas pagas visível`) : falha(`[${nome}] caronas pagas ausente`);
    // 2. ir pro evento pelo botão do card
    // E.2: no mobile só "Confirmar presença" fica visível; no desktop existe também "Ver o treino"
    const linkVisivel = p.locator('#destaque a.btn').filter({ visible: true }).first();
    (await linkVisivel.getAttribute('href')).startsWith('/treinos/open-drift-session/') ? ok(`[${nome}] botão visível do card leva ao evento`) : falha(`[${nome}] botão do card leva a ${await linkVisivel.getAttribute('href')}`);
    await linkVisivel.click(); await p.waitForURL(/\/treinos\/open-drift-session\//).catch(() => {}); await p.waitForTimeout(1200);
    (await p.locator('#treino').isVisible().catch(() => false)) ? ok(`[${nome}] página estática /treinos/open-drift-session/ renderiza o evento`) : falha(`[${nome}] página estática do evento não renderizou`);
    // versão com query (mesma página, usada pelo restante do roteiro)
    await p.goto(base + '/treinos/evento/?t=open-drift-session', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    (await p.locator('.participar .bloco.caronas .btn').getAttribute('href')).includes('instagram.com/cariocadrift_') ? ok(`[${nome}] "Consultar caronas" leva ao Instagram`) : falha(`[${nome}] botão de caronas errado`);
    // 3. confirmar interesse com telefone de teste
    const tel = nome === 'desktop' ? '21900000201' : nome === '390' ? '21900000202' : '21900000203';
    await p.fill('#nome', 'TESTE QA visitante'); await p.fill('#tel', tel);
    const mascara = await p.inputValue('#tel'); /^\(21\) 90000-020\d$/.test(mascara) ? ok(`[${nome}] máscara de telefone`) : falha(`[${nome}] máscara errada: ${mascara}`);
    await p.click('#enviar'); await p.waitForTimeout(2500);
    const okTitulo = await p.locator('#okTitulo').textContent();
    (await p.locator('#ok').evaluate(e => getComputedStyle(e).display)) === 'block' && /Interesse registrado/.test(okTitulo) ? ok(`[${nome}] confirmação envia e mostra "${okTitulo}"`) : falha(`[${nome}] confirmação não concluiu: ${okTitulo}`);
    // 3b. duplicado
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    await p.fill('#nome', 'TESTE QA visitante'); await p.fill('#tel', tel); await p.click('#enviar'); await p.waitForTimeout(2500);
    /já está na lista/i.test(await p.locator('#okTitulo').textContent()) ? ok(`[${nome}] telefone duplicado vira "Você já está na lista!"`) : falha(`[${nome}] duplicado não tratado`);
    // 4. compartilhar (sem Web Share no headless → copia o link)
    await p.click('#compartilhar2'); await p.waitForTimeout(500);
    const copiado = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    copiado === 'https://cariocadrift.com.br/treinos/open-drift-session/' ? ok(`[${nome}] compartilhar copia o link do evento`) : falha(`[${nome}] compartilhar copiou: "${copiado}"`);
    // 5. validação vazia
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1000); await p.click('#enviar'); await p.waitForTimeout(300);
    (await p.locator('#erroNome').textContent()).length && (await p.locator('#erroTel').textContent()).length ? ok(`[${nome}] validação de campos vazios`) : falha(`[${nome}] validação vazia não aparece`);
    // 6. escolinha: formulário com pacote grava
    if (nome === 'desktop') {
      await p.goto(base + '/escolinha/', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
      await p.click('[data-pacote="curso-chevette"]'); await p.waitForTimeout(300);
      (await p.inputValue('#pacote')) === 'curso-chevette' ? ok('escolinha: botão do pacote pré-seleciona a opção') : falha('escolinha: pré-seleção do pacote falhou');
      await p.fill('#nome', 'TESTE QA escolinha'); await p.fill('#tel', '21900000204'); await p.fill('#msg', 'Registro de teste do QA. Apagar.');
      await p.click('#enviar'); await p.waitForTimeout(2500);
      /na lista/i.test(await p.locator('#okTitulo').textContent()) && (await p.locator('#ok').evaluate(e => getComputedStyle(e).display)) === 'block' ? ok('escolinha: interesse gravado e confirmação exibida') : falha('escolinha: envio não concluiu');
      const q = await p.request.get('https://trkwfwvqzfvscqwwldpv.supabase.co/rest/v1/interessados_escolinha?select=nome&nome=eq.TESTE%20QA%20escolinha', { headers: { apikey: 'sb_publishable_CYYZ-iAogWrOfkRlKuROWg_KiAp2Jhm' } });
      q.status() === 200 && (await q.json()).length === 0 ? ok('escolinha: anon não lê a tabela de interessados (RLS)') : falha('escolinha: leitura anônima devolveu ' + q.status());
    }
    if (erros.length) falha(`[${nome}] erros de console/rede: ${erros.join(' | ')}`); else ok(`[${nome}] sem erros de console nem respostas de erro`);
    await ctx.close();
  }

  // ---------- Painel (conta de teste) ----------
  const email = process.env.QA_EMAIL, senha = process.env.QA_SENHA;
  if (!email || !senha) { R.pendente.push('painel: sem conta de teste'); }
  else {
    const ctx = await novo({ width: 1440, height: 900 }, false); const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); }); p.on('response', r => { if (r.status() >= 400) erros.push(`HTTP ${r.status()} ${r.url()}`); });
    await p.goto(base + '/admin/', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    await p.fill('#email', 'naoexiste@cariocadrift.com.br'); await p.fill('#senha', 'senha-errada-qa'); await p.click('#entrar'); await p.waitForTimeout(1500);
    /incorretos/.test(await p.locator('#erroLogin').textContent()) ? ok('painel: login errado mostra mensagem') : falha('painel: login errado sem mensagem');
    await p.fill('#email', email); await p.fill('#senha', senha); await p.click('#entrar'); await p.waitForTimeout(2500);
    if (await p.locator('#app').isHidden()) { falha('painel: login da conta de teste falhou: ' + await p.locator('#erroLogin').textContent()); }
    else {
      ok('painel: login com conta de teste autorizada');
      (await p.locator('#tbTreinos').textContent()).includes('Open Drift Session') ? ok('painel: lista de treinos carrega') : falha('painel: lista vazia');
      // criar rascunho
      await p.click('#novoTreino'); await p.waitForTimeout(300);
      await p.fill('[name=titulo]', 'TESTE QA Treino'); await p.fill('[name=slug]', 'teste-qa-treino');
      await p.fill('[name=data]', '2026-10-04'); await p.fill('[name=chamada]', 'Treino de teste do QA. Apagar.');
      await p.setInputFiles('[name=pista_file]', __dirname + '/../../assets/pista.jpg');
      await p.click('#salvar'); await p.waitForTimeout(4000);
      const msg = await p.locator('#msgForm').textContent();
      /rascunho/i.test(msg) ? ok(`painel: criação de treino com upload de foto ("${msg}")`) : falha(`painel: salvar falhou: ${msg}`);
      const fotoUrl = await p.inputValue('[name=pista_foto_url]');
      /supabase\.co\/storage\/v1\/object\/public\/fotos\/treinos\/teste-qa-treino\//.test(fotoUrl) ? ok('painel: foto enviada ao storage com URL pública') : falha('painel: URL da foto inesperada: ' + fotoUrl);
      const rf = await p.request.get(fotoUrl); rf.status() === 200 ? ok('painel: foto pública acessível') : falha('painel: foto não acessível ' + rf.status());
      // rascunho não aparece no público
      const pub = await p.request.get('https://trkwfwvqzfvscqwwldpv.supabase.co/rest/v1/treinos?select=slug&slug=eq.teste-qa-treino', { headers: { apikey: 'sb_publishable_CYYZ-iAogWrOfkRlKuROWg_KiAp2Jhm' } });
      (await pub.json()).length === 0 ? ok('painel: rascunho invisível para o público') : falha('painel: rascunho vazou para o público');
      // editar e publicar
      await p.fill('[name=chamada]', 'Treino de teste do QA, editado.'); await p.check('[name=publicado]'); await p.click('#salvar'); await p.waitForTimeout(3000);
      /publicado/i.test(await p.locator('#msgForm').textContent()) ? ok('painel: edição e publicação') : falha('painel: publicar falhou');
      const pub2 = await (await p.request.get('https://trkwfwvqzfvscqwwldpv.supabase.co/rest/v1/treinos?select=slug,chamada&slug=eq.teste-qa-treino', { headers: { apikey: 'sb_publishable_CYYZ-iAogWrOfkRlKuROWg_KiAp2Jhm' } })).json();
      pub2.length === 1 && /editado/.test(pub2[0].chamada) ? ok('painel: treino publicado visível ao público com a edição') : falha('painel: publicado não apareceu');
      // aparece na agenda e a home continua com o 20.09 como próximo
      const p2 = await ctx.newPage(); await p2.goto(base + '/treinos/', { waitUntil: 'networkidle' }); await p2.waitForTimeout(1500);
      (await p2.locator('#agenda').textContent()).includes('TESTE QA Treino') ? ok('agenda: treino publicado aparece') : falha('agenda: treino publicado não aparece');
      await p2.goto(base + '/', { waitUntil: 'networkidle' }); await p2.waitForTimeout(1500);
      (await p2.locator('#destaque').textContent()).includes('Open Drift Session') ? ok('home: próximo treino continua sendo o 20.09 (ordem por data)') : falha('home: próximo treino trocou indevidamente');
      await p2.close();
      // despublicar pela lista, ver confirmações e escolinha, apagar
      await p.click('#voltar'); await p.waitForTimeout(1500);
      const linha = p.locator('#tbTreinos tr', { hasText: 'TESTE QA Treino' });
      await linha.locator('button[data-pub]').click(); await p.waitForTimeout(2000);
      (await p.locator('#tbTreinos tr', { hasText: 'TESTE QA Treino' }).textContent()).includes('Rascunho') ? ok('painel: despublicar pela lista') : falha('painel: despublicar falhou');
      await p.click('[data-aba=confirmacoes]'); await p.waitForTimeout(2000);
      (await p.locator('#tbConf').textContent()).includes('TESTE QA') ? ok('painel: confirmações listam os registros de teste') : falha('painel: confirmações não listam');
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('#csvConf')]);
      dl ? ok(`painel: CSV de confirmações baixa (${dl.suggestedFilename()})`) : falha('painel: CSV não baixou');
      await p.click('[data-aba=escolinha]'); await p.waitForTimeout(2000);
      (await p.locator('#tbEsc').textContent()).includes('TESTE QA') ? ok('painel: interessados da escolinha listam com pacote') : falha('painel: escolinha não lista');
      const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('#csvEsc')]);
      dl2 ? ok(`painel: CSV da escolinha baixa (${dl2.suggestedFilename()})`) : falha('painel: CSV escolinha não baixou');
      await p.click('[data-aba=treinos]'); await p.waitForTimeout(500);
      p.once('dialog', d => d.accept());
      await p.locator('#tbTreinos tr', { hasText: 'TESTE QA Treino' }).locator('button[data-apagar]').click(); await p.waitForTimeout(2500);
      !(await p.locator('#tbTreinos').textContent()).includes('TESTE QA Treino') ? ok('painel: apagar treino') : falha('painel: apagar falhou');
      await p.click('#sair'); await p.waitForTimeout(1000);
      (await p.locator('#login').isVisible()) ? ok('painel: sair volta ao login') : falha('painel: sair não funcionou');
      await p.screenshot({ path: out + 'qa-painel-final.png' });
    }
    if (erros.length) falha('painel: erros de console: ' + erros.join(' | ')); else ok('painel: sem erros de console');
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
