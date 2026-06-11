import { jogadoresDoGrupo, salvarJogador, meuJogador } from "../db.js";
import { esc, avatar, toast, loading } from "../ui.js";

export default async function renderJogadores(app) {
  app.innerHTML = loading();
  const [players, meu] = await Promise.all([jogadoresDoGrupo(), meuJogador()]);

  app.innerHTML = `
    <section class="hero"><h1>Jogadores</h1><p class="hero-sub">${players.length} no grupo</p></section>

    ${meu ? `<form id="form-perfil" class="form-inline card-box">
      <div class="bloco-titulo" style="grid-column:1/-1">Meu perfil</div>
      <div class="campo"><label>Nome</label><input type="text" id="nome" value="${esc(meu.nome)}" required></div>
      <div class="campo"><label>Foto (URL)</label><input type="url" id="foto" value="${esc(meu.foto_url || "")}" placeholder="https://..."></div>
      <div class="campo campo-mini"><label>Handicap</label><input type="number" step="0.1" id="handicap" value="${meu.handicap ?? ""}"></div>
      <div class="campo campo-check"><label><input type="checkbox" id="ativo" ${meu.ativo ? "checked" : ""}> Ativo</label></div>
      <button type="submit" class="btn btn-primary">Salvar meu perfil</button>
    </form>` : `<div class="card-box"><div class="vazio">Modo visitante — entre com sua conta para ter um perfil.</div></div>`}

    <div class="card-head" style="padding:0 4px">Todos os jogadores</div>
    <div id="lista-jog">${players.map(p => linha(p, meu)).join("") || `<div class="vazio">Ninguém ainda.</div>`}</div>`;

  const form = app.querySelector("#form-perfil");
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    const j = {
      id: meu.id,
      nome: app.querySelector("#nome").value.trim(),
      foto_url: app.querySelector("#foto").value.trim(),
      handicap: app.querySelector("#handicap").value || null,
      ativo: app.querySelector("#ativo").checked,
    };
    if (!j.nome) return toast("Informe o nome", "erro");
    try { await salvarJogador(j); toast("Perfil salvo!"); renderJogadores(app); }
    catch (err) { toast(err.message || "Erro", "erro"); }
  };
}

function linha(p, meu) {
  const eu = meu && p.id === meu.id;
  return `<div class="jog-row card-box">
    ${avatar(p, 44)}
    <div class="jog-info">
      <div class="jog-nome">${esc(p.nome)} ${eu ? '<small class="voce">(você)</small>' : ""} ${!p.ativo ? '<span class="badge-inativo">inativo</span>' : ""}</div>
      <div class="jog-sub">${p.handicap != null ? `HCP ${p.handicap}` : "sem handicap"}</div>
    </div>
    <a href="#/jogador/${p.id}" class="btn btn-ghost btn-sm">perfil</a>
  </div>`;
}
