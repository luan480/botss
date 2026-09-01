/* ========================================================================
   WRAPPER DO PAINEL DA LIGA
   ======================================================================== */

const CANAL_PAINEL_LIGA = '1543636868682354748';
const CANAL_ANTIGO_AUTOMATICO = '1429504377395351854';
const core = require('./painelCore.js');

module.exports = async function painelLiga(guild, canalId) {
    const canalFinal = String(canalId || '') === CANAL_ANTIGO_AUTOMATICO
        ? CANAL_PAINEL_LIGA
        : String(canalId || CANAL_PAINEL_LIGA);
    return core(guild, canalFinal);
};
