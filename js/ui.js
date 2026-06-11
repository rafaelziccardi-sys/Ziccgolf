// =============================================================
//  Helpers de UI compartilhados pelas páginas
// =============================================================
export function h(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
export function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
export function fmt(n, dec = 1) { return n == null || isNaN(n) ? "—" : Number(n).toFixed(dec); }
export function fmtInt(n) { return n == null || isNaN(n) ? "—" : Math.round(n); }
export function fmtData(d) { if (!d) return "—"; const [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; }

export function nomeJogador(players, id) { return players.find(p => p.id === id)?.nome ?? "—"; }

export function avatar(player, size = 40) {
  const ini = (player?.nome || "?").trim().slice(0, 2).toUpperCase();
  if (player?.foto_url)
    return `<img class="avatar" style="width:${size}px;height:${size}px" src="${esc(player.foto_url)}" alt="">`;
  return `<span class="avatar avatar-ini" style="width:${size}px;height:${size}px;font-size:${size * 0.38}px">${esc(ini)}</span>`;
}

export function card(titulo, valor, sub = "") {
  return `<div class="stat-card"><div class="stat-valor">${valor}</div><div class="stat-titulo">${esc(titulo)}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ""}</div>`;
}

export function toast(msg, tipo = "ok") {
  const t = h(`<div class="toast toast-${tipo}">${esc(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2600);
}

export function loading() { return `<div class="loading"><div class="spinner"></div></div>`; }
export const anoAtual = () => new Date().getFullYear();
