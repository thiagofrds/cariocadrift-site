// Contas de QA no projeto Supabase DEV (nunca produção). Usa só a chave publicável do DEV (.env.dev.local) e o
// fluxo público de cadastro; nunca imprime senhas (ficam em arquivos 600 no scratchpad, passados por QA_SENHAS_DIR).
// Uso: node docs/capturas/qa-dev.js cadastrar | entrar | limpar-nomes
const fs = require('fs'), path = require('path');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '..', '.env.dev.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const BASE = env.SUPABASE_DEV_URL, KEY = env.SUPABASE_DEV_PUBLISHABLE_KEY;
if (!/fswlocaiktcthuwyvccp/.test(BASE)) throw new Error('este roteiro só roda contra o projeto DEV');
const DIR = process.env.QA_SENHAS_DIR; if (!DIR) throw new Error('defina QA_SENHAS_DIR');
const senha = (u) => fs.readFileSync(path.join(DIR, 'senha-qa-' + u), 'utf8').trim();
const CONTAS = [
  { u: 'admin',  email: 'qa-dev-admin@cariocadrift.com.br',  data: { nome: 'QA Admin',  nome_exibicao: 'QA Admin', preferencia: 'espectador', handle: 'qa_admin',  aceite: 'true' } },
  { u: 'piloto', email: 'qa-dev-piloto@cariocadrift.com.br', data: { nome: 'QA Piloto', nome_exibicao: 'Piloto QA', preferencia: 'piloto', handle: 'qa_piloto', aceite: 'true' } },
];
const H = { apikey: KEY, 'Content-Type': 'application/json' };
(async () => {
  const acao = process.argv[2];
  for (const c of CONTAS) {
    if (acao === 'cadastrar') {
      const r = await fetch(`${BASE}/auth/v1/signup`, { method: 'POST', headers: H, body: JSON.stringify({ email: c.email, password: senha(c.u), data: c.data }) });
      const j = await r.json().catch(() => ({}));
      console.log(c.email, r.status, j.id ? 'id=' + j.id : '', j.confirmation_sent_at ? 'confirmação pendente' : '', j.access_token ? 'sessão' : '', j.msg || j.error_description || j.message || '');
    } else if (acao === 'entrar') {
      const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: 'POST', headers: H, body: JSON.stringify({ email: c.email, password: senha(c.u) }) });
      const j = await r.json().catch(() => ({}));
      console.log(c.email, r.status, j.access_token ? 'entrou; uid=' + j.user.id : (j.error_description || j.msg || j.error || ''));
    }
  }
})().catch(e => { console.error(e.message); process.exit(1); });
