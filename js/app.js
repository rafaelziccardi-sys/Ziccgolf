// =============================================================
//  App principal: login gate + roteador por hash (#/rota)
// =============================================================
import { APP_NOME, SUPABASE_URL } from "./config.js";
import { usuarioAtual, entrar, cadastrar, sair, aoMudarLogin } from "./auth.js";
import { demoAtivo, sairDemo } from "./demo.js";
import { h, toast } from "./ui.js";

import renderHome from "./pages/home.js";
import renderRankings from "./pages/rankings.js";
import renderNovaRodada from "./pages/novaRodada.js";
import renderRodadas from "./pages/rodadas.js";
import renderJogadores from "./pages/jogadores.js";
import renderJogador from "./pages/jogador.js";
import renderStats from "./pages/stats.js";

const rotas = {
  "": renderHome,
  "home": renderHome,
  "rankings": renderRankings,
  "nova-rodada": renderNovaRodada,
  "rodadas": renderRodadas,
  "jogadores": renderJogadores,
  "jogador": renderJogador,
  "stats": renderStats,
};

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

function montarLogado(user) {
  document.body.classList.add("logado");
  nav.innerHTML = `
    <a data-rota="home" href="#/home">Início</a>
    <a data-rota="rankings" href="#/rankings">Rankings</a>
    <a data-rota="nova-rodada" href="#/nova-rodada" class="nav-cta">+ Rodada</a>
    <a data-rota="rodadas" href="#/rodadas">Rodadas</a>
    <a data-rota="stats" href="#/stats">Estatísticas</a>
    <a data-rota="jogadores" href="#/jogadores">Jogadores</a>
    <a href="#" id="btn-sair" class="nav-sair">Sair</a>`;
  nav.querySelector("#btn-sair").onclick = async (e) => {
    e.preventDefault();
    if (demoAtivo()) { sairDemo(); location.href = location.pathname; return; }
    await sair();
  };
  atualizarBannerDemo();
  if (!location.hash) location.hash = "#/home";
  rotear();
}

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
