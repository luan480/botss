/* ========================================================================
   WORLDWARBR — OLIMPÍADAS DE DUPLAS
   ARQUIVO: commands/olimpiadas/olimpiadas-painel.js

   COMANDO:
   /olimpiadas-painel
   ======================================================================== */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');

const olimp = require('./olimpiadas-handler.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('olimpiadas-painel')
        .setDescription('🏅 Publica o painel das Olimpíadas de Duplas.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral
                });
            }

            const replyOriginal = interaction.reply?.bind(interaction);
            if (interaction.reply) {
                interaction.reply = options => interaction.editReply(options);
            }

            try {
                return await olimp.painel(interaction);
            } finally {
                if (replyOriginal) interaction.reply = replyOriginal;
            }
        } catch (erro) {
            console.error('[OLIMPIADAS] Erro no /olimpiadas-painel:', erro);

            if (interaction.deferred || interaction.replied) {
                return interaction.editReply({
                    content: '❌ Não foi possível publicar o painel das Olimpíadas.'
                }).catch(() => {});
            }

            return interaction.reply({
                content: '❌ Não foi possível publicar o painel das Olimpíadas.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }
};
