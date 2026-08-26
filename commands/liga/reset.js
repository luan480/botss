/* ========================================================================
   ARQUIVO: commands/liga/reset.js
   RESET DA LIGA — FECHAMENTO + CARREIRA PERMANENTE + HALL DA FAMA
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('./utils/helpers.js');
const { calcular: calcularEstatisticasTemporada } = require('./utils/temporadaStats.js');
const careerHistory = require('../promocao/careerHistory.js');

const pontosPath = path.join(__dirname, 'pontuacao.json');
const historicoPath = path.join(__dirname, '..', 'promocao', 'historico.json');
const temporadaPath = path.join(__dirname, 'temporada.json');

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function formatarData() {
    const agora = new Date();
    return {
        data: agora.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' }),
        horario: agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit' })
    };
}

function normalizarNome(nome) {
    return String(nome || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function ordenarRanking(estatisticas) {
    return Object.values(estatisticas || {})
        .map(jogador => ({ ...jogador, pontos: numero(jogador.pontos) }))
        .sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias || b.kills - a.kills || String(a.id).localeCompare(String(b.id)))
        .map((jogador, index) => ({ ...jogador, posicao: index + 1 }));
}

function montarDescricao(ranking) {
    if (!ranking.length) return 'Nenhum competidor participou desta temporada.';
    return [`🏆 **Classificação final — ${ranking.length} competidor(es)**`, '', ...ranking.slice(0, 10).map(j => `${j.posicao}º <@${j.id}> — **${j.pontos} pts**`)].join('\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Encerra a temporada, salva carreira/Hall da Fama e inicia uma nova Liga.')
        .addStringOption(opt => opt.setName('nome_temporada').setDescription('Nome da temporada/Liga. Ex: Liga 1 • Temporada 2026').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const nomeTemporada = interaction.options.getString('nome_temporada').trim();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirmar_reset').setLabel('Sim, encerrar temporada e resetar').setStyle(ButtonStyle.Danger).setEmoji('🏆'),
            new ButtonBuilder().setCustomId('cancelar_reset').setLabel('Cancelar').setStyle(ButtonStyle.Secondary).setEmoji('✖️')
        );

        const msg = await interaction.reply({
            content: `⚠️ **ENCERRAMENTO DA LIGA**\n\nVocê está prestes a encerrar **${nomeTemporada}**.\n\n🏆 O ranking será salvo no Hall da Fama.\n📚 A carreira permanente será atualizada.\n📊 As estatísticas da Liga ficarão congeladas.\n🔄 Somente o ciclo atual será zerado.\n\n**A carreira dos jogadores não será apagada.**`,
            components: [row],
            flags: 64
        });

        try {
            const confirmation = await msg.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 15000 });
            if (confirmation.customId === 'cancelar_reset') {
                return confirmation.update({ content: '❌ **Encerramento cancelado.**\nNenhum dado da Liga foi alterado.', components: [] });
            }
            if (confirmation.customId !== 'confirmar_reset') return;

            const pontuacao = safeReadJson(pontosPath) || {};
            const historico = safeReadJson(historicoPath) || {};
            const controleTemporada = safeReadJson(temporadaPath) || {};
            if (!Array.isArray(historico.liga)) historico.liga = [];

            const inicioTemporada = controleTemporada.inicio || new Date().toISOString();
            const estatisticas = calcularEstatisticasTemporada(inicioTemporada, pontuacao);
            const ranking = ordenarRanking(estatisticas);
            const horario = formatarData();
            const nomeNormalizado = normalizarNome(nomeTemporada);

            if (historico.liga.some(r => r && normalizarNome(r.nome) === nomeNormalizado)) {
                return confirmation.update({ content: `❌ A temporada **${nomeTemporada}** já existe no Hall da Fama.\nO reset foi cancelado para evitar duplicação.`, components: [] });
            }

            const numeroTemporada = numero(controleTemporada.numero) || 1;
            const registroHistorico = {
                id: `liga_${Date.now()}_${interaction.user.id}`,
                categoria: 'liga',
                tipo: 'campeonato',
                nome: nomeTemporada,
                temporada: `Temporada ${numeroTemporada}`,
                vencedor: ranking[0] ? `<@${ranking[0].id}>` : null,
                segundo: ranking[1] ? `<@${ranking[1].id}>` : null,
                terceiro: ranking[2] ? `<@${ranking[2].id}>` : null,
                data: horario.data,
                horario: horario.horario,
                inicioTemporada,
                fimTemporada: new Date().toISOString(),
                totalCompetidores: ranking.length,
                top10: ranking.slice(0, 10),
                rankingCompleto: ranking,
                estatisticas: ranking,
                descricao: montarDescricao(ranking),
                registradoPor: { id: interaction.user.id, username: interaction.user.username }
            };

            // 1) Hall da Fama legado.
            historico.liga.push(registroHistorico);
            safeWriteJson(historicoPath, historico);

            // 2) Carreira permanente. A Liga encerrada é registrada UMA vez.
            careerHistory.registrarLigaFinalizada({
                temporada: registroHistorico.temporada,
                liga: nomeTemporada,
                jogadores: ranking,
                campeao: ranking[0] || null,
                top10: ranking.slice(0, 10)
            });

            // 3) Abre o próximo ciclo sem apagar careerHistory nem partidas.json.
            safeWriteJson(temporadaPath, {
                inicio: registroHistorico.fimTemporada,
                numero: numeroTemporada + 1
            });
            safeWriteJson(pontosPath, {});

            await confirmation.update({
                content: `✅ **${nomeTemporada} encerrada com sucesso!**\n\n🏆 Campeão: ${registroHistorico.vencedor || 'Nenhum'}\n🥈 2º lugar: ${registroHistorico.segundo || 'Nenhum'}\n🥉 3º lugar: ${registroHistorico.terceiro || 'Nenhum'}\n👥 Competidores: **${ranking.length}**\n\n📚 **Carreira permanente atualizada.**\n🏛️ **Hall da Fama atualizado.**\n🔄 **Nova temporada iniciada do zero.**`,
                components: []
            });
        } catch (erro) {
            console.error('[LIGA RESET] Erro ao encerrar temporada:', erro);
            await interaction.editReply({ content: '⌛ **Confirmação não recebida em 15 segundos.**\nAção cancelada e nenhum dado foi alterado.', components: [] }).catch(() => {});
        }
    }
};
