/* ========================================================================
   WRAPPER DA LIGA — handleReverter

   Anula a partida no motor existente e depois reconstrói a pontuação da
   temporada somente com as partidas que continuam válidas.
   Também força a atualização do painel da Liga após a anulação.
   ======================================================================== */

const path = require('path');
const core = require('./handleReverterCore.js');
const pontuacaoLiga = require('../utils/pontuacaoLiga.js');
const painelLiga = require('../painel.js');

const CANAL_PAINEL_LIGA = '1543636868682354748';

module.exports = async function handleReverter(...args) {
    const interaction = args[1];
    const pontuacaoPath = args[2];
    const partidasPath = args[3];
    const temporadaPath = path.join(__dirname, '..', 'temporada.json');

    pontuacaoLiga.prepararFormatoAntigo(pontuacaoPath);

    try {
        return await core(...args);
    } finally {
        pontuacaoLiga.sincronizarArquivo(
            pontuacaoPath,
            partidasPath,
            temporadaPath
        );

        try {
            if (interaction?.guild) {
                await painelLiga(interaction.guild, CANAL_PAINEL_LIGA);
            }
        } catch (erroPainel) {
            console.error('[LIGA] Falha ao atualizar painel após revert:', erroPainel);
        }
    }
};
