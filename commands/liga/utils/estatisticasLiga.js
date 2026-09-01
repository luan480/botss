/* ========================================================================
   WRAPPER DA LIGA — estatisticasLiga
   Compatibilidade com módulos antigos que ainda esperam pontuacao.json
   no formato { id: pontos }.
   ======================================================================== */

const path = require('path');
const core = require('./estatisticasLigaCore.js');
const pontuacaoLiga = require('./pontuacaoLiga.js');

const pontuacaoPath = path.join(__dirname, '..', 'pontuacao.json');
const partidasPath = path.join(__dirname, '..', 'partidas.json');
const temporadaPath = path.join(__dirname, '..', 'temporada.json');

function executar(nome, args) {
    pontuacaoLiga.prepararFormatoAntigo(pontuacaoPath);
    try {
        return core[nome](...args);
    } finally {
        pontuacaoLiga.sincronizarArquivo(pontuacaoPath, partidasPath, temporadaPath);
    }
}

module.exports = {
    carregarPartidas: (...args) => core.carregarPartidas(...args),
    carregarPontuacao: (...args) => executar('carregarPontuacao', args),
    criarPerfil: (...args) => core.criarPerfil(...args),
    calcularEstatisticas: (...args) => executar('calcularEstatisticas', args),
    calcularPerfil: (...args) => executar('calcularPerfil', args),
    rankingPorPontos: (...args) => executar('rankingPorPontos', args),
    rankingPorVitorias: (...args) => executar('rankingPorVitorias', args),
    rankingPorKills: (...args) => executar('rankingPorKills', args),
    rankingPorMortes: (...args) => executar('rankingPorMortes', args),
    rankingPorContinentes: (...args) => executar('rankingPorContinentes', args),
    rankingPorEuropa: (...args) => executar('rankingPorEuropa', args),
    rankingPorAsia: (...args) => executar('rankingPorAsia', args),
    rankingPorAfrica: (...args) => executar('rankingPorAfrica', args),
    rankingPorAmericaDoNorte: (...args) => executar('rankingPorAmericaDoNorte', args),
    rankingPorAmericaDoSul: (...args) => executar('rankingPorAmericaDoSul', args),
    rankingPorOceania: (...args) => executar('rankingPorOceania', args),
    rankingPorWinrate: (...args) => executar('rankingPorWinrate', args),
    rankingPorWarCoins: (...args) => executar('rankingPorWarCoins', args),
    resumoLiga: (...args) => executar('resumoLiga', args)
};
