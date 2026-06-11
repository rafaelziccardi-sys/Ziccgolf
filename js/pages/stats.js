import { carregarTemporada } from "../db.js";
import { agregarTemporada } from "../scoring.js";
import { exportarExcel } from "../export.js";
import { esc, fmt, fmtInt, nomeJogador, card, toast, loading, anoAtual } from "../ui.js";

export default async function renderStats(app) {
  app.innerHTML = loading();
  const dados = await carregarTemporada(anoAtual());
  const { players, indMatches, teamMatches } = dados;
  const stats = agregarTemporada(dados);
  const arr = [...stats.values()].filter(s => s.rodadas > 0);
  const nome = (id) => nomeJogador(players, id);

  if (!arr.length) {
    app.innerHTML = `<section class="hero"><h1>Estatísticas do grupo</h1></section><div class="vazio">Sem dados ainda.</div>`;
    return;
  }

  const top = (sel, fn, filtro = () => true) => {
    const c = arr.filter(filtro);
    if (!c.length) return null;
    return [...c].sort((a, b) => fn(b) - fn(a))[0];
  };
  const bottom = (fn, filtro = () => true) => {
    const c = arr.filter(filtro);
    if (!c.length) return null;
    return [...c].sort((a, b) => fn(a) - fn(b))[0];
  };

  const maisVitStroke = top(null, s => s.strokeVitorias);
  const melhorMedia = bottom(s => s.scoreMedio, s => s.scoreMedio != null);
  const melhorInd = top(null, s => s.indAprov, s => s.indJogos >= 1);
  const melhorDup = top(null, s => s.dupAprov, s => s.dupJogos >= 1);
  const melhorScoreJog = bottom(s => s.melhorScore, s => s.melhorScore != null);
  const maisConsistente = consistente(arr);
  const maiorEvolucao = evolucao(arr);

  // Duplas mais vencedoras e melhor parceria (a partir dos team_matches)
  const duplas = mapaDuplas(teamMatches);
  const duplaMaisVit = [...duplas.values()].sort((a, b) => b.v - a.v)[0];
  const melhorParceria = [...duplas.values()].filter(d => (d.v + d.e + d.d) >= 2)
    .sort((a, b) => aprov(b) - aprov(a))[0];

  // Maior rivalidade (confronto individual mais frequente)
  const rivalidade = maisFrequente(indMatches);

  // Médias do grupo
  const gScore = mediaArr(arr.map(s => s.scoreMedio));
  const gPutts = mediaArr(arr.map(s => s.puttsMedio));
  const gGir = mediaArr(arr.map(s => s.girMedio));
  const gFw = mediaArr(arr.map(s => s.fairwayMedio));

  app.innerHTML = `
    <section class="hero hero-row">
      <div><h1>Estatísticas do grupo</h1><p class="hero-sub">Temporada ${anoAtual()}</p></div>
      <button id="btn-export" class="btn btn-ghost btn-sm">⬇️ Excel</button>
    </section>

    <div class="card-box"><div class="card-head"><span>Destaques</span></div>
    <div class="grid-destaques">
      ${destaque("🏆 Mais vitórias (Stroke)", maisVitStroke && maisVitStroke.strokeVitorias ? `${esc(maisVitStroke.player.nome)} · ${maisVitStroke.strokeVitorias}` : "—")}
      ${destaque("🎯 Melhor média de score", melhorMedia ? `${esc(melhorMedia.player.nome)} · ${fmt(melhorMedia.scoreMedio)}` : "—")}
      ${destaque("⚔️ Melhor no Match indiv.", melhorInd ? `${esc(melhorInd.player.nome)} · ${fmt(melhorInd.indAprov)}%` : "—")}
      ${destaque("👥 Melhor em duplas", melhorDup ? `${esc(melhorDup.player.nome)} · ${fmt(melhorDup.dupAprov)}%` : "—")}
      ${destaque("⭐ Melhor score do ano", melhorScoreJog ? `${esc(melhorScoreJog.player.nome)} · ${fmtInt(melhorScoreJog.melhorScore)}` : "—")}
      ${destaque("📊 Mais consistente", maisConsistente ? `${esc(maisConsistente.player.nome)}` : "—")}
      ${destaque("📈 Maior evolução", maiorEvolucao ? `${esc(maiorEvolucao.player.nome)} · ${fmt(maiorEvolucao.delta)} tac.` : "—")}
      ${destaque("🤝 Dupla mais vencedora", duplaMaisVit && duplaMaisVit.v ? `${esc(nome(duplaMaisVit.a))} + ${esc(nome(duplaMaisVit.b))} · ${duplaMaisVit.v}V` : "—")}
      ${destaque("💚 Melhor parceria", melhorParceria ? `${esc(nome(melhorParceria.a))} + ${esc(nome(melhorParceria.b))} · ${fmt(aprov(melhorParceria))}%` : "—")}
      ${destaque("🔥 Maior rivalidade", rivalidade ? `${esc(nome(rivalidade.a))} × ${esc(nome(rivalidade.b))} · ${rivalidade.n}x` : "—")}
    </div></div>

    <div class="card-box"><div class="card-head"><span>Médias do grupo</span></div>
    <div class="grid-stats">
      ${card("Score médio", fmt(gScore))}
      ${card("Putts / rodada", fmt(gPutts))}
      ${card("GIR", gGir != null ? fmt(gGir) + "%" : "—")}
      ${card("Fairways", gFw != null ? fmt(gFw) + "%" : "—")}
    </div></div>`;

  app.querySelector("#btn-export").onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = "Gerando...";
    try { exportarExcel({ dados, stats, ano: anoAtual() }); toast("Excel gerado!"); }
    catch (err) { console.error(err); toast(err.message || "Erro ao gerar Excel", "erro"); }
    finally { btn.disabled = false; btn.textContent = "⬇️ Excel"; }
  };
}

