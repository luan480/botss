/* ========================================================================
   WORLDWARBR — OLIMPÍADAS DE DUPLAS
   ARQUIVO: commands/olimpiadas/olimpiadas-handler.js

   SISTEMA:
   - Registro de dupla
   - Seleção de jogadores
   - Lista de países
   - Pesquisa de país
   - Seleção imediata do país
   - Contabilização de resultados
   - Print obrigatório
   - Ranking acumulado por países
   - Atualização do painel
   - Modo de teste liberado para 31/08/2026

   IMPORTANTE:
   A pesquisa de país é tratada por ModalSubmit.
   O index.js também precisa encaminhar olymp_pesquisa_modal_...
   para este handler.
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

/* ========================================================================
   CONFIGURAÇÕES
   ======================================================================== */

const MODO_TESTE = true;

// Data liberada para teste.
const DATA_TESTE = {
    ano: 2026,
    mes: 9,
    dia: 1
};

// Regra definitiva:
// contabilização somente nos dias pares de setembro.
const MES_OFICIAL = 9;

/* ========================================================================
   LEITURA / SALVAMENTO
   ======================================================================== */

function lerConfig() {
    try {
        return JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
    } catch (erro) {
        console.error(
            '[OLIMPIADAS] Erro lendo olimpiadas.json:',
            erro
        );

        return {
            paises: [],
            duplas: [],
            resultados: [],
            ranking: {},
            painelMensagemId: null
        };
    }
}

function carregarDados() {
    const dados = lerConfig();

    if (!Array.isArray(dados.paises)) {
        dados.paises = [];
    }

    if (!Array.isArray(dados.duplas)) {
        dados.duplas = [];
    }

    if (!Array.isArray(dados.resultados)) {
        dados.resultados = [];
    }

    if (!dados.ranking || typeof dados.ranking !== 'object') {
        dados.ranking = {};
    }

    if (!Object.prototype.hasOwnProperty.call(dados, 'painelMensagemId')) {
        dados.painelMensagemId = null;
    }

    return dados;
}

function salvarDados(dados) {
    try {
        fs.writeFileSync(
            ARQUIVO_DADOS,
            JSON.stringify(dados, null, 2),
            'utf8'
        );

        return true;
    } catch (erro) {
        console.error(
            '[OLIMPIADAS] Erro salvando olimpiadas.json:',
            erro
        );

        return false;
    }
}

/* ========================================================================
   TEXTO
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

/* ========================================================================
   PAÍSES
   ======================================================================== */

function paisesConfigurados() {
    const cfg = lerConfig();

    if (!Array.isArray(cfg.paises)) {
        return [];
    }

    return cfg.paises
        .map(pais => String(pais).trim())
        .filter(Boolean);
}

function paisOcupado(dados, pais) {
    const alvo = normalizar(pais);

    return dados.duplas.some(
        dupla => normalizar(dupla.pais) === alvo
    );
}

function jogadorOcupado(dados, id) {
    return dados.duplas.some(
        dupla =>
            String(dupla.jogador1) === String(id) ||
            String(dupla.jogador2) === String(id)
    );
}

function paisesDisponiveis(dados) {
    const ocupados = new Set(
        dados.duplas.map(dupla => normalizar(dupla.pais))
    );

    return paisesConfigurados().filter(
        pais => !ocupados.has(normalizar(pais))
    );
}

/* ========================================================================
   BUSCA DE DUPLAS
   ======================================================================== */

function buscarDupla(dados, id) {
    return dados.duplas.find(
        dupla => String(dupla.id) === String(id)
    );
}

function buscarDuplaPorPais(dados, pais) {
    const alvo = normalizar(pais);

    return dados.duplas.find(
        dupla => normalizar(dupla.pais) === alvo
    );
}

/* ========================================================================
   DATA / CONTABILIZAÇÃO
   ======================================================================== */

function podeContabilizar() {
    const agora = new Date();

    const ano = agora.getFullYear();
    const mes = agora.getMonth() + 1;
    const dia = agora.getDate();

    /*
     * MODO TESTE
     *
     * Durante o teste, a contabilização fica liberada em:
     * 31/08/2026
     */
    if (
        MODO_TESTE &&
        ano === DATA_TESTE.ano &&
        mes === DATA_TESTE.mes &&
        dia === DATA_TESTE.dia
    ) {
        return true;
    }

    /*
     * REGRA OFICIAL
     *
     * Setembro + dia par.
     */
    return (
        ano === 2026 &&
        mes === MES_OFICIAL &&
        dia % 2 === 0
    );
}

/* ========================================================================
   PESQUISA DE PAÍS
   ======================================================================== */

