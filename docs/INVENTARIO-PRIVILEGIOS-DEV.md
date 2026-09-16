# Inventário de privilégios dos papéis da API (B9/B10)

Fonte: `supabase/tests/inventario-privilegios.sql`, rodado no Postgres isolado (17/09/2026) e conferido no DEV `fswlocaiktcthuwyvccp` pelo SQL Editor, antes e depois da B10. Produção não foi consultada nem alterada.

## Antes da B10 (padrão do Supabase + migrations até B9)

| Papel | Tabelas com ALL (INSERT/UPDATE/DELETE/TRUNCATE/…) | Observação |
|---|---|---|
| anon | `admins`, `confirmacoes`, `interessados_escolinha`, `treinos` | só a RLS impedia escrita; `admins` sem policy de escrita, mas com privilégio |
| authenticated | as mesmas quatro | idem |
| anon/authenticated | USAGE em todas as 6 sequências | inclusive `acoes_*`, que só funções escrevem |
| PUBLIC | EXECUTE em toda função nova (padrão do Postgres) | `toca_atualizado_em` executável por qualquer papel |
| padrão para objetos futuros | ALL para anon/authenticated em tabelas, sequências e funções (`postgres` e `supabase_admin`) | toda tabela nova nascia aberta até alguém revogar |

## Depois da B10 (DEV, conferido)

| Papel | Tabelas | Colunas | Funções | Sequências |
|---|---|---|---|---|
| anon | `treinos` SELECT | INSERT em `confirmacoes(evento,nome,telefone)`, `interessados_escolinha(nome,telefone,mensagem,pacote)`, `interessados_carona(evento,nome,telefone,consentimento,origem)` | `eh_admin`, `avatar_visivel`, `handle_disponivel`, `perfil_publico` | `interessados_carona_id_seq` |
| authenticated | SELECT em `admins`, `usuarios`, `acoes_usuario`, `capacidades`, `acoes_admin`, `associacoes`; SELECT+DELETE em `confirmacoes`, `interessados_escolinha`, `interessados_carona`; SELECT/INSERT/UPDATE/DELETE em `treinos` | UPDATE em `usuarios` (7 colunas da seção 3.1); INSERT em `interessados_carona` (5 colunas) | as 4 acima + `origem_admin`, `definir_handle`, `definir_perfil_publico`, `conceder_capacidade`, `revogar_capacidade`, `eh_membro`, `solicitar_associacao`, `cancelar_solicitacao_associacao`, `decidir_associacao`, `encerrar_associacao` | `interessados_carona_id_seq` |
| service_role | inalterado | | + `perfis_publicos_para_build`, `registra_chamada_build` | |
| PUBLIC | nada | | nada | |

Padrão para objetos futuros: o papel `postgres` (que roda as migrations) não concede mais nada a anon/authenticated nem EXECUTE a PUBLIC. O padrão do papel `supabase_admin` continua (só o Supabase o usa; não é alterável por `postgres`). Achado: colunas *identity* (`confirmacoes`, `interessados_escolinha`, `treinos`) inserem sem USAGE na sequência; `bigserial` (`interessados_carona`) exige USAGE. Gatilhos não exigem EXECUTE de quem dispara.

## Compatibilidade testada (DEV, 17/09)

- `docs/capturas/qa-formularios-dev.js`: 33/33 depois da B10 (antes: 32/33, a única diferença é que anon deixou de poder informar `criado_em`).
- `docs/capturas/qa-etapa-b-dev.js`: 39/39 depois da B10. `docs/capturas/qa-jornada-dev.js`: 24/24.
- `supabase/tests/etapa-b.sql` (Postgres isolado): 152/152, incluindo o bloco 10 que lê `information_schema` e confere as listas acima.
