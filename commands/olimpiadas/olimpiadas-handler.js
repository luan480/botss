/* ========================================================================
   ARQUIVO: commands/olimpiadas/olimpiadas-handler.js

   SISTEMA: OLIMPÍADAS DE DUPLAS

   CORREÇÃO:
   - Países usam IDs internos no Select Menu (pais_0, pais_1...).
   - Acentos não quebram a seleção.
   - Pesquisa sem acento encontra o país com acento.
   - Mantém registro, contabilização, ranking e salvamento.
   ======================================================================== */

const fs = require('fs');
const path = require('path');
const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require('discord.js');

const ARQUIVO_DADOS = path.join(__dirname, 'olimpiadas.json');

function config() {
    return JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
}

function carregarDados() {
    try {
        const dados = config();
        dados.duplas = Array.isArray(dados.duplas) ? dados.duplas : [];
        dados.resultados = Array.isArray(dados.resultados) ? dados.resultados : [];
        dados.ranking = dados.ranking && typeof dados.ranking === 'object' ? dados.ranking : {};
        return dados;
    } catch (erro) {
        console.error('[OLIMPIADAS] Erro lendo olimpiadas.json:', erro);
        return { duplas: [], resultados: [], ranking: {} };
    }
}

function salvarDados(dados) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2), 'utf8');
}

function limparTexto(valor) {
    return String(valor ?? '').replace(/[\\`*_~|]/g, '');
}

function normalizar(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function paisOcupado(dados, pais) {
    return dados.duplas.some(dupla => normalizar(dupla.pais) === normalizar(pais));
}

function jogadorOcupado(dados, id) {
    return dados.duplas.some(dupla => dupla.jogador1 === id || dupla.jogador2 === id);
}

function buscarDupla(dados, id) {
    return dados.duplas.find(dupla => dupla.id === id);
}

function buscarDuplaPorPais(dados, pais) {
    return dados.duplas.find(dupla => normalizar(dupla.pais) === normalizar(pais));
}

function paisesDisponiveis(dados, excluir = []) {
    const ocupados = new Set(dados.duplas.map(d => normalizar(d.pais)));
    const ignorar = new Set(excluir.map(normalizar));
    return (config().paises || []).filter(pais =>
        !ocupados.has(normalizar(pais)) && !ignorar.has(normalizar(pais))
    );
}

function podeContabilizar() {
    const agora = new Date();
    const cfg = config();
    return agora.getFullYear() === Number(cfg.ano) &&
        agora.getMonth() + 1 === Number(cfg.mes) &&
        agora.getDate() % 2 === 0;
}

/* ========================================================================
   PESQUISA DE PAÍSES
   Discord permite no máximo 25 opções por Select Menu.
   O token NÃO contém underscore para não quebrar o roteamento.
   ======================================================================== */

const pesquisas = new Map();

function criarPesquisa(dados, jogador1, jogador2, termo = '') {
    const lista = paisesDisponiveis(dados).filter(pais =>
        !termo || normalizar(pais).includes(normalizar(termo))
    );

    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    pesquisas.set(token, {
        jogador1,
        jogador2,
        paises: lista,
        criadoEm: Date.now()
    });

    setTimeout(() => pesquisas.delete(token), 5 * 60 * 1000).unref?.();
    return token;
}

function menuPesquisaPais(token, pagina = 0) {
    const pesquisa = pesquisas.get(token);
    if (!pesquisa) return [];

    const inicio = pagina * 25;
    const lista = pesquisa.paises.slice(inicio, inicio + 25);
    const total = Math.max(1, Math.ceil(pesquisa.paises.length / 25));

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`olymp_pais_${token}_${pagina}`)
        .setPlaceholder('🌎 Escolha um país da lista')
        .addOptions(lista.map((pais, indice) => ({
            label: pais.slice(0, 100),
            value: `pais_${inicio + indice}`,
            emoji: '🌎'
        })));

    return [
        new ActionRowBuilder().addComponents(menu),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`olymp_buscar_${token}`)
                .setLabel('Pesquisar país')
                .setEmoji('🔎')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`olymp_prev_${token}_${pagina}`)
                .setLabel('Anterior')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pagina === 0),
            new ButtonBuilder()
                .setCustomId(`olymp_pag_${token}`)
                .setLabel(`Página ${pagina + 1}/${total}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`olymp_next_${token}_${pagina}`)
                .setLabel('Próxima')
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pagina >= total - 1)
        )
    ];
}

