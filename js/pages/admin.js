import { meusGrupos, grupoAtual, membrosDoGrupo, aprovarMembro, removerMembro, renomearGrupo } from "../db.js";
import { esc, avatar, toast, loading } from "../ui.js";

export default async function renderAdmin(app) {
  app.innerHTML = loading();
  const gid = grupoAtual();
  const grupos = await meusGrupos();
  const g = grupos.find(x => x.id === gid);

  if (!g || g.role !== "admin") {
    app.innerHTML = `<section class="hero"><h1>Admin</h1></section>
      <div class="vazio">Você não é admin do grupo atual.</div>`;
    return;
  }

  const membros = await membrosDoGrupo(gid);
  const pend = membros.filter(m => m.status === "pending");
  const ativos = membros.filter(m => m.status === "approved");

  app.innerHTML = `
    <section class="hero"><h1>Admin · ${esc(g.nome)}</h1></section>

    <div class="card-box"><div class="card-head"><span>Código de convite</span></div>
      <p class="hint">Compartilhe este código com quem você quer no grupo:</p>
      <div class="codigo-box"><code id="cod">${esc(g.codigo || "—")}</code>
        <button class="btn btn-ghost btn-sm" id="copiar">copiar</button></div>
    </div>

    <div class="card-box"><div class="card-head"><span>Renomear grupo</span></div>
      <form id="form-rename" class="form-codigo">
        <input type="text" id="novo-nome" value="${esc(g.nome)}">
        <button type="submit" class="btn btn-primary">Salvar</button>
      </form>
    </div>

    <div class="card-box"><div class="card-head"><span>Solicitações pendentes ${pend.length ? `(${pend.length})` : ""}</span></div>
      ${pend.length ? pend.map(m => linhaMembro(m, true)).join("") : `<div class="vazio">Nenhuma solicitação no momento.</div>`}
    </div>

    <div class="card-box"><div class="card-head"><span>Membros (${ativos.length})</span></div>
      ${ativos.map(m => linhaMembro(m, false)).join("")}
    </div>`;

  const cod = app.querySelector("#copiar");
  if (cod) cod.onclick = async () => { try { await navigator.clipboard.writeText(g.codigo); toast("Código copiado!"); } catch { toast("Copie manualmente", "erro"); } };

  app.querySelector("#form-rename").onsubmit = async (e) => {
    e.preventDefault();
    const nome = app.querySelector("#novo-nome").value.trim();
    if (!nome) return toast("Informe o nome", "erro");
    try { await renomearGrupo(gid, nome); toast("Grupo renomeado!"); location.reload(); }
    catch (err) { toast(err.message || "Erro", "erro"); }
  };

  app.querySelectorAll("[data-aprovar]").forEach(b => b.onclick = async () => {
    try { await aprovarMembro(b.dataset.aprovar); toast("Aprovado!"); renderAdmin(app); } catch (err) { toast(err.message || "Erro", "erro"); }
  });
  app.querySelectorAll("[data-remover]").forEach(b => b.onclick = async () => {
    if (!confirm("Remover do grupo?")) return;
    try { await removerMembro(b.dataset.remover); toast("Removido"); renderAdmin(app); } catch (err) { toast(err.message || "Erro", "erro"); }
  });
}

function linhaMembro(m, pendente) {
  const p = m.players || {};
  return `<div class="jog-row">
    ${avatar(p, 40)}
    <div class="jog-info"><div class="jog-nome">${esc(p.nome || "—")} ${m.role === "admin" ? '<span class="tag tag-obs">admin</span>' : ""}</div></div>
    ${pendente ? `<button class="btn btn-primary btn-sm" data-aprovar="${m.id}">aprovar</button>` : ""}
    ${m.role === "admin" ? "" : `<button class="btn-x" data-remover="${m.id}">✕</button>`}
  </div>`;
}
