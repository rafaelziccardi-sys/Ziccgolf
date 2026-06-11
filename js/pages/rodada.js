// =============================================================
//  Rodada AO VIVO — cada jogador entra sozinho e preenche o
//  próprio placar (autosave por buraco). Todos veem atualizar.
// =============================================================
import {
  carregarRodada, jogadoresDoGrupo, meuJogador, entrarNaRodada, sairDaRodada,
  salvarBuraco, salvarMatchInd, salvarMatchDupla, excluirMatchInd, excluirMatchDupla,
} from "../db.js";
import { PAR_BURACOS, PAR_TOTAL, N_FAIRWAYS } from "../config.js";
import { esc, toast, loading, avatar, fmtData, fmtInt, nomeJogador } from "../ui.js";

const NB = 18;
const novaGrade = () => Array.from({ length: NB }, () => ({ score: "", putts: "", bunker: "", gir: false, fir: false }));
let pollTimer = null;

function classeScore(score, par) {
  const s = +score; if (score === "" || score == null || isNaN(s) || !par) return "";
  const d = s - par;
  if (d <= -2) return "sc-eagle"; if (d === -1) return "sc-birdie";
  if (d === 0) return "sc-par"; if (d === 1) return "sc-bogey"; return "sc-double";
}

export default async function renderRodada(app, params) {
  const roundId = params[0];
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  app.innerHTML = loading();

  const [players, me] = await Promise.all([jogadoresDoGrupo(), meuJogador()]);
  const meId = me?.id || null;
  const minhaGrade = novaGrade();

  let dados = await carregarRodada(roundId);
  preencheGrade(minhaGrade, dados.holes, meId);

  render();

  pollTimer = setInterval(async () => {
    if (!location.hash.includes("/rodada/" + roundId)) { clearInterval(pollTimer); pollTimer = null; return; }
    try { dados = await carregarRodada(roundId); atualizarPlacar(); atualizarOutros(); atualizarMatches(); }
    catch (e) { console.error(e); }
  }, 10000);

  // -------- render principal (uma vez) --------
  function render() {
    const souParticipante = dados.participants.some(p => p.player_id === meId);
    app.innerHTML = `
      <section class="hero hero-row">
        <div><h1>Rodada ao vivo</h1><p class="hero-sub">${fmtData(dados.round.data)} · par ${PAR_TOTAL}</p></div>
        <a href="#/rodadas" class="btn btn-ghost btn-sm">← rodadas</a>
      </section>

      <div class="card-box">
        <div class="card-head"><span>Placar</span><span class="ao-vivo">● ao vivo</span></div>
        <div id="placar"></div>
      </div>

      <div id="meu-bloco">${blocoMeu(souParticipante)}</div>

      <div class="card-box">
        <div class="card-head"><span>Outros jogadores</span></div>
        <div id="outros"></div>
      </div>

      <div class="card-box">
        <div class="card-head"><span>Match Play</span></div>
        <div id="matches"></div>
      </div>`;
    atualizarPlacar();
    atualizarOutros();
    atualizarMatches();
    if (souParticipante) { updateMeuTotais(); ligarGrade(); }
    ligarBotoes();
  }

  function blocoMeu(souParticipante) {
    if (!meId) return `<div class="card-box"><div class="vazio">Modo visitante — você está só acompanhando.</div></div>`;
    if (!souParticipante)
      return `<div class="card-box entrar-box">
        <p>Você ainda não entrou nesta rodada.</p>
        <button class="btn btn-primary" id="btn-entrar">Entrar na rodada</button></div>`;
    return `<div class="card-box">
      <div class="card-head"><span>Seu placar — ${esc(me.nome)}</span><a href="#" id="sair-rodada" class="link-del">sair</a></div>
      <div class="totais" id="meu-totais"></div>
      ${gradeHtml(minhaGrade)}</div>`;
  }

  // -------- placar (leaderboard) --------
  function atualizarPlacar() {
    const el = app.querySelector("#placar"); if (!el) return;
    const linhas = dados.participants.map(p => ({ p, ...statsJogador(p) }))
      .sort((a, b) => (a.thru === 0) - (b.thru === 0) || a.vs - b.vs || (a.score - b.score));
    if (!linhas.length) { el.innerHTML = `<div class="vazio">Ninguém entrou na rodada ainda.</div>`; return; }
    el.innerHTML = `<ol class="ranking-mini">${linhas.map((l, i) => `
      <li><a href="#/jogador/${l.p.player_id}">
        <span class="rk-pos ${i === 0 && l.thru ? "top" : ""}">${i + 1}</span>
        ${avatar(playerById(l.p.player_id), 30)}
        <span class="rk-nome">${esc(nomeJogador(players, l.p.player_id))} ${l.p.player_id === meId ? '<small class="voce">(você)</small>' : ""}</span>
        <span class="rk-pts">${l.thru ? `${l.vs > 0 ? "+" : ""}${l.vs} <small>${l.score} · ${l.thru}b</small>` : "—"}</span>
      </a></li>`).join("")}</ol>`;
  }

  // -------- outros jogadores (strip de score read-only) --------
  function atualizarOutros() {
    const el = app.querySelector("#outros"); if (!el) return;
    const outros = dados.participants.filter(p => p.player_id !== meId);
    if (!outros.length) { el.innerHTML = `<div class="vazio">Sem outros jogadores ainda.</div>`; return; }
    el.innerHTML = outros.map(p => {
      const st = statsJogador(p);
      return `<div class="outro">
        <div class="outro-head">${avatar(playerById(p.player_id), 26)}<b>${esc(nomeJogador(players, p.player_id))}</b>
          <span class="outro-tot">${st.thru ? `${st.score} (${st.vs > 0 ? "+" : ""}${st.vs}) · ${st.thru} buracos` : "ainda não começou"}</span></div>
        ${st.thru ? stripScore(st.byHole) : ""}</div>`;
    }).join("");
  }

  // -------- match play --------
  function atualizarMatches() {
    const el = app.querySelector("#matches"); if (!el) return;
    const ind = dados.indMatches || [], dup = dados.teamMatches || [];
    el.innerHTML = `
      ${ind.length ? `<div class="mini-titulo">Individual</div><ul class="lista-confrontos">${ind.map(m => `
        <li><span class="${m.resultado === "A" ? "venceu" : ""}">${esc(nomeJogador(players, m.player_a))}</span>
          <span class="vs">${m.resultado === "EMPATE" ? "=" : "×"}</span>
          <span class="${m.resultado === "B" ? "venceu" : ""}">${esc(nomeJogador(players, m.player_b))}</span>
          ${meId ? `<a href="#" class="rm-match" data-tipo="ind" data-id="${m.id}">✕</a>` : ""}</li>`).join("")}</ul>` : ""}
      ${dup.length ? `<div class="mini-titulo">Duplas</div><ul class="lista-confrontos">${dup.map(m => `
        <li><span class="${m.resultado === "T1" ? "venceu" : ""}">${esc(nomeJogador(players, m.t1_p1))}+${esc(nomeJogador(players, m.t1_p2))}</span>
          <span class="vs">${m.resultado === "EMPATE" ? "=" : "×"}</span>
          <span class="${m.resultado === "T2" ? "venceu" : ""}">${esc(nomeJogador(players, m.t2_p1))}+${esc(nomeJogador(players, m.t2_p2))}</span>
          ${meId ? `<a href="#" class="rm-match" data-tipo="dup" data-id="${m.id}">✕</a>` : ""}</li>`).join("")}</ul>` : ""}
      ${!meId ? "" : `<div class="match-add">
        <button type="button" class="btn btn-ghost btn-sm" id="add-ind">+ individual</button>
        <button type="button" class="btn btn-ghost btn-sm" id="add-dup">+ duplas</button>
      </div>`}`;
    el.querySelectorAll(".rm-match").forEach(a => a.onclick = async (e) => {
      e.preventDefault();
      try { (a.dataset.tipo === "ind" ? await excluirMatchInd(a.dataset.id) : await excluirMatchDupla(a.dataset.id)); dados = await carregarRodada(roundId); atualizarMatches(); }
      catch (err) { toast(err.message || "Erro", "erro"); }
    });
    const ai = el.querySelector("#add-ind"); if (ai) ai.onclick = () => formMatch("ind");
    const ad = el.querySelector("#add-dup"); if (ad) ad.onclick = () => formMatch("dup");
  }

  function formMatch(tipo) {
    const opts = players.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join("");
    const el = app.querySelector("#matches");
    const box = document.createElement("div");
    box.className = "match-form";
    if (tipo === "ind") {
      box.innerHTML = `<select class="f-a">${opts}</select>
        <select class="f-res"><option value="A">venceu</option><option value="EMPATE">empate</option><option value="B">perdeu</option></select>
        <select class="f-b">${opts}</select>
        <button type="button" class="btn btn-primary btn-sm f-ok">salvar</button>`;
    } else {
      box.innerHTML = `<div class="dupla"><select class="f-a">${opts}</select>+<select class="f-b">${opts}</select></div>
        <select class="f-res"><option value="T1">dupla 1</option><option value="EMPATE">empate</option><option value="T2">dupla 2</option></select>
        <div class="dupla"><select class="f-c">${opts}</select>+<select class="f-d">${opts}</select></div>
        <button type="button" class="btn btn-primary btn-sm f-ok">salvar</button>`;
    }
    el.appendChild(box);
    box.querySelector(".f-ok").onclick = async () => {
      try {
        if (tipo === "ind") {
          const a = box.querySelector(".f-a").value, b = box.querySelector(".f-b").value, res = box.querySelector(".f-res").value;
          if (a === b) return toast("Escolha jogadores diferentes", "erro");
          await salvarMatchInd(roundId, { player_a: a, player_b: b, resultado: res });
        } else {
          const m = { t1_p1: box.querySelector(".f-a").value, t1_p2: box.querySelector(".f-b").value, t2_p1: box.querySelector(".f-c").value, t2_p2: box.querySelector(".f-d").value, resultado: box.querySelector(".f-res").value };
          await salvarMatchDupla(roundId, m);
        }
        dados = await carregarRodada(roundId); atualizarMatches();
      } catch (err) { toast(err.message || "Erro", "erro"); }
    };
  }

  // -------- minha grade: autosave --------
  function ligarGrade() {
    const card = app.querySelector("#meu-bloco");
    card.addEventListener("input", async (e) => {
      if (!e.target.classList.contains("grade-in")) return;
      const b = +e.target.dataset.b, campo = e.target.dataset.campo;
      minhaGrade[b - 1][campo] = e.target.value;
      if (campo === "score") {
        e.target.classList.remove("sc-eagle", "sc-birdie", "sc-par", "sc-bogey", "sc-double");
        const c = classeScore(e.target.value, PAR_BURACOS[b - 1]); if (c) e.target.classList.add(c);
      }
      updateMeuTotais();
    });
    card.addEventListener("change", (e) => { if (e.target.classList.contains("grade-in")) salvar(+e.target.dataset.b); });
    card.addEventListener("click", (e) => {
      const btn = e.target.closest(".tog"); if (!btn) return;
      const b = +btn.dataset.b, campo = btn.dataset.campo, cur = !!minhaGrade[b - 1][campo];
      minhaGrade[b - 1][campo] = !cur;
      btn.classList.toggle("on", !cur); btn.classList.toggle("off", cur); btn.textContent = !cur ? "✓" : "✗";
      updateMeuTotais(); salvar(b);
    });
  }
  async function salvar(b) {
    try {
      await salvarBuraco(roundId, meId, b, minhaGrade[b - 1]);
      dados = await carregarRodada(roundId); atualizarPlacar(); atualizarOutros();
    } catch (err) { console.error(err); toast(err.message || "Erro ao salvar", "erro"); }
  }
  function updateMeuTotais() {
    const el = app.querySelector("#meu-totais"); if (!el) return;
    const t = computeTotais(minhaGrade);
    const vs = t.buracos ? ` <small>(${t.vs > 0 ? "+" : ""}${t.vs} vs par)</small>` : "";
    el.innerHTML = `<span>Score <b>${t.score}</b>${vs}</span><span>Putts <b>${t.putts}</b></span><span>Bunker <b>${t.bunker}</b></span><span>GIR <b>${t.gir}</b>/18</span><span>FIR <b>${t.fir}</b>/${N_FAIRWAYS}</span>`;
  }

  // -------- botões entrar/sair --------
  function ligarBotoes() {
    const be = app.querySelector("#btn-entrar");
    if (be) be.onclick = async () => {
      be.disabled = true; be.textContent = "Entrando...";
      try { await entrarNaRodada(roundId, meId); dados = await carregarRodada(roundId); render(); }
      catch (err) { toast(err.message || "Erro", "erro"); be.disabled = false; be.textContent = "Entrar na rodada"; }
    };
    const bs = app.querySelector("#sair-rodada");
    if (bs) bs.onclick = async (e) => {
      e.preventDefault();
      if (!confirm("Sair da rodada apaga o seu placar dela. Continuar?")) return;
      try { await sairDaRodada(roundId, meId); for (const g of minhaGrade) Object.assign(g, { score: "", putts: "", bunker: "", gir: false, fir: false }); dados = await carregarRodada(roundId); render(); }
      catch (err) { toast(err.message || "Erro", "erro"); }
    };
  }

  // -------- helpers locais --------
  function playerById(id) { return players.find(p => p.id === id); }
  function statsJogador(p) {
    const meus = (dados.holes || []).filter(h => h.player_id === p.player_id);
    const byHole = Array.from({ length: NB }, (_, i) => meus.find(h => h.buraco === i + 1)?.strokes ?? null);
    let score = 0, parPlayed = 0, thru = 0;
    byHole.forEach((s, i) => { if (s != null) { score += s; parPlayed += PAR_BURACOS[i]; thru++; } });
    if (!thru && p.gross_score != null) { score = p.gross_score; } // demo/legado
    return { score, vs: thru ? score - parPlayed : 0, thru, byHole };
  }
}

