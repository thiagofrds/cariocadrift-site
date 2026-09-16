#!/usr/bin/env node
// Troca a senha de um usuário do Supabase Auth sem exibir, registrar ou gravar a senha nova.
// Uso (no seu terminal, dentro do repositório):  node scripts/trocar-senha-admin.js
// Lê SUPABASE_SECRET_KEY e ADMIN_EMAIL de .env.local. Pede a senha nova duas vezes com eco desligado.
// Depois de trocar, entra com a senha nova só para encerrar TODAS as sessões anteriores (logout global).
// A senha existe apenas na memória deste processo; nada é impresso nem escrito em disco.
const fs = require('fs'), path = require('path'), readline = require('readline');

const env = {};
for (const linha of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_SB = 'https://trkwfwvqzfvscqwwldpv.supabase.co';
const CHAVE_PUB = 'sb_publishable_CYYZ-iAogWrOfkRlKuROWg_KiAp2Jhm';
const SEGREDO = env.SUPABASE_SECRET_KEY, EMAIL = process.env.EMAIL || env.ADMIN_EMAIL;
if (!SEGREDO || !EMAIL) { console.error('Faltam SUPABASE_SECRET_KEY ou ADMIN_EMAIL em .env.local'); process.exit(1); }

function perguntaOculta(texto) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const escreve = rl._writeToOutput; rl._writeToOutput = () => {}; // eco desligado
    process.stdout.write(texto);
    rl.question('', r => { rl._writeToOutput = escreve; rl.close(); process.stdout.write('\n'); resolve(r); });
  });
}
const forte = s => s.length >= 12 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s);

(async () => {
  console.log(`Conta: ${EMAIL}`);
  const s1 = await perguntaOculta('Senha nova (mín. 12, maiúscula, minúscula, número e símbolo): ');
  if (!forte(s1)) { console.error('Senha fraca. Nada foi alterado.'); process.exit(1); }
  const s2 = await perguntaOculta('Repita a senha nova: ');
  if (s1 !== s2) { console.error('As senhas não conferem. Nada foi alterado.'); process.exit(1); }

  const adm = { apikey: SEGREDO, Authorization: `Bearer ${SEGREDO}`, 'Content-Type': 'application/json' };
  // 1) localizar o usuário
  const lista = await fetch(`${URL_SB}/auth/v1/admin/users?page=1&per_page=1000`, { headers: adm }).then(r => r.json());
  const u = (lista.users || []).find(x => (x.email || '').toLowerCase() === EMAIL.toLowerCase());
  if (!u) { console.error('Usuário não encontrado. Nada foi alterado.'); process.exit(1); }
  // 2) trocar a senha
  const r = await fetch(`${URL_SB}/auth/v1/admin/users/${u.id}`, { method: 'PUT', headers: adm, body: JSON.stringify({ password: s1 }) });
  if (!r.ok) { console.error('Falha ao trocar a senha: HTTP ' + r.status); process.exit(1); }
  console.log('Senha trocada.');
  // 3) encerrar todas as sessões anteriores: entra com a senha nova e faz logout global
  const pub = { apikey: CHAVE_PUB, 'Content-Type': 'application/json' };
  const login = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: pub, body: JSON.stringify({ email: EMAIL, password: s1 }) }).then(r => r.json());
  if (!login.access_token) { console.error('Senha trocada, mas não foi possível entrar para encerrar sessões antigas. Encerre pelo painel do Supabase.'); process.exit(2); }
  const out = await fetch(`${URL_SB}/auth/v1/logout?scope=global`, { method: 'POST', headers: { ...pub, Authorization: `Bearer ${login.access_token}` } });
  console.log(out.ok || out.status === 204 ? 'Todas as sessões anteriores foram encerradas.' : 'Aviso: logout global respondeu HTTP ' + out.status);
  console.log('Pronto. Remova a linha ADMIN_SENHA_INICIAL de .env.local e entre no painel com a senha nova.');
})().catch(e => { console.error('Erro: ' + e.message); process.exit(1); });
