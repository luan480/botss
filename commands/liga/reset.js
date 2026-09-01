/* ========================================================================
   RESET DA LIGA — FECHAMENTO + NOVA TEMPORADA
   ======================================================================== */

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson, isStaff } = require('./utils/helpers.js');
const pontuacaoLiga = require('./utils/pontuacaoLiga.js');
const careerHistory = require('../promocao/careerHistory.js');

const pontosPath = path.join(__dirname, 'pontuacao.json');
const partidasPath = path.join(__dirname, 'partidas.json');
const historicoPath = path.join(__dirname, '..', 'promocao', 'historico.json');
const temporadaPath = path.join(__dirname, 'temporada.json');
const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;

function ordenarRanking(perfis) {
    return Object.values(perfis || {})
        .map(j => ({ ...j, id: String(j.id), pontos: numero(j.pontos), vitorias: numero(j.vitorias), partidas: numero(j.partidas), kills: numero(j.kills), mortes: numero(j.mortes), continentes: numero(j.continentes) }))
        .filter(j => j.partidas > 0 || j.pontos !== 0 || j.vitorias > 0 || j.kills > 0 || j.mortes > 0 || j.continentes > 0)
        .sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias || b.kills - a.kills || String(a.id).localeCompare(String(b.id)))
        .map((j, i) => ({ ...j, posicao: i + 1 }));
}

const clonar = valor => JSON.parse(JSON.stringify(valor ?? {}));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Encerra a temporada da Liga e inicia uma nova temporada limpa.')
        .addStringOption(opt => opt.setName('nome_temporada').setDescription('Nome da temporada/Liga que será encerrada').setRequired(true)),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ Você não possui permissão para resetar a Liga.', flags: MessageFlags.Ephemeral });
        }

        const nomeTemporada = String(interaction.options.getString('nome_temporada') || '').trim();
        if (!nomeTemporada) return interaction.reply({ content: '❌ Informe o nome da temporada.', flags: MessageFlags.Ephemeral });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirmar_reset').setLabel('Sim, encerrar e resetar').setStyle(ButtonStyle.Danger).setEmoji('🏆'),
            new ButtonBuilder().setCustomId('cancelar_reset').setLabel('Cancelar').setStyle(ButtonStyle.Secondary).setEmoji('✖️')
        );

        const msg = await interaction.reply({
            content: `⚠️ **ENCERRAMENTO DA LIGA**\n\n**${nomeTemporada}** será arquivada.\n📊 As estatísticas serão calculadas do histórico válido.\n🏆 O ranking completo será arquivado.\n📚 Carreira e patentes não serão zeradas.`,
            components: [row],
            flags: MessageFlags.Ephemeral
        });

        let pontuacaoAntes = null;
        let historicoAntes = null;
        let temporadaAntes = null;

        try {
            const confirmation = await msg.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 15000 });
            if (confirmation.customId === 'cancelar_reset') {
                return confirmation.update({ content: '❌ **Reset cancelado.** Nenhum dado foi alterado.', components: [] });
            }
            if (confirmation.customId !== 'confirmar_reset') return;

            pontuacaoAntes = clonar(safeReadJson(pontosPath) || {});
            historicoAntes = clonar(safeReadJson(historicoPath) || {});
            temporadaAntes = clonar(safeReadJson(temporadaPath) || {});

            const temporadaAtual = safeReadJson(temporadaPath) || {};
            const inicioTemporada = temporadaAtual.inicio || new Date().toISOString();
            const fimTemporada = new Date().toISOString();
            const perfis = pontuacaoLiga.normalizarTodos(pontuacaoAntes, partidasPath, temporadaPath);
            const ranking = ordenarRanking(perfis);

            const registro = {
                id: `liga_${Date.now()}_${interaction.user.id}`,
                categoria: 'liga',
                tipo: 'campeonato',
                nome: nomeTemporada,
                temporada: `Temporada ${numero(temporadaAtual.numero) || 1}`,
                vencedor: ranking[0] ? `<@${ranking[0].id}>` : null,
                segundo: ranking[1] ? `<@${ranking[1].id}>` : null,
                terceiro: ranking[2] ? `<@${ranking[2].id}>` : null,
                inicioTemporada,
                fimTemporada,
                totalCompetidores: ranking.length,
                top10: ranking.slice(0, 10),
                rankingCompleto: ranking,
                estatisticas: ranking,
                registradoPor: { id: interaction.user.id, username: interaction.user.username }
            };

            const historicoNovo = clonar(historicoAntes);
            if (!Array.isArray(historicoNovo.liga)) historicoNovo.liga = [];
            historicoNovo.liga.push(registro);

            if (!safeWriteJson(historicoPath, historicoNovo)) throw new Error('Falha ao salvar histórico da Liga.');
            if (!safeWriteJson(temporadaPath, { ...temporadaAtual, inicio: fimTemporada, numero: (numero(temporadaAtual.numero) || 1) + 1 })) throw new Error('Falha ao iniciar nova temporada.');
            if (!safeWriteJson(pontosPath, {})) throw new Error('Falha ao zerar pontuação da temporada.');

            try {
                careerHistory.registrarLigaFinalizada({
                    temporada: registro.temporada,
                    liga: nomeTemporada,
                    jogadores: ranking,
                    campeao: ranking[0] || null,
                    top10: ranking.slice(0, 10)
                });
            } catch (erroCarreira) {
                console.error('[LIGA RESET] Histórico permanente não pôde ser atualizado:', erroCarreira);
            }

            await confirmation.update({
                content: `✅ **${nomeTemporada} encerrada com sucesso!**\n\n🏆 Campeão: ${registro.vencedor || 'Nenhum'}\n🥈 2º: ${registro.segundo || 'Nenhum'}\n🥉 3º: ${registro.terceiro || 'Nenhum'}\n👥 Competidores: **${ranking.length}**\n\n📊 Estatísticas arquivadas.\n🧹 Pontuação atual zerada.\n🔄 Nova temporada iniciada.\n📚 Carreira e patentes preservadas.`,
                components: []
            });
        } catch (erro) {
            console.error('[LIGA RESET]', erro);
            if (pontuacaoAntes !== null) safeWriteJson(pontosPath, pontuacaoAntes);
            if (historicoAntes !== null) safeWriteJson(historicoPath, historicoAntes);
            if (temporadaAntes !== null) safeWriteJson(temporadaPath, temporadaAntes);
            await interaction.editReply({ content: `❌ **Reset não concluído.**\n${erro.message}`, components: [] }).catch(() => {});
        }
    }
};
