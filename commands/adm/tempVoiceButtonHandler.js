const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const donosSalas = new Map();

module.exports = async (interaction) => {
    const action = interaction.customId.replace('tvoice_', '');
    const channel = interaction.member.voice.channel;

    if (!channel) {
        return interaction.reply({ content: '❌ Você precisa estar em um canal de voz temporário para usar estes botões.', flags: MessageFlags.Ephemeral });
    }

    if (!donosSalas.has(channel.id)) {
        donosSalas.set(channel.id, interaction.user.id);
    }
    const donoId = donosSalas.get(channel.id);

    if (action !== 'reivindicar' && interaction.user.id !== donoId) {
        if (!channel.permissionsFor(interaction.member)?.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ Apenas o **dono da sala** ou administradores podem usar este botão.', flags: MessageFlags.Ephemeral });
        }
    }

    // --- 1. NOMEAR (Modal) ---
    if (action === 'nomear') {
        const modal = new ModalBuilder().setCustomId('tvoice_modal_nomear').setTitle('Renomear Sala');
        const input = new TextInputBuilder().setCustomId('novo_nome').setLabel('Digite o novo nome da sala:').setStyle(TextInputStyle.Short).setMaxLength(30).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
    }

    // --- 2. LIMITAR VAGAS (Modal) ---
    if (action === 'limitar') {
        const modal = new ModalBuilder().setCustomId('tvoice_modal_limitar').setTitle('Limitar Vagas na Sala');
        const input = new TextInputBuilder().setCustomId('novo_limite').setLabel('Máximo de pessoas (0 para ilimitado):').setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return await interaction.showModal(modal);
    }

    await interaction.reply({ content: '⚙️ Processando ação...', flags: MessageFlags.Ephemeral }).catch(() => {});

    switch (action) {
        case 'bloquear': {
            await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
            return interaction.editReply({ content: '🔒 Sala **bloqueada** para novos membros!' });
        }

        case 'desbloquear': {
            await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: true });
            return interaction.editReply({ content: '🔓 Sala **desbloqueada**!' });
        }

        case 'privacidade': {
            const atual = channel.permissionsFor(interaction.guild.id)?.has(PermissionFlagsBits.ViewChannel);
            await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: !atual });
            return interaction.editReply({ content: `👁️ Privacidade alterada: A sala agora está ${!atual ? '**Visível**' : '**Oculta**'}.` });
        }

        case 'espera': {
            // Cria ou alterna a sala de espera (tira a permissão de falar/conectar para quem não for confiado)
            const roleEveryone = interaction.guild.id;
            const atualConnect = channel.permissionsFor(roleEveryone)?.has(PermissionFlagsBits.Connect);
            await channel.permissionOverwrites.edit(roleEveryone, { Connect: !atualConnect });
            return interaction.editReply({ content: `⏱️ Modo Sala de Espera ${!atualConnect ? '**ativado** (usuários precisam de convite)' : '**desativado**'}.` });
        }

        case 'confiar': {
            // Permite que todos os membros atualmente na call ganhem acesso permanente de entrada
            for (const [memberId, member] of channel.members) {
                await channel.permissionOverwrites.edit(memberId, { Connect: true, Speak: true, ViewChannel: true });
            }
            return interaction.editReply({ content: '✅ Todos os membros presentes na sala agora são **confiados**!' });
        }

        case 'desconfiar': {
            // Remove permissões especiais dos membros na call (exceto o dono)
            for (const [memberId, member] of channel.members) {
                if (memberId !== donoId) {
                    await channel.permissionOverwrites.delete(memberId).catch(() => {});
                }
            }
            return interaction.editReply({ content: '⚠️ Permissões extras limpas para quem está na sala.' });
        }

        case 'convidar': {
            const invite = await channel.createInvite({ maxUses: 1, maxAge: 300 }).catch(() => null);
            if (!invite) return interaction.editReply({ content: '❌ Não foi possível gerar um convite.' });
            return interaction.editReply({ content: `📨 Convite gerado com validade de 5 minutos: https://discord.gg/${invite.code}` });
        }

        case 'expulsar': {
            // Desconecta todo mundo da sala (exceto o dono)
            let kickedCount = 0;
            for (const [memberId, member] of channel.members) {
                if (memberId !== donoId && member.voice.channelId === channel.id) {
                    await member.voice.disconnect().catch(() => {});
                    kickedCount++;
                }
            }
            return interaction.editReply({ content: `⛔ ${kickedCount} membro(s) foram expulsos da sala com sucesso!` });
        }

        case 'reivindicar': {
            const membrosNaSala = channel.members.filter(m => !m.user.bot);
            if (membrosNaSala.has(donoId)) {
                return interaction.editReply({ content: '❌ O dono atual ainda está na sala, você não pode reivindicar.' });
            }
            donosSalas.set(channel.id, interaction.user.id);
            await channel.permissionOverwrites.edit(interaction.user.id, { ManageChannels: true, MoveMembers: true, MuteMembers: true });
            return interaction.editReply({ content: `👑 Parabéns! Você agora é o **novo dono** desta sala.` });
        }

        case 'transferir': {
            return interaction.editReply({ content: '🔸 Para transferir a sala, use o comando de mover ou peça para o novo dono clicar em **Reivindicar** quando você sair.' });
        }

        case 'excluir': {
            await interaction.editReply({ content: '🗑️ Deletando a sala...' });
            donosSalas.delete(channel.id);
            await channel.delete().catch(() => {});
            break;
        }

        case 'chat':
            return interaction.editReply({ content: '💬 Use o chat integrado do Discord na parte superior da chamada de voz.' });

        case 'regiao':
            return interaction.editReply({ content: '🌐 A região de voz é gerenciada automaticamente pelo Discord.' });

        default:
            return interaction.editReply({ content: `⚠️ Função executada com sucesso.` });
    }
};