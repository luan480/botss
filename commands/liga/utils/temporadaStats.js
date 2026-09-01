/* ========================================================================
   COMPATIBILIDADE DO MOTOR ANTIGO DE TEMPORADA

   Este arquivo não calcula uma segunda versão reduzida das estatísticas.
   Ele delega tudo ao motor oficial de periodosLiga.js para que partidas,
   vitórias, kills, mortes, continentes, pontos e WarCoins tenham sempre a
   mesma origem.
   ======================================================================== */

const path = require('path');
const { calcularPeriodo, inicioDaTemporada } = require('./periodosLiga.js');

const PARTIDAS_PATH = path.join(__dirname, '..', 'partidas.json');

function normalizarData(valor, fallback) {
    const data = valor ? new Date(valor) : new Date(fallback);
    return Number.isFinite(data.getTime()) ? data : new Date(fallback);
}

function calcular(inicioIso, pontuacaoAtual = null) {
    const fim = new Date();
    const inicioPadrao = inicioDaTemporada(fim);
    const inicio = normalizarData(inicioIso, inicioPadrao);
    const periodo = calcularPeriodo(inicio, fim);

    // O histórico é responsável pelas estatísticas. O saldo atual continua
    // vindo de pontuacao.json, inclusive punições/ajustes negativos.
    if (pontuacaoAtual && typeof pontuacaoAtual === 'object') {
        for (const [id, valor] of Object.entries(pontuacaoAtual)) {
            if (!/^\d{15,22}$/.test(String(id))) continue;
            const atual = valor && typeof valor === 'object'
                ? Number(valor.pontos ?? valor.ptsLiga ?? valor.pontuacao)
                : Number(valor);
            if (!Number.isFinite(atual)) continue;
            if (!periodo.jogadores[id]) {
                periodo.jogadores[id] = {
                    id: String(id),
                    partidas: 0,
                    vitorias: 0,
                    derrotas: 0,
                    pontos: atual,
                    pontosGanhos: 0,
                    pontosPerdidos: 0,
                    kills: 0,
                    mortes: 0,
                    continentes: 0,
                    europa: 0,
                    asia: 0,
                    africa: 0,
                    amnorte: 0,
                    amsul: 0,
                    oceania: 0,
                    warCoins: 0,
                    primeiroLugar: 0,
                    segundoLugar: 0,
                    terceiroLugar: 0,
                    maisTropas: 0,
                    winrate: 0
                };
            } else {
                periodo.jogadores[id].pontos = atual;
            }
        }
    }

    return periodo.jogadores;
}

module.exports = { calcular, PARTIDAS_PATH };
