import { criarRodada } from "../db.js";
import { toast } from "../ui.js";

export default async function renderNovaRodada(app) {
  const hoje = new Date().toISOString().slice(0, 10);
  app.innerHTML = `
    <section class="hero"><h1>Nova rodada</h1></section>
    <div class="bloco">
      <p class="hint">Crie a rodada do dia. Depois cada jogador <b>entra sozinho</b> e preenche o próprio placar — todo mundo acompanha ao vivo.</p>
      <form id="form-criar">
        <div class="campo"><label>Data do jogo</label><input type="date" id="data" value="${hoje}" required></div>
        <div class="campo"><label>Observações (opcional)</label><input type="text" id="obs" placeholder="Ex.: jogo de domingo"></div>
        <button type="submit" class="btn btn-primary btn-lg">Criar rodada</button>
      </form>
    </div>`;
  app.querySelector("#form-criar").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; btn.textContent = "Criando...";
    try {
      const id = await criarRodada({ data: app.querySelector("#data").value, observacoes: app.querySelector("#obs").value });
      toast("Rodada criada! Entre e preencha seu placar.");
      location.hash = "#/rodada/" + id;
    } catch (err) { console.error(err); toast(err.message || "Erro ao criar", "erro"); btn.disabled = false; btn.textContent = "Criar rodada"; }
  };
}
