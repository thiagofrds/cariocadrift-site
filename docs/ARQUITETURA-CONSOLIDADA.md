# Carioca Drift — Arquitetura consolidada (versão final para aprovação)

Documento único e fonte de verdade. Prevalece sobre `CARIOCA-PILOTOS-ARQUITETURA.md` e `TICKETING-E-CARIOCA-MEDIA.md`, que ficam como anexos com o detalhe das auditorias do NMI. Nada implementado, nenhuma migration executada, nenhum banco alterado, nada publicado. Data: 16/09/2026.

Incorpora o fechamento de 16/09: decisões definitivas registradas como tais, rota `/u/<handle>/`, migração administrativa formal, lista de espera por modalidade, segurança de perfis e arquivos, pagamentos e reembolsos, etapas com critérios de aceitação.

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
  estado_cadastro text check in ('handle_pendente','completo') default 'completo'
  aceite_termos_em timestamptz
  criado_em, atualizado_em
  check (handle is not null or estado_cadastro = 'handle_pendente')
  check (perfil_publico = false or handle is not null)

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
- **Concorrência na escolha.** A verificação ao digitar é orientação, não reserva. A garantia é a restrição `unique` em `usuarios.handle`. Dois cadastros simultâneos com o mesmo @: o trigger do primeiro grava; o do segundo recebe violação de unicidade, captura, e cria o perfil com `handle = null` e `estado_cadastro = 'handle_pendente'`. Nunca falha a criação da conta nem gera handle automático.
- **Conta com handle pendente.** Existe em `auth.users` e em `usuarios`, pode entrar e sair, ler o próprio perfil e chamar `definir_handle(texto)`; nada mais. `definir_handle` só aceita quando `handle is null`, normaliza, checa reservados, insere sob a mesma restrição `unique` e, em colisão, devolve "indisponível" com sugestões, sem alterar nada. Ao gravar, muda `estado_cadastro` para `completo`. Toda função de escrita do módulo (inscrever, cadastrar veículo, pedir credencial, ligar perfil público, editar perfil) começa verificando `estado_cadastro = 'completo'` e recusa com erro único; as restrições `check` da tabela impedem perfil público sem handle mesmo que alguma função esqueça a verificação. O site, ao entrar, lê o estado e força a tela de escolha antes de qualquer outra.
- **Recuperação sem conta duplicada.** O e-mail é único em `auth.users`; tentar cadastrar de novo com o mesmo e-mail não cria segunda conta (o Auth reenvia a confirmação ou recusa), e o trigger é idempotente (`on conflict (id) do nothing`), então nunca há dois `usuarios` para uma conta. O caminho de recuperação é sempre entrar e concluir, nunca recadastrar.
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
| `usuarios` | — | L (própria linha); UPDATE direto só nas colunas editáveis da seção 3.1; handle e visibilidade por função | — | — | L |
| Perfil público via `perfil_publico(handle)` | L se `perfil_publico` | L | L se público | L | L |
| `capacidades` | — | L (próprias) | — | L (próprias) | L; F (conceder/revogar, nunca a si mesmo) |
| `pedidos_credencial_fotografo` | — | F (criar), L (próprio) | — | L (próprio) | L; F (decidir) |
| `veiculos` | via função, se público | L; INSERT/UPDATE/DELETE direto na própria linha, colunas da seção 3.1 | via função, se público | via função | L |
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

### 3.1 Escrita do próprio usuário: o que é direto e o que é por função

Regra: **campos sem regra de negócio são editados direto na tabela, protegidos por RLS na linha e por privilégio de coluna; campos com regra de negócio só mudam por função.** Nada é editável por anon.

| Tabela | Mecanismo | Colunas que o usuário altera | Colunas que nunca aceitam UPDATE do usuário |
|---|---|---|---|
| `usuarios` | UPDATE direto, policy `id = auth.uid()` **e** `estado_cadastro = 'completo'`, com GRANT UPDATE só nessas colunas | `nome`, `nome_exibicao`, `preferencia`, `apresentacao`, `instagram`, `avatar_path` (policy exige caminho começando com o próprio uid), `telefone` | `id`, `handle`, `estado_cadastro`, `perfil_publico`, `aceite_termos_em`, `criado_em`; `atualizado_em` por trigger |
| `usuarios` | função | `handle` via `definir_handle` (só quando nulo); `perfil_publico` via `definir_perfil_publico(bool)` (verifica estado completo e handle, grava em `acoes_usuario`) | — |
| `veiculos` | INSERT/UPDATE/DELETE direto, policy `usuario_id = auth.uid()` e dono com `estado_cadastro = 'completo'`; `usuario_id` tem default `auth.uid()` e não aceita UPDATE | `marca`, `modelo`, `ano`, `apelido`, `descricao`, `foto_path` (policy exige caminho na própria pasta e no próprio veículo), `publico` | `id`, `usuario_id`, `criado_em`; `atualizado_em` por trigger |
| tudo o mais (`capacidades`, `inscricoes_pista`, `decisoes_inscricao`, `pedidos_credencial_fotografo`, `acoes_admin`, bilheteria, mídia) | só função | — | todas |

