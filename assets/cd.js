/* Carioca Drift · utilidades compartilhadas (público) */
window.CD = (() => {
  const SB_URL = "https://trkwfwvqzfvscqwwldpv.supabase.co";
  const SB_KEY = "sb_publishable_CYYZ-iAogWrOfkRlKuROWg_KiAp2Jhm";
  const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const MESES_LONGO = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const DIAS = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
  const DIAS_CURTO = ["dom","seg","ter","qua","qui","sex","sáb"];

  // Regras de participação por evento (informadas pela organização). Sem campo no banco nesta fase:
  // vale só para os slugs listados; outros treinos não exibem estes blocos.
  const PARTICIPACAO = {
    "open-drift-session": {
      publico: "Confirme seu interesse em participar do evento. Ingressos disponíveis no local.",
      pilotos: "Participação na pista exclusiva para pilotos convidados.",
      caronas: "Caronas pagas. Consulte informações e disponibilidade com a organização."
    }
  };
  const participacao = slug => PARTICIPACAO[slug] || null;
  // Arquivos conceituais (renders) que não podem ser exibidos como fotografia real em nenhuma página.
  const RENDERS_CONCEITUAIS = ["/assets/carro.jpg", "https://cariocadrift.com.br/assets/carro.jpg"];

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const paragrafos = s => esc(s).split(/\n{2,}|\n/).filter(Boolean).map(p => `<p>${p}</p>`).join("");

  async function rest(path, opts = {}) {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      ...opts,
      headers: { apikey: SB_KEY, "Content-Type": "application/json", ...(opts.headers || {}) }
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.status === 204 ? null : r.json();
  }

  // data "2026-09-20" -> Date local (sem fuso)
  const dataLocal = (d, h = "00:00") => new Date(`${d}T${h.slice(0,5)}:00-03:00`);
  const inicio = t => dataLocal(t.data, t.hora_inicio);
  const fim = t => dataLocal(t.data, t.hora_fim);
  const hora = h => { const [H, M] = h.slice(0,5).split(":"); return M === "00" ? `${+H}h` : `${+H}h${M}`; };
  const dataExtenso = d => { const x = dataLocal(d); return `${DIAS[x.getDay()]}, ${x.getDate()} de ${MESES_LONGO[x.getMonth()]}`; };
  const dataCurta = d => { const x = dataLocal(d); return `${String(x.getDate()).padStart(2,"0")}.${String(x.getMonth()+1).padStart(2,"0")}`; };
  const mesDia = d => { const x = dataLocal(d); return `${MESES[x.getMonth()]} · ${DIAS_CURTO[x.getDay()]}`; };
  const foto = u => !u ? "" : (u.startsWith("http") ? u : u);

  function cardTreino(t, destaque = false) {
    const x = dataLocal(t.data);
    return `<a class="evento${destaque ? " destaque" : ""}" href="/treinos/${esc(t.slug)}/">
      <div class="data"><b>${x.getDate()}</b><small>${mesDia(t.data)}</small></div>
      <div class="corpo">
        <span class="tag">${esc(t.tipo)}</span>
        <h3>${esc(t.titulo)}</h3>
        <p class="meta">${hora(t.hora_inicio)} às ${hora(t.hora_fim)} · ${esc(t.local_nome)}${t.entrada_titulo ? " · " + esc(t.entrada_titulo) : ""}${t.regra_titulo ? " · " + esc(t.regra_titulo) : ""}</p>
        ${destaque ? `<div class="contagem" id="contagem"><span>Faltam <b id="cd">--</b></span></div>` : ""}
        <span class="cta">Ver o treino e confirmar presença</span>
      </div>
      ${destaque && t.pista_foto_url ? `<div class="foto"><img src="${esc(foto(t.pista_foto_url))}" alt="" loading="lazy"></div>` : ""}
    </a>`;
  }

  let _treinos = null;
  function treinosPublicados() {
    if (!_treinos) _treinos = rest("treinos?select=*&publicado=eq.true&order=data.asc").catch(e => { _treinos = null; throw e; });
    return _treinos;
  }

  // Menu mobile
  function menuMobile(){
    const btn = document.getElementById('abrirMenu'), menu = document.getElementById('menuMobile'); if (!btn || !menu) return;
    const abrir = on => { menu.hidden = !on; btn.setAttribute('aria-expanded', String(on)); btn.setAttribute('aria-label', on ? 'Fechar menu' : 'Abrir menu'); document.body.classList.toggle('menu-aberto', on); if (on) menu.querySelector('a').focus(); };
    btn.addEventListener('click', () => abrir(menu.hidden));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { abrir(false); btn.focus(); } });
    matchMedia('(min-width:900px)').addEventListener('change', e => { if (e.matches) abrir(false); });
  }

  // Botão "Próximo treino" no header (todas as páginas)
  async function ctaProximo(){
    try {
      const t = (await treinosPublicados()).find(x => fim(x) >= new Date());
      const b = document.getElementById('navCta'); if (!b) return;
      if (!t) { b.textContent = 'Ver treinos'; b.href = '/treinos/'; return; }
      b.href = `/treinos/${esc(t.slug)}/`; b.textContent = `Treino ${dataCurta(t.data)}`;
    } catch (e) {}
  }

  // Barra fixa no topo com o próximo treino (todas as páginas, menos onde window.SEM_BARRA = true)
  async function barraProximo(){
    if (window.SEM_BARRA) return;
    const el = document.getElementById('barraContagem'); if (!el) return;
    try {
      const todos = await treinosPublicados(); const agora = new Date();
      const t = todos.find(x => fim(x) >= agora); if (!t) return;
      const INICIO = inicio(t), FIM = fim(t);
      el.innerHTML = `<a class="wrap" href="/treinos/${esc(t.slug)}/"><span class="bc-rotulo">Próximo treino</span><span class="bc-nome">${esc(t.titulo)} · ${esc(dataCurta(t.data))}</span><span class="bc-num" id="bcNum"></span><span class="bc-cta">Confirmar presença →</span></a>`;
      el.hidden = false; document.documentElement.classList.add('com-barra');
      const num = document.getElementById('bcNum');
      (function tick(){
        const agora = new Date();
        if (agora >= FIM) { num.textContent = 'Encerrado'; return; }
        if (agora >= INICIO) { num.textContent = 'Rolando agora'; return; }
        let s = Math.floor((INICIO - agora)/1000); const d = Math.floor(s/86400); s -= d*86400; const h = Math.floor(s/3600); s -= h*3600; const m = Math.floor(s/60); s -= m*60;
        num.innerHTML = `<b>${d}</b>d <b>${String(h).padStart(2,'0')}</b>h <b>${String(m).padStart(2,'0')}</b>m <b>${String(s).padStart(2,'0')}</b>s`;
        setTimeout(tick, 1000 - (Date.now() % 1000));
      })();
    } catch (e) {}
  }
  // Cabeçalho no mobile: esconde a logo do topo enquanto a logo grande do hero está na tela (evita duas logos na primeira dobra)
  function topoMarca(){
    const topo = document.getElementById('topo'), alvo = document.querySelector('[data-marca-hero]'); if (!topo || !alvo) return;
    new IntersectionObserver(([e]) => topo.classList.toggle('marca-oculta', e.isIntersecting), { threshold: 0 }).observe(alvo);
  }
  // Barra fixa inferior (mobile): aparece quando o bloco de ação (data-dock-alvo) sai da tela; some no rodapé
  function dock(){
    const el = document.getElementById('dock'), alvo = document.querySelector('[data-dock-alvo]'), rodape = document.querySelector('footer'); if (!el || !alvo) return;
    let alvoVisivel = true, rodapeVisivel = false;
    const atualiza = () => el.classList.toggle('on', !alvoVisivel && !rodapeVisivel);
    new IntersectionObserver(([e]) => { alvoVisivel = e.isIntersecting || e.boundingClientRect.top > 0; atualiza(); }).observe(alvo);
    if (rodape) new IntersectionObserver(([e]) => { rodapeVisivel = e.isIntersecting; atualiza(); }).observe(rodape);
  }
  const init = () => { menuMobile(); ctaProximo(); barraProximo(); topoMarca(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  return { SB_URL, SB_KEY, participacao, RENDERS_CONCEITUAIS, dock, esc, paragrafos, rest, dataLocal, inicio, fim, hora, dataExtenso, dataCurta, mesDia, foto, cardTreino, treinosPublicados };
})();
