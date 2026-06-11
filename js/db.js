// =============================================================
//  Acesso ao banco (Supabase). Todas as queries num só lugar.
// =============================================================
import { sb } from "./supabase.js";
import { calcularColocacoes, pontosStroke, pontosMatchInd, pontosMatchDupla } from "./scoring.js";
import { demoAtivo, demoTemporada, demoRodada } from "./demo.js";

const ERRO_DEMO = "Modo demonstração: configure o Supabase (js/config.js) para salvar de verdade.";

export async function listarJogadores() {
  if (demoAtivo()) return [...demoTemporada.players].sort((a, b) => a.nome.localeCompare(b.nome));
  const { data, error } = await sb.from("players").select("*").order("nome");
  if (error) throw error;
  return data;
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

// Carrega TODA a temporada de uma vez (volume pequeno -> simples e rápido)
export async function carregarTemporada(ano) {
  if (demoAtivo()) return demoTemporada;
  const ini = `${ano}-01-01`, fim = `${ano}-12-31`;
  const [players, rounds] = await Promise.all([
    listarJogadores(),
    sb.from("rounds").select("*").gte("data", ini).lte("data", fim).order("data", { ascending: false }).then(r => unwrap(r)),
  ]);
  const roundIds = rounds.map(r => r.id);
  if (roundIds.length === 0)
    return { players, rounds, participants: [], indMatches: [], teamMatches: [] };
  const [participants, indMatches, teamMatches] = await Promise.all([
    sb.from("round_participants").select("*").in("round_id", roundIds).then(unwrap),
    sb.from("individual_matches").select("*").in("round_id", roundIds).then(unwrap),
    sb.from("team_matches").select("*").in("round_id", roundIds).then(unwrap),
  ]);
  return { players, rounds, participants, indMatches, teamMatches };
}

export async function carregarRodada(id) {
  if (demoAtivo()) return demoRodada(id);
  const [round, participants, indMatches, teamMatches] = await Promise.all([
    sb.from("rounds").select("*").eq("id", id).single().then(unwrap),
    sb.from("round_participants").select("*").eq("round_id", id).then(unwrap),
    sb.from("individual_matches").select("*").eq("round_id", id).then(unwrap),
    sb.from("team_matches").select("*").eq("round_id", id).then(unwrap),
  ]);
  return { round, participants, indMatches, teamMatches };
}

// Salva uma rodada inteira (cria ou atualiza). Recalcula posições e pontos.
// rodada = { id?, data, observacoes, participantes:[{player_id,gross_score,putts,fairways_hit,fairways_tot,gir,gir_tot}],
//            individuais:[{player_a,player_b,resultado,placar}], duplas:[{t1_p1,...,resultado,placar}] }
export async function salvarRodada(rodada) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  let roundId = rodada.id;
  if (roundId) {
    await sb.from("rounds").update({ data: rodada.data, observacoes: rodada.observacoes || null }).eq("id", roundId).then(unwrap);
    // limpa filhos para regravar
    await Promise.all([
      sb.from("round_participants").delete().eq("round_id", roundId),
      sb.from("individual_matches").delete().eq("round_id", roundId),
      sb.from("team_matches").delete().eq("round_id", roundId),
    ]);
  } else {
    const r = await sb.from("rounds").insert({ data: rodada.data, observacoes: rodada.observacoes || null, modo: "simples" }).select().single().then(unwrap);
    roundId = r.id;
  }

  // Calcula colocações e pontos de stroke
  const pos = calcularColocacoes(rodada.participantes);
  const parts = rodada.participantes.map(p => ({
    round_id: roundId, player_id: p.player_id,
    gross_score: numOrNull(p.gross_score), posicao: pos.get(p.player_id) ?? null,
    putts: numOrNull(p.putts), fairways_hit: numOrNull(p.fairways_hit),
    fairways_tot: numOrNull(p.fairways_tot) ?? 14, gir: numOrNull(p.gir), gir_tot: numOrNull(p.gir_tot) ?? 18,
    pontos_stroke: pos.get(p.player_id) ? pontosStroke(pos.get(p.player_id)) : 0,
    pontos_match_ind: 0, pontos_match_dupla: 0,
  }));

  // Soma pontos de match nos participantes (cache; o ranking recalcula de qualquer jeito)
  for (const m of rodada.individuais || []) {
    add(parts, m.player_a, "pontos_match_ind", pontosMatchInd(m.resultado, "A"));
    add(parts, m.player_b, "pontos_match_ind", pontosMatchInd(m.resultado, "B"));
  }
  for (const m of rodada.duplas || []) {
    for (const id of [m.t1_p1, m.t1_p2]) add(parts, id, "pontos_match_dupla", pontosMatchDupla(m.resultado, "T1"));
    for (const id of [m.t2_p1, m.t2_p2]) add(parts, id, "pontos_match_dupla", pontosMatchDupla(m.resultado, "T2"));
  }

  if (parts.length) await sb.from("round_participants").insert(parts).then(unwrap);
  const ind = (rodada.individuais || []).map(m => ({ round_id: roundId, ...m }));
  if (ind.length) await sb.from("individual_matches").insert(ind).then(unwrap);
  const dup = (rodada.duplas || []).map(m => ({ round_id: roundId, ...m }));
  if (dup.length) await sb.from("team_matches").insert(dup).then(unwrap);
  return roundId;
}

export async function excluirRodada(id) {
  if (demoAtivo()) throw new Error(ERRO_DEMO);
  const { error } = await sb.from("rounds").delete().eq("id", id);
  if (error) throw error;
}

function unwrap(res) { if (res.error) throw res.error; return res.data; }
function numOrNull(v) { return v === "" || v == null || isNaN(Number(v)) ? null : Number(v); }
function add(parts, playerId, campo, valor) { const p = parts.find(x => x.player_id === playerId); if (p) p[campo] += valor; }