Sem UPDATE direto de `perfil_publico` porque a mudança é auditada e depende de estado; sem UPDATE de `handle` porque a troca tem política própria ainda não implementada.

**Como se testa (suíte de banco, um caso por célula):** para cada coluna editável, UPDATE como dono passa e como outro usuário afeta zero linhas; para cada coluna protegida, UPDATE como dono falha com erro de privilégio (não 0 linhas silencioso); UPDATE de qualquer coluna com conta `handle_pendente` afeta zero linhas; `avatar_path` fora da própria pasta é recusado pela policy; INSERT em `veiculos` com `usuario_id` de outro é recusado; DELETE de veículo alheio afeta zero linhas; anon recebe erro em qualquer escrita nas duas tabelas; teste que lê `information_schema.column_privileges` e confere que `authenticated` tem UPDATE exatamente nas colunas listadas e nada mais.

**Garantias explícitas:** ninguém aprova a própria inscrição (`decidir_inscricao` recusa `usuario_id = auth.uid()` mesmo para admin); ninguém concede capacidade a si mesmo (`conceder_capacidade` recusa alvo = chamador); revogar capacidade tem efeito imediato porque toda policy consulta `capacidades` com `revogada_em is null` na hora; portaria não lê a tabela de ingressos; fotógrafo só vê linhas com `fotografo_id = auth.uid()`.

---

## 4. Fluxos

### 4.1 Cadastro (celular primeiro)
1. Tela única: nome, e-mail, senha, preferência (dois botões), @ com verificação ao digitar, aceite. Nada mais.
2. Código de seis dígitos chega por e-mail; a pessoa digita na mesma tela.
3. Trigger em `auth.users` cria `usuarios` com nome, preferência e @ vindos do metadado do cadastro. O trigger revalida o @ e, em colisão ou valor inválido, grava `handle = null` com `estado_cadastro = 'handle_pendente'`; o site então mostra só a tela de escolha, que chama `definir_handle`, e nada mais é liberado até concluir (regras em 2.2).
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
6. Cancelamento libera a vaga e chama `promover_lista(treino)`, cujo comportamento depende da modalidade (4.4.1).

#### 4.4.1 Lista de espera por modalidade

| | `publica` | `aprovacao` |
|---|---|---|
| Entra na lista quando | não há vaga e não há requisito pendente | a organização decide mover para a lista (inscrição continua `pendente` até isso) |
| Ordem | `posicao_lista` pela hora de entrada | `posicao_lista` definida pela organização, reordenável |
| Vaga liberada por cancelamento | o sistema promove o primeiro da lista **sem requisito pendente** e **dentro da janela**; quem tem requisito pendente é pulado e mantém a posição | o sistema **não promove ninguém**. Marca a vaga como disponível e o painel mostra "1 vaga liberada" com a lista na ordem; um admin promove |
| Quem grava a decisão | sistema (`decidida_por = null`) | admin, com motivo |
| Capacidade | verificada sob lock do treino em toda transição para `aprovada`, humana ou automática | idem |

Regra que vale nas duas: **nenhuma inscrição vira `aprovada` por efeito de um cancelamento se ainda depende de avaliação administrativa ou tem requisito pendente.** Uma inscrição `pendente` nunca é promovida pelo sistema.

#### 4.4.2 Transições permitidas

