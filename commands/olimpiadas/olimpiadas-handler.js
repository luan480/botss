/* ========================================================================
   WORLDWARBR — OLIMPÍADAS DE DUPLAS
   ARQUIVO: commands/olimpiadas/olimpiadas-handler.js
   ======================================================================== */

// O restante do handler existente permanece antes deste ponto.

/* ========================================================================
   PAINEL E ROTEADOR RESTAURADOS
   ======================================================================== */

function criarPainel(dados = carregarDados()) {
    const cfg = lerConfig();
    const cargo = cfg.cargoTeg ? `<@&${cfg.cargoTeg}>` : '@• Olímpico';
    const ranking = rankingPaises(dados);

    const resumoRanking = ranking.length
        ? ranking.slice(0, 10).map((item, indice) =>
            `**${indice + 1}. 🌎 ${limparTexto(item.pais)}** — 🥇 ${item.ouro} • 🥈 ${item.prata} • 🥉 ${item.bronze}`
        ).join('\n')
        : 'Sem resultados ainda.';

    return new EmbedBuilder()
        .setColor('#D4AF37')
        .setTitle('🏆 OLIMPÍADAS DE DUPLAS')
        .setDescription([
            `**Vencedores: ${cargo}**`, '',
            '🌎 **Cada dupla representa um país.**', '',
            '📅 **Contabilização:** dias pares de setembro.',
            MODO_TESTE ? '🧪 **MODO TESTE ATIVO.**' : '', '',
            '🥇 Ouro • 🥈 Prata • 🥉 Bronze',
            '➖ 2º ou 3º podem ficar **sem colocação**.', '',
            `👥 **Duplas registradas:** ${dados.duplas.length}`,
            `🏅 **Partidas contabilizadas:** ${dados.resultados.length}`, '',
            '━━━━━━━━━━━━━━━━━━━━', '',
            '🏆 **RANKING DE PAÍSES**', '', resumoRanking
        ].filter(Boolean).join('\n'))
        .setImage(cfg.imagem || null)
        .setFooter({ text: 'WorldWarBR • Olimpíadas de Duplas' });
}

function criarBotoes() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('olymp_contabilizar').setLabel('Contabilizar').setEmoji('🏅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('olymp_duplas').setLabel('Ver duplas').setEmoji('👥').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('olymp_registrar').setLabel('Registrar dupla').setEmoji('📝').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('olymp_ranking').setLabel('Ranking').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('olymp_guia').setLabel('Guia').setEmoji('📖').setStyle(ButtonStyle.Secondary)
    );
}

async function atualizarPainel(client) {
    try {
        const dados = carregarDados();
        const cfg = lerConfig();
        if (!cfg.canalPainel) return false;
        const canal = await client.channels.fetch(cfg.canalPainel).catch(() => null);
        if (!canal?.isTextBased()) return false;

        let mensagem = null;
        if (dados.painelMensagemId) {
            mensagem = await canal.messages.fetch(dados.painelMensagemId).catch(() => null);
        }
        if (mensagem) {
            await mensagem.edit({ embeds: [criarPainel(dados)], components: [criarBotoes()] });
            return true;
        }
        mensagem = await canal.send({ embeds: [criarPainel(dados)], components: [criarBotoes()] });
        dados.painelMensagemId = mensagem.id;
        salvarDados(dados);
        return true;
    } catch (erro) {
        console.error('[OLIMPIADAS] Erro atualizando painel:', erro);
        return false;
    }
}

async function painel(interaction) {
    const cfg = lerConfig();
    if (!cfg.canalPainel) {
        return interaction.reply({ content: '❌ canalPainel não configurado.', flags: MessageFlags.Ephemeral });
    }
    const canal = await interaction.client.channels.fetch(cfg.canalPainel).catch(() => null);
    if (!canal?.isTextBased()) {
        return interaction.reply({ content: '❌ Canal do painel não encontrado.', flags: MessageFlags.Ephemeral });
    }
    const mensagem = await canal.send({ embeds: [criarPainel()], components: [criarBotoes()] });
    const dados = carregarDados();
    dados.painelMensagemId = mensagem.id;
    salvarDados(dados);
    return interaction.reply({ content: '✅ Painel das Olimpíadas publicado.', flags: MessageFlags.Ephemeral });
}

