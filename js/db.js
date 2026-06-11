// =============================================================
//  Acesso ao banco (Supabase). Todas as queries num só lugar.
// =============================================================
import { sb } from "./supabase.js";
import { calcularColocacoes, pontosStroke, pontosMatchInd, pontosMatchDupla } from "./scoring.js";
import { demoAtivo, demoTemporada, demoRodada } from "./demo.js";
import { N_FAIRWAYS, ADMIN_EMAILS } from "./config.js";

const ERRO_DEMO = "Modo demonstração: configure o Supabase (js/config.js) para salvar de verdade.";

export async function listarJogadores() {
  if (demoAtivo()) return [...demoTemporada.players].sort((a, b) => a.nome.localeCompare(b.nome));
  const { data, error } = await sb.from("players").select("*").order("nome");
  if (error) throw error;
  return data;
}

// Jogadores (membros aprovados) de um grupo específico
export async function jogadoresDoGrupo(groupId = grupoAtual()) {
  if (demoAtivo()) return [...demoTemporada.players].sort((a, b) => a.nome.localeCompare(b.nome));
  if (!groupId) return [];
  const { data, error } = await sb.from("group_members")
    .select("players(*)").eq("group_id", groupId).eq("status", "approved");
  if (error) throw error;
  return (data || []).map(m => m.players).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function salvarJogador(j) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const payload = { nome: j.nome, foto_url: j.foto_url || null, handicap: j.handicap ?? null, ativo: j.ativo ?? true };
  const q = j.id ? sb.from("players").update(payload).eq("id", j.id) : sb.from("players").insert(payload);
  const { error } = await q;
  if (error) throw error;
}

export async function excluirJogador(id) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const { error } = await sb.from("players").delete().eq("id", id);
  if (error) throw error;
}

// ---- Conta <-> jogador ----
export async function meuJogador() {
  if (demoAtivo()) return null;
  const { data: u } = await sb.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return null;
  const { data, error } = await sb.from("players").select("*").eq("auth_user_id", uid).maybeSingle();
  if (error) throw error;
  return data;
}

export async function criarMeuJogador({ nome, foto_url, handicap }) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const { data: u } = await sb.auth.getUser();
  const uid = u?.user?.id;
  const { data, error } = await sb.from("players")
    .insert({ nome, foto_url: foto_url || null, handicap: handicap ?? null, ativo: true, auth_user_id: uid })
    .select().single();
  if (error) throw error;
  return data;
}

// ============================================================
//  GRUPOS (multi-tenant) + "grupo atual"
// ============================================================
export function grupoAtual() { try { return localStorage.getItem("zicc_grupo") || null; } catch { return null; } }
export function setGrupoAtual(id) { try { id ? localStorage.setItem("zicc_grupo", id) : localStorage.removeItem("zicc_grupo"); } catch {} }

export async function souAdminPlataforma() {
  const { data } = await sb.auth.getUser();
  const email = (data?.user?.email || "").toLowerCase();
  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email);
}

// Grupos em que sou membro aprovado (com meu papel)
export async function meusGrupos() {
  if (demoAtivo()) return [{ id: "demo", nome: "Grupo Demo", role: "admin", codigo: "DEMO" }];
  const me = await meuJogador();
  if (!me) return [];
  const { data, error } = await sb.from("group_members")
    .select("role, status, groups(id, nome, codigo)")
    .eq("player_id", me.id).eq("status", "approved");
  if (error) throw error;
  return (data || []).map(m => ({ ...m.groups, role: m.role }));
}

// Minhas solicitações pendentes
export async function minhasPendencias() {
  if (demoAtivo()) return [];
  const me = await meuJogador();
  if (!me) return [];
  const { data, error } = await sb.from("group_members")
    .select("status, groups(id, nome)").eq("player_id", me.id).eq("status", "pending");
  if (error) throw error;
  return (data || []).map(m => m.groups);
}