| De → Para | Quem | Condições verificadas na função |
|---|---|---|
| (nova) → `pendente` | piloto | janela aberta; modalidade `aprovacao`, ou `publica` com requisito pendente |
| (nova) → `aprovada` | sistema | modalidade `publica`, sem requisito pendente, vaga sob lock |
| (nova) → `lista_espera` | sistema | modalidade `publica`, sem requisito pendente, sem vaga |
| `pendente` → `aprovada` | admin | vaga sob lock; alvo não é o próprio admin |
| `pendente` → `lista_espera` / `recusada` | admin | motivo obrigatório na recusa |
| `lista_espera` → `aprovada` | sistema (só `publica`) ou admin | vaga sob lock; sem requisito pendente; dentro da janela |
| `lista_espera` → `recusada` | admin | motivo |
| qualquer viva → `cancelada_pelo_piloto` | piloto | libera vaga; dispara `promover_lista` |
| qualquer viva → `cancelada_pela_organizacao` | admin | motivo; libera vaga; dispara `promover_lista` |
| `aprovada` → `pendente` | admin | quando um requisito deixa de valer (ex.: carro removido antes do treino); motivo |

Toda linha acima gera um registro em `decisoes_inscricao`; as feitas por admin também em `acoes_admin`. Não existe UPDATE direto na tabela por nenhum papel: só as funções mudam `status`.

### 4.5 Aprovação administrativa
Painel, aba Pista do treino: filas por status, contador aprovadas/capacidade, dados do piloto e do carro, mensagem, requisitos pendentes. Ações: aprovar, recusar com motivo, mover para lista, promover, marcar requisito como atendido. `decidir_inscricao` trava o treino, recusa aprovar acima da capacidade, recusa se o alvo é o próprio admin, grava em `decisoes_inscricao` e em `acoes_admin`.

### 4.5.1 Segurança dos perfis e dos arquivos

**Consultas públicas.** A única função com EXECUTE para `anon` e `authenticated` no módulo de contas é `perfil_publico(handle text)`. Ela é `security definer` com `search_path` vazio, lê `usuarios` e `veiculos` por dentro e devolve uma linha só quando `perfil_publico = true`; caso contrário devolve nulo, sem diferenciar "não existe", "reservado" e "privado". Toda outra função (`inscrever_na_pista`, `decidir_inscricao`, `conceder_capacidade`, `promover_lista`, etc.) tem EXECUTE revogado de PUBLIC e anon e concedido só a `authenticated`, com a verificação de capacidade dentro da função. `handle_disponivel` não é exposta ao anon diretamente: é chamada por uma Edge Function com rate limit, que devolve só o booleano e as sugestões.

**URLs antigas e caches.** Como a tabela não é legível, a única porta é a função, e a função respeita o interruptor na hora da chamada. Páginas estáticas geradas (seção 6) não carregam dado nenhum e consultam a função ao abrir.

**Veículos.** `perfil_publico` só inclui veículos com `publico = true` e só se o perfil estiver público; a policy de SELECT de `veiculos` para terceiros não existe (só dono e admin), então não há caminho que mostre um veículo público de perfil privado.

**Arquivos (avatares e fotos de veículos).** Dois buckets privados, `avatares` e `veiculos`, com caminho `{uid}/…` e `{uid}/{veiculo_id}/…`. Não há URL pública nem leitura direta. A entrega é por URL assinada de curta duração (10 minutos), pedida pelo navegador à API de storage; a API só assina se a policy de SELECT em `storage.objects` passar, e a policy é:

| Bucket | SELECT permitido quando |
|---|---|
| `avatares` | pasta = `auth.uid()`, ou `eh_admin()`, ou o dono da pasta tem `perfil_publico = true` |
| `veiculos` | pasta = `auth.uid()`, ou `eh_admin()`, ou (dono tem `perfil_publico = true` **e** o veículo do segundo segmento tem `publico = true`) |
| INSERT/UPDATE/DELETE | só pasta = `auth.uid()` |

Assim a decisão de assinar é tomada no banco, não no site, e `perfil_publico` devolve só caminhos, nunca URLs. Consequência a aceitar: uma URL assinada emitida continua válida até expirar, então desligar o perfil deixa uma janela máxima de 10 minutos para arquivos já entregues. Se essa janela for inaceitável, a alternativa é uma Edge Function que faz proxy do arquivo checando o interruptor a cada download, ao custo de mais latência e mais processamento. Proposta: aceitar os 10 minutos.

**Mídia à venda** (Carioca Media) segue outro caminho: originais em bucket sem nenhuma policy de SELECT, entregues só pela Edge Function `media-download`, que checa a licença e assina com a chave de serviço por 5 minutos.

