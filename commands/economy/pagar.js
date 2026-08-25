/* ========================================================================
   ARQUIVO: commands/economy/pagar.js (PADRÃO WARCOINS)
   ======================================================================== */
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
const economyPath = path.join(__dirname, 'economy.json');
const CANAL_MERCADO = '1441499321810813001';

module.exports = {
    data: new SlashCommandBuilder().setName('pagar').setDescription('💸 Enviar WarCoins.').addUserOption(o => o.setName('soldado').setRequired(true).setDescription('Destinatário')).addIntegerOption(o => o.setName('valor').setRequired(true).setDescription('Quantia')),
    async execute(interaction) {
        if (interaction.channel.id !== CANAL_MERCADO) return interaction.reply({ content: `❌ Apenas no <#${CANAL_MERCADO}>.`, flags: MessageFlags.Ephemeral });
        const p1 = interaction.user; const p2 = interaction.options.getUser('soldado'); const v = interaction.options.getInteger('valor');
        if (p1.id === p2.id || p2.bot) return interaction.reply({ content: '❌ Inválido.', flags: MessageFlags.Ephemeral });

        const db = safeReadJson(economyPath);
        if ((db[p1.id] || 0) < v) return interaction.reply({ content: `❌ Saldo insuficiente.`, flags: MessageFlags.Ephemeral });

        db[p1.id] -= v; db[p2.id] = (db[p2.id] || 0) + v;
        safeWriteJson(economyPath, db);
        await interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`💸 **Transferência:** ${p1} enviou **${v} WarCoins** para ${p2}.`)] });
    }
};