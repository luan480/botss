/* ========================================================================
   ARQUIVO: commands/economy/saldo.js (COMPLETO E CENTRALIZADO)
   ======================================================================== */
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');
const config = require('../../config.json');

const economyPath = path.join(__dirname, 'economy.json');
const CANAL_MERCADO = config.mercadoChannelId;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('saldo')
        .setDescription('💰 Verifica seus WarCoins.')
        .addUserOption(opt => opt.setName('soldado').setDescription('Ver outro soldado')),
        
    async execute(interaction) {
        if (interaction.channel.id !== CANAL_MERCADO) {
            return interaction.reply({ content: `❌ Use o <#${CANAL_MERCADO}>.`, flags: MessageFlags.Ephemeral });
        }
        
        const target = interaction.options.getUser('soldado') || interaction.user;
        const economy = safeReadJson(economyPath);
        const saldo = economy[target.id] || 0;

        const embed = new EmbedBuilder()
            .setTitle(`🗄️ COFRE: ${target.username.toUpperCase()}`)
            .setDescription(`**Recursos Disponíveis:**\n# 💰 ${saldo} WarCoins`)
            .setColor('#FFD700')
            .setThumbnail(target.displayAvatarURL());
            
        await interaction.reply({ embeds: [embed] });
    }
};