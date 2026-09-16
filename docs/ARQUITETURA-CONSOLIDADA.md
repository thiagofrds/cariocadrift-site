# Carioca Drift — Arquitetura consolidada

Documento único para aprovação. Substitui, no que conflitar, `TICKETING-E-CARIOCA-MEDIA.md` e `CARIOCA-PILOTOS-ARQUITETURA.md`, que ficam como anexos com o detalhe das auditorias. Nada implementado, nenhum banco alterado, nada publicado. Data: 16/09/2026.

**Prioridade inegociável:** o lançamento de 20/09 do Open Drift Session, com ingressos no local e pilotos convidados, não depende de nada deste documento e não é alterado por ele.

---

## 0. O que foi aprendido no NMI, em uma página

Duas auditorias de leitura, sem tocar em nada, cobriram os três projetos. O detalhe está nos anexos. O que vale carregar para o Carioca Drift:

**Desenhos que funcionaram em produção (NMI Lite):** perfil privado por padrão com perfil público servido por função de campos fechados; avatar em bucket privado com escrita só na própria pasta e entrega por URL assinada; veículos simples; fila de aprovação com motivo e auditoria em tabela própria; funções `security definer` com `search_path` vazio, EXECUTE revogado de PUBLIC e anon, e erro idêntico para "não existe" e "não é seu"; admin definido por script com chave de serviço, nunca pela API; login por e-mail e senha com código por e-mail; gateway Asaas com webhook autenticado e deduplicado; cortesia como pedido de valor zero; check-in por update atômico.

**Desenhos testados mas nunca em produção (nmi-platform 2):** criação automática de perfil por trigger; inscrição com estados ricos e capacidade **serializada sob lock**, não checada; pedidos com preço congelado e total conferido por constraint; webhook idempotente por id do evento; caso "dinheiro chegou depois de expirar sem estoque"; emissão de ingresso idempotente; QR rotativo de 30 s derivado no servidor; validação sob lock com log de toda leitura; reembolso como registro que revoga ingresso e preserva check-in; teste automatizado de privilégios de funções.

**Erros a não repetir:** capacidade guardada mas nunca verificada; senha fraca aceita pela API; 91 funções internas expostas; convite usado marcado como ativo; sem reconciliação de webhook; promoção da lista de espera manual; contrato app e SQL sem teste; reembolso que não estorna no provedor.

**Fora do Carioca Drift, decidido:** feed, stories, rankings, mensalidade, associação, convite obrigatório, múltiplos clubes, papéis por clube, garagem avançada, passaporte de veículo, marketplace de peças, transferência de ingresso, Wallet, cupons na primeira versão, aplicativo nativo.

---

## 1. Arquitetura consolidada

**Forma.** Site estático no GitHub Pages, como hoje. Toda regra de dados, dinheiro e permissão vive no Postgres do projeto Supabase `carioca-drift`, isolado do NMI. O que precisa de segredo ou de conversar com serviço externo roda em Edge Functions do mesmo projeto. Não há servidor próprio.

```
Visitante sem login
  lê: treinos publicados, perfis públicos, galerias públicas, escolinha
  escreve: confirmação de interesse, interesse na escolinha (como hoje)

Usuário logado (conta única)
  edita: perfil, veículos, preferência piloto/espectador
  lê: suas inscrições, seus ingressos, suas compras de mídia
  chama: inscrever_na_pista, criar_pedido_ingresso, criar_pedido_media, meu_codigo_qr

Capacidade "fotografo" (mesma conta)
  edita: galerias, itens, preços; lê: suas vendas, seus repasses

Capacidade "admin" (mesma conta)
  edita: treinos, lotes, regras de pista; decide inscrições; concede cortesias e capacidades;
  reembolsa; opera portaria; lê resumos financeiros separados

Edge Functions
  criar-cobranca, pagamentos-webhook/<provedor>, reembolsar-no-provedor,
  media-upload-url, media-download-url, reconciliar-pagamentos (cron)

Postgres
  contas:      usuarios, capacidades, acoes_admin, veiculos
  treinos:     treinos (+ regras), inscricoes_pista
  bilheteria:  lotes, pedidos, itens_pedido, pagamentos, eventos_pagamento, reembolsos, ingressos, checkins, portaria_staff
  media:       fotografos, galerias, itens_media, pedidos_media, itens_pedido_media, licencas, repasses
  atual:       confirmacoes, interessados_escolinha (intocadas)
```

