/* ========================================================================
   PAINEL PRINCIPAL DA LIGA DAS NAÇÕES
   ======================================================================== */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} = require('discord.js');

const path = require('path');
const { safeReadJson, safeWriteJson } = require('./utils/helpers.js');
const pontuacaoLiga = require('./utils/pontuacaoLiga.js');
const migracaoLiga = require('./utils/migracaoLiga.js');

const base = __dirname;
const pontuacaoPath = path.join(base, 'pontuacao.json');
const partidasPath = path.join(base, 'partidas.json');
const temporadaPath = path.join(base, 'temporada.json');
const painelPath = path.join(base, 'painel.json');
const CANAL_PAINEL_LIGA = '1543636868682354748';
const META_EDICAO_DIRETA = 'manualEdicaoDiretaV1';

let integridadeExecutada = false;
let pontuacaoSincronizada = false;

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function idValido(id) {
    return /^\d{17,20}$/.test(String(id || ''));
}

function capturarEdicoesManuaisDiretas() {
    const dados = safeReadJson(pontuacaoPath) || {};
    if (dados?._ligaMeta?.[META_EDICAO_DIRETA] !== true) return;

    const historico = pontuacaoLiga.calcularEstatisticasTemporada(
        partidasPath,
        temporadaPath
    );

    let alterou = false;

    for (const [id, perfil] of Object.entries(dados)) {
        if (!idValido(id) || !perfil || typeof perfil !== 'object') continue;

        const baseHistorica = numero(historico[id]?.pontos);
        const pontosAtuais = numero(perfil.pontos ?? perfil.ptsLiga ?? perfil.pontuacao);
        const ajusteAtual = pontosAtuais - baseHistorica;

        // O próprio bot já materializa exatamente esta relação. Portanto,
        // qualquer diferença encontrada aqui representa uma edição feita
        // diretamente no pontuacao.json e deve virar ajuste manual.
        const ajusteSalvo = perfil.ajusteManual === true
            ? numero(perfil.ajusteManualValor)
            : 0;

        if (perfil.ajusteManual !== true || ajusteSalvo !== ajusteAtual) {
            perfil.ajusteManual = true;
            perfil.ajusteManualValor = ajusteAtual;
            perfil.ajusteManualEm = new Date().toISOString();
            perfil.ajusteManualPor = 'edicao direta em pontuacao.json';
            alterou = true;
        }
    }

    if (alterou) {
        safeWriteJson(pontuacaoPath, dados);
    }
}

function prepararEstadoUmaVez() {
    if (!integridadeExecutada) {
        try {
            const reparados = migracaoLiga.executar();
            if (reparados > 0) {
                console.log(`[LIGA] ${reparados} registros com pontos ausentes foram reparados.`);
            }
            integridadeExecutada = true;
        } catch (erro) {
            console.error('[LIGA] Migração automática de integridade falhou:', erro);
            throw erro;
        }
    }

    if (!pontuacaoSincronizada) {
        try {
            const dados = safeReadJson(pontuacaoPath) || {};
            const inicializado = dados?._ligaMeta?.[META_EDICAO_DIRETA] === true;

            // Primeira inicialização: limpa os "pontos" antigos/stale e grava
            // a base correta do histórico. Depois disso, diferenças editadas
            // diretamente pelo administrador passam a ser ajustes manuais.
            if (!inicializado) {
                pontuacaoLiga.sincronizarArquivo(
                    pontuacaoPath,
                    partidasPath,
                    temporadaPath
                );

                const atualizado = safeReadJson(pontuacaoPath) || {};
                atualizado._ligaMeta = {
                    ...(atualizado._ligaMeta || {}),
                    [META_EDICAO_DIRETA]: true
                };
                safeWriteJson(pontuacaoPath, atualizado);
            } else {
                capturarEdicoesManuaisDiretas();
                pontuacaoLiga.sincronizarArquivo(
                    pontuacaoPath,
                    partidasPath,
                    temporadaPath
                );
            }

            pontuacaoSincronizada = true;
        } catch (erro) {
            console.error('[LIGA] Sincronização automática da pontuação falhou:', erro);
            throw erro;
        }
    }

    // Permite que uma edição feita no GitHub/arquivo local seja reconhecida
    // mesmo depois que o processo já sincronizou a pontuação uma vez.
    capturarEdicoesManuaisDiretas();
}

