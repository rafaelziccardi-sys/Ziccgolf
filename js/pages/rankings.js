import { carregarTemporada } from "../db.js";
import { agregarTemporada, montarRankings } from "../scoring.js";
import { exportarExcel } from "../export.js";
import { esc, fmt, fmtInt, avatar, toast, loading, anoAtual } from "../ui.js";

export default async function renderRankings(app, params) {
  app.innerHTML = loading();
  const ano = anoAtual();
  const dados = await carregarTemporada(ano);
  const stats = agregarTemporada(dados);
  const rk = montarRankings(stats, dados.rounds.length);
  const arr = [...stats.values()].filter(s => s.rodadas > 0);

  const aba = params[0] || "geral";
  app.innerHTML = `
    <section class="hero hero-row">
      <h1>Rankings ${ano}</h1>
      <button id="btn-export" class="btn btn-ghost btn-sm">⬇️ Excel</button>
    </section>
    <div class="tabs">
      ${tab("geral", "Geral", aba)}
      ${tab("stroke", "Stroke Play", aba)}
      ${tab("individual", "Match Indiv.", aba)}
      ${tab("duplas", "Duplas", aba)}
    </div>
    <div id="tab-conteudo"></div>`;

  const c = app.querySelector("#tab-conteudo");
  if (aba === "geral") c.innerHTML = abaGeral(rk);
  else if (aba === "stroke") c.innerHTML = tabela(arr, "stroke");
  else if (aba === "individual") c.innerHTML = tabela(arr, "individual");
  else if (aba === "duplas") c.innerHTML = tabela(arr, "duplas");

  app.querySelector("#btn-export").onclick = async (e) => {
    const btn = e.currentTarget;
    if (!arr.length) return toast("Sem dados para exportar ainda", "erro");
    btn.disabled = true; btn.textContent = "Gerando...";
    try { exportarExcel({ dados, stats, ano }); toast("Excel gerado!"); }
    catch (err) { console.error(err); toast(err.message || "Erro ao gerar Excel", "erro"); }
    finally { btn.disabled = false; btn.textContent = "⬇️ Excel"; }
  };
}

const tab = (id, label, ativa) => `<a class="tab ${ativa === id ? "ativo" : ""}" href="#/rankings/${id}">${label}</a>`;

function abaGeral(rk) {
  return `
    <p class="nota">Ranking oficial por <b>média de pontos/rodada</b> — exige no mínimo <b>${rk.minRodadas}</b> rodada(s) para qualificar.</p>
    <div class="card-box">
      <div class="card-head"><span>Por média de pontos (oficial)</span></div>
      ${rk.porMedia.length ? rankList(rk.porMedia, s => `${fmt(s.mediaPontos)} <small>pts/rod</small>`, true)
        : `<div class="vazio">Ninguém qualificado ainda.</div>`}
      ${rk.naoQualificados.length ? `<div class="sub-lista"><div class="mini-titulo">Ainda não qualificados</div>
        ${rankList(rk.naoQualificados, s => `${s.rodadas} rod.`, false)}</div>` : ""}
    </div>
    <div class="card-box">
      <div class="card-head"><span>Por pontuação total (assíduos)</span></div>
      ${rankList(rk.porTotal, s => `${fmtInt(s.pontosTotal)} <small>pts</small>`, true)}
    </div>`;
}

function rankList(list, valorFn, posicao) {
  return `<ol class="ranking-mini">${list.map((s, i) => `
    <li><a href="#/jogador/${s.player.id}">
      ${posicao ? `<span class="rk-pos ${i < 3 ? "top" : ""}">${i + 1}</span>` : `<span class="rk-pos">·</span>`}
      ${avatar(s.player, 34)}
      <span class="rk-nome">${esc(s.player.nome)}</span>
      <span class="rk-pts">${valorFn(s)}</span>
    </a></li>`).join("")}</ol>`;
}

function tabela(arr, tipo) {
  let cols, rows, sorted;
  if (tipo === "stroke") {
    sorted = [...arr].filter(s => s.scoreMedio != null).sort((a, b) => a.scoreMedio - b.scoreMedio);
    cols = ["Jogador", "Média", "Melhor", "Pior", "Vit.", "Top3", "Col.méd"];
    rows = sorted.map(s => [linkNome(s), fmt(s.scoreMedio), fmtInt(s.melhorScore), fmtInt(s.piorScore), s.strokeVitorias, s.top3, fmt(s.colocacaoMedia)]);
  } else if (tipo === "individual") {
    sorted = [...arr].filter(s => s.indJogos > 0).sort((a, b) => b.indAprov - a.indAprov);
    cols = ["Jogador", "Jogos", "V", "E", "D", "Aprov."];
    rows = sorted.map(s => [linkNome(s), s.indJogos, s.indV, s.indE, s.indD, fmt(s.indAprov) + "%"]);
  } else {
    sorted = [...arr].filter(s => s.dupJogos > 0).sort((a, b) => b.dupAprov - a.dupAprov);
    cols = ["Jogador", "Jogos", "V", "E", "D", "Aprov."];
    rows = sorted.map(s => [linkNome(s), s.dupJogos, s.dupV, s.dupE, s.dupD, fmt(s.dupAprov) + "%"]);
  }
  if (!rows.length) return `<div class="vazio">Sem dados para este ranking ainda.</div>`;
  return `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="td-nome"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

const linkNome = (s) => `<a href="#/jogador/${s.player.id}" class="link-jog">${avatar(s.player, 26)}<span>${esc(s.player.nome)}</span></a>`;
