// =============================================================
//  MODO DEMONSTRAÇÃO — dados fictícios para navegar sem Supabase.
//  Ativa com ?demo=1 na URL (ou pelo botão na tela de login).
//  Nada é salvo; serve só para ver o site funcionando.
// =============================================================
export function demoAtivo() {
  try {
    if (new URLSearchParams(location.search).has("demo")) localStorage.setItem("golf_demo", "1");
    return localStorage.getItem("golf_demo") === "1";
  } catch { return false; }
}
export function sairDemo() { try { localStorage.removeItem("golf_demo"); } catch {} }

const P = [
  { id: "p1", nome: "Rafael", handicap: 12, ativo: true },
  { id: "p2", nome: "Bruno", handicap: 8, ativo: true },
  { id: "p3", nome: "Carlos", handicap: 18, ativo: true },
  { id: "p4", nome: "Diego", handicap: 15, ativo: true },
  { id: "p5", nome: "Eduardo", handicap: 22, ativo: true },
];

// helper p/ participantes
const rp = (round_id, player_id, gross, putts, fw, gir) =>
  ({ round_id, player_id, gross_score: gross, putts, fairways_hit: fw, fairways_tot: 14, gir, gir_tot: 18 });

const rounds = [
  { id: "r1", data: "2026-02-08", observacoes: "Abertura da temporada, dia firme.", modo: "simples", finalizada: true },
  { id: "r2", data: "2026-03-15", observacoes: "Vento forte no fundo.", modo: "simples", finalizada: true },
  { id: "r3", data: "2026-04-19", observacoes: "", modo: "simples", finalizada: true },
  { id: "r4", data: "2026-05-24", observacoes: "Churrasco depois 🍖", modo: "simples", finalizada: true },
];

const participants = [
  // r1
  rp("r1", "p1", 89, 33, 6, 7), rp("r1", "p2", 82, 30, 9, 10), rp("r1", "p3", 95, 36, 4, 5),
  rp("r1", "p4", 91, 34, 5, 6), rp("r1", "p5", 102, 39, 3, 3),
  // r2
  rp("r2", "p1", 85, 31, 7, 8), rp("r2", "p2", 84, 32, 8, 9), rp("r2", "p3", 92, 35, 5, 6),
  rp("r2", "p4", 88, 33, 6, 7),
  // r3
  rp("r3", "p1", 83, 30, 8, 9), rp("r3", "p2", 86, 33, 7, 8), rp("r3", "p3", 90, 34, 6, 6),
  rp("r3", "p4", 87, 32, 7, 7), rp("r3", "p5", 98, 37, 4, 4),
  // r4
  rp("r4", "p1", 80, 29, 9, 11), rp("r4", "p2", 81, 30, 9, 10), rp("r4", "p3", 88, 33, 6, 7),
  rp("r4", "p5", 94, 36, 5, 5),
];

const indMatches = [
  { id: "i1", round_id: "r1", player_a: "p1", player_b: "p2", resultado: "B", placar: "3&2" },
  { id: "i2", round_id: "r1", player_a: "p3", player_b: "p4", resultado: "B", placar: "1up" },
  { id: "i3", round_id: "r2", player_a: "p1", player_b: "p2", resultado: "EMPATE", placar: "AS" },
  { id: "i4", round_id: "r3", player_a: "p1", player_b: "p2", resultado: "A", placar: "2&1" },
  { id: "i5", round_id: "r3", player_a: "p3", player_b: "p4", resultado: "A", placar: "4&3" },
  { id: "i6", round_id: "r4", player_a: "p1", player_b: "p2", resultado: "A", placar: "1up" },
  { id: "i7", round_id: "r4", player_a: "p3", player_b: "p5", resultado: "A", placar: "5&4" },
];

const teamMatches = [
  { id: "t1", round_id: "r1", t1_p1: "p1", t1_p2: "p3", t2_p1: "p2", t2_p2: "p4", resultado: "T2" },
  { id: "t2", round_id: "r3", t1_p1: "p1", t1_p2: "p4", t2_p1: "p2", t2_p2: "p3", resultado: "T1" },
  { id: "t3", round_id: "r4", t1_p1: "p1", t1_p2: "p2", t2_p1: "p3", t2_p2: "p5", resultado: "T1" },
];

export const demoTemporada = { players: P, rounds, participants, indMatches, teamMatches };

export function demoRodada(id) {
  return {
    round: rounds.find(r => r.id === id),
    participants: participants.filter(p => p.round_id === id),
    indMatches: indMatches.filter(m => m.round_id === id),
    teamMatches: teamMatches.filter(m => m.round_id === id),
  };
}