function menuResultadoPais(dados, customId, placeholder, excluir = []) {
    const paises = dados.duplas
        .map(d => d.pais)
        .filter(pais => !excluir.some(x => normalizar(x) === normalizar(pais)));

    if (!paises.length) return null;

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .addOptions(paises.slice(0, 25).map((pais, indice) => ({
                label: pais.slice(0, 100),
                value: `resultado_${indice}`,
                emoji: '🌎'
            })))
    );
}

function paisDoResultadoMenu(interaction, dados, excluir = []) {
    const paises = dados.duplas
        .map(d => d.pais)
        .filter(pais => !excluir.some(x => normalizar(x) === normalizar(pais)));

    const valor = interaction.values?.[0] || '';
    const indice = Number(valor.replace('resultado_', ''));
    return Number.isInteger(indice) ? paises[indice] : null;
}

/* ========================================================================
   PAINEL PRINCIPAL
   ======================================================================== */

function criarPainel(dados = carregarDados()) {
    const cfg = config();
    const cargo = cfg.cargoTeg ? `<@&${cfg.cargoTeg}>` : '@• Olímpico';

    return new EmbedBuilder()
        .setColor('#D4AF37')
        .setTitle('🟨 OLIMPÍADAS DE DUPLAS')
        .setDescription([
            `**Vencedores: ${cargo}**`,
            '',
            '**Cada dupla escolherá um País para representar.**',
            '',
            '📅 **Contabilização somente nos dias pares de setembro.**',
            '',
            '🥇 Vitória = critério principal',
            '🥈 2º = peso 3 somente no desempate',
            '🥉 3º = peso 1 somente no desempate',
            '',
            `👥 **Duplas:** ${dados.duplas.length}`,
            `📊 **Resultados:** ${dados.resultados.length}`,
            '⏱️ **Partida:** 1h30min',
            '',
            '⚠️ **Apenas DOIS vencedores!**'
        ].join('\n'))
        .setImage(cfg.imagem)
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

async function painel(interaction) {
    const cfg = config();
    const canal = await interaction.client.channels.fetch(cfg.canalPainel).catch(() => null);

    if (!canal?.isTextBased()) {
        return interaction.reply({ content: '❌ Canal do painel das Olimpíadas não encontrado.', flags: MessageFlags.Ephemeral });
    }

    await canal.send({ embeds: [criarPainel()], components: [criarBotoes()] });
    return interaction.reply({ content: '✅ Painel publicado.', flags: MessageFlags.Ephemeral });
}

/* ========================================================================
   REGISTRO
   ======================================================================== */

async function registrar(interaction) {
    return interaction.reply({
        content: '📝 **REGISTRO DE DUPLA**\n\nSelecione o primeiro integrante.',
        components: [new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder().setCustomId('olymp_reg_p1').setPlaceholder('Selecione o jogador 1')
        )],
        flags: MessageFlags.Ephemeral
    });
}

async function registrarJogador1(interaction) {
    const jogador1 = interaction.values[0];
    const dados = carregarDados();

    if (jogadorOcupado(dados, jogador1)) {
        return interaction.reply({ content: '❌ Esse jogador já pertence a uma dupla.', flags: MessageFlags.Ephemeral });
    }

    return interaction.update({
        content: '📝 **JOGADOR 2**\n\nSelecione o segundo integrante.',
        components: [new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder().setCustomId(`olymp_reg_p2_${jogador1}`).setPlaceholder('Selecione o jogador 2')
        )]
    });
}

