/* ========================================================================
   WORLDWARBR — OLIMPÍADAS DE DUPLAS
   ARQUIVO: commands/olimpiadas/olimpiadas-handler.js
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

const MODO_TESTE = true;
const DATA_TESTE = { ano: 2026, mes: 9, dia: 1 };
const MES_OFICIAL = 9;

// Canal oficial dos resultados solicitado para as Olimpíadas.
const CANAL_RESULTADOS_PADRAO = '1071976981924687912';

/* ========================================================================
   DADOS
   ======================================================================== */

function lerConfig() {
    try {
        const dados = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
        return dados && typeof dados === 'object' ? dados : {};
    } catch (erro) {
        console.error('[OLIMPIADAS] Erro lendo olimpiadas.json:', erro);
        return {};
    }
}

function carregarDados() {
    const dados = lerConfig();

    if (!Array.isArray(dados.paises)) dados.paises = [];
    if (!Array.isArray(dados.duplas)) dados.duplas = [];
    if (!Array.isArray(dados.resultados)) dados.resultados = [];
    if (!dados.ranking || typeof dados.ranking !== 'object') dados.ranking = {};
    if (!Object.prototype.hasOwnProperty.call(dados, 'painelMensagemId')) {
        dados.painelMensagemId = null;
    }

    return dados;
}

function salvarDados(dados) {
    try {
        fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2), 'utf8');
        return true;
    } catch (erro) {
        console.error('[OLIMPIADAS] Erro salvando dados:', erro);
        return false;
    }
}

/* ========================================================================
   TEXTO / PAÍSES
   ======================================================================== */

function limparTexto(valor) {
    return String(valor ?? '')
        .replace(/\\/g, '')
        .replace(/`/g, '')
        .replace(/\*/g, '')
        .replace(/_/g, '')
        .replace(/~/g, '')
        .replace(/\|/g, '');
}

function normalizar(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function paisesConfigurados() {
    return lerConfig().paises
        ?.map(pais => String(pais).trim())
        .filter(Boolean) || [];
}

function paisOcupado(dados, pais) {
    return dados.duplas.some(d => normalizar(d.pais) === normalizar(pais));
}

function jogadorOcupado(dados, id) {
    return dados.duplas.some(d =>
        String(d.jogador1) === String(id) ||
        String(d.jogador2) === String(id)
    );
}

function paisesDisponiveis(dados) {
    const ocupados = new Set(dados.duplas.map(d => normalizar(d.pais)));
    return paisesConfigurados().filter(pais => !ocupados.has(normalizar(pais)));
}

function buscarDupla(dados, id) {
    if (!id) return null;
    return dados.duplas.find(d => String(d.id) === String(id)) || null;
}

function buscarDuplaPorPais(dados, pais) {
    if (!pais) return null;
    return dados.duplas.find(d => normalizar(d.pais) === normalizar(pais)) || null;
}

/* ========================================================================
   DATA
   ======================================================================== */

function podeContabilizar() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth() + 1;
    const dia = agora.getDate();

    if (
        MODO_TESTE &&
        ano === DATA_TESTE.ano &&
        mes === DATA_TESTE.mes &&
        dia === DATA_TESTE.dia
    ) {
        return true;
    }

    return ano === 2026 && mes === MES_OFICIAL && dia % 2 === 0;
}

/* ========================================================================
   PESQUISA / REGISTRO DE DUPLA
   ======================================================================== */

const pesquisas = new Map();

function criarPesquisa(dados, jogador1, jogador2) {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    pesquisas.set(token, {
        jogador1: String(jogador1),
        jogador2: String(jogador2),
        paises: paisesDisponiveis(dados),
        criadoEm: Date.now()
    });

    setTimeout(() => pesquisas.delete(token), 5 * 60 * 1000);
    return token;
}

function criarMenuPais(token, pagina = 0) {
    const pesquisa = pesquisas.get(token);
    if (!pesquisa) return [];

    const inicio = pagina * 25;
    const lista = pesquisa.paises.slice(inicio, inicio + 25);
    const totalPaginas = Math.max(1, Math.ceil(pesquisa.paises.length / 25));

    if (!lista.length) return [];

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`olymp_pais_${token}_${pagina}`)
        .setPlaceholder('🌎 Escolha um país')
        .addOptions(lista.map((pais, indice) => ({
            label: pais.slice(0, 100),
            value: `pais_${inicio + indice}`,
            emoji: '🌎'
        })));

    const botoes = new ActionRowBuilder().addComponents(
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
            .setDisabled(pagina <= 0),
        new ButtonBuilder()
            .setCustomId(`olymp_pagina_${token}`)
            .setLabel(`Página ${pagina + 1}/${totalPaginas}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`olymp_next_${token}_${pagina}`)
            .setLabel('Próxima')
            .setEmoji('➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina >= totalPaginas - 1)
    );

    return [new ActionRowBuilder().addComponents(menu), botoes];
}

