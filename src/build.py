#!/usr/bin/env python3
"""Gera index.html a partir de src/index.template.html embutindo as imagens em base64."""
import base64, pathlib
raiz = pathlib.Path(__file__).resolve().parent.parent
tpl = (raiz/'src'/'index.template.html').read_text(encoding='utf-8')
def uri(nome, mime='image/jpeg'):
    return f"data:{mime};base64," + base64.b64encode((raiz/nome).read_bytes()).decode()
html = (tpl.replace('{{LOGO}}', uri('logo.jpeg'))
           .replace('{{CARRO}}', uri('carro.jpeg'))
           .replace('{{PISTA}}', uri('pista.jpeg')))
(raiz/'index.html').write_text(html, encoding='utf-8')
print('index.html gerado:', len(html)//1024, 'KB')
