/* ========================================================================
   WRAPPER DA LIGA — handleReverter

   Faz a anulação usando o handler original e, em seguida, reconstrói
   pontuacao.json a partir das partidas que realmente continuam válidas.

   Isso impede que o revert desconte duas vezes ou desconte o valor errado.
   ======================================================================== */

const path = require('path');
const core = require('./handleReverterCore.js');
const pontuacaoLiga = require('../utils/pontuacaoLiga.js');

module.exports = async function handleReverter(...args) {
    const pontuacaoPath = args[2];
    const partidasPath = args[3];
    const temporadaPath = path.join(__dirname, '..', 'temporada.json');

    // O handler antigo trabalha com números simples.
    pontuacaoLiga.prepararFormatoAntigo(pontuacaoPath);

    try {
        return await core(...args);
    } finally {
        // A partida anulada já foi removida pelo core.
        // Portanto, os 8 indicadores da temporada são reconstruídos somente
        // com o que ainda existe na Caixa Preta.
        pontuacaoLiga.sincronizarArquivo(
            pontuacaoPath,
            partidasPath,
            temporadaPath
        );
    }
};
