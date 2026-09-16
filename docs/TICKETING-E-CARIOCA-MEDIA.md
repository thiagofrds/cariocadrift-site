# Carioca Drift — Ticketing + Carioca Media

Documento técnico para aprovação. Nada aqui foi implementado. Nenhum banco foi alterado. Data: 16/09/2026.

---

## 1. Inventário do ticketing existente no NMI

A auditoria foi feita somente por leitura nos três projetos do NMI. Existem **três sistemas de ingresso distintos**, e a diferença entre eles define o que dá pra reaproveitar.

| Projeto | O que é | Ingresso |
|---|---|---|
| `nmi-platform 2` (Next.js) | Plataforma completa, onde vivem os checkpoints 3B.3 e 3B.4 | `ticket_types`, `tickets`, `check_ins`, `ticket_lots`, `orders`, `order_items`, `payments`, `payment_events`, `refunds`, `coupons`, mais wallet e transferência (3B.5) |
| `nmi-drift-club-lite` (Next.js, em produção) | Site do clube com Asaas e RSVP | Sistema simples: `event_tickets` (um código por inscrição) e `admin_checkin_ticket` |
| `nmi-drift-club-app` (Expo) | App do clube | Cliente do sistema do lite, via RPC |

### 1.1 O que os checkpoints 3B.3 e 3B.4 entregaram (nmi-platform 2)

**3B.3, fechado.** Tipos de ingresso, ingressos e check-ins. QR **rotativo** de 30 segundos derivado no servidor, com o segredo nunca chegando ao navegador. `validate_ticket()` decide sob `select ... for update`, grava todo scan em `check_ins`, inclusive falhas, e devolve só nome, tipo e carro. Portaria não tem SELECT na tabela de ingressos. 42 testes de banco, mais 91 de validação contra o projeto DEV, incluindo dois e cinco scans simultâneos do mesmo QR.

**3B.4, fechado.** Lotes, pedidos, itens com preço congelado, pagamentos, eventos de webhook, reembolsos e cupons. Preço, desconto e total são calculados **no Postgres**, o cliente só manda lote e quantidade. Estoque por lock de linha e `count(*)`, sem contador. Pedido pendente expira em 15 minutos. Webhook idempotente por `unique (provider, provider_event_id)`. Caso especial resolvido: dinheiro chegando para pedido já expirado sem estoque vira `REFUND_REQUIRED` sem emitir ingresso. 51 testes de banco e 117 de validação, incluindo corrida real pela última unidade e 20 reentregas do mesmo webhook.

**O que não existe nem em 3B.4.** Nenhum gateway real: só a interface `PaymentProvider` e um provedor `manual` (PIX por fora, confirmado à mão). Cortesia existe só como valor de enum, sem fluxo. Reembolso é registro interno, não estorna no gateway. Check-in offline não implementado. Wallet Apple e Google têm schema e RPC, sem credenciais.

### 1.2 O que roda de verdade hoje (lite + app)

Gateway **Asaas real**, com sandbox e produção por variável de ambiente, exigindo CPF. Webhook autenticado por token com comparação em tempo constante e deduplicado. Ingresso com código **estático** de 18 bytes. Check-in por update atômico `where used_at is null`, com auditoria. **Cortesia implementada** como inscrição paga com valor zero. Sem lotes, sem reembolso de evento, e **a capacidade existe como coluna mas não é verificada em nenhuma inscrição**. Nenhum teste de ingresso ou check-in.

### 1.3 Problemas conhecidos, relevantes para nós

- 91 funções do schema `public` eram chamáveis por qualquer role de API no NMI até a correção de 3B.4. Lição: revogar EXECUTE de tudo que for interno, sempre.
- A variável do segredo do webhook não está no `.env.example` da plataforma; sem ela o pagamento manual não funciona.
- Contrato app e SQL vive em repositórios diferentes sem teste de contrato.

---

## 2. Funcionalidades reutilizáveis e pendências

**Reaproveitar do 3B.3/3B.4, como referência de projeto, reescrevendo migration por migration para o schema do Carioca Drift:**

