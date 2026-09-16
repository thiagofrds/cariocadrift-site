# Etapa B — Contas e perfis: plano de execução

Branch `etapa-b-contas`, criado a partir de `fase-01-home` em 16/09/2026. Revisão de 16/09 (quatro dependências técnicas): publicação por artefato sem HTML gerado em commit, lista de perfis para o build por Edge Function com segredo de automação, `acoes_usuario` criada em B1, inventário de privilégios antes da revogação geral com testes de regressão. Segue `ARQUITETURA-CONSOLIDADA.md` (aprovada). Este arquivo é o roteiro operacional; não contém SQL nem código. **Nada aqui é executado antes da conclusão da etapa A e da sua autorização expressa.** Tudo roda exclusivamente no projeto `carioca-drift-dev`; produção não é tocada.

## 0. Decisões registradas para a etapa

- Ambiente: segundo projeto Supabase `carioca-drift-dev`, mesma organização, região sa-east-1, isolado da produção e do NMI. Criação só depois do aviso de custo e do seu ok.
- Auth: Site URL e redirecionamentos configurados só no DEV, depois de disponível.
- Prazos aceitos: até 15 minutos para HTML gerado responder 200 e para o nome sair do HTML ao despublicar; até 10 minutos para URLs assinadas já emitidas.
- Escrita do próprio usuário: seção 3.1 da arquitetura (UPDATE direto por coluna em `usuarios` e `veiculos`; handle e visibilidade por função; todo o resto por função).

## 1. Preparação do DEV (sem migrations)

1. Criar `carioca-drift-dev` no painel (você, ou eu com sua autorização), menor compute disponível.
2. Guardar em `.env.dev.local` (gitignored, mesmo padrão de `.env.local`): URL, chave publishable, chave de serviço, senha do banco. Nunca no repositório, nunca impresso em chat.
3. Aplicar no DEV as quatro migrations já existentes em `supabase/migrations/` (as de produção), para o DEV nascer igual à produção antes de qualquer novidade. Conferir com o roteiro 5.2 da arquitetura que o painel atual funciona apontando para o DEV.
4. Auth do DEV: Site URL `http://localhost:8765`, redirecionamentos `http://localhost:8765/**`; e-mail e senha ligados; confirmação por código de seis dígitos; senha mínima forte; SMTP padrão do Supabase (limitado; suficiente para DEV).
5. Criar um usuário admin de teste no DEV via API de admin (não reutilizar o e-mail nem a senha de produção), inserido em `admins` do DEV.
6. Site: `assets/cd.js` passa a ler URL e chave de um bloco de configuração por ambiente (produção como padrão, DEV escolhido por `?env=dev` só em localhost). Sem isso, o site local continuaria apontando para produção.

## 2. Migrations da etapa B, na ordem

Cada uma é um arquivo em `supabase/migrations/`, escrito e revisado antes de aplicar, aplicado só no DEV.

