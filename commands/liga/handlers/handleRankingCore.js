const { EmbedBuilder } = require('discord.js');
const { safeReadJson } = require('../utils/helpers.js');
const pontuacaoLiga = require('../utils/pontuacaoLiga.js');

function ordenar(perfis) {
    return Object.values(perfis || {})
        .map(perfil => ({
            ...perfil,
            id: String(perfil.id),
            pontos: Number(perfil.pontos) || 0,
            vitorias: Number(perfil.vitorias) || 0,
            partidas: Number(perfil.partidas) || 0,
            kills: Number(perfil.kills) || 0,
            mortes: Number(perfil.mortes) || 0,
            continentes: Number(perfil.continentes) || 0
        }))
        .filter(j =>
            j.pontos !== 0 ||
            j.vitorias > 0 ||
            j.partidas > 0 ||
            j.kills > 0 ||
            j.mortes > 0 ||
            j.continentes > 0
        )
        .sort((a, b) =>
            b.pontos - a.pontos ||
            b.vitorias - a.vitorias ||
            b.kills - a.kills ||
            String(a.nome || a.id).localeCompare(String(b.nome || b.id))
        );
}

module.exports = async (interaction, pontuacaoPath) => {
    await interaction.deferReply({ ephemeral: true });

    const dados = safeReadJson(pontuacaoPath) || {};
    const perfis = pontuacaoLiga.normalizarTodos(dados);
    const ranking = ordenar(perfis);

    if (interaction.customId === 'ver_ranking') {
        const top10 = ranking.slice(0, 10)
            .map((j, i) =>
                `**${i + 1}.** <@${j.id}> — **${j.pontos} pts**` +
                ` | 🥇 ${j.vitorias} | 🎮 ${j.partidas}`
            )
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🏆 Ranking da Liga — Temporada Atual')
            .setDescription(top10 || 'Nenhum competidor na temporada atual.')
            .setColor('Gold')
            .setFooter({ text: 'Somente dados da temporada atual' });

        return interaction.editReply({ embeds: [embed] });
    }

    if (interaction.customId === 'ver_todos_competidores') {
        const lista = ranking
            .map((j, i) =>
                `**${i + 1}.** <@${j.id}> — **${j.pontos} pts**` +
                ` | 🥇 ${j.vitorias} | 🎮 ${j.partidas} | 💀 ${j.kills} | ☠️ ${j.mortes} | 🌍 ${j.continentes}`
            )
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📜 Todos os Competidores — Temporada Atual')
            .setDescription(lista || 'Nenhum competidor na temporada atual.')
            .setColor('Blue')
            .setFooter({ text: 'Dados atuais da Liga' });

        return interaction.editReply({ embeds: [embed] });
    }

    return interaction.editReply({ content: '❌ Ação de ranking desconhecida.' });
};