const pesquisas = new Map();

function criarPesquisa(dados, jogador1, jogador2) {
    const paises = paisesDisponiveis(dados);

    const token =
        `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    pesquisas.set(token, {
        jogador1: String(jogador1),
        jogador2: String(jogador2),
        paises,
        criadoEm: Date.now()
    });

    setTimeout(() => {
        pesquisas.delete(token);
    }, 5 * 60 * 1000);

    return token;
}

function obterPesquisa(token) {
    return pesquisas.get(token);
}

/* ========================================================================
   MENU DE PAÍSES
   ======================================================================== */

function criarMenuPais(token, pagina = 0) {
    const pesquisa = obterPesquisa(token);

    if (!pesquisa) {
        return [];
    }

    const inicio = pagina * 25;
    const lista = pesquisa.paises.slice(
        inicio,
        inicio + 25
    );

    const totalPaginas = Math.max(
        1,
        Math.ceil(pesquisa.paises.length / 25)
    );

    if (!lista.length) {
        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`olymp_buscar_${token}`)
                    .setLabel('Pesquisar país')
                    .setEmoji('🔎')
                    .setStyle(ButtonStyle.Primary)
            )
        ];
    }

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`olymp_pais_${token}_${pagina}`)
        .setPlaceholder('🌎 Escolha um país')
        .addOptions(
            lista.map((pais, indice) => ({
                label: pais.slice(0, 100),
                value: `pais_${inicio + indice}`,
                emoji: '🌎'
            }))
        );

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

    return [
        new ActionRowBuilder().addComponents(menu),
        botoes
    ];
}

/* ========================================================================
   PAINEL PRINCIPAL
   ======================================================================== */

function criarPainel(dados = carregarDados()) {
    const cfg = lerConfig();

    const cargo = cfg.cargoTeg
        ? `<@&${cfg.cargoTeg}>`
        : '@• Olímpico';

    const ranking = rankingPaises(dados);

    let resumoRanking = 'Sem resultados ainda.';

    if (ranking.length) {
        resumoRanking = ranking
            .slice(0, 10)
            .map(
                (item, indice) =>
                    `**${indice + 1}. 🌎 ${limparTexto(item.pais)}** — 🥇 ${item.ouro} • 🥈 ${item.prata} • 🥉 ${item.bronze}`
            )
            .join('\n');
    }

    return new EmbedBuilder()
        .setColor('#D4AF37')
        .setTitle('🏆 OLIMPÍADAS DE DUPLAS')
        .setDescription([
            `**Vencedores: ${cargo}**`,
            '',
            '🌎 **Cada dupla representa um país.**',
            '',
            '📅 **Contabilização:** dias pares de setembro.',
            MODO_TESTE
                ? '🧪 **MODO TESTE: contabilização liberada hoje.**'
                : '',
            '',
            '🥇 Vitória = critério principal',
            '🥈 Prata = peso 3 no desempate',
            '🥉 Bronze = peso 1 no desempate',
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
        .setFooter({
            text: 'WorldWarBR • Olimpíadas de Duplas'
        });
}

function criarBotoes() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('olymp_contabilizar')
            .setLabel('Contabilizar')
            .setEmoji('🏅')
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId('olymp_duplas')
            .setLabel('Ver duplas')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId('olymp_registrar')
            .setLabel('Registrar dupla')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId('olymp_ranking')
            .setLabel('Ranking')
            .setEmoji('🏆')
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId('olymp_guia')
            .setLabel('Guia')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Secondary)
    );
}

/* ========================================================================
   ATUALIZAR PAINEL
   ======================================================================== */

async function atualizarPainel(client) {
    try {
        const dados = carregarDados();
        const cfg = lerConfig();

        if (!cfg.canalPainel) {
            return false;
        }

        const canal = await client.channels
            .fetch(cfg.canalPainel)
            .catch(() => null);

        if (!canal || !canal.isTextBased()) {
            return false;
        }

        let mensagem = null;

        if (dados.painelMensagemId) {
            mensagem = await canal.messages
                .fetch(dados.painelMensagemId)
                .catch(() => null);
        }

        if (mensagem) {
            await mensagem.edit({
                embeds: [criarPainel(dados)],
                components: [criarBotoes()]
            });

            return true;
        }

        mensagem = await canal.send({
            embeds: [criarPainel(dados)],
            components: [criarBotoes()]
        });

        dados.painelMensagemId = mensagem.id;
        salvarDados(dados);

        return true;
    } catch (erro) {
        console.error(
            '[OLIMPIADAS] Erro atualizando painel:',
            erro
        );

        return false;
    }
}

/* ========================================================================
   PUBLICAR PAINEL
   ======================================================================== */

async function painel(interaction) {
    const cfg = lerConfig();

    if (!cfg.canalPainel) {
        return interaction.reply({
            content: '❌ canalPainel não configurado.',
            flags: MessageFlags.Ephemeral
        });
    }

    const canal = await interaction.client.channels
        .fetch(cfg.canalPainel)
        .catch(() => null);

    if (!canal || !canal.isTextBased()) {
        return interaction.reply({
            content: '❌ Canal do painel não encontrado.',
            flags: MessageFlags.Ephemeral
        });
    }

    const dados = carregarDados();

    const mensagem = await canal.send({
        embeds: [criarPainel(dados)],
        components: [criarBotoes()]
    });

    dados.painelMensagemId = mensagem.id;
    salvarDados(dados);

    return interaction.reply({
        content: '✅ Painel das Olimpíadas publicado.',
        flags: MessageFlags.Ephemeral
    });
}

/* ========================================================================
   REGISTRAR DUPLA
   ======================================================================== */

async function registrar(interaction) {
    return interaction.reply({
        content:
            '📝 **REGISTRO DE DUPLA**\n\nSelecione o primeiro integrante.',
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
        return interaction.reply({
            content: '❌ Jogador inválido.',
            flags: MessageFlags.Ephemeral
        });
    }

    const dados = carregarDados();

    if (jogadorOcupado(dados, jogador1)) {
        return interaction.reply({
            content: '❌ Esse jogador já pertence a uma dupla.',
            flags: MessageFlags.Ephemeral
        });
    }

    return interaction.update({
        content:
            '📝 **REGISTRO DE DUPLA**\n\nAgora selecione o segundo integrante.',
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
    const jogador1 = interaction.customId
        .replace('olymp_reg_p2_', '');

    const jogador2 = interaction.values?.[0];

    if (!jogador1 || !jogador2) {
        return interaction.reply({
            content: '❌ Jogadores inválidos.',
            flags: MessageFlags.Ephemeral
        });
    }

    const dados = carregarDados();

    if (jogador1 === jogador2) {
        return interaction.reply({
            content:
                '❌ Os dois integrantes precisam ser diferentes.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (
        jogadorOcupado(dados, jogador1) ||
        jogadorOcupado(dados, jogador2)
    ) {
        return interaction.reply({
            content:
                '❌ Um dos jogadores já pertence a uma dupla registrada.',
            flags: MessageFlags.Ephemeral
        });
    }

    const token = criarPesquisa(
        dados,
        jogador1,
        jogador2
    );

    const pesquisa = obterPesquisa(token);

    if (!pesquisa || !pesquisa.paises.length) {
        pesquisas.delete(token);

        return interaction.reply({
            content:
                '❌ Todos os países disponíveis já foram escolhidos.',
            flags: MessageFlags.Ephemeral
        });
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

/* ========================================================================
   PESQUISAR PAÍS
   ======================================================================== */

async function abrirPesquisa(interaction) {
    const token = interaction.customId
        .replace('olymp_buscar_', '');

    const pesquisa = obterPesquisa(token);

    if (!pesquisa) {
        return interaction.reply({
            content:
                '⌛ Esta pesquisa expirou. Faça o registro novamente.',
            flags: MessageFlags.Ephemeral
        });
    }

    const modal = new ModalBuilder()
        .setCustomId(`olymp_pesquisa_modal_${token}`)
        .setTitle('🔎 Pesquisar país');

    const campo = new TextInputBuilder()
        .setCustomId('termo')
        .setLabel('Digite o nome do país')
        .setPlaceholder('Ex.: Brasil, Colombia, Alemanha')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(50)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(campo)
    );

    return interaction.showModal(modal);
}

async function pesquisarPais(interaction) {
    const token = interaction.customId
        .replace('olymp_pesquisa_modal_', '');

    const pesquisa = obterPesquisa(token);

    if (!pesquisa) {
        return interaction.reply({
            content:
                '⌛ Esta pesquisa expirou. Faça o registro novamente.',
            flags: MessageFlags.Ephemeral
        });
    }

    let termo = '';

    try {
        termo = interaction.fields
            .getTextInputValue('termo')
            .trim();
    } catch (erro) {
        console.error(
            '[OLIMPIADAS] Erro lendo pesquisa:',
            erro
        );

        return interaction.reply({
            content:
                '❌ Não consegui ler o país pesquisado. Tente novamente.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (!termo) {
        return interaction.reply({
            content: '❌ Digite o nome de um país.',
            flags: MessageFlags.Ephemeral
        });
    }

    const dados = carregarDados();

    const resultados = paisesDisponiveis(dados).filter(
        pais =>
            normalizar(pais).includes(
                normalizar(termo)
            )
    );

    if (!resultados.length) {
        return interaction.reply({
            content:
                `❌ Nenhum país encontrado para **${limparTexto(termo)}**.`,
            flags: MessageFlags.Ephemeral
        });
    }

    pesquisa.paises = resultados;

    return interaction.reply({
        content: [
            `🔎 **PAÍSES ENCONTRADOS PARA:** ${limparTexto(termo)}`,
            '',
            '🌎 Clique no país para confirmar imediatamente.'
        ].join('\n'),
        components: criarMenuPais(token, 0),
        flags: MessageFlags.Ephemeral
    });
}

/* ========================================================================
   PAGINAÇÃO
   ======================================================================== */

async function mudarPaginaPais(interaction, direcao) {
    const partes = interaction.customId.split('_');

    const token = partes[2];
    const paginaAtual = Number(partes[3]);

    const pesquisa = obterPesquisa(token);

    if (!pesquisa) {
        return interaction.reply({
            content: '⌛ Pesquisa expirada.',
            flags: MessageFlags.Ephemeral
        });
    }

    const totalPaginas = Math.max(
        1,
        Math.ceil(pesquisa.paises.length / 25)
    );

    const novaPagina = Math.max(
        0,
        Math.min(
            totalPaginas - 1,
            paginaAtual + direcao
        )
    );

    return interaction.update({
        content: [
            '🌎 **ESCOLHA O PAÍS DA DUPLA**',
            '',
            `📋 Página **${novaPagina + 1}/${totalPaginas}**`,
            '',
            '⚡ Ao clicar no país, ele será confirmado imediatamente.'
        ].join('\n'),
        components: criarMenuPais(token, novaPagina)
    });
}

/* ========================================================================
   SELECIONAR PAÍS
   ======================================================================== */

async function selecionarPais(interaction) {
    const partes = interaction.customId.split('_');

    const token = partes[2];

    const pesquisa = obterPesquisa(token);

    if (!pesquisa) {
        return interaction.reply({
            content:
                '⌛ Esta seleção expirou. Faça o registro novamente.',
            flags: MessageFlags.Ephemeral
        });
    }

    const valor = interaction.values?.[0] || '';

    const indice = Number(
        valor.replace('pais_', '')
    );

    if (!Number.isInteger(indice)) {
        return interaction.reply({
            content: '❌ País inválido.',
            flags: MessageFlags.Ephemeral
        });
    }

    const pais = pesquisa.paises[indice];

    if (!pais) {
        return interaction.reply({
            content:
                '❌ País não encontrado. Abra o registro novamente.',
            flags: MessageFlags.Ephemeral
        });
    }

    const dados = carregarDados();

    if (
        jogadorOcupado(dados, pesquisa.jogador1) ||
        jogadorOcupado(dados, pesquisa.jogador2)
    ) {
        pesquisas.delete(token);

        return interaction.reply({
            content:
                '❌ Um dos jogadores já pertence a outra dupla.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (paisOcupado(dados, pais)) {
        pesquisas.delete(token);

        return interaction.reply({
            content:
                '❌ Esse país acabou de ser escolhido por outra dupla.',
            flags: MessageFlags.Ephemeral
        });
    }

    /*
     * CONFIRMAÇÃO IMEDIATA
     */
    const dupla = {
        id:
            `dupla_${Date.now()}_${pesquisa.jogador1}`,
        pais: pais,
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

    /* ---------------------------------------------------------------
       LOG DA NOVA DUPLA
       --------------------------------------------------------------- */

    const cfg = lerConfig();

    if (cfg.canalTeg) {
        const canalTeg = await interaction.client.channels
            .fetch(cfg.canalTeg)
            .catch(() => null);

        if (canalTeg?.isTextBased()) {
            await canalTeg.send({
                content: cfg.cargoTeg
                    ? `<@&${cfg.cargoTeg}>`
                    : undefined,

                embeds: [
                    new EmbedBuilder()
                        .setColor('#D4AF37')
                        .setTitle('📝 NOVA DUPLA REGISTRADA')
                        .setDescription([
                            `🌎 **País:** ${limparTexto(pais)}`,
                            '',
                            `👥 **Jogadores:** <@${pesquisa.jogador1}> + <@${pesquisa.jogador2}>`
                        ].join('\n'))
                        .setTimestamp()
                ]
            }).catch(() => {});
        }
    }

    /* ---------------------------------------------------------------
       ATUALIZA PAINEL
       --------------------------------------------------------------- */

    await atualizarPainel(
        interaction.client
    );

    return interaction.update({
        content: [
            '✅ **DUPLA REGISTRADA COM SUCESSO!**',
            '',
            `🌎 **País:** ${limparTexto(pais)}`,
            '',
            '👥 **Dupla registrada.**',
            '',
            '⚡ O país foi confirmado imediatamente.',
            '🏆 O painel foi atualizado.'
        ].join('\n'),
        components: []
    });
}

/* ========================================================================
   CONTABILIZAÇÃO
   ======================================================================== */

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
            content:
                '❌ É necessário ter pelo menos **3 duplas registradas**.',
            flags: MessageFlags.Ephemeral
        });
    }

    const menu = criarMenuResultado(
        dados,
        'olymp_result_ouro',
        '🥇 Selecione o país vencedor',
        []
    );

    if (!menu) {
        return interaction.reply({
            content:
                '❌ Não existem países suficientes para contabilizar.',
            flags: MessageFlags.Ephemeral
        });
    }

    return interaction.reply({
        content: [
            '🏅 **CONTABILIZAÇÃO DE PARTIDA**',
            '',
            'Selecione:',
            '',
            '🥇 **1º lugar**',
            '🥈 **2º lugar**',
            '🥉 **3º lugar**',
            '',
            '📸 No final será obrigatório enviar o print da vitória.',
            '🚫 Links não são aceitos.'
        ].join('\n'),
        components: [menu],
        flags: MessageFlags.Ephemeral
    });
}

/* ========================================================================
   MENU DE RESULTADO
   ======================================================================== */

function criarMenuResultado(
    dados,
    customId,
    placeholder,
    excluir = []
) {
    const paises = dados.duplas
        .map(dupla => dupla.pais)
        .filter(
            pais =>
                !excluir.some(
                    item =>
                        normalizar(item) ===
                        normalizar(pais)
                )
        );

    if (!paises.length) {
        return null;
    }

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .addOptions(
                paises.slice(0, 25).map(
                    (pais, indice) => ({
                        label: pais.slice(0, 100),
                        value:
                            `resultado_${indice}`,
                        emoji: '🌎'
                    })
                )
            )
    );
}

function obterPaisResultado(
    interaction,
    dados,
    excluir = []
) {
    const paises = dados.duplas
        .map(dupla => dupla.pais)
        .filter(
            pais =>
                !excluir.some(
                    item =>
                        normalizar(item) ===
                        normalizar(pais)
                )
        );

    const valor =
        interaction.values?.[0] || '';

    const indice = Number(
        valor.replace('resultado_', '')
    );

    if (!Number.isInteger(indice)) {
        return null;
    }

    return paises[indice] || null;
}

/* ========================================================================
   OURO
   ======================================================================== */

async function escolherOuro(interaction) {
    const dados = carregarDados();

    const ouro = obterPaisResultado(
        interaction,
        dados
    );

    if (!ouro) {
        return interaction.reply({
            content:
                '❌ País vencedor inválido.',
            flags: MessageFlags.Ephemeral
        });
    }

    const menu = criarMenuResultado(
        dados,
        `olymp_result_prata_${encodeURIComponent(ouro)}`,
        '🥈 Selecione o país em 2º lugar',
        [ouro]
    );

    return interaction.update({
        content: [
            '🏅 **RESULTADO DA PARTIDA**',
            '',
            `🥇 **${limparTexto(ouro)}**`,
            '',
            'Agora selecione o 🥈 segundo lugar.'
        ].join('\n'),
        components: menu ? [menu] : []
    });
}

/* ========================================================================
   PRATA
   ======================================================================== */

async function escolherPrata(interaction) {
    const ouro = decodeURIComponent(
        interaction.customId.replace(
            'olymp_result_prata_',
            ''
        )
    );

    const dados = carregarDados();

    const prata = obterPaisResultado(
        interaction,
        dados,
        [ouro]
    );

    if (!prata) {
        return interaction.reply({
            content:
                '❌ País em 2º lugar inválido.',
            flags: MessageFlags.Ephemeral
        });
    }

    const menu = criarMenuResultado(
        dados,
        `olymp_result_bronze_${encodeURIComponent(ouro)}_${encodeURIComponent(prata)}`,
        '🥉 Selecione o país em 3º lugar',
        [ouro, prata]
    );

    return interaction.update({
        content: [
            '🏅 **RESULTADO DA PARTIDA**',
            '',
            `🥇 **${limparTexto(ouro)}**`,
            `🥈 **${limparTexto(prata)}**`,
            '',
            'Agora selecione o 🥉 terceiro lugar.'
        ].join('\n'),
        components: menu ? [menu] : []
    });
}

/* ========================================================================
   BRONZE + PRINT
   ======================================================================== */

async function escolherBronze(interaction) {
    if (!podeContabilizar()) {
        return interaction.reply({
            content:
                '🚫 A contabilização está fechada.',
            flags: MessageFlags.Ephemeral
        });
    }

    const valor = interaction.customId.replace(
        'olymp_result_bronze_',
        ''
    );

    const separador = valor.lastIndexOf('_');

    if (separador === -1) {
        return interaction.reply({
            content:
                '❌ Dados da partida inválidos.',
            flags: MessageFlags.Ephemeral
        });
    }

    const ouro = decodeURIComponent(
        valor.slice(0, separador)
    );

    const prata = decodeURIComponent(
        valor.slice(separador + 1)
    );

    const dados = carregarDados();

    const bronze = obterPaisResultado(
        interaction,
        dados,
        [ouro, prata]
    );

    if (!bronze) {
        return interaction.reply({
            content:
                '❌ País em 3º lugar inválido.',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.reply({
        content: [
            '📸 **ANEXE O PRINT DA VITÓRIA**',
            '',
            `🥇 ${limparTexto(ouro)}`,
            `🥈 ${limparTexto(prata)}`,
            `🥉 ${limparTexto(bronze)}`,
            '',
            '⚠️ PNG, JPG, JPEG ou WEBP.',
            '🚫 Links não são aceitos.',
            '',
            '⏳ Você tem 2 minutos.'
        ].join('\n'),
        flags: MessageFlags.Ephemeral
    });

    const canal = interaction.channel;

    if (!canal?.isTextBased()) {
        return interaction.followUp({
            content:
                '❌ Não consegui iniciar o recebimento do print.',
            flags: MessageFlags.Ephemeral
        });
    }

    const coletor = canal.createMessageCollector({
        filter: mensagem =>
            mensagem.author.id ===
                interaction.user.id &&
            mensagem.attachments.size > 0,

        time: 120000
    });

    coletor.on(
        'collect',
        async mensagem => {
            const anexo =
                mensagem.attachments.find(
                    arquivo => {
                        const tipo =
                            String(
                                arquivo.contentType ||
                                ''
                            ).toLowerCase();

                        const nome =
                            String(
                                arquivo.name || ''
                            );

                        return (
                            tipo.startsWith(
                                'image/'
                            ) ||
                            /\.(png|jpe?g|webp)$/i.test(
                                nome
                            )
                        );
                    }
                );

            if (!anexo) {
                await mensagem.reply(
                    '❌ Envie PNG, JPG, JPEG ou WEBP.'
                ).catch(() => {});

                return;
            }

            coletor.stop(
                'imagem_recebida'
            );

            await finalizarContabilizacao(
                interaction,
                ouro,
                prata,
                bronze,
                anexo
            );
        }
    );

    coletor.on(
        'end',
        (_, motivo) => {
            if (motivo === 'time') {
                interaction.followUp({
                    content:
                        '⌛ Tempo esgotado. A contabilização foi cancelada.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    );
}

/* ========================================================================
   FINALIZAR CONTABILIZAÇÃO
   ======================================================================== */

async function finalizarContabilizacao(
    interaction,
    ouro,
    prata,
    bronze,
    anexo
) {
    const dados = carregarDados();

    const duplaOuro =
        buscarDuplaPorPais(dados, ouro);

    const duplaPrata =
        buscarDuplaPorPais(dados, prata);

    const duplaBronze =
        buscarDuplaPorPais(dados, bronze);

    if (
        !duplaOuro ||
        !duplaPrata ||
        !duplaBronze
    ) {
        return interaction.followUp({
            content:
                '❌ Uma das duplas selecionadas não foi encontrada.',
            flags: MessageFlags.Ephemeral
        });
    }

    const resultado = {
        id: `resultado_${Date.now()}`,
        data: new Date().toISOString(),

        ouro: duplaOuro.id,
        prata: duplaPrata.id,
        bronze: duplaBronze.id,

        print: anexo.url,
        printNome: anexo.name || null,
        printTipo: anexo.contentType || null,

        registradoPor: interaction.user.id
    };

    /*
     * SALVA A PARTIDA
     */
    dados.resultados.push(resultado);

    /*
     * RECALCULA O RANKING INTEIRO.
     *
     * Isso faz com que as medalhas sejam acumuladas
     * com todas as partidas anteriores.
     */
    dados.ranking = calcularRanking(dados);

    salvarDados(dados);

    /* ---------------------------------------------------------------
       PUBLICAR RESULTADO
       --------------------------------------------------------------- */

    const cfg = lerConfig();

    if (cfg.canalResultados) {
        const canal =
            await interaction.client.channels
                .fetch(
                    cfg.canalResultados
                )
                .catch(() => null);

        if (canal?.isTextBased()) {
            await canal.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#D4AF37')
                        .setTitle(
                            '🏅 RESULTADO — OLIMPÍADAS'
                        )
                        .setDescription([
                            `🥇 **${limparTexto(duplaOuro.pais)}**`,
                            `🥈 **${limparTexto(duplaPrata.pais)}**`,
                            `🥉 **${limparTexto(duplaBronze.pais)}`,
                            '',
                            '🏆 **Medalhas acumuladas no ranking de países.**'
                        ].join('\n'))
                        .setImage(anexo.url)
                        .setTimestamp()
                ]
            }).catch(() => {});
        }
    }

    /*
     * ATUALIZA O PAINEL AUTOMATICAMENTE
     */
    await atualizarPainel(
        interaction.client
    );

    return interaction.followUp({
        content: [
            '✅ **RESULTADO CONTABILIZADO!**',
            '',
            `🥇 ${limparTexto(duplaOuro.pais)}`,
            `🥈 ${limparTexto(duplaPrata.pais)}`,
            `🥉 ${limparTexto(duplaBronze.pais)}`,
            '',
            '💾 Resultado salvo permanentemente.',
            '🏆 Ranking de países atualizado.',
            '🔄 Painel atualizado.'
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
        const colocacoes = [
            [resultado.ouro, 'ouro'],
            [resultado.prata, 'prata'],
            [resultado.bronze, 'bronze']
        ];

        for (const [id, medalha] of colocacoes) {
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

            if (medalha === 'ouro') {
                ranking[id].ouro++;
                ranking[id].vitorias++;
            }

            if (medalha === 'prata') {
                ranking[id].prata++;
                ranking[id].desempate += 3;
            }

            if (medalha === 'bronze') {
                ranking[id].bronze++;
                ranking[id].desempate += 1;
            }
        }
    }

    return ranking;
}

/* ========================================================================
   RANKING DE PAÍSES
   ======================================================================== */

function rankingPaises(dados) {
    const ranking = {};

    for (const resultado of dados.resultados) {
        const colocacoes = [
            [resultado.ouro, 'ouro'],
            [resultado.prata, 'prata'],
            [resultado.bronze, 'bronze']
        ];

        for (const [id, medalha] of colocacoes) {
            const dupla =
                buscarDupla(dados, id);

            if (!dupla) continue;

            const chave =
                normalizar(dupla.pais);

            if (!ranking[chave]) {
                ranking[chave] = {
                    pais: dupla.pais,
                    ouro: 0,
                    prata: 0,
                    bronze: 0,
                    total: 0
                };
            }

            ranking[chave][medalha]++;
            ranking[chave].total++;
        }
    }

    return Object.values(ranking)
        .sort(
            (a, b) =>
                b.ouro - a.ouro ||
                b.prata - a.prata ||
                b.bronze - a.bronze
        );
}

/* ========================================================================
   VER DUPLAS
   ======================================================================== */

async function verDuplas(interaction) {
    const dados = carregarDados();

    if (!dados.duplas.length) {
        return interaction.reply({
            content:
                '👥 Nenhuma dupla registrada ainda.',
            flags: MessageFlags.Ephemeral
        });
    }

    const texto = dados.duplas
        .slice(0, 25)
        .map(
            (dupla, indice) =>
                `**${indice + 1}. 🌎 ${limparTexto(dupla.pais)}**\n👥 <@${dupla.jogador1}> + <@${dupla.jogador2}>`
        )
        .join('\n\n');

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle(
                    '👥 DUPLAS DAS OLIMPÍADAS'
                )
                .setDescription(texto)
        ],
        flags: MessageFlags.Ephemeral
    });
}

/* ========================================================================
   RANKING — SOMENTE PAÍSES
   ======================================================================== */

async function verRanking(interaction) {
    const dados = carregarDados();

    const ranking =
        rankingPaises(dados);

    if (!ranking.length) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor('#D4AF37')
                    .setTitle(
                        '🏆 RANKING — OLIMPÍADAS'
                    )
                    .setDescription(
                        '🌎 **PAÍSES**\n\nSem medalhas ainda.'
                    )
            ],
            flags: MessageFlags.Ephemeral
        });
    }

    const texto = ranking
        .slice(0, 25)
        .map(
            (item, indice) =>
                [
                    `**${indice + 1}. 🌎 ${limparTexto(item.pais)}**`,
                    `🥇 ${item.ouro} • 🥈 ${item.prata} • 🥉 ${item.bronze}`,
                    `🏅 Total: ${item.total}`
                ].join(' ')
        )
        .join('\n\n');

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle(
                    '🏆 RANKING — OLIMPÍADAS DE DUPLAS'
                )
                .setDescription([
                    '🌎 **PAÍSES**',
                    '',
                    texto,
                    '',
                    '━━━━━━━━━━━━━━━━━━━━',
                    '',
                    '🥇 Ouro • 🥈 Prata • 🥉 Bronze'
                ].join('\n'))
                .setFooter({
                    text:
                        'Ranking acumulado de todas as partidas'
                })
        ],
        flags: MessageFlags.Ephemeral
    });
}

/* ========================================================================
   GUIA
   ======================================================================== */

async function guia(interaction) {
    const cfg = lerConfig();

    const cargo = cfg.cargoTeg
        ? `<@&${cfg.cargoTeg}>`
        : '@• Olímpico';

    const texto = [
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
        '',
        '🏆 O ranking mostra somente os países.',
        '',
        '📊 As medalhas são acumuladas de todas as partidas.',
        '',
        '⚡ Ao escolher um país no registro, ele é confirmado imediatamente.',
        '',
        '🔎 É possível pesquisar o país pelo nome.',
        'Exemplo: escrever **Colombia** encontra **Colômbia**.',
        '',
        '📸 Na contabilização é obrigatório enviar o print.',
        '',
        '🚫 Links não são aceitos.',
        '',
        '📅 Regra oficial: dias pares de setembro.',
        MODO_TESTE
            ? '🧪 **Teste ativo: contabilização liberada em 31/08/2026.**'
            : '',
        '',
        '⚠️ As Olimpíadas terão apenas DOIS vencedores!'
    ].filter(Boolean).join('\n');

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle(
                    '📖 GUIA — OLIMPÍADAS'
                )
                .setDescription(texto)
        ],
        flags: MessageFlags.Ephemeral
    });
}

/* ========================================================================
   ROTEADOR
   ======================================================================== */

async function handle(interaction) {
    const id =
        interaction.customId || '';

    /*
     * MODAL DE PESQUISA
     *
     * IMPORTANTE:
     * O index.js precisa chamar handle() também
     * quando for ModalSubmit das Olimpíadas.
     */
    if (
        interaction.isModalSubmit?.() &&
        id.startsWith(
            'olymp_pesquisa_modal_'
        )
    ) {
        return pesquisarPais(
            interaction
        );
    }

    if (
        interaction.isButton?.() ||
        interaction.isStringSelectMenu?.() ||
        interaction.isUserSelectMenu?.()
    ) {
        if (id === 'olymp_contabilizar') {
            return contabilizar(
                interaction
            );
        }

        if (id === 'olymp_duplas') {
            return verDuplas(
                interaction
            );
        }

        if (id === 'olymp_registrar') {
            return registrar(
                interaction
            );
        }

        if (id === 'olymp_ranking') {
            return verRanking(
                interaction
            );
        }

        if (id === 'olymp_guia') {
            return guia(
                interaction
            );
        }

        if (id === 'olymp_reg_p1') {
            return registrarJogador1(
                interaction
            );
        }

        if (
            id.startsWith(
                'olymp_reg_p2_'
            )
        ) {
            return registrarJogador2(
                interaction
            );
        }

        if (
            id.startsWith(
                'olymp_buscar_'
            )
        ) {
            return abrirPesquisa(
                interaction
            );
        }

        if (
            id.startsWith(
                'olymp_prev_'
            )
        ) {
            return mudarPaginaPais(
                interaction,
                -1
            );
        }

        if (
            id.startsWith(
                'olymp_next_'
            )
        ) {
            return mudarPaginaPais(
                interaction,
                1
            );
        }

        if (
            id.startsWith(
                'olymp_pais_'
            )
        ) {
            return selecionarPais(
                interaction
            );
        }

        if (
            id ===
            'olymp_result_ouro'
        ) {
            return escolherOuro(
                interaction
            );
        }

        if (
            id.startsWith(
                'olymp_result_prata_'
            )
        ) {
            return escolherPrata(
                interaction
            );
        }

        if (
            id.startsWith(
                'olymp_result_bronze_'
            )
        ) {
            return escolherBronze(
                interaction
            );
        }
    }

    return false;
}

/* ========================================================================
   EXPORTS
   ======================================================================== */

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