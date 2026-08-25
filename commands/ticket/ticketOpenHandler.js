/* ========================================================================
   ARQUIVO: commands/ticket/ticketOpenHandler.js (COMPLETO E SEGURO)
   ======================================================================== */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');
const config = require('../../config.json');

const ID_CARGO_ADM = config.roles.admin;
const ID_CARGO_MOD = config.roles.mod;
const CATEGORIA_SUPORTE = config.suporteCategoryId;

module.exports = async (interaction, client) => {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const member = interaction.member;
    const channelName = `ticket-${member.user.username.substring(0, 10)}`;

    try {
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CATEGORIA_SUPORTE,
            topic: `Ticket aberto por ${member.user.tag} (ID: ${member.id})`, 
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: member.id,
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.ReadMessageHistory,
                        PermissionsBitField.Flags.AttachFiles
                    ],
                },
                { id: ID_CARGO_ADM, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: ID_CARGO_MOD, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle(`Bem-vindo, ${member.displayName}!`)
            .setDescription(`Por favor, descreva sua denúncia ou dúvida em detalhes. Um membro da Staff (<@&${ID_CARGO_ADM}> ou <@&${ID_CARGO_MOD}>) virá ajudá-lo em breve.\n\nPara fechar este ticket, use o comando \`/fechar-ticket\`.`)
            .setColor('Green');
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_fechar') 
                .setLabel('Fechar Ticket')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({
            content: `${member} <@&${ID_CARGO_ADM}> <@&${ID_CARGO_MOD}>`,
            embeds: [embed],
            components: [row]
        });

        await interaction.editReply({
            content: `✅ Seu ticket foi aberto com sucesso no canal ${ticketChannel}!`,
            ephemeral: true
        });

    } catch (err) {
        console.error("Erro ao criar ticket:", err);
        await interaction.editReply({
            content: '❌ Ocorreu um erro ao criar seu ticket. Por favor, contate um admin diretamente.',
            ephemeral: true
        });
    }
};