async function verDuplas(interaction) {
    const dados = carregarDados();
    if (!dados.duplas.length) return interaction.reply({ content: '👥 Nenhuma dupla registrada ainda.', flags: MessageFlags.Ephemeral });
    const texto = dados.duplas.slice(0, 25).map((dupla, indice) =>
        `**${indice + 1}. 🌎 ${limparTexto(dupla.pais)}**\n👥 <@${dupla.jogador1}> + <@${dupla.jogador2}>`
    ).join('\n\n');
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#D4AF37').setTitle('👥 DUPLAS DAS OLIMPÍADAS').setDescription(texto)], flags: MessageFlags.Ephemeral });
}

async function verRanking(interaction) {
    const ranking = rankingPaises(carregarDados());
    const texto = ranking.length
        ? ranking.slice(0, 25).map((item, indice) => `**${indice + 1}. 🌎 ${limparTexto(item.pais)}** — 🥇 ${item.ouro} • 🥈 ${item.prata} • 🥉 ${item.bronze}`).join('\n\n')
        : '🌎 **PAÍSES**\n\nSem medalhas ainda.';
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#D4AF37').setTitle('🏆 RANKING — OLIMPÍADAS DE DUPLAS').setDescription(texto)], flags: MessageFlags.Ephemeral });
}

async function guia(interaction) {
    const cfg = lerConfig();
    const cargo = cfg.cargoTeg ? `<@&${cfg.cargoTeg}>` : '@• Olímpico';
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#D4AF37').setTitle('📖 GUIA — OLIMPÍADAS').setDescription([
        '🟨 **OLIMPÍADAS DE DUPLAS**', '', `🏆 **Vencedores:** ${cargo}`, '',
        '🌎 Cada dupla representa um país.', '', '🏅 **CONTABILIZAÇÃO**',
        '🥇 1º lugar = Ouro', '🥈 2º lugar = Prata', '🥉 3º lugar = Bronze',
        '➖ 2º e 3º podem ficar sem colocação.', '', '📸 O print é obrigatório.',
        '🧹 O print enviado é apagado do canal após ser recebido.',
        '📢 O resultado vai para o canal oficial de resultados.', '',
        '📅 Regra oficial: dias pares de setembro.'
    ].join('\n'))], flags: MessageFlags.Ephemeral });
}

async function handle(interaction) {
    const id = interaction.customId || '';
    if (interaction.isModalSubmit?.() && id.startsWith('olymp_pesquisa_modal_')) return pesquisarPais(interaction);
    if (!(interaction.isButton?.() || interaction.isStringSelectMenu?.() || interaction.isUserSelectMenu?.())) return false;

    if (id === 'olymp_contabilizar') return contabilizar(interaction);
    if (id === 'olymp_duplas') return verDuplas(interaction);
    if (id === 'olymp_registrar') return registrar(interaction);
    if (id === 'olymp_ranking') return verRanking(interaction);
    if (id === 'olymp_guia') return guia(interaction);
    if (id === 'olymp_reg_p1') return registrarJogador1(interaction);
    if (id.startsWith('olymp_reg_p2_')) return registrarJogador2(interaction);
    if (id.startsWith('olymp_buscar_')) return abrirPesquisa(interaction);
    if (id.startsWith('olymp_prev_')) return mudarPaginaPais(interaction, -1);
    if (id.startsWith('olymp_next_')) return mudarPaginaPais(interaction, 1);
    if (id.startsWith('olymp_pais_')) return selecionarPais(interaction);
    if (id.startsWith('olymp_result_ouro_')) return escolherOuro(interaction);
    if (id.startsWith('olymp_result_prata_none_')) return escolherPrataNenhum(interaction);
    if (id.startsWith('olymp_result_prata_')) return escolherPrata(interaction);
    if (id.startsWith('olymp_result_bronze_none_')) return escolherBronzeNenhum(interaction);
    if (id.startsWith('olymp_result_bronze_')) return escolherBronze(interaction);
    return false;
}

module.exports = {
    handle,
    painel,
    criarPainel,
    criarBotoes,
    atualizarPainel,
    calcularRanking,
    rankingPaises,
    podeContabilizar
};