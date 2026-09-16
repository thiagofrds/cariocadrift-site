# Carioca Drift — Arquitetura consolidada (v2)

Documento único e fonte de verdade para aprovação. Prevalece sobre `CARIOCA-PILOTOS-ARQUITETURA.md` e `TICKETING-E-CARIOCA-MEDIA.md`, que ficam como anexos com o detalhe das auditorias do NMI. Nada implementado, nenhuma migration executada, nenhum banco alterado, nada publicado. Data: 16/09/2026.

**Prioridade inegociável:** o lançamento do site (Home, agenda, páginas dos treinos, escolinha) para o Open Drift Session de 20/09, com ingressos no local e pilotos convidados, não depende de nada aqui e não é alterado por nada aqui.

---

## Decisões já aprovadas × ainda abertas

**Aprovadas por você (definitivas)**
- Conta única para todos; piloto/espectador é preferência editável; fotógrafo e admin são capacidades; visitante navega sem login.
- Perfil público desligado por padrão para todos; o usuário liga e desliga; desligar esconde perfil e veículos, inclusive por URL antiga e consulta pública.
- Identificador público (@) escolhido pelo usuário, único, normalizado, com lista de reservados, verificação de disponibilidade e sugestões sem vazar dados; nunca derivado do e-mail. Política de troca definida aqui, sem implementar troca.
- Inscrição de pista sem carro cadastrado, com três opções no formulário; a organização pode exigir dados do carro antes da autorização final.
- Sem CPF nem nascimento no cadastro; coleta progressiva.
- Credencial de fotógrafo solicitada pelo site e aprovada pela administração, verificada no backend.
- Rota neutra `/u/<handle>/` para todos os perfis.
- Garagem simplificada, veículos privados por padrão, visibilidade individual, subordinada à visibilidade do perfil.
- Três modalidades de pista por evento; Open Drift Session em convidados.
- Capacidade controlada no banco sob concorrência; lista de espera ordenada; promoção automática só quando não depender de avaliação; histórico de decisões.
- Separação entre usuário, preferência, veículo, inscrição, aprovação, ingresso e interesse, imposta no banco.
- Migração administrativa gradual, compatível, testada, reversível.
- Ticketing e Media na conta única, pedidos separados, sem presumir split ou reembolso do gateway.
- Fora de escopo: feed, stories, rankings, mensalidade, associação, múltiplos clubes, app nativo, garagem avançada, Wallet, transferência de ingresso.

**Abertas (dependem de você; não foram preenchidas com suposição)** — listadas na seção 10.

---

## 1. Modelo de usuários consolidado

**Uma pessoa, uma conta.** `auth.users` do Supabase é a identidade; `usuarios` é o perfil. Não existem tipos de conta.

| Conceito | Onde vive | O que é |
|---|---|---|
| Conta | `auth.users` | e-mail e credencial. Único método na primeira versão: e-mail e senha forte, com código de seis dígitos por e-mail para confirmação e recuperação. Sem OAuth, sem SMS |
| Perfil | `usuarios` | nome, @, preferência, opcionais, visibilidade |
| Preferência | `usuarios.preferencia` | `piloto` ou `espectador`, editável, sem efeito de autorização |
| Capacidade | `capacidades` | `admin` (operacional) ou `fotografo` (comercial); concedida e revogada pela administração; verificada por função e policy |
| Veículo | `veiculos` | zero, um ou vários; privados por padrão |
| Inscrição de pista | `inscricoes_pista` | pedido de participação num treino específico |
| Interesse | `confirmacoes` (atual) | manifestação anônima; não muda |
| Ingresso | `ingressos` (bilheteria) | direito de entrada do público |
| Licença de mídia | `licencas` (media) | direito de download de um item comprado |

**Cadastro básico (e só isso):** nome, e-mail, senha, preferência, @, aceite dos termos. Foto, Instagram, apresentação, telefone e veículos são opcionais e vêm depois.

