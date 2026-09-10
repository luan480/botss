/* ========================================================================
   WRAPPER DO PAINEL DA LIGA
   ======================================================================== */

const CANAL_PAINEL_LIGA = '1543636868682354748';
const CANAL_ANTIGO_AUTOMATICO = '1429504377395351854';
const core = require('./painelCore.js');
const { criarCanalAdaptado } = require('./painelVisual.js');

module.exports = async function painelLiga(guild, canalId) {
    const canalFinal = String(canalId || '') === CANAL_ANTIGO_AUTOMATICO
        ? CANAL_PAINEL_LIGA
        : String(canalId || CANAL_PAINEL_LIGA);

    /*
       O painelCore continua responsável por toda a lógica da Liga.
       Criamos apenas uma visão isolada da guild para que o canal usado pelo
       painel tenha o payload visual normalizado sem alterar o Discord.js
       globalmente nem interferir em outros comandos do bot.
    */
    const guildAdaptada = Object.create(guild);
    const channelsAdaptados = Object.create(guild.channels);

    channelsAdaptados.fetch = async (...args) => {
        const canal = await guild.channels.fetch(...args);
        return criarCanalAdaptado(canal);
    };

    guildAdaptada.channels = channelsAdaptados;

    return core(guildAdaptada, canalFinal);
};
