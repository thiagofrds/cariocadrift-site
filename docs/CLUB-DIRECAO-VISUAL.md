# Carioca Drift Club — direção visual (proposta, ambiente isolado)

Base oficial: o pacote de cinco artes recebido em 16/09/2026 (`assets/marca/club/`). O site institucional continua com a E.2; esta direção vale só para as páginas do Club, que têm cabeçalho e folha de estilo próprios (`assets/club.css`, layout `club` no build). Nada publicado.

## 1. Proposta

O Club é a camada premium do universo Carioca Drift: mesma tipografia e mesmas cores de base do site, mas com base mais escura, prata metálica como cor de prestígio, e as artes com carro como peças de impacto. A interface interna é limpa: fundo quase preto, cards com borda fina e um único fio de acento (amarelo para destaque, vermelho para alerta), sem texturas por trás de texto. A arte aparece grande e inteira; o texto nunca é escrito por cima do carro.

## 2. Qual arte em cada contexto

| Peça | Onde | Como |
|---|---|---|
| `hero-z-azul` (Z azul + skyline) | entrada do Club | hero principal: no celular a arte inteira em cima e o texto abaixo, com um véu só na base; no desktop, texto à esquerda e arte à direita, sem véu |
| `hero-m2-preto` (M2 preto) | tela "solicitar associação" e cabeçalho da área interna do membro | capa lateral no formulário; faixa de topo na área interna, com degradê para o preto e o cartão de membro sobreposto abaixo, nunca sobre o carro |
| `hero-350z-prata` (350Z prata) | telas de status (pendente, recusada, cancelada, encerrada) | capa lateral; a prata combina com o tom "em análise" |
| `logo-club-fumaca` (logo + fumaça) | cabeçalho do Club, recortada pequena | fundo escuro se funde com a interface |
| `logo-club-brilho` (logo + brilho) | fundo do cartão de membro, com véu escuro à esquerda para o texto | uso interno, nunca em áreas públicas do site institucional |
| coroa (vetor próprio) | selo de membro, chips de status, ícones | desenhada em SVG de 3 pontas, inspirada na coroa das artes, para não recortar bitmap em tamanhos pequenos |

Regra: as artes são ilustrações da marca do Club. Nunca aparecem como registro de treino, nunca com crédito de fotógrafo, nunca como "carro da organização".

## 3. Estrutura de páginas e blocos

- **`/clube/` entrada** (visitante ou logado sem pedido): hero, "Da conta ao Club" em três passos, "O que muda sendo membro" em dois cards (selo, área interna), regra de separação de conceitos em vermelho.
- **`/clube/` solicitar** (logado, cadastro completo, sem pedido ativo): capa M2 à esquerda, cartão com mensagem opcional e botão único. Regra repetida uma vez, curta.
- **`/clube/` status** (pendente, recusada, cancelada, encerrada): título do estado, selo de status, texto com o motivo quando houver, jornada em quatro passos (conta, solicitação, decisão, membro) com o passo atual marcado, ações (cancelar, solicitar de novo), capa 350Z.
- **`/clube/` área interna** (aprovada): faixa com a arte M2, cartão de membro (selo, nome, @, membro desde) sobre a logo com brilho, três cards vazios (comunicados, encontros, benefícios a definir), regra.
- **Minha Conta**: bloco "Clube Carioca Drift" com status e link para `/clube/`; continua na identidade institucional.
- **Painel › Clube** (admin): solicitações com aprovar/recusar e motivo, membros com encerrar, histórico. Continua no painel institucional, com o mesmo padrão E.2, para não misturar as duas identidades na operação.

## 4. Regras de consistência

1. Base preta `#050506`, grafite `#111114`, linhas `#232329`; prata `#D8D8DE` para texto e metal para títulos de destaque; amarelo `#FFD100` só em selo, CTA principal e um fio de acento; vermelho `#FF1E1E` só em recusa, encerramento e na regra de separação.
2. Tipografia igual ao site: Saira Extra Condensed 800 nos títulos, Barlow Condensed nos rótulos, Barlow no texto.
3. Uma arte por tela, inteira. Nada de texto, botão ou selo por cima do carro.
4. Cards sem sombra, sem cantos arredondados, um fio de acento por card no máximo.
5. Status sempre em selo com coroa; cores: pendente prata, aprovada amarela, recusada e encerrada vermelhas.
6. Toda tela do Club repete uma vez, em um bloco vermelho curto, que membro não é pista, não é ingresso e não garante participação.

## 5. Componentes

`club-topo` (cabeçalho), `club-hero`, `club-linha` (fio metálico), `club-secao`, `club-card` (+ `destaque`, `alerta`), `selo` (+ `prata`, `pendente`, `recusada`, `encerrada`), `jornada` com `passo` (`feito`, `atual`), `cartao-membro`, botões `btn am` e `btn metal`, `regra`.

## 6. Hierarquia visual

Hero principal (arte + título metálico + CTA amarelo) > cartão de membro (prata, selo amarelo) > cards internos (grafite, fio de acento) > selos e chips (coroa) > regra (vermelho, discreto). Estado pendente usa prata; membro aprovado usa amarelo; admin permanece no painel E.2.

## 7. O que falta do pacote

Versão da logo com fundo transparente, para uso sobre prata ou sobre fotos; e, se quiser, uma variação horizontal para o cabeçalho. Até lá, a logo com fumaça recortada resolve o cabeçalho em fundo escuro.
