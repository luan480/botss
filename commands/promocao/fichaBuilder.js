/* ========================================================================
   ARQUIVO: commands/promocao/fichaBuilder.js
   FICHA MILITAR — CARREIRA PERMANENTE + CICLO ATUAL
   ======================================================================== */

const { EmbedBuilder } = require('discord.js');
const careerHistory = require('./careerHistory.js');

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
    if (!faccao || !Array.isArray(faccao.caminho) || !faccao.caminho.length) return null;

    const historico = careerHistory.obter(userId) || {};
    const carreira = {
        vitorias: numero(historico.totalWins),
        kills: numero(historico.totalKills),
        mortes: numero(historico.totalDeaths),
        partidas: numero(historico.totalMatches),
        continentes: numero(historico.totalContinents),
        pontos: numero(historico.totalPoints),
        temporadas: Array.isArray(historico.temporadas) ? historico.temporadas : [],
        ligas: Array.isArray(historico.ligas) ? historico.ligas : [],
        titulos: Array.isArray(historico.titulos) ? historico.titulos : [],
        recordes: historico.recordes && typeof historico.recordes === 'object' ? historico.recordes : {}
    };

    // Migração segura: vitórias antigas já existentes continuam aparecendo na carreira.
    carreira.vitorias = Math.max(carreira.vitorias, numero(dados.totalWins));

    const totalWins = numero(dados.totalWins);
    let rankAtual = faccao.caminho[0];
    let indiceAtual = 0;
    for (let i = 0; i < faccao.caminho.length; i++) {
        if (totalWins >= numero(faccao.caminho[i]?.custo)) {
            rankAtual = faccao.caminho[i];
            indiceAtual = i;
        }
    }

    const proximaPatente = faccao.caminho[indiceAtual + 1] || null;
    const custoAtual = numero(rankAtual?.custo);
    const custoProxima = proximaPatente ? numero(proximaPatente.custo) : custoAtual;
    const faltam = proximaPatente ? Math.max(0, custoProxima - totalWins) : 0;
    const percentual = proximaPatente ? Math.min(100, Math.round((Math.max(0, totalWins - custoAtual) / Math.max(1, custoProxima - custoAtual)) * 100)) : 100;
    const barras = 12;
    const preenchidas = Math.max(0, Math.min(barras, Math.round(percentual / 100 * barras)));
    const barra = '▰'.repeat(preenchidas) + '▱'.repeat(barras - preenchidas);

    const ranking = Object.entries(progressao || {})
        .map(([id, valor]) => ({ id, wins: numero(valor?.totalWins) }))
        .filter(item => item.wins > 0)
        .sort((a, b) => b.wins - a.wins || a.id.localeCompare(b.id));
    const posicaoIndex = ranking.findIndex(item => item.id === userId);

    const ciclo = {
        vitorias: totalWins,
        kills: numero(dados.killsSemanais),
        mortes: numero(dados.mortesSemanais),
        partidas: numero(dados.partidasSemanais),
        continentes: {
            asia: numero(dados.asiaSemanal), europa: numero(dados.europaSemanal), oceania: numero(dados.oceaniaSemanal),
            americaSul: numero(dados.amsulSemanal), americaNorte: numero(dados.amnorteSemanal), africa: numero(dados.africaSemanal)
        },
        semanal: numero(dados.vitoriasSemanais),
        mensal: numero(dados.vitoriasMensais)
    };
    ciclo.totalContinentes = Object.values(ciclo.continentes).reduce((s, v) => s + v, 0);
    ciclo.kd = ciclo.mortes > 0 ? (ciclo.kills / ciclo.mortes).toFixed(2) : (ciclo.kills > 0 ? ciclo.kills.toFixed(2) : '0.00');

    return {
        dados, historico, carreira, ciclo, faccao, totalWins,
        rankAtual, proximaPatente, faltam, percentual, barra,
        posicao: posicaoIndex >= 0 ? posicaoIndex + 1 : null,
        totalRankeados: ranking.length, printsProcessados: Array.isArray(dados.printsProcessados) ? dados.printsProcessados.length : 0,
        member
    };
}

function obterSaldo(economy, userId) {
    const valor = economy?.[userId];
    if (typeof valor === 'number') return Math.max(0, valor);
    if (valor && typeof valor.balance === 'number') return Math.max(0, valor.balance);
    if (valor && typeof valor.saldo === 'number') return Math.max(0, valor.saldo);
    return 0;
}