async function registrar(interaction) {
    return interaction.reply({
        content: '📝 **REGISTRO DE DUPLA**\n\nSelecione o primeiro integrante.',
        components: [
            new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId('olymp_reg_p1')
                    .setPlaceholder('👤 Jogador 1')
                    .setMinValues(1)
                    .setMaxValues(1)
            )
        ],
        flags: MessageFlags.Ephemeral
    });
}

async function registrarJogador1(interaction) {
    const jogador1 = interaction.values?.[0];
    if (!jogador1) {
        return interaction.reply({ content: '❌ Jogador inválido.', flags: MessageFlags.Ephemeral });
    }

    const dados = carregarDados();
    if (jogadorOcupado(dados, jogador1)) {
        return interaction.reply({ content: '❌ Esse jogador já pertence a uma dupla.', flags: MessageFlags.Ephemeral });
    }

    return interaction.update({
        content: '📝 **REGISTRO DE DUPLA**\n\nAgora selecione o segundo integrante.',
        components: [
            new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId(`olymp_reg_p2_${jogador1}`)
                    .setPlaceholder('👤 Jogador 2')
                    .setMinValues(1)
                    .setMaxValues(1)
            )
        ]
    });
}

async function registrarJogador2(interaction) {
    const jogador1 = interaction.customId.replace('olymp_reg_p2_', '');
    const jogador2 = interaction.values?.[0];

    if (!jogador1 || !jogador2) {
        return interaction.reply({ content: '❌ Jogadores inválidos.', flags: MessageFlags.Ephemeral });
    }

    const dados = carregarDados();

    if (jogador1 === jogador2) {
        return interaction.reply({ content: '❌ Os dois integrantes precisam ser diferentes.', flags: MessageFlags.Ephemeral });
    }

    if (jogadorOcupado(dados, jogador1) || jogadorOcupado(dados, jogador2)) {
        return interaction.reply({ content: '❌ Um dos jogadores já pertence a uma dupla registrada.', flags: MessageFlags.Ephemeral });
    }

    const token = criarPesquisa(dados, jogador1, jogador2);
    const pesquisa = pesquisas.get(token);

    if (!pesquisa?.paises.length) {
        pesquisas.delete(token);
        return interaction.reply({ content: '❌ Todos os países disponíveis já foram escolhidos.', flags: MessageFlags.Ephemeral });
    }

    return interaction.update({
        content: [
            '🌎 **ESCOLHA O PAÍS DA DUPLA**',
            '',
            `📋 **${pesquisa.paises.length} países disponíveis.**`,
            '',
            'Selecione um país abaixo.',
            '🔎 Caso queira, use **Pesquisar país**.',
            '',
            '⚡ **Ao clicar no país, ele será confirmado imediatamente.**'
        ].join('\n'),
        components: criarMenuPais(token, 0)
    });
}

async function abrirPesquisa(interaction) {
    const token = interaction.customId.replace('olymp_buscar_', '');
    if (!pesquisas.has(token)) {
        return interaction.reply({ content: '⌛ Esta pesquisa expirou. Faça o registro novamente.', flags: MessageFlags.Ephemeral });
    }

    const modal = new ModalBuilder()
        .setCustomId(`olymp_pesquisa_modal_${token}`)
        .setTitle('🔎 Pesquisar país');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('termo')
                .setLabel('Digite o nome do país')
                .setPlaceholder('Ex.: Brasil, Colombia, Alemanha')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(50)
                .setRequired(true)
        )
    );

    return interaction.showModal(modal);
}