| # | Arquivo | Conteúdo | Reversão |
|---|---|---|---|
| B1 | `..._usuarios.sql` | `usuarios` com colunas, checks e trigger de `atualizado_em`; `handles_reservados` com semente; **`acoes_usuario`** (`id`, `usuario_id`, `acao`, `contexto` jsonb, `criado_em`; RLS SELECT só das próprias linhas; nenhuma escrita direta; só funções gravam), criada aqui porque `definir_handle` (B3) e `definir_perfil_publico` (B6) dependem dela; RLS de `usuarios`: SELECT própria linha e admin; UPDATE própria linha com `estado_cadastro = 'completo'` e checagem de `avatar_path`; **REVOKE ALL** dos privilégios padrão de `anon` e `authenticated` nas três tabelas, depois GRANT SELECT e GRANT UPDATE por coluna só onde a seção 3.1 manda | drop das tabelas |
| B2 | `..._trigger_perfil.sql` | trigger em `auth.users` (insert) que cria `usuarios` a partir do metadado, com captura de colisão de handle → `handle_pendente`, e `on conflict (id) do nothing` | drop do trigger e da função |
| B3 | `..._handle.sql` | `normalizar_handle`, `handle_disponivel` (EXECUTE só para `service_role`, chamada pela Edge Function), `definir_handle` (authenticated; grava em `acoes_usuario`) | drop das funções |
| B4 | `..._capacidades.sql` | `capacidades`, `acoes_admin`; `conceder_capacidade` e `revogar_capacidade` (recusam alvo = chamador; revogar remove e-mail de `admins` na mesma transação); RLS SELECT próprias linhas e admin; nenhuma escrita direta | drop |
| B5 | `..._eh_admin_modo_duplo.sql` | novo corpo de `eh_admin()` com precedência de `capacidades`; `origem_admin()` | restaurar o corpo anterior, guardado no próprio arquivo como comentário e em migration de reversão |
| B6 | `..._perfil_publico.sql` | `definir_perfil_publico(bool)` com auditoria em `acoes_usuario` (já existente desde B1); `perfil_publico(handle)` com projeção fixa; `perfis_publicos_para_build()` devolvendo só `handle` e `nome_exibicao` de perfis públicos e completos, paginada, EXECUTE **só para `service_role`**; EXECUTE de `perfil_publico` para anon e authenticated; revogação de EXECUTE de PUBLIC em todas as funções desta migration | drop |
| B7 | `..._storage_avatares.sql` | bucket privado `avatares`; policies de INSERT/UPDATE/DELETE na própria pasta; SELECT conforme seção 4.5.1 | remover bucket e policies |
| B8 | `..._privilegios.sql` | **só depois do inventário da seção 2.1**: revogação de EXECUTE de PUBLIC/anon/authenticated em cada função listada como indevida no inventário, função por função (não `REVOKE ... ALL FUNCTIONS IN SCHEMA`, para não atingir `eh_admin()` e as funções de policy); alteração dos privilégios padrão do schema para que funções novas nasçam sem EXECUTE para anon/authenticated; lista de exceções explícita e testada (seção 2.1) | migration de reversão gerada a partir do inventário, reconcedendo exatamente o que foi revogado |

Fora desta etapa: `veiculos` e bucket `veiculos` (etapa C), `handles_anteriores` (troca de handle, não autorizada).

Observação sobre privilégios padrão: o Supabase concede, por padrão, todos os privilégios de tabela e EXECUTE de função a `anon` e `authenticated` no schema `public`; RLS é o que bloqueia. Por isso toda migration desta etapa revoga o padrão antes de conceder o mínimo, e a suíte confere o resultado lendo o catálogo.

### 2.1 Inventário de funções e permissões antes de B8

Executado no DEV logo após aplicar as migrations de produção (passo 3 da seção 1) e repetido após B7, antes de escrever B8.

1. Script somente leitura `scripts/inventario-privilegios.js`, com a chave de serviço do DEV, gera `docs/inventarios/privilegios-dev-<data>.md` (sem segredos) listando: toda função do schema `public` com `security definer` ou não, `search_path`, e quem tem EXECUTE (`pg_proc` + `aclexplode`); toda tabela com privilégios por role (`information_schema.table_privileges` e `column_privileges`) e policies (`pg_policies`); policies de `storage.objects`; triggers.
2. Classificação de cada função, em tabela no relatório, em uma de quatro categorias:

| Categoria | Regra | Exemplos esperados |
|---|---|---|
| Pública por desenho | EXECUTE para anon e authenticated, listada como exceção | `perfil_publico` |
| Usada dentro de policy | precisa de EXECUTE para todo role que passa pela policy (anon e authenticated), senão a policy falha e o site quebra | `eh_admin()` (usada nas policies de `treinos`, `confirmacoes`, `interessados_escolinha`, storage `fotos`) |
| Só para logados | EXECUTE só para authenticated, verificação de capacidade dentro | `definir_handle`, `definir_perfil_publico`, `conceder_capacidade`, `revogar_capacidade`, `origem_admin` |
| Só automação | EXECUTE só para `service_role` | `handle_disponivel`, `perfis_publicos_para_build` |
| Interna | nenhum EXECUTE de API; trigger e auxiliares | função do trigger de perfil, `normalizar_handle` |

3. B8 revoga exatamente o que o relatório marca como indevido. Qualquer função fora dessas categorias é decidida à mão e registrada no relatório com o motivo.
4. O que não pode quebrar, conferido antes e depois de B8 pela suíte de regressão (seção 5): anon insere em `confirmacoes` e em `interessados_escolinha`; anon lê `treinos` publicados e não lê rascunhos; anon não lê `confirmacoes`; leitura pública do bucket `fotos`; painel `/admin/` inteiro (roteiro 5.2 da arquitetura); `qa-lancamento.js` apontado para o DEV.
5. O inventário é repetido nas etapas C, D e E, sempre antes de qualquer revogação nova.

