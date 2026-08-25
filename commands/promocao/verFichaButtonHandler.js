/* ========================================================================
   ARQUIVO: commands/promocao/verFichaButtonHandler.js
   DESCRIÇÃO: Gerenciador ÚNICO para o botão e para o menu de seleção de Fichas.
   ======================================================================== */

const { EmbedBuilder, ActionRowBuilder, UserSelectMenuBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');

const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');
const economyPath = path.join(__dirname, '../economy/economy.json');

module.exports = async (interaction, client) => {
    try {
        // =========================================================
        // 1. SE O USUÁRIO CLICOU NO BOTÃO "VER FICHA"
        // =========================================================
        if (interaction.isButton() && interaction.customId.startsWith('ver_ficha_')) {
            // Cria apenas o menu de seleção, SEM mostrar a ficha de ninguém ainda
            const selectMenu = new UserSelectMenuBuilder()
                .setCustomId('selecionar_ficha_membro')
                .setPlaceholder('Escolha um membro para ver a ficha...')
                .setMinValues(1)
                .setMaxValues(1);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            return interaction.reply({
                content: '🔍 **De quem você quer ver a ficha?** Selecione um membro abaixo:',
                components: [row],
                ephemeral: true // Só você vê isso
            });
        }

        // =========================================================
        // 2. SE O USUÁRIO ESCOLHEU ALGUÉM NO MENU DE SELEÇÃO
        // =========================================================
        if (interaction.isUserSelectMenu() && interaction.customId === 'selecionar_ficha_membro') {
            await interaction.deferUpdate(); // Atualiza a mensagem silenciosamente

            const targetUserId = interaction.values[0];
            const progressao = safeReadJson(progressaoPath);
            const carreiras = safeReadJson(carreirasPath);
            const economy = safeReadJson(economyPath);

            const dadosUsuario = progressao[targetUserId];
            const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
            const nomeExibicao = member ? member.displayName : `Usuário (${targetUserId})`;

            // Recria o menu para deixar ele lá, caso você queira pesquisar outra pessoa depois
            const selectMenu = new UserSelectMenuBuilder()
                .setCustomId('selecionar_ficha_membro')
                .setPlaceholder('Escolha outro membro para ver a ficha...')
                .setMinValues(1)
                .setMaxValues(1);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            if (!dadosUsuario) {
                return interaction.editReply({
                    content: `❌ O usuário **${nomeExibicao}** ainda não possui registro de carreira.`,
                    embeds: [],
                    components: [row]
                });
            }

            const faccaoId = dadosUsuario.factionId;
            const faccao = carreiras.faccoes[faccaoId];
            if (!faccao) {
                return interaction.editReply({ content: '❌ Facção não encontrada.', embeds: [], components: [row] });
            }

            // Calcula a patente e progresso do membro selecionado
            let rankAtualObj = faccao.caminho[0];
            let proximoRankObj = null;

            for (let i = 0; i < faccao.caminho.length; i++) {
                const r = faccao.caminho[i];
                if (dadosUsuario.totalWins >= r.custo) {
                    rankAtualObj = r;
                    proximoRankObj = faccao.caminho[i + 1] || null;
                }
            }

            let metaTexto = "Patente Máxima Atingida!";
            if (proximoRankObj) {
                const faltam = proximoRankObj.custo - dadosUsuario.totalWins;
                metaTexto = `Faltam ${faltam > 0 ? faltam : 0} vitórias para **${proximoRankObj.nome}**`;
            }

            const saldo = economy[targetUserId] ? economy[targetUserId].balance : 0;

            const embedFicha = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle(`📋 Ficha Militar: ${nomeExibicao}`)
                .addFields(
                    { name: '🛡️ Facção', value: `${faccao.nome}`, inline: true },
                    { name: '🎖️ Patente Atual', value: `${rankAtualObj.nome}`, inline: true },
                    { name: '🏆 Vitórias Totais', value: `${dadosUsuario.totalWins}`, inline: true },
                    { name: '💳 Saldo Bancário', value: `${saldo} WarCoins`, inline: true },
                    { name: '🎯 Próxima Meta', value: metaTexto, inline: false }
                )
                .setTimestamp();

            if (member && member.user.displayAvatarURL()) {
                embedFicha.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
            }

            // Edita a mensagem mostrando o Embed e mantendo o menu abaixo
            return interaction.editReply({
                content: '',
                embeds: [embedFicha],
                components: [row]
            });
        }

    } catch (err) {
        console.error("Erro no manipulador de fichas unificado:", err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Ocorreu um erro ao carregar a ficha.', components: [] }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ Ocorreu um erro ao carregar a ficha.', ephemeral: true }).catch(() => {});
        }
    }
};