// Cadastro pela tela no DEV com confirmação por e-mail LIGADA: preenche o formulário real, envia e registra o que a tela
// mostra (o SMTP padrão do Supabase só entrega a membros da organização e limita a 2 e-mails/hora). Também captura as
// telas de cadastro e de código (demo) no desktop e no celular. Uso: node docs/capturas/qa-cadastro-dev.js [email]
const { chromium } = require('/Users/thiagofrds/DTC APP/web/node_modules/playwright-core');
const path = require('path'); const BASE = process.env.QA_BASE || 'http://localhost:8766', OUT = path.join(__dirname, 'dev');
const EMAIL = process.argv[2] || 'qa-dev-cadastro@cariocadrift.com.br';
(async () => {
  const b = await chromium.launch();
  for (const mobile of [false, true]) {
    const tag = mobile ? 'm390' : 'd1440';
    const c = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, locale: 'pt-BR' }); const p = await c.newPage();
    await p.goto(`${BASE}/conta/?env=dev`, { waitUntil: 'networkidle' });
    await p.click('text=Criar conta').catch(() => {}); await p.waitForTimeout(300);
    await p.fill('#cNome', 'Cadastro QA'); await p.fill('#cEmail', EMAIL); await p.fill('#cSenha', 'senha-de-teste-longa-123'); await p.fill('#cHandle', 'cadastro_qa'); await p.waitForTimeout(900);
    await p.check('#cAceite'); const dica = (await p.textContent('#hDica')).trim();
    await p.screenshot({ path: path.join(OUT, `cadastro-preenchido-${tag}.png`), fullPage: true });
    if (!mobile) {
      const reqs = []; p.on('response', r => { if (/auth\/v1\/signup/.test(r.url())) reqs.push(r.status()); });
      await p.click('#criar'); await p.waitForTimeout(4000);
      const erro = (await p.textContent('#cErro')).trim(), codigo = !(await p.$eval('#fCodigo', e => e.hidden));
      console.log(`dica do @: "${dica}"`); console.log(`signup HTTP: ${reqs.join(',') || '(sem resposta)'} · tela de código: ${codigo} · erro mostrado: "${erro}"`);
      await p.screenshot({ path: path.join(OUT, `cadastro-resultado-${tag}.png`), fullPage: true });
    }
    await p.goto(`${BASE}/conta/?env=dev&demo=codigo`, { waitUntil: 'networkidle' }); await p.screenshot({ path: path.join(OUT, `cadastro-codigo-demo-${tag}.png`), fullPage: true });
    await c.close();
  }
  await b.close();
})().catch(e => { console.error('ERRO', e); process.exit(2); });
