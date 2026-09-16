// Validação da migration da Carona Radical na API real do Supabase (PostgREST), após a migration aplicada.
// Usa a chave publishable (como o site) e a chave de serviço (só para conferir e apagar registros de teste).
// Não testa o limite global de 60 (barraria visitantes reais por 10 minutos). Nunca imprime chaves.
// Uso: node supabase/tests/validar-producao-carona.js
const fs = require('fs'), path = require('path');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const URL = 'https://trkwfwvqzfvscqwwldpv.supabase.co/rest/v1', PUB = 'sb_publishable_CYYZ-iAogWrOfkRlKuROWg_KiAp2Jhm', S = env.SUPABASE_SECRET_KEY;
const anon = { apikey: PUB, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
const svc = { apikey: S, Authorization: `Bearer ${S}`, 'Content-Type': 'application/json' };
const T = ['21900019001', '21900019002', '21900019003'];   // telefones de teste (inexistentes)
const R = []; const reg = (t, esperado, obtido) => R.push({ t, esperado, obtido, ok: String(obtido).startsWith(esperado) || esperado.split('|').some(e => String(obtido).startsWith(e)) });
const post = async (body, h = anon) => { const r = await fetch(`${URL}/interessados_carona`, { method: 'POST', headers: h, body: JSON.stringify(body) }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, code: j && j.code, msg: j && j.message }; };
const conta = async (tel) => (await fetch(`${URL}/interessados_carona?select=id,nome,evento&telefone=eq.${tel}`, { headers: svc }).then(r => r.json())).length;
(async () => {
  // limpeza prévia
  await fetch(`${URL}/interessados_carona?telefone=in.(${T.join(',')})`, { method: 'DELETE', headers: svc });
  await fetch(`${URL}/tentativas_carona?telefone=in.(${T.join(',')})`, { method: 'DELETE', headers: svc });
  // 1. inserção válida, return=minimal, sem privilégio de leitura
  let r = await post({ evento: 'open-drift-session', nome: 'TESTE QA carona', telefone: T[0], consentimento: true, origem: 'site' });
  reg('1. anon insere válido (return=minimal) → 201', '201', r.status);
  reg('1. registro existe (conferido com chave de serviço) → 1', '1', await conta(T[0]));
  const sel = await fetch(`${URL}/interessados_carona?select=id&limit=1`, { headers: { apikey: PUB } });
  reg('1. anon lê a tabela → 401/403 (sem privilégio)', '401|403', sel.status);
  const selT = await fetch(`${URL}/tentativas_carona?select=telefone&limit=1`, { headers: { apikey: PUB } });
  reg('1. anon lê tentativas_carona → 401/403/404', '401|403|404', selT.status);
  // 1b. manipulação de id e data
  r = await post({ id: 999999, evento: 'open-drift-session', nome: 'TESTE QA id', telefone: T[1], consentimento: true, origem: 'site' });
  reg('1b. anon envia id → 401/403 (privilégio de coluna)', '401|403', r.status);
  r = await post({ evento: 'open-drift-session', nome: 'TESTE QA data', telefone: T[1], consentimento: true, origem: 'site', criado_em: '2020-01-01T00:00:00Z' });
  reg('1b. anon envia criado_em antigo → 401/403', '401|403', r.status);
  r = await post({ evento: 'open-drift-session', nome: 'TESTE QA data', telefone: T[1], consentimento: true, origem: 'site', criado_em: '2030-01-01T00:00:00Z' });
  reg('1b. anon envia criado_em futuro → 401/403', '401|403', r.status);
  reg('1b. nada gravado para o telefone das tentativas de manipulação → 0', '0', await conta(T[1]));
  // 2. duplicata silenciosa
  r = await post({ evento: 'open-drift-session', nome: 'TESTE QA carona de novo', telefone: T[0], consentimento: true, origem: 'site' });
  reg('2. duplicata no mesmo treino → 201 (igual a envio novo)', '201', r.status);
  reg('2. duplicata não gravou linha nova → 1', '1', await conta(T[0]));
  r = await post({ evento: 'treino-que-nao-existe', nome: 'TESTE QA ev', telefone: T[1], consentimento: true, origem: 'site' });
  reg('2. evento inexistente → 409 (23503)', '409', r.status + ' ' + (r.code || ''));
  r = await post({ evento: 'open-drift-session', nome: 'TESTE QA tel', telefone: '219999', consentimento: true, origem: 'site' });
  reg('2. telefone curto → 400 (check)', '400', r.status);
  r = await post({ evento: 'open-drift-session', nome: 'TESTE QA sem', telefone: T[1], consentimento: false, origem: 'site' });
  reg('2. sem consentimento → 401/403 (policy)', '401|403', r.status);
  r = await post({ evento: 'open-drift-session', nome: 'TESTE QA origem', telefone: T[1], consentimento: true, origem: 'painel' });
  reg('2. origem diferente de site → 400/401/403', '400|401|403', r.status);
  r = await post({ evento: null, nome: 'TESTE QA geral', telefone: T[1], consentimento: true, origem: 'site' });
  reg('2. interesse geral (sem evento) → 201', '201', r.status);
  // 3. anon update/delete
  const up = await fetch(`${URL}/interessados_carona?telefone=eq.${T[0]}`, { method: 'PATCH', headers: anon, body: JSON.stringify({ nome: 'hack' }) });
  reg('3. anon update → 401/403 ou 204 sem efeito', '401|403|204', up.status);
  const del = await fetch(`${URL}/interessados_carona?telefone=eq.${T[0]}`, { method: 'DELETE', headers: anon });
  reg('3. anon delete → 401/403 ou 204 sem efeito', '401|403|204', del.status);
  reg('3. registro intacto após tentativas do anon → 1', '1', await conta(T[0]));
  // 5. limite por telefone: T[2] novo: 3 tentativas ok, 4ª barrada; T[0] cadastrado: já usou 2 tentativas (insert + duplicata) → mais 1 ok, 4ª barrada com a mesma mensagem
  const a = [];
  for (const ev of ['open-drift-session', null, 'open-drift-session']) a.push((await post({ evento: ev, nome: 'TESTE QA novo', telefone: T[2], consentimento: true, origem: 'site' })).status);
  reg('5. telefone novo: 3 tentativas → 201,201,201', '201,201,201', a.join(','));
  r = await post({ evento: null, nome: 'TESTE QA novo', telefone: T[2], consentimento: true, origem: 'site' });
  reg('5. telefone novo: 4ª tentativa → 400 P0001 "para este telefone"', '400 P0001 para este telefone', `${r.status} ${r.code || ''} ${/para este telefone/.test(r.msg || '') ? 'para este telefone' : (r.msg || '')}`);
  r = await post({ evento: null, nome: 'TESTE QA carona', telefone: T[0], consentimento: true, origem: 'site' });
  reg('5. telefone cadastrado: 3ª tentativa → 201', '201', r.status);
  r = await post({ evento: null, nome: 'TESTE QA carona', telefone: T[0], consentimento: true, origem: 'site' });
  reg('5. telefone cadastrado: 4ª tentativa → mesma resposta do novo', '400 P0001 para este telefone', `${r.status} ${r.code || ''} ${/para este telefone/.test(r.msg || '') ? 'para este telefone' : (r.msg || '')}`);
  // limpeza final
  const d1 = await fetch(`${URL}/interessados_carona?telefone=in.(${T.join(',')})`, { method: 'DELETE', headers: { ...svc, Prefer: 'return=representation' } });
  const d2 = await fetch(`${URL}/tentativas_carona?telefone=in.(${T.join(',')})`, { method: 'DELETE', headers: { ...svc, Prefer: 'return=representation' } });
  reg('limpeza: registros de teste apagados', '200', d1.status + ' (' + ((await d1.json()).length) + ' registros)');
  reg('limpeza: tentativas de teste apagadas', '200', d2.status + ' (' + ((await d2.json()).length) + ' tentativas)');
  reg('limpeza: nenhum telefone de teste restante', '0', (await conta(T[0])) + (await conta(T[1])) + (await conta(T[2])));
  for (const x of R) console.log((x.ok ? 'PASSOU ' : 'FALHOU ') + x.t + ' | obtido: ' + x.obtido);
  console.log(`\n${R.filter(x => x.ok).length} passaram, ${R.filter(x => !x.ok).length} falharam`);
})().catch(e => { console.error('erro:', e.message); process.exit(1); });