**Coleta progressiva de dados.** Cada operação declara o que precisa, e o sistema pede na hora, uma vez, e guarda com finalidade registrada:

| Operação | Dado adicional pedido | Onde fica |
|---|---|---|
| Inscrição de pista | telefone (contato no dia); carro, se a organização exigir antes da autorização final | `usuarios.telefone`; `inscricoes_pista.veiculo_id` |
| Compra de ingresso ou mídia | o que o gateway exigir do pagador (possivelmente CPF) | `dados_pagador` (tabela separada, só funções leem) |
| Fotógrafo aprovado | dados de recebimento (chave PIX, e o que a lei exigir) | `fotografos` (só o dono e admin) |
| Requisito legal específico de um treino (ex.: termo de responsabilidade, maioridade) | nascimento ou documento, só naquele treino | `requisitos_atendidos` por inscrição |

Nenhum desses campos é criado "por precaução": cada tabela nasce na etapa em que a operação existe.

---

## 2. Modelo de dados revisado

Todas as tabelas em migrations novas do projeto `carioca-drift`. `treinos`, `confirmacoes`, `interessados_escolinha` continuam. `admins` migra conforme a seção 5.

### 2.1 Contas

```
usuarios
  id uuid pk = auth.users.id
  handle text unique            -- normalizado (ver 2.2)
  nome text (2..120)
  nome_exibicao text (2..40)
  preferencia text check in ('piloto','espectador')
  apresentacao text (<=400) null
  instagram text null  check ~ '^[a-z0-9._]{1,30}$'
  avatar_path text null
  telefone text null
  perfil_publico boolean default false
  aceite_termos_em timestamptz
  criado_em, atualizado_em

capacidades
  usuario_id uuid -> usuarios
  capacidade text check in ('admin','fotografo')
  concedida_por uuid -> usuarios
  concedida_em timestamptz
  revogada_em timestamptz null
  motivo text null
  primary key (usuario_id, capacidade)      -- revogação preserva a linha (histórico)

pedidos_credencial_fotografo
  id, usuario_id, portfolio_url, instagram, mensagem (<=500),
  status check in ('pendente','aprovado','recusado'), decidido_por, decidido_em, motivo, criado_em

acoes_admin
  id, admin_id, alvo_usuario_id null, acao text, motivo text (<=500), contexto jsonb, criado_em

handles_reservados
  handle text pk, motivo text
```

### 2.2 Identificador público (@)

- **Normalização**: minúsculas, sem acento, só `[a-z0-9_]`, 3 a 24 caracteres, sem começar ou terminar com `_`, sem `__`. Guardado já normalizado; a comparação é sempre sobre o normalizado.
- **Reservados**: lista em `handles_reservados`, semeada com termos administrativos e confusos (`admin`, `administrador`, `suporte`, `oficial`, `cariocadrift`, `carioca_drift`, `drift`, `staff`, `organizacao`, `fotografo`, `ingressos`, `media`, `treinos`, `escolinha`, `sobre`, `u`, `api`, `login`, `conta`, `null`, `undefined`, e variações), mais qualquer handle que contenha `carioca` ou `drift` seguido de `oficial`. A lista é editável por admin.
- **Disponibilidade**: função `handle_disponivel(texto)` devolve só `true`/`false` e, quando falso, até três sugestões geradas a partir do próprio texto pedido (sufixos numéricos ou `_rj`), sem consultar nem revelar nada de outros usuários. Rate limit por usuário e IP na Edge Function que a expõe.
- **Nunca derivado do e-mail.** O trigger de criação de perfil não gera handle; o cadastro só conclui quando o usuário escolhe um disponível.
- **Política de troca (definida, não implementada nesta fase)**: uma troca a cada 90 dias; o handle antigo fica em `handles_anteriores(handle, usuario_id, liberado_em)` por 180 dias, período em que ninguém pode registrá-lo e `/u/<antigo>/` redireciona para o novo **apenas se o perfil estiver público**; depois de 180 dias o handle volta ao pool. Trocas ficam em `acoes_usuario`. Implementar só com sua aprovação.

