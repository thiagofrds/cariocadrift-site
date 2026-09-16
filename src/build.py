#!/usr/bin/env python3
"""Monta o site: src/pages/**/index.html + partials -> raiz do repositório.

Cada página começa com um bloco de metadados:
  ---
  title: ...
  desc: ...
  og_title: ...   (opcional; usa title)
  nav: home|treinos|escolinha|sobre   (item ativo no menu)
  ---
Marcadores disponíveis no corpo: {{root}} (prefixo relativo até a raiz).
"""
import pathlib, re, shutil, json, urllib.request

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SRC = RAIZ / "src"
PARTIALS = {p.stem: (SRC / "partials" / p.name).read_text(encoding="utf-8")
            for p in (SRC / "partials").glob("*.html")}

def meta_e_corpo(texto):
    m = re.match(r"---\n(.*?)\n---\n", texto, re.S)
    meta = dict(l.split(":", 1) for l in m.group(1).splitlines() if ":" in l)
    meta = {k.strip(): v.strip() for k, v in meta.items()}
    return meta, texto[m.end():]

def render(tpl, meta, root, path):
    out = tpl
    for k, v in meta.items():
        out = out.replace("{{" + k + "}}", v)
    out = out.replace("{{og_title}}", meta.get("og_title", meta["title"]))
    out = out.replace("{{extra_head}}", meta.get("extra_head", ""))
    out = out.replace("{{root}}", root).replace("{{path}}", path)
    out = re.sub(r'\{\{cur:(\w+)\}\}',
                 lambda m: 'aria-current="page"' if m.group(1) == meta.get("nav") else "", out)
    return out

gerados = []
for pagina in sorted((SRC / "pages").rglob("index.html")):
    rel = pagina.relative_to(SRC / "pages").parent          # "" | treinos | treinos/open-drift-session
    profundidade = len(rel.parts)
    root = "/"
    path = (str(rel).replace("\\", "/") + "/") if profundidade else ""
    meta, corpo = meta_e_corpo(pagina.read_text(encoding="utf-8"))
    html = "".join(render(PARTIALS[p], meta, root, path) for p in ("head", "nav")) \
         + render(corpo, meta, root, path) \
         + render(PARTIALS["footer"], meta, root, path)
    destino = RAIZ / rel / "index.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html, encoding="utf-8")
    gerados.append(str(destino.relative_to(RAIZ)))

shutil.copyfile(RAIZ / "treinos" / "evento" / "index.html", RAIZ / "404.html")
gerados.append("404.html")

# Páginas estáticas dos treinos publicados: HTTP 200 e prévia própria (título, descrição, imagem)
# no WhatsApp/Instagram. Treinos criados depois do build continuam funcionando pelo 404.html.
SB_URL = "https://trkwfwvqzfvscqwwldpv.supabase.co"
SB_KEY = "sb_publishable_CYYZ-iAogWrOfkRlKuROWg_KiAp2Jhm"
try:
    req = urllib.request.Request(f"{SB_URL}/rest/v1/treinos?select=slug,titulo,chamada,data,local_nome,capa_url&publicado=eq.true", headers={"apikey": SB_KEY})
    treinos = json.load(urllib.request.urlopen(req, timeout=15))
except Exception as e:
    treinos = []
    print("aviso: não consegui buscar os treinos publicados, páginas estáticas não geradas:", e)
tpl_evento = (SRC / "pages" / "treinos" / "evento" / "index.html").read_text(encoding="utf-8")
meta_ev, corpo_ev = meta_e_corpo(tpl_evento)
for t in treinos:
    d = t["data"].split("-")
    meta = dict(meta_ev)
    meta["title"] = f'{t["titulo"]} {d[2]}.{d[1]} | Carioca Drift'
    meta["og_title"] = f'{t["titulo"]} · {d[2]}.{d[1]} · {t["local_nome"]}'
    meta["desc"] = (t.get("chamada") or f'{t["titulo"]} no {t["local_nome"]}.').replace('"', "'")
    path = f'treinos/{t["slug"]}/'
    html = "".join(render(PARTIALS[p], meta, "/", path) for p in ("head", "nav")) + render(corpo_ev, meta, "/", path) + render(PARTIALS["footer"], meta, "/", path)
    capa = t.get("capa_url") or ""
    if capa.startswith("/assets/"):
        capa = "https://cariocadrift.com.br" + capa
    if capa.startswith("http") and "/assets/carro.jpg" not in capa:   # render conceitual nunca vira prévia
        html = html.replace('content="https://cariocadrift.com.br/assets/og.jpg"', f'content="{capa}"')
    destino = RAIZ / "treinos" / t["slug"] / "index.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html, encoding="utf-8")
    gerados.append(str(destino.relative_to(RAIZ)))
print("gerado:", ", ".join(gerados))