const destaque = (t, v) => `<div class="destaque-item"><div class="dq-label">${t}</div><div class="dq-valor">${v}</div></div>`;
const aprov = (d) => { const j = d.v + d.e + d.d; return j ? 100 * (d.v + d.e * 0.5) / j : 0; };
function mediaArr(a) { const v = a.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }

function consistente(arr) {
  let best = null;
  for (const s of arr) {
    if (s.scores.length < 3) continue;
    const m = s.scores.reduce((a, b) => a + b, 0) / s.scores.length;
    const sd = Math.sqrt(s.scores.reduce((a, b) => a + (b - m) ** 2, 0) / s.scores.length);
    if (!best || sd < best.sd) best = { player: s.player, sd };
  }
  return best;
}

function evolucao(arr) {
  let best = null;
  for (const s of arr) {
    const h = [...s.historico].filter(x => x.gross != null).sort((a, b) => a.round.data.localeCompare(b.round.data));
    if (h.length < 4) continue;
    const meio = Math.floor(h.length / 2);
    const ini = h.slice(0, meio), fim = h.slice(meio);
    const mIni = ini.reduce((a, b) => a + b.gross, 0) / ini.length;
    const mFim = fim.reduce((a, b) => a + b.gross, 0) / fim.length;
    const delta = mIni - mFim; // positivo = melhorou (score caiu)
    if (delta > 0 && (!best || delta > best.delta)) best = { player: s.player, delta };
  }
  return best;
}

function chave(a, b) { return [a, b].sort().join("|"); }
function mapaDuplas(teamMatches) {
  const m = new Map();
  const add = (p1, p2, venceu, empate) => {
    const k = chave(p1, p2);
    if (!m.has(k)) { const [a, b] = [p1, p2].sort(); m.set(k, { a, b, v: 0, e: 0, d: 0 }); }
    const d = m.get(k);
    if (empate) d.e++; else if (venceu) d.v++; else d.d++;
  };
  for (const t of teamMatches) {
    add(t.t1_p1, t.t1_p2, t.resultado === "T1", t.resultado === "EMPATE");
    add(t.t2_p1, t.t2_p2, t.resultado === "T2", t.resultado === "EMPATE");
  }
  return m;
}
function maisFrequente(indMatches) {
  const m = new Map();
  for (const x of indMatches) {
    const k = chave(x.player_a, x.player_b);
    if (!m.has(k)) { const [a, b] = [x.player_a, x.player_b].sort(); m.set(k, { a, b, n: 0 }); }
    m.get(k).n++;
  }
  return [...m.values()].sort((a, b) => b.n - a.n)[0] || null;
}
