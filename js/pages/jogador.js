import { carregarTemporada } from "../db.js";
import { agregarTemporada, montarRankings } from "../scoring.js";
import { esc, fmt, fmtInt, fmtData, avatar, card, nomeJogador, loading, anoAtual } from "../ui.js";

export default async function renderJogador(app, params) {
  const id = params[0];
  app.innerHTML = loading();
  const dados = await carregarTemporada(anoAtual());
  const stats = agregarTemporada(dados);
  const rk = montarRankings(stats, dados.rounds.length);
  const s = stats.get(id);
  const players = dados.players;

  if (!s) { app.innerHTML = `<div class="vazio">Jogador não encontrado.</div>`; return; }

  const posMedia = rk.porMedia.findIndex(x => x.player.id === id);
  const posTotal = rk.porTotal.findIndex(x => x.player.id === id);
  const grupoScore = mediaGrupo(stats, "scoreMedio");

  // histórico ordenado por data asc para o gráfico
  const hist = [...s.historico].filter(x => x.gross != null)
    .sort((a, b) => a.round.data.localeCompare(b.round.data));

  app.innerHTML = `
    <section class="perfil-head">
      ${avatar(s.player, 72)}
      <div>
        <h1>${esc(s.player.nome)}</h1>
        <p class="hero-sub">${s.player.handicap != null ? `HCP ${s.player.handicap} · ` : ""}${s.rodadas} rodada(s) em ${anoAtual()}</p>
        <p class="hero-sub">${posMedia >= 0 ? `🏅 ${posMedia + 1}º no ranking oficial` : "Ainda não qualificado no ranking por média"}${posTotal >= 0 ? ` · ${posTotal + 1}º em pontos totais` : ""}</p>
      </div>
    </section>

    <div class="grid-stats">
      ${card("Pontos totais", fmtInt(s.pontosTotal))}
      ${card("Pts / rodada", fmt(s.mediaPontos))}
      ${card("Vit. Stroke", fmtInt(s.strokeVitorias))}
      ${card("Top 3", fmtInt(s.top3))}
    </div>

    <div class="card-box">
      <div class="card-head"><span>Stroke Play</span></div>
      <div class="grid-stats">
        ${card("Score médio", fmt(s.scoreMedio), grupoScore != null ? `grupo: ${fmt(grupoScore)}` : "")}
        ${card("Melhor", fmtInt(s.melhorScore))}
        ${card("Pior", fmtInt(s.piorScore))}
        ${card("Coloc. média", fmt(s.colocacaoMedia))}
      </div>
      ${hist.length > 1 ? `<div class="grafico-titulo">Evolução do score</div>${lineChart(hist)}` : ""}
    </div>

    <div class="card-box">
      <div class="card-head"><span>Match Play</span></div>
      <div class="grid-stats">
        ${card("Indiv. V-E-D", `${s.indV}-${s.indE}-${s.indD}`, `aprov. ${fmt(s.indAprov)}%`)}
        ${card("Duplas V-E-D", `${s.dupV}-${s.dupE}-${s.dupD}`, `aprov. ${fmt(s.dupAprov)}%`)}
        ${s.melhorParceiro ? card("Melhor parceiro", esc(nomeJogador(players, s.melhorParceiro.id)), `${fmt(s.melhorParceiro.aprov)}% em ${s.melhorParceiro.jogos} jogos`) : card("Melhor parceiro", "—")}
      </div>
    </div>

    <div class="card-box">
      <div class="card-head"><span>Estatísticas técnicas (médias)</span></div>
      <div class="grid-stats">
        ${card("Putts / rodada", fmt(s.puttsMedio))}
        ${card("GIR", s.girMedio != null ? fmt(s.girMedio) + "%" : "—")}
        ${card("Fairways", s.fairwayMedio != null ? fmt(s.fairwayMedio) + "%" : "—")}
      </div>
    </div>

    ${s.buracosJogados ? `<div class="card-box">
      <div class="card-head"><span>Por buraco (${s.buracosJogados} buracos)</span></div>
      <div class="grid-stats">
        ${card("Eagles", fmtInt(s.eagles))}
        ${card("Birdies", fmtInt(s.birdies))}
        ${card("Pars", fmtInt(s.parsFeitos))}
        ${card("Bogeys", fmtInt(s.bogeys))}
        ${card("Doubles +", fmtInt(s.doubles))}
        ${card("Score vs par", (s.scoreVsPar > 0 ? "+" : "") + s.scoreVsPar, "acumulado no ano")}
      </div>
    </div>` : ""}

    ${s.h2h.size ? `<div class="card-box">
      <div class="card-head"><span>Head-to-head (Match individual)</span></div>
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Adversário</th><th>V</th><th>E</th><th>D</th></tr></thead>
      <tbody>${[...s.h2h.entries()].map(([adv, r]) => `<tr><td class="td-nome">${esc(nomeJogador(players, adv))}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td></tr>`).join("")}</tbody>
      </table></div></div>` : ""}

    <div class="card-box">
      <div class="card-head"><span>Histórico de rodadas</span></div>
      ${hist.length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Score</th><th>Coloc.</th><th>Pts</th></tr></thead>
      <tbody>${[...s.historico].sort((a, b) => b.round.data.localeCompare(a.round.data)).map(x => `<tr>
        <td>${fmtData(x.round.data)}</td><td>${fmtInt(x.gross)}</td><td>${x.posicao ? x.posicao + "º" : "—"}</td><td>${x.pontosStroke}</td>
      </tr>`).join("")}</tbody></table></div>` : `<div class="vazio">Sem rodadas.</div>`}
    </div>`;
}

function mediaGrupo(stats, campo) {
  const vals = [...stats.values()].map(s => s[campo]).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// Gráfico de linha simples em SVG (score: menor é melhor -> eixo invertido)
function lineChart(hist) {
  const W = 320, H = 120, pad = 24;
  const ys = hist.map(x => x.gross);
  const min = Math.min(...ys), max = Math.max(...ys);
  const range = max - min || 1;
  const px = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, hist.length - 1);
  const py = (v) => pad + ((v - min) / range) * (H - 2 * pad); // menor score = mais alto
  const pts = hist.map((x, i) => `${px(i).toFixed(1)},${py(x.gross).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="xMidYMid meet">
    <polyline fill="none" stroke="var(--verde)" stroke-width="2" points="${pts}"/>
    ${hist.map((x, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(x.gross).toFixed(1)}" r="3" fill="var(--verde-escuro)"/>`).join("")}
    <text x="${pad}" y="14" class="chart-lbl">melhor ${min}</text>
    <text x="${W - pad}" y="${H - 6}" class="chart-lbl" text-anchor="end">pior ${max}</text>
  </svg>`;
}
