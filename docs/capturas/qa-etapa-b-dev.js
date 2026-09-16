// QA real da etapa B contra o projeto Supabase DEV, pela prévia local (porta 8766, ?env=dev). Nunca toca produção.
// Contas: qa-dev-admin (admin legado, @qa_admin) e qa-dev-piloto (@ pendente ao nascer). Senhas lidas de QA_SENHAS_DIR, nunca impressas.
// Uso: QA_SENHAS_DIR=... node docs/capturas/qa-etapa-b-dev.js   → imprime os casos e grava capturas em docs/capturas/dev/
const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const BASE = process.env.QA_BASE || 'http://localhost:8766', DIR = process.env.QA_SENHAS_DIR, OUT = path.join(__dirname, 'dev');
if (!DIR) throw new Error('defina QA_SENHAS_DIR');
const senha = u => fs.readFileSync(path.join(DIR, 'senha-qa-' + u), 'utf8').trim();
const ADMIN = 'qa-dev-admin@cariocadrift.com.br', PILOTO = 'qa-dev-piloto@cariocadrift.com.br';
const res = []; const ok = (n, c, extra) => { res.push([c ? 'OK ' : 'FALHA', n, extra || '']); console.log((c ? 'OK    ' : 'FALHA ') + n + (extra ? '  · ' + extra : '')); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAF0lEQVR42mP8z8DwnwEJMDIwMFAdAADRJwX/8m3mDQAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const b = await chromium.launch();
  const ctx = async (mobile) => { const c = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, locale: 'pt-BR' }); const p = await c.newPage(); p.on('dialog', d => { dialogs.push(d.message()); d.accept(proximaResposta || undefined); }); return [c, p]; };
  let dialogs = [], proximaResposta = null;
  const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png'), fullPage: true });
  const ir = (p, u) => p.goto(BASE + u + (u.includes('?') ? '&' : '?') + 'env=dev', { waitUntil: 'networkidle' });
  const entrar = async (p, email, s) => { await ir(p, '/conta/'); await p.fill('#lEmail', email); await p.fill('#lSenha', s); await p.click('#entrar'); await p.waitForTimeout(2500); };
  const visivel = (p, id) => p.$eval('#' + id, e => !e.hidden && e.offsetParent !== null).catch(() => false);
  const rpc = (p, fn, args) => p.evaluate(async ([fn, args]) => { const r = await fetch(`${CD.SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: CD.SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) }); return { status: r.status, body: await r.json().catch(() => null) }; }, [fn, args]);

  // 1. ambiente e visitante
  let [c, p] = await ctx(false);
  await ir(p, '/conta/');
  ok('1.1 prévia usa o projeto DEV (?env=dev)', await p.evaluate(() => CD.ENV === 'dev' && /fswlocaiktcthuwyvccp/.test(CD.SB_URL) && CD.CONTAS_DISPONIVEIS));
  ok('1.2 visitante vê entrar/criar', await visivel(p, 'acesso') && !(await visivel(p, 'minhaConta')));
  let r = await rpc(p, 'handle_disponivel', { entrada: 'qa_admin' }); ok('1.3 @ ocupado devolve indisponível com sugestões', r.status === 200 && r.body.valido && !r.body.disponivel && r.body.sugestoes.length > 0, JSON.stringify(r.body.sugestoes));
  r = await rpc(p, 'handle_disponivel', { entrada: 'Admin' }); ok('1.4 @ reservado devolve indisponível', r.status === 200 && r.body.disponivel === false);
  r = await rpc(p, 'handle_disponivel', { entrada: 'Thiago Rodrigues!' }); ok('1.5 normalização: "Thiago Rodrigues!" → thiagorodrigues livre', r.status === 200 && r.body.handle === 'thiagorodrigues' && r.body.disponivel === true);
  r = await rpc(p, 'perfil_publico', { entrada: 'qa_admin' }); ok('1.6 perfil privado não aparece para visitante', r.status === 200 && r.body === null);
  r = await p.evaluate(async () => { const x = await fetch(`${CD.SB_URL}/rest/v1/usuarios?select=*`, { headers: { apikey: CD.SB_KEY } }); return x.status; }); ok('1.7 visitante não lê a tabela usuarios', r === 401 || r === 403 || r === 404, 'HTTP ' + r);
  // cadastro pela tela até o pedido do código (confirmação por e-mail ligada no DEV; SMTP padrão limitado)
  await p.click('text=Criar conta').catch(() => {});
  await shot(p, 'conta-acesso-d1440');
  await c.close();

  // 2. piloto: @ pendente → define @ → Minha Conta
  [c, p] = await ctx(false);
  await entrar(p, PILOTO, senha('piloto'));
  ok('2.1 conta com @ reservado nasce pendente e cai na tela de escolher @', await visivel(p, 'pendente'));
  await shot(p, 'conta-pendente-d1440');
  await p.fill('#pHandle', 'admin'); await p.click('#definirHandle'); await p.waitForTimeout(1200);
  ok('2.2 @ reservado recusado na definição', (await p.textContent('#pErro')).includes('reservado'));
  await p.fill('#pHandle', 'qa_admin'); await p.click('#definirHandle'); await p.waitForTimeout(1200);
  ok('2.3 @ de outro usuário recusado', /ocupado|indispon/i.test(await p.textContent('#pErro')));
  await p.fill('#pHandle', 'QA Piloto'); await p.click('#definirHandle'); await p.waitForTimeout(2000);
  ok('2.4 define @qapiloto e entra em Minha Conta', await visivel(p, 'minhaConta') && (await p.textContent('#mcArroba')) === '@qapiloto');
  // perfil
  await p.fill('#eApres', 'Piloto de teste da etapa B. Nada aqui é real.'); await p.fill('#eInsta', '@qa.piloto'); await p.fill('#eTel', '21999990000'); await p.click('#salvarPerfil'); await p.waitForTimeout(2000);
  ok('2.5 salva apresentação, Instagram e telefone', (await p.textContent('#eErro')) === 'Perfil salvo.' && (await p.inputValue('#eInsta')) === 'qa.piloto');
  // foto
  await p.setInputFiles('#avatarFile', { name: 'foto.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(3000);
  ok('2.6 envia foto para o bucket privado e mostra no perfil', await p.$eval('#avatarBox img', i => i.src.includes('/storage/v1/object/sign/avatares/')).catch(() => false));
  r = await p.evaluate(async () => { const s = supabase.createClient(CD.SB_URL, CD.SB_KEY); const { data: { session } } = await s.auth.getSession(); return session ? (await s.from('usuarios').update({ perfil_publico: true }).eq('id', session.user.id)).error?.code : 'sem sessão'; });
  ok('2.7 UPDATE direto em perfil_publico é negado (privilégio por coluna)', r === '42501', String(r));
  r = await p.evaluate(async () => { const s = supabase.createClient(CD.SB_URL, CD.SB_KEY); const { data: { session } } = await s.auth.getSession(); return (await s.from('usuarios').update({ handle: 'outro' }).eq('id', session.user.id)).error?.code; });
  ok('2.8 UPDATE direto em handle é negado', r === '42501', String(r));
  await shot(p, 'conta-minha-conta-d1440');
  // visibilidade
  ok('2.9 perfil nasce privado', !(await p.isChecked('#chavePublico')));
  await p.check('#chavePublico'); await p.waitForTimeout(2000);
  ok('2.10 liga perfil público (com confirmação)', await p.isChecked('#chavePublico') && (await p.textContent('#chaveTxt')) === 'Público');
  // clube: solicitar em Minha Conta
  proximaResposta = 'Quero fazer parte. Teste QA.'; await p.click('#solicitarAssoc'); await p.waitForTimeout(2000); proximaResposta = null;
  ok('2.11 solicita associação em Minha Conta → Pendente', (await p.textContent('#clubeStatus')) === 'Pendente');
  await p.click('#cancelarAssoc'); await p.waitForTimeout(2000);
  ok('2.12 cancela a solicitação → Cancelada', (await p.textContent('#clubeStatus')) === 'Cancelada');
  // clube: página do Club
  await ir(p, '/clube/');
  ok('2.13 /clube/ mostra status cancelada com "Solicitar de novo"', await visivel(p, 'status') && !!(await p.$('#denovo')));
  await shot(p, 'club-status-cancelada-d1440');
  await p.click('#denovo'); await p.waitForTimeout(500); await p.fill('#solMsg', 'Segundo pedido, pelo Club. Teste QA.'); await shot(p, 'club-solicitar-d1440'); await p.click('#solEnviar'); await p.waitForTimeout(2500);
  ok('2.14 solicita de novo pelo Club → pendente com jornada', await visivel(p, 'status') && (await p.textContent('#stTitulo')) === 'Solicitação em análise');
  await shot(p, 'club-status-pendente-d1440');
  // perfil público do piloto, como visitante
  const [c2, p2] = await ctx(false); await ir(p2, '/u/?h=qapiloto'); await p2.waitForTimeout(1500);
  ok('2.15 /u/qapiloto/ público: nome, @, Piloto, Instagram, foto assinada; sem selo de membro', await visivel(p2, 'perfil') && (await p2.textContent('#pArroba')) === '@qapiloto' && (await p2.textContent('#pTags')).includes('Piloto') && !(await p2.textContent('#pTags')).includes('Membro') && (await p2.$eval('#pFoto img', i => i.src.includes('/sign/avatares/')).catch(() => false)));
  await shot(p2, 'u-qapiloto-publico-d1440');
  await ir(p2, '/u/?h=qa_admin'); await p2.waitForTimeout(1500); ok('2.16 /u/qa_admin/ (privado) → "Perfil não disponível"', await visivel(p2, 'indisp'));
  await c2.close();
  await c.close();

  // 3. admin: painel, Clube, Usuários
  [c, p] = await ctx(false);
  await ir(p, '/admin/'); await p.fill('#email', ADMIN); await p.fill('#senha', senha('admin')); await p.click('#entrar'); await p.waitForTimeout(3000);
  ok('3.1 admin legado (tabela admins) entra no painel', await visivel(p, 'app'));
  await p.click('[data-aba=usuarios]'); await p.waitForTimeout(2500);
  ok('3.2 aba Usuários lista as duas contas; origem da permissão = legado', (await p.textContent('#tbUsuarios')).includes('@qapiloto') && (await p.textContent('#tbUsuarios')).includes('@qa_admin') && (await p.textContent('#origemAdmin')) === 'legado');
  await shot(p, 'admin-usuarios-d1440');
  proximaResposta = 'Teste QA: credencial de fotógrafo'; await p.click('button[data-con="33fabc2e-6abc-47aa-8ac3-6aad0024ccc2"][data-cap="fotografo"]'); await p.waitForTimeout(2500); proximaResposta = null;
  ok('3.3 concede "fotografo" ao piloto', !!(await p.$('button[data-rev="33fabc2e-6abc-47aa-8ac3-6aad0024ccc2"][data-cap="fotografo"]')));
  const selfCon = await p.$('button[data-con="1041eab8-81ce-437d-a43e-99839a95dfaa"][data-cap="admin"]');
  proximaResposta = 'tentativa'; if (selfCon) { await selfCon.click(); await p.waitForTimeout(2000); } const alerta = dialogs.find(d => /Não deu/.test(d)); proximaResposta = null;
  ok('3.4 admin não concede capacidade a si mesmo (função recusa)', !!alerta, alerta);
  await p.click('[data-aba=clube]'); await p.waitForTimeout(2500);
  ok('3.5 aba Clube mostra a solicitação pendente do piloto com a mensagem', (await p.textContent('#tbPendentes')).includes('@qapiloto') && (await p.textContent('#tbPendentes')).includes('Segundo pedido'));
  await shot(p, 'admin-clube-pendentes-d1440');
  await p.click('button[data-aprovar="33fabc2e-6abc-47aa-8ac3-6aad0024ccc2"]'); await p.waitForTimeout(2500);
  await p.click('[data-csub=membros]'); await p.waitForTimeout(500);
  ok('3.6 aprova → aparece em Membros como Membro', (await p.textContent('#tbMembros')).includes('@qapiloto') && (await p.textContent('#tbMembros')).includes('Membro'));
  await shot(p, 'admin-clube-membros-d1440');
  await p.click('[data-csub=historico]'); await p.waitForTimeout(500);
  ok('3.7 histórico registra "aprovada" por QA Admin', (await p.textContent('#tbHistorico')).includes('aprovada') && (await p.textContent('#tbHistorico')).includes('QA Admin'));
  await c.close();

  // 4. piloto membro: área do Club + selo no perfil público + Minha Conta
  [c, p] = await ctx(false);
  await entrar(p, PILOTO, senha('piloto'));
  ok('4.1 Minha Conta mostra Membro e a capacidade Fotógrafo credenciado', (await p.textContent('#clubeStatus')) === 'Membro' && (await p.textContent('#mcCapacidades')).includes('Fotógrafo'));
  await shot(p, 'conta-membro-d1440');
  await ir(p, '/clube/');
  ok('4.2 /clube/ abre a área interna com cartão de membro', await visivel(p, 'membro') && (await p.textContent('#mHandle')) === 'qapiloto' && (await p.textContent('#mDesde')).length >= 8);
  await shot(p, 'club-membro-d1440');
  const [c3, p3] = await ctx(false); await ir(p3, '/u/?h=qapiloto'); await p3.waitForTimeout(1500);
  ok('4.3 perfil público exibe "Membro do Clube"', (await p3.textContent('#pTags')).includes('Membro do Clube'));
  await shot(p3, 'u-qapiloto-membro-d1440');
  await c3.close();
  // desliga perfil público → /u/ some
  await ir(p, '/conta/'); await p.uncheck('#chavePublico'); await p.waitForTimeout(2000);
  const [c4, p4] = await ctx(false); await ir(p4, '/u/?h=qapiloto'); await p4.waitForTimeout(1500);
  ok('4.4 desliga perfil público → /u/qapiloto/ indisponível e foto não assina para visitante', await visivel(p4, 'indisp'));
  const st = await p4.evaluate(async () => (await fetch(`${CD.SB_URL}/storage/v1/object/sign/avatares/33fabc2e-6abc-47aa-8ac3-6aad0024ccc2/x.png`, { method: 'POST', headers: { apikey: CD.SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 60 }) })).status);
  ok('4.5 visitante não assina foto de perfil privado', st === 400 || st === 403 || st === 404, 'HTTP ' + st);
  await c4.close();
  await c.close();

  // 5. admin encerra; piloto vê encerrada com motivo; revoga fotógrafo
  [c, p] = await ctx(false);
  await ir(p, '/admin/'); await p.fill('#email', ADMIN); await p.fill('#senha', senha('admin')); await p.click('#entrar'); await p.waitForTimeout(3000);
  await p.click('[data-aba=clube]'); await p.waitForTimeout(2500); await p.click('[data-csub=membros]');
  proximaResposta = 'Encerramento de teste QA'; await p.click('button[data-encerrar="33fabc2e-6abc-47aa-8ac3-6aad0024ccc2"]'); await p.waitForTimeout(2500); proximaResposta = null;
  ok('5.1 encerra a associação com motivo', (await p.textContent('#tbMembros')).includes('Encerrada'));
  await p.click('[data-aba=usuarios]'); await p.waitForTimeout(2500);
  proximaResposta = 'Teste QA: revoga'; await p.click('button[data-rev="33fabc2e-6abc-47aa-8ac3-6aad0024ccc2"][data-cap="fotografo"]'); await p.waitForTimeout(2500); proximaResposta = null;
  ok('5.2 revoga "fotografo"', !!(await p.$('button[data-con="33fabc2e-6abc-47aa-8ac3-6aad0024ccc2"][data-cap="fotografo"]')));
  await c.close();
  [c, p] = await ctx(false);
  await entrar(p, PILOTO, senha('piloto'));
  ok('5.3 piloto vê Encerrada com o motivo, sem capacidade', (await p.textContent('#clubeStatus')) === 'Encerrada' && (await p.textContent('#clubeTxt')).includes('Encerramento de teste QA') && await p.$eval('#mcCapacidades', e => e.hidden));
  await ir(p, '/clube/'); ok('5.4 /clube/ mostra Associação encerrada e "Solicitar de novo"', (await p.textContent('#stTitulo')) === 'Associação encerrada' && !!(await p.$('#denovo')));
  await shot(p, 'club-status-encerrada-d1440');
  await c.close();

  // 6. celular: capturas dos estados principais
  [c, p] = await ctx(true);
  await ir(p, '/conta/'); await shot(p, 'conta-acesso-m390');
  await entrar(p, PILOTO, senha('piloto')); await shot(p, 'conta-minha-conta-m390');
  await ir(p, '/clube/'); await shot(p, 'club-status-encerrada-m390');
  await ir(p, '/clube/?demo=membro'); await shot(p, 'club-membro-demo-m390');
  await c.close();
  [c, p] = await ctx(true);
  await ir(p, '/admin/'); await p.fill('#email', ADMIN); await p.fill('#senha', senha('admin')); await p.click('#entrar'); await p.waitForTimeout(3000);
  await p.click('[data-aba=clube]'); await p.waitForTimeout(2500); await p.click('[data-csub=membros]'); await shot(p, 'admin-clube-m390');
  await p.click('[data-aba=usuarios]'); await p.waitForTimeout(2500); await shot(p, 'admin-usuarios-m390');
  await c.close();
  await b.close();
  const f = res.filter(x => x[0] === 'FALHA').length; console.log(`\n${res.length - f}/${res.length} casos OK`);
  fs.writeFileSync(path.join(OUT, 'resultado.txt'), res.map(x => x.join('  ')).join('\n') + `\n${res.length - f}/${res.length} casos OK\n`);
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(2); });
