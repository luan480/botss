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

const base = __dirname;
const pontuacaoPath = path.join(base, 'pontuacao.json');
const partidasPath = path.join(base, 'partidas.json');
const temporadaPath = path.join(base, 'temporada.json');
const numero = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const percentual = (parte, total) => total > 0 ? Number(((parte / total) * 100).toFixed(1)) : 0;

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
        new ButtonBuilder().setCustomId('estatisticas_selecionar').setLabel('Escolher outro').setEmoji('🔄').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('estatisticas_voltar').setLabel('Voltar ao painel').setEmoji('🏠').setStyle(ButtonStyle.Secondary)
    );
}

async function mostrarSelecao(interaction) {
    const payload = {
        content: '',
        embeds: [new EmbedBuilder().setTitle('📊 ESTATÍSTICAS DA LIGA').setColor('#2ECC71').setDescription('Selecione **um jogador** abaixo para consultar as estatísticas completas da temporada atual.')],
        components: [criarSeletor()]
    };
    if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
    return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
}

function calcularMetricas(jogador) {
    const partidas = numero(jogador.partidas);
    const vitorias = numero(jogador.vitorias);
    const segundo = numero(jogador.segundoLugar);
    const terceiro = numero(jogador.terceiroLugar);
    const primeiro = numero(jogador.primeiroLugar || vitorias);
    const kills = numero(jogador.kills);
    const mortes = numero(jogador.mortes);
    const pontos = numero(jogador.pontos);
    const ganhos = numero(jogador.pontosGanhos);
    const perdidos = numero(jogador.pontosPerdidos);
    const podium = primeiro + segundo + terceiro;

    return {
        partidas,
        vitorias,
        primeiro,
        segundo,
        terceiro,
        podium,
        taxaPodio: percentual(podium, partidas),
        taxaSegundo: percentual(segundo, partidas),
        taxaTerceiro: percentual(terceiro, partidas),
        kills,
        mortes,
        kd: mortes > 0 ? Number((kills / mortes).toFixed(2)) : (kills > 0 ? kills : 0),
        mediaKills: partidas > 0 ? Number((kills / partidas).toFixed(2)) : 0,
        mediaMortes: partidas > 0 ? Number((mortes / partidas).toFixed(2)) : 0,
        saldoCombate: kills - mortes,
        mediaPontos: partidas > 0 ? Number((pontos / partidas).toFixed(2)) : 0,
        mediaGanhos: partidas > 0 ? Number((ganhos / partidas).toFixed(2)) : 0,
        mediaPerdas: partidas > 0 ? Number((perdidos / partidas).toFixed(2)) : 0,
        winrate: percentual(vitorias, partidas)
    };
}

function especialidades(m) {
    const titulos = [];
    if (m.vitorias >= 3 && m.vitorias >= m.segundo && m.vitorias >= m.terceiro) titulos.push('👑 Rei das Vitórias');
    if (m.segundo >= 3 && m.segundo > m.vitorias) titulos.push('🥈 Especialista em 2º');
    if (m.podium >= 5 && m.taxaPodio >= 60) titulos.push('🏅 Rei do Pódio');
    if (m.kills >= 5 && m.kills > m.mortes * 2) titulos.push('💀 Exterminador');
    if (m.mortes === 0 && m.partidas >= 2) titulos.push('🛡️ Sobrevivente');
    if (m.vitorias === m.partidas && m.partidas >= 2) titulos.push('🔥 Invicto');
    if (m.partidas >= 5 && m.taxaPodio >= 50) titulos.push('🎯 Consistente');
    if (m.saldoCombate > 0 && m.kills >= 3) titulos.push('⚔️ Guerreiro');
    return titulos.slice(0, 3);
}

function dominioFavorito(c) {
    const dominios = [
        ['🇪🇺 Europa', numero(c.europa)],
        ['🌏 Ásia', numero(c.asia)],
        ['🌍 África', numero(c.africa)],
        ['🌎 Am. Norte', numero(c.amnorte)],
        ['🌎 Am. Sul', numero(c.amsul)],
        ['🌊 Oceania', numero(c.oceania)]
    ].sort((a, b) => b[1] - a[1]);
    return dominios[0]?.[1] > 0 ? `${dominios[0][0]} (**${dominios[0][1]}**)` : 'Nenhum ainda';
}

