const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function formatarNumero(valor) {
    return numero(valor).toLocaleString('pt-BR');
}

/**
 * Resumo enxuto para o canal de prints.
 * A ficha completa continua disponível pelo botão "Ver ficha completa".
 */
function criarResumoPrint({ progressao, carreiras, economy, userId, member, promocao = null }) {
    const dados = progressao?.[userId];
    if (!dados) return null;

    const faccao = carreiras?.faccoes?.[dados.factionId];
    if (!faccao?.caminho?.length) return null;

    const totalWins = numero(dados.totalWins);
    const saldoValor = economy?.[userId];
    const saldo = typeof saldoValor === 'number'
        ? Math.max(0, saldoValor)
        : numero(saldoValor?.balance ?? saldoValor?.saldo);

    let indice = 0;
    for (let i = 0; i < faccao.caminho.length; i++) {
        if (totalWins >= numero(faccao.caminho[i]?.custo)) indice = i;
    }

    const patente = faccao.caminho[indice];
    const proxima = faccao.caminho[indice + 1] || null;
    const faltam = proxima ? Math.max(0, numero(proxima.custo) - totalWins) : 0;
    const nome = member?.displayName || member?.user?.username || dados.nome || 'Jogador';
    const avatar = member?.user?.displayAvatarURL?.({ size: 128, extension: 'png' });

    const embed = new EmbedBuilder()
        .setColor(promocao ? '#F1C40F' : '#5865F2')
        .setAuthor({ name: promocao ? 'WORLDWARBR • PROMOÇÃO' : 'WORLDWARBR • PRINT REGISTRADO' })
        .setTitle(promocao ? `🏆 ${nome}` : `✅ ${nome}`)
        .setDescription(
            promocao
                ? `**${promocao.anterior} → ${promocao.nova}**\n🎉 Promoção conquistada com **${formatarNumero(totalWins)} vitórias**.`
                : `🏴 **${faccao.nome}**  •  🎖️ **${patente?.nome || 'Sem patente'}**`
        )
        .addFields(
            { name: '🏆 Vitórias', value: `**${formatarNumero(totalWins)}**`, inline: true },
            { name: '💰 WarCoins', value: `**${formatarNumero(saldo)}**`, inline: true },
            { name: '🎖️ Patente', value: `**${patente?.nome || 'N/A'}**`, inline: true }
        );

    if (proxima) {
        embed.addFields({
            name: '📈 Próxima patente',
            value: `**${proxima.nome}** • faltam **${formatarNumero(faltam)}** vitórias`,
            inline: false
        });
    } else {
        embed.addFields({ name: '📈 Progressão', value: '🏆 **Patente máxima alcançada**', inline: false });
    }

    if (promocao) {
        embed.addFields({ name: '💰 Bônus', value: '**+500 WarCoins**', inline: true });
    }

    embed.setFooter({ text: 'Use o botão abaixo para abrir a ficha militar completa.' }).setTimestamp();
    if (avatar) embed.setThumbnail(avatar);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ver_ficha_${userId}`)
            .setLabel('Ver ficha completa')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋')
    );

    return { embed, components: [row] };
}

module.exports = { criarResumoPrint };
