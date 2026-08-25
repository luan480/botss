/* ========================================================================
   ARQUIVO: commands/liga/reset.js

   RESET DA LIGA — FECHAMENTO COM HISTÓRICO COMPLETO

   FLUXO:
   1. Confirma o encerramento.
   2. Lê a pontuação e o período atual.
   3. Congela todas as estatísticas da temporada.
   4. Salva a temporada completa no Hall da Fama.
   5. Só depois zera a pontuação.
   6. Inicia o próximo período.

   IMPORTANTE:
   - historico.json nunca é zerado.
   - estatísticas históricas ficam congeladas no registro.
   - evita duplicar a mesma temporada.
   - partidas.json continua preservado para a Caixa Preta.
   ======================================================================== */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const path = require('path');

const {
    safeReadJson,
    safeWriteJson
} = require('./utils/helpers.js');

const { calcular: calcularEstatisticasTemporada } =
    require('./utils/temporadaStats.js');

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
        horario: agora.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Fortaleza',
            hour: '2-digit',
            minute: '2-digit'
        })
    };
}

function normalizarNome(nome) {
    return String(nome || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function ordenarRanking(estatisticas) {
    return Object.values(estatisticas || {})
        .map(jogador => ({
            ...jogador,
            pontos: numero(jogador.pontos)
        }))
        .sort((a, b) => {
            if (b.pontos !== a.pontos) return b.pontos - a.pontos;
            if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
            if (b.kills !== a.kills) return b.kills - a.kills;
            return String(a.id).localeCompare(String(b.id));
        });
}

function montarDescricao(ranking) {
    if (!ranking.length) return 'Nenhum competidor participou desta temporada.';

    return [
        `🏆 **Classificação final — ${ranking.length} competidor(es)**`,
        '',
        ...ranking.slice(0, 10).map((jogador, index) =>
            `${index + 1}º <@${jogador.id}> — **${jogador.pontos} pts**`
        )
    ].join('\n');
}

module.exports = {

    data:
        new SlashCommandBuilder()
            .setName('reset')
            .setDescription('Encerra a temporada, salva tudo no Hall da Fama e zera a Liga.')
            .addStringOption(opt =>
                opt
                    .setName('nome_temporada')
                    .setDescription('Ex: Temporada 1, Agosto 2026, Temporada 2026/01.')
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        const nomeTemporada = interaction.options.getString('nome_temporada').trim();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirmar_reset')
                .setLabel('Sim, encerrar temporada e resetar')
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
                `Você está prestes a encerrar **${nomeTemporada}**.\n\n` +
                `🏆 O ranking completo será salvo no **Hall da Fama**.\n` +
                `📊 Cada jogador terá suas estatísticas da temporada congeladas.\n` +
                `🔄 Depois disso, a pontuação atual será zerada.\n\n` +
                `**Essa ação não apaga o histórico.**`,
            components: [row],
            flags: 64
        });

        const filter = i => i.user.id === interaction.user.id;

        try {
            const confirmation = await msg.awaitMessageComponent({ filter, time: 15000 });

            if (confirmation.customId === 'cancelar_reset') {
                return confirmation.update({
                    content: '❌ **Encerramento cancelado.**\nNenhum dado da Liga foi alterado.',
                    components: []
                });
            }

            if (confirmation.customId !== 'confirmar_reset') return;

            const pontuacao = safeReadJson(pontosPath) || {};
            const historico = safeReadJson(historicoPath) || {};
            const controleTemporada = safeReadJson(temporadaPath) || {};

            if (!Array.isArray(historico.liga)) historico.liga = [];

            const inicioTemporada =
                controleTemporada.inicio ||
                new Date().toISOString();

            const estatisticas = calcularEstatisticasTemporada(
                inicioTemporada,
                pontuacao
            );

            const ranking = ordenarRanking(estatisticas);
            const top1 = ranking[0] || null;
            const top2 = ranking[1] || null;
            const top3 = ranking[2] || null;
            const horario = formatarData();

            const nomeNormalizado = normalizarNome(nomeTemporada);
            const duplicado = historico.liga.some(
                registro =>
                    registro &&
                    typeof registro === 'object' &&
                    normalizarNome(registro.nome) === nomeNormalizado
            );

            if (duplicado) {
                return confirmation.update({
                    content:
                        `❌ A temporada **${nomeTemporada}** já existe no Hall da Fama.\nO reset foi cancelado para evitar duplicação.`,
                    components: []
                });
            }

            const registroHistorico = {
                id: `liga_${Date.now()}_${interaction.user.id}`,
                categoria: 'liga',
                tipo: 'campeonato',
                nome: nomeTemporada,
                vencedor: top1 ? `<@${top1.id}>` : null,
                segundo: top2 ? `<@${top2.id}>` : null,
                terceiro: top3 ? `<@${top3.id}>` : null,
                data: horario.data,
                horario: horario.horario,
                inicioTemporada,
                fimTemporada: new Date().toISOString(),
                totalCompetidores: ranking.length,
                top10: ranking.slice(0, 10),
                rankingCompleto: ranking,
                estatisticas: ranking,
                descricao: montarDescricao(ranking),
                registradoPor: {
                    id: interaction.user.id,
                    username: interaction.user.username
                }
            };

            // O histórico é salvo ANTES do reset.
            historico.liga.push(registroHistorico);
            safeWriteJson(historicoPath, historico);

            // Atualiza o início da próxima temporada.
            safeWriteJson(temporadaPath, {
                inicio: registroHistorico.fimTemporada,
                numero: numero(controleTemporada.numero) + 1
            });

            // Só agora zera a pontuação da nova temporada.
            safeWriteJson(pontosPath, {});

            await confirmation.update({
                content:
                    `✅ **${nomeTemporada} encerrada com sucesso!**\n\n` +
                    `🏆 Campeão: ${registroHistorico.vencedor || 'Nenhum'}\n` +
                    `🥈 2º lugar: ${registroHistorico.segundo || 'Nenhum'}\n` +
                    `🥉 3º lugar: ${registroHistorico.terceiro || 'Nenhum'}\n` +
                    `👥 Competidores: **${ranking.length}**\n\n` +
                    `📊 **Top 10 e estatísticas completas foram congelados no Hall da Fama.**\n` +
                    `🔄 A próxima temporada já está pronta.`,
                components: []
            });

        } catch (erro) {
            console.error('[LIGA RESET] Erro ao encerrar temporada:', erro);

            await interaction.editReply({
                content:
                    '⌛ **Confirmação não recebida em 15 segundos.**\nAção cancelada e nenhum dado foi alterado.',
                components: []
            }).catch(() => {});
        }
    }
};
