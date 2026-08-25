/* commands/ticket/ticket-fechar.js (V5 - Limpo) */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Colors } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');

// Caminho para logs (para não perder o histórico totalmente)
const logConfigPath = path.join(__dirname, '../adm/log_config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fechar-ticket')
        .setDescription('Fecha o canal de ticket atual.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels), 
    
    async execute(interaction) {
        const channel = interaction.channel;
        if (!channel.name.startsWith('ticket-') || !channel.topic) {
            return interaction.reply({ content: '❌ Este não parece ser um canal de ticket válido.', ephemeral: true });
        }
        
        const topic = channel.topic;
        const userIdMatch = topic.match(/ID: (\d+)/);
        const userId = userIdMatch ? userIdMatch[1] : null;
        
        // Avisa no canal
        const embedAviso = new EmbedBuilder()
            .setDescription('🔒 **Fechando Ticket...**\nO canal será excluído em 5 segundos.')
            .setColor(Colors.Red);

        await interaction.reply({ embeds: [embedAviso] });

        try {
            // Gera a transcrição (apenas para LOGS, não para o usuário)
            const attachment = await discordTranscripts.createTranscript(channel, {
                filename: `transcricao-${channel.name}.html`,
                saveImages: true,
                poweredBy: false 
            });

            // 1. Envia DM para o usuário (APENAS O EMBED, SEM ARQUIVO)
            if (userId) {
                const user = await interaction.client.users.fetch(userId);
                if (user) {
                    const embedDM = new EmbedBuilder()
                        .setTitle('Ticket Fechado')
                        .setDescription(`O seu ticket **${channel.name}** no servidor **${interaction.guild.name}** foi encerrado.`)
                        .addFields({ name: 'Status', value: 'Atendimento finalizado pela equipe.' })
                        .setColor(Colors.Blue)
                        .setTimestamp();

                    await user.send({ embeds: [embedDM] }) // <--- SEM FILES AQUI
                        .catch(() => console.warn(`DM fechada para ${user.tag}`));
                }
            }

            // 2. Envia para o Canal de Logs (Aqui enviamos o arquivo para segurança)
            const logConfig = safeReadJson(logConfigPath);
            if (logConfig && logConfig.logChannelId) {
                const logChannel = await interaction.guild.channels.fetch(logConfig.logChannelId).catch(() => null);
                if (logChannel) {
                    const embedLog = new EmbedBuilder()
                        .setTitle('📑 Ticket Finalizado (Via Comando)')
                        .addFields(
                            { name: 'Ticket', value: channel.name, inline: true },
                            { name: 'Fechado por', value: interaction.user.tag, inline: true }
                        )
                        .setColor(Colors.Grey)
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [embedLog], files: [attachment] });
                }
            }

            // Deleta o canal
            setTimeout(() => { channel.delete().catch(() => {}); }, 5000);

        } catch (err) {
            console.error("Erro ao fechar ticket:", err);
        }
    }
};