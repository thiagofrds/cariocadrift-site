# Carioca Drift — Modelo de usuários e Carioca Pilotos

> **Anexo.** Este documento é referência de auditoria. Onde divergir de `ARQUITETURA-CONSOLIDADA.md`, vale a consolidada (v2, 16/09/2026): conta única, perfil público desligado por padrão, @ escolhido pelo usuário, rota `/u/<handle>/`, inscrição sem carro, coleta progressiva de dados, credencial de fotógrafo pelo site.


Arquitetura mínima para aprovação. Nada implementado, nenhum banco alterado. Data: 16/09/2026.

Complementa `TICKETING-E-CARIOCA-MEDIA.md`. Onde os dois se cruzam, este documento prevalece no que diz respeito a contas e permissões.

---

## 1. Inventário do que existe nos projetos NMI

Auditoria somente de leitura, nos três projetos. O que importa para o Carioca Drift:

| Módulo | Onde está | Estado real |
|---|---|---|
| Perfil de usuário (`profiles`) | NMI Lite | **Produção.** Nome, e-mail, telefone, Instagram, cidade, UF, nascimento, aceites com data, `avatar_path`, `display_name`. Sem bio. Criado por ação do próprio usuário, sem trigger. Leitura só do dono ou admin; perfil público sai só por RPC com lista fechada de campos |
| Perfil com bio, handle, visibilidade e criação automática por trigger | nmi-platform 2 | Implementado e testado, **nunca foi a produção** |
| Avatar (bucket privado, escrita só na própria pasta, entrega por URL assinada) | NMI Lite | Produção, com tela de upload e recorte |
| Veículos (`vehicles`: marca, modelo, ano, versão, apelido, descrição, foto) | NMI Lite | Produção. **Foto só visível ao dono**; o perfil público mostra só marca, modelo e apelido |
| Eventos (`club_events`) com preços por público, flyer, abertura de inscrição | NMI Lite | Produção. `capacity` existe mas **não é verificada em lugar nenhum** |
| Inscrições (`event_registrations`) | NMI Lite | Produção, mas estados são só `confirmed / pending_payment / paid / cancelled`. **Não existe pendente de aprovação, recusado nem lista de espera por evento** |
| Inscrições com capacidade sob lock, lista de espera e estados ricos | nmi-platform 2 | Implementado e testado com 57 casos, sem produção. Promoção da lista de espera é manual |
| Aprovação de participantes | NMI Lite | Produção, **mas aprova a entrada no clube**, não a participação num evento. Fila de aprovação, ações de admin e auditoria em `admin_actions` |
| Aprovação da inscrição do carro por evento (`review_event_entry`) | nmi-platform 2 | Implementado e testado, sem produção |
| Permissões (`is_admin`, papéis por clube, EXECUTE revogado, erro uniforme anti-oráculo) | NMI Lite | Produção. Admin só é definido por script com chave de serviço, nunca pela API |
| Autenticação | NMI Lite | Produção. E-mail e senha, com código por e-mail como alternativa. Sem OAuth, sem SMS |
| Ingresso e check-in | NMI Lite e nmi-platform 2 | Ver `TICKETING-E-CARIOCA-MEDIA.md` |
| Testes | Lite: 32 testes de funções puras e 16 sondas de RLS contra o DEV. Plataforma 2: suíte real de banco. App: nenhum | |

**Problemas conhecidos no NMI que não podemos repetir:** senha fraca aceita pela API direta; capacidade decorativa; convite usado marcado como ativo; 91 funções expostas até a correção; reconciliação de webhook ausente.

---

## 2. O que pode ser reaproveitado com segurança

Reaproveitar significa **reescrever migration por migration no schema do Carioca Drift**, copiando o desenho e não o arquivo. Nada do NMI se conecta ao nosso banco.

**Vem do NMI Lite (produção):**
1. Perfil privado por padrão, com perfil público servido por função de lista fechada de campos. Nunca expor tabela inteira.
2. Bucket de avatar privado com escrita na própria pasta e entrega por URL assinada.
3. Tabela de veículos e o formulário com recorte de foto.
4. Fila de aprovação, ações administrativas com motivo e auditoria em tabela própria.
5. Padrão de segurança das funções: `security definer`, `search_path` vazio, EXECUTE revogado de PUBLIC e anon, erro idêntico para "não existe" e "não é seu".
6. Admin definido por script com chave de serviço, sem endpoint de promoção.
7. Login por e-mail e senha com código por e-mail como alternativa, e a política de senha forte no servidor.