### 4.6 Credencial de fotógrafo
"Quero fotografar" em "Minha conta": portfólio, Instagram, mensagem. Cria pedido `pendente`. Painel, aba Fotógrafos: aprovar (cria `capacidades = fotografo` e a linha em `fotografos` para dados de recebimento, que o próprio fotógrafo preenche depois) ou recusar com motivo. Revogar seta `revogada_em`; galerias existentes ficam ocultas até nova concessão.

---

## 5. Estratégia de migração administrativa

**Situação atual.** `admins(email)` com um e-mail; `eh_admin()` `security definer` compara `auth.jwt() ->> 'email'` com a tabela; todas as policies de escrita em `treinos`, de leitura em `confirmacoes` e `interessados_escolinha`, e de escrita no bucket `fotos` chamam `eh_admin()`. O painel `/admin/` entra com e-mail e senha e só depende dessas policies.

**Princípio.** O modelo atual não é alterado enquanto o substituto não estiver validado. A troca acontece dentro de `eh_admin()`, que é o único ponto que todas as policies compartilham; nenhuma policy é reescrita durante a transição.

| Passo | O que muda | Como se valida | Reversão |
|---|---|---|---|
| 1. Estrutura nova ao lado | Migration cria `usuarios`, `capacidades`, `acoes_admin`, `handles_reservados`. Nada existente é tocado | Migration aplicada em desenvolvimento; painel atual testado igual antes | Migration de reversão apaga as quatro tabelas |
| 2. Semear os admins atuais | Script com chave de serviço, executado uma vez: para cada e-mail em `admins`, localiza a conta em `auth.users`, cria `usuarios` (handle provisório reservado, ex.: `admin_1`, a ser trocado pelo próprio admin no primeiro acesso) e insere `capacidades = admin` com `concedida_por = null` e `motivo = 'migração'`. E-mail sem conta em `auth.users` é listado no relatório e não migra. `admins` continua intacta | Relatório do script: N e-mails, N migrados, lista dos não migrados | Apagar as linhas semeadas (marcadas pelo motivo) **que ainda estejam ativas**; linhas revogadas ficam, e o e-mail delas já não está em `admins` |
| 3. Função em modo duplo | `eh_admin()` com precedência: (a) se existe **qualquer** linha `capacidades(admin)` para `auth.uid()`, ativa ou revogada, ela é a única fonte: verdadeiro só se `revogada_em is null`; (b) só se não existe linha nenhuma, consulta o e-mail em `admins`. O legado é fallback exclusivo de quem ainda não foi migrado; nunca reabilita quem foi revogado. `revogar_capacidade(admin)` é a única forma de revogar e, na mesma transação, preenche `revogada_em`, remove o e-mail de `admins` e grava em `acoes_admin` o e-mail removido. `origem_admin()` devolve `capacidades`, `legado` ou `revogado`, para o painel exibir | Suíte de 5.1 e verificação do painel de 5.2, incluindo os testes de revogação | Restaurar o corpo anterior de `eh_admin()`. Como a revogação também removeu o e-mail de `admins`, o rollback **não** devolve acesso a ninguém revogado; devolve só a quem nunca foi revogado |
| 4. Compatibilidade | Pelo menos um treino inteiro operado pelo painel (criar, publicar, ler confirmações, exportar) com o modo duplo. Painel mostra "permissão via: capacidades" ou "via: legado". Meta: todo admin real aparece como `capacidades` | Nenhum admin com origem só `legado` ao fim do período; nenhum incidente de acesso | Igual ao passo 3 |
| 5. Cortar o legado | `eh_admin()` lê só `capacidades`. `admins` é renomeada para `admins_legado` (sem policy, sem função que a leia) | Suíte de 5.1 repetida; painel verificado de novo | Renomear de volta e restaurar o modo duplo |
| 6. Remover | `admins_legado` é apagada | Só após critérios de 5.3 | Não há; por isso os critérios |

#### 5.1 Testes de autenticação e autorização (rodam nos passos 3 e 5)

- Login do admin atual com e-mail e senha continua funcionando; token traz o mesmo `sub`.
- `eh_admin()` verdadeiro para o admin migrado; falso para usuário comum; falso para anon; falso para admin com `revogada_em` preenchido.
- Usuário comum não consegue INSERT, UPDATE ou DELETE em `capacidades` pela API (erro, não 204 silencioso).
- Admin não consegue conceder capacidade a si mesmo por `conceder_capacidade`; consegue a terceiro, e a ação aparece em `acoes_admin`.
- Anon continua sem ler `confirmacoes`, `interessados_escolinha`, `treinos` não publicados, `usuarios`, `capacidades`.
- Revogar `admin` de um usuário logado bloqueia a próxima operação dele no painel sem precisar de novo login.

