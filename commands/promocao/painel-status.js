/* ========================================================================
   ARQUIVO: commands/promocao/painel-status.js
   DESCRIÇÃO: Painel de Status do Sistema de Promoção (Guilda)
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('painel-status')
        .setDescription('Envia o painel para consultar status da Carreira/Promoção.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Status da Carreira')
            .setDescription('Clique abaixo para consultar a **Ficha Militar**, **Patente** e **Vitórias** de um membro no sistema da Guilda.')
            .setColor('#Gold') 
            .setThumbnail('https://i.imgur.com/XFv0Hl7.png'); // (Exemplo de imagem)

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('stt_btn_ver') // Botão de Status
                .setLabel('Ver Ficha / Status')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    }
};