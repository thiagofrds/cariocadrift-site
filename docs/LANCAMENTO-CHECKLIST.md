# Etapa A — Checklist de publicação (resultados reais)

Branch `fase-01-home`, E.2 aplicada. Executado em 16/09/2026 contra o build local (`http://localhost:8765`) e contra a produção atual (`main`) onde indicado. Roteiros: `docs/capturas/capturas-e2.js` (160 verificações), `docs/capturas/qa-lancamento.js` (63 verificações, conta de QA temporária criada e apagada), `docs/capturas/gera-marca.js`. Capturas em `docs/capturas/e2/` (não versionadas).

Legenda: **aprovado** / **falhou** / **não testado**.

## 1. Navegação
| Item | Resultado | Evidência |
|---|---|---|
| Desktop 1440: 6 itens de menu, "Ingressos" e "Carioca Media" marcados "em breve" e sem link, CTA "Treino 20.09" dinâmico | aprovado | `home-d1440-dobra.png`, teste automático |
| Mobile 390: hambúrguer abre e fecha (clique e Escape), menu com os dois itens "em breve" sem link, Instagram | aprovado | `home-m390-menu.png` |
| Mobile: logo do topo escondida enquanto a logo grande do hero está na tela; aparece ao rolar | aprovado | teste automático |
| Dock inferior no mobile: escondida no hero, visível no meio, escondida no rodapé (home e página do treino) | aprovado | `home-m390-dock.png` |
| Sem rolagem horizontal em 1440, 390, 375 e 360, nas cinco páginas | aprovado | 17 medições |

## 2. Primeira dobra e CTAs
| Item | Resultado | Evidência |
|---|---|---|
| Home 390×844: título do evento e "Confirmar presença" visíveis sem rolar | aprovado | botão termina em 577 px de 844 |
| Home 375×812 e 360×640 | aprovado | 577 de 812; 567 de 640 |
| Página do treino 390/375/360: título e botão na dobra | aprovado | botão termina em 404 px |
| Desktop 1440 home e treino | aprovado | `home-d1440-dobra.png`, `evento-d1440-dobra.png` |

## 3. Formulários gravando
| Item | Resultado | Evidência |
|---|---|---|
| Confirmação de presença em 375, 390 e 1440: máscara de telefone, envio 201, "Interesse registrado!" | aprovado | 3 registros criados e apagados |
| Telefone duplicado → 409 → "Você já está na lista!" | aprovado | 3 casos |
| Campos vazios bloqueados com mensagens | aprovado | 3 casos |
| Escolinha: botão do pacote pré-seleciona a opção; envio grava com `pacote = curso-chevette`; "Tá na lista!" | aprovado | 1 registro criado e apagado; painel listou o registro |
| Anon não lê `interessados_escolinha` (RLS) | aprovado | 200 com zero linhas |

## 4. Painel e exportações
| Item | Resultado | Evidência |
|---|---|---|
| Login errado mostra mensagem | aprovado | o 400 do endpoint de token registrado no console é o próprio teste |
| Login da conta de QA (listada em `admins`) | aprovado | |
| Lista de treinos, criação de rascunho com upload de foto no bucket `fotos`, URL pública acessível | aprovado | arquivo apagado no fim |
| Rascunho invisível ao público; publicar torna visível com a edição; agenda mostra; home mantém 20.09 como próximo | aprovado | |
| Despublicar pela lista; confirmações listam registros; CSV de confirmações e CSV da escolinha baixam | aprovado | `confirmacoes.csv`, `interessados-escolinha.csv` |
| Apagar treino; sair volta ao login | aprovado | |
| Painel herda o novo cabeçalho e a nova paleta sem erro de console (1440 e 390) | aprovado | `admin-login-d1440.png`, `admin-login-m390.png` |

## 5. Página do treino: acesso direto e prévia
| Item | Resultado | Evidência |
|---|---|---|
| `/treinos/open-drift-session/` gerada pelo build, renderiza o evento (200 no servidor local) | aprovado | teste em 375/390/1440 |
| `og:title`, `og:description` próprios na página gerada; `og:image` = `assets/og.jpg` 1200×630 (marca oficial, sem foto) | aprovado | `treinos/open-drift-session/index.html` |
| Slug inexistente cai no `404.html` e mostra "Treino não encontrado" | aprovado | `naoexiste-d1440-dobra.png` |
| Prévia real no WhatsApp/Instagram | **não testado** | só é possível com a URL pública após o merge |

## 6. Console
| Item | Resultado |
|---|---|
| Zero erros de console em 17 combinações página × largura | aprovado |
| Zero erros de console no painel, exceto o 400 provocado pelo teste de login errado | aprovado |