async function pesquisarPais(interaction) {
    const token = interaction.customId.replace('olymp_pesquisa_modal_', '');
    const pesquisa = pesquisas.get(token);
    if (!pesquisa) {
        return interaction.reply({ content: '⌛ Esta pesquisa expirou. Faça o registro novamente.', flags: MessageFlags.Ephemeral });
    }

    const termo = interaction.fields.getTextInputValue('termo').trim();
    if (!termo) {
        return interaction.reply({ content: '❌ Digite o nome de um país.', flags: MessageFlags.Ephemeral });
    }

    const dados = carregarDados();
    const resultados = paisesDisponiveis(dados).filter(pais => normalizar(pais).includes(normalizar(termo)));

    if (!resultados.length) {
        return interaction.reply({ content: `❌ Nenhum país encontrado para **${limparTexto(termo)}**.`, flags: MessageFlags.Ephemeral });
    }

    pesquisa.paises = resultados;

    return interaction.reply({
        content: `🔎 **PAÍSES ENCONTRADOS:** ${limparTexto(termo)}\n\n🌎 Clique no país para confirmar.`,
        components: criarMenuPais(token, 0),
        flags: MessageFlags.Ephemeral
    });
}

async function mudarPaginaPais(interaction, direcao) {
    const partes = interaction.customId.split('_');
    const token = partes[2];
    const paginaAtual = Number(partes[3]);
    const pesquisa = pesquisas.get(token);

    if (!pesquisa) return interaction.reply({ content: '⌛ Pesquisa expirada.', flags: MessageFlags.Ephemeral });

    const totalPaginas = Math.max(1, Math.ceil(pesquisa.paises.length / 25));
    const novaPagina = Math.max(0, Math.min(totalPaginas - 1, paginaAtual + direcao));

    return interaction.update({
        content: `🌎 **ESCOLHA O PAÍS DA DUPLA**\n\n📋 Página **${novaPagina + 1}/${totalPaginas}**`,
        components: criarMenuPais(token, novaPagina)
    });
}

async function selecionarPais(interaction) {
    const partes = interaction.customId.split('_');
    const token = partes[2];
    const pesquisa = pesquisas.get(token);

    if (!pesquisa) return interaction.reply({ content: '⌛ Esta seleção expirou.', flags: MessageFlags.Ephemeral });

    const valor = interaction.values?.[0] || '';
    const indice = Number(valor.replace('pais_', ''));
    const pais = Number.isInteger(indice) ? pesquisa.paises[indice] : null;

    if (!pais) return interaction.reply({ content: '❌ País inválido.', flags: MessageFlags.Ephemeral });

    const dados = carregarDados();

    if (jogadorOcupado(dados, pesquisa.jogador1) || jogadorOcupado(dados, pesquisa.jogador2)) {
        pesquisas.delete(token);
        return interaction.reply({ content: '❌ Um dos jogadores já pertence a outra dupla.', flags: MessageFlags.Ephemeral });
    }

    if (paisOcupado(dados, pais)) {
        pesquisas.delete(token);
        return interaction.reply({ content: '❌ Esse país acabou de ser escolhido por outra dupla.', flags: MessageFlags.Ephemeral });
    }

    dados.duplas.push({
        id: `dupla_${Date.now()}_${pesquisa.jogador1}`,
        pais,
        jogador1: pesquisa.jogador1,
        jogador2: pesquisa.jogador2,
        criadoPor: interaction.user.id,
        criadoEm: new Date().toISOString(),
        ativa: true
    });

    dados.ranking = calcularRanking(dados);
    salvarDados(dados);
    pesquisas.delete(token);

    const cfg = lerConfig();
    if (cfg.canalTeg) {
        const canalTeg = await interaction.client.channels.fetch(cfg.canalTeg).catch(() => null);
        if (canalTeg?.isTextBased()) {
            await canalTeg.send({
                content: cfg.cargoTeg ? `<@&${cfg.cargoTeg}>` : undefined,
                embeds: [new EmbedBuilder()
                    .setColor('#D4AF37')
                    .setTitle('📝 NOVA DUPLA REGISTRADA')
                    .setDescription([
                        `🌎 **País:** ${limparTexto(pais)}`,
                        '',
                        `👥 **Jogadores:** <@${pesquisa.jogador1}> + <@${pesquisa.jogador2}>`
                    ].join('\n'))
                    .setTimestamp()]
            }).catch(() => {});
        }
    }

    await atualizarPainel(interaction.client);

    return interaction.update({
        content: [
            '✅ **DUPLA REGISTRADA COM SUCESSO!**',
            '',
            `🌎 **País:** ${limparTexto(pais)}`,
            '',
            '👥 **Dupla registrada.**',
            '🏆 O painel foi atualizado.'
        ].join('\n'),
        components: []
    });
}