**Vem da plataforma 2 (testado, não em produção):**
8. Criação automática do perfil por trigger em `auth.users`, com fallback se faltar dado.
9. Inscrição com estados `pendente / confirmada / lista de espera / recusada / cancelada` e capacidade verificada sob lock, não checada.
10. A separação de substantivos: inscrição é da pessoa, ingresso é do portão. Aqui simplificada: **inscrição de piloto** e **ingresso de público** são coisas distintas, sem "event entry" separada.
11. Os 57 casos de teste de inscrição como roteiro.

**Não vem de lugar nenhum:** membership, convite obrigatório, clubes, papéis por clube, quota de convidados, feed, stories, ranking, garagem avançada, passaporte de veículo, marketplace de peças, app nativo.

**Precisa ser escrito do zero:** aprovação de piloto **por evento** com lista de espera (não existe nesse formato em nenhum dos dois), foto de veículo pública por escolha do dono, permissão de fotógrafo.

---

## 3. Escopo mínimo

**Uma conta para todo mundo.** Visitante navega sem login. Quem cria conta escolhe uma preferência, "piloto" ou "espectador", que pode mudar depois e não muda nada na autenticação. Capacidades adicionais são concedidas pela organização: fotógrafo e administrador.

O que entra na primeira versão:

- Cadastro e login por e-mail e senha, com código por e-mail como alternativa, sem OAuth e sem SMS.
- Perfil: nome, nome de exibição, foto, Instagram, apresentação curta, preferência piloto ou espectador. Telefone e e-mail privados.
- Perfil público em `/piloto/<handle>/`, só para quem marcou o perfil como público. Espectador pode ter perfil público também; a URL é a mesma família.
- Veículos: marca, modelo, ano, apelido, foto, descrição curta. Opcionais. Cada veículo tem um interruptor "mostrar no perfil público".
- Inscrição para pilotar, apenas em treinos cuja regra permita, respeitando capacidade de pista.
- Painel: aprovar, recusar, lista de espera, promover da lista, com motivo e auditoria.
- Página "Minha conta": perfil, veículos, minhas inscrições, e, quando existirem, meus ingressos e minhas compras.

O que fica de fora: mensalidade, associação, convite obrigatório, ranking, feed, seguir, mensagens, múltiplos clubes, app.

---

## 4. Estrutura de dados proposta

Tudo em migrations novas do projeto `carioca-drift`. As tabelas atuais (`treinos`, `confirmacoes`, `interessados_escolinha`, `admins`) continuam.

### 4.1 Contas e capacidades

| Tabela | Colunas | Acesso |
|---|---|---|
| `usuarios` | `id` = `auth.users.id`, `handle` único `^[a-z0-9_]{3,24}$`, `nome`, `nome_exibicao`, `preferencia` (`piloto` / `espectador`), `apresentacao` (≤ 400), `instagram` (`^[a-z0-9._]{1,30}$`), `avatar_path`, `perfil_publico` (bool), `telefone`, `email` (cópia para o painel), `aceite_termos_em`, `criado_em`, `atualizado_em` | Dono lê e edita o próprio (exceto `id`, `criado_em`). Admin lê tudo. **Anon não lê a tabela**; perfil público sai por função |
| `capacidades` | `usuario_id`, `capacidade` (`admin` / `fotografo`), `concedida_por`, `concedida_em`, `revogada_em` | Dono lê as próprias. **Nenhuma escrita pela API**: admin inicial por script; fotógrafo por RPC de admin |
| `acoes_admin` | `admin_id`, `alvo_usuario_id`, `acao`, `motivo` (≤ 500), `contexto` jsonb, `criado_em` | Admin lê; só as funções gravam |

`admins` (tabela atual, por e-mail) migra para `capacidades` com `admin`; a função `eh_admin()` passa a consultar `capacidades`. O painel atual continua funcionando.

**Função pública** `perfil_publico(handle)` → devolve só `handle, nome_exibicao, preferencia, apresentacao, instagram, avatar_url_assinada, veiculos_publicos (marca, modelo, ano, apelido, foto_url_assinada), treinos_confirmados_count`. Nunca telefone, e-mail, nascimento.

### 4.2 Veículos

| Tabela | Colunas | Acesso |
|---|---|---|
| `veiculos` | `id`, `usuario_id`, `marca`, `modelo`, `ano` (1950–2100), `apelido`, `descricao` (≤ 500), `foto_path`, `publico` (bool), timestamps | Dono: tudo. Admin: lê. Público: só via `perfil_publico()` e só se `publico` |

Sem chassi, placa, documento, histórico, modificações longas.

### 4.3 Treinos e regras de pista

`treinos` ganha:

