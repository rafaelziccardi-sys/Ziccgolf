import { listarJogadores, salvarRodada, carregarRodada } from "../db.js";
import { esc, h, toast, loading, avatar } from "../ui.js";

export default async function renderNovaRodada(app, params) {
  app.innerHTML = loading();
  const editId = params[0] || null;
  const players = (await listarJogadores()).filter(p => p.ativo || editId);
  const ativos = players.filter(p => p.ativo);

  // estado da rodada
  const estado = {
    id: null,
    data: new Date().toISOString().slice(0, 10),
    observacoes: "",
    selecionados: new Set(),       // player_ids participantes
    scores: {},                    // id -> {gross, putts, fairways_hit, gir}
    individuais: [],               // {player_a, player_b, resultado, placar}
    duplas: [],                    // {t1_p1,t1_p2,t2_p1,t2_p2,resultado}
  };

  if (editId) {
    const r = await carregarRodada(editId);
    estado.id = r.round.id;
    estado.data = r.round.data;
    estado.observacoes = r.round.observacoes || "";
    for (const p of r.participants) {
      estado.selecionados.add(p.player_id);
      estado.scores[p.player_id] = { gross: p.gross_score, putts: p.putts, fairways_hit: p.fairways_hit, gir: p.gir };
    }
    estado.individuais = r.indMatches.map(m => ({ player_a: m.player_a, player_b: m.player_b, resultado: m.resultado, placar: m.placar || "" }));
    estado.duplas = r.teamMatches.map(m => ({ t1_p1: m.t1_p1, t1_p2: m.t1_p2, t2_p1: m.t2_p1, t2_p2: m.t2_p2, resultado: m.resultado }));
  }

  if (ativos.length < 2 && !editId) {
    app.innerHTML = `<section class="hero"><h1>Nova rodada</h1></section>
      <div class="vazio">Cadastre ao menos 2 jogadores antes. <a href="#/jogadores">Ir para Jogadores →</a></div>`;
    return;
  }

  app.innerHTML = `
    <section class="hero"><h1>${editId ? "Editar rodada" : "Nova rodada"}</h1></section>
    <form id="form-rodada">
      <div class="campo"><label>Data do jogo</label>
        <input type="date" id="data" value="${estado.data}" required></div>

      <div class="bloco">
        <div class="bloco-titulo">1 · Quem jogou + Stroke Play</div>
        <p class="hint">Marque os participantes e digite o score. Putts, fairways e GIR são opcionais.</p>
        <div id="lista-jogadores" class="lista-part"></div>
      </div>

      <div class="bloco">
        <div class="bloco-titulo">2 · Match Play individual</div>
        <div id="lista-ind"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="add-ind">+ Confronto individual</button>
      </div>

      <div class="bloco">
        <div class="bloco-titulo">3 · Match Play de duplas</div>
        <div id="lista-dup"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="add-dup">+ Confronto de duplas</button>
      </div>

      <div class="campo"><label>Observações (opcional)</label>
        <textarea id="obs" rows="2" placeholder="Vento forte, churrasco depois...">${esc(estado.observacoes)}</textarea></div>

      <div class="acoes-form">
        <button type="submit" class="btn btn-primary btn-lg">${editId ? "Salvar alterações" : "Salvar rodada"}</button>
      </div>
    </form>`;

  const playerById = new Map(players.map(p => [p.id, p]));
  const elLista = app.querySelector("#lista-jogadores");
  const elInd = app.querySelector("#lista-ind");
  const elDup = app.querySelector("#lista-dup");

  // ---- Lista de participantes ----
  function renderParticipantes() {
    elLista.innerHTML = ativos.concat(players.filter(p => !p.ativo && estado.selecionados.has(p.id)))
      .map(p => {
        const sel = estado.selecionados.has(p.id);
        const sc = estado.scores[p.id] || {};
        return `<div class="part-row ${sel ? "sel" : ""}" data-id="${p.id}">
          <label class="part-check">
            <input type="checkbox" ${sel ? "checked" : ""} data-id="${p.id}">
            ${avatar(p, 32)}<span>${esc(p.nome)}</span>
          </label>
          ${sel ? `<div class="part-inputs">
            <input type="number" inputmode="numeric" placeholder="Score" data-campo="gross" data-id="${p.id}" value="${val(sc.gross)}" class="in-score">
            <input type="number" inputmode="numeric" placeholder="Putts" data-campo="putts" data-id="${p.id}" value="${val(sc.putts)}">
            <input type="number" inputmode="numeric" placeholder="Fairways" data-campo="fairways_hit" data-id="${p.id}" value="${val(sc.fairways_hit)}">
            <input type="number" inputmode="numeric" placeholder="GIR" data-campo="gir" data-id="${p.id}" value="${val(sc.gir)}">
          </div>` : ""}
        </div>`;
      }).join("");
  }
  elLista.addEventListener("change", (e) => {
    const id = e.target.dataset.id;
    if (e.target.type === "checkbox") {
      e.target.checked ? estado.selecionados.add(id) : estado.selecionados.delete(id);
      if (e.target.checked && !estado.scores[id]) estado.scores[id] = {};
      renderParticipantes();
    } else if (e.target.dataset.campo) {
      estado.scores[id] = estado.scores[id] || {};
      estado.scores[id][e.target.dataset.campo] = e.target.value;
    }
  });

  // ---- Confrontos individuais ----
  function renderInd() {
    elInd.innerHTML = estado.individuais.map((m, i) => `
      <div class="confronto-row" data-i="${i}">
        ${selJogador(players, "player_a", m.player_a, i)}
        <select data-i="${i}" data-campo="resultado" class="sel-res">
          <option value="A" ${m.resultado === "A" ? "selected" : ""}>venceu</option>
          <option value="EMPATE" ${m.resultado === "EMPATE" ? "selected" : ""}>empate</option>
          <option value="B" ${m.resultado === "B" ? "selected" : ""}>perdeu</option>
        </select>
        ${selJogador(players, "player_b", m.player_b, i)}
        <input type="text" placeholder="placar" data-i="${i}" data-campo="placar" value="${esc(m.placar || "")}" class="in-placar">
        <button type="button" class="btn-x" data-rm="ind" data-i="${i}">✕</button>
      </div>`).join("");
  }
  app.querySelector("#add-ind").onclick = () => {
    estado.individuais.push({ player_a: ativos[0]?.id, player_b: ativos[1]?.id, resultado: "A", placar: "" });
    renderInd();
  };
  elInd.addEventListener("change", (e) => {
    const i = +e.target.dataset.i, campo = e.target.dataset.campo;
    if (campo) estado.individuais[i][campo] = e.target.value;
  });

  // ---- Confrontos de duplas ----
  function renderDup() {
    elDup.innerHTML = estado.duplas.map((m, i) => `
      <div class="confronto-dup" data-i="${i}">
        <div class="dupla">${selJogador(players, "t1_p1", m.t1_p1, i)} <span>+</span> ${selJogador(players, "t1_p2", m.t1_p2, i)}</div>
        <select data-i="${i}" data-campo="resultado" class="sel-res">
          <option value="T1" ${m.resultado === "T1" ? "selected" : ""}>dupla 1 venceu</option>
          <option value="EMPATE" ${m.resultado === "EMPATE" ? "selected" : ""}>empate</option>
          <option value="T2" ${m.resultado === "T2" ? "selected" : ""}>dupla 2 venceu</option>
        </select>
        <div class="dupla">${selJogador(players, "t2_p1", m.t2_p1, i)} <span>+</span> ${selJogador(players, "t2_p2", m.t2_p2, i)}</div>
        <button type="button" class="btn-x" data-rm="dup" data-i="${i}">✕</button>
      </div>`).join("");
  }
  app.querySelector("#add-dup").onclick = () => {
    estado.duplas.push({ t1_p1: ativos[0]?.id, t1_p2: ativos[1]?.id, t2_p1: ativos[2]?.id, t2_p2: ativos[3]?.id, resultado: "T1" });
    renderDup();
  };
  elDup.addEventListener("change", (e) => {
    const i = +e.target.dataset.i, campo = e.target.dataset.campo;
    if (campo) estado.duplas[i][campo] = e.target.value;
  });

  // remover confrontos (delegação no form)
  app.querySelector("#form-rodada").addEventListener("click", (e) => {
    const rm = e.target.dataset.rm;
    if (!rm) return;
    const i = +e.target.dataset.i;
    if (rm === "ind") { estado.individuais.splice(i, 1); renderInd(); }
    if (rm === "dup") { estado.duplas.splice(i, 1); renderDup(); }
  });

  // ---- Salvar ----
  app.querySelector("#form-rodada").addEventListener("submit", async (e) => {
    e.preventDefault();
    estado.data = app.querySelector("#data").value;
    estado.observacoes = app.querySelector("#obs").value;
    const participantes = [...estado.selecionados].map(id => ({
      player_id: id, gross_score: estado.scores[id]?.gross,
      putts: estado.scores[id]?.putts, fairways_hit: estado.scores[id]?.fairways_hit,
      fairways_tot: 14, gir: estado.scores[id]?.gir, gir_tot: 18,
    }));
    if (participantes.length < 1) return toast("Selecione ao menos 1 jogador", "erro");
    // valida confrontos sem jogadores repetidos/ vazios
    for (const m of estado.individuais)
      if (!m.player_a || !m.player_b || m.player_a === m.player_b) return toast("Confronto individual inválido", "erro");
    const btn = e.submitter; btn.disabled = true; btn.textContent = "Salvando...";
    try {
      await salvarRodada({ id: estado.id, ...estado, participantes });
      toast("Rodada salva! 🏌️");
      location.hash = "#/home";
    } catch (err) { console.error(err); toast(err.message || "Erro ao salvar", "erro"); btn.disabled = false; btn.textContent = "Salvar rodada"; }
  });

  renderParticipantes();
  renderInd();
  renderDup();
}

function selJogador(players, campo, valor, i) {
  return `<select data-campo="${campo}" data-i="${i}" class="sel-jog">
    ${players.map(p => `<option value="${p.id}" ${p.id === valor ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}
  </select>`;
}
const val = (v) => (v == null ? "" : v);
