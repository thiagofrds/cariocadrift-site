# Etapa A — Inventário da aplicação da E.2, segurança e produção

Branch `fase-01-home`. 16/09/2026. Nada aplicado ainda: este documento é o inventário para sua autorização. Sem merge, sem publicação, sem alteração de credenciais, DNS, HTTPS ou Auth.

O evento continua: Open Drift Session, 20/09, ingressos no local, pista exclusiva para pilotos convidados, caronas pagas. Sem checkout online, sem inscrição pública de pilotos.

---

## 1. Segurança imediata: senha do administrador

A senha inicial de `thiagofrds@yahoo.com.br` foi exibida em chat e está gravada em `.env.local` (linha `ADMIN_SENHA_INICIAL`), na cópia `~/Downloads/cariocadrift-site.zip` e na transcrição local desta sessão em `~/.claude/projects/-Users-thiagofrds-Downloads/`.

**Procedimento (você executa; eu não vejo, não registro e não gravo a senha nova):**

1. No seu terminal, dentro do repositório:
   ```
   node scripts/trocar-senha-admin.js
   ```
   O script pede a senha nova duas vezes com eco desligado, exige 12+ caracteres com maiúscula, minúscula, número e símbolo, troca pela API de administração usando a chave de serviço que já está em `.env.local`, e depois entra com a senha nova apenas para executar um **logout global**, que invalida todos os tokens de sessão anteriores (inclusive o do navegador onde o painel ficou aberto). A senha vive só na memória do processo.
2. Apague a linha `ADMIN_SENHA_INICIAL` de `.env.local` e apague `~/Downloads/cariocadrift-site.zip` (contém o `.env.local` antigo).
3. Entre no painel `/admin/` com a senha nova e confirme que a sessão antiga do painel pede login de novo.
4. Opcional: apague a transcrição desta sessão quando terminarmos, porque ela contém a senha antiga.

Sem o script, a alternativa é o painel do Supabase: Authentication → Users → o usuário → "Send password recovery" não serve hoje, porque o site não tem página que receba o link de recuperação. Por isso o script.

---

## 2. Produção: Supabase Auth, HTTPS e DNS (valores lidos, nada alterado)

| Item | Valor atual | Proposto | Por quê |
|---|---|---|---|
| Auth · Site URL | `http://localhost:3000` (padrão de fábrica) | `https://cariocadrift.com.br` | É o destino padrão dos e-mails de autenticação. Hoje nenhum fluxo do site depende disso (login é e-mail e senha, sem link), mas o valor padrão apontaria e-mails para localhost |
| Auth · Redirect URLs | nenhuma | `https://cariocadrift.com.br/admin/` e `https://www.cariocadrift.com.br/admin/` | Lista fechada; sem curinga. Só passa a importar se um dia existir recuperação de senha por link |
| DNS · A | 185.199.108/109/110/111.153 | manter | Correto para o GitHub Pages |
| DNS · www | CNAME `thiagofrds.github.io` | manter | Correto |
| DNS · AAAA / CAA | nenhum | manter | Sem registro que bloqueie o Let's Encrypt |
| GitHub Pages · domínio | `cariocadrift.com.br`, "DNS Check in Progress" | reexecutar a verificação | Ver abaixo |
| HTTPS | **falha**: o servidor entrega o certificado `*.github.io`; a API do GitHub diz `authorization_pending` para os dois domínios; "Enforce HTTPS" indisponível | após o certificado ser emitido, ligar "Enforce HTTPS" | O site abre por `http://` (200) e **não abre por `https://`** hoje |

**Sobre o HTTPS.** O DNS está certo há horas e o GitHub continua com a verificação pendente. O procedimento conhecido para destravar é, em Settings → Pages, remover o domínio personalizado e adicioná-lo de novo, o que reinicia a verificação e o pedido do certificado (leva de minutos a uma hora). Não fiz isso: é alteração de configuração e depende da sua autorização. Enquanto o certificado não sai, o checklist de publicação tem um item "falhou" em HTTPS.

---

## 3. Inventário da aplicação da E.2 nas páginas reais

Protótipo de referência: `docs/propostas/e2/index.html`. Regra: **a E.2 muda a camada visual; tudo que grava, lê, calcula ou publica continua igual.**

### 3.1 Preservado sem alteração

