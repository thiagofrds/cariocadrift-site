# Etapa A — Checklist de publicação (resultados reais)

Branch `fase-01-home`, E.2 aplicada. Executado em 16/09/2026 contra o build local (`http://localhost:8765`) e contra a produção atual (`main`) onde indicado. Roteiros: `docs/capturas/capturas-e2.js` (160 verificações), `docs/capturas/qa-lancamento.js` (63 verificações, conta de QA temporária criada e apagada), `docs/capturas/gera-marca.js`. Capturas em `docs/capturas/e2/` (não versionadas).

Legenda: **aprovado** / **falhou** / **não testado**.

## 1. Navegação
| Item | Resultado | Evidência |
|---|---|---|
| Desktop 1440: 6 itens de menu, "Ingressos" e "Carioca Media" marcados "em breve" e sem link, CTA "Treino 20.09" dinâmico | aprovado | `home-d1440-dobra.png`, teste automático |
| Mobile 390: hambúrguer abre e fecha (clique e Escape), menu com os dois itens "em breve" sem link, Instagram | aprovado | `home-m390-menu.png` |
| Mobile: logo do topo escondida enquanto a logo grande do hero está na tela; aparece ao rolar | aprovado | teste automático |
| Dock inferior no mobile: escondida no hero, visível no meio, escondida no rodapé (home e página do treino) | aprovado | `home-m390-dock.png` |
| Sem rolagem horizontal em 1440, 390, 375 e 360, nas cinco páginas | aprovado | 17 medições |

## 2. Primeira dobra e CTAs
| Item | Resultado | Evidência |
|---|---|---|
| Home 390×844: título do evento e "Confirmar presença" visíveis sem rolar | aprovado | botão termina em 577 px de 844 |
| Home 375×812 e 360×640 | aprovado | 577 de 812; 567 de 640 |
| Página do treino 390/375/360: título e botão na dobra | aprovado | botão termina em 404 px |
| Desktop 1440 home e treino | aprovado | `home-d1440-dobra.png`, `evento-d1440-dobra.png` |

## 3. Formulários gravando
| Item | Resultado | Evidência |
|---|---|---|
| Confirmação de presença em 375, 390 e 1440: máscara de telefone, envio 201, "Interesse registrado!" | aprovado | 3 registros criados e apagados |
| Telefone duplicado → 409 → "Você já está na lista!" | aprovado | 3 casos |
| Campos vazios bloqueados com mensagens | aprovado | 3 casos |
| Escolinha: botão do pacote pré-seleciona a opção; envio grava com `pacote = curso-chevette`; "Tá na lista!" | aprovado | 1 registro criado e apagado; painel listou o registro |
| Anon não lê `interessados_escolinha` (RLS) | aprovado | 200 com zero linhas |

## 4. Painel e exportações
| Item | Resultado | Evidência |
|---|---|---|
| Login errado mostra mensagem | aprovado | o 400 do endpoint de token registrado no console é o próprio teste |
| Login da conta de QA (listada em `admins`) | aprovado | |
| Lista de treinos, criação de rascunho com upload de foto no bucket `fotos`, URL pública acessível | aprovado | arquivo apagado no fim |
| Rascunho invisível ao público; publicar torna visível com a edição; agenda mostra; home mantém 20.09 como próximo | aprovado | |
| Despublicar pela lista; confirmações listam registros; CSV de confirmações e CSV da escolinha baixam | aprovado | `confirmacoes.csv`, `interessados-escolinha.csv` |
| Apagar treino; sair volta ao login | aprovado | |
| Painel herda o novo cabeçalho e a nova paleta sem erro de console (1440 e 390) | aprovado | `admin-login-d1440.png`, `admin-login-m390.png` |