| Coluna | Valores |
|---|---|
| `participacao_pista` | `convidados` (padrão, sem inscrição), `aprovacao` (inscrição mediante aprovação), `publica` (inscrição pública sujeita à capacidade e regras) |
| `capacidade_pista` | inteiro ou nulo |
| `inscricoes_abrem_em` / `inscricoes_fecham_em` | janelas |
| `regras_pista` | texto exibido no ato da inscrição |
| `modalidade` | já prevista no plano de ticketing: `interesse` / `local` / `gratuito` / `online` |

O Open Drift Session de 20/09 fica com `participacao_pista = convidados`. Nenhuma inscrição pública.

### 4.4 Inscrições de piloto

| Tabela | Colunas | Acesso |
|---|---|---|
| `inscricoes_pista` | `id`, `treino_id`, `usuario_id`, `veiculo_id` (opcional), `status` (`pendente` / `aprovada` / `lista_espera` / `recusada` / `cancelada_pelo_piloto` / `cancelada_pela_organizacao`), `posicao_lista`, `mensagem_ao_organizador` (≤ 500), `motivo_decisao`, `decidida_por`, `decidida_em`, timestamps | Piloto lê as próprias. Admin lê todas. **Nenhuma escrita direta**: só por funções |

Índice parcial único: um registro vivo (`pendente`, `aprovada`, `lista_espera`) por `(treino_id, usuario_id)`.

### 4.5 Funções

- `inscrever_na_pista(treino, veiculo, mensagem)` → exige login; exige `participacao_pista ≠ convidados`; janela aberta; trava a linha do treino; em `publica` confirma até a capacidade e manda o excedente para a lista de espera; em `aprovacao` nasce `pendente`.
- `cancelar_inscricao(inscricao)` → só o dono, só se viva; libera vaga; **promove o primeiro da lista de espera automaticamente** quando a regra for `publica`. Isso corrige o ponto aberto do NMI.
- `decidir_inscricao(inscricao, acao, motivo)` → só admin; `aprovar`, `recusar`, `lista_espera`, `promover`; respeita capacidade sob lock; grava em `acoes_admin`.
- `conceder_capacidade(usuario, capacidade)` / `revogar_capacidade(...)` → só admin; grava auditoria. Fotógrafo entra por aqui.
- `perfil_publico(handle)`, `meus_dados()`, `minhas_inscricoes()`.
- Trigger em `auth.users`: cria `usuarios` com handle derivado do e-mail e deduplicado, `preferencia` vinda do metadado do cadastro.

Todas: `security definer`, `search_path` vazio, EXECUTE revogado de PUBLIC e anon, concedido a `authenticated` quando aplicável. Teste automatizado de privilégios, como no NMI.

### 4.6 Storage

| Bucket | Leitura | Escrita |
|---|---|---|
| `avatares` (privado) | por URL assinada de 1 h, gerada só quando o perfil é público ou para o dono | própria pasta `{uid}/` |
| `veiculos` (privado) | idem, só se o veículo é público ou para o dono | própria pasta |

Buckets de mídia comercial ficam no plano do Carioca Media.

---

## 5. Fluxo de cadastro e inscrição

**Cadastro.**
1. Botão "Criar conta" só onde faz sentido: "Minha conta", inscrição de piloto, compra de ingresso ou foto. Navegar, ver treinos, ver perfis públicos e galerias não pede login.
2. E-mail, senha forte, nome, preferência piloto ou espectador, aceite dos termos. Confirmação por código de seis dígitos no e-mail, sem sair da tela.
3. O trigger cria o registro em `usuarios`. Depois, opcionalmente: foto, Instagram, apresentação, veículo, perfil público.
4. A preferência pode ser trocada a qualquer momento em "Minha conta". Não existe conta de piloto e conta de espectador; é um campo.

**Inscrição para pilotar.**
1. Na página do treino, o bloco de pista lê `participacao_pista`. `convidados`: só a frase "pista exclusiva para pilotos convidados", sem botão. `aprovacao` ou `publica`: botão "Quero pilotar".
2. Sem login, o botão leva ao cadastro e volta para o treino. Com login, abre um formulário curto: veículo (opcional, escolhido dos cadastrados ou "vou informar depois"), mensagem, aceite das regras da pista.
3. `inscrever_na_pista` decide o status inicial e devolve a situação: "pendente de aprovação", "aprovada", ou "lista de espera, posição N".
4. O piloto acompanha em "Minha conta, minhas inscrições" e pode cancelar.
5. Aprovada não gera ingresso de público nem QR de pista nesta versão. Se um dia a pista exigir credencial na portaria, isso entra pelo plano de ticketing como um tipo de ingresso `pista`, emitido a partir da inscrição aprovada.

---

## 6. Fluxo de aprovação administrativa

