/* ========================================================================
   WRAPPER DA LIGA — handleRanking

   O ranking lê diretamente o estado estruturado da temporada.
   Não converte pontuacao.json para o formato antigo e não altera o arquivo
   apenas para exibir o ranking.
   ======================================================================== */

const path = require('path');
const core = require('./handleRankingCore.js');

module.exports = async function handleRanking(interaction, pontuacaoPath) {
    const partidasPath = path.join(__dirname, '..', 'partidas.json');
    const temporadaPath = path.join(__dirname, '..', 'temporada.json');

    return core(
        interaction,
        pontuacaoPath,
        partidasPath,
        temporadaPath
    );
};