async function mostrarJogador(interaction, userId) {
    const dados = pontuacaoLiga.normalizarTodos(
        pontuacaoLiga.carregar(pontuacaoPath),
        partidasPath,
        temporadaPath
    );
    const jogador = dados[String(userId)];
    const membro = await interaction.guild.members.fetch(userId).catch(() => null);

    if (!jogador) {
        return interaction.update({ content: '❌ Esse jogador ainda não possui estatísticas registradas nesta temporada.', embeds: [], components: [criarBotoes()] });
    }

    const m = calcularMetricas(jogador);
    const pontos = numero(jogador.pontos);
    const continentes = numero(jogador.continentes);
    const ganhos = numero(jogador.pontosGanhos);
    const perdidos = numero(jogador.pontosPerdidos);
    const warCoins = numero(jogador.warCoins);
    const nome = membro?.displayName || membro?.user?.globalName || membro?.user?.username || jogador.nome || `Usuário ${userId}`;
    const c = jogador.continentesDetalhes || {};
    const titulos = especialidades(m);

    const embed = new EmbedBuilder()
        .setTitle(`📊 ESTATÍSTICAS — ${nome}`)
        .setColor('#2ECC71')
        .setDescription(
            `🏆 **${pontos} pts**  •  🎮 **${m.partidas} partidas**  •  📈 **${m.winrate}% winrate**\n` +
            `🥇 **${m.primeiro}**  •  🥈 **${m.segundo}**  •  🥉 **${m.terceiro}**  •  🏅 **${m.podium} pódios** (**${m.taxaPodio}%**)`
        )
        .addFields({
            name: '🏆 Colocações',
            value: `🥇 1º lugar: **${m.primeiro}** (${percentual(m.primeiro, m.partidas)}%)\n` +
                `🥈 2º lugar: **${m.segundo}** (${m.taxaSegundo}%)\n` +
                `🥉 3º lugar: **${m.terceiro}** (${m.taxaTerceiro}%)\n` +
                `🏅 Total de pódios: **${m.podium}** (${m.taxaPodio}%)`,
            inline: true
        }, {
            name: '⚔️ Combate',
            value: `💀 Kills: **${m.kills}** (média ${m.mediaKills})\n` +
                `☠️ Mortes: **${m.mortes}** (média ${m.mediaMortes})\n` +
                `📊 K/D: **${m.kd}**\n` +
                `⚖️ Saldo: **${m.saldoCombate >= 0 ? '+' : ''}${m.saldoCombate}**`,
            inline: true
        }, {
            name: '💰 Pontuação',
            value: `📈 Ganhos: **+${ganhos}**\n` +
                `📉 Perdidos: **-${perdidos}**\n` +
                `🎯 Média por partida: **${m.mediaPontos} pts**\n` +
                `💰 WarCoins: **${warCoins}**`,
            inline: true
        }, {
            name: '🌍 Domínios',
            value: `Total: **${continentes}**\n` +
                `🇪🇺 Europa: **${numero(c.europa)}** | 🌏 Ásia: **${numero(c.asia)}**\n` +
                `🌍 África: **${numero(c.africa)}** | 🌎 Am. Norte: **${numero(c.amnorte)}**\n` +
                `🌎 Am. Sul: **${numero(c.amsul)}** | 🌊 Oceania: **${numero(c.oceania)}**\n` +
                `⭐ Especialidade: **${dominioFavorito(c)}**`,
            inline: false
        }, {
            name: '🎖️ Perfil',
            value: titulos.length ? titulos.join(' • ') : '⚔️ Guerreiro em formação — continue jogando para construir seu histórico.',
            inline: false
        })
        .setFooter({ text: 'Liga das Nações • Estatísticas derivadas do histórico da temporada atual' });

    return interaction.update({ content: '', embeds: [embed], components: [criarBotoes()] });
}

module.exports = async function estatisticasSelecionar(interaction) {
    const id = String(interaction.customId || '');
    if (id === 'estatisticas_selecionar' || id === 'liga_estatisticas' || id.startsWith('liga_estatisticas_prev_') || id.startsWith('liga_estatisticas_next_') || id.startsWith('liga_estatisticas_pagina_')) {
        return mostrarSelecao(interaction);
    }
    if (id === 'estatisticas_usuario') {
        const userId = interaction.values?.[0];
        if (!userId) return interaction.reply({ content: '❌ Nenhum jogador foi selecionado.', flags: MessageFlags.Ephemeral });
        return mostrarJogador(interaction, userId);
    }
    if (id === 'estatisticas_voltar' || id === 'liga_estatisticas_voltar') {
        await interaction.deferUpdate().catch(() => {});
        return require('./painel.js')(interaction.guild, '1543636868682354748');
    }
};
