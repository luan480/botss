/* ========================================================================
   RESET DA LIGA — FECHAMENTO + HISTÓRICO + NOVO CICLO
   ======================================================================== */

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson, isStaff } = require('./utils/helpers.js');
const { calcular: calcularEstatisticasTemporada } = require('./utils/temporadaStats.js');
const careerHistory = require('../promocao/careerHistory.js');

const pontosPath = path.join(__dirname, 'pontuacao.json');
const historicoPath = path.join(__dirname, '..', 'promocao', 'historico.json');
const temporadaPath = path.join(__dirname, 'temporada.json');

function numero(valor) { const n = Number(valor); return Number.isFinite(n) ? n : 0; }
function normalizarNome(nome) { return String(nome || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
function ordenarRanking(estatisticas) {
    return Object.values(estatisticas || {})
        .map(j => ({ ...j, pontos: numero(j.pontos) }))
        .sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias || b.kills - a.kills || String(a.id).localeCompare(String(b.id)))
        .map((j, i) => ({ ...j, posicao: i + 1 }));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Encerra a temporada, arquiva as estatísticas e inicia uma nova Liga.')
        .addStringOption(opt => opt.setName('nome_temporada').setDescription('Nome da temporada/Liga').setRequired(true)),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ Você não possui permissão para resetar a Liga.', flags: 64 });
        }

        const nomeTemporada = interaction.options.getString('nome_temporada').trim();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirmar_reset').setLabel('Sim, encerrar e resetar').setStyle(ButtonStyle.Danger).setEmoji('🏆'),
            new ButtonBuilder().setCustomId('cancelar_reset').setLabel('Cancelar').setStyle(ButtonStyle.Secondary).setEmoji('✖️')
        );

        const msg = await interaction.reply({
            content: `⚠️ **ENCERRAMENTO DA LIGA**\n\n**${nomeTemporada}** será arquivada.\n📊 Estatísticas serão salvas.\n🏆 Ranking será salvo no Hall da Fama.\n📚 Carreira permanente será atualizada.\n🔄 Somente a temporada atual será zerada.`,
            components: [row], flags: 64
        });

        try {
            const confirmation = await msg.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 15000 });
            if (confirmation.customId === 'cancelar_reset') return confirmation.update({ content: '❌ **Reset cancelado.** Nenhum dado foi alterado.', components: [] });
            if (confirmation.customId !== 'confirmar_reset') return;

            const pontuacao = safeReadJson(pontosPath) || {};
            const historico = safeReadJson(historicoPath) || {};
            const controle = safeReadJson(temporadaPath) || {};
            if (!Array.isArray(historico.liga)) historico.liga = [];

            const inicioTemporada = controle.inicio || new Date().toISOString();
            const fimTemporada = new Date().toISOString();
            const estatisticas = calcularEstatisticasTemporada(inicioTemporada, pontuacao);
            const ranking = ordenarRanking(estatisticas);
            const registro = {
                id: `liga_${Date.now()}_${interaction.user.id}`,
                categoria: 'liga', tipo: 'campeonato', nome: nomeTemporada,
                temporada: `Temporada ${numero(controle.numero) || 1}`,
                vencedor: ranking[0] ? `<@${ranking[0].id}>` : null,
                segundo: ranking[1] ? `<@${ranking[1].id}>` : null,
                terceiro: ranking[2] ? `<@${ranking[2].id}>` : null,
                inicioTemporada, fimTemporada,
                totalCompetidores: ranking.length,
                top10: ranking.slice(0, 10), rankingCompleto: ranking,
                estatisticas: ranking,
                registradoPor: { id: interaction.user.id, username: interaction.user.username }
            };

            // Primeiro arquiva tudo. Se o histórico não puder ser salvo, NÃO zera a Liga.
            historico.liga.push(registro);
            if (!safeWriteJson(historicoPath, historico)) throw new Error('Não foi possível salvar o histórico da temporada.');

            careerHistory.registrarLigaFinalizada({
                temporada: registro.temporada, liga: nomeTemporada,
                jogadores: ranking, campeao: ranking[0] || null, top10: ranking.slice(0, 10)
            });

            // Só depois do arquivamento bem-sucedido inicia o próximo ciclo.
            if (!safeWriteJson(temporadaPath, { inicio: fimTemporada, numero: (numero(controle.numero) || 1) + 1 })) throw new Error('Não foi possível criar a nova temporada.');
            if (!safeWriteJson(pontosPath, {})) throw new Error('Não foi possível zerar a pontuação atual.');

            await confirmation.update({
                content: `✅ **${nomeTemporada} encerrada!**\n\n🏆 Campeão: ${registro.vencedor || 'Nenhum'}\n🥈 2º: ${registro.segundo || 'Nenhum'}\n🥉 3º: ${registro.terceiro || 'Nenhum'}\n👥 Competidores: **${ranking.length}**\n\n📊 **Estatísticas arquivadas.**\n🏛️ **Hall da Fama atualizado.**\n📚 **Carreira permanente preservada.**\n🔄 **Nova temporada iniciada limpa.**`,
                components: []
            });
        } catch (erro) {
            console.error('[LIGA RESET]', erro);
            await interaction.editReply({ content: `❌ **Reset não concluído.**\n${erro.message}`, components: [] }).catch(() => {});
        }
    }
};
