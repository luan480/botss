/* ========================================================================
   ARQUIVO: commands/economy/rank-money.js (PADRÃO WARCOINS)
   ======================================================================== */
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');
const economyPath = path.join(__dirname, 'economy.json');
const CANAL_MERCADO = '1441499321810813001';

module.exports = {
    data: new SlashCommandBuilder().setName('top-grana').setDescription('💎 Ranking de WarCoins.'),
    async execute(interaction) {
        if (interaction.channel.id !== CANAL_MERCADO) return interaction.reply({ content: `❌ Veja no <#${CANAL_MERCADO}>.`, flags: MessageFlags.Ephemeral });
        const economy = safeReadJson(economyPath);
        const ricos = Object.entries(economy).map(([id, saldo]) => ({ id, saldo })).sort((a, b) => b.saldo - a.saldo).slice(0, 10);

        let desc = "";
        const emojis = ['💎', '🥇', '🥈', '🥉', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        for (let i = 0; i < ricos.length; i++) {
            const e = i < 4 ? emojis[i] : `**${i + 1}º**`;
            desc += `${e} <@${ricos[i].id}> — **${ricos[i].saldo} WarCoins**\n`;
        }
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('💎 MAGNATAS WARGROW').setDescription(desc || 'Sem dados.').setColor('#9b59b6')] });
    }
};