### 2.3 Garagem

```
veiculos
  id, usuario_id -> usuarios, marca (1..60), modelo (1..60), ano smallint (1950..2100),
  apelido (<=40) null, descricao (<=500) null, foto_path null,
  publico boolean default false, criado_em, atualizado_em
```

Sem placa, chassi, documento, peças, histórico, transferência. Bucket `veiculos` privado, escrita só na própria pasta `{uid}/`, leitura por URL assinada gerada apenas quando (perfil público **e** veículo público) ou para o dono ou admin.

### 2.4 Treinos e inscrições

`treinos` ganha: `participacao_pista` (`convidados` padrão | `aprovacao` | `publica`), `capacidade_pista` int null, `inscricoes_abrem_em`, `inscricoes_fecham_em`, `regras_pista` text, `exige_veiculo_para_autorizar` boolean, `requisitos` jsonb (lista declarativa, ex.: `["termo_responsabilidade"]`).

```
inscricoes_pista
  id, treino_id, usuario_id, veiculo_id null,
  situacao_veiculo check in ('sem_carro','informa_depois','veiculo_cadastrado'),
  status check in ('pendente','aprovada','lista_espera','recusada','cancelada_pelo_piloto','cancelada_pela_organizacao'),
  posicao_lista int null, mensagem_ao_organizador (<=500),
  requisitos_pendentes text[] default '{}', criado_em, atualizado_em
  unique parcial: (treino_id, usuario_id) where status in ('pendente','aprovada','lista_espera')

decisoes_inscricao
  id, inscricao_id, de_status, para_status, decidida_por (null = sistema), motivo, criado_em
```

### 2.5 Bilheteria e mídia

Mantêm o modelo dos anexos, com estas revisões já incorporadas: titular = `usuarios.id`; `treinos.capacidade_publico` (total) e `lotes.quantidade_total` (por tipo/lote), somando vendidos, reservados, cortesias e gratuitos; `pagamentos.origem` (`INGRESSO`|`MEDIA`); `reembolsos.status_provedor`; `checkins.origem` (`SCANNER`|`MANUAL`); `licencas`; `lancamentos_repasse`; `repasses`. Detalhe em `TICKETING-E-CARIOCA-MEDIA.md`, seções 4 e 6, lidas com as correções da seção 7 deste documento.

---

## 3. Matriz de permissões

Legenda: L = lê, E = escreve, F = só via função, — = nada.

| Objeto | Anônimo | Usuário (próprio) | Usuário (terceiros) | Fotógrafo | Admin |
|---|---|---|---|---|---|
| `treinos` publicados | L | L | L | L | L/E |
| `treinos` rascunho | — | — | — | — | L/E |
| `confirmacoes` | F (inserir) | F | — | — | L, F (apagar) |
| `usuarios` | — | L/E (exceto id, handle após criação, capacidades) | — | — | L |
| Perfil público via `perfil_publico(handle)` | L se `perfil_publico` | L | L se público | L | L |
| `capacidades` | — | L (próprias) | — | L (próprias) | L; F (conceder/revogar, nunca a si mesmo) |
| `pedidos_credencial_fotografo` | — | F (criar), L (próprio) | — | L (próprio) | L; F (decidir) |
| `veiculos` | via função, se público | L/E | via função, se público | via função | L |
| `inscricoes_pista` | — | F (inscrever, cancelar), L (próprias) | — | — | L; F (decidir) |
| `decisoes_inscricao` | — | L (das próprias inscrições) | — | — | L |
| `acoes_admin` | — | — | — | — | L |
| `lotes` à venda | L | L | L | L | L/E |
| `pedidos`, `pagamentos`, `ingressos` | — | F (criar pedido), L (próprios) | — | — | L; F (cortesia, reembolso) |
| `meu_codigo_qr(ingresso)` | — | F (só titular) | — | — | — |
| `validar_ingresso` | — | — | — | — | F (só `portaria_staff` do treino) |
| `checkins` | — | — | — | — | L (append-only) |
| `galerias`, `itens_media` (prévias) publicados | L | L | L | L/E (próprios) | L |
| originais de mídia | — | F (download com licença) | — | F (próprios) | — |
| `pedidos_media`, `licencas` | — | F (criar), L (próprios) | — | L (vendas próprias) | L |
| `lancamentos_repasse`, `repasses` | — | — | — | L (próprios) | L/E |

