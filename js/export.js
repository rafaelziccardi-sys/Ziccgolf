// =============================================================
//  Exportação para Excel (.xlsx) — usa SheetJS via CDN.
//  Gera um arquivo com várias abas: rankings + estatísticas.
// =============================================================
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { montarRankings } from "./scoring.js";

const r1 = (n) => (n == null || isNaN(n) ? "" : Math.round(n * 10) / 10);
const r0 = (n) => (n == null || isNaN(n) ? "" : Math.round(n));

// dados = retorno de carregarTemporada ; stats = agregarTemporada(dados)
export function exportarExcel({ dados, stats, ano }) {
  const arr = [...stats.values()].filter(s => s.rodadas > 0);
  const rk = montarRankings(stats, dados.rounds.length);
  const nome = (id) => dados.players.find(p => p.id === id)?.nome ?? "—";
  const wb = XLSX.utils.book_new();

  // ---- Aba 1: Ranking Geral ----
  const geral = [
    ["Pos.", "Jogador", "Rodadas", "Pontos totais", "Pts/rodada", "Qualificado?",
     "Vit. Stroke", "Top 3", "Aprov. Indiv. %", "Aprov. Duplas %"],
  ];
  rk.porTotal.forEach((s, i) => {
    const qualif = s.rodadas >= rk.minRodadas;
    geral.push([i + 1, s.player.nome, s.rodadas, r0(s.pontosTotal), r1(s.mediaPontos),
      qualif ? "Sim" : "Não", s.strokeVitorias, s.top3, r1(s.indAprov), r1(s.dupAprov)]);
  });
  addSheet(wb, geral, `Ranking Geral`);

  // ---- Aba 2: Stroke Play ----
  const stroke = [["Jogador", "Rodadas", "Score médio", "Melhor", "Pior", "Vitórias", "Top 3", "Coloc. média"]];
  [...arr].filter(s => s.scoreMedio != null).sort((a, b) => a.scoreMedio - b.scoreMedio)
    .forEach(s => stroke.push([s.player.nome, s.scores.length, r1(s.scoreMedio), r0(s.melhorScore),
      r0(s.piorScore), s.strokeVitorias, s.top3, r1(s.colocacaoMedia)]));
  addSheet(wb, stroke, "Stroke Play");

  // ---- Aba 3: Match Play Individual ----
  const ind = [["Jogador", "Jogos", "Vitórias", "Empates", "Derrotas", "Aproveitamento %"]];
  [...arr].filter(s => s.indJogos > 0).sort((a, b) => b.indAprov - a.indAprov)
    .forEach(s => ind.push([s.player.nome, s.indJogos, s.indV, s.indE, s.indD, r1(s.indAprov)]));
  addSheet(wb, ind, "Match Individual");

  // ---- Aba 4: Match Play Duplas ----
  const dup = [["Jogador", "Jogos", "Vitórias", "Empates", "Derrotas", "Aproveitamento %", "Melhor parceiro"]];
  [...arr].filter(s => s.dupJogos > 0).sort((a, b) => b.dupAprov - a.dupAprov)
    .forEach(s => dup.push([s.player.nome, s.dupJogos, s.dupV, s.dupE, s.dupD, r1(s.dupAprov),
      s.melhorParceiro ? `${nome(s.melhorParceiro.id)} (${r1(s.melhorParceiro.aprov)}%)` : ""]));
  addSheet(wb, dup, "Match Duplas");

  // ---- Aba 5: Estatísticas por jogador (consolidado) ----
  const stat = [["Jogador", "Handicap", "Rodadas", "Pts totais", "Pts/rodada",
    "Score médio", "Melhor", "Pior", "Putts médio", "GIR %", "Fairways %",
    "Vit. Stroke", "Top 3", "Indiv. V-E-D", "Duplas V-E-D"]];
  [...arr].sort((a, b) => b.pontosTotal - a.pontosTotal).forEach(s => stat.push([
    s.player.nome, s.player.handicap ?? "", s.rodadas, r0(s.pontosTotal), r1(s.mediaPontos),
    r1(s.scoreMedio), r0(s.melhorScore), r0(s.piorScore), r1(s.puttsMedio), r1(s.girMedio), r1(s.fairwayMedio),
    s.strokeVitorias, s.top3, `${s.indV}-${s.indE}-${s.indD}`, `${s.dupV}-${s.dupE}-${s.dupD}`]));
  addSheet(wb, stat, "Estatísticas Jogadores");

  XLSX.writeFile(wb, `golf-club-${ano}.xlsx`);
}

function addSheet(wb, aoa, nome) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = aoa[0].map((_, c) => ({ wch: c === 1 ? 20 : Math.max(8, String(aoa[0][c]).length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31));
}