async function registrarJogador2(interaction) {
    const jogador1 = interaction.customId.replace('olymp_reg_p2_', '');
    const jogador2 = interaction.values[0];
    const dados = carregarDados();

    if (jogador1 === jogador2) {
        return interaction.reply({ content: '❌ Os dois integrantes precisam ser diferentes.', flags: MessageFlags.Ephemeral });
    }

    if (jogadorOcupado(dados, jogador1) || jogadorOcupado(dados, jogador2)) {
        return interaction.reply({ content: '❌ Um dos jogadores já pertence a uma dupla registrada.', flags: MessageFlags.Ephemeral });
    }

    const token = criarPesquisa(dados, jogador1, jogador2);
    const pesquisa = pesquisas.get(token);

    if (!pesquisa.paises.length) {
        pesquisas.delete(token);
        return interaction.reply({ content: '❌ Todos os países disponíveis já foram escolhidos.', flags: MessageFlags.Ephemeral });
    }

    return interaction.update({
        content: `🌎 **ESCOLHA O PAÍS**\n\n**${pesquisa.paises.length} países disponíveis.**\n\n📋 Escolha pela lista ou use **🔎 Pesquisar país** para digitar o nome.`,
        components: menuPesquisaPais(token, 0)
    });
}

async function abrirPesquisa(interaction) {
    const token = interaction.customId.replace('olymp_buscar_', '');
    if (!pesquisas.has(token)) return interaction.reply({ content: '⌛ Esta pesquisa expirou. Faça o registro novamente.', flags: MessageFlags.Ephemeral });

    const modal = new ModalBuilder().setCustomId(`olymp_pesquisa_modal_${token}`).setTitle('Pesquisar país');
    const campo = new TextInputBuilder()
        .setCustomId('termo')
        .setLabel('Digite o nome do país')
        .setPlaceholder('Ex.: Brasil, Colombia, Alemanha...')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(50)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(campo));
    return interaction.showModal(modal);
}

