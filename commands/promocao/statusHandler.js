/* ========================================================================
   ARQUIVO: commands/promocao/statusHandler.js (V-AutoRegister)
   DESCRIÇÃO: Se o usuário não existe, cria ele na hora baseado nos cargos.
   ======================================================================== */

const { EmbedBuilder, ActionRowBuilder, UserSelectMenuBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');

module.exports = async (interaction, client) => {
    const customId = interaction.customId;

    // 1. Botão inicial
    if (customId === 'stt_btn_ver') {
        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('stt_menu_sel')
            .setPlaceholder('Selecione o membro para ver a ficha...')
            .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(userSelect);

        await interaction.reply({
            content: 'De quem você deseja ver a Ficha Militar?',
            components: [row],
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // 2. Resposta do Menu
    if (interaction.isUserSelectMenu() && customId === 'stt_menu_sel') {
        // O select precisa ser reconhecido imediatamente. O processamento abaixo
        // pode envolver fetch de membro e leitura de JSON e ultrapassar 3 segundos.
        if (interaction.replied || interaction.deferred) return;
        try {
            await interaction.deferUpdate();
        } catch (erro) {
            if (erro?.code === 10062) return;
            throw erro;
        }

        const targetUserId = interaction.values?.[0];
        if (!targetUserId) {
            return interaction.editReply({
                content: '❌ Nenhum membro foi selecionado.',
                components: [],
                embeds: []
            }).catch(() => {});
        }

        const progressao = safeReadJson(progressaoPath);
        const carreiras = safeReadJson(carreirasPath);
        let userData = progressao[targetUserId];

        // =================================================================
        // 🧠 AUTO-REGISTRO (Se o usuário não existir)
        // =================================================================
        if (!userData) {
            try {
                const targetMember = await interaction.guild.members.fetch(targetUserId);

                let faccaoIdFound = null;
                for (const id of Object.keys(carreiras.faccoes || {})) {
                    if (targetMember.roles.cache.has(id)) {
                        faccaoIdFound = id;
                        break;
                    }
                }

                if (faccaoIdFound) {
                    const faccao = carreiras.faccoes[faccaoIdFound];
                    let rankFound = null;

                    for (let i = faccao.caminho.length - 1; i >= 0; i--) {
                        const r = faccao.caminho[i];
                        if (targetMember.roles.cache.has(r.id)) {
                            rankFound = r;
                            break;
                        }
                    }

                    userData = {
                        factionId: faccaoIdFound,
                        currentRankId: rankFound ? rankFound.id : null,
                        totalWins: rankFound ? rankFound.custo : 0
                    };

                    progressao[targetUserId] = userData;
                    safeWriteJson(progressaoPath, progressao);
                    console.log(`[Status] Novo usuário registrado automaticamente: ${targetMember.displayName}`);
                }
            } catch (err) {
                console.error('Erro ao tentar auto-registrar membro:', err);
            }
        }

        if (!userData) {
            return interaction.editReply({
                content: `❌ <@${targetUserId}> não possui facção ou registro na Carreira Militar.`,
                components: [],
                embeds: []
            }).catch(() => {});
        }

        let faccaoNome = 'Sem Facção';
        let cargoNome = 'Recruta';
        let corEmbed = '#99AAB5';

        if (userData.factionId && carreiras.faccoes[userData.factionId]) {
            const faccao = carreiras.faccoes[userData.factionId];
            faccaoNome = faccao.nome;
            corEmbed = faccao.cor || '#FFD700';

            if (userData.currentRankId) {
                const rankEncontrado = faccao.caminho.find(r => r.id === userData.currentRankId);
                if (rankEncontrado) cargoNome = rankEncontrado.nome;
            }
        }

        const targetUser = await client.users.fetch(targetUserId);

        const embedFicha = new EmbedBuilder()
            .setAuthor({ name: `Ficha Militar: ${targetUser.username}`, iconURL: targetUser.displayAvatarURL() })
            .setTitle(`🎖️ ${cargoNome.toUpperCase()}`)
            .setColor(corEmbed)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: '🏴 Facção', value: `**${faccaoNome}**`, inline: true },
                { name: '🏆 Vitórias Confirmadas', value: `\`${userData.totalWins || 0}\``, inline: true },
                { name: '📅 Última Atualização', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'Sistema de Promoção da Guilda', iconURL: interaction.guild.iconURL() });

        return interaction.editReply({
            content: '',
            embeds: [embedFicha],
            components: []
        }).catch(() => {});
    }
};