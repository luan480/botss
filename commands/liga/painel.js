/* ========================================================================
   WRAPPER DO PAINEL DA LIGA
   ======================================================================== */

const path = require('path');
const CANAL_PAINEL_LIGA = '1543636868682354748';
const CANAL_ANTIGO_AUTOMATICO = '1429504377395351854';
const core = require('./painelCore.js');
const { safeReadJson, safeWriteJson } = require('./utils/helpers.js');
const { organizarPartidas } = require('./utils/organizarPartidas.js');

const PARTIDAS_PATH = path.join(__dirname, 'partidas.json');

function organizarHistoricoPartidas() {
    try {
        const atual = safeReadJson(PARTIDAS_PATH) || {};
        const organizado = organizarPartidas(atual);
        safeWriteJson(PARTIDAS_PATH, organizado);
    } catch (erro) {
        console.error('[LIGA] Não foi possível organizar partidas.json:', erro);
    }
}

module.exports = async function painelLiga(guild, canalId) {
    // O histórico é organizado antes de qualquer leitura do painel.
    // Isso também migra registros antigos sem apagar dados.
    organizarHistoricoPartidas();

    const canalFinal = String(canalId || '') === CANAL_ANTIGO_AUTOMATICO
        ? CANAL_PAINEL_LIGA
        : String(canalId || CANAL_PAINEL_LIGA);
    return core(guild, canalFinal);
};