export async function aplicarPorCodigo(codigo) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const { data, error } = await sb.rpc("aplicar_por_codigo", { p_codigo: codigo });
  if (error) throw error;
  return data;
}

export async function criarGrupo(nome) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const { data, error } = await sb.rpc("criar_grupo", { p_nome: nome });
  if (error) throw error;
  return data;
}

export async function membrosDoGrupo(groupId) {
  if (demoAtivo()) return [];
  const { data, error } = await sb.from("group_members")
    .select("id, role, status, players(id, nome, foto_url)").eq("group_id", groupId);
  if (error) throw error;
  return data || [];
}
export async function aprovarMembro(memberId) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const { error } = await sb.from("group_members").update({ status: "approved" }).eq("id", memberId);
  if (error) throw error;
}
export async function removerMembro(memberId) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const { error } = await sb.from("group_members").delete().eq("id", memberId);
  if (error) throw error;
}
export async function renomearGrupo(groupId, nome) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const { error } = await sb.from("groups").update({ nome }).eq("id", groupId);
  if (error) throw error;
}

// ---- Rodada ao vivo (self-join + autosave) ----
export async function criarRodada({ data, observacoes }) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const gid = grupoAtual();
  if (!gid) throw new Error("Selecione um grupo primeiro");
  const r = await sb.from("rounds").insert({ data, observacoes: observacoes || null, modo: "detalhado", group_id: gid }).select().single().then(unwrap);
  return r.id;
}

export async function entrarNaRodada(roundId, playerId) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const { error } = await sb.from("round_participants")
    .insert({ round_id: roundId, player_id: playerId, fairways_tot: N_FAIRWAYS, gir_tot: NB });
  if (error && error.code !== "23505") throw error; // ignora "já é participante"
}

export async function finalizarRodada(roundId) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const { error } = await sb.rpc("finalizar_rodada", { p_round: roundId });
  if (error) throw error;
}
export async function reabrirRodada(roundId) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const { error } = await sb.rpc("reabrir_rodada", { p_round: roundId });
  if (error) throw error;
}

export async function sairDaRodada(roundId, playerId) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  await sb.from("hole_scores").delete().eq("round_id", roundId).eq("player_id", playerId);
  await sb.from("round_participants").delete().eq("round_id", roundId).eq("player_id", playerId).then(unwrap);
}

// Salva UM buraco do meu jogador e recalcula meus totais (autosave ao vivo).
// hole = { score, putts, bunker, gir, fir }
export async function salvarBuraco(roundId, playerId, buraco, hole) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  await sb.from("hole_scores").upsert({
    round_id: roundId, player_id: playerId, buraco,
    strokes: numOrNull(hole.score), putts: numOrNull(hole.putts),
    bunker: numOrNull(hole.bunker) ?? 0, fairway_hit: !!hole.fir, gir: !!hole.gir,
  }, { onConflict: "round_id,player_id,buraco" }).then(unwrap);
  // recomputa meus totais a partir de TODOS os meus buracos nesta rodada
  const rows = await sb.from("hole_scores").select("*").eq("round_id", roundId).eq("player_id", playerId).then(unwrap);
  const t = totaisDeHoleScores(rows);
  await sb.from("round_participants").update({
    gross_score: t.gross_score, putts: t.putts, fairways_hit: t.fairways_hit,
    gir: t.gir, bunker_total: t.bunker_total,
  }).eq("round_id", roundId).eq("player_id", playerId).then(unwrap);
}

export async function salvarMatchInd(roundId, m) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  await sb.from("individual_matches").insert({ round_id: roundId, ...m }).then(unwrap);
}
export async function salvarMatchDupla(roundId, m) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  await sb.from("team_matches").insert({ round_id: roundId, ...m }).then(unwrap);
}
export async function excluirMatchInd(id) { if (demoAtivo()) throw new Error(ERRO_DEMO); await sb.from("individual_matches").delete().eq("id", id).then(unwrap); }
export async function excluirMatchDupla(id) { if (demoAtivo()) throw new Error(ERRO_DEMO); await sb.from("team_matches").delete().eq("id", id).then(unwrap); }

