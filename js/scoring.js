// =============================================================
//  MOTOR DE PONTUAÇÃO E RANKINGS  (funções puras, sem dependências)
//  Recebe os dados crus do banco e devolve colocações, pontos e rankings.
// =============================================================
import { PONTOS, QUALIFICACAO_PCT, QUALIFICACAO_MIN, PAR_BURACOS, RANKING_INCLUI_MATCH } from "./config.js";

// ---- Colocação de Stroke Play (menor score = melhor; empates dividem posição) ----
// participantes: [{player_id, gross_score}]  ->  Map player_id -> posicao
export function calcularColocacoes(participantes) {
  const validos = participantes.filter(p => p.gross_score != null);
  const ordenados = [...validos].sort((a, b) => a.gross_score - b.gross_score);
  const pos = new Map();
  let posicaoAtual = 0, anterior = null, contados = 0;
  for (const p of ordenados) {
    contados++;
    if (anterior === null || p.gross_score !== anterior) {
      posicaoAtual = contados;          // ranking de competição padrão: 1,2,2,4
      anterior = p.gross_score;
    }
    pos.set(p.player_id, posicaoAtual);
  }
  return pos;
}

// ---- Pontos de Stroke Play a partir da posição ----
export function pontosStroke(posicao) {
  if (posicao == null) return 0;
  return PONTOS.stroke[posicao - 1] ?? PONTOS.strokeDemais;
}

// ---- Pontos de Match Play individual para UM jogador num confronto ----
// resultado: 'A' | 'B' | 'EMPATE' ; lado: 'A' | 'B'
export function pontosMatchInd(resultado, lado) {
  if (resultado === "EMPATE") return PONTOS.matchInd.empate;
  return resultado === lado ? PONTOS.matchInd.vitoria : PONTOS.matchInd.derrota;
}

// ---- Pontos de Match Play de duplas para UM jogador ----
// resultado: 'T1' | 'T2' | 'EMPATE' ; lado: 'T1' | 'T2'
export function pontosMatchDupla(resultado, lado) {
  if (resultado === "EMPATE") return PONTOS.matchDupla.empate;
  return resultado === lado ? PONTOS.matchDupla.vitoria : PONTOS.matchDupla.derrota;
}

