/* Carioca Drift · utilidades compartilhadas (público) */
window.CD = (() => {
  const SB_URL = "https://trkwfwvqzfvscqwwldpv.supabase.co";
  const SB_KEY = "sb_publishable_CYYZ-iAogWrOfkRlKuROWg_KiAp2Jhm";
  const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const MESES_LONGO = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const DIAS = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
  const DIAS_CURTO = ["dom","seg","ter","qua","qui","sex","sáb"];

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

  async function treinosPublicados() {
    return rest("treinos?select=*&publicado=eq.true&order=data.asc");
  }

  return { SB_URL, SB_KEY, esc, paragrafos, rest, dataLocal, inicio, fim, hora, dataExtenso, dataCurta, mesDia, foto, cardTreino, treinosPublicados };
})();