## 5. Página do treino: acesso direto e prévia
| Item | Resultado | Evidência |
|---|---|---|
| `/treinos/open-drift-session/` gerada pelo build, renderiza o evento (200 no servidor local) | aprovado | teste em 375/390/1440 |
| `og:title`, `og:description` próprios na página gerada; `og:image` = `assets/og.jpg` 1200×630 (marca oficial, sem foto) | aprovado | `treinos/open-drift-session/index.html` |
| Slug inexistente cai no `404.html` e mostra "Treino não encontrado" | aprovado | `naoexiste-d1440-dobra.png` |
| Prévia real no WhatsApp/Instagram | **não testado** | só é possível com a URL pública após o merge |

## 6. Console
| Item | Resultado |
|---|---|
| Zero erros de console em 17 combinações página × largura | aprovado |
| Zero erros de console no painel, exceto o 400 provocado pelo teste de login errado | aprovado |

## 7. Links, créditos e conteúdo do Open Drift Session
| Item | Resultado | Evidência |
|---|---|---|
| Google Maps e Waze na home apontam para o endereço; na página do treino vêm do banco | aprovado | |
| "Consultar caronas" leva ao @cariocadrift_ | aprovado | |
| Toda `figure.foto` com crédito "Sergio Photos RJ" (10 na home, 1 no Sobre); nenhuma foto do acervo recortada na base; marca d'água visível nas capturas | aprovado | `home-d1440.png`, `home-d1440-cena.png` |
| Textos em home e treino: 20.09, domingo 20 de setembro, 9h às 18h, RJ Race Park, Estrada do Frutuoso 320, ingressos no local, pista exclusiva para pilotos convidados, caronas pagas, capacete obrigatório | aprovado | 16 verificações |
| Nenhum texto de checkout, compra de ingresso ou inscrição de piloto | aprovado | |
| Render conceitual `carro.jpg` não aparece em nenhuma página nem como prévia | aprovado | contagem zero nos HTMLs gerados |

## 8. Produção (verificado agora, nada alterado)
| Item | Resultado | Detalhe |
|---|---|---|
| DNS | aprovado | 4 A do GitHub Pages, `www` CNAME, sem AAAA/CAA |
| Certificado | **aprovado** | GitHub emitiu: `CN=cariocadrift.com.br`, válido até 15/12/2026; API: `approved`. `https://cariocadrift.com.br` e `https://www.` respondem 200 com verificação OK |
| Enforce HTTPS | aprovado (ativado depois, ver seção 10) | estava desligado nesta verificação |
| Supabase Auth Site URL / Redirects | não alterado | atual `http://localhost:3000`, sem redirects; proposta na seção 2 de `LANCAMENTO-E2-INVENTARIO.md` |

## 9. Pendências que dependem de você
1. **Capa do evento no banco** é `/assets/carro.jpg` (render conceitual). O site agora ignora esse arquivo, então a página do treino fica sem capa. Troque no painel por uma foto do acervo (com a licença confirmada) ou deixe vazio. Não alterei o banco.
2. **Merge** de `fase-01-home` em `main` (publica automaticamente).
3. **Enforce HTTPS** no GitHub Pages.
4. **Site URL e Redirect URLs** do Supabase Auth de produção.
5. **Senha do administrador**: rodar `scripts/trocar-senha-admin.js` (revisão do script em `LANCAMENTO-E2-INVENTARIO.md`, seção 1, e na mensagem de entrega).
6. Após o merge: prévia real no WhatsApp, formulários reais em produção, `og.jpg` novo em cache das redes.

---

## 10. Fechamento (16/09, fim do dia)

