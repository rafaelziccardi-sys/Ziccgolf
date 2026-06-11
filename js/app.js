// =============================================================
//  App principal: login gate + roteador por hash (#/rota)
// =============================================================
import { APP_NOME, SUPABASE_URL } from "./config.js";
import { usuarioAtual, entrar, cadastrar, sair, aoMudarLogin } from "./auth.js";
import { meuJogador, criarMeuJogador, meusGrupos, grupoAtual, setGrupoAtual } from "./db.js";
import { demoAtivo, sairDemo } from "./demo.js";
import { h, toast, esc } from "./ui.js";

import renderHome from "./pages/home.js";
import renderRankings from "./pages/rankings.js";
import renderNovaRodada from "./pages/novaRodada.js";
import renderRodada from "./pages/rodada.js";
import renderRodadas from "./pages/rodadas.js";
import renderJogadores from "./pages/jogadores.js";
import renderJogador from "./pages/jogador.js";
import renderStats from "./pages/stats.js";
import renderGrupos from "./pages/grupos.js";
import renderAdmin from "./pages/admin.js";

const rotas = {
  "": renderHome,
  "home": renderHome,
  "rankings": renderRankings,
  "nova-rodada": renderNovaRodada,
  "rodada": renderRodada,
  "rodadas": renderRodadas,
  "jogadores": renderJogadores,
  "jogador": renderJogador,
  "stats": renderStats,
  "grupos": renderGrupos,
  "admin": renderAdmin,
};

let GRUPOS = [];   // grupos aprovados do usuário (cache da sessão)

const app = document.getElementById("app");
const nav = document.getElementById("nav");

function configurado() {
  return SUPABASE_URL && !SUPABASE_URL.startsWith("COLE_AQUI");
}

async function rotear() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [rota, ...params] = hash.split("/");
  const render = rotas[rota] || renderHome;
  app.innerHTML = "";
  marcarNavAtivo(rota || "home");
  try {
    await render(app, params);
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="erro">Erro ao carregar: ${e.message || e}</div>`;
  }
}

function marcarNavAtivo(rota) {
  nav.querySelectorAll("a").forEach(a => {
    a.classList.toggle("ativo", a.dataset.rota === rota);
  });
}

async function montarLogado(user) {
  document.body.classList.add("logado");
  atualizarBannerDemo();

  if (demoAtivo()) {
    GRUPOS = [{ id: "demo", nome: "Grupo Demo", role: "admin" }];
    setGrupoAtual("demo");
    return montarNav(GRUPOS[0]);
  }

  // 1º login: ainda não tem jogador vinculado -> cria o perfil
  let jog = null;
  try { jog = await meuJogador(); } catch (e) { console.error(e); }
  if (!jog) return montarPerfilInicial();

  // precisa estar aprovado em ao menos um grupo
  try { GRUPOS = await meusGrupos(); } catch (e) { console.error(e); GRUPOS = []; }
  if (!GRUPOS.length) {
    nav.innerHTML = `<a data-rota="grupos" href="#/grupos" class="ativo">Grupos</a><a href="#" id="btn-sair" class="nav-sair">Sair</a>`;
    ligarSair();
    location.hash = "#/grupos";
    rotear();
    return;
  }

  // garante um grupo atual válido
  let atualId = grupoAtual();
  if (!atualId || !GRUPOS.some(g => g.id === atualId)) { atualId = GRUPOS[0].id; setGrupoAtual(atualId); }
  montarNav(GRUPOS.find(g => g.id === atualId));
}

function montarNav(grupoSel) {
  const ehAdmin = grupoSel?.role === "admin";
  const seletor = GRUPOS.length > 1
    ? `<select id="sel-grupo" class="nav-grupo">${GRUPOS.map(g => `<option value="${g.id}" ${g.id === grupoSel.id ? "selected" : ""}>${esc(g.nome)}</option>`).join("")}</select>`
    : `<a data-rota="grupos" href="#/grupos" class="nav-grupo-nome">${esc(grupoSel?.nome || "")}</a>`;
  nav.innerHTML = `
    ${seletor}
    <a data-rota="home" href="#/home">Início</a>
    <a data-rota="rankings" href="#/rankings">Rankings</a>
    <a data-rota="nova-rodada" href="#/nova-rodada" class="nav-cta">+ Rodada</a>
    <a data-rota="rodadas" href="#/rodadas">Rodadas</a>
    <a data-rota="stats" href="#/stats">Estatísticas</a>
    <a data-rota="jogadores" href="#/jogadores">Jogadores</a>
    ${ehAdmin ? `<a data-rota="admin" href="#/admin" class="nav-admin">Admin</a>` : ""}
    <a data-rota="grupos" href="#/grupos">Grupos</a>
    <a href="#" id="btn-sair" class="nav-sair">Sair</a>`;
  ligarSair();
  const sel = nav.querySelector("#sel-grupo");
  if (sel) sel.onchange = () => { setGrupoAtual(sel.value); location.hash = "#/home"; montarLogado({}); };
  if (!location.hash) location.hash = "#/home";
  rotear();
}

function ligarSair() {
  const b = nav.querySelector("#btn-sair");
  if (b) b.onclick = async (e) => {
    e.preventDefault();
    if (demoAtivo()) { sairDemo(); location.href = location.pathname; return; }
    await sair();
  };
}

// exposto p/ páginas saberem o papel no grupo atual
export function grupoSelecionado() { return GRUPOS.find(g => g.id === grupoAtual()) || null; }

function atualizarBannerDemo() {
  let banner = document.getElementById("demo-banner");
  if (demoAtivo()) {
    if (!banner) {
      banner = h(`<div id="demo-banner">🔎 Modo demonstração — dados fictícios, nada é salvo. <a href="#" id="sair-demo">Sair do demo</a></div>`);
      document.body.insertBefore(banner, app);
      banner.querySelector("#sair-demo").onclick = (e) => { e.preventDefault(); sairDemo(); location.href = location.pathname; };
    }
  } else if (banner) banner.remove();
}

function montarPerfilInicial() {
  nav.innerHTML = "";
  app.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">⛳</div>
        <h1>Crie seu jogador</h1>
        <p class="login-sub">Esse será o seu perfil no grupo</p>
        <form id="form-perfil">
          <input type="text" id="p-nome" placeholder="Seu nome" required autocomplete="name">
          <input type="url" id="p-foto" placeholder="Foto (URL, opcional)">
          <input type="number" step="0.1" id="p-hcp" placeholder="Handicap (opcional)">
          <button type="submit" class="btn btn-primary">Criar e entrar</button>
        </form>
        <div class="login-demo"><a href="#" id="perfil-sair">Sair</a></div>
      </div>
    </div>`;
  app.querySelector("#perfil-sair").onclick = async (e) => { e.preventDefault(); await sair(); };
  app.querySelector("#form-perfil").onsubmit = async (e) => {
    e.preventDefault();
    const nome = app.querySelector("#p-nome").value.trim();
    if (!nome) return toast("Informe seu nome", "erro");
    const btn = e.submitter; btn.disabled = true; btn.textContent = "Criando...";
    try {
      await criarMeuJogador({ nome, foto_url: app.querySelector("#p-foto").value.trim(), handicap: app.querySelector("#p-hcp").value || null });
      toast("Jogador criado! 🏌️");
      montarLogado({});
    } catch (err) { console.error(err); toast(err.message || "Erro ao criar jogador", "erro"); btn.disabled = false; btn.textContent = "Criar e entrar"; }
  };
}