## 3. Script de semente administrativa (passo 2 da migração)

Script Node em `scripts/migrar-admins.js`, executado à mão com a chave de serviço do DEV, com `--relatorio` (só lista) e `--aplicar`. Lê `admins`, procura cada e-mail em `auth.users`, cria `usuarios` com handle provisório reservado (`admin_1`, `admin_2`…) e `estado_cadastro = 'completo'` (o admin troca o handle depois pela política de troca, quando existir, ou o script aceita `--handle email=handle` na aplicação), insere `capacidades = admin` com `motivo = 'migração'`. Imprime relatório sem valores sensíveis.

## 4. Site (páginas novas e alterações)

- `conta/index.html`: entrar, criar conta (tela única), código por e-mail, escolha de handle quando pendente, "Minha conta" (perfil, foto, interruptor de visibilidade com o texto sobre prazos e caches).
- `u/index.html` + tratamento em `404.html` por prefixo `/u/`: renderiza `perfil_publico(handle)`; "perfil não disponível" para nulo; `robots noindex, noarchive`.
- `src/build.py`: gera `u/<handle>/index.html` para perfis públicos com só `nome_exibicao` e `@handle` no título, descrição fixa, `og:image` da marca, **em um diretório de saída (`_site/`) que fica fora do Git**; nada gerado é commitado.
- `.github/workflows/publicar.yml`: publicação por artefato (seção 4.1), a cada 15 minutos e sob demanda.

### 4.1 Publicação por artefato, sem dados pessoais no histórico

Hoje o GitHub Pages publica o branch `main`, e o build gera `treinos/<slug>/index.html` dentro do repositório. Para perfis isso é inaceitável: um commit público com nome e @ de alguém fica no histórico para sempre, mesmo depois de despublicado.

**Solução: fonte de publicação "GitHub Actions" em vez de "branch".** A troca é uma configuração do repositório, feita só na etapa B com sua autorização, e não afeta a etapa A enquanto não for feita.

1. O workflow roda a cada 15 minutos, sob demanda e a cada push em `main`. Faz checkout, roda `build.py` para `_site/`, sobe `_site/` como artefato de publicação (`actions/upload-pages-artifact`) e publica (`actions/deploy-pages`).
2. O repositório passa a conter só fonte: `src/`, `assets/`, `docs/`, `supabase/`. As páginas geradas de treinos e de perfis existem apenas no artefato. O `.gitignore` bloqueia `_site/`, `u/` e `treinos/*/`.
3. Retirar uma página é o build seguinte não a gerar. O artefato anterior é descartado pelo GitHub em 1 dia (`retention-days: 1`) e não é público: só quem tem acesso de escrita ao repositório vê artefatos, e eles expiram.
4. O CDN do GitHub Pages serve com `Cache-Control: max-age=600`, então uma página retirada pode continuar sendo servida por até 10 minutos após a publicação. Somados aos 15 minutos do agendamento, o teto prático é 25 minutos para o nome sair do ar; a arquitetura fala em "até 15 minutos" para o build, e este parágrafo documenta os 10 minutos adicionais do CDN. **Os 25 minutos são uma estimativa nova, registrada em 16/09, ainda não aceita como garantia; o que está aceito são os 15 minutos do build e os 10 minutos das URLs assinadas.**
5. A migração das páginas de treinos para o mesmo mecanismo acontece junto, o que elimina o build manual atual.

**Limites dos caches externos, documentados para o texto do interruptor e para a política de privacidade:**

| Serviço | O que guarda | Por quanto tempo | O que podemos fazer |
|---|---|---|---|
| WhatsApp | título, descrição e imagem da prévia, gerados no aparelho de quem colou o link | enquanto a conversa existir | nada; não há API de limpeza |
| Instagram, Facebook, Messenger | prévia do link | dias a semanas | pedir nova leitura no depurador de compartilhamento da Meta, sem garantia de propagação |
| Telegram | prévia do link | dias | pedir atualização ao bot oficial de prévias |
| X | card do link | cerca de uma semana | nada direto |
| Google, Bing | com `noindex, noarchive`, tendem a não indexar nem guardar cópia | — | pedir remoção de URL no Search Console/Webmaster Tools, que temos por sermos donos do domínio; não é imediato |
| Internet Archive | pode guardar cópia mesmo com `noarchive` | indefinido | pedir exclusão por e-mail, a critério deles |
| Navegador de quem visitou | cache local e histórico | a critério do usuário | nada |