// =============================================================
//  AGREGAÇÃO ANUAL
//  Entrada: arrays do banco. Saída: 1 objeto de stats por jogador.
// =============================================================
export function agregarTemporada({ players, rounds, participants, indMatches, teamMatches, holes }) {
  const stats = new Map();
  const novo = (p) => ({
    player: p,
    rodadas: 0,
    pontosTotal: 0,
    pontosStroke: 0, pontosInd: 0, pontosDupla: 0,
    // stroke
    scores: [], posicoes: [],
    strokeVitorias: 0, top3: 0,
    // match individual
    indV: 0, indE: 0, indD: 0,
    // match duplas
    dupV: 0, dupE: 0, dupD: 0,
    // técnicas
    putts: [], girPct: [], fairwayPct: [],
    // por buraco (modo detalhado)
    eagles: 0, birdies: 0, parsFeitos: 0, bogeys: 0, doubles: 0,
    buracosJogados: 0, scoreVsPar: 0,
    // relações
    h2h: new Map(),        // adversário_id -> {v,e,d}
    parceiros: new Map(),  // parceiro_id -> {v,e,d}
    historico: [],         // por rodada
  });
  for (const p of players) stats.set(p.id, novo(p));

  const roundsById = new Map(rounds.map(r => [r.id, r]));
  const partsByRound = groupBy(participants, "round_id");

  // ---- Stroke Play por rodada ----
  for (const r of rounds) {
    const parts = partsByRound.get(r.id) || [];
    const pos = calcularColocacoes(parts);
    for (const part of parts) {
      const s = stats.get(part.player_id);
      if (!s) continue;
      s.rodadas++;
      const posicao = pos.get(part.player_id) ?? null;
      const ps = posicao ? pontosStroke(posicao) : 0;
      s.pontosStroke += ps;
      if (posicao === 1) s.strokeVitorias++;
      if (posicao && posicao <= 3) s.top3++;
      if (part.gross_score != null) { s.scores.push(part.gross_score); s.posicoes.push(posicao); }
      if (part.putts != null) s.putts.push(part.putts);
      if (part.gir != null && part.gir_tot) s.girPct.push(100 * part.gir / part.gir_tot);
      if (part.fairways_hit != null && part.fairways_tot) s.fairwayPct.push(100 * part.fairways_hit / part.fairways_tot);
      s.historico.push({ round: r, gross: part.gross_score, posicao, pontosStroke: ps });
    }
  }

  // ---- Match Play individual ----
  for (const m of indMatches) {
    const a = stats.get(m.player_a), b = stats.get(m.player_b);
    const pa = pontosMatchInd(m.resultado, "A");
    const pb = pontosMatchInd(m.resultado, "B");
    if (a) { a.pontosInd += pa; tallyInd(a, m.resultado === "A", m.resultado === "EMPATE"); bumpRel(a.h2h, m.player_b, m.resultado, "A"); }
    if (b) { b.pontosInd += pb; tallyInd(b, m.resultado === "B", m.resultado === "EMPATE"); bumpRel(b.h2h, m.player_a, m.resultado, "B"); }
  }

  // ---- Match Play duplas ----
  for (const m of teamMatches) {
    const lados = [
      { jog: [m.t1_p1, m.t1_p2], lado: "T1", parceiroDe: { [m.t1_p1]: m.t1_p2, [m.t1_p2]: m.t1_p1 } },
      { jog: [m.t2_p1, m.t2_p2], lado: "T2", parceiroDe: { [m.t2_p1]: m.t2_p2, [m.t2_p2]: m.t2_p1 } },
    ];
    for (const L of lados) {
      const pts = pontosMatchDupla(m.resultado, L.lado);
      const venceu = m.resultado === L.lado, empate = m.resultado === "EMPATE";
      for (const jid of L.jog) {
        const s = stats.get(jid);
        if (!s) continue;
        s.pontosDupla += pts;
        if (empate) s.dupE++; else if (venceu) s.dupV++; else s.dupD++;
        const parceiro = L.parceiroDe[jid];
        const rel = getRel(s.parceiros, parceiro);
        if (empate) rel.e++; else if (venceu) rel.v++; else rel.d++;
      }
    }
  }

  // ---- Por buraco: birdies/pars/bogeys + score vs par ----
  for (const hb of holes || []) {
    const s = stats.get(hb.player_id);
    if (!s || hb.strokes == null) continue;
    const par = PAR_BURACOS[hb.buraco - 1];
    if (!par) continue;
    const d = hb.strokes - par;
    s.buracosJogados++; s.scoreVsPar += d;
    if (d <= -2) s.eagles++; else if (d === -1) s.birdies++;
    else if (d === 0) s.parsFeitos++; else if (d === 1) s.bogeys++; else s.doubles++;
  }

  // ---- Totais e derivados ----
  for (const s of stats.values()) {
    s.pontosTotal = s.pontosStroke + (RANKING_INCLUI_MATCH ? s.pontosInd + s.pontosDupla : 0);
    s.mediaPontos = s.rodadas ? s.pontosTotal / s.rodadas : 0;
    s.scoreMedio  = media(s.scores);
    s.melhorScore = s.scores.length ? Math.min(...s.scores) : null;
    s.piorScore   = s.scores.length ? Math.max(...s.scores) : null;
    s.colocacaoMedia = media(s.posicoes.filter(x => x != null));
    s.indJogos = s.indV + s.indE + s.indD;
    s.dupJogos = s.dupV + s.dupE + s.dupD;
    s.indAprov = aproveitamento(s.indV, s.indE, s.indJogos);
    s.dupAprov = aproveitamento(s.dupV, s.dupE, s.dupJogos);
    s.puttsMedio = media(s.putts);
    s.girMedio = media(s.girPct);
    s.fairwayMedio = media(s.fairwayPct);
    s.melhorParceiro = melhorParceiro(s.parceiros);
  }
  return stats;
}

// ---- Ranking geral: por média (oficial) e por total ----
export function montarRankings(stats, totalRodadas) {
  const arr = [...stats.values()].filter(s => s.rodadas > 0);
  const minRodadas = Math.max(QUALIFICACAO_MIN, Math.ceil(totalRodadas * QUALIFICACAO_PCT));
  const qualificados = arr.filter(s => s.rodadas >= minRodadas);
  const naoQualificados = arr.filter(s => s.rodadas < minRodadas);

  const porMedia = [...qualificados].sort((a, b) => b.mediaPontos - a.mediaPontos || b.pontosTotal - a.pontosTotal);
  const porTotal = [...arr].sort((a, b) => b.pontosTotal - a.pontosTotal);
  return { porMedia, porTotal, naoQualificados, minRodadas };
}

// =============================================================
//  Helpers
// =============================================================
function groupBy(arr, key) {
  const m = new Map();
  for (const x of arr) { const k = x[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}
function media(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; }
function aproveitamento(v, e, jogos) { return jogos ? 100 * (v + e * 0.5) / jogos : 0; }
function tallyInd(s, venceu, empate) { if (empate) s.indE++; else if (venceu) s.indV++; else s.indD++; }
function getRel(map, id) { if (!map.has(id)) map.set(id, { v: 0, e: 0, d: 0 }); return map.get(id); }
function bumpRel(map, advId, resultado, lado) {
  const r = getRel(map, advId);
  if (resultado === "EMPATE") r.e++; else if (resultado === lado) r.v++; else r.d++;
}
function melhorParceiro(parceiros) {
  let best = null;
  for (const [id, r] of parceiros) {
    const jogos = r.v + r.e + r.d;
    if (jogos < 1) continue;
    const ap = aproveitamento(r.v, r.e, jogos);
    if (!best || ap > best.aprov || (ap === best.aprov && jogos > best.jogos))
      best = { id, aprov: ap, jogos, ...r };
  }
  return best;
}