async function pesquisarPais(interaction) {
    const token = interaction.customId.replace('olymp_pesquisa_modal_', '');
    const pesquisa = pesquisas.get(token);
    if (!pesquisa) return interaction.reply({ content: '⌛ Esta pesquisa expirou. Faça o registro novamente.', flags: MessageFlags.Ephemeral });

    const termo = interaction.fields.getTextInputValue('termo').trim();
    const dados = carregarDados();

    pesquisa.paises = paisesDisponiveis(dados).filter(pais => normalizar(pais).includes(normalizar(termo)));

    if (!pesquisa.paises.length) {
        return interaction.reply({ content: `❌ Nenhum país disponível encontrado para **${limparTexto(termo)}**.`, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        content: `🔎 **RESULTADO DA PESQUISA:** ${limparTexto(termo)}\n\nSelecione o país.`,
        components: menuPesquisaPais(token, 0),
        flags: MessageFlags.Ephemeral
    });
}

async function mudarPaginaPais(interaction, direcao) {
    const partes = interaction.customId.split('_');
    const token = partes[2];
    const pagina = Number(partes[3]);
    const pesquisa = pesquisas.get(token);
    if (!pesquisa) return interaction.reply({ content: '⌛ Pesquisa expirada.', flags: MessageFlags.Ephemeral });

    const total = Math.max(1, Math.ceil(pesquisa.paises.length / 25));
    const nova = Math.max(0, Math.min(total - 1, pagina + direcao));

    return interaction.update({
        content: `🌎 **PAÍSES DISPONÍVEIS — PÁGINA ${nova + 1}/${total}**`,
        components: menuPesquisaPais(token, nova)
    });
}

async function selecionarPais(interaction) {
    const partes = interaction.customId.split('_');
    const token = partes[2];
    const pesquisa = pesquisas.get(token);
    if (!pesquisa) return interaction.reply({ content: '⌛ Pesquisa expirada.', flags: MessageFlags.Ephemeral });

    const indice = Number((interaction.values?.[0] || '').replace('pais_', ''));
    const pais = pesquisa.paises[indice];
    const dados = carregarDados();

    if (!pais) return interaction.reply({ content: '❌ País inválido. Abra o registro novamente.', flags: MessageFlags.Ephemeral });

    if (jogadorOcupado(dados, pesquisa.jogador1) || jogadorOcupado(dados, pesquisa.jogador2)) {
        pesquisas.delete(token);
        return interaction.reply({ content: '❌ Um dos jogadores já pertence a outra dupla.', flags: MessageFlags.Ephemeral });
    }

    if (paisOcupado(dados, pais)) {
        pesquisas.delete(token);
        return interaction.reply({ content: '❌ Esse país acabou de ser escolhido por outra dupla.', flags: MessageFlags.Ephemeral });
    }

    const dupla = {
        id: `dupla_${Date.now()}_${pesquisa.jogador1}`,
        pais,
        jogador1: pesquisa.jogador1,
        jogador2: pesquisa.jogador2,
        criadoPor: interaction.user.id,
        criadoEm: new Date().toISOString(),
        ativa: true
    };

    dados.duplas.push(dupla);
    dados.ranking = calcularRanking(dados);
    salvarDados(dados);
    pesquisas.delete(token);

    const cfg = config();
    const canalTeg = await interaction.client.channels.fetch(cfg.canalTeg).catch(() => null);
    if (canalTeg?.isTextBased()) {
        await canalTeg.send({
            content: cfg.cargoTeg ? `<@&${cfg.cargoTeg}>` : undefined,
            embeds: [new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('📝 NOVA DUPLA REGISTRADA')
                .setDescription(`🌎 **País:** ${limparTexto(pais)}\n👥 **Jogadores:** <@${pesquisa.jogador1}> + <@${pesquisa.jogador2}>`)
                .setTimestamp()]
        });
    }

    return interaction.update({
        content: `✅ **DUPLA REGISTRADA COM SUCESSO!**\n\n🌎 **País:** ${limparTexto(pais)}\n👥 **Jogadores:** <@${pesquisa.jogador1}> + <@${pesquisa.jogador2}>\n\n📋 A dupla já está disponível em **👥 Ver duplas**.`,
        components: []
    });
}

/* ========================================================================
   CONTABILIZAÇÃO
   ======================================================================== */

async function contabilizar(interaction) {
    if (!podeContabilizar()) {
        return interaction.reply({ content: '🚫 **A contabilização só pode ser feita nos dias pares de setembro de 2026.**\n\n📝 O registro de duplas pode ser feito qualquer dia.', flags: MessageFlags.Ephemeral });
    }

    const dados = carregarDados();
    if (dados.duplas.length < 3) return interaction.reply({ content: '❌ É necessário ter pelo menos 3 duplas registradas.', flags: MessageFlags.Ephemeral });

    const menu = menuResultadoPais(dados, 'olymp_result_ouro', '🥇 Selecione o país vencedor');
    if (!menu) return interaction.reply({ content: '❌ Não há países registrados para contabilizar.', flags: MessageFlags.Ephemeral });

    return interaction.reply({
        content: '🏅 **CONTABILIZAÇÃO DE PARTIDA**\n\nSelecione 🥇 vencedor, 🥈 segundo e 🥉 terceiro.\n\n📸 No final será obrigatório enviar o **print anexado** da vitória. Links não são aceitos.',
        components: [menu],
        flags: MessageFlags.Ephemeral
    });
}

async function escolherOuro(interaction) {
    const dados = carregarDados();
    const ouro = paisDoResultadoMenu(interaction, dados);
    if (!ouro) return interaction.reply({ content: '❌ País vencedor inválido.', flags: MessageFlags.Ephemeral });

    const menu = menuResultadoPais(dados, `olymp_result_prata_${encodeURIComponent(ouro)}`, '🥈 Selecione o país em 2º lugar', [ouro]);
    return interaction.update({ content: `🥇 **${limparTexto(ouro)}**\n\nAgora escolha o 🥈 segundo lugar.`, components: [menu] });
}

async function escolherPrata(interaction) {
    const ouro = decodeURIComponent(interaction.customId.replace('olymp_result_prata_', ''));
    const dados = carregarDados();
    const prata = paisDoResultadoMenu(interaction, dados, [ouro]);
    if (!prata) return interaction.reply({ content: '❌ País em 2º lugar inválido.', flags: MessageFlags.Ephemeral });

    const menu = menuResultadoPais(dados, `olymp_result_bronze_${encodeURIComponent(ouro)}_${encodeURIComponent(prata)}`, '🥉 Selecione o país em 3º lugar', [ouro, prata]);
    return interaction.update({ content: `🥇 **${limparTexto(ouro)}**\n🥈 **${limparTexto(prata)}**\n\nAgora escolha o 🥉 terceiro lugar.`, components: [menu] });
}

async function escolherBronze(interaction) {
    if (!podeContabilizar()) return interaction.reply({ content: '🚫 A contabilização só pode ser feita nos dias pares de setembro de 2026.', flags: MessageFlags.Ephemeral });

    const valor = interaction.customId.replace('olymp_result_bronze_', '');
    const separador = valor.lastIndexOf('_');
    const ouro = decodeURIComponent(valor.slice(0, separador));
    const prata = decodeURIComponent(valor.slice(separador + 1));
    const dados = carregarDados();
    const bronze = paisDoResultadoMenu(interaction, dados, [ouro, prata]);
    if (!bronze) return interaction.reply({ content: '❌ País em 3º lugar inválido.', flags: MessageFlags.Ephemeral });

    await interaction.reply({
        content: `📸 **ANEXE AGORA O PRINT DA VITÓRIA**\n\n🥇 ${limparTexto(ouro)}\n🥈 ${limparTexto(prata)}\n🥉 ${limparTexto(bronze)}\n\n⚠️ Somente PNG, JPG, JPEG ou WEBP.\n🚫 Links não são aceitos.\n⏳ Você tem 2 minutos.`,
        flags: MessageFlags.Ephemeral
    });

    const coletor = interaction.channel.createMessageCollector({
        filter: mensagem => mensagem.author.id === interaction.user.id && mensagem.attachments.size > 0,
        time: 120000
    });

    coletor.on('collect', async mensagem => {
        const anexo = mensagem.attachments.find(arquivo =>
            (arquivo.contentType || '').toLowerCase().startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(arquivo.name || '')
        );
        if (!anexo) {
            await mensagem.reply('❌ Envie uma imagem PNG, JPG, JPEG ou WEBP.').catch(() => {});
            return;
        }
        coletor.stop('imagem_recebida');
        await finalizarContabilizacao(interaction, ouro, prata, bronze, anexo);
    });

    coletor.on('end', (_, motivo) => {
        if (motivo === 'time') interaction.followUp({ content: '⌛ Tempo esgotado. A contabilização foi cancelada.', flags: MessageFlags.Ephemeral }).catch(() => {});
    });
}

async function finalizarContabilizacao(interaction, ouro, prata, bronze, anexo) {
    const dados = carregarDados();
    const duplaOuro = buscarDuplaPorPais(dados, ouro);
    const duplaPrata = buscarDuplaPorPais(dados, prata);
    const duplaBronze = buscarDuplaPorPais(dados, bronze);

    if (!duplaOuro || !duplaPrata || !duplaBronze) return interaction.followUp({ content: '❌ Uma das duplas selecionadas não foi encontrada.', flags: MessageFlags.Ephemeral });

    const resultado = {
        id: `resultado_${Date.now()}`,
        data: new Date().toISOString(),
        ouro: duplaOuro.id,
        prata: duplaPrata.id,
        bronze: duplaBronze.id,
        print: anexo.url,
        printNome: anexo.name,
        printTipo: anexo.contentType,
        registradoPor: interaction.user.id
    };

    dados.resultados.push(resultado);
    dados.ranking = calcularRanking(dados);
    salvarDados(dados);

    const cfg = config();
    const canal = await interaction.client.channels.fetch(cfg.canalResultados).catch(() => null);
    if (canal?.isTextBased()) {
        await canal.send({
            embeds: [new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('🏅 RESULTADO — OLIMPÍADAS DE DUPLAS')
                .setDescription([
                    `🥇 **${limparTexto(duplaOuro.pais)}** — <@${duplaOuro.jogador1}> + <@${duplaOuro.jogador2}>`,
                    `🥈 **${limparTexto(duplaPrata.pais)}** — <@${duplaPrata.jogador1}> + <@${duplaPrata.jogador2}>`,
                    `🥉 **${limparTexto(duplaBronze.pais)}** — <@${duplaBronze.jogador1}> + <@${duplaBronze.jogador2}>`,
                    '',
                    '🥇 Vitória = critério principal',
                    '🥈 Prata = peso 3 no desempate',
                    '🥉 Bronze = peso 1 no desempate'
                ].join('\n'))
                .setImage(anexo.url)
                .setTimestamp()]
        });
    }

    return interaction.followUp({ content: '✅ **Resultado contabilizado!**\n📸 Print salvo/publicado.\n💾 Ranking atualizado permanentemente.', flags: MessageFlags.Ephemeral });
}

/* ========================================================================
   RANKINGS
   ======================================================================== */

function calcularRanking(dados) {
    const ranking = {};
    for (const resultado of dados.resultados) {
        for (const [id, colocacao] of [[resultado.ouro, 'ouro'], [resultado.prata, 'prata'], [resultado.bronze, 'bronze']]) {
            if (!ranking[id]) ranking[id] = { vitorias: 0, prata: 0, bronze: 0, desempate: 0 };
            if (colocacao === 'ouro') ranking[id].vitorias++;
            if (colocacao === 'prata') { ranking[id].prata++; ranking[id].desempate += 3; }
            if (colocacao === 'bronze') { ranking[id].bronze++; ranking[id].desempate += 1; }
        }
    }
    return ranking;
}

function rankingPaises(dados) {
    const ranking = {};
    for (const resultado of dados.resultados) {
        for (const [id, medalha] of [[resultado.ouro, 'ouro'], [resultado.prata, 'prata'], [resultado.bronze, 'bronze']]) {
            const dupla = buscarDupla(dados, id);
            if (!dupla) continue;
            ranking[dupla.pais] ??= { ouro: 0, prata: 0, bronze: 0, total: 0 };
            ranking[dupla.pais][medalha]++;
            ranking[dupla.pais].total++;
        }
    }
    return Object.entries(ranking).map(([pais, valores]) => ({ pais, ...valores })).sort((a, b) => b.ouro - a.ouro || b.prata - a.prata || b.bronze - a.bronze);
}

function rankingCompetidores(dados) {
    const ranking = {};
    for (const resultado of dados.resultados) {
        for (const [id, medalha] of [[resultado.ouro, 'ouro'], [resultado.prata, 'prata'], [resultado.bronze, 'bronze']]) {
            const dupla = buscarDupla(dados, id);
            if (!dupla) continue;
            for (const jogador of [dupla.jogador1, dupla.jogador2]) {
                ranking[jogador] ??= { ouro: 0, prata: 0, bronze: 0, total: 0 };
                ranking[jogador][medalha]++;
                ranking[jogador].total++;
            }
        }
    }
    return Object.entries(ranking).map(([id, valores]) => ({ id, ...valores })).sort((a, b) => b.ouro - a.ouro || b.prata - a.prata || b.bronze - a.bronze);
}

async function verDuplas(interaction) {
    const dados = carregarDados();
    if (!dados.duplas.length) return interaction.reply({ content: '👥 Nenhuma dupla registrada ainda.', flags: MessageFlags.Ephemeral });

    const texto = dados.duplas.slice(0, 10).map((dupla, i) => `**${i + 1}. 🌎 ${limparTexto(dupla.pais)}**\n👥 <@${dupla.jogador1}> + <@${dupla.jogador2}>`).join('\n\n');
    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#D4AF37').setTitle('👥 DUPLAS DAS OLIMPÍADAS').setDescription(texto)], flags: MessageFlags.Ephemeral });
}

async function verRanking(interaction) {
    const dados = carregarDados();
    const ranking = calcularRanking(dados);
    const paises = rankingPaises(dados);
    const competidores = rankingCompetidores(dados);

    const duplasTexto = Object.entries(ranking).map(([id, r]) => ({ dupla: buscarDupla(dados, id), ...r })).filter(x => x.dupla).sort((a, b) => b.vitorias - a.vitorias || b.desempate - a.desempate).slice(0, 10).map((x, i) => `**${i + 1}. ${limparTexto(x.dupla.pais)}** — 🥇 ${x.vitorias} • 🥈 ${x.prata} • 🥉 ${x.bronze}`).join('\n') || 'Sem resultados.';
    const paisesTexto = paises.slice(0, 10).map((x, i) => `**${i + 1}. ${limparTexto(x.pais)}** — 🥇 ${x.ouro} • 🥈 ${x.prata} • 🥉 ${x.bronze}`).join('\n') || 'Sem medalhas.';
    const competidoresTexto = competidores.slice(0, 10).map((x, i) => `**${i + 1}. <@${x.id}>** — 🥇 ${x.ouro} • 🥈 ${x.prata} • 🥉 ${x.bronze}`).join('\n') || 'Sem medalhas.';

    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#D4AF37').setTitle('🏆 RANKING — OLIMPÍADAS DE DUPLAS').addFields(
        { name: '👥 DUPLAS', value: duplasTexto, inline: false },
        { name: '🌎 PAÍSES', value: paisesTexto, inline: false },
        { name: '👤 COMPETIDORES', value: competidoresTexto, inline: false }
    )], flags: MessageFlags.Ephemeral });
}

