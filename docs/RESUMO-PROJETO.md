# Carioca Drift — resumo do projeto (16/09/2026)

## Contexto
- Carioca Drift (@cariocadrift_), cena de drift do Rio de Janeiro. Slogan: "More than drift. It's a culture."
- Objetivo: site oficial em **cariocadrift.com.br** para a bio do Instagram, começando pelo evento **Open Drift Session** (domingo 20/09/2026, 9h–18h, RJ Race Park, Estrada do Frutuoso 320, Santa Cruz, RJ; ingressos no local; capacete obrigatório para pista e carona; reel: instagram.com/reel/DdJv7ePKg-R/).
- Direção final (diagrama do Thiago): site com HOME (agenda de eventos oficiais do drift no Brasil, tabela do Brasileiro de Drift, fotos/infos gerais, notícias do drift no Brasil e no mundo), TREINOS (só os treinos da Carioca Drift, cada um com página completa, criados por um painel sem depender de dev), ESCOLINHA com Fabinho Drift Show (landing com história, fotos, curso, local e carros). "Sobre" foi mantido como página institucional.
- Referências visuais enviadas: fuelfest.com, gatebil.no, hyperfest.com, grid.life. Padrões extraídos: contagem regressiva fixa no topo, hero de ação em tela cheia (vídeo), faixa/marquee com o chamado, "o que você vai viver", agenda em cards, notícias, galeria de eventos passados, botão de ingresso sempre visível.

## Identidade visual (definida e aplicada)
- Fundo escuro #1B1A1F (asfalto), superfícies #26252C / #34323B, amarelo #FFC61A (faísca), vermelho #E8322A (fogo), texto claro #EFEDE8, cinza #A3A1AA, verde #3DBE5B (só para a 3ª seção da pista).
- Tipografia: Saira Extra Condensed 900 itálico (títulos, sempre caixa alta), Barlow (texto), Barlow Condensed (rótulos/eyebrows).
- Elementos próprios: data gigante "20.09" amarela com sombra vermelha; faixa amarela inclinada correndo (ticker); listra amarelo/preto de alerta na regra do capacete; zebra vermelha/branca (guia de pista) no cartão de formulário e no rodapé; grão na foto do hero.
- Mobile-first, coluna de 1100px no desktop, tema único escuro.

## Arquitetura técnica
- **Hospedagem:** GitHub Pages, repo público `thiagofrds/cariocadrift-site` (branch main), CNAME cariocadrift.com.br, HTTPS automático quando o DNS apontar.
- **Código:** site estático gerado por `src/build.py` a partir de `src/pages/**/index.html` + partials (`head`, `nav`, `footer`) em `src/partials/`. CSS compartilhado em `assets/site.css`, utilitários JS em `assets/cd.js`. Imagens em `assets/` (logo.jpg, carro.jpg 680px — baixa resolução, pista.jpg, og.jpg 1200x630 para preview no WhatsApp/Instagram).
- **Rotas:** `/` home, `/treinos/` agenda, `/treinos/<slug>/` página do treino (servida via 404.html do GitHub Pages, renderizada do banco), `/escolinha/`, `/sobre/`, `/admin/` painel.
- **Backend:** Supabase projeto `carioca-drift` (ref trkwfwvqzfvscqwwldpv, região sa-east-1, org "Dtc", plano Pro, compute Micro ≈ US$10/mês; sugerido reduzir para Nano). Chave pública no site só permite inserir/ler o que as políticas liberam.
- **Tabelas:**
  - `treinos` — slug, título, chamada, tipo, data, hora início/fim, local, endereço, links Maps/Waze, entrada (título/texto), regra da pista (título/texto), atrações (JSON), texto e foto da pista, foto de capa, reel, publicado. Público lê só publicados; admin cria/edita/apaga.
  - `confirmacoes` — nome, telefone (10–11 dígitos), evento (slug), data. Único por evento+telefone. Anônimo só insere; admin lê/apaga.
  - `interessados_escolinha` — nome, telefone, pacote (experiencia | curso-chevette | curso-nissan | nao-sei), mensagem, data. Único por telefone.
  - `admins` — e-mails autorizados no painel (hoje: thiagofrds@yahoo.com.br).
  - Storage bucket `fotos` (público para leitura; admin envia).