Nenhuma dessas limpezas é prometida ao usuário. O que é prometido: os dados sensíveis nunca vão a arquivo, o nome e o @ saem do nosso servidor em até 25 minutos, e o histórico Git nunca os contém.

### 4.2 Como o build obtém a lista de perfis públicos

O build não lê `usuarios` e o site nunca carrega a chave de serviço.

1. Edge Function `lista-perfis-build` no Supabase. Só ela usa a chave de serviço, que fica nos segredos do próprio Supabase e nunca sai dele. Ela chama `perfis_publicos_para_build()` (EXECUTE só para `service_role`), que devolve `handle` e `nome_exibicao` de perfis com `perfil_publico = true` e `estado_cadastro = 'completo'`, paginada por 500.
2. A Edge Function exige o cabeçalho `x-build-token` e compara em tempo constante com o segredo `BUILD_TOKEN` guardado nos segredos do Supabase. Sem o cabeçalho, ou com valor errado, responde 401 sem corpo. Aplica limite de 60 chamadas por hora e registra cada chamada.
3. O mesmo `BUILD_TOKEN` fica em GitHub Actions como segredo do ambiente `github-pages`, mascarado nos logs, disponível só a workflows do branch `main` (nunca a pull requests de fork). O workflow o passa ao `build.py` por variável de ambiente; o script nunca o imprime.
4. Treinos continuam sendo lidos com a chave publishable, porque a policy de `treinos` publicados já é pública.
5. Rotação: trocar o `BUILD_TOKEN` nos dois lugares; a função antiga para de aceitar na hora. Não há chave de serviço nem senha de banco em GitHub.
6. Impacto de um vazamento do `BUILD_TOKEN`: lista de handles e nomes de exibição de perfis já públicos, nada além. Mesmo assim ele é rotacionado a cada etapa.

Alternativa descartada: expor a lista por função ao `anon`. Os dados são públicos um a um, mas a enumeração completa de usuários não deve ser gratuita.
- Painel `/admin/`: aba Usuários (lista, origem da permissão via `origem_admin`, conceder/revogar capacidade com motivo), e indicador "permissão via".
- Nav: entrada "Conta" (E.2 já prevê).

## 5. Testes

- Suíte de banco (Node + `pg`, em `tests/db/`), rodando contra o DEV, cobrindo: seção 5.1 completa (autenticação, autorização, revogação, compatibilidade, rollback), seção 3.1 (uma célula por coluna, mais leitura de `column_privileges`), concorrência do @ (dois inserts simultâneos em `auth.users` via API de admin), estado `handle_pendente`, idempotência do trigger, `perfil_publico` com perfil privado/público/inexistente/reservado devolvendo o mesmo nulo nos três últimos, policies de storage nos dois sentidos, privilégios de EXECUTE.
- Teste do build: gera um perfil público de teste, roda `build.py`, lê o HTML e confere ausência de apresentação, Instagram, telefone, e-mail e caminhos de foto; despublica, roda de novo, confere remoção.
- Roteiro de navegador (`docs/capturas/qa-etapa-b.js`, Playwright): cadastro em 390 px, código, handle pendente forçado, "Minha conta", ligar/desligar visibilidade, `/u/<handle>/` nos dois estados.
- Roteiro 5.2 do painel, executado com o admin migrado do DEV, lado positivo e negativo.
- **Regressão de privilégios (antes e depois de B8, e a cada migration):** anon insere em `confirmacoes` (201) e em `interessados_escolinha` (201); anon lê `treinos` publicados e recebe zero linhas de rascunho; anon não lê `confirmacoes` nem `interessados_escolinha`; leitura pública do bucket `fotos` continua e escrita anônima continua negada; usuário logado sem capacidade não escreve em `treinos`; `eh_admin()` continua executável por anon e authenticated (indispensável às policies); teste que compara o catálogo de privilégios com a lista de exceções da seção 2.1 e falha em qualquer diferença, nas duas direções; `qa-lancamento.js` apontado para o DEV verde.
- **Publicação:** teste do workflow em execução manual no DEV confere que `git status` fica limpo após o build, que `_site/u/<handle>/index.html` existe para o perfil de teste e some no build seguinte após despublicar, e que nenhum arquivo em `u/` ou `treinos/*/` entrou em commit (busca no histórico do branch).
- **Segredos:** teste do workflow confere que o log não contém o valor do `BUILD_TOKEN` (busca pelo valor mascarado) e que uma chamada à Edge Function sem cabeçalho recebe 401.