1. Painel, aba "Pista" dentro de cada treino: lista de inscrições por status, com nome, preferência, Instagram, veículo, mensagem, data.
2. Ações por linha: aprovar, recusar com motivo, mover para lista de espera, promover da lista. Cada ação passa por `decidir_inscricao` e grava em `acoes_admin`.
3. Contador de capacidade: aprovadas / capacidade da pista. A função recusa aprovar acima da capacidade; o admin precisa aumentar a capacidade ou cancelar outra.
4. Aviso ao piloto: primeira versão só por e-mail transacional do Supabase Auth. Sem e-mail próprio configurado, o aviso é só o status em "Minha conta".
5. Aba "Fotógrafos": lista de pedidos de credencial (formulário simples: nome, portfólio, Instagram) e botão de conceder ou revogar a capacidade. Detalhes no plano do Carioca Media.
6. Aba "Usuários": busca por nome e e-mail, ver perfil, ver inscrições, revogar perfil público em caso de abuso. Sem banir, sem suspender nesta versão.

---

## 7. Separação entre piloto, inscrição, ingresso e associação

| Conceito | Onde vive | O que NÃO implica |
|---|---|---|
| **Usuário** | `usuarios` | Não é piloto por ter conta |
| **Preferência "piloto"** | `usuarios.preferencia` | Não autoriza pista, não exige carro, não é aprovação |
| **Veículo** | `veiculos` | Não é inscrição em treino |
| **Inscrição de pista** | `inscricoes_pista` | Não é aprovação enquanto `pendente`; não é ingresso |
| **Aprovação** | `inscricoes_pista.status = aprovada` | Não é ingresso de público; não dá acesso a outro treino |
| **Confirmação de interesse** | `confirmacoes` (atual) | Não é compra, vaga, ingresso nem inscrição |
| **Ingresso de público** | `ingressos` (plano de ticketing) | Não autoriza pista |
| **Fotógrafo** | `capacidades = fotografo` | Não é outra conta; some com a revogação |
| **Administrador** | `capacidades = admin` | Independente da preferência |
| **Associação / mensalidade** | não existe | |

Essas regras são impostas por tabelas e funções, não por botões escondidos.

---

## 8. Plano de execução que não atrasa o lançamento

**Regra:** nada deste plano toca o `main`, o Supabase de produção ou o Open Drift Session até depois de 20/09 e da sua aprovação. O site do lançamento é a Fase 01 mais a direção visual E.2 quando aprovada.

| Etapa | Entrega | Quando |
|---|---|---|
| **0** | Sua aprovação deste documento | agora |
| **1** | Migrations de `usuarios`, `capacidades`, `acoes_admin`, `veiculos`, colunas novas em `treinos`, `inscricoes_pista`, funções, buckets, trigger. Testes de banco: privilégios, RLS de perfil e veículo, capacidade sob corrida, lista de espera e promoção, um registro vivo por piloto. Aplicado **só num branch do Supabase ou num projeto de desenvolvimento**, não em produção | depois de 20/09 |
| **2** | Site: cadastro, login, confirmação por código, "Minha conta" com perfil, veículos e inscrições; perfil público em `/piloto/<handle>/`; bloco de pista na página do treino conforme `participacao_pista` | depois da 1 |
| **3** | Painel: abas Pista, Usuários e Fotógrafos; migração de `admins` para `capacidades` mantendo o painel atual funcionando | depois da 2 |
| **4** | Piloto real: um treino futuro em `aprovacao` com poucos inscritos, para validar fluxo e painel | quando houver treino |
| **5** | Ticketing e Carioca Media, conforme seus planos próprios, já sobre este modelo de conta | após aprovação dos planos |

**Dependências:** SMTP próprio no Supabase Auth antes de abrir cadastro ao público, política de senha forte ativada no painel do Supabase, texto de termos e privacidade, e a decisão sobre quem opera o painel no dia.

**Riscos:** abrir cadastro sem SMTP próprio estoura o limite do e-mail padrão do Supabase; expor perfil público por tabela em vez de função vaza telefone e e-mail; verificar capacidade no navegador em vez de sob lock repete a falha do NMI.

---

## Perguntas antes da etapa 1

1. Perfil público é opcional e desligado por padrão, ou ligado por padrão para quem escolhe "piloto"?
2. Handle: gerado do e-mail e editável uma vez, ou escolhido no cadastro?
3. Inscrição de pista pode ser feita sem veículo cadastrado, informando depois?
4. Precisa de campo de nascimento ou CPF em alguma parte? Proposta: não, até existir venda.
5. Fotógrafo pede a credencial pelo site, ou a organização concede por fora?
