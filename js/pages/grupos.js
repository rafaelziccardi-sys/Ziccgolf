import { meusGrupos, minhasPendencias, aplicarPorCodigo, criarGrupo, souAdminPlataforma, grupoAtual, setGrupoAtual } from "../db.js";
import { esc, toast, loading } from "../ui.js";

export default async function renderGrupos(app) {
  app.innerHTML = loading();
  const [grupos, pendentes, podeCriar] = await Promise.all([meusGrupos(), minhasPendencias(), souAdminPlataforma()]);
  const atual = grupoAtual();

  app.innerHTML = `
    <section class="hero"><h1>Grupos</h1><p class="hero-sub">Seus grupos de golfe no Ziccgolf</p></section>

    ${grupos.length ? `<div class="card-box"><div class="card-head"><span>Meus grupos</span></div>
      ${grupos.map(g => `<div class="grupo-row">
        <div class="grupo-info"><b>${esc(g.nome)}</b> ${g.role === "admin" ? '<span class="tag tag-obs">admin</span>' : ""}</div>
        ${g.id === atual ? `<span class="tag">atual</span>` : `<button class="btn btn-ghost btn-sm" data-usar="${g.id}">usar</button>`}
      </div>`).join("")}</div>` : `<div class="card-box"><div class="vazio">Você ainda não está em nenhum grupo. Entre com um código de convite abaixo.</div></div>`}

    ${pendentes.length ? `<div class="card-box"><div class="card-head"><span>Aguardando aprovação</span></div>
      ${pendentes.map(g => `<div class="grupo-row"><div class="grupo-info">${esc(g.nome)}</div><span class="tag">pendente</span></div>`).join("")}</div>` : ""}

    <div class="card-box"><div class="card-head"><span>Entrar em um grupo</span></div>
      <p class="hint">Digite o código de convite que o admin do grupo te passou.</p>
      <form id="form-codigo" class="form-codigo">
        <input type="text" id="codigo" placeholder="Ex.: A1B2C3" maxlength="12" autocapitalize="characters">
        <button type="submit" class="btn btn-primary">Solicitar entrada</button>
      </form>
    </div>

    ${podeCriar ? `<div class="card-box"><div class="card-head"><span>Criar um grupo (admin)</span></div>
      <form id="form-criar-grupo" class="form-codigo">
        <input type="text" id="nome-grupo" placeholder="Nome do grupo (ex.: Ziccgolf)">
        <button type="submit" class="btn btn-primary">Criar grupo</button>
      </form></div>` : ""}`;

  app.querySelectorAll("[data-usar]").forEach(b => b.onclick = () => { setGrupoAtual(b.dataset.usar); location.reload(); });

  app.querySelector("#form-codigo").onsubmit = async (e) => {
    e.preventDefault();
    const cod = app.querySelector("#codigo").value.trim();
    if (!cod) return toast("Digite o código", "erro");
    const btn = e.submitter; btn.disabled = true; btn.textContent = "Enviando...";
    try {
      const r = await aplicarPorCodigo(cod);
      if (r.status === "approved") { setGrupoAtual(r.group_id); toast(`Você entrou em ${r.nome}!`); location.reload(); }
      else { toast(`Solicitação enviada para ${r.nome}. Aguarde a aprovação do admin.`); renderGrupos(app); }
    } catch (err) { toast(err.message || "Erro", "erro"); btn.disabled = false; btn.textContent = "Solicitar entrada"; }
  };

  const fc = app.querySelector("#form-criar-grupo");
  if (fc) fc.onsubmit = async (e) => {
    e.preventDefault();
    const nome = app.querySelector("#nome-grupo").value.trim();
    if (!nome) return toast("Dê um nome ao grupo", "erro");
    const btn = e.submitter; btn.disabled = true; btn.textContent = "Criando...";
    try {
      const r = await criarGrupo(nome);
      setGrupoAtual(r.group_id);
      toast(`Grupo "${r.nome}" criado! Código: ${r.codigo}`);
      location.reload();
    } catch (err) { toast(err.message || "Erro", "erro"); btn.disabled = false; btn.textContent = "Criar grupo"; }
  };
}