1. Modelo de pedido com preço congelado e restrição `total = subtotal − desconto + taxa`.
2. Estoque por lock de linha e contagem, reserva derivada de pedido pendente, expiração de 15 minutos.
3. `payment_events` com unicidade por provedor e id do evento, e o despacho `record → confirm / fail`.
4. Tratamento de `REFUND_REQUIRED`.
5. Emissão idempotente por `(order_item_id, item_index)`.
6. QR rotativo de 30 segundos com segredo por ingresso, payload `CD1R:<serial>:<código>`.
7. `validate_ticket()` com lock, log append-only de toda leitura, resposta mínima, aceitação de janela ±1.
8. Reembolso como registro, nunca exclusão; reembolso total revoga ingressos e preserva check-ins.
9. O teste de privilégios de funções e a política de revogar EXECUTE das funções internas.
10. Os 93 testes de banco como roteiro do que testar.

**Reaproveitar do lite:**

11. Adaptador Asaas: cliente, mapeamento de status, processador de webhook com deduplicação. É o único gateway que já funcionou em produção na sua operação.
12. Fluxo de cortesia como pedido de valor zero, com registro de quem concedeu.

**Não reaproveitar:** wallet, transferência, cupons e categorias de piloto na primeira etapa. Código estático de ingresso do lite. Qualquer policy que dependa de `is_admin()`, `current_member_id()`, `has_active_membership()` ou `club_id`, porque o Carioca Drift não tem membros, clubes nem mensalidade.

**Pendências herdadas que precisam de decisão:** gateway (ver seção 8), regra de cortesia, política de reembolso, quem opera a portaria.

---

## 3. Arquitetura proposta para o Carioca Drift

Princípio: **o site continua estático no GitHub Pages; toda regra de dinheiro e de ingresso vive no Postgres do projeto `carioca-drift` e em Edge Functions do Supabase**. O NMI usa Route Handlers do Next.js para webhook; aqui não há servidor Node, então o webhook vira Edge Function. O projeto Supabase é o que já existe, isolado do NMI, sem nenhuma conexão entre os dois bancos.

```
navegador (site estático)
  ├─ lê: treinos, lotes públicos, próprio pedido, próprio ingresso   (anon/authenticated, RLS)
  ├─ chama RPC: criar_pedido, iniciar_pagamento, meu_qr_atual        (SECURITY DEFINER, EXECUTE só p/ authenticated)
  └─ portaria: validar_ingresso                                      (só quem está em portaria_staff)

Supabase Edge Functions
  ├─ pagamentos-webhook/<provedor>   ← gateway → registrar_evento_pagamento → confirmar/falhar
  ├─ criar-cobranca                  → gateway (cria cobrança, guarda referência)
  └─ media-download (etapa 2)        → URL assinada de curta duração do arquivo comprado

Postgres (carioca-drift)
  ├─ bilheteria: lotes, pedidos, itens, pagamentos, eventos_pagamento, reembolsos, ingressos, checkins, portaria_staff
  ├─ media (etapa 2): fotografos, galerias, itens_media, pedidos_media, itens_pedido_media, repasses
  └─ já existe: treinos, confirmacoes, interessados_escolinha, admins
```

**Identidade do comprador.** Hoje o site não tem login de visitante; a confirmação de interesse é anônima. Ingresso pago precisa de dono. Proposta: **login por link mágico ou código por e-mail** (Supabase Auth, sem senha) no momento da compra, com nome e telefone. Sem conta, o QR não teria dono verificável. A confirmação de interesse continua sem login, exatamente como está.

**Modalidade por evento.** Cada treino ganha um campo `modalidade`: `interesse` (padrão atual), `local` (ingressos só na portaria), `gratuito`, `online`. O site renderiza o CTA conforme o campo, nunca conforme o layout. `online` só fica disponível no painel quando a bilheteria estiver ativa por uma flag global.

---

## 4. Modelo de dados e permissões

Tudo novo, em migrations próprias do Carioca Drift. Nomes em português para casar com o schema atual.

### 4.1 Bilheteria