**Revogação, compatibilidade e rollback (obrigatórios no passo 3, repetidos no 5):**
- Admin migrado e revogado: `eh_admin()` falso na mesma transação; e-mail ausente de `admins`; `acoes_admin` tem a linha com o e-mail removido.
- Defesa em profundidade: com chave de serviço, reinserir o e-mail em `admins` de um usuário com linha revogada em `capacidades`; `eh_admin()` continua falso, porque a linha em `capacidades` tem precedência.
- Compatibilidade: e-mail só em `admins`, sem linha em `capacidades` (admin não migrado): verdadeiro no modo duplo; falso após o passo 5.
- Rollback após revogação: restaurar o corpo antigo de `eh_admin()`; o revogado continua falso (e-mail já não está em `admins`); os não revogados continuam verdadeiros.
- Rollback do passo 2 não apaga linhas revogadas.
- Nova concessão a alguém revogado só por `conceder_capacidade` chamada por outro admin, criando linha nova ativa; a partir daí verdadeiro só por `capacidades`, nunca pelo legado.
- Todo o schema `public`: nenhuma função nova com EXECUTE para PUBLIC ou anon além da lista explícita (`perfil_publico`).

#### 5.2 Verificação das permissões do painel atual

Roteiro executado com o admin migrado, em desenvolvimento, nos passos 3 e 5: entrar; listar treinos incluindo rascunhos; criar treino; editar; enviar capa e foto da pista ao bucket `fotos`; publicar e despublicar; ver a página pública refletir; listar confirmações e interessados; baixar os dois CSVs; sair. Cada item é conferido também pelo lado negativo com um usuário comum: deve falhar em todos.

#### 5.3 Critérios para remover a estrutura antiga

Todos obrigatórios: (a) todo e-mail de `admins` tem linha ativa em `capacidades` ou foi explicitamente descartado por você; (b) passo 4 concluído com pelo menos um treino operado; (c) suíte de 5.1 e roteiro de 5.2 passando no passo 5; (d) nenhuma policy, função, view ou script referencia `admins`/`admins_legado` (busca no schema e no repositório); (e) backup do conteúdo de `admins_legado` guardado fora do banco; (f) sua autorização escrita.

**Nunca**: um endpoint que crie admin. Novos admins entram pelo script com chave de serviço ou por `conceder_capacidade` chamada por outro admin, nunca pelo próprio.

---

## 6. Estratégia de rotas públicas

**Situação atual.** GitHub Pages serve arquivos. Páginas de treino existem de duas formas: o build gera `treinos/<slug>/index.html` para cada treino publicado (HTTP 200, meta próprios); treinos criados depois do build caem no `404.html`, que renderiza a página pelo JavaScript, mas com status 404 permanente até o próximo build.

**Perfis em `/u/<handle>/`, mesma estratégia, com uma diferença importante: perfis públicos são opt-in e mudam com frequência.**

1. **Canônico:** `/u/<handle>/`. Uma única família de URL para piloto, espectador e fotógrafo.
2. **Primeira carga de um perfil recém-publicado:** `404.html` reconhece o padrão `/u/<handle>/`, chama `perfil_publico(handle)` e renderiza. Funciona no acesso direto e ao atualizar a página, porque o servidor devolve o mesmo `404.html` para qualquer caminho inexistente. O status é 404 até o próximo build, o que só afeta indexação e prévia de link, não o uso.
3. **Geração estática recorrente:** uma GitHub Action, a cada 15 minutos e sob demanda, roda o build, que consulta os perfis com `perfil_publico = true` e gera `u/<handle>/index.html`. A partir daí o perfil responde 200 e tem prévia própria no WhatsApp. O mesmo mecanismo passa a cobrir os treinos, resolvendo a dependência de build manual que existe hoje. A publicação é por artefato do GitHub Actions: o HTML gerado nunca entra em commit, e a lista de perfis vem de uma Edge Function com segredo de automação, sem chave de serviço no site nem no repositório (detalhe em `ETAPA-B-PLANO.md`, seções 4.1 e 4.2).
4. **O que o HTML gerado contém, e só isso:** `<title>` e `og:title` com `nome_exibicao` e `@handle`; `og:description` com um texto fixo da plataforma ("Perfil no Carioca Drift"), sem apresentação, sem preferência; `og:image` sempre a imagem da marca, nunca o avatar; e o esqueleto da página. Nome de exibição e handle são os dois únicos dados pessoais que existem no arquivo, e existem porque a pessoa os tornou públicos ao ligar o interruptor. Todo o resto (foto, apresentação, Instagram, veículos, contagem) é lido de `perfil_publico(handle)` ao abrir a página, e nunca é escrito em arquivo.
5. **Despublicar, camada por camada:**