- **Painel /admin:** login e-mail+senha (Supabase Auth). Abas: Treinos (criar, editar, publicar/despublicar, apagar, upload de capa e foto da pista, slug automático), Confirmações (filtro por treino, link para WhatsApp, apagar, CSV), Escolinha (interessados com pacote, WhatsApp, CSV). Usuário criado; senha inicial salva em `.env.local` (não vai para o git). Site URL/redirect de "esqueci a senha" ainda precisa ser configurado no Supabase.
- **Exportação local:** `exportar-confirmacoes.sh` baixa os CSVs das duas listas com a chave secreta de `.env.local`.
- **Preview local:** `npx http-server . -p 8765` na pasta do repo (config em `Downloads/.claude/launch.json`, nome `cariocadrift-site`).

## Páginas prontas
- **Home:** capa com foto e título "Carioca Drift", slogan, chamada, botões "Próximo treino" (dinâmico) e "Quero aprender"; faixa correndo; card do próximo treino com contagem; "O que você vai viver" (6 itens); atalhos Treinos/Escolinha/Sobre; bloco Instagram.
- **Treinos:** agenda dinâmica (próximos, "próximas datas em breve", "já rolou"); "Como funciona" (4 regras).
- **Página do treino (modelo):** hero com foto, data gigante, chamada, botões (confirmar, como chegar, chamar a galera), contagem regressiva por segundo (vira "rolando agora" e "encerrado"), faixa, ficha (quando/onde com Maps e Waze/entrada/regra), "O que rola", "A pista" com foto e reel, formulário de presença salvo no Supabase (duplicado vira "você já está na lista"), .ics para calendário, compartilhar (Web Share/copiar link), botão fixo no celular.
- **Escolinha:** hero, selos, pacotes — Experiência Drift individual R$ 2.000 (2h de pista e carro, Chevette amarelo, 1 par de pneus, 10 min com instrutor, até acabar os pneus) e Curso completo básico (8 módulos; pista, carro, 2 tanques, 2 pares de pneus novos; 2 dias 12h–18h ou 1 dia 8h–18h mais cansativo; datas a combinar) com Chevette R$ 4.500 ou Nissan Z R$ 8.500; cartão em até 10x sem juros; "Como é o curso"; "Os carros"; passo a passo; formulário "Tenho interesse" com escolha do pacote.
- **Sobre:** emblema, texto institucional, "Três frentes" (treinos, escolinha, cultura), contato via Instagram.
- **Barra de contagem** no topo de todas as páginas públicas com o próximo treino.

## Pendências
1. **DNS no Registro.br** (domínio usa DNS do próprio Registro.br; zona "em transição" após registro no dia 16/09). Registros a criar: A 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 para cariocadrift.com.br; CNAME www → thiagofrds.github.io.
2. **Testar o painel logado** (criar treino, subir foto, publicar). Trocar a senha inicial.
3. **Supabase Auth:** Site URL https://cariocadrift.com.br e redirect http://localhost:8765/admin/ (para "esqueci a senha"). Avaliar reduzir compute para Nano.
4. **Material do Thiago:** foto do carro em alta; fotos dos treinos, da pista e do Fabinho e dos carros; história do Fabinho; conteúdo dos 8 módulos; local das aulas da escolinha; vídeo MP4 curto para a capa da home.
5. **Próxima fase (diagrama):** notícias (tabela + painel + bloco na home), galeria de treinos passados (fotos por treino), calendário de eventos oficiais do drift no Brasil e tabela do Brasileiro (tabelas + painel + primeira carga por pesquisa), vídeo na capa.
6. Colocar cariocadrift.com.br na bio do Instagram quando o DNS estiver no ar.

## Links
- Repo: https://github.com/thiagofrds/cariocadrift-site
- Supabase: https://supabase.com/dashboard/project/trkwfwvqzfvscqwwldpv
- Preview antigo (página única, artefato): https://claude.ai/artifact/JV1pdKoPoqnp24XZjx6NYF