function totaisDeHoleScores(rows) {
  let gs = null, pt = null, bk = 0, gir = 0, fir = 0;
  for (const r of rows) {
    if (r.strokes != null) gs = (gs ?? 0) + r.strokes;
    if (r.putts != null) pt = (pt ?? 0) + r.putts;
    if (r.bunker != null) bk += r.bunker;
    if (r.gir) gir++;
    if (r.fairway_hit) fir++;
  }
  return { gross_score: gs, putts: pt, bunker_total: bk, gir, fairways_hit: fir };
}

// Carrega a temporada do GRUPO ATUAL.
// somenteFinalizadas=true (ranking/stats) -> só rodadas encerradas.
// somenteFinalizadas=false (lista de Rodadas) -> todas, incl. em andamento.
export async function carregarTemporada(ano, groupId = grupoAtual(), somenteFinalizadas = true) {
  if (demoAtivo()) return demoTemporada;
  const ini = `${ano}-01-01`, fim = `${ano}-12-31`;
  let q = sb.from("rounds").select("*").eq("group_id", groupId).gte("data", ini).lte("data", fim);
  if (somenteFinalizadas) q = q.eq("finalizada", true);
  const [players, rounds] = await Promise.all([
    jogadoresDoGrupo(groupId),
    q.order("data", { ascending: false }).then(r => unwrap(r)),
  ]);
  const roundIds = rounds.map(r => r.id);
  if (roundIds.length === 0)
    return { players, rounds, participants: [], indMatches: [], teamMatches: [], holes: [] };
  const [participants, indMatches, teamMatches, holes] = await Promise.all([
    sb.from("round_participants").select("*").in("round_id", roundIds).then(unwrap),
    sb.from("individual_matches").select("*").in("round_id", roundIds).then(unwrap),
    sb.from("team_matches").select("*").in("round_id", roundIds).then(unwrap),
    sb.from("hole_scores").select("*").in("round_id", roundIds).then(unwrap),
  ]);
  return { players, rounds, participants, indMatches, teamMatches, holes };
}

export async function carregarRodada(id) {
  if (demoAtivo()) return { ...demoRodada(id), holes: [] };
  const [round, participants, indMatches, teamMatches, holes] = await Promise.all([
    sb.from("rounds").select("*").eq("id", id).single().then(unwrap),
    sb.from("round_participants").select("*").eq("round_id", id).then(unwrap),
    sb.from("individual_matches").select("*").eq("round_id", id).then(unwrap),
    sb.from("team_matches").select("*").eq("round_id", id).then(unwrap),
    sb.from("hole_scores").select("*").eq("round_id", id).then(unwrap),
  ]);
  return { round, participants, indMatches, teamMatches, holes };
}

