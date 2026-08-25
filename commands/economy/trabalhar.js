/* ========================================================================
   ARQUIVO: commands/economy/trabalhar.js (PADRÃO WARCOINS)
   ======================================================================== */
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
const economyPath = path.join(__dirname, 'economy.json');
const cooldownsPath = path.join(__dirname, 'cooldowns.json');
const CANAL_MERCADO = '1441499321810813001';
const missoes = ["saqueou um bunker", "vendeu munição", "interceptou suprimentos", "cobrou proteção", "encontrou ouro", "cumpriu contrato", "vendeu informações", "resgatou reféns"];

module.exports = {
    data: new SlashCommandBuilder().setName('trabalhar').setDescription('🪖 Realize uma missão.'),
    async execute(interaction) {
        if (interaction.channel.id !== CANAL_MERCADO) return interaction.reply({ content: `❌ Missões apenas no <#${CANAL_MERCADO}>.`, flags: MessageFlags.Ephemeral });
        const userId = interaction.user.id;
        const cooldowns = safeReadJson(cooldownsPath);
        const economy = safeReadJson(economyPath);
        const ultimo = cooldowns[userId]?.trabalho || 0;
        const agora = Date.now();
        if (agora - ultimo < 3600000) return interaction.reply({ content: `⏳ Aguarde **${Math.floor((3600000 - (agora - ultimo)) / 60000)} minutos**.`, flags: MessageFlags.Ephemeral });
        
        const pagamento = Math.floor(Math.random() * (100 - 20 + 1)) + 20;
        economy[userId] = (economy[userId] || 0) + pagamento;
        safeWriteJson(economyPath, economy);
        cooldowns[userId] = { ...cooldowns[userId], trabalho: agora };
        safeWriteJson(cooldownsPath, cooldowns);

        await interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`🪖 **MISSÃO CUMPRIDA!**\n${interaction.user} **${missoes[Math.floor(Math.random() * missoes.length)]}** e lucrou **${pagamento} WarCoins**.`)] });
    }
};