| Item | Resultado | Detalhe |
|---|---|---|
| Senha do administrador | **aprovado** | Trocada por você pelo `scripts/trocar-senha-admin.js` (duas tentativas recusadas pelo script, terceira concluída). API de administração confirma `updated_at` e `last_sign_in_at` às 19:02 UTC. Logout global executado. Linha `ADMIN_SENHA_INICIAL` removida de `.env.local`. Zip antigo em `~/Downloads/cariocadrift-site.zip` ainda existe: apagar |
| Sessões antigas | **parcial** | Refresh tokens revogados na troca de senha e de novo ao fim do teste de recuperação. Access tokens já emitidos continuam válidos até expirar (padrão 1 h): uma aba antiga pode seguir lendo o painel até lá, sem conseguir renovar. Verificação final: recarregar a aba antiga após 1 h e confirmar que pede login |
| HTTPS · falha reportada por usuário | **aprovado (fechado)** | Você testou no mesmo celular por Wi-Fi e por dados móveis e o site abriu normalmente. Diagnóstico da seção 11 mantido como registro: nenhuma alteração foi necessária. Item encerrado. Relato original:  Captura real de um celular com `NET::ERR_CERT_COMMON_NAME_INVALID` em `cariocadrift.com.br`. Item reaberto; diagnóstico somente de leitura na seção 11. O lançamento fica bloqueado até HTTPS funcionar sem avisos nos dois domínios em conexões diferentes |
| Enforce HTTPS | ativado (ver linha acima) | Ativado após confirmar certificado `CN=cariocadrift.com.br` válido até 15/12/2026 e HTTPS 200 nos dois domínios. Testes: `www` → 301 para `https://cariocadrift.com.br/`; `/treinos/` em HTTP → 301 HTTPS; raiz em HTTP → ver linha abaixo. DNS e domínio não tocados |
| Raiz em HTTP → HTTPS | **aprovado** | Logo após ativar, o CDN devolveu 200 em cache (`Age` 390 s, `max-age` 600 s). Após expirar: `http://cariocadrift.com.br/` → 301 → `https://cariocadrift.com.br/` (200) |
| Capa do evento | **aguardando escolha** | Render bloqueado. Prévias com fotos do acervo ainda não usadas no site: `capa-3132`, `capa-3142`, `capa-3127` (desktop e mobile). Crédito "Foto Sergio Photos RJ · Registro de treino anterior" automático para fotos do acervo. Banco não alterado |
| Supabase Auth | **aprovado** | Salvo em produção e confirmado após recarregar o painel do Supabase: Site URL `https://cariocadrift.com.br`; Redirect URLs: `https://cariocadrift.com.br/admin/` (total 1). Nenhuma outra configuração do Auth tocada |
| Recuperação de senha (fluxo real) | **aprovado** (parte automática) | Link de recuperação gerado pela API de administração com destino `/admin/`, aberto em navegador limpo contra a produção: caiu em `https://cariocadrift.com.br/admin/`, o painel entrou em modo de recuperação e exibiu o prompt "Nova senha", dispensado sem digitar; sem erros de console. Tokens e links não foram impressos. Observação: sem `redirect_to`, o link cai na Site URL (home), onde não há tratamento; o botão "Esqueci minha senha" do painel envia `/admin/`, então o caminho real está coberto |
| Recuperação de senha (e-mail) | **enviado, aguarda seu clique** | Pedido pelo mesmo caminho público do botão (HTTP 200) após a janela de limite de envio do Supabase (1 por minuto). Chegou no e-mail do administrador. Ao clicar, o painel abre com o prompt de nova senha: pode cancelar; o link expira sozinho. Se não chegar em alguns minutos, o SMTP padrão do Supabase é o suspeito |
| Efeito colateral do teste | registrado | O teste encerrou globalmente as sessões da conta do administrador ao final (para não deixar a sessão criada pelo link pendurada). Se você estava logado no painel, vai precisar entrar de novo. Nenhuma senha foi alterada |
| Capa alternativa só com a marca | **pronta, não aplicada** | `assets/capa-marca-open-drift-session.jpg` (1320×880, logo oficial, título e data, sem foto e sem render). Prévias `capa-marca-d1440.png` e `capa-marca-m390.png`. A 3132 continua candidata, condicionada à licença do fotógrafo. Banco não alterado |
| Merge | não autorizado | `fase-01-home` pronto, 3 commits desde o QA (E.2, checklist, crédito da capa) |

