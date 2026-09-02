/* ========================================================================
   /liga-integridade

   Auditoria e reparo seguro do banco da Liga.

   Regras:
   - partidas.json = fonte de verdade do histórico das partidas;
   - pontuacao.json = saldo atual + ajustes manuais;
   - pontos existentes também são auditados, não apenas pontos ausentes;
   - reparo sempre reconstrói a pontuação pelo histórico e preserva ajustes
     manuais registrados pelo sistema.
   ======================================================================== */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson, isStaff } = require('./utils/helpers.js');
const liga = require('./utils/pontuacaoLiga.js');

const PARTIDAS = path.join(__dirname, 'partidas.json');
const PONTOS = path.join(__dirname, 'pontuacao.json');
const TEMPORADA = path.join(__dirname, 'temporada.json');

const idValido = id => /^\d{17,20}$/.test(String(id || ''));
const numero = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

function listarPartidas(dados) {
    if (Array.isArray(dados)) return dados.map((partida, i) => [String(i), partida]);
    if (Array.isArray(dados?.partidas)) return dados.partidas.map((partida, i) => [String(i), partida]);
    return Object.entries(dados || {});
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liga-integridade')
        .setDescription('Audita e corrige dados inconsistentes da Liga.')
        .addBooleanOption(opt => opt
            .setName('reparar')
            .setDescription('Reconstruir pontos e corrigir inconsistências?')
            .setRequired(false)),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({
                content: '❌ Você não possui permissão para auditar a Liga.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const reparar = interaction.options.getBoolean('reparar') === true;
        const partidasBrutas = safeReadJson(PARTIDAS) || {};
        const pontosBrutos = safeReadJson(PONTOS) || {};

        const registros = listarPartidas(partidasBrutas);
        const historico = liga.calcularEstatisticasTemporada(PARTIDAS, TEMPORADA) || {};
        const esperado = liga.normalizarTodos(pontosBrutos, PARTIDAS, TEMPORADA) || {};

        const relatorio = {
            total: registros.length,
            validas: 0,
            anuladas: 0,
            legados: 0,
            pontosAusentes: 0,
            pontosInconsistentes: 0,
            estatisticasInconsistentes: 0,
            idsInvalidos: 0,
            reparados: 0,
            problemas: []
        };

        for (const [matchId, partida] of registros) {
            if (!partida || typeof partida !== 'object') {
                relatorio.problemas.push(`${matchId}: registro não é objeto`);
                continue;
            }

            if (partida.anulada || partida.anulado || partida.cancelada || partida.cancelado) {
                relatorio.anuladas++;
                continue;
            }

            const jogadores = Array.isArray(partida.jogadoresBrutos)
                ? partida.jogadoresBrutos
                : (Array.isArray(partida.jogadores) ? partida.jogadores : []);

            if (!jogadores.length) {
                relatorio.legados++;
                continue;
            }

            relatorio.validas++;

            for (const jogador of jogadores) {
                const id = String(jogador?.id || '');
                if (!idValido(id)) {
                    relatorio.idsInvalidos++;
                    relatorio.problemas.push(`${matchId}: jogador com ID inválido (${id || 'vazio'})`);
                }
            }

            const pontosPartida = partida.pontos && typeof partida.pontos === 'object'
                ? partida.pontos
                : {};

            for (const jogador of jogadores) {
                const id = String(jogador?.id || '');
                if (!idValido(id)) continue;

                if (pontosPartida[id] === undefined || pontosPartida[id] === null) {
                    relatorio.pontosAusentes++;
                }
            }
        }

        const ids = new Set([
            ...Object.keys(historico),
            ...Object.keys(esperado),
            ...Object.keys(pontosBrutos || {})
        ].filter(idValido));

        for (const id of ids) {
            const atual = pontosBrutos?.[id] && typeof pontosBrutos[id] === 'object'
                ? numero(pontosBrutos[id].pontos)
                : numero(pontosBrutos?.[id]);
            const esperadoJogador = esperado?.[id];
            if (!esperadoJogador) continue;

            const correto = numero(esperadoJogador.pontos);
            if (atual !== correto) {
                relatorio.pontosInconsistentes++;
                if (relatorio.problemas.length < 12) {
                    relatorio.problemas.push(`${id}: pontos ${atual} != esperado ${correto}`);
                }
            }

            const h = historico?.[id];
            if (h) {
                const campos = ['partidas', 'vitorias', 'kills', 'mortes', 'continentes', 'terceiroLugar', 'maisTropas'];
                const alvo = esperadoJogador;
                for (const campo of campos) {
                    if (numero(alvo?.[campo]) !== numero(h?.[campo])) {
                        relatorio.estatisticasInconsistentes++;
                        break;
                    }
                }
            }
        }

        if (reparar) {
            const backup = `${PONTOS}.backup-${Date.now()}`;
            const original = safeReadJson(PONTOS) || {};

            if (!safeWriteJson(`${PONTOS}.tmp-backup`, original)) {
                return interaction.editReply({ content: '❌ Não foi possível criar o backup temporário da pontuação.' });
            }

            try {
                // Reconstrói tudo pelo histórico, preservando apenas os ajustes
                // manuais explicitamente registrados em pontuacao.json.
                const reconstruido = liga.paraFormatoEstruturado(original, PARTIDAS, TEMPORADA);

                if (!liga.salvar(PONTOS, reconstruido)) {
                    throw new Error('Não foi possível salvar a pontuação reconstruída.');
                }

                // Mantém um backup legível ao lado do arquivo oficial.
                if (!safeWriteJson(backup, original)) {
                    throw new Error('Pontuação reconstruída, mas o backup não pôde ser gravado.');
                }

                relatorio.reparados = relatorio.pontosInconsistentes + relatorio.pontosAusentes;
            } catch (erro) {
                // Restauração segura usando o conteúdo que foi carregado antes do reparo.
                safeWriteJson(PONTOS, original);
                return interaction.editReply({
                    content: `❌ O reparo falhou e a pontuação original foi restaurada.\n${erro.message}`
                });
            } finally {
                try {
                    require('fs').unlinkSync(`${PONTOS}.tmp-backup`);
                } catch {}
            }
        }

        const status = reparar ? '🛠️ REPARO EXECUTADO' : '🔎 SOMENTE AUDITORIA';
        const linhas = [
            `**${status}**`,
            `📚 Registros: **${relatorio.total}**`,
            `✅ Válidos: **${relatorio.validas}**`,
            `🚫 Anulados: **${relatorio.anuladas}**`,
            `📦 Legados: **${relatorio.legados}**`,
            `⚠️ Pontos ausentes nas partidas: **${relatorio.pontosAusentes}**`,
            `❗ Pontos inconsistentes no ranking: **${relatorio.pontosInconsistentes}**`,
            `📊 Estatísticas inconsistentes: **${relatorio.estatisticasInconsistentes}**`,
            `🆔 IDs inválidos: **${relatorio.idsInvalidos}**`
        ];

        if (reparar) {
            linhas.push(`🔧 Itens corrigidos: **${relatorio.reparados}**`);
        }

        if (relatorio.problemas.length) {
            linhas.push(`\n**Primeiros problemas:**\n${relatorio.problemas.slice(0, 8).map(p => `• ${p}`).join('\n')}`);
        }

        return interaction.editReply({ content: linhas.join('\n') });
    }
};
