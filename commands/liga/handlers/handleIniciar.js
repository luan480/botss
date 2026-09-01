/* ========================================================================
   WRAPPER DA LIGA — handleIniciar

   O motor antigo continua intacto em handleIniciarCore.js.
   Este arquivo apenas garante que pontuacao.json permaneça organizado
   e compatível com o motor antigo.
   ======================================================================== */

const path = require('path');
const core = require('./handleIniciarCore.js');
const pontuacaoLiga = require('../utils/pontuacaoLiga.js');

const PONTUACAO_PADRAO = path.join(__dirname, '..', 'pontuacao.json');
const PARTIDAS_PADRAO = path.join(__dirname, '..', 'partidas.json');
const TEMPORADA_PADRAO = path.join(__dirname, '..', 'temporada.json');

module.exports = async function handleIniciar(...args) {
    // Alguns chamadores antigos enviam somente o caminho da pontuação.
    // Nunca deixe partidasPath como undefined: o core consegue resolver
    // o caminho por conta própria, mas o sincronizador não pode adivinhar.
    const pontuacaoPath =
        typeof args[2] === 'string' && args[2].trim()
            ? args[2]
            : PONTUACAO_PADRAO;

    const partidasPath =
        typeof args[3] === 'string' && args[3].trim()
            ? args[3]
            : PARTIDAS_PADRAO;

    const temporadaPath = TEMPORADA_PADRAO;

    // O motor antigo recebe somente { id: pontos }.
    pontuacaoLiga.prepararFormatoAntigo(pontuacaoPath);

    // Garante que o core e o finally usem exatamente os mesmos caminhos,
    // mesmo quando o chamador não passou partidasPath.
    const argsCorrigidos = [...args];
    argsCorrigidos[2] = pontuacaoPath;
    argsCorrigidos[3] = partidasPath;

    try {
        return await core(...argsCorrigidos);
    } finally {
        // Depois da partida, volta a guardar o estado completo da temporada.
        // Agora a sincronização sempre lê o partidas.json correto.
        pontuacaoLiga.sincronizarArquivo(
            pontuacaoPath,
            partidasPath,
            temporadaPath
        );
    }
};