**Só testável após a publicação:** prévia de link no WhatsApp e Instagram com o novo `og.jpg`; formulários e painel no domínio real; página `/treinos/open-drift-session/` com 200 no GitHub Pages; recuperação de senha por e-mail (depende da configuração do Auth).

---

## 11. HTTPS: diagnóstico da falha reportada (somente leitura, 16/09 19:26 UTC)

Relato: captura real de um celular com `NET::ERR_CERT_COMMON_NAME_INVALID` em `cariocadrift.com.br`. Nada foi alterado: DNS, domínio no Pages e "Enforce HTTPS" ficaram como estavam.

**DNS (resolvedores do sistema, Google 8.8.8.8, Cloudflare 1.1.1.1, Quad9 9.9.9.9, OpenDNS 208.67.222.222 e o autoritativo a.sec.dns.br):** respostas idênticas em todos. `cariocadrift.com.br` A = 185.199.108/109/110/111.153, sem AAAA, sem CAA, sem MX, sem TXT, sem curinga; `www` = CNAME `thiagofrds.github.io`, que resolve para os mesmos quatro IPv4 e para 2606:50c0:8000/8001/8002/8003::153 em IPv6; CAA herdado do github.io permite Let's Encrypt, DigiCert e Sectigo. Zona no Registro.br com DNSSEC (registro DS presente), TTL 3600. Nenhum endereço fora do GitHub Pages, nenhum registro antigo, nenhum proxy (o próprio GitHub confirma `is_proxied: false`).

**Certificado entregue por cada endereço, com SNI:**

| IP | SNI | CN | SANs | Válido até | Emissor | Validação |
|---|---|---|---|---|---|---|
| 185.199.108.153 | cariocadrift.com.br e www | cariocadrift.com.br | cariocadrift.com.br, www.cariocadrift.com.br | 15/12/2026 | Let's Encrypt | OK |
| 185.199.109.153 | idem | idem | idem | idem | idem | OK |
| 185.199.110.153 | idem | idem | idem | idem | idem | OK |
| 185.199.111.153 | idem | idem | idem | idem | idem | OK |
| 2606:50c0:8000::153 | idem | idem | idem | idem | idem | OK |
| 2606:50c0:8001::153 | idem | idem | idem | idem | idem | OK |
| 2606:50c0:8002::153 | idem | idem | idem | idem | idem | OK |
| 2606:50c0:8003::153 | idem | idem | idem | idem | idem | OK |
| qualquer IP, **sem SNI** | — | *.github.io | — | — | — | falha de nome (esperado; todo navegador moderno envia SNI) |

Cadeia completa e válida nos 16 testes (8 endereços × 2 nomes). O certificado tem `notBefore` = 16/09/2026 17:39 UTC (14:39 em Brasília). `www` responde 301 para o domínio principal em HTTPS. Relatório de saúde do GitHub Pages: `is_valid`, `responds_to_https`, `is_https_eligible`, `https_error: null`, `caa_error: null` para os dois domínios. Todas as minhas requisições saíram pelo ponto de presença GIG (Rio) da Fastly; não tenho acesso a rede móvel nem a outros pontos de presença, então isso **não foi testado**.

**Causa mais provável (não comprovada):** o celular acessou antes das 14:39 de Brasília de hoje, quando todos os clientes recebiam o certificado `*.github.io`, exatamente o erro reportado; ou acessou nos primeiros minutos após a emissão, por um ponto de presença que ainda não tinha o certificado novo. **Hipóteses restantes, não comprovadas:** rede móvel ou Wi-Fi com interceptação TLS (portal cativo, proxy corporativo), ou navegador muito antigo sem SNI.

**Correção proposta:** nenhuma alteração de infraestrutura, porque nada está errado do lado servidor. Pedido de dados para fechar: horário da captura, URL exata (com ou sem `www`), rede (Wi-Fi ou operadora) e, se o erro persistir agora, o nome do certificado mostrado nos detalhes do aviso. Se o erro se repetir com hora posterior a 14:39 e certificado `*.github.io`, abrir chamado no suporte do GitHub Pages com esses dados; nesse cenário, remover e readicionar o domínio é a única ação disponível do nosso lado, e só com sua autorização.