| Tabela | Colunas principais | Regras |
|---|---|---|
| `treinos` (existente) | + `modalidade`, `capacidade_total`, `bilheteria_ativa` | admin edita; público lê publicados |
| `lotes` | treino_id, nome, preco_centavos, moeda, quantidade_total (null = ilimitado), vendas_de/ate, max_por_comprador, status (RASCUNHO/A_VENDA/PAUSADO/ENCERRADO), publico | público lê só `A_VENDA` e `publico`; admin escreve |
| `pedidos` | numero único, comprador_user_id, treino_id, status (PENDENTE/PAGO/CANCELADO/EXPIRADO/REEMBOLSADO/PARCIAL/REEMBOLSO_NECESSARIO), subtotal/desconto/taxa/total em centavos, expira_em, pago_em | check `total = subtotal − desconto + taxa`; comprador lê o próprio; **nenhuma escrita pela API** |
| `itens_pedido` | pedido_id, lote_id, quantidade, preco_unitario_centavos, nome_lote (congelado) | segue o pedido |
| `pagamentos` | pedido_id, provedor, referencia_provedor, status, valor_centavos, metodo_rotulo | tripwire anti-cartão no rótulo; segue o pedido |
| `eventos_pagamento` | provedor, id_evento_provedor, pagamento_id, tipo, payload, recebido_em, processado_em | `unique (provedor, id_evento_provedor)`; só admin lê |
| `reembolsos` | pagamento_id, valor_centavos, motivo, referencia_provedor, criado_por | admin cria via RPC; nunca apaga |
| `ingressos` | serial único `CD-XXXXXX-XXXX`, treino_id, item_pedido_id + indice, tipo, origem (COMPRA/CORTESIA/GRATUITO), status (VALIDO/USADO/CANCELADO/REVOGADO), segredo_rotativo bytea, titular_user_id, titular_nome | `unique (item_pedido_id, indice)`; titular lê o próprio; portaria **não lê a tabela**; colunas de identidade imutáveis por trigger |
| `checkins` | ingresso_id (nullable), treino_id, resultado (OK/JA_USADO/INVALIDO/REVOGADO/CANCELADO/EVENTO_ERRADO/FORA_DA_JANELA), lido_por, portao, dispositivo, criado_em | **append-only**: sem policy de insert/update/delete; só a RPC grava |
| `portaria_staff` | user_id, treino_id, criado_por | admin gerencia; define quem valida |
| `segredos_webhook` | provedor, hash_segredo | sem nenhuma policy; só SECURITY DEFINER |

### 4.2 Funções (todas SECURITY DEFINER, `search_path` fixo, EXECUTE revogado de PUBLIC e concedido só a quem deve)

- `criar_pedido(treino, itens jsonb)` → cliente manda lote e quantidade; preço vem do banco; lock nos lotes; expira em 15 min; total zero já nasce PAGO e emite.
- `iniciar_pagamento(pedido, provedor)` → cria linha em `pagamentos` e devolve os dados para a Edge Function criar a cobrança.
- `registrar_evento_pagamento(provedor, id_evento, payload)` → `on conflict do nothing`; se novo, chama `confirmar_pagamento` ou `falhar_pagamento`.
- `confirmar_pagamento(pagamento, referencia)` → re-checa estoque sob lock; sem estoque vira `REEMBOLSO_NECESSARIO`; com estoque marca PAGO e chama `emitir_ingressos(pedido)`.
- `emitir_ingressos(pedido)` → um ingresso por assento, idempotente.
- `conceder_cortesia(treino, nome, telefone, email, quantidade, motivo)` → pedido de valor zero com origem CORTESIA; só admin; registra quem concedeu.
- `meu_codigo_atual(ingresso)` → só o titular; devolve `CD1R:<serial>:<código>` da janela atual.
- `validar_ingresso(payload, treino, portao, dispositivo)` → só `portaria_staff` do treino; lock na linha; grava em `checkins` sempre; resposta mínima.
- `reembolsar(pagamento, valor, motivo, referencia)` → só admin; nunca acima do pago; reembolso total revoga ingressos e preserva check-ins.
- `expirar_pedidos()` → chamada por cron do Supabase a cada minuto.
- `resumo_bilheteria(treino)` → admin: vendidos, reservados, receita, check-ins.

### 4.3 O que NÃO muda

`confirmacoes` e `interessados_escolinha` continuam exatamente como estão. Confirmar presença nunca vira ingresso, nunca ocupa capacidade, nunca gera QR.

---

## 5. Fluxos de compra e check-in

### 5.1 Compra online

