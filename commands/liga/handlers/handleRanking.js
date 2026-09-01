/* ========================================================================
   WRAPPER DA LIGA — handleRanking
   Mantém o ranking antigo funcionando com o novo pontuacao.json.
   ======================================================================== */

const path = require('path');
const core = require('./handleRankingCore.js');
const pontuacaoLiga = require('../utils/pontuacaoLiga.js');

module.exports = async function handleRanking(interaction, pontuacaoPath) {
    const partidasPath = path.join(__dirname, '..', 'partidas.json');
    const temporadaPath = path.join(__dirname, '..', 'temporada.json');

    pontuacaoLiga.prepararFormatoAntigo(pontuacaoPath);

    try {
        return await core(interaction, pontuacaoPath);
    } finally {
        pontuacaoLiga.sincronizarArquivo(
            pontuacaoPath,
            partidasPath,
            temporadaPath
        );
    }
};
