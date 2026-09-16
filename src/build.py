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
import pathlib, re, shutil

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
    out = out.replace("{{root}}", root).replace("{{path}}", path)
    out = re.sub(r'\{\{cur:(\w+)\}\}',
                 lambda m: 'aria-current="page"' if m.group(1) == meta.get("nav") else "", out)
    return out

gerados = []
for pagina in sorted((SRC / "pages").rglob("index.html")):
    rel = pagina.relative_to(SRC / "pages").parent          # "" | treinos | treinos/open-drift-session
    profundidade = len(rel.parts)
    root = "../" * profundidade if profundidade else "./"
    path = (str(rel).replace("\\", "/") + "/") if profundidade else ""
    meta, corpo = meta_e_corpo(pagina.read_text(encoding="utf-8"))
    html = "".join(render(PARTIALS[p], meta, root, path) for p in ("head", "nav")) \
         + render(corpo, meta, root, path) \
         + render(PARTIALS["footer"], meta, root, path)
    destino = RAIZ / rel / "index.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html, encoding="utf-8")
    gerados.append(str(destino.relative_to(RAIZ)))

print("gerado:", ", ".join(gerados))