| Camada | O que acontece | Quando |
|---|---|---|
| Dados (foto, apresentação, Instagram, veículos) | `perfil_publico` passa a devolver nulo; a página, gerada ou não, mostra "perfil não disponível" | imediato, na transação do interruptor |
| Arquivos (avatar, fotos de veículo) | policies de storage deixam de assinar; URLs já assinadas expiram em até 10 minutos | imediato para novas; até 10 min para emitidas |
| HTML gerado (`title`, `og:title` com nome e handle) | continua no ar até o próximo build, que remove o arquivo; depois a URL cai no `404.html` com "não disponível" | até 15 minutos |
| Prévias de link já geradas por WhatsApp, Telegram, Instagram, X | ficam no cache desses serviços pelo prazo deles; não há como forçar limpeza | fora do nosso controle |
| Caches de buscadores e arquivos da web | páginas de perfil saem com `<meta name="robots" content="noindex, noarchive">` por padrão, o que reduz muito indexação e cópia, mas não impede um rastreador que ignore a instrução | fora do nosso controle |

Portanto: o prazo de até 15 minutos é o **compromisso de publicação** (quando um perfil passa a responder 200 com prévia). A **garantia de privacidade** é outra: os dados sensíveis nunca ficam em arquivo e somem na hora; nome de exibição e handle podem permanecer em HTML por até 15 minutos e em caches de terceiros por prazo que não controlamos. Isso é dito ao usuário no texto do interruptor, sem prometer remoção imediata do que terceiros já armazenaram.
6. **Handles reservados** nunca geram página. Handles inexistentes caem no `404.html` com "perfil não encontrado", com a mesma mensagem de "não disponível" para não revelar se existe.
7. **Compatibilidade com os eventos:** idêntica. Um único `404.html` decide por prefixo (`/treinos/` ou `/u/`) qual módulo renderizar; um único `build.py` gera as duas famílias.

**Limite honesto:** até 15 minutos entre publicar o perfil e ter 200 com prévia própria, e o mesmo prazo para o nome sumir do HTML ao despublicar. A alternativa seria sair do GitHub Pages para uma hospedagem com função de borda, o que é mudança de arquitetura e não está proposta agora.

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

### 7.1 Pagamentos e reembolsos

Cada item abaixo diz o que é resolvido no nosso banco e o que depende de confirmação do gateway (marcado **[verificar no gateway]**).

**Idempotência da solicitação de estorno.** `reembolsos` tem `chave_idempotencia` única (derivada de `pedido_id` + itens + valor) e estados `SOLICITADO → ENVIADO_AO_PROVEDOR → CONFIRMADO | FALHOU | MANUAL_PENDENTE`. Pedir o mesmo estorno duas vezes devolve o registro existente sem nova chamada ao provedor. A Edge Function que fala com o gateway só sai de `SOLICITADO` após gravar `ENVIADO_AO_PROVEDOR` com a referência devolvida; se cair no meio, a reconciliação consulta o provedor pela referência antes de tentar de novo. Se o gateway aceita chave de idempotência na chamada, ela é a nossa **[verificar no gateway]**; se não, a consulta prévia por referência é a proteção.

**Webhook duplicado.** `eventos_pagamento` com `unique (provedor, id_evento_provedor)`; segunda entrega é registrada como duplicada e ignorada. Além disso cada transição é idempotente por estado: confirmar um pagamento já `CONFIRMADO` não emite ingresso de novo (emissão única por `(item_pedido_id, indice)`), e falhar um já falho não muda nada. Webhook sem assinatura válida é recusado antes de qualquer gravação **[verificar no gateway: método de assinatura]**.