| O quê | Onde |
|---|---|
| Build estático, front-matter, partials, `{{root}}`, `{{cur:nav}}`, `{{extra_head}}` | `src/build.py`, `src/partials/` |
| `404.html` como página de treino e geração de `treinos/<slug>/index.html` com OG próprio | `src/build.py` |
| Cliente Supabase, chave publishable, `PARTICIPACAO` por slug, cache de treinos publicados, cartão de treino, menu mobile, CTA do topo | `assets/cd.js` |
| Formulário de confirmação (nome, telefone 10–11 dígitos, gravação em `confirmacoes`, 409 duplicado, mensagem "Interesse registrado!") | `src/pages/treinos/evento/index.html` |
| Botão "Chamar a galera" (Web Share ou cópia do link) | `src/pages/treinos/evento/index.html` |
| Formulário da escolinha (nome, telefone, pacote, gravação em `interessados_escolinha`) | `src/pages/escolinha/index.html` |
| Agenda dinâmica (próximos, "já rolou", vazio, erro) | `src/pages/treinos/index.html` |
| Home dinâmica: próximo treino vindo do banco, CTA muda para "Ver treinos" sem evento, galeria "Já rolou" escondida quando vazia | `src/pages/index.html` |
| Contagem regressiva na página do treino (hero) e estados "Rolando agora" / "Encerrado" | `src/pages/treinos/evento/index.html` |
| Painel `/admin/`, login, abas, upload, publicar, CSVs | `admin/index.html` (não é tocado) |
| Textos do Open Drift Session (data, horário, local, endereço, ingressos no local, pilotos convidados, caronas pagas, capacete) | banco `treinos` + `PARTICIPACAO` |
| Pacotes da escolinha (R$ 2.000 / R$ 4.500 Chevette / R$ 8.500 Nissan Z, 10x) | `src/pages/escolinha/index.html` |
| Mapa aéreo da pista `assets/pista.jpg` e imagem OG atual `assets/og.jpg` 1200×630 | `assets/` |
| Marca d'água e créditos "Sergio Photos RJ" em toda foto; nenhuma foto recortada na base nem coberta por véu ou texto | regra da E.1/E.2 |

### 3.2 Modificado (visual)

| Área | Hoje | Com a E.2 |
|---|---|---|
| Paleta (`assets/site.css`) | asfalto #1B1A1F, fogo #E8322A, faísca #FFC61A, fumaça #EFEDE8 | oficial: preto #0B0B0B, grafite #141416, amarelo #FFD100, vermelho #FF0000 (só detalhes), gelo #EDEDED |
| Tipografia | display itálico 900, botões em display 26px itálico com sombra dura, cantos 6px | display Saira 800 reto, rótulos Barlow Condensed espaçados, botões retos sem sombra, linhas finas em vez de cartões |
| Ornamentos | ticker amarelo inclinado, zebra vermelha, grão sobre fotos, véus em gradiente sobre imagens | removidos. Fotos inteiras, sem nada por cima; faixa "largada" (amarelo com ponta vermelha) como único ornamento |
| Cabeçalho | logo redonda `logo.jpg` + wordmark texto + tagline; 4 itens de menu; botão "Próximo treino" vermelho; barra preta fixa com contagem | logo PNG transparente recortada por CSS (48px desktop / 40px mobile, aparece no rolar no mobile); menu Home / Treinos / Ingressos (em breve, sem link) / Carioca Media (em breve, sem link) / Escolinha / Sobre; CTA amarelo "Treino 20.09" (já dinâmico pelo `cd.js`); **barra de contagem do topo removida**; no mobile entra o dock inferior "Confirmar presença · 20.09" que aparece só quando o bloco do evento sai da tela e some no rodapé |
| Menu mobile | lista + Instagram | mesma lista com os dois itens "em breve", logo no topo, Instagram |
| Home · hero | foto `carro.jpg` (render conceitual do 350Z) com véu, título "Carioca Drift" gigante, slogan | duas colunas: logo grande + frase + bloco do evento (data 20.09, título, horário, local, "Confirmar presença", "Ver o treino", nota de que não é ingresso) à esquerda; foto real `foto-3126.jpg` inteira com crédito à direita. **Sem vídeo por padrão** (fica disponível como variante, desligado) |
| Home · próximo treino | cartão com contagem (dias/horas/min), avisos com selos | o bloco do hero **é** o próximo treino, alimentado pelo banco. Seção "Como participar" com três itens (Público / Pilotos / Caronas) + linha de segurança, também condicionada ao `PARTICIPACAO` |
| Home · experiência | `carro.jpg` + `pista.jpg` + lista 01–04 | ensaio editorial com 5 fotos reais (3141, 3125, 3130, 3134) e 4 blocos de texto; `pista.jpg` vai para a seção "Onde" com endereço, Maps, Waze e legenda das seções |
| Home · escolinha | dois atalhos | três pacotes em colunas com preço, mesma página de destino |
| Home · Instagram / "em breve" | bloco "Em breve por aqui: notícias, calendário nacional, classificação" | seção "A cena": tira horizontal com 5 fotos reais (3123, 3143, 3137, 3139, 3140) + botão @cariocadrift_. A frase sobre notícias e Brasileiro **sai** |
| Home · "Já rolou" | grade escondida até haver treino passado com foto | mantida com o mesmo comportamento, restilizada |
| Treinos | cartões arredondados, contagem "Faltam" | cartões retos com data grande, mesma informação; sem contagem no cartão |
| Página do treino | hero com véu sobre a foto da pista, data gigante com sombra | hero E.2 (data, título, meta), foto inteira sem véu; ficha, programação, pista, participar, confirmar e compartilhar no mesmo lugar |
| Escolinha | capa, pacotes em cartões, formato, carros, como, formulário | mesmas seções restilizadas; pacotes no padrão da E.2 |
| Sobre | emblema redondo `logo.jpg` | emblema circular `emblema-cd-circular-conceitual.jpeg` (ver 3.4) |
| Rodapé | zebra, marca redonda, três colunas, link "Painel" | emblema + "Carioca Drift Culture", três colunas, linha final com "Fotografias: Sergio Photos RJ"; **link "Painel" preservado** |
| Favicon / apple-touch | `logo.jpg` | emblema circular (ver 3.4) |
| `theme-color` | #1B1A1F | #0B0B0B |

