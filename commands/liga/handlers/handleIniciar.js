/* ========================================================================
   WRAPPER DA LIGA — handleIniciar

   O motor antigo continua intacto em handleIniciarCore.js.
   Este arquivo apenas garante que pontuacao.json permaneça organizado
   e compatível com o motor antigo.
   ======================================================================== */

const path = require('path');
const core = require('./handleIniciarCore.js');
const pontuacaoLiga = require('../utils/pontuacaoLiga.js');

module.exports = async function handleIniciar(...args) {
    const pontuacaoPath = args[2];
    const partidasPath = args[3];
    const temporadaPath = path.join(__dirname, '..', 'temporada.json');

    // O motor antigo recebe somente { id: pontos }.
    pontuacaoLiga.prepararFormatoAntigo(pontuacaoPath);

    try {
        return await core(...args);
    } finally {
        // Depois da partida, volta a guardar o estado completo da temporada.
        pontuacaoLiga.sincronizarArquivo(
            pontuacaoPath,
            partidasPath,
            temporadaPath
        );
    }
};