**Pagamento contestado (chargeback).** Novo estado `CONTESTADO` em `pagamentos`, entrado por webhook ou reconciliação. Efeito imediato: ingressos do pedido vão para `SUSPENSO` (portaria recusa com a mensagem "procure a organização"), licenças de mídia vão para `SUSPENSA` (download bloqueado). Nada é apagado. Resolução: `REVERTIDO` (dinheiro voltou ao cliente) leva ingressos a `REVOGADO` e licenças a `REVOGADA`; `MANTIDO` (ganhamos a disputa) restaura os estados anteriores. Admin é avisado no painel em todas as etapas. O gateway precisa comunicar contestação por webhook ou API **[verificar no gateway]**; se não comunicar, o estado só entra manualmente pelo painel, com motivo.

**Reconciliação com o provedor.** Cron em Edge Function: a cada 10 minutos consulta no provedor todo pagamento `PENDENTE` com mais de 5 minutos e todo reembolso `ENVIADO_AO_PROVEDOR`; uma vez por dia varre os últimos 7 dias completos. Divergência entre o que o provedor diz e o que temos gera linha em `divergencias_reconciliacao` (pedido, nosso estado, estado do provedor, detectada_em) e o cron aplica só as transições seguras (pendente → confirmado, enviado → confirmado, pendente → falho); tudo que reduz direito do cliente (revogar) só é aplicado se veio do provedor com prova, senão fica para admin. Exige API de consulta por referência **[verificar no gateway]**.

**Revogação de ingressos.** Reembolso total confirmado revoga todo ingresso não usado do pedido; reembolso parcial por item revoga só os daquele item. Ingresso com check-in feito não é revogado automaticamente: o pedido de reembolso de um pedido com uso exige admin com motivo e o check-in fica preservado no histórico. Revogação libera estoque do lote apenas se o treino ainda não começou.

**Compras de mídia já baixadas.** `licencas` registra `primeiro_download_em` e `downloads`. Reembolso de item nunca baixado: automático dentro da política. Reembolso de item já baixado: só admin, com motivo; a licença é revogada, a URL assinada expira sozinha em minutos e o arquivo não pode ser baixado de novo. O que a política permite em cada caso é decisão sua (seção 10, item 3), não do sistema.

**Ajustes nos valores devidos aos fotógrafos.** `lancamentos_repasse` é append-only com tipos `VENDA`, `ESTORNO`, `CONTESTACAO`, `AJUSTE_MANUAL`, cada um com sinal e referência ao pedido. Reembolso ou contestação gera lançamento negativo do mesmo valor líquido da venda. Um ciclo de repasse já fechado (`repasses.status = PAGO`) nunca é alterado: o lançamento negativo cai no ciclo aberto, e se o saldo do ciclo ficar negativo ele é transportado como saldo devedor para o próximo. O extrato do fotógrafo mostra cada linha com o motivo. Se a plataforma um dia usar split do gateway, esse desenho continua valendo como contabilidade paralela; sem split, ele é a única fonte.

**O que não fazemos por não estar verificado:** estorno parcial automático (depende de suporte por meio de pagamento), reembolso de PIX sem chave de destino conhecida, repasse automático via split, e qualquer prazo de estorno prometido ao cliente.

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

O que sai sozinho: B entrega cadastro e perfis; B+C entrega inscrições sem dinheiro; B+D entrega bilheteria com pista por convite; C e D não dependem entre si e não são desenvolvidas juntas com B.

### 8.1 Critérios de aceitação por etapa

Uma etapa só é considerada pronta para produção quando todos os itens passam em desenvolvimento e você aprovou a demonstração.

**A. Site principal**
- Home, agenda, página do Open Drift Session, escolinha e sobre no ar em `cariocadrift.com.br` com HTTPS forçado.
- Página do treino responde 200 com prévia própria no WhatsApp.
- Formulários de interesse gravam e o painel exporta.
- Roteiro `docs/capturas/qa-lancamento.js` verde.