### 3.3 Removido

- `assets/carro.jpg` deixa de ser usado em qualquer página (render conceitual; nunca como foto real). O arquivo fica no repositório até sua ordem de apagar.
- Ticker, zebra, grão, véus, barra de contagem do topo, texto "notícias, calendário nacional e classificação do Brasileiro" (não temos esse conteúdo).
- `logo.jpg` sai do cabeçalho, do rodapé e do Sobre; permanece só se você preferir mantê-la como favicon.

### 3.4 Depende de você antes de aplicar

1. **Emblema circular** `assets/marca/identidade/emblema-cd-circular-conceitual.jpeg` no rodapé, no Sobre e como favicon. O nome do arquivo diz "conceitual". Se não for arte oficial, uso a logo PNG no lugar.
2. **Contagem regressiva na home**: a E.2 não tem. Ela continua na página do treino. Se quiser a contagem também na home, digo onde entra sem repetir três vezes.
3. **Vídeo no hero**: desligado por padrão. Ligar só no desktop e só com `prefers-reduced-motion` respeitado, se você quiser.
4. **Imagem OG**: mantenho `og.jpg` atual. Se quiser uma nova com foto real e logo, é uma peça a produzir (1200×630, sem cobrir a marca d'água).
5. **Marcas de terceiros e placa legível** nas fotos (RACEZONE, GMAX, GRIP; placa na 3129): já sinalizadas. A 3129 não entra na E.2; as demais entram como estão.

---

## 4. QA antes do merge (o que será executado, com resultado real)

Roteiro `docs/capturas/qa-lancamento.js` estendido para a E.2, mais verificação manual. Cada item sai como **aprovado / falhou / não testado**, com captura ou saída.

| # | Item | Método |
|---|---|---|
| 1 | Navegação desktop (1440) e mobile (390, 375, 360): menu, itens "em breve" sem link, CTA do topo, hambúrguer, dock | Playwright, capturas |
| 2 | Primeira dobra: logo, evento e botão "Confirmar presença" visíveis sem rolar em 390×844, 375×812, 360×640; sem rolagem horizontal | Playwright, medição de `getBoundingClientRect` |
| 3 | Formulário do treino grava em `confirmacoes` (201), duplicado 409 com mensagem, telefone inválido bloqueado | Playwright + leitura com chave de serviço + limpeza do registro de teste |
| 4 | Formulário da escolinha grava com `pacote` correto | idem |
| 5 | Painel: login, listar, editar, publicar/despublicar, upload, dois CSVs | Playwright com conta de QA criada e apagada no fim |
| 6 | `/treinos/open-drift-session/` por acesso direto: HTTP 200 no build local, OG próprio no HTML gerado; `404.html` cobre slug inexistente | curl no servidor local + leitura do HTML |
| 7 | Prévia de compartilhamento: `og:title`, `og:description`, `og:image` 1200×630 em home, treinos, evento, escolinha, sobre | leitura do HTML gerado |
| 8 | Console sem erros em todas as páginas nas três larguras | Playwright `console.error` |
| 9 | Links: nenhum 404 interno; Maps e Waze abrem o endereço; Instagram correto | crawler local |
| 10 | Créditos e marca d'água: toda `<figure>` com "Sergio Photos RJ"; nenhuma foto com `object-position` que corte a base; nada sobreposto | inspeção do DOM + capturas |
| 11 | Conteúdo do Open Drift Session: 20/09, 9h–18h, RJ Race Park, Estrada do Frutuoso 320, ingressos no local, pilotos convidados, caronas pagas, capacete | comparação texto a texto com o banco |
| 12 | HTTPS em produção | curl (hoje: **falhou**, certificado pendente) |
| 13 | RLS: anon não lê `confirmacoes` nem `interessados_escolinha`; não escreve em `treinos` | curl |

---

## 5. Ordem de execução após sua autorização

1. Aplicar a E.2 em `assets/site.css`, partials e nas cinco páginas, sem tocar em `cd.js` além de estilos de cartão e em `admin/`.
2. Build local, roteiro de QA, capturas, correções.
3. Entregar o checklist com resultados reais e as capturas.
4. Aguardar sua autorização para o merge em `main` (publicação automática pelo GitHub Pages).
5. Depois do merge: verificação em produção (HTTPS, OG no WhatsApp, formulários reais) e, com sua autorização, Site URL e Redirect URLs no Auth.