function rankingAtual() {
    prepararEstadoUmaVez();

    const dados = safeReadJson(pontuacaoPath) || {};
    const perfis = pontuacaoLiga.normalizarTodos(dados, partidasPath, temporadaPath);

    return Object.values(perfis)
        .map(j => ({
            ...j,
            id: String(j.id),
            pontos: Number(j.pontos) || 0,
            vitorias: Number(j.vitorias) || 0,
            partidas: Number(j.partidas) || 0
        }))
        .filter(j => j.partidas > 0 || j.pontos !== 0 || j.vitorias > 0)
        .sort((a, b) =>
            b.pontos - a.pontos ||
            b.vitorias - a.vitorias ||
            b.partidas - a.partidas ||
            String(a.id).localeCompare(String(b.id))
        );
}

module.exports = async function criarPainelDashboard(guild, canalId) {
    if (!guild) throw new Error('Guild não informada.');

    const canalFinal = String(canalId || CANAL_PAINEL_LIGA);
    const canal = await guild.channels.fetch(canalFinal).catch(() => null);
    if (!canal) throw new Error(`Canal ${canalFinal} não encontrado.`);
    if (!canal.isTextBased()) throw new Error('O canal informado não é de texto.');

    const ranking = rankingAtual();
    const linha = (j, emoji, posicao) =>
        j
            ? `${emoji} **${posicao}º** <@${j.id}> — **${j.pontos} pts**`
            : `${emoji} **${posicao}º** ⏳ *Vago*`;

    const containerPainel = new ContainerBuilder()
        .setAccentColor(0x9B59B6)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 🏆 LIGA DAS NAÇÕES 🏆\n🔥 **A Liga War Grow está ativa!**'))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `📆 **Temporada atual**\n` +
            `⚔️ **Estado calculado pelo histórico válido + ajustes manuais.**\n\n` +
            `__**PREMIAÇÃO:**__\n` +
            `🥇 **1º Lugar:** R$ 30,00 + <@&1429934221216186458>\n` +
            `🥈 **2º Lugar:** R$ 20,00 + <@&938174095470772305>\n` +
            `🥉 **3º Lugar:** <@&938174095470772305>`
        ))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `📈 **TOP 3 ATUAL — TEMPO REAL**\n\n` +
            `${linha(ranking[0], '🥇', 1)}\n` +
            `${linha(ranking[1], '🥈', 2)}\n` +
            `${linha(ranking[2], '🥉', 3)}`
        ))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL('https://cdn.discordapp.com/attachments/1082774011676729365/1283426407313182803/WAR.gif')
        ))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent('📖 **GUIA DA LIGA:** regras, registro de partidas e pontuação.'));

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('iniciar_contabilizacao').setLabel('Contabilizar').setEmoji('▶️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ver_ranking').setLabel('Ver Ranking').setEmoji('🏆').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('estatisticas_selecionar').setLabel('Estatísticas').setEmoji('📊').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('liga_guia').setLabel('Guia da Liga').setEmoji('📖').setStyle(ButtonStyle.Secondary)
    );

    const painelData = safeReadJson(painelPath) || {};
    let painelMsg = null;
    if (painelData.messageId) painelMsg = await canal.messages.fetch(painelData.messageId).catch(() => null);

    const payload = { flags: MessageFlags.IsComponentsV2, components: [containerPainel, row] };
    if (painelMsg) {
        await painelMsg.edit(payload);
        return painelMsg;
    }

    const novaMensagem = await canal.send(payload);
    safeWriteJson(painelPath, { messageId: novaMensagem.id });
    return novaMensagem;
};