**B. Contas e perfis**
- Cadastro em uma tela; código por e-mail; perfil criado por trigger; @ verificado antes de criar a conta; reservados bloqueados; sugestões sem vazamento.
- Concorrência do @: dois cadastros simultâneos com o mesmo @ resultam em exatamente um `usuarios.handle` gravado e um perfil `handle_pendente`; nunca dois handles iguais, nunca conta sem perfil, nunca handle gerado automaticamente.
- Conta `handle_pendente`: entra e sai; lê o próprio perfil; `definir_handle` funciona uma vez e vira `completo`; inscrever, cadastrar veículo, pedir credencial, ligar perfil público e editar perfil falham com o erro único; `update usuarios set perfil_publico = true` direto no banco falha pela restrição `check`.
- Recuperação: novo cadastro com o mesmo e-mail não cria segunda conta nem segundo perfil; trigger idempotente testado com inserção repetida.
- Perfil nasce privado; interruptor liga e desliga; `perfil_publico` devolve nulo quando desligado e a projeção exata quando ligado.
- `/u/<handle>/` abre por acesso direto para perfil recém-publicado (via `404.html`) e responde 200 após a Action.
- HTML gerado contém só nome de exibição e handle como dados pessoais (teste lê o arquivo gerado e confere que apresentação, Instagram, telefone, e-mail e caminhos de foto não aparecem); `og:image` é a marca; `robots` é `noindex, noarchive`.
- Despublicar: `perfil_publico` nulo na mesma transação; URL assinada nova recusada; página gerada mostra "não disponível" ao abrir; build seguinte remove o arquivo e a URL passa a cair no `404.html`.
- Texto do interruptor informa o prazo de 15 minutos para o HTML e a ausência de controle sobre caches de terceiros.
- Migração administrativa nos passos 1 a 3 concluída; suíte 5.1 (incluindo revogação, compatibilidade e rollback) e roteiro 5.2 verdes; painel atual sem regressão.
- Testes de privilégios: só `perfil_publico` com EXECUTE para anon.

**C. Veículos e inscrições de pista**
- Garagem com foto em bucket privado; policies de storage da seção 4.5.1 testadas nos dois sentidos.
- Treino em `convidados` não mostra botão; em `aprovacao` e `publica` mostra e o fluxo com as três opções de carro funciona.
- Concorrência: duas inscrições na última vaga, duas aprovações na última vaga, cancelamento com promoção correta em `publica` e sem promoção em `aprovacao`.
- Todas as transições da tabela 4.4.2 cobertas por teste; nenhuma outra possível.
- Painel de aprovação com contador, filas, motivo obrigatório e histórico visível.
- Pedido de credencial de fotógrafo: criar, aprovar, recusar, revogar, com efeito imediato.

**D. Bilheteria**
- Gateway escolhido e itens **[verificar no gateway]** respondidos por escrito, em sandbox.
- Pedido com preço congelado, expiração, estoque sob lock; cortesia e gratuito contando na capacidade.
- Webhook assinado, deduplicado, reentregue 20 vezes sem efeito; reconciliação detectando pagamento confirmado sem webhook.
- QR rotativo; portaria valida sob lock; dois scans simultâneos, um só passa; contingência com lista impressa e lançamento manual auditado.
- Reembolso idempotente; contestação suspende e resolve; ingresso usado não revoga sozinho.
- Um treino `gratuito` operado de ponta a ponta com portaria antes de qualquer venda.

**E. Carioca Media**
- Fotógrafo aprovado publica galeria ligada a um treino; prévias com marca d'água; originais inacessíveis fora de `media-download`.
- Compra gera licença; download só com licença ativa; URL assinada expira.
- Extrato do fotógrafo com lançamentos positivos e negativos; ciclo fechado imutável; saldo devedor transportado.
- Fotógrafo A não vê nada de B em nenhuma tabela ou bucket.

**G. Fechamento da migração administrativa**
- Critérios 5.3 todos atendidos e `admins_legado` removida.

---

## 9. Testes obrigatórios de segurança e integridade

Suíte de banco (mesmo modelo do NMI, contra Postgres real em desenvolvimento) e sondas contra o ambiente de desenvolvimento. Todos precisam passar antes de qualquer produção.

**Privilégios**
- Toda função em `public` tem EXECUTE revogado de PUBLIC e anon; lista de exceções explícita e testada.
- Nenhuma tabela aceita INSERT/UPDATE/DELETE de anon. Para `authenticated`, escrita direta existe **só** em `usuarios` (UPDATE das colunas da seção 3.1, própria linha) e `veiculos` (própria linha); `capacidades`, `inscricoes_pista`, `decisoes_inscricao`, `pedidos*`, `ingressos`, `checkins`, `licencas`, `repasses` recusam qualquer escrita direta. Teste lê os privilégios de coluna e confere a lista exata.

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

Só o que ainda não foi decidido. Perfil privado por padrão, @ escolhido pelo usuário, inscrição sem veículo, ausência de CPF e nascimento no cadastro, credencial de fotógrafo pelo site, rota `/u/<handle>/` e ordem das etapas **não** estão aqui: são definitivas.

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
