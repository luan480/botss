/* ========================================================================
   ARQUIVO: commands/voz/painelCall.js
   DESCRIÇÃO: Painel /call que se autodestrói após 2 minutos
   ======================================================================== */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('call')
        .setDescription('🎛️ Abre o painel democrático da sua call (votar para expulsar ou mudar limite)')
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

    async execute(interaction) {
        const member = interaction.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Você precisa estar em um canal de voz para usar este painel!', ephemeral: true });
        }

        const membrosNaCall = voiceChannel.members.filter(m => !m.user.bot);
        const listaMembrosMencionados = membrosNaCall.map(m => `${m}`).join(' ');

        // Embed 1: Expulsão
        const embedKick = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle(`🥾 Expulsar Membro - ${voiceChannel.name}`)
            .setDescription(`Selecione abaixo o membro que deseja expulsar da call (Requer 80% de votos). O ban durará 1 hora.`);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('vcall_select_kick')
            .setPlaceholder('⚠️ Selecione quem deseja expulsar...')
            .setMinValues(1)
            .setMaxValues(1);

        membrosNaCall.forEach(m => {
            if (m.id !== member.id) {
                selectMenu.addOptions({
                    label: m.displayName,
                    description: `Expulsar ${m.user.tag} da call`,
                    value: m.id,
                    emoji: '🥾'
                });
            }
        });

        if (selectMenu.options.length === 0) {
            selectMenu.addOptions({
                label: 'Nenhum outro membro na call',
                value: 'none',
                description: 'Aguarde mais pessoas entrarem'
            });
            selectMenu.setDisabled(true);
        }

        const rowSelect = new ActionRowBuilder().addComponents(selectMenu);

        // Embed 2: Limite de Vagas
        const embedLimite = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle(`🎛️ Alterar Limite de Vagas - ${voiceChannel.name}`)
            .setDescription(`Escolha o novo limite de vagas desejado para a sala:\n• **Mínimo:** 6\n• **Padrão:** 8\n• **Máximo:** 10`);

        const rowBotoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vcall_limite_6').setLabel('Mínimo: 6').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('vcall_limite_8').setLabel('Padrão: 8').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vcall_limite_10').setLabel('Máximo: 10').setStyle(ButtonStyle.Danger)
        );

        // Envia o painel publicamente
        const msg = await interaction.reply({
            content: `🔔 **Membros na Call (${membrosNaCall.size}):** ${listaMembrosMencionados}`,
            embeds: [embedKick, embedLimite],
            components: [rowSelect, rowBotoes],
            fetchReply: true
        });

        // Apaga a mensagem automaticamente após 2 minutos (120000 milissegundos)
        setTimeout(async () => {
            try {
                await msg.delete();
            } catch (err) {
                // Ignora caso já tenha sido apagado
            }
        }, 120000);
    }
};