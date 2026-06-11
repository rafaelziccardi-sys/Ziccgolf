// =============================================================
//  CONFIGURAÇÃO  ->  preencha com os dados do seu projeto Supabase
//  (Project Settings -> API -> Project URL e anon public key)
// =============================================================
export const SUPABASE_URL  = "https://ijomctzkxfvekbiovkmq.supabase.co";
export const SUPABASE_ANON  = "sb_publishable_s00-yjYStyJnwqwksyOXSQ_elsW9b7B";

// Nome da plataforma exibido no topo
export const APP_NOME = "Ziccgolf";

// E-mails que podem CRIAR novos grupos (donos da plataforma).
// (a permissão também é validada no banco, na função criar_grupo)
export const ADMIN_EMAILS = ["rafael.ziccardi@gmail.com"];

// ---- Regras de pontuação (ajuste à vontade) ----
export const PONTOS = {
  // Stroke Play por colocação no dia (índice 0 = 1º lugar)
  stroke: [10, 7, 5, 3],   // 1º,2º,3º,4º
  strokeDemais: 1,         // 5º em diante
  matchInd: { vitoria: 3, empate: 1, derrota: 0 },
  matchDupla: { vitoria: 2, empate: 1, derrota: 0 },
};

// Ranking GERAL conta só o Stroke Play? (true = só stroke; false = soma match play)
export const RANKING_INCLUI_MATCH = false;

// Ranking oficial = média de pontos/rodada.
// Para se qualificar, jogar pelo menos este % das rodadas do ano (mín. 3).
export const QUALIFICACAO_PCT = 0.30;
export const QUALIFICACAO_MIN = 3;

// Par de cada buraco do campo (sempre o mesmo campo). Buraco 1 = índice 0.
export const PAR_BURACOS = [3, 4, 5, 4, 3, 3, 5, 3, 4,  4, 4, 4, 5, 4, 3, 4, 4, 5];
export const PAR_TOTAL = PAR_BURACOS.reduce((a, b) => a + b, 0); // 71
// FIR (fairway) não se aplica a par 3 — total de buracos onde dá pra acertar o fairway.
export const N_FAIRWAYS = PAR_BURACOS.filter(p => p !== 3).length; // 13
