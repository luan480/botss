const { EmbedBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, capitalize } = require('../utils/helpers.js');

/**
 * Ranking da Liga.
 * Zeros e registros vazios não aparecem no ranking.
 */
module.exports = async (interaction, pontuacaoPath) => {
    await interaction.deferReply({ ephemeral: true });

    const ranking = safeReadJson(pontuacaoPath) || {};
    const rankingArray = Object.entries(ranking)
        .map(([id, pontos]) => ({
            id,
            pontos: Number(pontos) || 0
        }))
        .filter(item => item.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos || a.id.localeCompare(b.id));

    if (interaction.customId === 'ver_ranking') {
        const top10 = rankingArray.slice(0, 10)
            .map((item, i) => {
                const formatoNome = /^\d+$/.test(item.id)
                    ? `<@${item.id}>`
                    : capitalize(item.id);
                return `**${i + 1}.** ${formatoNome} — ${item.pontos} pts`;
            })
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🏆 Top 10 do Ranking')
            .setDescription(top10 || 'Nenhum competidor pontuado nesta temporada.')
            .setColor('Gold');

        return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.customId === 'ver_todos_competidores') {
        const lista = rankingArray
            .map(item => {
                const formatoNome = /^\d+$/.test(item.id)
                    ? `<@${item.id}>`
                    : capitalize(item.id);
                return `${formatoNome} — ${item.pontos} pts`;
            })
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📜 Todos os Competidores')
            .setDescription(lista || 'Nenhum competidor pontuado nesta temporada.')
            .setColor('Blue');

        return interaction.editReply({ embeds: [embed] });
    }
};