**Garantias explícitas:** ninguém aprova a própria inscrição (`decidir_inscricao` recusa `usuario_id = auth.uid()` mesmo para admin); ninguém concede capacidade a si mesmo (`conceder_capacidade` recusa alvo = chamador); revogar capacidade tem efeito imediato porque toda policy consulta `capacidades` com `revogada_em is null` na hora; portaria não lê a tabela de ingressos; fotógrafo só vê linhas com `fotografo_id = auth.uid()`.

---

## 4. Fluxos

### 4.1 Cadastro (celular primeiro)
1. Tela única: nome, e-mail, senha, preferência (dois botões), @ com verificação ao digitar, aceite. Nada mais.
2. Código de seis dígitos chega por e-mail; a pessoa digita na mesma tela.
3. Trigger em `auth.users` cria `usuarios` com nome, preferência e @ vindos do metadado do cadastro (o @ já foi validado antes de criar a conta; o trigger revalida e, em colisão, deixa o handle nulo e o site pede outro na primeira entrada).
4. Perfil nasce privado. "Minha conta" oferece foto, Instagram, apresentação, veículos e o interruptor "Perfil público".

### 4.2 Perfil e visibilidade
- Interruptor "Perfil público" liga e desliga. Desligado: `perfil_publico(handle)` devolve nulo, `/u/<handle>/` mostra "perfil não disponível", veículos não aparecem em nenhuma consulta pública, URLs antigas e indexadores recebem o mesmo nulo.
- Cada veículo tem "Mostrar no perfil". Só aparece se o perfil também estiver público.
- Projeção pública fixa: `handle, nome_exibicao, preferencia, apresentacao, instagram, avatar (URL assinada curta), veiculos_publicos[marca, modelo, ano, apelido, foto assinada], treinos_aprovados_count`. Nada mais, nunca.

### 4.3 Veículo
Adicionar, editar, remover, marcar público, trocar foto. Só o dono. Foto sobe direto para o bucket na pasta do dono por URL assinada de envio.

### 4.4 Inscrição de pista
1. Página do treino lê `participacao_pista`. `convidados`: só a frase, sem botão. `aprovacao`/`publica`: "Quero pilotar".
2. Sem login → cadastro curto → volta ao treino.
3. Formulário: (a) "Ainda não tenho carro cadastrado", (b) "Vou informar meu carro depois", (c) selecionar um veículo cadastrado; telefone se ainda não houver; mensagem; aceite das `regras_pista` e dos `requisitos` do treino.
4. `inscrever_na_pista` trava a linha do treino, valida janela e modalidade, calcula `requisitos_pendentes` (ex.: `veiculo` quando `exige_veiculo_para_autorizar` e a opção foi a ou b) e decide: `aprovacao` → `pendente`; `publica` sem requisitos pendentes e com vaga → `aprovada`; `publica` sem vaga → `lista_espera` com `posicao_lista` = próximo; `publica` com requisitos pendentes → `pendente` (fica para a organização, nunca aprova sozinha).
5. Piloto acompanha em "Minha conta", pode completar o carro depois (o que reavalia `requisitos_pendentes`) e pode cancelar.
6. Cancelamento libera a vaga e chama `promover_lista(treino)`: promove, em ordem de `posicao_lista`, apenas inscrições em `publica`, dentro da janela, **sem requisitos pendentes**; qualquer uma que dependa de avaliação permanece onde está. Tudo sob o mesmo lock do treino, gravado em `decisoes_inscricao` com `decidida_por = null` (sistema).