## 12. Refinamentos da E.2 e valores do evento (QA de 16/09, fim do dia)

Roteiros: `capturas-e2.js` 241 verificações, `qa-lancamento.js` 64, zero falhas reais (a única linha de falha é o HTTP 400 provocado pelo próprio teste de login errado do painel). Capturas em `docs/capturas/e2/`.

| Refinamento | Resultado | Evidência |
|---|---|---|
| 1. Mapa do traçado inteiro na Home | aprovado | proporção renderizada igual à do arquivo (1,596), sem `object-fit: cover`; no celular, "toque para ampliar" abre o arquivo original. `home-d1440-mapa.png`, `home-m390-mapa.png` |
| 2. Instagram `@cariocadriftculture` | aprovado | zero ocorrências do @ antigo nas 7 páginas; todo link de perfil aponta para `instagram.com/cariocadriftculture/` (o link "Assista ao vídeo" do treino é um reel, vem do banco e não é o perfil). Créditos Sergio Photos RJ intactos |
| 3. Layout mais limpo | aprovado (visual) | cabeçalhos das seções integrados (fonte das fotos abaixo do subtítulo, link de detalhes junto do título), legendas das fotos em linha única com separador, bloco "Segurança" alinhado, escolinha da Home reduzida a título, frase e botão, legenda de seções redundante removida do mapa |
| 4. Página `/caronas/` | aprovado | texto: paga, depende de disponibilidade, confirmação da organização, capacete, sem preço e sem reserva garantida; CTA único pelo direct do Instagram; "Consultar caronas" da Home, do treino e da agenda apontam para ela; sem formulário (não foi necessário criar tabela) |
| 5. Escolinha sem preços | aprovado | Home e página sem R$, parcelamento, pacotes, módulos, carros ou datas; mensagem "em estruturação" e "Valores sob consulta"; CTA "Quero receber informações" leva ao formulário; campo de pacote removido da interface, envio grava `pacote = nao-sei` (coluna já aceita esse valor, **sem alteração de banco**); envio real testado e apagado |
| Valores do Open Drift Session | aprovado | página do treino com bloco "Quanto custa": Assistir R$ 30 (vendido no local), Estacionamento R$ 15 (condições a confirmar, sem "por veículo/pessoa/período"), Piloto convidado R$ 80 (pista exclusiva, sem inscrição pública), Carona sob consulta com link para `/caronas/`; aviso de venda somente no local. Home com resumo discreto em "Como participar". Sem checkout. Valores no código (`assets/cd.js`), banco intocado |
| Navegação e links | aprovado | 7 páginas × 4 larguras sem erro de console nem rolagem horizontal; `caronas/` no rodapé |
| Formulário do treino e painel | aprovado | 3 confirmações + duplicado + validação; painel completo com upload, publicação, CSVs; registros de teste apagados |
| Não testado | — | prévia de link nas redes, produção real (dependem do merge) |

## 13. Capa provisória e estacionamento (16/09, noite)

| Item | Resultado | Detalhe |
|---|---|---|
| Capa provisória com a marca oficial | **aprovado** | Com sua autorização, `treinos.capa_url` do Open Drift Session passou de `/assets/carro.jpg` para `/assets/capa-marca-open-drift-session.jpg` (única alteração no banco, via API com a chave de serviço, equivalente ao painel). Hero do evento mostra a peça em 1440/390/375/360 com a legenda "Capa · Open Drift Session · RJ Race Park", sem crédito de fotógrafo porque não é fotografia. A prévia (`og:image`) da página estática do evento passa a apontar para a peça. Render conceitual continua bloqueado no código. Foto 3132 não utilizada |
| Efeito em produção | registrado | A produção atual lê a capa do banco em tempo real: a página do evento no ar deixou de mostrar o render e passou a mostrar a peça da marca como fundo do hero antigo. A prévia estática de produção só muda após o merge |
| Estacionamento R$ 15 por carro | **aprovado** | Home: "Ingresso R$ 30, vendido no local, no dia. Estacionamento R$ 15 por carro."; evento: bloco "Quanto custa" com "Por carro." Público R$ 30 e piloto convidado R$ 80 mantidos |
| QA dos elementos alterados | aprovado | `capturas-e2.js` nas 4 larguras, zero falhas; recortes `home-*-participar.png` e `evento-*-valores.png` |

