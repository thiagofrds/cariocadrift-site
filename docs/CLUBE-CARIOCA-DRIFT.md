# Clube Carioca Drift — desenho, estado e decisões pendentes

Complemento da `ARQUITETURA-CONSOLIDADA.md` e do `ETAPA-B-PLANO.md`. Um único clube, sem plataforma multi-clube. NMI usado só como referência de funcionamento e segurança; nenhum banco conectado, nenhum dado copiado.

## Separação de conceitos, imposta no banco

| Conceito | Onde vive | O que dá | O que NÃO dá |
|---|---|---|---|
| Conta | `auth.users` + `usuarios` | entrar, perfil, confirmações | nada de pista, nada de clube |
| Membro do clube | `associacoes.status = 'aprovada'` | identificação no perfil público, área `/clube/` | pista, ingresso, participação em evento |
| Piloto autorizado | `inscricoes_pista` (etapa C) | pista naquele treino, após decisão da organização | nada de clube |
| Ingresso | `ingressos` (etapa D) | entrada do público naquele treino | nada de pista, nada de clube |
| Capacidade | `capacidades` (admin, fotógrafo) | operar painel / vender mídia | nada de clube |

Regra verificada por teste a cada etapa: nenhuma função de pista, bilheteria, carona ou capacidade referencia `associacoes`.

## Fluxo implementado (migration B8, testada em isolamento)

1. A pessoa cria a conta normalmente; não vira membro.
2. Em Minha Conta, com cadastro completo, clica em "Solicitar associação" e pode deixar uma mensagem. Estado `pendente`. Pode cancelar enquanto pendente.
3. No painel, aba Clube › Solicitações: o admin aprova ou recusa (motivo obrigatório na recusa; o solicitante vê o motivo). Ninguém decide a própria associação.
4. O usuário acompanha o status em Minha Conta: pendente, aprovada (Membro desde), recusada, cancelada, encerrada. Recusada, cancelada e encerrada podem solicitar de novo.
5. Membro aprovado: tag "Membro do Clube" no perfil público (só se o perfil estiver público) e acesso a `/clube/`.
6. Painel: abas Solicitações, Membros (com encerrar, motivo obrigatório) e Histórico (toda decisão em `acoes_admin`; toda ação do usuário em `acoes_usuario`). CSV de membros.

Acesso: só o dono lê a própria associação; só admin (verificado no banco) lê todas; toda escrita passa por função; anônimo não lê nada.

## Decisões que dependem de você antes de qualquer implementação

Nada abaixo foi implementado nem inventado. Cada item tem as opções possíveis; escolha ou descarte.

1. **Cobrança / mensalidade**: (a) sem cobrança, clube gratuito por convite e aprovação; (b) anuidade única; (c) mensalidade recorrente. Se (b) ou (c): valor, forma de pagamento (depende da decisão do gateway da etapa D), e o que acontece na inadimplência.
2. **Benefícios**: (a) nenhum formal por enquanto, só identificação e área do clube; (b) desconto em ingressos (depende da etapa D); (c) prioridade em caronas ou vagas de pista, o que exigiria ligar clube a pista, hoje proibido por desenho. Recomendo não ligar.
3. **Renovação**: (a) associação sem prazo, encerrada só por decisão; (b) prazo anual com renovação manual pela organização; (c) renovação automática com pagamento.
4. **Suspensão**: (a) só encerramento, como hoje; (b) estado "suspensa" com motivo e prazo, reversível pela organização.
5. **Critérios de aprovação**: hoje é decisão livre do admin. Se quiser critérios (ex.: participação em treinos), eles precisam existir como dado antes.
6. **Área do clube**: hoje tem só o cartão de membro e três blocos vazios (comunicados, encontros, benefícios). Conteúdo real depende de você.
7. **Número de administradores que decidem**: qualquer admin. Se quiser aprovação por mais de um, é regra nova.

## O que existe em código, no branch `etapa-b-contas`

- `supabase/migrations/20260917000800_b8_clube.sql`: tabela `associacoes`, funções `solicitar_associacao`, `cancelar_solicitacao_associacao`, `decidir_associacao`, `encerrar_associacao`, `eh_membro`, e a projeção pública com `membro`.
- `src/pages/conta/index.html`: bloco "Clube Carioca Drift" em Minha Conta.
- `src/pages/clube/index.html`: área exclusiva com bloqueio para não membros.
- `src/pages/admin/index.html`: aba Clube.
- `supabase/tests/etapa-b.sql`, bloco 9: 30 casos do clube.