### 4.5 Aprovação administrativa
Painel, aba Pista do treino: filas por status, contador aprovadas/capacidade, dados do piloto e do carro, mensagem, requisitos pendentes. Ações: aprovar, recusar com motivo, mover para lista, promover, marcar requisito como atendido. `decidir_inscricao` trava o treino, recusa aprovar acima da capacidade, recusa se o alvo é o próprio admin, grava em `decisoes_inscricao` e em `acoes_admin`.

### 4.6 Credencial de fotógrafo
"Quero fotografar" em "Minha conta": portfólio, Instagram, mensagem. Cria pedido `pendente`. Painel, aba Fotógrafos: aprovar (cria `capacidades = fotografo` e a linha em `fotografos` para dados de recebimento, que o próprio fotógrafo preenche depois) ou recusar com motivo. Revogar seta `revogada_em`; galerias existentes ficam ocultas até nova concessão.

---

## 5. Estratégia de migração administrativa

Hoje: `admins(email)` e `eh_admin()` lendo por e-mail do JWT; painel `/admin/` e policies dependem de `eh_admin()`.

| Passo | O que muda | Reversível? |
|---|---|---|
| 1 | Criar `usuarios`, `capacidades`, `acoes_admin`. Script único, executado com chave de serviço, cria `usuarios` para cada e-mail em `admins` que já tenha conta em `auth.users` e insere `capacidades = admin`. `admins` **não** é apagada | Sim: apagar as tabelas novas |
| 2 | `eh_admin()` passa a devolver verdadeiro se **qualquer** das duas fontes confirmar: `capacidades` ativa **ou** e-mail em `admins`. Nenhuma policy muda de texto | Sim: voltar a função à versão anterior |
| 3 | Sondas de permissão rodam contra o ambiente de desenvolvimento: admin atual continua entrando no painel; anônimo continua sem ler nada privado; usuário comum não vira admin; ninguém consegue inserir em `capacidades` pela API (teste tenta e falha) | — |
| 4 | Período de compatibilidade de pelo menos um treino operado com o painel. Painel exibe de onde veio a permissão | — |
| 5 | Depois de validado: `eh_admin()` lê só `capacidades`; `admins` é renomeada para `admins_legado` e mantida uma versão; só então removida | Sim, enquanto `admins_legado` existir |

**Nunca**: um endpoint que crie admin. Novos admins entram pelo mesmo script com chave de serviço ou por `conceder_capacidade` chamada por outro admin, nunca pelo próprio.

---

## 6. Estratégia de rotas públicas

**Situação atual.** GitHub Pages serve arquivos. Páginas de treino existem de duas formas: o build gera `treinos/<slug>/index.html` para cada treino publicado (HTTP 200, meta próprios); treinos criados depois do build caem no `404.html`, que renderiza a página pelo JavaScript, mas com status 404 permanente até o próximo build.

**Perfis em `/u/<handle>/`, mesma estratégia, com uma diferença importante: perfis públicos são opt-in e mudam com frequência.**

1. **Canônico:** `/u/<handle>/`. Uma única família de URL para piloto, espectador e fotógrafo.
2. **Primeira carga de um perfil recém-publicado:** `404.html` reconhece o padrão `/u/<handle>/`, chama `perfil_publico(handle)` e renderiza. Funciona no acesso direto e ao atualizar a página, porque o servidor devolve o mesmo `404.html` para qualquer caminho inexistente. O status é 404 até o próximo build, o que só afeta indexação e prévia de link, não o uso.
3. **Geração estática recorrente:** uma GitHub Action, a cada 15 minutos e sob demanda, roda o build, que consulta os perfis com `perfil_publico = true` e gera `u/<handle>/index.html` com título e descrição próprios (só os campos da projeção pública). A partir daí o perfil responde 200 e tem prévia própria no WhatsApp. O mesmo mecanismo passa a cobrir os treinos, resolvendo a dependência de build manual que existe hoje.
4. **Despublicar:** o build seguinte remove `u/<handle>/index.html`; enquanto ele não roda, a página estática ainda serve o HTML antigo, por isso **a página gerada nunca embute dados: ela sempre consulta `perfil_publico(handle)` ao carregar** e mostra "perfil não disponível" se a função devolver nulo. O HTML estático carrega só título, descrição e o esqueleto. Assim URLs antigas e caches não expõem nada depois de desligar a visibilidade.
5. **Handles reservados** nunca geram página. Handles inexistentes caem no `404.html` com "perfil não encontrado", com a mesma mensagem de "não disponível" para não revelar se existe.
6. **Compatibilidade com os eventos:** idêntica. Um único `404.html` decide por prefixo (`/treinos/` ou `/u/`) qual módulo renderizar; um único `build.py` gera as duas famílias.