/* ========================================================================
   GUIA
   ======================================================================== */

async function guia(interaction) {
    const cfg = config();
    const cargo = cfg.cargoTeg ? `<@&${cfg.cargoTeg}>` : '@• Olímpico';
    const texto = [
        '**🟨 Olimpíadas de Duplas:**', '',
        `**Vencedores: ${cargo}**`,
        '**Cada dupla escolherá um País para representar**',
        '**Todos os dias pares do Mês de Setembro!**', '',
        '#️⃣ **Ranking de países por quantidade de medalhas**',
        '#️⃣ **Ranking de competidores por quantidade de medalhas**',
        '**Dupla vencedora:** 🥇',
        '**Critérios de desempate (apenas para os vivos):**',
        '**Dupla vice:** 🥈 **(peso: 3)**',
        '**Dupla lanterna:** 🥉 **(peso: 1)**',
        '***1h30min de partida***', '',
        '**🚫 Regras:**', '',
        '**1️⃣ Em caso de Briga, é possível a troca entre países com as medalhas individuais mantidas.**',
        '**2️⃣ Em caso de Ausência, é possível a substituição DEFINITIVA de um parceiro para outro. As medalhas do País serão mantidas intactas.**',
        '**3️⃣ Em caso de Anti-jogo, será tratado como qualquer outra partida do servidor.**',
        '**4️⃣ Em caso de disputa por um país, será feito um sorteio.**', '',
        '**⚠️ As Olimpíadas terão apenas DOIS vencedores!**'
    ].join('\n');

    return interaction.reply({ embeds: [new EmbedBuilder().setColor('#D4AF37').setTitle('📖 GUIA — OLIMPÍADAS DE DUPLAS').setDescription(texto)], flags: MessageFlags.Ephemeral });
}