## 6. Critérios de aceitação

Os da seção 8.1 (B) da arquitetura, sem alteração. Demonstração no DEV para sua aprovação antes de qualquer conversa sobre produção.

## 7. O que continua proibido nesta etapa

Executar qualquer migration em produção; alterar `admins` ou `eh_admin()` de produção; trocar a fonte de publicação do GitHub Pages sem autorização; commitar qualquer arquivo gerado com dados de usuário; colocar chave de serviço ou senha de banco no GitHub ou no site; merge em `main`; publicar; imprimir credenciais; conectar a qualquer banco do NMI.


## 8. Estado em 16/09/2026 (noite): o que já existe no branch

| Item | Estado |
|---|---|
| Migrations B1–B8 (`supabase/migrations/20260917000100` a `000800`) | escritas; aplicadas e testadas num Postgres local isolado com shim do Supabase (papéis, `auth.jwt()`, `auth.users`, storage). **Não aplicadas em nenhum projeto Supabase** |
| Suíte `supabase/tests/etapa-b.sql` | 124 casos, todos passando: gatilho de perfil, @ (normalização, reservados, colisão, pendente), privilégios por coluna, visibilidade e projeção pública, storage de avatares, capacidades e modo duplo com revogação e rollback, Clube (solicitação, decisão, encerramento, selo), regressão do painel atual, inventário de privilégios |
| Reordenação em relação ao plano | B2 = funções do @; B3 = gatilho (o gatilho depende de `normalizar_handle`). B8 passou a ser o Clube; a revogação geral de privilégios (antigo B8) vira B9 após o inventário no DEV |
| Achado técnico | policies de storage não podem consultar `public.usuarios` diretamente (rodam como o papel da API); a visibilidade fica em `avatar_visivel()`, função `security definer` em plpgsql |
| Páginas | `/conta/` (entrar, criar, código, @ pendente, Minha Conta com perfil, foto, visibilidade, Clube, capacidades), `/u/` (perfil público), `/clube/` (identidade própria do Club: entrada, solicitar, status, área interna), painel com abas Clube e Usuários |
| Modo demonstração | só em localhost com `?demo=<estado>`: mostra cada estado sem banco. `?env=dev` selecionará o DEV quando existir |
| Prévia | `http://localhost:8766` (worktree `cariocadrift-etapa-b`, branch `etapa-b-contas`); no celular na mesma rede: `http://192.168.68.51:8766` |
| Bloqueado | tudo que exige Auth/PostgREST reais: cadastro, código por e-mail, login, upload, RLS de ponta a ponta. Depende do Supabase DEV |

### 8.1 Supabase DEV: custo para sua autorização

| Opção | Custo | Prós | Contras |
|---|---|---|---|
| A. Projeto novo na organização Dtc (Pro) | ≈ US$ 10/mês em Micro, cobrado por hora; pausado = US$ 0 de compute | mesma conta, backups, sem pausa automática | custo recorrente enquanto ativo |
| B. Organização nova no plano Free, projeto Free | US$ 0 | sem custo | pausa após 7 dias sem uso, limites menores, sem backups; precisa de uma organização separada na sua conta |
| C. Docker Desktop no Mac + `supabase start` | US$ 0 | tudo local, inclusive Auth e Storage | instalar Docker (≈ 1 GB), consumo de máquina, e-mails de código só em caixa local |

Recomendação: A para fidelidade com a produção, B se o custo pesar. Nada será criado sem sua palavra.

## 9. Estado em 17/09/2026 (madrugada): Supabase DEV criado e etapa B validada de ponta a ponta

Autorização do Thiago em 16/09 ("eu tenho o supabase pro" / "faz você aí"): opção A.

