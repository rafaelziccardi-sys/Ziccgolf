import { carregarTemporada } from "../db.js";
import { agregarTemporada, montarRankings, calcularColocacoes } from "../scoring.js";
import { h, esc, fmt, fmtData, fmtInt, avatar, nomeJogador, card, loading, anoAtual } from "../ui.js";

export default async function renderHome(app) {
  app.innerHTML = loading();
  const ano = anoAtual();
  const dados = await carregarTemporada(ano);
  const { players, rounds, participants, indMatches, teamMatches } = dados;
  const playersById = new Map(players.map(p => [p.id, p]));
  const stats = agregarTemporada(dados);
  const { porMedia } = montarRankings(stats, rounds.length);

  // Última rodada
  const ultima = rounds[0];
  let blocoUltima = `<div class="vazio">Nenhuma rodada cadastrada ainda. <a href="#/nova-rodada">Cadastrar a primeira →</a></div>`;
  if (ultima) {
    const parts = participants.filter(p => p.round_id === ultima.id);
    const pos = calcularColocacoes(parts);
    const vencedor = parts.find(p => pos.get(p.player_id) === 1);
    const ind = indMatches.filter(m => m.round_id === ultima.id);
    const dup = teamMatches.filter(m => m.round_id === ultima.id);
    blocoUltima = `
      <div class="card-box">
        <div class="card-head"><a href="#/rodada/${ultima.id}">Última rodada · ${fmtData(ultima.data)}</a><a href="#/rodadas">ver todas</a></div>
        ${vencedor ? `<div class="destaque-vencedor">
            ${avatar(playersById.get(vencedor.player_id), 48)}
            <div><div class="dv-label">🏆 Vencedor Stroke Play</div>
            <div class="dv-nome">${esc(nomeJogador(players, vencedor.player_id))}</div>
            <div class="dv-score">${fmtInt(vencedor.gross_score)} tacadas</div></div>
          </div>` : ""}
        ${ind.length ? `<div class="mini-titulo">Match Play individual</div>
          <ul class="lista-confrontos">${ind.map(m => confrontoInd(players, m)).join("")}</ul>` : ""}
        ${dup.length ? `<div class="mini-titulo">Duplas</div>
          <ul class="lista-confrontos">${dup.map(m => confrontoDup(players, m)).join("")}</ul>` : ""}
        ${ultima.observacoes ? `<div class="obs">📝 ${esc(ultima.observacoes)}</div>` : ""}
      </div>`;
  }

  // Destaques do ano
  const arr = [...stats.values()].filter(s => s.rodadas > 0);
  const melhorScore = arr.filter(s => s.melhorScore != null).sort((a, b) => a.melhorScore - b.melhorScore)[0];
  const maisVitStroke = [...arr].sort((a, b) => b.strokeVitorias - a.strokeVitorias)[0];

  app.innerHTML = `
    <section class="hero">
      <h1>${esc("Início")}</h1>
      <p class="hero-sub">Temporada ${ano} · ${rounds.length} rodada(s) · ${players.length} jogadores</p>
    </section>

    <div class="grid-stats">
      ${card("Rodadas no ano", fmtInt(rounds.length))}
      ${melhorScore ? card("Melhor score", fmtInt(melhorScore.melhorScore), esc(melhorScore.player.nome)) : card("Melhor score", "—")}
      ${maisVitStroke && maisVitStroke.strokeVitorias ? card("Mais vitórias", fmtInt(maisVitStroke.strokeVitorias), esc(maisVitStroke.player.nome)) : card("Mais vitórias", "—")}
    </div>

    ${blocoUltima}

    <div class="card-box">
      <div class="card-head"><span>Ranking geral (média de pontos)</span><a href="#/rankings">completo</a></div>
      ${porMedia.length ? `<ol class="ranking-mini">${porMedia.slice(0, 5).map((s, i) => `
        <li><a href="#/jogador/${s.player.id}">
          <span class="rk-pos">${i + 1}</span>
          ${avatar(s.player, 34)}
          <span class="rk-nome">${esc(s.player.nome)}</span>
          <span class="rk-pts">${fmt(s.mediaPontos)} <small>pts/rod</small></span>
        </a></li>`).join("")}</ol>`
        : `<div class="vazio">Sem jogadores qualificados ainda.</div>`}
    </div>`;
}

function confrontoInd(players, m) {
  const a = nomeJogador(players, m.player_a), b = nomeJogador(players, m.player_b);
  const venA = m.resultado === "A", venB = m.resultado === "B", emp = m.resultado === "EMPATE";
  return `<li><span class="${venA ? "venceu" : ""}">${esc(a)}</span>
    <span class="vs">${emp ? "empate" : "×"}</span>
    <span class="${venB ? "venceu" : ""}">${esc(b)}</span>
    ${m.placar ? `<span class="placar">${esc(m.placar)}</span>` : ""}</li>`;
}
function confrontoDup(players, m) {
  const t1 = `${nomeJogador(players, m.t1_p1)} + ${nomeJogador(players, m.t1_p2)}`;
  const t2 = `${nomeJogador(players, m.t2_p1)} + ${nomeJogador(players, m.t2_p2)}`;
  const v1 = m.resultado === "T1", v2 = m.resultado === "T2", emp = m.resultado === "EMPATE";
  return `<li><span class="${v1 ? "venceu" : ""}">${esc(t1)}</span>
    <span class="vs">${emp ? "empate" : "×"}</span>
    <span class="${v2 ? "venceu" : ""}">${esc(t2)}</span></li>`;
}