// Salva uma rodada inteira (cria ou atualiza). Buraco a buraco.
// rodada = { id?, data, observacoes,
//            participantes:[{ player_id, holes:[{score,putts,bunker,gir,fir}, ...18] }],
//            individuais:[{player_a,player_b,resultado,placar}], duplas:[{t1_p1,...,resultado}] }
export async function salvarRodada(rodada) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  let roundId = rodada.id;
  if (roundId) {
    await sb.from("rounds").update({ data: rodada.data, observacoes: rodada.observacoes || null, modo: "detalhado" }).eq("id", roundId).then(unwrap);
    // limpa filhos para regravar
    await Promise.all([
      sb.from("round_participants").delete().eq("round_id", roundId),
      sb.from("individual_matches").delete().eq("round_id", roundId),
      sb.from("team_matches").delete().eq("round_id", roundId),
      sb.from("hole_scores").delete().eq("round_id", roundId),
    ]);
  } else {
    const r = await sb.from("rounds").insert({ data: rodada.data, observacoes: rodada.observacoes || null, modo: "detalhado" }).select().single().then(unwrap);
    roundId = r.id;
  }

  // Totais por jogador (a partir dos buracos) + colocações + pontos de stroke
  const totais = rodada.participantes.map(p => ({ player_id: p.player_id, ...totaisDosBuracos(p.holes) }));
  const pos = calcularColocacoes(totais.map(t => ({ player_id: t.player_id, gross_score: t.gross_score })));
  const parts = totais.map(t => ({
    round_id: roundId, player_id: t.player_id,
    gross_score: t.gross_score, posicao: pos.get(t.player_id) ?? null,
    putts: t.putts, fairways_hit: t.fairways_hit, fairways_tot: NB,
    gir: t.gir, gir_tot: NB, bunker_total: t.bunker_total,
    pontos_stroke: pos.get(t.player_id) ? pontosStroke(pos.get(t.player_id)) : 0,
    pontos_match_ind: 0, pontos_match_dupla: 0,
  }));

  for (const m of rodada.individuais || []) {
    add(parts, m.player_a, "pontos_match_ind", pontosMatchInd(m.resultado, "A"));
    add(parts, m.player_b, "pontos_match_ind", pontosMatchInd(m.resultado, "B"));
  }
  for (const m of rodada.duplas || []) {
    for (const id of [m.t1_p1, m.t1_p2]) add(parts, id, "pontos_match_dupla", pontosMatchDupla(m.resultado, "T1"));
    for (const id of [m.t2_p1, m.t2_p2]) add(parts, id, "pontos_match_dupla", pontosMatchDupla(m.resultado, "T2"));
  }
  if (parts.length) await sb.from("round_participants").insert(parts).then(unwrap);

  // Score por buraco (só os buracos com algum dado)
  const holeRows = [];
  for (const p of rodada.participantes) {
    (p.holes || []).forEach((hb, i) => {
      const strokes = numOrNull(hb.score), putts = numOrNull(hb.putts), bunker = numOrNull(hb.bunker);
      if (strokes == null && putts == null && bunker == null && !hb.gir && !hb.fir) return;
      holeRows.push({ round_id: roundId, player_id: p.player_id, buraco: i + 1, strokes, putts, bunker: bunker ?? 0, fairway_hit: !!hb.fir, gir: !!hb.gir });
    });
  }
  if (holeRows.length) await sb.from("hole_scores").insert(holeRows).then(unwrap);

  const ind = (rodada.individuais || []).map(m => ({ round_id: roundId, ...m }));
  if (ind.length) await sb.from("individual_matches").insert(ind).then(unwrap);
  const dup = (rodada.duplas || []).map(m => ({ round_id: roundId, ...m }));
  if (dup.length) await sb.from("team_matches").insert(dup).then(unwrap);
  return roundId;
}

const NB = 18;
function totaisDosBuracos(holes) {
  let gs = null, pt = null, bk = 0, gir = 0, fir = 0;
  for (const hb of holes || []) {
    const s = numOrNull(hb?.score); if (s != null) gs = (gs ?? 0) + s;
    const p = numOrNull(hb?.putts); if (p != null) pt = (pt ?? 0) + p;
    const b = numOrNull(hb?.bunker); if (b != null) bk += b;
    if (hb?.gir) gir++;
    if (hb?.fir) fir++;
  }
  return { gross_score: gs, putts: pt, bunker_total: bk, gir, fairways_hit: fir };
}

export async function excluirRodada(id) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const { error } = await sb.from("rounds").delete().eq("id", id);
  if (error) throw error;
}

function unwrap(res) { if (res.error) throw res.error; return res.data; }
function numOrNull(v) { return v === "" || v == null || isNaN(Number(v)) ? null : Number(v); }
function add(parts, playerId, campo, valor) { const p = parts.find(x => x.player_id === playerId); if (p) p[campo] += valor; }
