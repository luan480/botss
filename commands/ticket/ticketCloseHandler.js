/* ========================================================================
   ARQUIVO: commands/ticket/ticketCloseHandler.js (V5 - Limpo)
   ======================================================================== */

const { EmbedBuilder, Colors } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js'); 

const logConfigPath = path.join(__dirname, '../adm/log_config.json');

async function handleTicketClose(interaction, client) {
    const channel = interaction.channel;
    
    if (!channel.name.startsWith('ticket-')) {
        return interaction.reply({ content: '❌ Canal inválido.', ephemeral: true });
    }

    const userIdMatch = channel.topic ? channel.topic.match(/ID: (\d+)/) : null;
    const userId = userIdMatch ? userIdMatch[1] : null;

    // 1. Avisa no canal
    const embedAviso = new EmbedBuilder()
        .setDescription('🔒 **Fechando Ticket...**\nDeletando canal em 5s.')
        .setColor(Colors.Red);

    await interaction.reply({ embeds: [embedAviso] });

    // Gera o arquivo (apenas para LOGS)
    const attachment = await discordTranscripts.createTranscript(channel, {
        filename: `transcricao-${channel.name}.html`,
        saveImages: true,
        poweredBy: false 
    });

    // 2. Envia DM para o usuário (APENAS O EMBED, SEM ARQUIVO)
    if (userId) {
        try {
            const user = await client.users.fetch(userId);
            const embedDM = new EmbedBuilder()
                .setTitle('Ticket Fechado')
                .setDescription(`O seu ticket **${channel.name}** no servidor **${interaction.guild.name}** foi encerrado.`)
                .addFields({ name: 'Status', value: 'Atendimento finalizado.' })
                .setColor(Colors.Blue)
                .setTimestamp();

            await user.send({ embeds: [embedDM] }); // <--- SEM FILES AQUI

        } catch (err) {
            console.warn(`Não foi possível enviar DM para ${userId}.`);
        }
    }

    // 3. Envia para o Log (Com arquivo)
    const logConfig = safeReadJson(logConfigPath); 
    if (logConfig && logConfig.logChannelId) {
        const logChannel = await interaction.guild.channels.fetch(logConfig.logChannelId).catch(() => null);
        if (logChannel) {
            const embedLog = new EmbedBuilder()
                .setTitle('📑 Ticket Finalizado')
                .setDescription(`Ticket **${channel.name}** fechado por ${interaction.user}.`)
                .setColor(Colors.Grey)
                .setTimestamp();

            await logChannel.send({ embeds: [embedLog], files: [attachment] });
        }
    }

    // 4. Deleta
    setTimeout(() => { channel.delete().catch(() => {}); }, 5000);
}

module.exports = handleTicketClose;