/* ========================================================================
   CONTABILIZAÇÃO
   ======================================================================== */

const contabilizacoes = new Map();

function criarEstadoContabilizacao(interaction) {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    contabilizacoes.set(token, {
        userId: interaction.user.id,
        ouro: null,
        prata: null,
        bronze: null,
        criadoEm: Date.now()
    });

    setTimeout(() => contabilizacoes.delete(token), 5 * 60 * 1000);
    return token;
}

function estadoDaContabilizacao(token) {
    return contabilizacoes.get(token) || null;
}

function criarMenuResultado(dados, customId, placeholder, excluir = []) {
    const paises = dados.duplas
        .map(d => d.pais)
        .filter(pais => !excluir.some(item => normalizar(item) === normalizar(pais)));

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

function obterPaisResultado(interaction, dados, excluir = []) {
    const paises = dados.duplas
        .map(d => d.pais)
        .filter(pais => !excluir.some(item => normalizar(item) === normalizar(pais)));

    const indice = Number(String(interaction.values?.[0] || '').replace('resultado_', ''));
    return Number.isInteger(indice) ? (paises[indice] || null) : null;
}

function botoesSemColocacao(customId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('Não teve colocação')
            .setEmoji('➖')
            .setStyle(ButtonStyle.Secondary)
    );
}

async function contabilizar(interaction) {
    if (!podeContabilizar()) {
        return interaction.reply({
            content: [
                '🚫 **CONTABILIZAÇÃO FECHADA**',
                '',
                'A contabilização oficial acontece somente nos dias pares de setembro de 2026.',
                '',
                '📝 O registro de duplas continua disponível.'
            ].join('\n'),
            flags: MessageFlags.Ephemeral
        });
    }

    const dados = carregarDados();
    if (dados.duplas.length < 3) {
        return interaction.reply({
            content: '❌ É necessário ter pelo menos **3 duplas registradas**.',
            flags: MessageFlags.Ephemeral
        });
    }

    const token = criarEstadoContabilizacao(interaction);
    const menu = criarMenuResultado(dados, `olymp_result_ouro_${token}`, '🥇 Selecione o país vencedor');

    return interaction.reply({
        content: [
            '🏅 **CONTABILIZAÇÃO DE PARTIDA**',
            '',
            '🥇 **1º lugar:** obrigatório',
            '🥈 **2º lugar:** pode selecionar um país ou **Não teve colocação**',
            '🥉 **3º lugar:** pode selecionar um país ou **Não teve colocação**',
            '',
            '📸 Depois das colocações será solicitado o print da vitória.',
            '🚫 Links não são aceitos.'
        ].join('\n'),
        components: menu ? [menu] : [],
        flags: MessageFlags.Ephemeral
    });
}

