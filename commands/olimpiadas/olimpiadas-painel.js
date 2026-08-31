/* ========================================================================
   WORLDWARBR — PAINEL DAS OLIMPÍADAS DE DUPLAS
   Localização: commands/olimpiadas/olimpiadas-painel.js
   Função: comando /olimpiadas-painel para publicar o painel no canal definido.
   ======================================================================== */
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { painel } = require('./olimpiadas-handler.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('olimpiadas-painel')
    .setDescription('🏅 Publica o painel das Olimpíadas de Duplas.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    return painel(interaction);
  }
};
