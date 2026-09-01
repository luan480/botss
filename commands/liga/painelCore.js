/* ========================================================================
   PAINEL PRINCIPAL DA LIGA DAS NAÇÕES

   Fonte da pontuação: pontuacao.json da temporada atual.
   Nunca usa progressao.json como fonte do ranking da temporada.
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

const fs = require('fs');
const path = require('path');
const { safeReadJson } = require('./utils/helpers.js');
const pontuacaoLiga = require('./utils/pontuacaoLiga.js');

const pontuacaoPath = path.join(__dirname, 'pontuacao.json');
const painelPath = path.join(__dirname, 'painel.json');
const CANAL_PAINEL_LIGA = '1543636868682354748';

function rankingAtual() {
    const dados = safeReadJson(pontuacaoPath) || {};
    const perfis = pontuacaoLiga.normalizarTodos(dados);

    return Object.values(perfis)
        .map(j => ({
            ...j,
            id: String(j.id),
            pontos: Number(j.pontos) || 0,
            vitorias: Number(j.vitorias) || 0,
            partidas: Number(j.partidas) || 0
        }))
        .filter(j =>
            j.pontos !== 0 ||
            j.vitorias > 0 ||
            j.partidas > 0
        )
        .sort((a, b) =>
            b.pontos - a.pontos ||
            b.vitorias - a.vitorias ||
            b.partidas - a.partidas
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
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `### 🏆 LIGA DAS NAÇÕES 🏆\n🔥 **A Liga War Grow está ativa!**`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `📆 **Temporada atual**\n` +
                `⚔️ **Somente pontuação da temporada atual é exibida.**\n\n` +
                `__**PREMIAÇÃO:**__\n` +
                `🥇 **1º Lugar:** R$ 30,00 + <@&1429934221216186458>\n` +
                `🥈 **2º Lugar:** R$ 20,00 + <@&938174095470772305>\n` +
                `🥉 **3º Lugar:** <@&938174095470772305>`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `📈 **TOP 3 ATUAL — TEMPO REAL**\n\n` +
                `${linha(ranking[0], '🥇', 1)}\n` +
                `${linha(ranking[1], '🥈', 2)}\n` +
                `${linha(ranking[2], '🥉', 3)}`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Small)
        )
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(
                    'https://cdn.discordapp.com/attachments/1082774011676729365/1283426407313182803/WAR.gif'
                )
            )
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `📖 **GUIA DA LIGA:** regras, registro de partidas e pontuação.`
            )
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('iniciar_contabilizacao')
            .setLabel('Contabilizar')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('ver_ranking')
            .setLabel('Ver Ranking')
            .setEmoji('🏆')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('estatisticas_selecionar')
            .setLabel('Estatísticas')
            .setEmoji('📊')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('liga_guia')
            .setLabel('Guia da Liga')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Secondary)
    );

    const painelData = safeReadJson(painelPath) || {};
    let painelMsg = null;

    if (painelData.messageId) {
        painelMsg = await canal.messages.fetch(painelData.messageId).catch(() => null);
    }

    const payload = {
        flags: MessageFlags.IsComponentsV2,
        components: [containerPainel, row]
    };

    if (painelMsg) {
        await painelMsg.edit(payload);
        console.log('[Painel] Painel da Liga atualizado.');
        return painelMsg;
    }

    const novaMensagem = await canal.send(payload);

    fs.writeFileSync(
        painelPath,
        JSON.stringify({ messageId: novaMensagem.id }, null, 2) + '\n',
        'utf8'
    );

    console.log('[Painel] Novo painel da Liga criado.');
    return novaMensagem;
};