**Limite honesto:** o prazo de até 15 minutos entre publicar o perfil e ter 200 com prévia própria. Se isso for inaceitável, a alternativa é sair do GitHub Pages para uma hospedagem com função de borda, o que é mudança de arquitetura e não está proposta agora.

---

## 7. Integração planejada com Ticketing e Carioca Media

Tudo do `TICKETING-E-CARIOCA-MEDIA.md` continua válido com estas correções obrigatórias:

- **Conta:** comprador e fotógrafo são `usuarios`. Não existe cadastro de comprador.
- **Capacidade em dois níveis** (evento e lote), contando cortesias e gratuitos, sob lock; capacidade de pista é outra coisa e conta inscrições.
- **Cortesias e gratuitos** são pedidos de total zero, com origem própria, emitidos sem gateway, contados na capacidade e separados da receita.
- **Confirmação** só por webhook autenticado e deduplicado, ou por reconciliação em cron consultando o provedor. Nunca pelo navegador.
- **Reembolso** só é marcado como feito após confirmação do provedor via API; sem API de estorno para a modalidade, fica `MANUAL_PENDENTE` com referência preenchida por admin.
- **Portaria:** scanner online com QR rotativo; contingência com hotspot, lista impressa gerada pelo painel e lançamento manual auditado ao voltar a conexão; `checkins.origem` registra o caminho.
- **Media:** credencial pelo site com aprovação; galerias vinculadas a `treinos`; originais privados; prévias com marca d'água; venda; downloads por URL assinada após checar `licencas`; comissão por fotógrafo; repasse feito pela organização por PIX em ciclo fixo com relatório e comprovante; reembolso revoga licença e gera lançamento negativo.
- **Gateway:** antes de escolher, verificar por escrito: PIX e cartão, estorno por API para cada meio, webhook com assinatura, sandbox, exigência de CPF do pagador, existência de split. Nada disso é presumido.

---

## 8. Plano de execução por etapas

Cada etapa em branch próprio, migrations aplicadas primeiro em ambiente de desenvolvimento do Supabase (branch de banco ou projeto `carioca-drift-dev`), testes, sua revisão, e só então produção com sua autorização.

| Etapa | Entrega | Depende de |
|---|---|---|
| A | Lançamento do site (em andamento, fora deste documento) | — |
| B | Contas: `usuarios`, `capacidades`, `acoes_admin`, `handles_reservados`, trigger, login, cadastro curto, "Minha conta", visibilidade, `perfil_publico()`, rota `/u/`, Action de build recorrente, migração administrativa passos 1–3 | A |
| C | Garagem e pista: `veiculos`, bucket, regras de pista em `treinos`, `inscricoes_pista`, `decisoes_inscricao`, painel de aprovação, credencial de fotógrafo (pedido e aprovação, sem painel de mídia ainda) | B |
| D | Bilheteria: conforme anexo com as correções da seção 7 | B, decisão do gateway |
| E | Carioca Media: conforme anexo com as correções da seção 7 | B, C (credencial), pagamentos de D |
| F | Piloto real: um treino em `aprovacao` e um `gratuito` com portaria, antes de vender | C, D |
| G | Migração administrativa passos 4–5 | um treino operado após B |