| Item | Estado |
|---|---|
| Projeto DEV | `carioca-drift-dev`, ref `fswlocaiktcthuwyvccp`, organização Dtc (Pro), Micro, sa-east-1. Senha do banco gerada pelo painel e **não guardada** por ninguém aqui (acesso ao banco só pelo SQL Editor). Chave publicável em `.env.dev.local` (gitignored) e em `assets/cd.js` (`AMBIENTES.dev`); chave secreta **não** lida nem guardada |
| Migrations | as 13 (5 de produção + B1–B8) aplicadas no DEV pelo SQL Editor, em uma única transação, em 16/09 ≈ 23:50 UTC: 13 tabelas, 19 funções, 23 policies em `public`, 8 em `storage`, buckets `fotos` (público) e `avatares` (privado), gatilho `cria_perfil_usuario` em `auth.users` |
| Auth do DEV | Site URL `http://localhost:8766`; Redirect URLs `http://localhost:8766/**` e `http://192.168.68.51:8766/**`. **Confirmação de e-mail continua ligada** (o desligamento foi barrado pelo classificador de segurança do Claude Code; nada foi alterado). SMTP padrão do Supabase: 2 e-mails/hora e só para membros da organização; em 16/09 já devolveu `429 email rate limit exceeded` |
| Contas de QA | criadas por SQL no DEV, já confirmadas, com hash bcrypt gerado localmente (senhas em arquivos 600 fora do repo, nunca no transcript): `qa-dev-admin@cariocadrift.com.br` (admin legado via `admins`, @qa_admin) e `qa-dev-piloto@cariocadrift.com.br` (metadado com @ reservado "admin" → nasceu `handle_pendente`, exercitando o caminho de colisão). `qa-admin@cariocadrift.dev` não existe (GoTrue recusou o domínio) |
| QA real | `docs/capturas/qa-etapa-b-dev.js` (Playwright, prévia local `?env=dev`): **39/39 casos** em 16/09: ambiente, @ (ocupado/reservado/normalização/sugestões), perfil privado invisível, `usuarios` sem leitura anônima, @ pendente → definição, edição de perfil, foto no bucket privado com URL assinada, privilégio por coluna (42501 em `perfil_publico` e `handle`), liga/desliga perfil público, `/u/`, Clube (solicitar em Minha Conta e no Club, cancelar, solicitar de novo, aprovar, área do membro, selo no perfil público, encerrar com motivo), capacidades (conceder/revogar fotógrafo, recusa a si mesmo), origem da permissão = legado, foto não assina para perfil privado. Capturas em `docs/capturas/dev/` (gitignored) |
| Ajustes feitos após o QA | cadastro entra direto quando o projeto devolve sessão (sem confirmação de e-mail); ponto final após o motivo em recusa/encerramento; selo "Membro" do cartão não estica |
| Não testado | cadastro completo pela tela com código por e-mail (limite do SMTP padrão); recuperação de senha; celular físico na rede (só viewport 390 no Playwright). Para testar o e-mail de verdade: SMTP próprio no DEV (decisão do Thiago) ou usar o próprio e-mail da organização dentro do limite de 2/hora |
| Dados no DEV agora | piloto: @qapiloto, perfil privado, associação **encerrada**, sem capacidades; admin: @qa_admin. Limpeza: apagar os dois usuários no painel Authentication do DEV (cascata apaga perfis, associação, histórico) |

Regras mantidas: nenhuma alteração em produção, nenhum merge, nada publicado, nenhuma credencial de produção usada.

## 10. Estado em 17/09/2026: fechamento da etapa B no DEV

Tudo abaixo aconteceu só no branch `etapa-b-contas` e no projeto DEV. Nenhum merge, nada publicado, produção intocada.

### 10.1 Resultados reais

