/* ========================================================================
   RESET DA LIGA — FECHAMENTO + NOVA TEMPORADA

   A carreira permanente fica em promocao/progressao.json e NUNCA é zerada.
   O reset limpa somente o estado corrente da temporada da Liga.
   ======================================================================== */

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson, isStaff } = require('./utils/helpers.js');
const { calcular: calcularEstatisticasTemporada } = require('./utils/temporadaStats.js');
const careerHistory = require('../promocao/careerHistory.js');

const pontosPath = path.join(__dirname, 'pontuacao.json');
const historicoPath = path.join(__dirname, '..', 'promocao', 'historico.json');
const temporadaPath = path.join(__dirname, 'temporada.json');

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function ordenarRanking(estatisticas) {
    return Object.values(estatisticas || {})
        .map(j => ({
            ...j,
            id: String(j.id),
            pontos: numero(j.pontos),
            vitorias: numero(j.vitorias),
            partidas: numero(j.partidas),
            kills: numero(j.kills),
            mortes: numero(j.mortes),
            continentes: numero(j.continentes)
        }))
        .filter(j =>
            j.pontos !== 0 || j.vitorias > 0 || j.partidas > 0 ||
            j.kills > 0 || j.mortes > 0 || j.continentes > 0
        )
        .sort((a, b) =>
            b.pontos - a.pontos || b.vitorias - a.vitorias ||
            b.kills - a.kills || String(a.id).localeCompare(String(b.id))
        )
        .map((j, i) => ({ ...j, posicao: i + 1 }));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Encerra a temporada da Liga e inicia uma nova temporada limpa.')
        .addStringOption(opt => opt
            .setName('nome_temporada')
            .setDescription('Nome da temporada/Liga que será encerrada')
            .setRequired(true)),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ Você não possui permissão para resetar a Liga.', flags: 64 });
        }

        const nomeTemporada = String(interaction.options.getString('nome_temporada') || '').trim();
        if (!nomeTemporada) {
            return interaction.reply({ content: '❌ Informe o nome da temporada.', flags: 64 });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirmar_reset').setLabel('Sim, encerrar e resetar').setStyle(ButtonStyle.Danger).setEmoji('🏆'),
            new ButtonBuilder().setCustomId('cancelar_reset').setLabel('Cancelar').setStyle(ButtonStyle.Secondary).setEmoji('✖️')
        );

        const msg = await interaction.reply({
            content:
                `⚠️ **ENCERRAMENTO DA LIGA**\n\n` +
                `**${nomeTemporada}** será arquivada.\n` +
                `📊 Estatísticas da temporada serão salvas.\n` +
                `🏆 Ranking será salvo no histórico/Hall da Fama.\n` +
                `📚 **Carreira, patentes e histórico permanente NÃO serão resetados.**\n` +
                `🧹 Somente os dados da temporada atual serão zerados.`,
            components: [row],
            flags: 64
        });

        try {
            const confirmation = await msg.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 15000
            });

            if (confirmation.customId === 'cancelar_reset') {
                return confirmation.update({ content: '❌ **Reset cancelado.** Nenhum dado foi alterado.', components: [] });
            }
            if (confirmation.customId !== 'confirmar_reset') return;

            const pontuacao = safeReadJson(pontosPath) || {};
            const historico = safeReadJson(historicoPath) || {};
            const controle = safeReadJson(temporadaPath) || {};

            if (!Array.isArray(historico.liga)) historico.liga = [];

            const inicioTemporada = controle.inicio || new Date().toISOString();
            const fimTemporada = new Date().toISOString();

            // CORREÇÃO: usar temporadaStats.calcular com a assinatura correta.
            // pontuacao.json é a fonte do saldo atual; partidas.json fornece os
            // indicadores registrados na temporada.
            const estatisticas = calcularEstatisticasTemporada(inicioTemporada, pontuacao);

            const ranking = ordenarRanking(estatisticas);

            const registro = {
                id: `liga_${Date.now()}_${interaction.user.id}`,
                categoria: 'liga',
                tipo: 'campeonato',
                nome: nomeTemporada,
                temporada: `Temporada ${numero(controle.numero) || 1}`,
                vencedor: ranking[0] ? `<@${ranking[0].id}>` : null,
                segundo: ranking[1] ? `<@${ranking[1].id}>` : null,
                terceiro: ranking[2] ? `<@${ranking[2].id}>` : null,
                inicioTemporada,
                fimTemporada,
                totalCompetidores: ranking.length,
                top10: ranking.slice(0, 10),
                rankingCompleto: ranking,
                estatisticas: ranking,
                registradoPor: {
                    id: interaction.user.id,
                    username: interaction.user.username
                }
            };

            historico.liga.push(registro);

            if (!safeWriteJson(historicoPath, historico)) {
                throw new Error('Não foi possível salvar o histórico da temporada.');
            }

            careerHistory.registrarLigaFinalizada({
                temporada: registro.temporada,
                liga: nomeTemporada,
                jogadores: ranking,
                campeao: ranking[0] || null,
                top10: ranking.slice(0, 10)
            });

            // NÃO tocar em progressao.json, currentRankId, factionId,
            // totalWins, printsProcessados ou cargos de patente.
            if (!safeWriteJson(temporadaPath, {
                inicio: fimTemporada,
                numero: (numero(controle.numero) || 1) + 1
            })) {
                throw new Error('Não foi possível criar a nova temporada.');
            }

            // A pontuação corrente é zerada. O histórico das partidas continua.
            if (!safeWriteJson(pontosPath, {})) {
                throw new Error('Não foi possível zerar a pontuação atual da Liga.');
            }

            await confirmation.update({
                content:
                    `✅ **${nomeTemporada} encerrada com sucesso!**\n\n` +
                    `🏆 Campeão: ${registro.vencedor || 'Nenhum'}\n` +
                    `🥈 2º lugar: ${registro.segundo || 'Nenhum'}\n` +
                    `🥉 3º lugar: ${registro.terceiro || 'Nenhum'}\n` +
                    `👥 Competidores: **${ranking.length}**\n\n` +
                    `📊 Estatísticas arquivadas.\n` +
                    `🏛️ Histórico/Hall da Fama atualizado.\n` +
                    `📚 Carreira permanente preservada.\n` +
                    `🎖️ Patentes preservadas.\n` +
                    `🏆 Vitórias históricas preservadas.\n` +
                    `🧹 Pontuação da temporada zerada.\n` +
                    `🔄 Nova temporada iniciada limpa.`,
                components: []
            });
        } catch (erro) {
            console.error('[LIGA RESET]', erro);
            await interaction.editReply({ content: `❌ **Reset não concluído.**\n${erro.message}`, components: [] }).catch(() => {});
        }
    }
};