function montarLogin() {
  document.body.classList.remove("logado");
  nav.innerHTML = "";
  app.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">⛳</div>
        <h1>${APP_NOME}</h1>
        <p class="login-sub">Acesso restrito ao grupo</p>
        ${!configurado() ? `<div class="aviso">⚠️ Configure o Supabase em <code>js/config.js</code> antes de usar.</div>` : ""}
        <form id="form-login">
          <input type="email" id="email" placeholder="E-mail" required autocomplete="email">
          <input type="password" id="senha" placeholder="Senha" required autocomplete="current-password">
          <button type="submit" class="btn btn-primary">Entrar</button>
          <button type="button" id="btn-cadastrar" class="btn btn-ghost">Criar conta</button>
        </form>
        <div class="login-demo">
          <button type="button" id="btn-demo" class="btn btn-ghost">🔎 Ver demonstração</button>
        </div>
      </div>
    </div>`;
  app.querySelector("#btn-demo").onclick = () => { location.href = location.pathname + "?demo=1"; };
  const form = app.querySelector("#form-login");
  const email = () => app.querySelector("#email").value.trim();
  const senha = () => app.querySelector("#senha").value;
  form.onsubmit = async (e) => {
    e.preventDefault();
    try { await entrar(email(), senha()); } catch (err) { toast(err.message || "Falha no login", "erro"); }
  };
  app.querySelector("#btn-cadastrar").onclick = async () => {
    if (!email() || !senha()) return toast("Preencha e-mail e senha", "erro");
    try { await cadastrar(email(), senha()); toast("Conta criada! Verifique seu e-mail se necessário."); }
    catch (err) { toast(err.message || "Falha ao cadastrar", "erro"); }
  };
}

window.addEventListener("hashchange", rotear);

if (demoAtivo()) {
  montarLogado({ email: "demo" });
} else {
  aoMudarLogin((user) => { user ? montarLogado(user) : montarLogin(); });
  (async () => {
    const user = await usuarioAtual();
    user ? montarLogado(user) : montarLogin();
  })();
}
