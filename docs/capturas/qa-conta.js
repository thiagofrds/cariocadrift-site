// Cria ou apaga a conta temporária de QA do painel e limpa registros "TESTE QA". Nunca imprime segredos.
// Uso: node docs/capturas/qa-conta.js criar   → imprime "QA_EMAIL=..." e grava a senha em /tmp (arquivo 600) para o roteiro ler
//      node docs/capturas/qa-conta.js apagar  → apaga a conta, o e-mail em admins e os registros de teste
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const env = {}; for (const l of fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const URL = 'https://trkwfwvqzfvscqwwldpv.supabase.co', S = env.SUPABASE_SECRET_KEY;
const H = { apikey: S, Authorization: `Bearer ${S}`, 'Content-Type': 'application/json' };
const EMAIL = 'qa-e2@cariocadrift.com.br', ARQ = '/tmp/cd-qa-senha';
(async () => {
  if (process.argv[2] === 'criar') {
    const senha = crypto.randomBytes(18).toString('base64url') + 'Aa1!';
    const r = await fetch(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email: EMAIL, password: senha, email_confirm: true }) });
    if (!r.ok) throw new Error('criar usuário: ' + r.status + ' ' + await r.text());
    const a = await fetch(`${URL}/rest/v1/admins`, { method: 'POST', headers: { ...H, Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ email: EMAIL }) });
    if (!a.ok && a.status !== 409) throw new Error('admins: ' + a.status + ' ' + await a.text());
    fs.writeFileSync(ARQ, senha, { mode: 0o600 }); console.log('QA_EMAIL=' + EMAIL + ' (senha em ' + ARQ + ', não impressa)');
  } else {
    const lista = await fetch(`${URL}/auth/v1/admin/users?per_page=1000`, { headers: H }).then(r => r.json());
    const u = (lista.users || []).find(x => x.email === EMAIL);
    if (u) { const d = await fetch(`${URL}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H }); console.log('usuário QA apagado:', d.status); }
    console.log('admins:', (await fetch(`${URL}/rest/v1/admins?email=eq.${encodeURIComponent(EMAIL)}`, { method: 'DELETE', headers: H })).status);
    const dc = await fetch(`${URL}/rest/v1/interessados_carona?nome=like.TESTE%20QA*`, { method: 'DELETE', headers: { ...H, Prefer: 'return=representation' } }); console.log('interessados_carona apagados:', dc.ok ? (await dc.json()).length : dc.status);
    const dt = await fetch(`${URL}/rest/v1/tentativas_carona?telefone=like.219000190*`, { method: 'DELETE', headers: { ...H, Prefer: 'return=representation' } }); console.log('tentativas_carona apagadas:', dt.ok ? (await dt.json()).length : dt.status);
    for (const t of ['confirmacoes', 'interessados_escolinha', 'treinos']) {
      const col = t === 'treinos' ? 'titulo' : 'nome';
      const d = await fetch(`${URL}/rest/v1/${t}?${col}=like.TESTE%20QA*`, { method: 'DELETE', headers: { ...H, Prefer: 'return=representation' } });
      console.log(t, 'apagados:', d.ok ? (await d.json()).length : d.status);
    }
    try { fs.unlinkSync(ARQ); } catch (e) {}
    // sobra no storage do treino de teste
    const l = await fetch(`${URL}/storage/v1/object/list/fotos`, { method: 'POST', headers: H, body: JSON.stringify({ prefix: 'treinos/teste-qa-treino', limit: 100 }) }).then(r => r.json()).catch(() => []);
    if (Array.isArray(l) && l.length) { const rm = await fetch(`${URL}/storage/v1/object/fotos`, { method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: l.map(o => 'treinos/teste-qa-treino/' + o.name) }) }); console.log('storage QA apagado:', rm.status, l.length); }
  }
})().catch(e => { console.error(e.message); process.exit(1); });
