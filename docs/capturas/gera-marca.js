// Gera favicon (64), apple-touch-icon (180) e imagem OG (1200×630) a partir da logo oficial, sem fotografia
// (licença do acervo ainda não confirmada) e sem render conceitual. Uso: node docs/capturas/gera-marca.js
const { chromium } = require('/Users/thiagofrds/DTC APP/node_modules/playwright-core'.replace('/DTC APP/node_modules', '/DTC APP/web/node_modules'));
const fs = require('fs'), path = require('path');
const raiz = path.resolve(__dirname, '..', '..');
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(raiz, 'assets/marca/logos/logo-carioca-drift-transparente.png')).toString('base64');
// caixa do desenho dentro do PNG quadrado: width 121.5116%, left -10.5620%, top -62.6316% (proporção 1032/570)
const recorte = (w) => `<span style="display:block;position:relative;overflow:hidden;width:${w}px;aspect-ratio:1032/570"><img src="${logo}" style="position:absolute;width:121.5116%;left:-10.5620%;top:-62.6316%;max-width:none"></span>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const fontes = `<link href="https://fonts.googleapis.com/css2?family=Saira+Extra+Condensed:wght@800&family=Barlow+Condensed:wght@700&display=swap" rel="stylesheet">`;
  // ícones: tile preto, logo recortada ocupando 92% da largura (a marca oficial adaptada ao quadrado; o texto fica pequeno, mas o desenho é o oficial)
  for (const [tam, nome] of [[64, 'favicon.png'], [180, 'apple-touch-icon.png']]) {
    await page.setViewportSize({ width: tam, height: tam });
    await page.setContent(`<body style="margin:0;background:#0B0B0B;display:grid;place-items:center;width:${tam}px;height:${tam}px">${recorte(Math.round(tam * .92))}</body>`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(raiz, 'assets', nome), type: 'png' });
  }
  // OG 1200×630: marca oficial, tagline e a linha de largada. Sem foto.
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`${fontes}<body style="margin:0;width:1200px;height:630px;background:#0B0B0B;color:#EDEDED;font-family:'Barlow Condensed',Arial,sans-serif;position:relative;overflow:hidden">
    <div style="position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:28px">
      ${recorte(720)}
      <div style="font-family:'Saira Extra Condensed',Impact,sans-serif;font-weight:800;font-size:44px;letter-spacing:.02em;text-transform:uppercase;line-height:1">More than drift. It's a culture.</div>
      <div style="font-weight:700;font-size:22px;letter-spacing:.24em;text-transform:uppercase;color:#9A9AA2">Treinos de drift · RJ Race Park · Rio de Janeiro</div>
    </div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:10px;background:linear-gradient(90deg,#FFD100 0 calc(100% - 180px),#FF0000 calc(100% - 180px))"></div>
    <div style="position:absolute;right:36px;bottom:26px;font-weight:700;font-size:18px;letter-spacing:.2em;color:#9A9AA2">cariocadrift.com.br</div>
  </body>`);
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(raiz, 'assets', 'og.jpg'), type: 'jpeg', quality: 90 });
  await browser.close();
  for (const f of ['favicon.png', 'apple-touch-icon.png', 'og.jpg']) console.log(f, fs.statSync(path.join(raiz, 'assets', f)).size, 'bytes');
})();