function criarFicha({ progressao, carreiras, economy, userId, member, modo = 'carreira' }) {
    const info = obterDadosCarreira({ progressao, carreiras, userId, member });
    if (!info) return null;

    const saldo = obterSaldo(economy, userId);
    const nome = member?.displayName || member?.user?.username || info.dados.nome || `Usuário ${userId}`;
    const avatar = member?.user?.displayAvatarURL?.({ size: 256, extension: 'png' });
    const guildIcon = member?.guild?.iconURL?.({ size: 256 });
    const tituloModo = modo === 'print' ? 'REGISTRO DE PRINT' : 'STATUS DE CARREIRA';

    const progresso = info.proximaPatente
        ? `${info.barra} **${info.percentual}%**\n**${formatarNumero(info.totalWins)} / ${formatarNumero(info.proximaPatente.custo)}** vitórias no ciclo\nFaltam **${formatarNumero(info.faltam)}** para **${info.proximaPatente.nome}**`
        : `${info.barra} **100%**\n🏆 **PATENTE MÁXIMA ALCANÇADA**`;

    const combateCarreira = [
        `⚔️ Kills: **${formatarNumero(info.carreira.kills)}**`,
        `💀 Mortes: **${formatarNumero(info.carreira.mortes)}**`,
        `📊 K/D: **${info.carreira.mortes > 0 ? (info.carreira.kills / info.carreira.mortes).toFixed(2) : '0.00'}**`,
        `🎮 Partidas: **${formatarNumero(info.carreira.partidas)}**`
    ].join('\n');

    const combateCiclo = [
        `⚔️ Kills: **${formatarNumero(info.ciclo.kills)}**`, `💀 Mortes: **${formatarNumero(info.ciclo.mortes)}**`,
        `📊 K/D: **${info.ciclo.kd}**`, `🎮 Partidas: **${formatarNumero(info.ciclo.partidas)}**`
    ].join('\n');

    const continentesCiclo = [
        `🌏 Ásia: **${formatarNumero(info.ciclo.continentes.asia)}**`, `🇪🇺 Europa: **${formatarNumero(info.ciclo.continentes.europa)}**`,
        `🌊 Oceania: **${formatarNumero(info.ciclo.continentes.oceania)}**`, `🇧🇷 América do Sul: **${formatarNumero(info.ciclo.continentes.americaSul)}**`,
        `🇺🇸 América do Norte: **${formatarNumero(info.ciclo.continentes.americaNorte)}**`, `🌍 África: **${formatarNumero(info.ciclo.continentes.africa)}**`
    ].join('\n');

    const temporadas = info.carreira.temporadas.length ? info.carreira.temporadas.slice(-8).join(', ') : 'Nenhuma temporada consolidada ainda';
    const ligas = info.carreira.ligas.length ? info.carreira.ligas.slice(-8).join(', ') : 'Nenhuma Liga consolidada ainda';
    const titulos = info.carreira.titulos.length ? info.carreira.titulos.slice(-6).join(', ') : 'Nenhum título registrado ainda';

    const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setAuthor({ name: 'WORLDWARBR • FICHA MILITAR', ...(guildIcon ? { iconURL: guildIcon } : {}) })
        .setTitle(`📋 ${nome}`)
        .setDescription(`🏴 **${info.faccao.nome}**  •  🎖️ **${info.rankAtual.nome}**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📌 **${tituloModo}**\nA ficha separa **carreira permanente**, **temporadas/Ligas** e **ciclo atual**.`)
        .addFields(
            { name: '📚 CARREIRA • VITÓRIAS', value: `**${formatarNumero(info.carreira.vitorias)}**`, inline: true },
            { name: '⚔️ CARREIRA • COMBATE', value: combateCarreira, inline: true },
            { name: '🌍 CARREIRA • CONTINENTES', value: `**${formatarNumero(info.carreira.continentes)}**`, inline: true },
            { name: '🏅 PONTOS DE CARREIRA', value: `**${formatarNumero(info.carreira.pontos)}**`, inline: true },
            { name: '🏆 TÍTULOS', value: titulos, inline: true },
            { name: '🏛️ TEMPORADAS', value: `**${formatarNumero(info.carreira.temporadas.length)}**`, inline: true },
            { name: '🏆 LIGAS', value: `**${formatarNumero(info.carreira.ligas.length)}**`, inline: true },
            { name: '💰 WARCOINS', value: `**${formatarNumero(saldo)}**`, inline: true },
            { name: '🏅 RANKING DO CICLO', value: info.posicao ? `**#${info.posicao}** de **${formatarNumero(info.totalRankeados)}**` : 'Sem posição', inline: true },
            { name: '🔄 CICLO ATUAL • VITÓRIAS', value: `**${formatarNumero(info.ciclo.vitorias)}**\nSemanal: **${formatarNumero(info.ciclo.semanal)}**\nMensal: **${formatarNumero(info.ciclo.mensal)}**`, inline: true },
            { name: '🎖️ PATENTE ATUAL', value: `**${info.rankAtual.nome}**\nMeta: **${formatarNumero(info.rankAtual.custo)}** vitórias`, inline: true },
            { name: '📈 PROGRESSÃO DA LIGA', value: progresso, inline: false },
            { name: '⚔️ COMBATE • CICLO ATUAL', value: combateCiclo, inline: true },
            { name: '🌍 CONTINENTES • CICLO ATUAL', value: `${continentesCiclo}\n\n🌐 Total: **${formatarNumero(info.ciclo.totalContinentes)}**`, inline: true },
            { name: '📖 TEMPORADAS REGISTRADAS', value: temporadas, inline: false },
            { name: '🏆 LIGAS REGISTRADAS', value: ligas, inline: false },
            { name: '📜 REGISTROS', value: `🖼️ Prints processados: **${formatarNumero(info.printsProcessados)}**\n🆔 ID: **${userId}**`, inline: false }
        )
        .setFooter({ text: `WorldWarBR • ${tituloModo} • Histórico permanente não é apagado pelo reset` })
        .setTimestamp();

    if (avatar) embed.setThumbnail(avatar);
    return embed;
}

module.exports = { obterDadosCarreira, obterSaldo, criarFicha };