**Regras de segurança transversais**
1. Nenhuma tabela de dinheiro, ingresso, inscrição ou capacidade aceita INSERT, UPDATE ou DELETE pela API. Só funções.
2. Toda função `security definer` tem `search_path` vazio, EXECUTE revogado de PUBLIC e anon, e um teste que prova isso para todas as funções do schema.
3. Capacidade, estoque e duplicidade são decididos sob `select ... for update`, nunca por checagem prévia.
4. O navegador nunca confirma nada de valor: pagamento só por webhook autenticado ou reconciliação no servidor.
5. Dado pessoal privado sai só por função com lista fechada de campos.
6. Erro de "não existe" e "não é seu" é o mesmo erro.

---

## 2. Modelo único de usuários e permissões

**Uma conta para todos.** Visitante navega sem login. Cadastro pede só e-mail, senha, nome e a preferência `piloto` ou `espectador`, com aceite dos termos. Confirmação por código de seis dígitos no e-mail. Não pede CPF, nascimento, endereço ou telefone; telefone entra depois, só quando necessário (inscrição de pista ou compra), e fica privado.

| Tabela | Colunas | Acesso |
|---|---|---|
| `usuarios` | `id` = `auth.users.id`, `handle` único, `nome`, `nome_exibicao`, `preferencia` (`piloto`/`espectador`, editável), `apresentacao` ≤ 400, `instagram`, `avatar_path`, `perfil_publico` bool, `telefone`, `email`, `aceite_termos_em`, timestamps | dono lê e edita o próprio; admin lê; anon não lê a tabela |
| `capacidades` | `usuario_id`, `capacidade` (`admin`/`fotografo`), `concedida_por`, `concedida_em`, `revogada_em` | dono lê as próprias; sem escrita pela API; admin inicial por script; fotógrafo por função de admin |
| `acoes_admin` | `admin_id`, `alvo_usuario_id`, `acao`, `motivo`, `contexto` jsonb, `criado_em` | admin lê; só funções gravam |

Funções de permissão: `eh_admin()`, `eh_fotografo()`, `eh_portaria(treino)`, todas lendo `capacidades` ou `portaria_staff`, todas usadas dentro das policies e das funções de negócio, nunca só na interface.

Perfil público: `perfil_publico(handle)` devolve handle, nome de exibição, preferência, apresentação, Instagram, avatar assinado, veículos marcados como públicos e contagem de treinos com inscrição aprovada. Nunca e-mail, telefone ou nascimento.

A tabela `admins` atual migra para `capacidades`; `eh_admin()` passa a consultar a nova tabela; o painel de hoje continua funcionando.

---

## 3. Modelo mínimo de veículos e inscrições

**Veículos, opcionais para qualquer usuário.**

| `veiculos` | `usuario_id`, `marca`, `modelo`, `ano`, `apelido`, `descricao` ≤ 500, `foto_path`, `publico` bool |
|---|---|

Dono faz tudo; admin lê; público só via `perfil_publico()` e só se `publico`. Sem placa, chassi, documento ou histórico.

**Regras de pista por treino.** `treinos` ganha `participacao_pista` (`convidados` padrão, `aprovacao`, `publica`), `capacidade_pista`, janela de inscrição e `regras_pista`. O Open Drift Session fica em `convidados`.

**Inscrições de pista, separadas de qualquer ingresso.**

| `inscricoes_pista` | `treino_id`, `usuario_id`, `veiculo_id` opcional, `status` (`pendente`/`aprovada`/`lista_espera`/`recusada`/`cancelada_pelo_piloto`/`cancelada_pela_organizacao`), `posicao_lista`, `mensagem_ao_organizador`, `motivo_decisao`, `decidida_por`, `decidida_em` |
|---|---|

Um registro vivo por piloto por treino. `inscrever_na_pista` decide sob lock: em `publica` confirma até a capacidade e manda o excedente para a lista; em `aprovacao` nasce pendente. `cancelar_inscricao` libera a vaga e promove o primeiro da lista automaticamente. `decidir_inscricao` é só de admin, respeita capacidade e audita.

Inscrição aprovada **não** gera ingresso de público. Se a portaria precisar credenciar piloto, isso vira um tipo de ingresso `pista` emitido a partir da inscrição aprovada, dentro do módulo de bilheteria, sem misturar as tabelas.

---

## 4. Integração futura com ingressos e mídia

### 4.1 Carioca Ticketing, revisado

**Conta.** Compra exige login na conta única. O titular do ingresso é `usuarios.id`. Confirmação de interesse continua anônima e nunca vira ingresso.