1. Visitante abre o treino com `modalidade = online`. O site lista os lotes `A_VENDA` e mostra "Comprar ingresso".
2. Escolhe quantidade. Se não está logado, entra por e-mail com código de uso único e informa nome e telefone.
3. Site chama `criar_pedido`. Banco valida lotes, janela de venda, estoque e limite por comprador; cria pedido PENDENTE com expiração.
4. Site chama a Edge Function `criar-cobranca`, que chama `iniciar_pagamento`, cria a cobrança no gateway (PIX com QR ou link de cartão) e devolve ao site. O site mostra a cobrança. **Nada foi emitido ainda.**
5. Gateway notifica a Edge Function `pagamentos-webhook`. Ela valida a assinatura ou o token, chama `registrar_evento_pagamento` e responde 200 se autenticado.
6. Banco confirma, re-checa estoque, marca PAGO e emite os ingressos. O site, que fica consultando o próprio pedido, vê PAGO e mostra "Meus ingressos".
7. Recusa: `falhar_pagamento`, pedido volta a PENDENTE até expirar. Expirado: estoque volta. Duplicado: segundo webhook cai no `on conflict`. Pagamento após expirar sem estoque: `REEMBOLSO_NECESSARIO` e a administração reembolsa pelo painel.

**O navegador nunca decide nada.** Exibir "pago" na tela não emite ingresso; só o webhook emite.

### 5.2 Ingressos no local, gratuito e interesse

- `local`: CTA "Confirmar presença", aviso "ingressos somente na portaria". Sem pedido, sem QR. Capacidade controlada na portaria, fora do sistema.
- `gratuito`: opcionalmente com ingresso gratuito online para controlar capacidade: `criar_pedido` com lote de valor zero emite na hora, com QR e check-in.
- `interesse`: o que existe hoje.

### 5.3 Cortesia

Admin, no painel, aba do treino: nome, telefone, e-mail, quantidade, motivo. O banco cria pedido de valor zero, origem CORTESIA, e emite. O convidado recebe link por e-mail para entrar e ver o QR. Fica registrado quem concedeu.

### 5.4 Check-in

1. Portaria abre `/portaria/` no celular, logada com conta que esteja em `portaria_staff` do treino.
2. Câmera lê o QR (`BarcodeDetector` nativo, com fallback `jsQR`). O payload é opaco: serial e código rotativo.
3. Site chama `validar_ingresso`. Banco resolve, trava a linha, decide, grava o resultado e devolve nome e tipo. Verde para OK, vermelho com motivo para o resto.
4. Dois porteiros lendo o mesmo QR no mesmo segundo: exatamente um OK e um JÁ USADO, garantido pelo lock.
5. Screenshot do QR vale por 30 segundos mais uma janela de tolerância; depois é INVÁLIDO.
6. Sem internet a portaria não valida. Check-in offline fica fora desta etapa, como no NMI.

---

## 6. Integração com Carioca Media

Carioca Media é um marketplace: fotógrafos publicam galerias de treinos; pilotos e público compram fotos e vídeos; a organização fica com comissão.

**Mesma infraestrutura de pagamento, contabilidade separada.** Os pedidos de mídia usam o mesmo gateway, a mesma Edge Function de webhook e o mesmo `eventos_pagamento`, mas com **tabelas de pedido próprias** (`pedidos_media`, `itens_pedido_media`) e um campo `origem` em `pagamentos` (`INGRESSO` ou `MEDIA`). Isso mantém reembolsos, permissões e relatórios separados sem duplicar o gateway.

**Modelo (etapa 2, ainda não a criar):**

