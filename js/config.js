// =============================================================
//  CONFIGURAÇÃO  ->  preencha com os dados do seu projeto Supabase
//  (Project Settings -> API -> Project URL e anon public key)
// =============================================================
export const SUPABASE_URL  = "COLE_AQUI_SUA_PROJECT_URL";
export const SUPABASE_ANON  = "COLE_AQUI_SUA_ANON_PUBLIC_KEY";

// Nome do clube/grupo exibido no topo
export const APP_NOME = "Golf Club";

// ---- Regras de pontuação (ajuste à vontade) ----
export const PONTOS = {
  // Stroke Play por colocação no dia (índice 0 = 1º lugar)
  stroke: [10, 7, 5, 3],   // 1º,2º,3º,4º
  strokeDemais: 1,         // 5º em diante
  matchInd: { vitoria: 3, empate: 1, derrota: 0 },
  matchDupla: { vitoria: 2, empate: 1, derrota: 0 },
};

// Ranking oficial = média de pontos/rodada.
// Para se qualificar, jogar pelo menos este % das rodadas do ano (mín. 3).
export const QUALIFICACAO_PCT = 0.30;
export const QUALIFICACAO_MIN = 3;
