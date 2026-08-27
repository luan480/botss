const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    UserSelectMenuBuilder
} = require('discord.js');

const periodosLiga = require('./utils/periodosLiga.js');

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function obterJogador(temporada, userId) {
    const jogadores = temporada?.jogadores || {};
    return jogadores[String(userId)] || null;
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
        .setDescription('Selecione **um jogador** abaixo para consultar somente as estatísticas dele.');
}

async function mostrarSelecao(interaction) {
    const embed = criarResumo();
    if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: '', embeds: [embed], components: [criarSeletor()] });
    }
    return interaction.reply({ content: '', embeds: [embed], components: [criarSeletor()], flags: MessageFlags.Ephemeral });
}

async function mostrarJogador(interaction, userId) {
    const temporada = periodosLiga.calcularTemporadaAtual();
    const jogador = obterJogador(temporada, userId);
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
    const derrotas = numero(jogador.derrotas);
    const kills = numero(jogador.kills);
    const mortes = numero(jogador.mortes);
    const pontos = numero(jogador.pontos);
    const continentes = numero(jogador.continentes);
    const winrate = partidas > 0 ? ((vitorias / partidas) * 100).toFixed(1) : '0.0';

    const nome = membro?.displayName || membro?.user?.globalName || membro?.user?.username || `Usuário ${userId}`;

    const embed = new EmbedBuilder()
        .setTitle(`📊 ESTATÍSTICAS — ${nome}`)
        .setColor('#2ECC71')
        .setDescription(
            `<@${userId}>\n\n` +
            `🏆 **${pontos} pontos**\n\n` +
            `⚔️ Partidas: **${partidas}**\n` +
            `✅ Vitórias: **${vitorias}**\n` +
            `❌ Derrotas: **${derrotas}**\n` +
            `💀 Kills: **${kills}**\n` +
            `☠️ Mortes: **${mortes}**\n` +
            `📈 Winrate: **${winrate}%**\n` +
            `🌍 Continentes: **${continentes}**`
        )
        .addFields({
            name: '🌍 Continentes conquistados',
            value:
                `🇪🇺 Europa: **${numero(jogador.europa)}** | ` +
                `🌏 Ásia: **${numero(jogador.asia)}**\n` +
                `🌍 África: **${numero(jogador.africa)}** | ` +
                `🌎 Am. Norte: **${numero(jogador.amnorte)}**\n` +
                `🌎 Am. Sul: **${numero(jogador.amsul)}** | ` +
                `🌊 Oceania: **${numero(jogador.oceania)}**`,
            inline: false
        })
        .setFooter({ text: 'Liga das Nações • Temporada atual' });

    return interaction.update({ content: '', embeds: [embed], components: [criarBotoes()] });
}

module.exports = async function estatisticasSelecionar(interaction) {
    const id = interaction.customId;

    if (id === 'estatisticas_selecionar') {
        return mostrarSelecao(interaction);
    }

    if (id === 'estatisticas_usuario') {
        const userId = interaction.values?.[0];
        if (!userId) return interaction.reply({ content: '❌ Nenhum jogador foi selecionado.', flags: MessageFlags.Ephemeral });
        return mostrarJogador(interaction, userId);
    }

    if (id === 'estatisticas_voltar') {
        const painelMod = require('./painel.js');
        await interaction.deferUpdate().catch(() => {});
        return painelMod(interaction.guild, '1429504377395351854');
    }
};