async function escolherOuro(interaction) {
    const token = interaction.customId.replace('olymp_result_ouro_', '');
    const estado = estadoDaContabilizacao(token);
    if (!estado || estado.userId !== interaction.user.id) {
        return interaction.reply({ content: '⌛ Esta contabilização expirou. Comece novamente.', flags: MessageFlags.Ephemeral });
    }

    const dados = carregarDados();
    const ouro = obterPaisResultado(interaction, dados);
    if (!ouro) return interaction.reply({ content: '❌ País vencedor inválido.', flags: MessageFlags.Ephemeral });

    estado.ouro = ouro;

    const menu = criarMenuResultado(dados, `olymp_result_prata_${token}`, '🥈 Selecione o país em 2º lugar', [ouro]);

    return interaction.update({
        content: [
            '🏅 **RESULTADO DA PARTIDA**',
            '',
            `🥇 **${limparTexto(ouro)}**`,
            '',
            'Agora escolha o 🥈 segundo lugar.',
            'Se não houve segundo colocado, clique em **Não teve colocação**.'
        ].join('\n'),
        components: [
            ...(menu ? [menu] : []),
            botoesSemColocacao(`olymp_result_prata_none_${token}`)
        ]
    });
}

async function escolherPrata(interaction) {
    const token = interaction.customId.replace('olymp_result_prata_', '');
    const estado = estadoDaContabilizacao(token);
    if (!estado || estado.userId !== interaction.user.id) {
        return interaction.reply({ content: '⌛ Esta contabilização expirou.', flags: MessageFlags.Ephemeral });
    }

    const dados = carregarDados();
    const prata = obterPaisResultado(interaction, dados, [estado.ouro]);
    if (!prata) return interaction.reply({ content: '❌ País em 2º lugar inválido.', flags: MessageFlags.Ephemeral });

    estado.prata = prata;
    return mostrarTerceiro(interaction, estado, token);
}

async function escolherPrataNenhum(interaction) {
    const token = interaction.customId.replace('olymp_result_prata_none_', '');
    const estado = estadoDaContabilizacao(token);
    if (!estado || estado.userId !== interaction.user.id) {
        return interaction.reply({ content: '⌛ Esta contabilização expirou.', flags: MessageFlags.Ephemeral });
    }

    estado.prata = null;
    return mostrarTerceiro(interaction, estado, token);
}

async function mostrarTerceiro(interaction, estado, token) {
    const dados = carregarDados();
    const excluir = [estado.ouro, estado.prata].filter(Boolean);
    const menu = criarMenuResultado(dados, `olymp_result_bronze_${token}`, '🥉 Selecione o país em 3º lugar', excluir);

    const colocacoes = [
        `🥇 **${limparTexto(estado.ouro)}**`,
        estado.prata ? `🥈 **${limparTexto(estado.prata)}**` : '🥈 **Não teve colocação**'
    ];

    return interaction.update({
        content: [
            '🏅 **RESULTADO DA PARTIDA**',
            '',
            ...colocacoes,
            '',
            'Agora escolha o 🥉 terceiro lugar.',
            'Se não houve terceiro colocado, clique em **Não teve colocação**.'
        ].join('\n'),
        components: [
            ...(menu ? [menu] : []),
            botoesSemColocacao(`olymp_result_bronze_none_${token}`)
        ]
    });
}

async function escolherBronze(interaction) {
    const token = interaction.customId.replace('olymp_result_bronze_', '');
    const estado = estadoDaContabilizacao(token);
    if (!estado || estado.userId !== interaction.user.id) {
        return interaction.reply({ content: '⌛ Esta contabilização expirou.', flags: MessageFlags.Ephemeral });
    }

    const dados = carregarDados();
    const bronze = obterPaisResultado(interaction, dados, [estado.ouro, estado.prata].filter(Boolean));
    if (!bronze) return interaction.reply({ content: '❌ País em 3º lugar inválido.', flags: MessageFlags.Ephemeral });

    estado.bronze = bronze;
    return pedirPrint(interaction, estado, token);
}

async function escolherBronzeNenhum(interaction) {
    const token = interaction.customId.replace('olymp_result_bronze_none_', '');
    const estado = estadoDaContabilizacao(token);
    if (!estado || estado.userId !== interaction.user.id) {
        return interaction.reply({ content: '⌛ Esta contabilização expirou.', flags: MessageFlags.Ephemeral });
    }

    estado.bronze = null;
    return pedirPrint(interaction, estado, token);
}