**Capacidade em dois níveis.** `treinos.capacidade_publico` é o teto do evento; `lotes.quantidade_total` é o teto de cada lote. `criar_pedido` trava os lotes envolvidos e a linha do treino, soma vendidos mais reservados mais cortesias mais gratuitos, e recusa acima de qualquer um dos dois tetos. Capacidade de pista é outra coluna, contada pelas inscrições, nunca pelos ingressos.

**Cortesias e gratuitos contam.** Cortesia é pedido com total zero, origem `CORTESIA`, concedido por admin com motivo e auditoria. Ingresso gratuito é pedido com lote de valor zero, origem `GRATUITO`. Os dois nascem `PAGO` sem passar pelo gateway, emitem ingresso na hora e **entram na contagem de capacidade e nos relatórios**, separados da receita.

**Confirmação só no servidor.** Só dois caminhos marcam um pedido como pago: o webhook do provedor, autenticado por assinatura ou token guardado em tabela sem policy e deduplicado por `unique (provedor, id_evento)`; e a reconciliação, uma Edge Function em cron que consulta no provedor os pedidos `PENDENTE` com pagamento iniciado e aplica o mesmo `confirmar_pagamento`. Isso cobre o webhook perdido, que o NMI deixou em aberto. O navegador só consulta o status.

**Pagamento duplicado, recusado, tardio.** Segundo webhook do mesmo evento cai no `on conflict`. Recusa mantém o pedido pendente até expirar. Dinheiro chegando após expiração sem estoque vira `REEMBOLSO_NECESSARIO` e aparece no painel.

**Reembolso efetivo.** `reembolsar` grava o registro interno e chama a Edge Function `reembolsar-no-provedor`, que executa o estorno na API do gateway e devolve a referência. Se o provedor falhar, o registro fica `PENDENTE_NO_PROVEDOR` e o admin vê a pendência; nada é marcado como reembolsado sem confirmação do provedor. Reembolso total revoga os ingressos e preserva os check-ins. **Se o gateway escolhido não expuser estorno por API para PIX, o fluxo cai para reembolso manual registrado, com referência preenchida à mão.** Isso é uma das decisões comerciais.

**Portaria com contingência.** Modo normal: scanner online, QR rotativo, validação sob lock. Contingência para queda de internet, em três camadas: hotspot dedicado como primeira linha; **lista de contingência** gerada no painel antes do treino, em PDF, com serial, nome e tipo de cada ingresso e cortesia, para conferência manual com marcação em papel; e, ao voltar a conexão, o admin lança os check-ins manuais pelo painel com `origem = MANUAL`, gravando quem lançou. Não haverá validação offline no aparelho nesta fase, mas `checkins` já nasce com `origem` e `lido_em_no_aparelho` para isso caber depois sem migration nova.

**Modalidade por evento.** `treinos.modalidade`: `interesse`, `local`, `gratuito`, `online`. O site renderiza o CTA pelo campo. `online` só é selecionável no painel com a chave global de bilheteria ligada. Trocar a modalidade do Open Drift Session exige sua autorização expressa.

### 4.2 Carioca Media, revisado

**Conta.** Fotógrafo é `capacidades = fotografo` na mesma conta. Sem capacidade, os menus de mídia não existem e, mais importante, as policies e funções recusam. A capacidade libera: painel de mídia, upload, galerias, preços e pacotes, pedidos e vendas, e os próprios recebimentos.

**Pedidos separados.** `pedidos_media` e `itens_pedido_media` não se misturam com `pedidos` de ingresso. `pagamentos` ganha `origem` (`INGRESSO`/`MEDIA`) para o webhook rotear e para os relatórios separarem receita de ingressos e comissão de mídia. Um pagamento nunca cobre os dois.

**Arquivos.** Original em bucket privado, jamais lido pelo público; prévia reduzida com marca d'água em bucket público. Upload direto do fotógrafo por URL assinada de envio; download do comprador por URL assinada de minutos, gerada só após checar `licencas`.

**Comissões, repasses e reembolsos, sem presumir o gateway.**
- `fotografos.percentual_comissao` é definido por fotógrafo pela administração; o padrão é uma decisão sua.
- Cada item pago gera uma linha em `licencas` (direito de download) e uma linha em `lancamentos_repasse`: bruto, comissão, líquido, fotógrafo, período.
- **Repasse é feito pela organização, fora do gateway, por PIX, em ciclo fixo** (proposta: mensal), a partir do relatório `repasses` que consolida os lançamentos do período. O admin marca o repasse como pago com comprovante. Isso funciona com qualquer gateway. Se o provedor escolhido oferecer split automático, ele entra depois como otimização, não como dependência.
- Reembolso de mídia: mesmo mecanismo do ingresso, via provedor; revoga a licença e gera lançamento negativo no repasse do fotógrafo daquele período. Download já feito não é revertido; a política de reembolso de mídia precisa dizer isso.
- O fotógrafo vê apenas o que é dele: itens, vendas, lançamentos e repasses filtrados por `fotografo_id = auth.uid()` nas policies.