## 7. Links, créditos e conteúdo do Open Drift Session
| Item | Resultado | Evidência |
|---|---|---|
| Google Maps e Waze na home apontam para o endereço; na página do treino vêm do banco | aprovado | |
| "Consultar caronas" leva ao @cariocadrift_ | aprovado | |
| Toda `figure.foto` com crédito "Sergio Photos RJ" (10 na home, 1 no Sobre); nenhuma foto do acervo recortada na base; marca d'água visível nas capturas | aprovado | `home-d1440.png`, `home-d1440-cena.png` |
| Textos em home e treino: 20.09, domingo 20 de setembro, 9h às 18h, RJ Race Park, Estrada do Frutuoso 320, ingressos no local, pista exclusiva para pilotos convidados, caronas pagas, capacete obrigatório | aprovado | 16 verificações |
| Nenhum texto de checkout, compra de ingresso ou inscrição de piloto | aprovado | |
| Render conceitual `carro.jpg` não aparece em nenhuma página nem como prévia | aprovado | contagem zero nos HTMLs gerados |

## 8. Produção (verificado agora, nada alterado)
| Item | Resultado | Detalhe |
|---|---|---|
| DNS | aprovado | 4 A do GitHub Pages, `www` CNAME, sem AAAA/CAA |
| Certificado | **aprovado** | GitHub emitiu: `CN=cariocadrift.com.br`, válido até 15/12/2026; API: `approved`. `https://cariocadrift.com.br` e `https://www.` respondem 200 com verificação OK |
| Enforce HTTPS | **falhou** (desligado) | `https_enforced: false`. Agora pode ser ligado em Settings → Pages; é alteração de configuração e aguarda sua autorização. Não é mais necessário remover e readicionar o domínio |
| Supabase Auth Site URL / Redirects | não alterado | atual `http://localhost:3000`, sem redirects; proposta na seção 2 de `LANCAMENTO-E2-INVENTARIO.md` |

## 9. Pendências que dependem de você
1. **Capa do evento no banco** é `/assets/carro.jpg` (render conceitual). O site agora ignora esse arquivo, então a página do treino fica sem capa. Troque no painel por uma foto do acervo (com a licença confirmada) ou deixe vazio. Não alterei o banco.
2. **Merge** de `fase-01-home` em `main` (publica automaticamente).
3. **Enforce HTTPS** no GitHub Pages.
4. **Site URL e Redirect URLs** do Supabase Auth de produção.
5. **Senha do administrador**: rodar `scripts/trocar-senha-admin.js` (revisão do script em `LANCAMENTO-E2-INVENTARIO.md`, seção 1, e na mensagem de entrega).
6. Após o merge: prévia real no WhatsApp, formulários reais em produção, `og.jpg` novo em cache das redes.

---

## 10. Fechamento (16/09, fim do dia)

| Item | Resultado | Detalhe |
|---|---|---|
| Senha do administrador | **aprovado** | Trocada por você pelo `scripts/trocar-senha-admin.js` (duas tentativas recusadas pelo script, terceira concluída). API de administração confirma `updated_at` e `last_sign_in_at` às 19:02 UTC. Logout global executado. Linha `ADMIN_SENHA_INICIAL` removida de `.env.local`. Zip antigo em `~/Downloads/cariocadrift-site.zip` ainda existe: apagar |
| Sessões antigas | **parcial** | Refresh tokens revogados. Access tokens já emitidos valem até expirar (até 1 h). Verificação final: recarregar o painel na aba antiga depois desse prazo e confirmar que pede login |
| Enforce HTTPS | **aprovado** | Ativado após confirmar certificado `CN=cariocadrift.com.br` válido até 15/12/2026 e HTTPS 200 nos dois domínios. Testes: `www` → 301 para `https://cariocadrift.com.br/`; `/treinos/` em HTTP → 301 HTTPS; raiz em HTTP → ver linha abaixo. DNS e domínio não tocados |
| Raiz em HTTP → HTTPS | ver mensagem de entrega | CDN devolveu 200 em cache (`Age` 390 s, `max-age` 600 s) logo após ativar; retestado após expirar |
| Capa do evento | **aguardando escolha** | Render bloqueado. Prévias com fotos do acervo ainda não usadas no site: `capa-3132`, `capa-3142`, `capa-3127` (desktop e mobile). Crédito "Foto Sergio Photos RJ · Registro de treino anterior" automático para fotos do acervo. Banco não alterado |
| Supabase Auth | **aguardando aceite** | Painel usa `resetPasswordForEmail` com retorno `origem + /admin/` e trata `PASSWORD_RECOVERY`. Configuração proposta na mensagem de entrega. Nada salvo |
| Merge | não autorizado | `fase-01-home` pronto, 3 commits desde o QA (E.2, checklist, crédito da capa) |

**Só testável após a publicação:** prévia de link no WhatsApp e Instagram com o novo `og.jpg`; formulários e painel no domínio real; página `/treinos/open-drift-session/` com 200 no GitHub Pages; recuperação de senha por e-mail (depende da configuração do Auth).
