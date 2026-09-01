/* ========================================================================
   WRAPPER DO PAINEL DA LIGA

   - Redireciona o painel automático para o canal oficial atual.
   - Mantém liga.js livre para escolher outro canal manualmente.
   - Converte pontuacao.json temporariamente para o formato legado usado
     pelo painel antigo e restaura o formato organizado depois.
   ======================================================================== */

const path = require('path');
const core = require('./painelCore.js');
const pontuacaoLiga = require('./utils/pontuacaoLiga.js');

const CANAL_PAINEL_LIGA = '1543636868682354748';
const CANAL_ANTIGO_AUTOMATICO = '1429504377395351854';

module.exports = async function painelLiga(guild, canalId) {
    const pontuacaoPath = path.join(__dirname, 'pontuacao.json');
    const partidasPath = path.join(__dirname, 'partidas.json');
    const temporadaPath = path.join(__dirname, 'temporada.json');

    const canalFinal = String(canalId) === CANAL_ANTIGO_AUTOMATICO
        ? CANAL_PAINEL_LIGA
        : canalId;

    pontuacaoLiga.prepararFormatoAntigo(pontuacaoPath);

    try {
        return await core(guild, canalFinal);
    } finally {
        pontuacaoLiga.sincronizarArquivo(
            pontuacaoPath,
            partidasPath,
            temporadaPath
        );
    }
};