| Tabela | Regra |
|---|---|
| `fotografos` | user_id, nome, marca, percentual_comissao, dados de repasse; o fotógrafo lê e edita o próprio |
| `galerias` | fotografo_id, treino_id, titulo, publicada; público lê publicadas |
| `itens_media` | galeria_id, tipo (foto/vídeo), preco_centavos, caminho_original (bucket **privado**), caminho_previa (bucket público com marca d'água), largura, altura; público lê só prévias |
| `pedidos_media` / `itens_pedido_media` | comprador, itens, valores congelados; comprador lê o próprio |
| `licencas` | pedido_item pago → direito de download; comprador lê as próprias |
| `repasses` | por fotógrafo e período: bruto, comissão, líquido, status; o fotógrafo lê só os seus |

**Arquivos.** Dois buckets: `media-originais` privado, sem leitura pública nunca, entregue por URL assinada de minutos gerada pela Edge Function `media-download` após checar `licencas`; `media-previas` público, com prévia reduzida e marca d'água do fotógrafo. Upload do original vai direto do fotógrafo para o bucket privado por URL assinada de upload, sem passar por servidor nosso.

**Permissões.** RLS por `fotografo_id = auth.uid()` em tudo do fotógrafo: ele nunca vê venda de outro. Admin vê tudo. `resumo_financeiro(periodo)` devolve receita de ingressos e comissões de mídia em linhas separadas.

**Visual.** A área "Carioca Media" entra na navegação ao lado de Treinos, com a mesma tipografia e o mesmo sistema de créditos já usado na home: galeria por treino em grade editorial, foto com legenda e assinatura do fotógrafo, preço em Saira itálico amarelo, "Comprar" no mesmo botão amarelo. Nenhuma foto do acervo atual vira produto sem acordo com o fotógrafo.

---

## 7. Plano de implementação em etapas

| Etapa | Entrega | Depende de |
|---|---|---|
| **0. Decisões** | Gateway escolhido, conta aberta, sandbox liberado; regra de cortesia; política de reembolso; quem opera portaria | Você |
| **1. Base** | Migrations de bilheteria, funções, RLS, teste de privilégios de funções, cron de expiração, `modalidade` em `treinos`, login por e-mail. Suíte de testes de banco cobrindo corrida pela última unidade, expiração, emissão idempotente, QR rotativo, validação sob concorrência, reembolso. Sem gateway ainda | 0 |
| **2. Gateway** | Edge Functions `criar-cobranca` e `pagamentos-webhook` com o adaptador do gateway em sandbox; teste de 20 reentregas do mesmo webhook; `REEMBOLSO_NECESSARIO` | 1 |
| **3. Site** | Página do treino com lotes e compra; login por e-mail; "Meus ingressos" com QR rotativo; página `/portaria/` com scanner; CTA por modalidade | 2 |
| **4. Painel** | Aba Bilheteria por treino: lotes, vendas, cortesias, reembolsos, resumo; aba Portaria: staff por treino; flag global de bilheteria | 3 |
| **5. Piloto real** | Um treino em `gratuito` com ingresso online e portaria, sem dinheiro, para validar QR e check-in no dia; depois um treino `online` com valor baixo em produção | 4 |
| **6. Carioca Media** | Tabelas, buckets, upload do fotógrafo, galerias, pedidos de mídia, licenças, download assinado, repasses, área do fotógrafo no painel | 2, e acordo comercial com fotógrafos |

Cada etapa em branch, com testes, sem merge nem publicação antes da sua aprovação. O Open Drift Session de 20/09 **não** entra nesse escopo: continua com confirmação de interesse e ingressos no local.

---

## 8. Dependências externas e riscos

**Gateway.** É a decisão comercial que trava tudo: taxas, prazo de liquidação, quem é o titular da conta que recebe, KYC, e se PIX e cartão são obrigatórios. Candidatos: **Asaas** (já usado no NMI, com adaptador pronto e webhook conhecido, exige CPF do pagador), Mercado Pago ou Stripe. Recomendação: Asaas, pela experiência acumulada.

**Compute do Supabase.** Cron, Edge Functions e webhooks rodam no projeto `carioca-drift`. Micro aguenta; não reduzir para Nano se a bilheteria entrar.

**Login por e-mail.** Precisa de SMTP próprio no Supabase Auth; o padrão tem limite baixo de envios por hora e não serve para venda.

**Riscos de lançamento**

1. Webhook não autenticado ou sem idempotência: ingressos duplicados ou falsos. Mitigação: segredo em tabela sem policy, unicidade por id de evento, teste de reentrega.
2. Funções internas expostas: mesma falha que o NMI teve. Mitigação: revogar EXECUTE de PUBLIC em toda função e testar.
3. Venda acima da capacidade: mitigação por lock e contagem, testada com corrida.
4. Portaria sem internet no RJ Race Park: risco operacional real. Mitigação: hotspot dedicado; lista impressa de cortesias como contingência; check-in offline fica para depois.
5. LGPD: ingresso guarda nome, telefone, e-mail; check-in devolve só o mínimo; originais de mídia privados; retenção definida.
6. Chargeback e reembolso manual no gateway: o registro interno não estorna sozinho; precisa de rotina no painel.
7. Dependência de pessoa: portaria e cortesias precisam de conta e treinamento de quem opera no dia.

---

## Perguntas que precisam de resposta sua antes da etapa 1

1. Qual gateway e em nome de quem fica a conta?
2. Quem pode conceder cortesia, e com que limite?
3. Reembolso: até quando antes do treino, integral ou parcial?
4. Login do comprador por e-mail está ok, ou prefere telefone/WhatsApp?
5. Carioca Media: percentual de comissão e prazo de repasse padrão?