**Acervo atual.** Nenhuma foto de Sergio Photos RJ vira produto sem acordo comercial e licença.

---

## 5. Etapas de implementação independentes

Cada etapa é um branch com migrations aplicadas primeiro num ambiente de desenvolvimento do Supabase, testes de banco, revisão sua, e só então produção. Nenhuma toca o `main` nem o Supabase de produção sem autorização.

| Etapa | Conteúdo | Independência |
|---|---|---|
| **A. Lançamento** | Site atual da Fase 01 mais a direção visual E.2 aprovada; DNS, HTTPS, Site URL do Auth | Já em andamento; não depende de nada abaixo |
| **B. Contas** | `usuarios`, `capacidades`, `acoes_admin`, trigger, login, "Minha conta", perfil público, migração de `admins`, política de senha forte, SMTP próprio | Depende só de A. Base de todo o resto |
| **C. Veículos e pista** | `veiculos`, buckets, regras de pista em `treinos`, `inscricoes_pista`, painel de aprovação | Depende de B |
| **D. Bilheteria** | tabelas, funções, lotes, cortesias, gratuitos, Edge Functions de cobrança, webhook, reconciliação e reembolso, "Meus ingressos", portaria, lista de contingência | Depende de B e da decisão do gateway. Não depende de C |
| **E. Carioca Media** | tabelas, buckets, upload, galerias, pedidos de mídia, licenças, download, repasses, painel do fotógrafo | Depende de B e da parte de pagamentos de D. Não depende de C |
| **F. Piloto real** | Um treino em `aprovacao` (C) e um treino `gratuito` com ingresso online e portaria (D), antes de qualquer venda | Depende das etapas que valida |

---

## 6. O que pode ser lançado sem depender das demais

- **A, hoje.** O site com interesse e ingressos no local.
- **B sozinha.** Cadastro, perfil e perfis públicos já entregam valor à comunidade sem pista, ingresso ou mídia.
- **B + C.** Inscrição de pilotos com aprovação e lista de espera funciona sem nenhum pagamento no sistema.
- **B + D.** Bilheteria funciona sem inscrição de pilotos, porque a pista continua por convite.
- **B + E.** Carioca Media funciona sem bilheteria de ingressos, desde que a parte de pagamentos de D exista; por isso D vem antes de E.
- **C e E nunca dependem uma da outra.** D e C nunca dependem uma da outra.

---

## 7. Decisões comerciais e operacionais que dependem de você

**Comerciais**
1. Gateway de pagamento e em nome de quem fica a conta. Verificar antes de decidir: estorno de PIX por API, taxas, prazo de liquidação, exigência de CPF do pagador.
2. Percentual padrão de comissão do Carioca Media e ciclo de repasse.
3. Política de reembolso de ingresso: prazo, integral ou parcial, chargeback.
4. Política de reembolso de mídia, incluindo o caso de download já feito.
5. Acordo com Sergio Photos RJ para o acervo atual e modelo de licença para fotógrafos futuros.

**Operacionais**
6. Quem opera a portaria e quem pode conceder cortesia, com limite.
7. Regra de aprovação de fotógrafo: pede pelo site ou a organização concede por fora.
8. Perfil público ligado por padrão para quem escolhe piloto, ou opcional.
9. Handle gerado do e-mail ou escolhido no cadastro.
10. Inscrição de pista sem veículo cadastrado é permitida.
11. SMTP próprio para o Supabase Auth e textos de termos e privacidade.
12. Compute do Supabase: manter Micro quando a bilheteria entrar.

**Pendências herdadas do lançamento**
13. Avaliação visual da E.2 e autorização do merge.
14. Site URL e redirecionamentos no Supabase Auth.
15. HTTPS forçado no GitHub Pages quando o certificado sair.

---

## Anexos

- `TICKETING-E-CARIOCA-MEDIA.md`: auditoria completa do ticketing do NMI, modelo de dados detalhado da bilheteria e fluxos passo a passo.
- `CARIOCA-PILOTOS-ARQUITETURA.md`: auditoria de perfis, veículos, inscrições, aprovação e permissões do NMI, com trechos de SQL de referência.