/* ========================================================================
   ROTEADOR
   ======================================================================== */

async function handle(interaction) {
    const id = interaction.customId || '';

    if (id === 'olymp_contabilizar') return contabilizar(interaction);
    if (id === 'olymp_duplas') return verDuplas(interaction);
    if (id === 'olymp_registrar') return registrar(interaction);
    if (id === 'olymp_ranking') return verRanking(interaction);
    if (id === 'olymp_guia') return guia(interaction);

    if (id === 'olymp_reg_p1') return registrarJogador1(interaction);
    if (id.startsWith('olymp_reg_p2_')) return registrarJogador2(interaction);
    if (id.startsWith('olymp_buscar_')) return abrirPesquisa(interaction);
    if (id.startsWith('olymp_pesquisa_modal_')) return pesquisarPais(interaction);
    if (id.startsWith('olymp_prev_')) return mudarPaginaPais(interaction, -1);
    if (id.startsWith('olymp_next_')) return mudarPaginaPais(interaction, 1);
    if (id.startsWith('olymp_pais_')) return selecionarPais(interaction);

    if (id === 'olymp_result_ouro') return escolherOuro(interaction);
    if (id.startsWith('olymp_result_prata_')) return escolherPrata(interaction);
    if (id.startsWith('olymp_result_bronze_')) return escolherBronze(interaction);

    return false;
}

module.exports = {
    handle,
    painel,
    criarPainel,
    criarBotoes,
    calcularRanking,
    rankingPaises,
    rankingCompetidores,
    podeContabilizar
};