// -------- HTML da grade editável --------
function gradeHtml(holes) {
  const cols = Array.from({ length: NB }, (_, i) => i + 1);
  const scoreRow = `<tr><th class="grade-lbl">Score</th>${cols.map(n => {
    const v = holes[n - 1]?.score;
    return `<td><input type="number" inputmode="numeric" class="grade-in ${classeScore(v, PAR_BURACOS[n - 1])}" data-b="${n}" data-campo="score" value="${val(v)}"></td>`;
  }).join("")}</tr>`;
  const numRow = (campo, label) => `<tr><th class="grade-lbl">${label}</th>${cols.map(n =>
    `<td><input type="number" inputmode="numeric" class="grade-in" data-b="${n}" data-campo="${campo}" value="${val(holes[n - 1]?.[campo])}"></td>`).join("")}</tr>`;
  const togRow = (campo, label) => `<tr><th class="grade-lbl">${label}</th>${cols.map(n => {
    const on = !!holes[n - 1]?.[campo];
    return `<td><button type="button" class="tog ${on ? "on" : "off"}" data-b="${n}" data-campo="${campo}">${on ? "✓" : "✗"}</button></td>`;
  }).join("")}</tr>`;
  // FIR: par 3 não tem fairway -> célula travada
  const firRow = `<tr><th class="grade-lbl">FIR</th>${cols.map(n => {
    if (PAR_BURACOS[n - 1] === 3) return `<td class="fir-na">—</td>`;
    const on = !!holes[n - 1]?.fir;
    return `<td><button type="button" class="tog ${on ? "on" : "off"}" data-b="${n}" data-campo="fir">${on ? "✓" : "✗"}</button></td>`;
  }).join("")}</tr>`;
  return `<div class="grade-wrap"><table class="grade">
    <thead><tr><th class="grade-lbl">Buraco</th>${cols.map(n => `<th>${n}</th>`).join("")}</tr></thead>
    <tbody>
      <tr class="par-row"><th class="grade-lbl">Par</th>${cols.map(n => `<td class="par-cell">${PAR_BURACOS[n - 1]}</td>`).join("")}</tr>
      ${scoreRow}${numRow("putts", "Putts")}${numRow("bunker", "Bunker")}${togRow("gir", "GIR")}${firRow}
    </tbody></table></div>`;
}