## 14. Divergência no celular, Central de Leads e Carona Radical (16/09, noite)

| Item | Resultado | Detalhe |
|---|---|---|
| Visual da E.2 não aparece no celular | **causa comprovada** | O celular abre `https://cariocadrift.com.br`, que publica o `main` (último commit 053c79b, deploy do Pages de 15:24 UTC, tema antigo #1B1A1F, `logo.jpg`, ticker, zebra, `@cariocadrift_`). O desktop abre `http://localhost:8765`, build local de `fase-01-home` (33 commits à frente, tema #0B0B0B, logo PNG, E.2). Mesmos arquivos `site.css` e `cd.js` por caminho, conteúdos diferentes. Não é cache nem regra responsiva: as capturas `comparativo-*` mostram produção e local em 390 e 1440. A E.2 só chega ao celular com o merge |
| Painel › Leads | **implementado e testado** | Seção Leads com abas Treinos (`confirmacoes`), Carona Radical (`interessados_carona`), Escolinha (`interessados_escolinha`); colunas nome, telefone, data, origem, treino; pesquisa por nome ou telefone (sem acento); filtro por treino nas abas Treinos e Carona; CSV separado por categoria com coluna de origem; tabela empilhada no celular. Gravação, validação e comportamento dos formulários existentes preservados. Acesso restrito por RLS com `eh_admin()` no banco, não só pela interface. Nenhum dado pessoal em URL ou log: filtros são locais |
| Escolinha no painel | aprovado | lista e CSV funcionam; pacotes antigos aparecem marcados como "(pacote antigo)"; formulário público sem preços e sem escolha de pacote |
| Formulário `/caronas/` | **implementado, gravação não testável** | nome, telefone com DDD (validação de DDD e 8 ou 9 dígitos), consentimento obrigatório, honeypot invisível, limite de um envio a cada 10 s por página, associação ao treino por `?treino=slug` só se publicado, mensagem de sucesso exata, aviso "Prefere decidir na hora?", sem preço, sem reserva e sem horário. Envio grava em `interessados_carona`, que **ainda não existe**: até a migration, o formulário mostra "Não deu pra enviar agora" |
| Migration proposta | **aguarda sua autorização** | `supabase/migrations/20260916210000_interessados_carona.sql`: tabela própria (não mistura com confirmações, escolinha, ingressos ou pista), checks de nome/telefone/consentimento, unicidade por treino+telefone, RLS (anon só insere com consentimento; admin lê e apaga; ninguém altera), privilégios mínimos, gatilho anti-abuso (30 por 10 min no total, 3 por telefone por hora), testes listados no próprio arquivo |
| QA | aprovado no que é testável | `capturas-e2.js` 252 verificações e `qa-lancamento.js` 64, zero falhas reais; painel: Leads › Treinos com origem, pesquisa, CSV; Carona responde "migration pendente"; Escolinha lista e exporta; registros de teste apagados. Não testado: gravação da carona e sua exibição no painel (dependem da migration) |

## 15. Migration da Carona Radical: revisão e testes isolados (16/09, noite)

| Item | Resultado | Detalhe |
|---|---|---|
| HTTPS no celular | **aprovado** | Testado por você em Wi-Fi e dados móveis, sem aviso. Item fechado |
| Formulário de carona ao público | oculto | Chave `CARONA_LISTA_ATIVA = false`; página mostra "abre em breve" e "Prefere decidir na hora?"; QA nas 4 larguras confirma formulário oculto |
| Ambiente isolado | criado | PostgreSQL 17 local (Homebrew), cluster temporário só em socket local, shim dos papéis e de `auth.jwt()`; nenhum projeto Supabase tocado. Reproduzível com `sh supabase/tests/rodar-local.sh` |
| Migration `20260916210000_interessados_carona.sql` | **não aplicada, aguardando revisão** | Limite global ajustado de 30 para 60 envios por 10 minutos; 3 por telefone por hora mantido; bloqueio consultivo por transação para contagem exata sob concorrência |
| Testes funcionais | **32 de 32 passaram** | inserção anônima, leitura anônima negada, unicidade por treino e telefone, checks de nome e telefone, consentimento e origem obrigatórios pela policy, sem alteração ou exclusão pelo anônimo, não admin vê zero linhas, admin lê e apaga e não altera, gatilho por telefone e por janela, função do gatilho não executável pela API, outras tabelas intactas |
| Testes de concorrência | **aprovado** | 50 registros na janela + 40 envios simultâneos com telefones distintos: exatamente 10 entraram e 30 foram barrados, total 60. 6 envios simultâneos do mesmo telefone em treinos diferentes: exatamente 3 entraram e 3 barrados. Nenhum interessado legítimo barrado abaixo do limite |

## 16. Ajustes finais da migration da Carona Radical (16/09, noite)

| Ajuste pedido | Resultado | Como foi verificado |
|---|---|---|
| `evento` só aceita treino real | **aprovado** | chave estrangeira para `treinos.slug` (atualiza em cascata, vira nulo se o treino for apagado) e gatilho exige treino **publicado**; interesse geral sem evento continua permitido. Testes: slug inventado → 23503; treino em rascunho → 23503; sem evento → ok |
| Limites 60 por 10 min e 3 por telefone por hora | **aprovado** | 61º envio e 4º do mesmo telefone barrados; 40 envios simultâneos com 50 na janela: exatamente 10 entram; 6 simultâneos do mesmo telefone: exatamente 3 entram. Mensagens no formulário: "Muita gente entrando na lista agora. Tenta de novo em alguns minutos." e "Esse telefone já entrou na lista várias vezes na última hora…" (exibição no navegador depende do Supabase real) |
| Gatilho conta todos os registros mesmo com RLS | **aprovado** | suíte rodada com as tabelas pertencendo a um role sem superusuário e sem `bypassrls`; a função `security definer` contou os 60 registros que o anônimo não pode ler e barrou o 61º |
| Formulário envia sem permissão de leitura | **aprovado no Postgres** | anônimo tem só INSERT; inserir sem RETURNING funciona e listar dá erro de privilégio. O envio real usa `Prefer: return=minimal`, que não exige leitura: **a confirmar no Supabase real** |
| Duplicidade não revela dados | **aprovado** | o gatilho detecta a duplicata antes do índice e responde "telefone já está na lista", sem chave nem dados; teste confere que a mensagem não contém telefone, nome nem "Key (" |
| Admin visualiza, pesquisa, exporta e exclui | **aprovado no banco; interface a confirmar** | no Postgres: admin lê e apaga, não admin vê zero. A aba Carona Radical do painel (listar, pesquisar, filtrar por treino, CSV, apagar) só pode ser testada de ponta a ponta depois da migration no Supabase real |
| Suíte isolada | **35 de 35 passaram** | `sh supabase/tests/rodar-local.sh` + `supabase/tests/concorrencia-carona.sh` |

**Depende de validação no Supabase real (após a migration):** códigos HTTP do PostgREST (201/409/400/403), `return=minimal` sem SELECT, mensagens do gatilho chegando ao formulário, aba Carona Radical no painel de ponta a ponta com registro de teste apagado ao final, e o comportamento do role `postgres` do Supabase como dono (esperado igual ao testado).

## 17. Migration da Carona Radical: manipulação de dados e oráculo de telefone (16/09, noite)

| Ponto | Correção | Verificação isolada |
|---|---|---|
| Visitante definir `id` ou `criado_em` | privilégio de INSERT restrito às colunas do formulário (evento, nome, telefone, consentimento, origem); o gatilho ainda força `criado_em = now()` | enviar `criado_em` antigo, `criado_em` futuro ou `id` escolhido → erro de privilégio; nenhuma linha gravada |
| Oráculo de telefone nos limites | limites passam a contar **tentativas** numa tabela interna sem acesso pela API, verificados antes da duplicidade; duplicata continua silenciosa e conta como tentativa | janela cheia: telefone novo e telefone cadastrado recebem a mesma resposta; limite por telefone: 3 tentativas ok e 4ª barrada, com a mesma mensagem para novo e cadastrado; tentativas barradas não gravam |
| Apagar treino gera interesses gerais repetidos | documentado no SQL (item 7); painel marca "Interesse geral · repetido" quando o mesmo telefone tem mais de um registro sem treino | teste 2b: apagar treino com telefone presente no treino e na geral → sucesso, nenhum registro perdido |
| Suíte isolada | **46 de 46**, dono das tabelas sem superusuário e sem contorno de RLS | `docs/capturas/testes-carona-resultado.txt` |
| Concorrência | 50 na janela + 40 simultâneos: exatamente 10 entram; 6 simultâneos do mesmo telefone: exatamente 3 | idem |

Ainda não aplicada. Formulário oculto. Sem merge.

## 18. Carona Radical em produção: migration aplicada e validação real (16/09, noite)

| Item | Resultado | Detalhe |
|---|---|---|
| Migration aplicada | **aprovado** | Aplicada por você pelo terminal com `scripts/aplicar-migration-carona.sh`, na conexão direta ao projeto carioca-drift, banco `postgres`, arquivo conferido pelo checksum da versão aprovada (commit 332537a), transação única. Objetos confirmados: tabelas `interessados_carona` e `tentativas_carona`, três policies, `anon` só com INSERT nas cinco colunas do formulário, gatilho `interessados_carona_limite` |
| Validação pela API real | **25 de 25** | `supabase/tests/validar-producao-carona.js`: inserção 201 com `return=minimal`; leitura anônima 401; id e `criado_em` (antigo e futuro) enviados pelo cliente → 401 sem gravar; duplicata → 201 sem linha nova; treino inexistente → 409/23503; telefone curto → 400; sem consentimento → 401; origem diferente → 401; interesse geral → 201; update e delete anônimos → 401 e registro intacto; limite por telefone: 3 tentativas ok e 4ª barrada com a mesma resposta para telefone novo e cadastrado. Registros e tentativas de teste apagados. Limite global de 60 **não testado em produção**, por decisão (barraria visitantes reais) |
| Formulário ligado | feito | `CARONA_LISTA_ATIVA = true` no build de `fase-01-home` (ainda não publicado) |
| QA no navegador, formulário → painel | **22 de 22** | mobile 390 pela página do Open Drift Session e desktop 1440 pela página geral: formulário visível, treino de origem identificado, validação dos três campos, envio com a mensagem exata "Interesse registrado! … O cadastro não garante vaga.", registro gravado com treino e consentimento, reenvio mostra a mesma confirmação sem gravar linha nova, sem erros de console. Painel › Leads › Carona Radical: os dois registros com origem e treino/geral, pesquisa por nome e por telefone, filtro por treino, CSV com cabeçalho e registros, exclusão refletida no banco. Registros e tentativas apagados ao final |
| Capturas gerais | 252 verificações, zero falhas | página de caronas com formulário ativo: consentimento, botão, aviso "decidir na hora", honeypot invisível, associação ao treino |
| Não feito | — | teste de carga em produção; merge; publicação |
