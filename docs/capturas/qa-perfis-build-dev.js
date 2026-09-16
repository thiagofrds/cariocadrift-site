// Geração e retirada das páginas /u/<handle>/ (plano 4.1/4.2) contra o DEV: liga o perfil público do piloto, roda o build
// (Edge Function + BUILD_TOKEN), confere a página gerada na prévia local; desliga, confere que a página existente já mostra
// "não disponível" (checagem em tempo de execução) e que o build seguinte a remove. Nunca toca produção.
// Uso: QA_SENHAS_DIR=... node docs/capturas/qa-perfis-build-dev.js
const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..', '..'), BASE = process.env.QA_BASE || 'http://localhost:8766';
const env = {}; for (const l of fs.readFileSync(path.join(RAIZ, '.env.dev.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const SB = env.SUPABASE_DEV_URL, KEY = env.SUPABASE_DEV_PUBLISHABLE_KEY; if (!/fswlocaiktcthuwyvccp/.test(SB)) throw new Error('só DEV');
const senha = u => fs.readFileSync(path.join(process.env.QA_SENHAS_DIR, 'senha-qa-' + u), 'utf8').trim();
const res = []; const ok = (n, c, x) => { res.push(c); console.log((c ? 'OK    ' : 'FALHA ') + n + (x !== undefined ? '  · ' + x : '')); };
const build = () => { const out = execFileSync('python3', ['src/build.py'], { cwd: RAIZ, env: { ...process.env, BUILD_PERFIS_URL: env.BUILD_PERFIS_URL, BUILD_TOKEN: env.BUILD_TOKEN, BUILD_PERFIS_APIKEY: KEY } }).toString(); return out.match(/perfis públicos gerados: (\d+)/)[1]; };
const arq = path.join(RAIZ, 'u', 'qapiloto', 'index.html');
(async () => {
  const r0 = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'qa-dev-piloto@cariocadrift.com.br', password: senha('piloto') }) }); const tok = (await r0.json()).access_token; ok('piloto entra', !!tok);
  const vis = async (ligar) => (await fetch(`${SB}/rest/v1/rpc/definir_perfil_publico`, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ ligar }) })).json();
  const projecao = async () => (await fetch(`${SB}/rest/v1/rpc/perfil_publico`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ entrada: 'qapiloto' }) })).json();
  let v = await vis(true); ok('liga o perfil público', v.ok && v.perfil_publico === true);
  let n = build(); ok('build gera 1 perfil público', n === '1' && fs.existsSync(arq), n);
  const html = fs.existsSync(arq) ? fs.readFileSync(arq, 'utf8') : '';
  ok('página gerada tem só nome de exibição e @ (title/og), sem telefone/e-mail', /<title>Piloto QA \(@qapiloto\) \| Carioca Drift<\/title>/.test(html) && !/cariocadrift\.com\.br">|21999|qa-dev-piloto/.test(html));
  ok('nenhuma página gerada entra no Git (u/*/ ignorado)', execFileSync('git', ['check-ignore', 'u/qapiloto/index.html'], { cwd: RAIZ }).toString().trim() === 'u/qapiloto/index.html');
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage();
  await p.goto(`${BASE}/u/qapiloto/?env=dev`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  ok('/u/qapiloto/ responde 200 com o perfil (rota estática, dados em tempo de execução)', (await p.title()).includes('@qapiloto') && !(await p.$eval('#perfil', e => e.hidden)));
  await p.screenshot({ path: path.join(__dirname, 'dev', 'u-qapiloto-estatico-d1440.png'), fullPage: true });
  v = await vis(false); ok('desliga o perfil público', v.ok && v.perfil_publico === false);
  ok('projeção pública some na hora', (await projecao()) === null);
  await p.goto(`${BASE}/u/qapiloto/?env=dev`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  ok('página estática ainda existe mas já mostra "Perfil não disponível" (antes do próximo build)', fs.existsSync(arq) && !(await p.$eval('#indisp', e => e.hidden)) && (await p.title()) === 'Perfil não disponível | Carioca Drift');
  await p.screenshot({ path: path.join(__dirname, 'dev', 'u-qapiloto-despublicado-d1440.png'), fullPage: true });
  n = build(); ok('build seguinte remove a página (prazo: até 15 min no agendamento)', n === '0' && !fs.existsSync(arq), n);
  const s = (await fetch(`${BASE}/u/qapiloto/`)).status; ok('rota estática some da prévia (no GitHub Pages cai no 404.html, que redireciona para /u/?h=)', s === 404, s);
  await b.close();
  const f = res.filter(x => !x).length; console.log(`\n${res.length - f}/${res.length} casos OK`); process.exit(f ? 1 : 0);
})().catch(e => { console.error('ERRO', e); process.exit(2); });
