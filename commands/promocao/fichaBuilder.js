/* ========================================================================
   ARQUIVO: commands/promocao/fichaBuilder.js
   DESCRIÇÃO: Construtor único da Ficha Militar WorldWarBR.
   Usado pelo print automático, /carreira status e botão Ver Ficha.

   IMPORTANTE:
   - Este arquivo é a fonte única da ficha.
   - Não cria um sistema separado para /carreira.
   - Os dados são lidos do progressao.json/economy.json.
   ======================================================================== */

const { EmbedBuilder } = require('discord.js');

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function formatarNumero(valor) {
    return numero(valor).toLocaleString('pt-BR');
}

function obterDadosCarreira({ progressao, carreiras, userId, member }) {
    const dados = progressao?.[userId];
    if (!dados) return null;

    const faccao = carreiras?.faccoes?.[dados.factionId];
    if (!faccao || !Array.isArray(faccao.caminho) || !faccao.caminho.length) {
        return null;
    }

    const totalWins = numero(dados.totalWins);
    const semanal = numero(dados.vitoriasSemanais);
    const mensal = numero(dados.vitoriasMensais);

    let rankAtual = faccao.caminho[0];
    let indiceAtual = 0;

    // Mantém a patente coerente com a progressão de vitórias.
    for (let i = 0; i < faccao.caminho.length; i++) {
        const custo = numero(faccao.caminho[i]?.custo);
        if (totalWins >= custo) {
            rankAtual = faccao.caminho[i];
            indiceAtual = i;
        }
    }

    const proximaPatente = faccao.caminho[indiceAtual + 1] || null;
    const custoAtual = numero(rankAtual?.custo);
    const custoProxima = proximaPatente ? numero(proximaPatente.custo) : custoAtual;

    let percentual = 100;
    let faltam = 0;

    if (proximaPatente) {
        faltam = Math.max(0, custoProxima - totalWins);
        const intervalo = Math.max(1, custoProxima - custoAtual);
        const progressoNoNivel = Math.max(0, totalWins - custoAtual);
        percentual = Math.min(100, Math.round((progressoNoNivel / intervalo) * 100));
    }

    const barras = 12;
    const preenchidas = Math.max(0, Math.min(barras, Math.round((percentual / 100) * barras)));
    const barra = '▰'.repeat(preenchidas) + '▱'.repeat(barras - preenchidas);

    // Ranking global por vitórias.
    const ranking = Object.entries(progressao || {})
        .map(([id, valor]) => ({
            id,
            wins: numero(valor?.totalWins)
        }))
        .filter(item => item.wins > 0)
        .sort((a, b) => b.wins - a.wins || a.id.localeCompare(b.id));

    const posicaoIndex = ranking.findIndex(item => item.id === userId);
    const posicao = posicaoIndex >= 0 ? posicaoIndex + 1 : null;

    const kills = numero(dados.killsSemanais);
    const mortes = numero(dados.mortesSemanais);
    const partidas = numero(dados.partidasSemanais);
    const kd = mortes > 0 ? (kills / mortes).toFixed(2) : (kills > 0 ? kills.toFixed(2) : '0.00');

    const continentes = {
        asia: numero(dados.asiaSemanal),
        europa: numero(dados.europaSemanal),
        oceania: numero(dados.oceaniaSemanal),
        americaSul: numero(dados.amsulSemanal),
        americaNorte: numero(dados.amnorteSemanal),
        africa: numero(dados.africaSemanal)
    };

    const totalContinentes = Object.values(continentes).reduce((soma, valor) => soma + valor, 0);
    const printsProcessados = Array.isArray(dados.printsProcessados)
        ? dados.printsProcessados.length
        : 0;

    return {
        dados,
        faccao,
        totalWins,
        semanal,
        mensal,
        rankAtual,
        proximaPatente,
        faltam,
        percentual,
        barra,
        posicao,
        totalRankeados: ranking.length,
        kills,
        mortes,
        partidas,
        kd,
        continentes,
        totalContinentes,
        printsProcessados,
        member
    };
}

function obterSaldo(economy, userId) {
    const valor = economy?.[userId];

    if (typeof valor === 'number') {
        return Math.max(0, valor);
    }

    if (valor && typeof valor.balance === 'number') {
        return Math.max(0, valor.balance);
    }

    if (valor && typeof valor.saldo === 'number') {
        return Math.max(0, valor.saldo);
    }

    return 0;
}

