/* ========================================================================
   RESET DA LIGA — FECHAMENTO + HISTÓRICO + NOVO CICLO

   REGRA IMPORTANTE:
   - commands/promocao/progressao.json é a CARREIRA PERMANENTE do jogador.
   - O reset da Liga NUNCA altera totalWins, currentRankId, factionId,
     printsProcessados ou qualquer outro dado de carreira/histórico.
   - A temporada atual da Liga é controlada por temporada.json + partidas.json
     e a pontuação corrente fica em pontuacao.json.
   - Ao iniciar uma nova temporada, apenas a pontuação corrente é zerada.
   - partidas.json continua guardando o histórico das partidas para relatórios
     e temporadas anteriores.
   ======================================================================== */

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const path = require('path');

const {
    safeReadJson,
    safeWriteJson,
    isStaff
} = require('./utils/helpers.js');

const {
    calcular: calcularEstatisticasTemporada
} = require('./utils/temporadaStats.js');

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
            String(a.id).localeCompare(String(b.id))
        )
        .map((j, i) => ({
            ...j,
            posicao: i + 1
        }));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Encerra a temporada da Liga e inicia uma nova temporada limpa.')
        .addStringOption(opt =>
            opt
                .setName('nome_temporada')
                .setDescription('Nome da temporada/Liga que será encerrada')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({
                content: '❌ Você não possui permissão para resetar a Liga.',
                flags: 64
            });
        }

        const nomeTemporada = String(
            interaction.options.getString('nome_temporada') || ''
        ).trim();

        if (!nomeTemporada) {
            return interaction.reply({
                content: '❌ Informe o nome da temporada.',
                flags: 64
            });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirmar_reset')
                .setLabel('Sim, encerrar e resetar')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🏆'),
            new ButtonBuilder()
                .setCustomId('cancelar_reset')
                .setLabel('Cancelar')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('✖️')
        );

        const msg = await interaction.reply({
            content:
                `⚠️ **ENCERRAMENTO DA LIGA**\n\n` +
                `**${nomeTemporada}** será arquivada.\n` +
                `📊 Estatísticas da temporada serão salvas.\n` +
                `🏆 Ranking será salvo no histórico/Hall da Fama.\n` +
                `📚 **A carreira permanente dos jogadores NÃO será resetada.**\n` +
                `🎖️ Patentes e histórico de vitórias permanecem intactos.\n` +
                `🔄 Somente os dados da temporada atual da Liga serão zerados.`,
            components: [row],
            flags: 64
        });

        try {
            const confirmation = await msg.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 15000
            });

            if (confirmation.customId === 'cancelar_reset') {
                return confirmation.update({
                    content: '❌ **Reset cancelado.** Nenhum dado foi alterado.',
                    components: []
                });
            }

            if (confirmation.customId !== 'confirmar_reset') return;

            // ============================================================
            // CARREGAR SOMENTE OS DADOS DA LIGA
            // ============================================================
            const pontuacao = safeReadJson(pontosPath) || {};
            const historico = safeReadJson(historicoPath) || {};
            const controle = safeReadJson(temporadaPath) || {};

            if (!Array.isArray(historico.liga)) {
                historico.liga = [];
            }

            const inicioTemporada =
                controle.inicio || new Date().toISOString();

            const fimTemporada = new Date().toISOString();

            // ============================================================
            // ARQUIVAR A TEMPORADA ANTES DE LIMPAR A PONTUAÇÃO
            // ============================================================
            const estatisticas = calcularEstatisticasTemporada(
                inicioTemporada,
                pontuacao
            );

            const ranking = ordenarRanking(estatisticas);

            const registro = {
                id: `liga_${Date.now()}_${interaction.user.id}`,
                categoria: 'liga',
                tipo: 'campeonato',
                nome: nomeTemporada,
                temporada: `Temporada ${numero(controle.numero) || 1}`,
                vencedor: ranking[0]
                    ? `<@${ranking[0].id}>`
                    : null,
                segundo: ranking[1]
                    ? `<@${ranking[1].id}>`
                    : null,
                terceiro: ranking[2]
                    ? `<@${ranking[2].id}>`
                    : null,
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
                throw new Error(
                    'Não foi possível salvar o histórico da temporada.'
                );
            }

            // Mantém o histórico permanente da carreira separado da Liga.
            careerHistory.registrarLigaFinalizada({
                temporada: registro.temporada,
                liga: nomeTemporada,
                jogadores: ranking,
                campeao: ranking[0] || null,
                top10: ranking.slice(0, 10)
            });

            // ============================================================
            // IMPORTANTE: NÃO TOCAR EM progressao.json
            // ============================================================
            // Não chamamos resetarCicloLiga().
            // Não alteramos totalWins.
            // Não alteramos currentRankId.
            // Não removemos cargos de patente.
            // Não zeramos vitórias históricas.
            // Não zeramos printsProcessados.
            // ============================================================

            // Cria o início do próximo ciclo.
            if (!safeWriteJson(temporadaPath, {
                inicio: fimTemporada,
                numero: (numero(controle.numero) || 1) + 1
            })) {
                throw new Error(
                    'Não foi possível criar a nova temporada.'
                );
            }

            // A pontuação corrente da Liga começa novamente em zero.
            // partidas.json NÃO é apagado: ele é o histórico permanente
            // usado pelos relatórios e pelo filtro de temporada.
            if (!safeWriteJson(pontosPath, {})) {
                throw new Error(
                    'Não foi possível zerar a pontuação atual da Liga.'
                );
            }

            await confirmation.update({
                content:
                    `✅ **${nomeTemporada} encerrada com sucesso!**\n\n` +
                    `🏆 Campeão: ${registro.vencedor || 'Nenhum'}\n` +
                    `🥈 2º lugar: ${registro.segundo || 'Nenhum'}\n` +
                    `🥉 3º lugar: ${registro.terceiro || 'Nenhum'}\n` +
                    `👥 Competidores: **${ranking.length}**\n\n` +
                    `📊 **Estatísticas da temporada arquivadas.**\n` +
                    `🏛️ **Histórico/Hall da Fama atualizado.**\n` +
                    `📚 **Carreira permanente preservada.**\n` +
                    `🎖️ **Patentes preservadas.**\n` +
                    `🏆 **Vitórias históricas preservadas.**\n` +
                    `🧹 **Pontuação da Liga zerada.**\n` +
                    `🔄 **Nova temporada iniciada limpa.**`,
                components: []
            });
        } catch (erro) {
            console.error('[LIGA RESET]', erro);

            await interaction
                .editReply({
                    content:
                        `❌ **Reset não concluído.**\n${erro.message}`,
                    components: []
                })
                .catch(() => {});
        }
    }
};
