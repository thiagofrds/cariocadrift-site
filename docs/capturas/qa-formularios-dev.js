// Regressão dos formulários públicos e do painel contra o Supabase DEV pela API (chave publicável + login das contas de QA).
// Roda antes e depois da B10 para provar que login, painel e formulários continuam iguais. Nunca toca produção.
// Uso: QA_SENHAS_DIR=... node docs/capturas/qa-formularios-dev.js
const fs = require('fs'), path = require('path');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '..', '.env.dev.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = env.SUPABASE_DEV_URL, KEY = env.SUPABASE_DEV_PUBLISHABLE_KEY; if (!/fswlocaiktcthuwyvccp/.test(BASE)) throw new Error('só DEV');
const DIR = process.env.QA_SENHAS_DIR; const senha = u => fs.readFileSync(path.join(DIR, 'senha-qa-' + u), 'utf8').trim();
const res = []; const ok = (n, c, x) => { res.push(c); console.log((c ? 'OK    ' : 'FALHA ') + n + (x !== undefined ? '  · ' + x : '')); };
const H = (tok) => ({ apikey: KEY, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) });
const login = async (email, s) => { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: H(), body: JSON.stringify({ email, password: s }) }); const j = await r.json(); return j.access_token; };
const rest = async (tok, m, p, body, prefer) => { const r = await fetch(`${BASE}/rest/v1/${p}`, { method: m, headers: { ...H(tok), ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return { s: r.status, j }; };
(async () => {
  const T = Date.now().toString().slice(-6);
  // formulários públicos (anon), como o site envia: só apikey
  let r = await rest(null, 'POST', 'confirmacoes', { evento: 'open-drift-session', nome: 'TESTE QA B10', telefone: '21900' + T }, 'return=minimal'); ok('anon confirma presença → 201', r.s === 201, r.s);
  r = await rest(null, 'POST', 'confirmacoes', { evento: 'open-drift-session', nome: 'TESTE QA B10', telefone: '21903' + T, criado_em: '2020-01-01' }, 'return=minimal'); ok('anon não informa criado_em (privilégio por coluna)', r.s === 401 || r.s === 403 || r.s === 400, r.s + ' ' + (r.j && r.j.code));
  r = await rest(null, 'POST', 'interessados_escolinha', { nome: 'TESTE QA B10', telefone: '21901' + T, pacote: 'nao-sei' }, 'return=minimal'); ok('anon registra interesse na escolinha → 201', r.s === 201, r.s);
  r = await rest(null, 'POST', 'interessados_carona', { evento: 'open-drift-session', nome: 'TESTE QA B10', telefone: '21902' + T, consentimento: true }, 'return=minimal'); ok('anon registra interesse em carona → 201', r.s === 201, r.s);
  r = await rest(null, 'GET', 'confirmacoes?select=id'); ok('anon não lê confirmações', r.s === 401 || r.s === 403 || (r.s === 200 && r.j.length === 0), r.s);
  r = await rest(null, 'GET', 'interessados_escolinha?select=id'); ok('anon não lê escolinha', r.s === 401 || r.s === 403 || (r.s === 200 && r.j.length === 0), r.s);
  r = await rest(null, 'GET', 'admins?select=email'); ok('anon não lê admins', r.s === 401 || r.s === 403 || (r.s === 200 && r.j.length === 0), r.s);
  r = await rest(null, 'GET', 'treinos?select=slug,publicado'); ok('anon lê só treinos publicados', r.s === 200 && r.j.length >= 1 && r.j.every(t => t.publicado), r.s);
  r = await rest(null, 'PATCH', 'treinos?slug=eq.open-drift-session', { titulo: 'hack' }, 'return=representation'); ok('anon não edita treino', r.s >= 400 || (r.s === 200 && r.j.length === 0), r.s);
  r = await rest(null, 'DELETE', 'confirmacoes?nome=eq.TESTE%20QA%20B10', null, 'return=representation'); ok('anon não apaga confirmações', r.s >= 400 || (r.s === 200 && r.j.length === 0), r.s);
  r = await fetch(`${BASE}/rest/v1/rpc/perfil_publico`, { method: 'POST', headers: H(), body: JSON.stringify({ entrada: 'qa_admin' }) }); ok('anon executa perfil_publico (única função pública de contas)', r.status === 200, r.status);
  r = await fetch(`${BASE}/rest/v1/rpc/perfis_publicos_para_build`, { method: 'POST', headers: H(), body: JSON.stringify({ depois: '', limite: 10 }) }); ok('anon não executa função de build', r.status >= 400, r.status);
  r = await fetch(`${BASE}/rest/v1/rpc/eh_membro`, { method: 'POST', headers: H(), body: JSON.stringify({}) }); ok('anon não executa função do clube', r.status >= 400, r.status);
  // painel: admin legado
  const ta = await login('qa-dev-admin@cariocadrift.com.br', senha('admin')); ok('admin faz login', !!ta);
  r = await rest(ta, 'GET', 'admins?select=email'); ok('admin vê a própria linha em admins (verificação do painel)', r.s === 200 && r.j.length === 1, r.s);
  r = await rest(ta, 'GET', 'confirmacoes?select=id,nome&nome=eq.TESTE%20QA%20B10'); ok('admin lê confirmações', r.s === 200 && r.j.length === 1, r.s);
  r = await rest(ta, 'GET', 'interessados_escolinha?select=id&nome=eq.TESTE%20QA%20B10'); ok('admin lê escolinha', r.s === 200 && r.j.length === 1, r.s);
  r = await rest(ta, 'GET', 'interessados_carona?select=id&nome=eq.TESTE%20QA%20B10'); ok('admin lê carona', r.s === 200 && r.j.length === 1, r.s);
  r = await rest(ta, 'POST', 'treinos', { slug: 'teste-qa-b10', titulo: 'TESTE QA B10', data: '2026-10-10' }, 'return=representation'); ok('admin cria treino em rascunho', r.s === 201, r.s + ' ' + (r.j && r.j.message || ''));
  r = await rest(ta, 'PATCH', 'treinos?slug=eq.teste-qa-b10', { titulo: 'TESTE QA B10 editado', publicado: true }, 'return=representation'); ok('admin edita e publica (gatilho atualizado_em)', r.s === 200 && r.j.length === 1 && r.j[0].atualizado_em > r.j[0].criado_em, r.s);
  r = await rest(null, 'GET', 'treinos?select=slug&slug=eq.teste-qa-b10'); ok('visitante vê o treino recém-publicado', r.s === 200 && r.j.length === 1, r.s);
  r = await rest(ta, 'DELETE', 'treinos?slug=eq.teste-qa-b10', null, 'return=representation'); ok('admin apaga treino', r.s === 200 && r.j.length === 1, r.s);
  // storage: admin envia foto no bucket fotos; anon lê (bucket público)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAF0lEQVR42mP8z8DwnwEJMDIwMFAdAADRJwX/8m3mDQAAAABJRU5ErkJggg==', 'base64');
  r = await fetch(`${BASE}/storage/v1/object/fotos/treinos/teste-qa-b10/x.png`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + ta, 'Content-Type': 'image/png' }, body: png }); ok('admin envia foto para o bucket fotos', r.status === 200, r.status);
  r = await fetch(`${BASE}/storage/v1/object/public/fotos/treinos/teste-qa-b10/x.png`, { headers: { apikey: KEY } }); ok('visitante lê a foto (bucket público)', r.status === 200, r.status);
  r = await fetch(`${BASE}/storage/v1/object/fotos`, { method: 'DELETE', headers: { ...H(ta) }, body: JSON.stringify({ prefixes: ['treinos/teste-qa-b10/x.png'] }) }); ok('admin apaga a foto', r.status === 200, r.status);
  // logado comum
  const tp = await login('qa-dev-piloto@cariocadrift.com.br', senha('piloto')); ok('piloto faz login', !!tp);
  r = await rest(tp, 'GET', 'confirmacoes?select=id'); ok('logado comum não vê leads (RLS)', r.s === 200 && r.j.length === 0, r.s);
  r = await rest(tp, 'DELETE', 'treinos?slug=eq.open-drift-session', null, 'return=representation'); ok('logado comum não apaga treino', r.s === 200 && r.j.length === 0, r.s);
  r = await fetch(`${BASE}/storage/v1/object/fotos/treinos/hack.png`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + tp, 'Content-Type': 'image/png' }, body: png }); ok('logado comum não envia foto em fotos', r.status >= 400, r.status);
  r = await rest(tp, 'PATCH', 'usuarios?id=eq.33fabc2e-6abc-47aa-8ac3-6aad0024ccc2', { apresentacao: 'Regressão B10 ' + T }, 'return=representation'); ok('logado comum edita o próprio perfil', r.s === 200 && r.j.length === 1, r.s);
  // limpeza (admin)
  for (const t of ['confirmacoes', 'interessados_escolinha', 'interessados_carona']) { r = await rest(ta, 'DELETE', `${t}?nome=eq.TESTE%20QA%20B10`, null, 'return=representation'); ok(`limpeza ${t}`, r.s === 200 && r.j.length === 1, r.s); }
  const f = res.filter(x => !x).length; console.log(`\n${res.length - f}/${res.length} casos OK`); process.exit(f ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(2); });