| Frente | Resultado |
|---|---|
| Cadastro com confirmação por e-mail | Template "Confirm sign up" do DEV trocado para enviar o código de 6 dígitos (`{{ .Token }}`) e o link, em português. Cadastro pela tela chegou ao Auth e voltou **429 "email rate limit exceeded"** (SMTP padrão: 2 e-mails/hora, só para membros da organização). A tela agora mostra "Muitos cadastros agora…" nesse caso. **Falta a sua ação** (10.3). Confirmação de e-mail continua ligada; nenhum SMTP contratado |
| Perfis públicos `/u/<handle>/` | Edge Function `lista-perfis-build` publicada no DEV (segredo `BUILD_TOKEN`; 401 sem token, 401 com token errado, 401 sem JWT do gateway, 405 em POST, 200 com token). `build.py` gera `u/<handle>/index.html` só com nome de exibição e @ no título; `u/*/` no `.gitignore`. Teste `qa-perfis-build-dev.js` 11/11: liga → build gera → página responde com perfil; desliga → projeção some na hora e a página existente já mostra "não disponível"; build seguinte remove o arquivo. Workflow `.github/workflows/publicar.yml` escrito, **inativo** (10.3) |
| B9/B10 | B9 (`chamadas_build`, limite 60/h) e B10 (revogação geral + concessão explícita) aplicadas no DEV após inventário (`docs/INVENTARIO-PRIVILEGIOS-DEV.md`). Regressão antes/depois: formulários 33/33, painel e login OK, etapa B 39/39, jornada 24/24, suíte isolada 152/152 |
| QA visual (desktop 1440 e celular 390) | Cadastro, código, @ pendente, Minha Conta, perfil público (com foto e selo), Club (entrada, solicitar, pendente, recusada, membro, encerrada), painel Clube/Usuários. Corrigido: dica de disponibilidade do @ invisível (classe `.ok` global escondia), hero do Club no celular com o texto por cima da arte (agora arte inteira em cima, texto abaixo), ponto final duplicado no motivo, selo do cartão esticado, mensagem de limite no cadastro |
| Jornada completa | entrar → solicitar (com mensagem) → painel aprova → Minha Conta "Membro" → área do membro com cartão → painel encerra (motivo) → usuário vê "Encerrada" com o motivo e pode pedir de novo. 12 passos × 2 tamanhos = 24/24, capturas `docs/capturas/dev/jornada-*.png` |

### 10.2 Links locais para conferir

Demonstração da jornada completa do Club (capturas reais, desktop e celular): `http://localhost:8766/docs/capturas/dev/jornada.html`.
 (prévia do branch, porta 8766; no celular na mesma rede troque `localhost` por `192.168.68.51`)

Estados reais (DEV): `http://localhost:8766/conta/?env=dev` (entrar/criar; contas de QA em 9), `http://localhost:8766/clube/?env=dev`, `http://localhost:8766/u/?h=qapiloto&env=dev` (só aparece com o perfil público ligado), `http://localhost:8766/admin/?env=dev`.
Estados visuais sem banco: `/conta/?demo=criar|codigo|pendente|conta|membro`, `/clube/?demo=entrada|logado|solicitar|pendente|recusada|membro`, `/u/?demo=membro|indisponivel`, `/admin/?demo=clube|usuarios`.

### 10.3 O que depende de você

1. **Teste do código por e-mail** (única parte da etapa B não provada de ponta a ponta). Verificado em 16/09 23:45 UTC nos logs do Auth do DEV, sem novos envios: as três tentativas barradas (23:03 e 23:38 UTC) têm `error_code = over_email_send_rate_limit`, e a primeira delas já foi barrada sem nenhum e-mail enviado antes; ou seja, o bloqueio é a restrição do SMTP padrão a endereços de membros da organização, não a cota de 2/hora consumida. Nenhum usuário órfão ficou no DEV (o Auth desfaz o cadastro quando o envio falha). Como testar: em `http://localhost:8766/conta/?env=dev`, "Criar conta" com o seu e-mail da organização (`thiagofrds@yahoo.com.br`; ele já está em `admins` do DEV, então essa conta nasce admin lá) e uma senha nova só para o DEV. O código chega pelo SMTP padrão do Supabase; digite na tela. Se a tela responder "Muitos cadastros agora…", espere até 00:40 UTC de 17/09 (21:40 em Brasília) e tente uma única vez de novo. Alternativas: autorizar SMTP próprio no DEV (Resend/Brevo, plano gratuito) ou desligar "Confirm email" só no DEV, o que eu não fiz.
2. **Publicação por artefato** (para a produção, mais tarde, com sua autorização): trocar a fonte do GitHub Pages para "GitHub Actions", criar os segredos `BUILD_PERFIS_URL` e `BUILD_TOKEN` no ambiente `github-pages`, e publicar a Edge Function no projeto de produção quando a etapa B for para lá.
3. **Decisões do Clube** (`docs/CLUBE-CARIOCA-DRIFT.md`): cobrança, benefícios, renovação, suspensão. Nada foi implementado.
4. Logo do Club com fundo transparente (pacote visual).

### 10.4 Limpeza do DEV quando quiser
Apagar as contas de QA em Authentication › Users do DEV (a cascata apaga perfil, associação, histórico); `docs/capturas/reset-qa-dev.sql` devolve a conta piloto ao estado inicial para repetir os roteiros.