O que sai sozinho: B entrega cadastro e perfis; B+C entrega inscrições sem dinheiro; B+D entrega bilheteria com pista por convite; C e D não dependem entre si.

---

## 9. Testes obrigatórios de segurança e integridade

Suíte de banco (mesmo modelo do NMI, contra Postgres real em desenvolvimento) e sondas contra o ambiente de desenvolvimento. Todos precisam passar antes de qualquer produção.

**Privilégios**
- Toda função em `public` tem EXECUTE revogado de PUBLIC e anon; lista de exceções explícita e testada.
- Nenhuma tabela de `usuarios`, `capacidades`, `veiculos`, `inscricoes_pista`, `pedidos*`, `ingressos`, `checkins`, `licencas`, `repasses` aceita INSERT/UPDATE/DELETE de anon ou authenticated.

**Privacidade**
- Anônimo e usuário comum não leem `usuarios` de terceiros; `perfil_publico` devolve nulo para perfil privado e exatamente a projeção para perfil público.
- Desligar `perfil_publico` esconde imediatamente veículos marcados como públicos.
- URL assinada de foto não é gerada para veículo privado ou perfil privado.

**Autorização**
- Usuário não edita nem apaga veículo de outro.
- `decidir_inscricao` recusa quando o alvo é o chamador, inclusive admin.
- `conceder_capacidade` recusa alvo = chamador; inserção direta em `capacidades` falha.
- Após `revogada_em`, fotógrafo perde acesso ao painel, às vendas e aos originais na mesma transação.
- Fotógrafo A não lê vendas, lançamentos ou originais de B.
- Portaria não lê `ingressos`; `validar_ingresso` falha para quem não está em `portaria_staff` do treino.

**Concorrência e integridade**
- Duas inscrições simultâneas na última vaga: uma aprovada, uma na lista.
- Duas aprovações administrativas simultâneas na última vaga: uma passa, uma é recusada.
- Cancelamento promove o primeiro da lista que não tem requisito pendente, e nunca o que depende de avaliação.
- Um registro vivo por piloto por treino.
- Bilheteria: corrida pela última unidade, 20 reentregas do mesmo webhook, pagamento após expiração sem estoque, reembolso acima do pago recusado, dois scans simultâneos do mesmo QR.
- Handle: normalização, reservados, colisão, sugestões sem vazamento.

**Contrato**
- O JavaScript do site chama apenas funções existentes com as assinaturas testadas (teste que lê o código do site e confere contra o schema).

---

## 10. Dependências e decisões ainda pendentes

**Comerciais (sua decisão)**
1. Gateway de pagamento, titular da conta, e a verificação por escrito de estorno por API, split, sandbox e CPF.
2. Comissão padrão e ciclo de repasse do Carioca Media.
3. Política de reembolso de ingresso e de mídia.
4. Acordo com Sergio Photos RJ e modelo de licença para fotógrafos.

**Operacionais (sua decisão)**
5. Quem opera a portaria; quem concede cortesia e com que limite.
6. Requisitos de veículo antes da autorização final de pista: quais treinos exigem e o que exigem.
7. Textos de termos, privacidade e regras de pista.
8. SMTP próprio para o Supabase Auth e política de senha forte ligada no painel.
9. Aceite do prazo de até 15 minutos para o 200 dos perfis novos, ou mudança de hospedagem.
10. Ambiente de desenvolvimento: branch de banco do Supabase ou segundo projeto (custo).

**Pendências do lançamento (fora deste documento)**
11. Avaliação visual da E.2 e autorização do merge.
12. Site URL e redirecionamentos no Supabase Auth; HTTPS forçado no GitHub Pages.

---

## Anexos
- `TICKETING-E-CARIOCA-MEDIA.md`: auditoria do ticketing do NMI, modelo detalhado da bilheteria e da mídia.
- `CARIOCA-PILOTOS-ARQUITETURA.md`: auditoria de perfis, veículos, inscrições, aprovação e permissões do NMI.
