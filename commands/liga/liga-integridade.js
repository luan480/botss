/* ========================================================================
   /liga-integridade

   Auditoria e reparo seguro do banco da Liga.
   ======================================================================== */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson, isStaff } = require('./utils/helpers.js');
const liga = require('./utils/pontuacaoLiga.js');

const PARTIDAS = path.join(__dirname, 'partidas.json');
const PONTOS = path.join(__dirname, 'pontuacao.json');
const TEMPORADA = path.join(__dirname, 'temporada.json');

const idValido = id => /^\d{17,20}$/.test(String(id || ''));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liga-integridade')
        .setDescription('Audita e corrige dados inconsistentes da Liga.')
        .addBooleanOption(opt => opt
            .setName('reparar')
            .setDescription('Preencher pontos ausentes e reconstruir a pontuação?')
            .setRequired(false)),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ Você não possui permissão para auditar a Liga.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const reparar = interaction.options.getBoolean('reparar') === true;
        const partidas = safeReadJson(PARTIDAS) || {};
        const relatorio = {
            total: Object.keys(partidas).length,
            validas: 0,
            anuladas: 0,
            pontosAusentes: 0,
            pontosReparados: 0,
            idsInvalidos: 0,
            legados: 0,
            problemas: []
        };

        const novo = JSON.parse(JSON.stringify(partidas));

        for (const [matchId, partida] of Object.entries(novo)) {
            if (!partida || typeof partida !== 'object') {
                relatorio.problemas.push(`${matchId}: registro não é objeto`);
                continue;
            }
            if (partida.anulada || partida.anulado || partida.cancelada || partida.cancelado) {
                relatorio.anuladas++;
                continue;
            }

            const jogadores = Array.isArray(partida.jogadoresBrutos) ? partida.jogadoresBrutos : [];
            if (!jogadores.length) {
                relatorio.legados++;
                continue;
            }

            relatorio.validas++;
            for (const jogador of jogadores) {
                if (!idValido(jogador?.id)) {
                    relatorio.idsInvalidos++;
                    relatorio.problemas.push(`${matchId}: jogador com ID inválido (${String(jogador?.id || 'vazio')})`);
                }
            }

            const pontos = partida.pontos && typeof partida.pontos === 'object' ? partida.pontos : {};
            let faltantes = false;
            for (const jogador of jogadores) {
                const id = String(jogador?.id || '');
                if (!idValido(id)) continue;
                if (pontos[id] === undefined || pontos[id] === null) {
                    faltantes = true;
                    relatorio.pontosAusentes++;
                    if (reparar) {
                        const valor = liga.pontosDaPartida(partida, id);
                        pontos[id] = {
                            ptsLiga: valor,
                            wcRecebido: valor > 0 ? valor * 100 : 0,
                            vitoria: id === String(partida.respostas?.vencedor || '') ? 1 : 0,
                            reparadoEm: new Date().toISOString()
                        };
                        relatorio.pontosReparados++;
                    }
                }
            }

            if (faltantes && reparar) {
                novo[matchId] = { ...partida, pontos };
            }
        }

        if (reparar) {
            if (!safeWriteJson(PARTIDAS, novo)) {
                return interaction.editReply({ content: '❌ Falha ao salvar o histórico reparado.' });
            }
            try {
                liga.sincronizarArquivo(PONTOS, PARTIDAS, TEMPORADA);
            } catch (erro) {
                return interaction.editReply({ content: `❌ Histórico reparado, mas a reconstrução da pontuação falhou: ${erro.message}` });
            }
        }

        const status = reparar ? '🛠️ REPARO EXECUTADO' : '🔎 SOMENTE AUDITORIA';
        const linhas = [
            `**${status}**`,
            `📚 Registros: **${relatorio.total}**`,
            `✅ Válidos: **${relatorio.validas}**`,
            `🚫 Anulados: **${relatorio.anuladas}**`,
            `⚠️ Pontos ausentes: **${relatorio.pontosAusentes}**`,
            `🔧 Pontos reparados: **${relatorio.pontosReparados}**`,
            `🆔 IDs inválidos: **${relatorio.idsInvalidos}**`,
            `📦 Registros legados: **${relatorio.legados}**`
        ];

        if (relatorio.problemas.length) {
            linhas.push(`\n**Primeiros problemas:**\n${relatorio.problemas.slice(0, 8).map(p => `• ${p}`).join('\n')}`);
        }

        return interaction.editReply({ content: linhas.join('\n') });
    }
};