function criarFicha({ progressao, carreiras, economy, userId, member, modo = 'carreira' }) {
    const info = obterDadosCarreira({
        progressao,
        carreiras,
        userId,
        member
    });

    if (!info) return null;

    const saldo = obterSaldo(economy, userId);
    const nome = member?.displayName || member?.user?.username || info.dados.nome || `Usuário ${userId}`;
    const avatar = member?.user?.displayAvatarURL?.({ size: 256, extension: 'png' });
    const guildIcon = member?.guild?.iconURL?.({ size: 256 });

    const tituloModo = modo === 'print'
        ? 'REGISTRO DE PRINT'
        : 'STATUS DE CARREIRA';

    const progresso = info.proximaPatente
        ? [
            `${info.barra} **${info.percentual}%**`,
            `**${formatarNumero(info.totalWins)} / ${formatarNumero(info.proximaPatente.custo)}** vitórias`,
            `Faltam **${formatarNumero(info.faltam)}** para **${info.proximaPatente.nome}**`
        ].join('\n')
        : [
            `${info.barra} **100%**`,
            '🏆 **PATENTE MÁXIMA ALCANÇADA**'
        ].join('\n');

    const combate = [
        `⚔️ Kills: **${formatarNumero(info.kills)}**`,
        `💀 Mortes: **${formatarNumero(info.mortes)}**`,
        `📊 K/D: **${info.kd}**`,
        `🎮 Partidas: **${formatarNumero(info.partidas)}**`
    ].join('\n');

    const continentes = [
        `🌏 Ásia: **${formatarNumero(info.continentes.asia)}**`,
        `🇪🇺 Europa: **${formatarNumero(info.continentes.europa)}**`,
        `🌊 Oceania: **${formatarNumero(info.continentes.oceania)}**`,
        `🇧🇷 América do Sul: **${formatarNumero(info.continentes.americaSul)}**`,
        `🇺🇸 América do Norte: **${formatarNumero(info.continentes.americaNorte)}**`,
        `🌍 África: **${formatarNumero(info.continentes.africa)}**`
    ].join('\n');

    const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setAuthor({
            name: 'WORLDWARBR • FICHA MILITAR',
            ...(guildIcon ? { iconURL: guildIcon } : {})
        })
        .setTitle(`📋 ${nome}`)
        .setDescription(
            `🏴 **${info.faccao.nome}**  •  🎖️ **${info.rankAtual.nome}**\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📌 **${tituloModo}**\n` +
            (info.proximaPatente
                ? `🎯 Próxima patente: **${info.proximaPatente.nome}**`
                : '🏆 **Carreira concluída — patente máxima.**')
        )
        .addFields(
            {
                name: '🏆 VITÓRIAS TOTAIS',
                value: `**${formatarNumero(info.totalWins)}**`,
                inline: true
            },
            {
                name: '💰 WARCOINS',
                value: `**${formatarNumero(saldo)}**`,
                inline: true
            },
            {
                name: '🏅 RANKING GLOBAL',
                value: info.posicao
                    ? `**#${info.posicao}** de **${formatarNumero(info.totalRankeados)}**`
                    : 'Sem posição',
                inline: true
            },
            {
                name: '📅 SEMANAL',
                value: `🏆 **${formatarNumero(info.semanal)}** vitórias`,
                inline: true
            },
            {
                name: '🗓️ MENSAL',
                value: `🏆 **${formatarNumero(info.mensal)}** vitórias`,
                inline: true
            },
            {
                name: '🎖️ PATENTE ATUAL',
                value: `**${info.rankAtual.nome}**\nMeta: **${formatarNumero(info.rankAtual.custo)}** vitórias`,
                inline: true
            },
            {
                name: '📈 PROGRESSÃO DE CARREIRA',
                value: progresso,
                inline: false
            },
            {
                name: '⚔️ ESTATÍSTICAS DE COMBATE • CICLO ATUAL',
                value: combate,
                inline: true
            },
            {
                name: '🌍 CONTINENTES • CICLO ATUAL',
                value: `${continentes}\n\n🌐 Total: **${formatarNumero(info.totalContinentes)}**`,
                inline: true
            },
            {
                name: '📜 REGISTROS',
                value: [
                    `🖼️ Prints processados: **${formatarNumero(info.printsProcessados)}**`,
                    `🆔 ID: **${userId}**`
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({
            text: `WorldWarBR • ${tituloModo} • Dados sincronizados do sistema de progressão`
        })
        .setTimestamp();

    if (avatar) {
        embed.setThumbnail(avatar);
    }

    return embed;
}

module.exports = {
    obterDadosCarreira,
    obterSaldo,
    criarFicha
};
