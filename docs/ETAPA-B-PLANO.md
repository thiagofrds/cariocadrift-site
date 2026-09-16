# Etapa B — Contas e perfis: plano de execução

Branch `etapa-b-contas`, criado a partir de `fase-01-home` em 16/09/2026. Segue `ARQUITETURA-CONSOLIDADA.md` (aprovada). Este arquivo é o roteiro operacional; não contém SQL nem código. **Nada aqui é executado antes da conclusão da etapa A e da sua autorização expressa.** Tudo roda exclusivamente no projeto `carioca-drift-dev`; produção não é tocada.

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
| B1 | `..._usuarios.sql` | `usuarios` com colunas, checks e trigger de `atualizado_em`; `handles_reservados` com semente; RLS: SELECT própria linha e admin; UPDATE própria linha com `estado_cadastro = 'completo'` e checagem de `avatar_path`; GRANT UPDATE por coluna para `authenticated`; nenhum privilégio para anon | drop das tabelas |
| B2 | `..._trigger_perfil.sql` | trigger em `auth.users` (insert) que cria `usuarios` a partir do metadado, com captura de colisão de handle → `handle_pendente`, e `on conflict (id) do nothing` | drop do trigger e da função |
| B3 | `..._handle.sql` | `normalizar_handle`, `handle_disponivel` (EXECUTE só para o role da Edge Function), `definir_handle` (authenticated) | drop das funções |
| B4 | `..._capacidades.sql` | `capacidades`, `acoes_admin`; `conceder_capacidade` e `revogar_capacidade` (recusam alvo = chamador; revogar remove e-mail de `admins` na mesma transação); RLS SELECT próprias linhas e admin; nenhuma escrita direta | drop |
| B5 | `..._eh_admin_modo_duplo.sql` | novo corpo de `eh_admin()` com precedência de `capacidades`; `origem_admin()` | restaurar o corpo anterior, guardado no próprio arquivo como comentário e em migration de reversão |
| B6 | `..._perfil_publico.sql` | `definir_perfil_publico(bool)` com auditoria em `acoes_usuario`; `perfil_publico(handle)` com projeção fixa; EXECUTE de `perfil_publico` para anon e authenticated; revogação de EXECUTE de PUBLIC em todas as funções novas | drop |
| B7 | `..._storage_avatares.sql` | bucket privado `avatares`; policies de INSERT/UPDATE/DELETE na própria pasta; SELECT conforme seção 4.5.1 | remover bucket e policies |
| B8 | `..._privilegios.sql` | revogação geral de EXECUTE de PUBLIC/anon no schema `public`, com lista de exceções explícita (`perfil_publico`) | reconceder (não desejável; existe só formalmente) |

Fora desta etapa: `veiculos` e bucket `veiculos` (etapa C), `handles_anteriores` (troca de handle, não autorizada).

## 3. Script de semente administrativa (passo 2 da migração)

Script Node em `scripts/migrar-admins.js`, executado à mão com a chave de serviço do DEV, com `--relatorio` (só lista) e `--aplicar`. Lê `admins`, procura cada e-mail em `auth.users`, cria `usuarios` com handle provisório reservado (`admin_1`, `admin_2`…) e `estado_cadastro = 'completo'` (o admin troca o handle depois pela política de troca, quando existir, ou o script aceita `--handle email=handle` na aplicação), insere `capacidades = admin` com `motivo = 'migração'`. Imprime relatório sem valores sensíveis.

## 4. Site (páginas novas e alterações)

- `conta/index.html`: entrar, criar conta (tela única), código por e-mail, escolha de handle quando pendente, "Minha conta" (perfil, foto, interruptor de visibilidade com o texto sobre prazos e caches).
- `u/index.html` + tratamento em `404.html` por prefixo `/u/`: renderiza `perfil_publico(handle)`; "perfil não disponível" para nulo; `robots noindex, noarchive`.
- `src/build.py`: gera `u/<handle>/index.html` para perfis públicos com só `nome_exibicao` e `@handle` no título, descrição fixa, `og:image` da marca; remove os que deixaram de ser públicos.
- `.github/workflows/build.yml`: build a cada 15 minutos e sob demanda, commit só quando há diferença, usando a chave publishable (a função pública basta).
- Painel `/admin/`: aba Usuários (lista, origem da permissão via `origem_admin`, conceder/revogar capacidade com motivo), e indicador "permissão via".
- Nav: entrada "Conta" (E.2 já prevê).

## 5. Testes

- Suíte de banco (Node + `pg`, em `tests/db/`), rodando contra o DEV, cobrindo: seção 5.1 completa (autenticação, autorização, revogação, compatibilidade, rollback), seção 3.1 (uma célula por coluna, mais leitura de `column_privileges`), concorrência do @ (dois inserts simultâneos em `auth.users` via API de admin), estado `handle_pendente`, idempotência do trigger, `perfil_publico` com perfil privado/público/inexistente/reservado devolvendo o mesmo nulo nos três últimos, policies de storage nos dois sentidos, privilégios de EXECUTE.
- Teste do build: gera um perfil público de teste, roda `build.py`, lê o HTML e confere ausência de apresentação, Instagram, telefone, e-mail e caminhos de foto; despublica, roda de novo, confere remoção.
- Roteiro de navegador (`docs/capturas/qa-etapa-b.js`, Playwright): cadastro em 390 px, código, handle pendente forçado, "Minha conta", ligar/desligar visibilidade, `/u/<handle>/` nos dois estados.
- Roteiro 5.2 do painel, executado com o admin migrado do DEV, lado positivo e negativo.

## 6. Critérios de aceitação

Os da seção 8.1 (B) da arquitetura, sem alteração. Demonstração no DEV para sua aprovação antes de qualquer conversa sobre produção.

## 7. O que continua proibido nesta etapa

Executar qualquer migration em produção; alterar `admins` ou `eh_admin()` de produção; merge em `main`; publicar; imprimir credenciais; conectar a qualquer banco do NMI.
