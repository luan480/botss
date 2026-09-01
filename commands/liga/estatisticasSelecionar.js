const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    UserSelectMenuBuilder
} = require('discord.js');

const path = require('path');
const pontuacaoLiga = require('./utils/pontuacaoLiga.js');

const pontuacaoPath = path.join(__dirname, 'pontuacao.json');

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function criarSeletor() {
    return new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
            .setCustomId('estatisticas_usuario')
            .setPlaceholder('🔎 Escolha o jogador')
            .setMinValues(1)
            .setMaxValues(1)
    );
}

function criarBotoes() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('estatisticas_selecionar')
            .setLabel('Escolher outro')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('estatisticas_voltar')
            .setLabel('Voltar ao painel')
            .setEmoji('🏠')
            .setStyle(ButtonStyle.Secondary)
    );
}

function criarResumo() {
    return new EmbedBuilder()
        .setTitle('📊 ESTATÍSTICAS DA LIGA')
        .setColor('#2ECC71')
        .setDescription(
            'Selecione **um jogador** abaixo para consultar as estatísticas da temporada atual.'
        );
}

async function mostrarSelecao(interaction) {
    const embed = criarResumo();
    if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
            content: '',
            embeds: [embed],
            components: [criarSeletor()]
        });
    }

    return interaction.reply({
        content: '',
        embeds: [embed],
        components: [criarSeletor()],
        flags: MessageFlags.Ephemeral
    });
}

async function mostrarJogador(interaction, userId) {
    // Sempre lê o estado atual da temporada. Não usa carreira/patentes.
    const dados = pontuacaoLiga.normalizarTodos(
        pontuacaoLiga.carregar(pontuacaoPath)
    );

    const jogador = dados[String(userId)];
    const membro = await interaction.guild.members.fetch(userId).catch(() => null);

    if (!jogador) {
        return interaction.update({
            content: '❌ Esse jogador ainda não possui estatísticas registradas nesta temporada.',
            embeds: [],
            components: [criarBotoes()]
        });
    }

    const partidas = numero(jogador.partidas);
    const vitorias = numero(jogador.vitorias);
    const derrotas = Math.max(0, partidas - vitorias);
    const kills = numero(jogador.kills);
    const mortes = numero(jogador.mortes);
    const pontos = numero(jogador.pontos);
    const continentes = numero(jogador.continentes);
    const winrate = partidas > 0
        ? ((vitorias / partidas) * 100).toFixed(1)
        : '0.0';

    const nome =
        membro?.displayName ||
        membro?.user?.globalName ||
        membro?.user?.username ||
        jogador.nome ||
        `Usuário ${userId}`;

    const c = jogador.continentesDetalhes || {};

    const embed = new EmbedBuilder()
        .setTitle(`📊 ESTATÍSTICAS — ${nome}`)
        .setColor('#2ECC71')
        .setDescription(
            `🆔 **ID:** ${userId}\n` +
            `👤 **Nome:** ${nome}\n\n` +
            `🏆 **Pontuação atual:** ${pontos} pts\n` +
            `🥇 **Vitórias:** ${vitorias}\n` +
            `🎮 **Partidas:** ${partidas}\n` +
            `💀 **Kills:** ${kills}\n` +
            `☠️ **Mortes:** ${mortes}\n` +
            `🌍 **Continentes:** ${continentes}\n` +
            `📈 **Winrate:** ${winrate}%`
        )
        .addFields({
            name: '🌍 Continentes conquistados',
            value:
                `🇪🇺 Europa: **${numero(c.europa)}** | ` +
                `🌏 Ásia: **${numero(c.asia)}**\n` +
                `🌍 África: **${numero(c.africa)}** | ` +
                `🌎 Am. Norte: **${numero(c.amnorte)}**\n` +
                `🌎 Am. Sul: **${numero(c.amsul)}** | ` +
                `🌊 Oceania: **${numero(c.oceania)}**`,
            inline: false
        })
        .addFields({
            name: '🏅 Classificação extra',
            value:
                `🥉 3º lugares: **${numero(jogador.terceiroLugar)}** | ` +
                `⚔️ Mais tropas: **${numero(jogador.maisTropas)}**`,
            inline: false
        })
        .setFooter({ text: 'Liga das Nações • Temporada atual' });

    return interaction.update({
        content: '',
        embeds: [embed],
        components: [criarBotoes()]
    });
}

module.exports = async function estatisticasSelecionar(interaction) {
    const id = interaction.customId;

    if (
        id === 'estatisticas_selecionar' ||
        id === 'liga_estatisticas' ||
        id.startsWith('liga_estatisticas_prev_') ||
        id.startsWith('liga_estatisticas_next_') ||
        id.startsWith('liga_estatisticas_pagina_')
    ) {
        return mostrarSelecao(interaction);
    }

    if (id === 'estatisticas_usuario') {
        const userId = interaction.values?.[0];
        if (!userId) {
            return interaction.reply({
                content: '❌ Nenhum jogador foi selecionado.',
                flags: MessageFlags.Ephemeral
            });
        }
        return mostrarJogador(interaction, userId);
    }

    if (id === 'estatisticas_voltar' || id === 'liga_estatisticas_voltar') {
        const painelMod = require('./painel.js');
        await interaction.deferUpdate().catch(() => {});
        return painelMod(interaction.guild, '1543636868682354748');
    }
};
