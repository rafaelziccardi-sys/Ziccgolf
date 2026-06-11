import { listarJogadores, salvarJogador, excluirJogador } from "../db.js";
import { esc, avatar, toast, loading } from "../ui.js";

export default async function renderJogadores(app) {
  app.innerHTML = loading();
  const players = await listarJogadores();

  app.innerHTML = `
    <section class="hero"><h1>Jogadores</h1></section>
    <form id="form-jog" class="form-inline card-box">
      <input type="hidden" id="jid">
      <div class="campo"><label>Nome</label><input type="text" id="nome" required placeholder="Nome do jogador"></div>
      <div class="campo"><label>Foto (URL opcional)</label><input type="url" id="foto" placeholder="https://..."></div>
      <div class="campo campo-mini"><label>Handicap</label><input type="number" step="0.1" id="handicap" placeholder="—"></div>
      <div class="campo campo-check"><label><input type="checkbox" id="ativo" checked> Ativo</label></div>
      <button type="submit" class="btn btn-primary">Adicionar</button>
    </form>

    <div id="lista-jog">${players.map(linha).join("") || `<div class="vazio">Nenhum jogador ainda.</div>`}</div>`;

  const form = app.querySelector("#form-jog");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const j = {
      id: app.querySelector("#jid").value || null,
      nome: app.querySelector("#nome").value.trim(),
      foto_url: app.querySelector("#foto").value.trim(),
      handicap: app.querySelector("#handicap").value || null,
      ativo: app.querySelector("#ativo").checked,
    };
    if (!j.nome) return toast("Informe o nome", "erro");
    try { await salvarJogador(j); toast("Salvo!"); renderJogadores(app); }
    catch (err) { toast(err.message || "Erro", "erro"); }
  };

  app.querySelector("#lista-jog").addEventListener("click", async (e) => {
    const edit = e.target.dataset.edit, del = e.target.dataset.del;
    if (edit) {
      const p = players.find(x => x.id === edit);
      app.querySelector("#jid").value = p.id;
      app.querySelector("#nome").value = p.nome;
      app.querySelector("#foto").value = p.foto_url || "";
      app.querySelector("#handicap").value = p.handicap ?? "";
      app.querySelector("#ativo").checked = p.ativo;
      form.querySelector("button").textContent = "Salvar";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (del) {
      if (!confirm("Excluir jogador? Os resultados dele também serão removidos.")) return;
      try { await excluirJogador(del); toast("Excluído"); renderJogadores(app); }
      catch (err) { toast(err.message || "Erro", "erro"); }
    }
  });
}

function linha(p) {
  return `<div class="jog-row card-box">
    ${avatar(p, 44)}
    <div class="jog-info">
      <div class="jog-nome">${esc(p.nome)} ${!p.ativo ? '<span class="badge-inativo">inativo</span>' : ""}</div>
      <div class="jog-sub">${p.handicap != null ? `HCP ${p.handicap}` : "sem handicap"}</div>
    </div>
    <a href="#/jogador/${p.id}" class="btn btn-ghost btn-sm">perfil</a>
    <button class="btn btn-ghost btn-sm" data-edit="${p.id}">editar</button>
    <button class="btn-x" data-del="${p.id}">✕</button>
  </div>`;
}