function stripScore(byHole) {
  const cols = Array.from({ length: NB }, (_, i) => i + 1);
  return `<div class="grade-wrap"><table class="grade strip">
    <thead><tr><th class="grade-lbl">Buraco</th>${cols.map(n => `<th>${n}</th>`).join("")}</tr></thead>
    <tbody>
      <tr class="par-row"><th class="grade-lbl">Par</th>${cols.map(n => `<td class="par-cell">${PAR_BURACOS[n - 1]}</td>`).join("")}</tr>
      <tr><th class="grade-lbl">Score</th>${cols.map(n => { const s = byHole[n - 1]; return `<td class="strip-cell ${classeScore(s, PAR_BURACOS[n - 1])}">${s ?? ""}</td>`; }).join("")}</tr>
    </tbody></table></div>`;
}

function computeTotais(holes) {
  let score = 0, putts = 0, bunker = 0, gir = 0, fir = 0, buracos = 0, parPlayed = 0;
  holes.forEach((hb, i) => {
    const s = +hb.score; if (hb.score !== "" && !isNaN(s)) { score += s; buracos++; parPlayed += PAR_BURACOS[i] || 0; }
    const p = +hb.putts; if (hb.putts !== "" && !isNaN(p)) putts += p;
    const b = +hb.bunker; if (hb.bunker !== "" && !isNaN(b)) bunker += b;
    if (hb.gir) gir++; if (hb.fir) fir++;
  });
  return { score, putts, bunker, gir, fir, buracos, vs: score - parPlayed };
}

function preencheGrade(grade, holes, meId) {
  for (const h of holes || []) {
    if (h.player_id !== meId) continue;
    grade[h.buraco - 1] = { score: h.strokes ?? "", putts: h.putts ?? "", bunker: h.bunker ?? "", gir: !!h.gir, fir: !!h.fairway_hit };
  }
}
const val = (v) => (v == null ? "" : v);
