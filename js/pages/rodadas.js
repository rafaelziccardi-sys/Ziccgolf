import { carregarTemporada, excluirRodada } from "../db.js";
import { calcularColocacoes } from "../scoring.js";
import { esc, fmtData, fmtInt, nomeJogador, toast, loading, anoAtual } from "../ui.js";

export default async function renderRodadas(app) {
  app.innerHTML = loading();
  const dados = await carregarTemporada(anoAtual());
  const { players, rounds, participants, indMatches, teamMatches } = dados;

  if (!rounds.length) {
    app.innerHTML = `<section class="hero"><h1>Rodadas</h1></section>
      <div class="vazio">Nenhuma rodada ainda. <a href="#/nova-rodada">Cadastrar →</a></div>`;
    return;
  }

  app.innerHTML = `
    <section class="hero"><h1>Rodadas</h1><p class="hero-sub">${rounds.length} no ano</p></section>
    <div id="lista">${rounds.map(r => cardRodada(r, players, participants, indMatches, teamMatches)).join("")}</div>`;

  app.querySelector("#lista").addEventListener("click", async (e) => {
    const id = e.target.dataset.del;
    if (!id) return;
    if (!confirm("Excluir esta rodada? Não dá pra desfazer.")) return;
    try { await excluirRodada(id); toast("Rodada excluída"); renderRodadas(app); }
    catch (err) { toast(err.message || "Erro", "erro"); }
  });
}

function cardRodada(r, players, participants, ind, team) {
  const parts = participants.filter(p => p.round_id === r.id);
  const pos = calcularColocacoes(parts);
  const ordenados = [...parts].sort((a, b) => (pos.get(a.player_id) ?? 99) - (pos.get(b.player_id) ?? 99));
  const nInd = ind.filter(m => m.round_id === r.id).length;
  const nDup = team.filter(m => m.round_id === r.id).length;
  return `<div class="card-box rodada-card">
    <div class="card-head">
      <span>${fmtData(r.data)}</span>
      <span class="rodada-acoes">
        <a href="#/rodada/${r.id}">abrir</a>
        <a href="#" data-del="${r.id}" class="link-del">excluir</a>
      </span>
    </div>
    <table class="tabela tabela-rodada"><tbody>
      ${ordenados.map(p => `<tr>
        <td class="td-pos">${pos.get(p.player_id) ?? "—"}º</td>
        <td class="td-nome">${esc(nomeJogador(players, p.player_id))}</td>
        <td class="td-score">${fmtInt(p.gross_score)}</td>
      </tr>`).join("")}
    </tbody></table>
    <div class="rodada-tags">
      ${nInd ? `<span class="tag">${nInd} match indiv.</span>` : ""}
      ${nDup ? `<span class="tag">${nDup} duplas</span>` : ""}
      ${r.observacoes ? `<span class="tag tag-obs">📝 ${esc(r.observacoes)}</span>` : ""}
    </div>
  </div>`;
}