/* ========================================================================
   PRINT
   ======================================================================== */

async function pedirPrint(interaction, estado, token) {
    if (!podeContabilizar()) {
        contabilizacoes.delete(token);
        return interaction.reply({ content: '🚫 A contabilização está fechada.', flags: MessageFlags.Ephemeral });
    }

    await interaction.update({
        content: [
            '📸 **ANEXE O PRINT DA VITÓRIA**',
            '',
            `🥇 ${limparTexto(estado.ouro)}`,
            estado.prata ? `🥈 ${limparTexto(estado.prata)}` : '🥈 Não teve colocação',
            estado.bronze ? `🥉 ${limparTexto(estado.bronze)}` : '🥉 Não teve colocação',
            '',
            '⚠️ PNG, JPG, JPEG ou WEBP.',
            '🚫 Links não são aceitos.',
            '',
            '⏳ Você tem 2 minutos. Envie o arquivo neste canal.'
        ].join('\n'),
        components: []
    });

    const canal = interaction.channel;
    if (!canal?.isTextBased()) {
        contabilizacoes.delete(token);
        return interaction.followUp({ content: '❌ Não consegui receber o print neste canal.', flags: MessageFlags.Ephemeral });
    }

    const coletor = canal.createMessageCollector({
        filter: mensagem => mensagem.author.id === interaction.user.id,
        time: 120000
    });

    coletor.on('collect', async mensagem => {
        const anexo = mensagem.attachments.find(arquivo => {
            const tipo = String(arquivo.contentType || '').toLowerCase();
            const nome = String(arquivo.name || '');
            return tipo.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(nome);
        });

        if (!anexo) {
            if (mensagem.attachments.size > 0) {
                await mensagem.reply('❌ Envie apenas PNG, JPG, JPEG ou WEBP.').catch(() => {});
            }
            return;
        }

        coletor.stop('imagem_recebida');
        contabilizacoes.delete(token);

        await finalizarContabilizacao(interaction, estado, anexo);

        // O print enviado pelo jogador não fica exposto no canal.
        await mensagem.delete().catch(() => {});

        // Remove também a mensagem efêmera de "anexe o print".
        await interaction.deleteReply().catch(() => {});
    });

    coletor.on('end', (_, motivo) => {
        if (motivo === 'time') {
            contabilizacoes.delete(token);
            interaction.followUp({
                content: '⌛ Tempo esgotado. A contabilização foi cancelada.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    });
}

/* ========================================================================
   FINALIZAR / PUBLICAR RESULTADO
   ======================================================================== */

async function finalizarContabilizacao(interaction, estado, anexo) {
    const dados = carregarDados();

    const duplaOuro = buscarDuplaPorPais(dados, estado.ouro);
    const duplaPrata = buscarDuplaPorPais(dados, estado.prata);
    const duplaBronze = buscarDuplaPorPais(dados, estado.bronze);

    if (!duplaOuro) {
        return interaction.followUp({ content: '❌ A dupla do 1º lugar não foi encontrada.', flags: MessageFlags.Ephemeral });
    }

    const resultado = {
        id: `resultado_${Date.now()}`,
        data: new Date().toISOString(),
        ouro: duplaOuro.id,
        prata: duplaPrata?.id || null,
        bronze: duplaBronze?.id || null,
        print: anexo.url,
        printNome: anexo.name || null,
        printTipo: anexo.contentType || null,
        registradoPor: interaction.user.id
    };

    dados.resultados.push(resultado);
    dados.ranking = calcularRanking(dados);

    if (!salvarDados(dados)) {
        return interaction.followUp({ content: '❌ Não consegui salvar o resultado.', flags: MessageFlags.Ephemeral });
    }

    const cfg = lerConfig();
    const canalResultadosId = cfg.canalResultados || CANAL_RESULTADOS_PADRAO;
    const canalResultados = await interaction.client.channels.fetch(canalResultadosId).catch(() => null);

    if (canalResultados?.isTextBased()) {
        const medalhas = [
            `🥇 **${limparTexto(duplaOuro.pais)}**`,
            duplaPrata ? `🥈 **${limparTexto(duplaPrata.pais)}**` : '🥈 **Não teve colocação**',
            duplaBronze ? `🥉 **${limparTexto(duplaBronze.pais)}**` : '🥉 **Não teve colocação**'
        ];

        // IMPORTANTE: o print original é apagado logo depois da finalização.
        // Se usarmos diretamente anexo.url no embed, a URL assinada do anexo
        // pode deixar de funcionar após a exclusão da mensagem original.
        // Por isso o Discord recebe o arquivo novamente no canal de resultados
        // e o embed aponta para a cópia permanente daquele envio.
        const nomeArquivo = String(anexo.name || 'resultado.png').replace(/[^a-zA-Z0-9._-]/g, '_') || 'resultado.png';

        await canalResultados.send({
            files: [
                {
                    attachment: anexo.url,
                    name: nomeArquivo
                }
            ],
            embeds: [new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('🏅 RESULTADO — OLIMPÍADAS DE DUPLAS')
                .setDescription([
                    ...medalhas,
                    '',
                    '🏆 **Resultado contabilizado oficialmente.**'
                ].join('\n'))
                .setImage(`attachment://${nomeArquivo}`)
                .setFooter({ text: 'WorldWarBR • Olimpíadas de Duplas' })
                .setTimestamp()]
        }).catch(erro => console.error('[OLIMPIADAS] Erro publicando resultado:', erro));
    } else {
        console.error(`[OLIMPIADAS] Canal de resultados não encontrado: ${canalResultadosId}`);
    }

    await atualizarPainel(interaction.client);

    return interaction.followUp({
        content: [
            '✅ **RESULTADO CONTABILIZADO!**',
            '',
            `🥇 ${limparTexto(duplaOuro.pais)}`,
            duplaPrata ? `🥈 ${limparTexto(duplaPrata.pais)}` : '🥈 Não teve colocação',
            duplaBronze ? `🥉 ${limparTexto(duplaBronze.pais)}` : '🥉 Não teve colocação',
            '',
            '💾 Resultado salvo permanentemente.',
            '📸 Print publicado no canal oficial de resultados.',
            '🏆 Ranking atualizado.'
        ].join('\n'),
        flags: MessageFlags.Ephemeral
    });
}

/* ========================================================================
   RANKING
   ======================================================================== */

function calcularRanking(dados) {
    const ranking = {};

    for (const resultado of dados.resultados) {
        for (const [id, medalha] of [
            [resultado.ouro, 'ouro'],
            [resultado.prata, 'prata'],
            [resultado.bronze, 'bronze']
        ]) {
            if (!id) continue;

            if (!ranking[id]) {
                ranking[id] = {
                    vitorias: 0,
                    ouro: 0,
                    prata: 0,
                    bronze: 0,
                    desempate: 0
                };
            }

            ranking[id][medalha]++;

            if (medalha === 'ouro') {
                ranking[id].vitorias++;
            } else if (medalha === 'prata') {
                ranking[id].desempate += 3;
            } else if (medalha === 'bronze') {
                ranking[id].desempate += 1;
            }
        }
    }

    return ranking;
}

function rankingPaises(dados) {
    const ranking = {};

    for (const resultado of dados.resultados) {
        for (const [id, medalha] of [
            [resultado.ouro, 'ouro'],
            [resultado.prata, 'prata'],
            [resultado.bronze, 'bronze']
        ]) {
            if (!id) continue;

            const dupla = buscarDupla(dados, id);
            if (!dupla) continue;

            const pais = dupla.pais;
            const chave = normalizar(pais);

            if (!ranking[chave]) {
                ranking[chave] = {
                    pais,
                    vitorias: 0,
                    ouro: 0,
                    prata: 0,
                    bronze: 0,
                    desempate: 0
                };
            }

            ranking[chave][medalha]++;

            if (medalha === 'ouro') {
                ranking[chave].vitorias++;
            } else if (medalha === 'prata') {
                ranking[chave].desempate += 3;
            } else if (medalha === 'bronze') {
                ranking[chave].desempate += 1;
            }
        }
    }

    return Object.values(ranking).sort((a, b) =>
        b.ouro - a.ouro ||
        b.prata - a.prata ||
        b.bronze - a.bronze ||
        b.vitorias - a.vitorias ||
        b.desempate - a.desempate ||
        normalizar(a.pais).localeCompare(normalizar(b.pais))
    );
}

/* ========================================================================
   PAINEL
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
            `**Vencedores: ${cargo}**`,
            '',
            '🌎 **Cada dupla representa um país.**',
            '',
            '📅 **Contabilização:** dias pares de setembro.',
            MODO_TESTE ? '🧪 **MODO TESTE ATIVO.**' : '',
            '',
            '🥇 Ouro • 🥈 Prata • 🥉 Bronze',
            '➖ 2º ou 3º podem ficar **sem colocação**.',
            '',
            `👥 **Duplas registradas:** ${dados.duplas.length}`,
            `🏅 **Partidas contabilizadas:** ${dados.resultados.length}`,
            '',
            '━━━━━━━━━━━━━━━━━━━━',
            '',
            '🏆 **RANKING DE PAÍSES**',
            '',
            resumoRanking
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
    if (!dados.duplas.length) {
        return interaction.reply({ content: '👥 Nenhuma dupla registrada ainda.', flags: MessageFlags.Ephemeral });
    }

    const texto = dados.duplas.slice(0, 25).map((dupla, indice) =>
        `**${indice + 1}. 🌎 ${limparTexto(dupla.pais)}**\n👥 <@${dupla.jogador1}> + <@${dupla.jogador2}>`
    ).join('\n\n');

    return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#D4AF37').setTitle('👥 DUPLAS DAS OLIMPÍADAS').setDescription(texto)],
        flags: MessageFlags.Ephemeral
    });
}

async function verRanking(interaction) {
    const ranking = rankingPaises(carregarDados());
    const texto = ranking.length
        ? ranking.slice(0, 25).map((item, indice) =>
            `**${indice + 1}. 🌎 ${limparTexto(item.pais)}** — 🥇 ${item.ouro} • 🥈 ${item.prata} • 🥉 ${item.bronze} • 🏅 ${item.total}`
        ).join('\n\n')
        : '🌎 **PAÍSES**\n\nSem medalhas ainda.';

    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setColor('#D4AF37')
            .setTitle('🏆 RANKING — OLIMPÍADAS DE DUPLAS')
            .setDescription(texto)
            .setFooter({ text: 'Ranking acumulado de todas as partidas' })],
        flags: MessageFlags.Ephemeral
    });
}

async function guia(interaction) {
    const cfg = lerConfig();
    const cargo = cfg.cargoTeg ? `<@&${cfg.cargoTeg}>` : '@• Olímpico';

    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setColor('#D4AF37')
            .setTitle('📖 GUIA — OLIMPÍADAS')
            .setDescription([
                '🟨 **OLIMPÍADAS DE DUPLAS**',
                '',
                `🏆 **Vencedores:** ${cargo}`,
                '',
                '🌎 Cada dupla representa um país.',
                '',
                '🏅 **CONTABILIZAÇÃO**',
                '🥇 1º lugar = Ouro',
                '🥈 2º lugar = Prata',
                '🥉 3º lugar = Bronze',
                '➖ 2º e 3º podem ficar sem colocação.',
                '',
                '📸 O print é obrigatório.',
                '🧹 O print enviado é apagado do canal após ser recebido.',
                '📢 O resultado vai para o canal oficial de resultados.',
                '',
                '📅 Regra oficial: dias pares de setembro.'
            ].join('\n'))],
        flags: MessageFlags.Ephemeral
    });
}

/* ========================================================================
   ROTEADOR
   ======================================================================== */

async function handle(interaction) {
    const id = interaction.customId || '';

    if (interaction.isModalSubmit?.() && id.startsWith('olymp_pesquisa_modal_')) {
        return pesquisarPais(interaction);
    }

    if (!(
        interaction.isButton?.() ||
        interaction.isStringSelectMenu?.() ||
        interaction.isUserSelectMenu?.()
    )) {
        return false;
    }

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