import { PONTOS, QUALIFICACAO_PCT, QUALIFICACAO_MIN, RANKING_INCLUI_MATCH, PAR_TOTAL } from "../config.js";

export default async function renderRegras(app) {
  const s = PONTOS.stroke;
  app.innerHTML = `
    <section class="hero"><h1>Regras do ranking</h1><p class="hero-sub">Como os pontos e as posições são calculados</p></section>

    <div class="card-box">
      <div class="card-head"><span>🏆 Ranking geral</span></div>
      <p class="regra-p">O ranking geral é calculado <b>somente com o Stroke Play</b>${RANKING_INCLUI_MATCH ? " somado ao Match Play" : ""}.
      Cada rodada, o jogador ganha pontos pela sua <b>colocação no dia</b> (considerando só quem jogou aquela rodada):</p>
      <div class="tabela-wrap"><table class="tabela">
        <thead><tr><th>Colocação</th><th>Pontos</th></tr></thead>
        <tbody>
          <tr><td class="td-nome">1º lugar</td><td>${s[0]}</td></tr>
          <tr><td class="td-nome">2º lugar</td><td>${s[1]}</td></tr>
          <tr><td class="td-nome">3º lugar</td><td>${s[2]}</td></tr>
          <tr><td class="td-nome">4º lugar</td><td>${s[3]}</td></tr>
          <tr><td class="td-nome">5º em diante</td><td>${PONTOS.strokeDemais}</td></tr>
        </tbody>
      </table></div>
      <p class="regra-obs">Empates dividem a mesma colocação (ex.: dois jogadores em 2º → ambos levam ${s[1]}, e o próximo é 4º).</p>
    </div>

    <div class="card-box">
      <div class="card-head"><span>📊 Dois rankings</span></div>
      <ul class="regra-lista">
        <li><b>Por média de pontos/rodada (oficial)</b> — total de pontos ÷ rodadas jogadas. É o ranking principal, para não dar vantagem a quem joga mais.
          Para se qualificar é preciso ter jogado pelo menos <b>${Math.round(QUALIFICACAO_PCT * 100)}% das rodadas do ano</b> (mínimo ${QUALIFICACAO_MIN}).</li>
        <li><b>Por pontuação total</b> — soma bruta dos pontos no ano. Reconhece quem mais comparece.</li>
      </ul>
    </div>

    <div class="card-box">
      <div class="card-head"><span>⚔️ Match Play (rankings próprios)</span></div>
      <p class="regra-p">Os confrontos têm <b>abas próprias</b> (individual e duplas) com vitórias, empates, derrotas e aproveitamento — mas ${RANKING_INCLUI_MATCH ? "também somam pontos no ranking geral" : "<b>não somam pontos no ranking geral</b>"}.</p>
      <div class="grid-destaques">
        <div class="destaque-item"><div class="dq-label">Individual</div><div class="dq-valor">V ${PONTOS.matchInd.vitoria} · E ${PONTOS.matchInd.empate} · D ${PONTOS.matchInd.derrota}</div></div>
        <div class="destaque-item"><div class="dq-label">Duplas (cada jogador)</div><div class="dq-valor">V ${PONTOS.matchDupla.vitoria} · E ${PONTOS.matchDupla.empate} · D ${PONTOS.matchDupla.derrota}</div></div>
      </div>
      <p class="regra-obs">Aproveitamento % = (vitórias + empates×0,5) ÷ jogos.</p>
    </div>

    <div class="card-box">
      <div class="card-head"><span>🏁 Quando a rodada conta</span></div>
      <p class="regra-p">Uma rodada só entra no ranking depois de <b>finalizada</b>. Durante o jogo ela fica "em andamento" e os scores aparecem ao vivo, mas só contam no placar quando alguém clica em <b>Finalizar jogo</b>.</p>
    </div>

    <div class="card-box">
      <div class="card-head"><span>⛳ O campo</span></div>
      <p class="regra-p">Par do campo: <b>${PAR_TOTAL}</b>. O score de cada jogador é comparado ao par para gerar birdies, pars, bogeys e o "vs par". FIR (fairway) não se aplica aos buracos par 3.</p>
    </div>`;
}
