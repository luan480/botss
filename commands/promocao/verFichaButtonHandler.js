/* ========================================================================
   ARQUIVO: commands/promocao/verFichaButtonHandler.js
   DESCRIÇÃO: Botão/menu de Ficha usando o construtor visual único.
   ======================================================================== */

const { ActionRowBuilder, UserSelectMenuBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');
const { criarFicha } = require('./fichaBuilder.js');

const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');
const economyPath = path.join(__dirname, '../economy/economy.json');

function criarMenuFicha() {
    const selectMenu = new UserSelectMenuBuilder()
        .setCustomId('selecionar_ficha_membro')
        .setPlaceholder('🔎 Escolha um membro para ver a ficha...')
        .setMinValues(1)
        .setMaxValues(1);

    return new ActionRowBuilder().addComponents(selectMenu);
}

module.exports = async (interaction, client) => {
    try {
        // =========================================================
        // BOTÃO VER FICHA
        // =========================================================
        if (interaction.isButton() && interaction.customId.startsWith('ver_ficha_')) {
            return interaction.reply({
                content: '📋 **FICHA MILITAR**\nSelecione abaixo o membro que deseja consultar:',
                components: [criarMenuFicha()],
                ephemeral: true
            });
        }

        // =========================================================
        // SELEÇÃO DO MEMBRO
        // =========================================================
        if (interaction.isUserSelectMenu() && interaction.customId === 'selecionar_ficha_membro') {
            await interaction.deferUpdate();

            const targetUserId = interaction.values[0];
            const progressao = safeReadJson(progressaoPath);
            const carreiras = safeReadJson(carreirasPath);
            const economy = safeReadJson(economyPath);

            const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
            const nomeExibicao = member?.displayName || `Usuário ${targetUserId}`;

            const ficha = criarFicha({
                progressao,
                carreiras,
                economy,
                userId: targetUserId,
                member,
                modo: 'carreira'
            });

            if (!ficha) {
                return interaction.editReply({
                    content: `❌ **${nomeExibicao}** ainda não possui registro de carreira.`,
                    embeds: [],
                    components: [criarMenuFicha()]
                });
            }

            return interaction.editReply({
                content: `📋 **Ficha de ${member || nomeExibicao}**`,
                embeds: [ficha],
                components: [criarMenuFicha()]
            });
        }
    } catch (err) {
        console.error('[FICHA] Erro no manipulador:', err);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: '❌ Ocorreu um erro ao carregar a ficha militar.',
                embeds: [],
                components: []
            }).catch(() => {});
        } else {
            await interaction.reply({
                content: '❌ Ocorreu um erro ao carregar a ficha militar.',
                ephemeral: true
            }).catch(() => {});
        }
    }
};
