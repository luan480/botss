/* ========================================================================
   ARQUIVO: commands/promocao/fichaBuilder.js
   DESCRIÇÃO: Construtor único da Ficha WorldWarBR.
   Usado pelo print automático, /carreira status e botão Ver Ficha.
   ======================================================================== */

const { EmbedBuilder } = require('discord.js');

function obterDadosCarreira({ progressao, carreiras, userId, member }) {
    const dados = progressao[userId];
    if (!dados) return null;

    const faccao = carreiras?.faccoes?.[dados.factionId];
    if (!faccao || !Array.isArray(faccao.caminho) || !faccao.caminho.length) return null;

    const totalWins = Math.max(0, Number(dados.totalWins) || 0);
    const semanal = Math.max(0, Number(dados.vitoriasSemanais) || 0);
    const mensal = Math.max(0, Number(dados.vitoriasMensais) || 0);

    let rankAtual = faccao.caminho[0];
    let indiceAtual = 0;

    // A patente é calculada pelas vitórias. Isso evita ficha dessincronizada
    // caso currentRankId ainda esteja apontando para uma patente antiga.
    for (let i = 0; i < faccao.caminho.length; i++) {
        if (totalWins >= Number(faccao.caminho[i].custo || 0)) {
            rankAtual = faccao.caminho[i];
            indiceAtual = i;
        }
    }

    const proximaPatente = faccao.caminho[indiceAtual + 1] || null;
    const custoPatenteAtual = Number(rankAtual.custo || 0);
    const custoProxima = proximaPatente ? Number(proximaPatente.custo || 0) : custoPatenteAtual;

    let percentual = 100;
    let faltam = 0;

    if (proximaPatente) {
        faltam = Math.max(0, custoProxima - totalWins);
        const intervalo = Math.max(1, custoProxima - custoPatenteAtual);
        const progressoNoNivel = Math.max(0, totalWins - custoPatenteAtual);
        percentual = Math.min(100, Math.round((progressoNoNivel / intervalo) * 100));
    }

    const barras = 10;
    const preenchidas = Math.round((percentual / 100) * barras);
    const barra = '▰'.repeat(preenchidas) + '▱'.repeat(barras - preenchidas);

    // Posição global por vitórias, ignorando registros sem vitória.
    const ranking = Object.entries(progressao)
        .map(([id, valor]) => ({ id, wins: Number(valor?.totalWins) || 0 }))
        .filter(item => item.wins > 0)
        .sort((a, b) => b.wins - a.wins);

    const posicao = ranking.findIndex(item => item.id === userId) + 1;
    const totalRankeados = ranking.length;

    const saldo = 0;

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
        posicao: posicao > 0 ? posicao : null,
        totalRankeados,
        saldo,
        member
    };
}

function obterSaldo(economy, userId) {
    // economy.json do projeto usa diretamente o ID como número.
    // Aceita também o formato { balance } para compatibilidade futura.
    const valor = economy?.[userId];
    if (typeof valor === 'number') return Math.max(0, valor);
    if (valor && typeof valor.balance === 'number') return Math.max(0, valor.balance);
    return 0;
}

function criarFicha({ progressao, carreiras, economy, userId, member, modo = 'carreira' }) {
    const info = obterDadosCarreira({ progressao, carreiras, userId, member });
    if (!info) return null;

    info.saldo = obterSaldo(economy, userId);

    const nome = member?.displayName || member?.user?.username || info.dados.nome || `Usuário ${userId}`;
    const avatar = member?.user?.displayAvatarURL?.({ size: 256, extension: 'png' });
    const guildIcon = member?.guild?.iconURL?.({ size: 256 });

    const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle(`📋 FICHA MILITAR • ${nome}`)
        .setDescription(
            `**${info.faccao.nome}**  •  **${info.rankAtual.nome}**\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🎖️ **Carreira em andamento**\n` +
            `${info.proximaPatente ? `🎯 Próxima patente: **${info.proximaPatente.nome}**` : '🏆 **Patente máxima alcançada!**'}`
        )
        .addFields(
            {
                name: '🏆 VITÓRIAS',
                value: `**${info.totalWins}** vitórias totais`,
                inline: true
            },
            {
                name: '💰 WARCOINS',
                value: `**${info.saldo.toLocaleString('pt-BR')}**`,
                inline: true
            },
            {
                name: '🏅 RANKING',
                value: info.posicao ? `**#${info.posicao}** de ${info.totalRankeados}` : 'Sem posição',
                inline: true
            },
            {
                name: '📅 SEMANAL',
                value: `**${info.semanal}** vitórias`,
                inline: true
            },
            {
                name: '🗓️ MENSAL',
                value: `**${info.mensal}** vitórias`,
                inline: true
            },
            {
                name: '🎖️ PATENTE ATUAL',
                value: `**${info.rankAtual.nome}**\nMeta alcançada: **${info.rankAtual.custo} vitórias**`,
                inline: true
            },
            {
                name: '📈 PROGRESSO DE CARREIRA',
                value: info.proximaPatente
                    ? `${info.barra} **${info.percentual}%**\nFaltam **${info.faltam}** vitórias para **${info.proximaPatente.nome}**.\n**${info.totalWins} / ${info.proximaPatente.custo}** vitórias`
                    : `${info.barra} **100%**\n🏆 Você alcançou a **patente máxima** da sua carreira!`,
                inline: false
            }
        )
        .setFooter({
            text: `WorldWarBR • ${modo === 'print' ? 'Registro de Print' : 'Status de Carreira'} • ID: ${userId}`
        })
        .setTimestamp();

    if (avatar) embed.setThumbnail(avatar);
    if (guildIcon) embed.setAuthor({ name: 'WORLDWARBR • FICHA DE CARREIRA', iconURL: guildIcon });

    return embed;
}

module.exports = {
    obterDadosCarreira,
    obterSaldo,
    criarFicha
};
