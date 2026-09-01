/* ========================================================================
   LIGA — ROUTER DE BOTÕES

   Este arquivo NÃO calcula estatísticas nem altera formatos de JSON.
   O registro é delegado ao handleIniciar e as estatísticas ao
   estatisticasSelecionar/index.
   ======================================================================== */

const path = require('path');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');
const { safeReadJson, isStaff } = require('./utils/helpers.js');
const pontuacaoLiga = require('./utils/pontuacaoLiga.js');
const handleIniciar = require('./handlers/handleIniciar.js');
const painel = require('./painel.js');

const PONTOS = path.join(__dirname, 'pontuacao.json');
const PARTIDAS = path.join(__dirname, 'partidas.json');
const TEMPORADA = path.join(__dirname, 'temporada.json');
const ECONOMY = path.join(__dirname, '..', 'economy', 'economy.json');
const PROGRESSAO = path.join(__dirname, '..', 'promocao', 'progressao.json');
const CARREIRAS = path.join(__dirname, '..', 'promocao', 'carreiras.json');

function deferSeguro(interaction) {
    if (interaction.replied || interaction.deferred) return Promise.resolve(true);
    return interaction.deferReply({ flags: MessageFlags.Ephemeral })
        .then(() => true)
        .catch(() => false);
}

function criarPaginacao(pagina, total) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`liga_ranking_prev_${pagina}`).setLabel('Anterior').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(pagina <= 1),
        new ButtonBuilder().setCustomId(`liga_ranking_page_${pagina}`).setLabel(`${pagina}/${total}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`liga_ranking_next_${pagina}`).setLabel('Próxima').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(pagina >= total),
        new ButtonBuilder().setCustomId('liga_ranking_voltar').setLabel('Painel').setEmoji('🏠').setStyle(ButtonStyle.Primary)
    );
}

function rankingAtual() {
    const dados = safeReadJson(PONTOS) || {};
    const perfis = pontuacaoLiga.normalizarTodos(dados, PARTIDAS, TEMPORADA);
    return Object.values(perfis)
        .filter(j => Number(j.partidas) > 0 || Number(j.pontos) !== 0)
        .sort((a, b) => Number(b.pontos) - Number(a.pontos) || Number(b.vitorias) - Number(a.vitorias) || Number(b.kills) - Number(a.kills) || String(a.id).localeCompare(String(b.id)));
}

async function nomeJogador(guild, id, fallback = 'Jogador') {
    const membro = await guild.members.fetch(String(id)).catch(() => null);
    return membro?.displayName || membro?.user?.globalName || membro?.user?.username || fallback;
}

async function mostrarRanking(interaction, pagina = 1) {
    const ranking = rankingAtual();
    const porPagina = 10;
    const totalPaginas = Math.max(1, Math.ceil(ranking.length / porPagina));
    const atual = Math.max(1, Math.min(Number(pagina) || 1, totalPaginas));
    const itens = ranking.slice((atual - 1) * porPagina, atual * porPagina);

    const linhas = [];
    for (let i = 0; i < itens.length; i++) {
        const jogador = itens[i];
        const pos = (atual - 1) * porPagina + i + 1;
        const emoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `${pos}º`;
        const nome = await nomeJogador(interaction.guild, jogador.id, jogador.nome);
        linhas.push(`${emoji} **${nome}** — <@${jogador.id}> — **${Number(jogador.pontos) || 0} pts**`);
    }

    const embed = new EmbedBuilder()
        .setTitle('🏆 RANKING — LIGA DAS NAÇÕES')
        .setColor('#F1C40F')
        .setDescription(`**${ranking.length} competidores ativos**\n**Página ${atual}/${totalPaginas}**\n\n${linhas.join('\n') || '*Nenhum registro válido na temporada.*'}`)
        .setFooter({ text: 'Pontuação calculada pelo histórico válido da temporada.' });

    return interaction.editReply({ embeds: [embed], components: [criarPaginacao(atual, totalPaginas)], content: '' });
}

function criarGuia() {
    return new EmbedBuilder()
        .setTitle('📖 LIGA DAS NAÇÕES — GUIA')
        .setColor('#9B59B6')
        .setDescription(
            '📜 **Regras** — requisitos e anti-jogo.\n\n' +
            '🤖 **Como registrar** — passo a passo da contabilização.\n\n' +
            '❓ **Perguntas** — dúvidas frequentes.\n\n' +
            '🧮 **Pontuação** — valores oficiais do sistema.'
        );
}

function botoesGuia() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('liga_guia_regras').setLabel('Regras').setEmoji('📜').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('liga_guia_registrar').setLabel('Como registrar').setEmoji('🤖').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('liga_guia_perguntas').setLabel('Perguntas').setEmoji('❓').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('liga_guia_pontuacao').setLabel('Pontuação').setEmoji('🧮').setStyle(ButtonStyle.Success)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('liga_guia_voltar').setLabel('Voltar ao painel').setEmoji('🏠').setStyle(ButtonStyle.Primary)
        )
    ];
}

function subGuia(titulo, texto) {
    return new EmbedBuilder().setTitle(titulo).setColor('#3498DB').setDescription(texto);
}

async function mostrarGuia(interaction) {
    if (!(await deferSeguro(interaction))) return;
    return interaction.editReply({ embeds: [criarGuia()], components: botoesGuia(), content: '' });
}

async function mostrarSubGuia(interaction, embed) {
    if (!(await deferSeguro(interaction))) return;
    return interaction.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('liga_guia').setLabel('Voltar ao guia').setEmoji('📖').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('liga_guia_voltar').setLabel('Painel').setEmoji('🏠').setStyle(ButtonStyle.Primary)
    )], content: '' });
}

async function voltarPainel(interaction) {
    if (!(await deferSeguro(interaction))) return;
    try {
        return await painel(interaction.guild, '1429504377395351854');
    } catch (erro) {
        console.error('[LIGA] Erro ao restaurar painel:', erro);
        return interaction.editReply({ content: '❌ Não foi possível restaurar o painel.', embeds: [], components: [] });
    }
}

async function reverter(interaction) {
    return require('./handlers/handleReverter.js')(null, interaction, PONTOS, PARTIDAS);
}

module.exports = async (client, interaction) => {
    const id = String(interaction.customId || '');

    if (id === 'iniciar_contabilizacao') {
        if (!(await deferSeguro(interaction))) return;
        return handleIniciar(client, interaction, PONTOS, PARTIDAS);
    }

    if (id === 'ver_ranking') {
        if (!(await deferSeguro(interaction))) return;
        return mostrarRanking(interaction, 1);
    }

    if (id.startsWith('liga_ranking_prev_')) {
        if (!(await deferSeguro(interaction))) return;
        return mostrarRanking(interaction, (Number(id.split('_').pop()) || 1) - 1);
    }

    if (id.startsWith('liga_ranking_next_')) {
        if (!(await deferSeguro(interaction))) return;
        return mostrarRanking(interaction, (Number(id.split('_').pop()) || 1) + 1);
    }

    if (id === 'liga_ranking_voltar') return voltarPainel(interaction);

    if (id === 'liga_guia') return mostrarGuia(interaction);

    if (id === 'liga_guia_regras') {
        return mostrarSubGuia(interaction, subGuia('🛡️ REGRAS OFICIAIS',
            '• A partida deve cumprir os requisitos publicados pela Liga.\n' +
            '• Ghosting, cheats, farming, perseguição, kamikaze e entrega abusiva de abate são proibidos.\n' +
            '• Denúncias devem ser feitas pelos canais oficiais.\n\n' +
            '☠️ **Entrega de abate:** só é válida quando houver justificativa estratégica conforme as regras da Liga.\n\n' +
            '🌾 **Farming:** troca repetitiva e intencional de territórios para manipular cartas é proibida.'
        ));
    }

    if (id === 'liga_guia_registrar') {
        return mostrarSubGuia(interaction, subGuia('🤖 COMO REGISTRAR',
            '1️⃣ Abra o painel da Liga.\n2️⃣ Clique em **Contabilizar**.\n3️⃣ Envie os prints.\n4️⃣ Informe os 6 participantes.\n5️⃣ Informe modo, colocação, abates e continentes.\n6️⃣ Confirme e confira o resultado.\n\n📸 O registro fica associado ao resultado publicado para permitir auditoria/anulação.'
        ));
    }

    if (id === 'liga_guia_perguntas') {
        return mostrarSubGuia(interaction, subGuia('❓ PERGUNTAS FREQUENTES',
            '**Onde vejo o ranking?** 🏆 Ver Ranking.\n\n**Onde vejo minhas estatísticas?** 📊 Estatísticas.\n\n**Partida anulada conta?** Não. Ela permanece auditável e é ignorada pelas estatísticas.\n\n**O limite de partidas existe?** Sim; ele é controlado no registro e deve ser tratado por temporada.'
        ));
    }

    if (id === 'liga_guia_pontuacao') {
        return mostrarSubGuia(interaction, subGuia('🧮 PONTUAÇÃO',
            '🏆 Vitória por objetivo: **+30**\n🌍 Vitória por territórios: **+20**\n🥈 Segundo lugar: **+10**\n🥉 Terceiro lugar: **+5**\n⚔️ Mais tropas: **+5**\n🛡️ Sobrevivência: **+5**\n💀 Kill: **+10**\n☠️ Morte: **-15**\n\n🌏 Ásia +7 • 🇪🇺 Europa +5 • 🌍 África +3 • 🌎 Am. Norte +5 • 🌎 Am. Sul +2 • 🌊 Oceania +2'
        ));
    }

    if (id === 'liga_guia_voltar') return voltarPainel(interaction);
    if (id.startsWith('edit_match_')) return reverter(interaction);
};
