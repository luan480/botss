/* ========================================================================
   ARQUIVO: commands/voz/voiceControlHandler.js
   DESCRIÇÃO: Manipulador blindado com suporte a limites 6, 8, 10 e menções externas
   ======================================================================== */

const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const banimentosCall = new Map();
const votacoesAtivas = new Map();

module.exports = (client) => {
    // 1. Bloqueia a entrada se o usuário estiver banido da call por 1h
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        const member = newState.member;
        if (!member || member.user.bot) return;

        const channelNew = newState.channel;
        if (channelNew) {
            const chaveBan = `${channelNew.id}_${member.id}`;
            const tempoFim = banimentosCall.get(chaveBan);

            if (tempoFim) {
                if (Date.now() < tempoFim) {
                    await member.voice.disconnect("Banido temporariamente da call por votação.").catch(() => {});
                    return;
                } else {
                    banimentosCall.delete(chaveBan);
                }
            }
        }
    });

    // 2. Intercepta interações do painel com deferUpdate para evitar falhas
    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
        const id = interaction.customId;

        if (!id.startsWith('vcall_')) return;

        // --- TRATAMENTO PARA OS BOTÕES DE VOTO INDIVIDUAIS (EVITA O ERRO DE TIMEOUT) ---
        if (id.startsWith('vcall_votar_')) {
            // O collector de cliques lá embaixo já gerencia a contagem, 
            // mas precisamos garantir que o botão responda o clique imediatamente para o Discord não dar erro.
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate().catch(() => {});
            }
            return;
        }

        const member = interaction.member;
        const voiceChannel = member?.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Você precisa estar em um canal de voz para interagir!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        // --- SELEÇÃO DE MEMBRO PARA EXPULSÃO (MENU) ---
        if (interaction.isStringSelectMenu() && id === 'vcall_select_kick') {
            const targetUserId = interaction.values[0];
            if (targetUserId === 'none') {
                return interaction.reply({ content: '❌ Não há outros membros para expulsar.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            const targetMember = voiceChannel.members.get(targetUserId);
            if (!targetMember) {
                return interaction.reply({ content: '❌ O membro selecionado não está mais na call.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            const membrosNaCall = voiceChannel.members.filter(m => !m.user.bot);
            const totalMembros = membrosNaCall.size;
            const votosNecessarios = Math.ceil(totalMembros * 0.8);
            const mencoesCalls = membrosNaCall.map(m => `${m}`).join(' ');

            const chaveVoto = `${voiceChannel.id}_kick_${targetUserId}`;
            if (votacoesAtivas.get(chaveVoto)) {
                return interaction.reply({ content: '⚠️ Já existe uma votação ativa para expulsar este membro!', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            votacoesAtivas.set(chaveVoto, true);

            // Evita erro de timeout respondendo imediatamente o select menu
            await interaction.deferUpdate().catch(() => {});

            const embedVotacao = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('🗳️ VOTAÇÃO DE EXPULSÃO NA CALL')
                .setDescription(
                    `Foi aberta uma votação para expulsar **${targetMember.displayName}** desta call.\n\n` +
                    `📊 **Meta:** \`80%\` dos votos (${votosNecessarios} de ${totalMembros} pessoas).\n` +
                    `⏳ **Tempo:** 30 segundos para votar!`
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`vcall_votar_${targetUserId}`).setLabel('Votar SIM (0)').setStyle(ButtonStyle.Danger)
            );

            // Envia a votação pública com menções fora do embed
            const msg = await interaction.channel.send({ 
                content: `🔔 **Atenção membros na call:** ${mencoesCalls}`, 
                embeds: [embedVotacao], 
                components: [row] 
            }).catch(() => {});

            if (!msg) {
                votacoesAtivas.delete(chaveVoto);
                return;
            }

            let votosSim = new Set();
            const collector = msg.createMessageComponentCollector({ time: 30000 });

            collector.on('collect', async i => {
                if (!voiceChannel.members.has(i.user.id)) {
                    return i.reply({ content: '❌ Apenas quem está na call pode votar!', flags: MessageFlags.Ephemeral }).catch(() => {});
                }

                votosSim.add(i.user.id);
                const atualVotos = votosSim.size;

                const novoRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`vcall_votar_${targetUserId}`).setLabel(`Votar SIM (${atualVotos}/${votosNecessarios})`).setStyle(ButtonStyle.Danger)
                );

                await i.update({ components: [novoRow] }).catch(() => {});

                if (atualVotos >= votosNecessarios) {
                    collector.stop('aprovado');
                }
            });

            collector.on('end', async (_, reason) => {
                votacoesAtivas.delete(chaveVoto);

                if (reason === 'aprovado') {
                    const umaHoraMs = 60 * 60 * 1000;
                    banimentosCall.set(`${voiceChannel.id}_${targetUserId}`, Date.now() + umaHoraMs);
                    await targetMember.voice.disconnect("Atingiu 80% de votos para expulsão.").catch(() => {});

                    await msg.edit({ content: `✅ **Votação Aprovada!** ${targetMember} foi expulso e banido desta call por 1 hora.`, embeds: [], components: [] }).catch(() => {});
                } else {
                    await msg.edit({ content: `❌ **Votação Encerrada.** Não atingiu os 80% necessários para expulsar ${targetMember}.`, embeds: [], components: [] }).catch(() => {});
                }
            });
            return;
        }

        // --- VOTAÇÃO DE ALTERAÇÃO DE LIMITE DE VAGAS (BOTÕES 6, 8, 10) ---
        const partes = id.split('_');
        const Acao = partes[1]; 
        const SubAcao = partes.slice(2).join('_');

        const membrosNaCall = voiceChannel.members.filter(m => !m.user.bot);
        const totalMembros = membrosNaCall.size;
        const votosNecessarios = Math.ceil(totalMembros * 0.8);
        const mencoesCalls = membrosNaCall.map(m => `${m}`).join(' ');

        if (Acao === 'limite') {
            const novoLimite = parseInt(SubAcao);
            const chaveVoto = `${voiceChannel.id}_limite_${novoLimite}`;

            if (votacoesAtivas.get(chaveVoto)) {
                return interaction.reply({ content: '⚠️ Já existe uma votação ativa para este limite!', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            votacoesAtivas.set(chaveVoto, true);

            // Evita timeout do botão
            await interaction.deferUpdate().catch(() => {});

            const embedVotacao = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🗳️ VOTAÇÃO DE LIMITE DE VAGAS')
                .setDescription(
                    `Desejam alterar o limite desta call para **${novoLimite}** vagas?\n\n` +
                    `📊 **Meta:** \`80%\` dos votos (${votosNecessarios} de ${totalMembros}).\n` +
                    `⏳ **Tempo:** 30 segundos.`
                );

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`vcall_votar_limite_${novoLimite}`).setLabel('Votar SIM (0)').setStyle(ButtonStyle.Primary)
            );

            const msg = await interaction.channel.send({ 
                content: `🔔 **Atenção membros na call:** ${mencoesCalls}`, 
                embeds: [embedVotacao], 
                components: [row] 
            }).catch(() => {});

            if (!msg) {
                votacoesAtivas.delete(chaveVoto);
                return;
            }

            let votosSim = new Set();
            const collector = msg.createMessageComponentCollector({ time: 30000 });

            collector.on('collect', async i => {
                if (!voiceChannel.members.has(i.user.id)) {
                    return i.reply({ content: '❌ Apenas quem está na call pode votar!', flags: MessageFlags.Ephemeral }).catch(() => {});
                }

                votosSim.add(i.user.id);
                const atualVotos = votosSim.size;

                const novoRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`vcall_votar_limite_${novoLimite}`).setLabel(`Votar SIM (${atualVotos}/${votosNecessarios})`).setStyle(ButtonStyle.Primary)
                );

                await i.update({ components: [novoRow] }).catch(() => {});

                if (atualVotos >= votosNecessarios) {
                    collector.stop('aprovado');
                }
            });

            collector.on('end', async (_, reason) => {
                votacoesAtivas.delete(chaveVoto);

                if (reason === 'aprovado') {
                    await voiceChannel.setUserLimit(novoLimite).catch(() => {});
                    await msg.edit({ content: `✅ **Votação Aprovada!** O limite da call foi alterado para **${novoLimite}** vagas.`, embeds: [], components: [] }).catch(() => {});
                } else {
                    await msg.edit({ content: `❌ **Votação Encerrada.** Não atingiu 80% para alterar o limite.`, embeds: [], components: [] }).catch(() => {});
                }
            });
        }
    });
};