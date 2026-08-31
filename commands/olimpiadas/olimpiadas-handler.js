/* ========================================================================
   ARQUIVO: commands/olimpiadas/olimpiadas-handler.js

   SISTEMA: OLIMPÍADAS DE DUPLAS

   O QUE ESTE ARQUIVO FAZ:
   - Registra duplas.
   - Permite escolher país por lista.
   - Permite pesquisar o país digitando o nome.
   - Aceita pesquisa sem acento: Colombia -> Colômbia.
   - Impede país repetido.
   - Impede jogador em duas duplas.
   - Contabiliza partidas somente nos dias pares de setembro/2026.
   - Exige print anexado da vitória.
   - Salva resultados em olimpiadas.json.
   - Calcula ranking de duplas, países e competidores.

   IMPORTANTE:
   O nome da dupla NÃO é cadastrado. A dupla é identificada pelos
   dois jogadores + país escolhido.
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


// ========================================================================
// ARQUIVO DE DADOS
// ========================================================================

const ARQUIVO_DADOS = path.join(
    __dirname,
    'olimpiadas.json'
);


// ========================================================================
// LEITURA / ESCRITA
// ========================================================================

function carregarConfig() {

    const dados = JSON.parse(
        fs.readFileSync(
            ARQUIVO_DADOS,
            'utf8'
        )
    );

    dados.paises = Array.isArray(dados.paises)
        ? dados.paises
        : [];

    dados.duplas = Array.isArray(dados.duplas)
        ? dados.duplas
        : [];

    dados.resultados = Array.isArray(dados.resultados)
        ? dados.resultados
        : [];

    dados.ranking = dados.ranking && typeof dados.ranking === 'object'
        ? dados.ranking
        : {};

    return dados;
}


function salvarDados(dados) {

    fs.writeFileSync(
        ARQUIVO_DADOS,
        JSON.stringify(
            dados,
            null,
            2
        ),
        'utf8'
    );
}


function limparTexto(valor) {

    return String(valor ?? '')
        .replace(/[\\`*_~|]/g, '');
}


// ========================================================================
// NORMALIZAÇÃO
// ========================================================================
// Exemplo:
// "Colômbia" -> "colombia"
// "COLOMBIA" -> "colombia"
// Assim a pesquisa funciona com ou sem acento.
// ========================================================================

function normalizar(valor) {

    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}


function paisOcupado(dados, pais) {

    return dados.duplas.some(
        dupla =>
            normalizar(dupla.pais) === normalizar(pais)
    );
}


function jogadorOcupado(dados, jogadorId) {

    return dados.duplas.some(
        dupla =>
            dupla.jogador1 === jogadorId ||
            dupla.jogador2 === jogadorId
    );
}


function buscarDupla(dados, id) {

    return dados.duplas.find(
        dupla => dupla.id === id
    );
}


function buscarDuplaPorPais(dados, pais) {

    return dados.duplas.find(
        dupla =>
            normalizar(dupla.pais) === normalizar(pais)
    );
}


function paisesDisponiveis(dados) {

    const usados = new Set(
        dados.duplas.map(
            dupla => normalizar(dupla.pais)
        )
    );

    return dados.paises.filter(
        pais => !usados.has(normalizar(pais))
    );
}


// ========================================================================
// CONTABILIZAÇÃO
// ========================================================================
// Registro pode ser feito qualquer dia.
// Contabilização só funciona em dia PAR de setembro de 2026.
// ========================================================================

function podeContabilizar() {

    const agora = new Date();
    const cfg = carregarConfig();

    return agora.getFullYear() === Number(cfg.ano) &&
        agora.getMonth() + 1 === Number(cfg.mes) &&
        agora.getDate() % 2 === 0;
}


// ========================================================================
// PESQUISAS DE PAÍS
// ========================================================================
// Cada registro recebe um token temporário.
// Isso permite que vários jogadores façam registros ao mesmo tempo.
// ========================================================================

const pesquisas = new Map();


function criarPesquisa(dados, jogador1, jogador2) {

    const token =
        `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    pesquisas.set(
        token,
        {
            jogador1,
            jogador2,
            paises: paisesDisponiveis(dados),
            criadoEm: Date.now()
        }
    );

    const timer = setTimeout(
        () => pesquisas.delete(token),
        10 * 60 * 1000
    );

    timer.unref?.();

    return token;
}


function criarMenuPaises(token, pagina = 0) {

    const pesquisa = pesquisas.get(token);

    if (!pesquisa) {
        return [];
    }

    const totalPaginas = Math.max(
        1,
        Math.ceil(
            pesquisa.paises.length / 25
        )
    );

    const paginaSegura = Math.max(
        0,
        Math.min(
            pagina,
            totalPaginas - 1
        )
    );

    const inicio = paginaSegura * 25;

    const paises = pesquisa.paises.slice(
        inicio,
        inicio + 25
    );

    const menu = new StringSelectMenuBuilder()
        .setCustomId(
            `olymp_pais_${token}_${paginaSegura}`
        )
        .setPlaceholder(
            '🌎 Escolha um país da lista'
        )
        .addOptions(
            paises.map(
                (pais, indice) => ({
                    label: pais.slice(0, 100),
                    value: `pais_${inicio + indice}`,
                    description: 'Representar este país',
                    emoji: '🌎'
                })
            )
        );

    const botoes = new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()
                .setCustomId(
                    `olymp_buscar_${token}`
                )
                .setLabel('Pesquisar país')
                .setEmoji('🔎')
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId(
                    `olymp_prev_${token}_${paginaSegura}`
                )
                .setLabel('Anterior')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(paginaSegura === 0),

            new ButtonBuilder()
                .setCustomId(
                    `olymp_pag_${token}`
                )
                .setLabel(
                    `Página ${paginaSegura + 1}/${totalPaginas}`
                )
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),

            new ButtonBuilder()
                .setCustomId(
                    `olymp_next_${token}_${paginaSegura}`
                )
                .setLabel('Próxima')
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(
                    paginaSegura >= totalPaginas - 1
                )
        );

    return [
        new ActionRowBuilder().addComponents(menu),
        botoes
    ];
}


// ========================================================================
// MENU DE RESULTADOS
// ========================================================================

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
                    outro =>
                        normalizar(outro) === normalizar(pais)
                )
        );

    if (!paises.length) {
        return null;
    }

    return new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(customId)
                .setPlaceholder(placeholder)
                .addOptions(
                    paises
                        .slice(0, 25)
                        .map(
                            (pais, indice) => ({
                                label: pais.slice(0, 100),
                                value: `resultado_${indice}`,
                                emoji: '🌎'
                            })
                        )
                )
        );
}


function paisSelecionado(
    interaction,
    dados,
    excluir = []
) {

    const paises = dados.duplas
        .map(dupla => dupla.pais)
        .filter(
            pais =>
                !excluir.some(
                    outro =>
                        normalizar(outro) === normalizar(pais)
                )
        );

    const valor = interaction.values?.[0] || '';

    const indice = Number(
        valor.replace('resultado_', '')
    );

    return Number.isInteger(indice)
        ? paises[indice] || null
        : null;
}


// ========================================================================
// PAINEL
// ========================================================================

function criarPainel(
    dados = carregarConfig()
) {

    const cargo = dados.cargoTeg
        ? `<@&${dados.cargoTeg}>`
        : '@• Olímpico';

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
        .setImage(dados.imagem)
        .setFooter({
            text: 'WorldWarBR • Olimpíadas de Duplas'
        });
}


function criarBotoes() {

    return new ActionRowBuilder()
        .addComponents(

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


async function painel(interaction) {

    const cfg = carregarConfig();

    const canal = await interaction.client.channels
        .fetch(cfg.canalPainel)
        .catch(() => null);

    if (!canal?.isTextBased()) {

        return interaction.reply({
            content: '❌ Canal do painel das Olimpíadas não encontrado.',
            flags: MessageFlags.Ephemeral
        });
    }

    await canal.send({
        embeds: [criarPainel()],
        components: [criarBotoes()]
    });

    return interaction.reply({
        content: '✅ Painel publicado.',
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// REGISTRO — JOGADOR 1
// ========================================================================

async function registrar(interaction) {

    return interaction.reply({
        content: [
            '📝 **REGISTRO DE DUPLA**',
            '',
            'Selecione o **primeiro integrante**.'
        ].join('\n'),
        components: [
            new ActionRowBuilder()
                .addComponents(
                    new UserSelectMenuBuilder()
                        .setCustomId('olymp_reg_p1')
                        .setPlaceholder('👤 Selecionar jogador 1')
                )
        ],
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// REGISTRO — JOGADOR 2
// ========================================================================

async function registrarJogador1(interaction) {

    const jogador1 = interaction.values?.[0];

    if (!jogador1) {
        return interaction.reply({
            content: '❌ Nenhum jogador foi selecionado.',
            flags: MessageFlags.Ephemeral
        });
    }

    const dados = carregarConfig();

    if (jogadorOcupado(dados, jogador1)) {

        return interaction.reply({
            content: '❌ Esse jogador já pertence a uma dupla.',
            flags: MessageFlags.Ephemeral
        });
    }

    return interaction.update({
        content: [
            '📝 **REGISTRO DE DUPLA**',
            '',
            'Agora selecione o **segundo integrante**.'
        ].join('\n'),
        components: [
            new ActionRowBuilder()
                .addComponents(
                    new UserSelectMenuBuilder()
                        .setCustomId(
                            `olymp_reg_p2_${jogador1}`
                        )
                        .setPlaceholder('👤 Selecionar jogador 2')
                )
        ]
    });
}


async function registrarJogador2(interaction) {

    const jogador1 = interaction.customId
        .replace('olymp_reg_p2_', '');

    const jogador2 = interaction.values?.[0];

    if (!jogador2) {
        return interaction.reply({
            content: '❌ Nenhum jogador foi selecionado.',
            flags: MessageFlags.Ephemeral
        });
    }

    const dados = carregarConfig();

    if (jogador1 === jogador2) {

        return interaction.reply({
            content: '❌ Os dois integrantes precisam ser diferentes.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (
        jogadorOcupado(dados, jogador1) ||
        jogadorOcupado(dados, jogador2)
    ) {

        return interaction.reply({
            content: '❌ Um dos jogadores já pertence a outra dupla.',
            flags: MessageFlags.Ephemeral
        });
    }

    const token = criarPesquisa(
        dados,
        jogador1,
        jogador2
    );

    const pesquisa = pesquisas.get(token);

    if (!pesquisa?.paises.length) {

        pesquisas.delete(token);

        return interaction.reply({
            content: '❌ Todos os países disponíveis já foram escolhidos.',
            flags: MessageFlags.Ephemeral
        });
    }

    return interaction.update({
        content: [
            '🌎 **ESCOLHA O PAÍS**',
            '',
            `**${pesquisa.paises.length} países disponíveis.**`,
            '',
            '📋 Escolha um país na lista.',
            '🔎 Se não encontrar, clique em **Pesquisar país** e digite o nome.'
        ].join('\n'),
        components: criarMenuPaises(token, 0)
    });
}


// ========================================================================
// PESQUISA — ABRIR CAIXA
// ========================================================================

async function abrirPesquisa(interaction) {

    const token = interaction.customId
        .replace('olymp_buscar_', '');

    if (!pesquisas.has(token)) {

        return interaction.reply({
            content: '⌛ Esta pesquisa expirou. Faça o registro novamente.',
            flags: MessageFlags.Ephemeral
        });
    }

    const modal = new ModalBuilder()
        .setCustomId(
            `olymp_pesquisa_modal_${token}`
        )
        .setTitle('Pesquisar país');

    const campo = new TextInputBuilder()
        .setCustomId('termo_pais')
        .setLabel('Digite o nome do país')
        .setPlaceholder('Ex.: Colombia, Brasil, Alemanha')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(50)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(campo)
    );

    return interaction.showModal(modal);
}


// ========================================================================
// PESQUISA — PROCESSAR TEXTO
// ========================================================================
// ESTA É A PARTE QUE FOI REFORÇADA.
// O modal agora usa um ID próprio para o campo e o processamento é feito
// com deferReply/editReply para garantir que o Discord receba a resposta
// dentro do tempo da interação.
// ========================================================================

async function pesquisarPais(interaction) {

    const token = interaction.customId
        .replace('olymp_pesquisa_modal_', '');

    const pesquisa = pesquisas.get(token);

    if (!pesquisa) {

        return interaction.reply({
            content: '⌛ Esta pesquisa expirou. Faça o registro novamente.',
            flags: MessageFlags.Ephemeral
        });
    }

    try {

        const termo = interaction.fields
            .getTextInputValue('termo_pais')
            .trim();

        if (!termo) {

            return interaction.reply({
                content: '❌ Digite o nome de um país.',
                flags: MessageFlags.Ephemeral
            });
        }

        const dados = carregarConfig();
        const disponiveis = paisesDisponiveis(dados);
        const busca = normalizar(termo);

        const encontrados = disponiveis.filter(
            pais => normalizar(pais).includes(busca)
        );

        if (!encontrados.length) {

            return interaction.reply({
                content: [
                    `❌ Nenhum país disponível encontrado para **${limparTexto(termo)}**.`,
                    '',
                    '💡 Tente escrever apenas uma parte do nome.',
                    'Exemplo: **colom** encontra **Colômbia**.'
                ].join('\n'),
                flags: MessageFlags.Ephemeral
            });
        }

        // Atualiza somente os países desta pesquisa.
        pesquisa.paises = encontrados;

        const componentes = criarMenuPaises(
            token,
            0
        );

        if (!componentes.length) {

            return interaction.reply({
                content: '❌ Não foi possível montar a lista de países.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Modal precisa receber uma resposta própria.
        // Defer + edit evita o erro de interação expirada.
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        return interaction.editReply({
            content: [
                `🔎 **PAÍS ENCONTRADO: ${limparTexto(termo)}**`,
                '',
                `Encontramos **${encontrados.length}** opção(ões).`,
                '',
                '🌎 Selecione o país abaixo.'
            ].join('\n'),
            components: componentes
        });

    } catch (erro) {

        console.error(
            '[OLIMPIADAS] Erro ao pesquisar país:',
            erro
        );

        if (
            !interaction.replied &&
            !interaction.deferred
        ) {

            return interaction.reply({
                content: '❌ Falha ao pesquisar o país. Tente novamente.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        return interaction.editReply({
            content: '❌ Falha ao pesquisar o país. Tente novamente.',
            components: []
        }).catch(() => {});
    }
}


// ========================================================================
// PAGINAÇÃO
// ========================================================================

async function mudarPaginaPais(
    interaction,
    direcao
) {

    const partes = interaction.customId.split('_');
    const token = partes[2];
    const paginaAtual = Number(partes[3]);

    const pesquisa = pesquisas.get(token);

    if (!pesquisa) {

        return interaction.reply({
            content: '⌛ Pesquisa expirada. Faça o registro novamente.',
            flags: MessageFlags.Ephemeral
        });
    }

    const total = Math.max(
        1,
        Math.ceil(
            pesquisa.paises.length / 25
        )
    );

    const novaPagina = Math.max(
        0,
        Math.min(
            total - 1,
            paginaAtual + direcao
        )
    );

    return interaction.update({
        content: [
            '🌎 **PAÍSES DISPONÍVEIS**',
            '',
            `Página **${novaPagina + 1}/${total}**`
        ].join('\n'),
        components: criarMenuPaises(
            token,
            novaPagina
        )
    });
}


// ========================================================================
// SELECIONAR PAÍS
// ========================================================================

async function selecionarPais(interaction) {

    const partes = interaction.customId.split('_');
    const token = partes[2];

    const pesquisa = pesquisas.get(token);

    if (!pesquisa) {

        return interaction.reply({
            content: '⌛ Pesquisa expirada. Faça o registro novamente.',
            flags: MessageFlags.Ephemeral
        });
    }

    const valor = interaction.values?.[0] || '';
    const indice = Number(
        valor.replace('pais_', '')
    );

    const pais = pesquisa.paises[indice];

    if (!pais) {

        return interaction.reply({
            content: '❌ País inválido. Abra o registro novamente.',
            flags: MessageFlags.Ephemeral
        });
    }

    const dados = carregarConfig();

    if (
        jogadorOcupado(dados, pesquisa.jogador1) ||
        jogadorOcupado(dados, pesquisa.jogador2)
    ) {

        pesquisas.delete(token);

        return interaction.reply({
            content: '❌ Um dos jogadores já pertence a outra dupla.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (paisOcupado(dados, pais)) {

        pesquisas.delete(token);

        return interaction.reply({
            content: '❌ Esse país acabou de ser escolhido por outra dupla.',
            flags: MessageFlags.Ephemeral
        });
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

    const cfg = carregarConfig();
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
                        `👥 **Jogadores:** <@${pesquisa.jogador1}> + <@${pesquisa.jogador2}>`
                    ].join('\n'))
                    .setTimestamp()
            ]
        });
    }

    return interaction.update({
        content: [
            '✅ **DUPLA REGISTRADA COM SUCESSO!**',
            '',
            `🌎 **País:** ${limparTexto(pais)}`,
            `👥 **Jogadores:** <@${pesquisa.jogador1}> + <@${pesquisa.jogador2}>`,
            '',
            '📋 A dupla já está disponível em **👥 Ver duplas**.'
        ].join('\n'),
        components: []
    });
}


// ========================================================================
// CONTABILIZAÇÃO — INÍCIO
// ========================================================================

async function contabilizar(interaction) {

    if (!podeContabilizar()) {

        return interaction.reply({
            content: [
                '🚫 **A contabilização só pode ser feita nos dias pares de setembro de 2026.**',
                '',
                '📝 O registro de duplas pode ser feito qualquer dia.'
            ].join('\n'),
            flags: MessageFlags.Ephemeral
        });
    }

    const dados = carregarConfig();

    if (dados.duplas.length < 3) {

        return interaction.reply({
            content: '❌ É necessário ter pelo menos 3 duplas registradas.',
            flags: MessageFlags.Ephemeral
        });
    }

    const menu = criarMenuResultado(
        dados,
        'olymp_result_ouro',
        '🥇 Selecione o país vencedor'
    );

    if (!menu) {

        return interaction.reply({
            content: '❌ Não há países registrados para contabilizar.',
            flags: MessageFlags.Ephemeral
        });
    }

    return interaction.reply({
        content: [
            '🏅 **CONTABILIZAÇÃO DE PARTIDA**',
            '',
            'Selecione:',
            '🥇 vencedor',
            '🥈 segundo lugar',
            '🥉 terceiro lugar',
            '',
            '📸 No final será obrigatório enviar o **print anexado** da vitória.',
            '🚫 Links não são aceitos.'
        ].join('\n'),
        components: [menu],
        flags: MessageFlags.Ephemeral
    });
}


async function escolherOuro(interaction) {

    const dados = carregarConfig();
    const ouro = paisSelecionado(
        interaction,
        dados
    );

    if (!ouro) {

        return interaction.reply({
            content: '❌ País vencedor inválido.',
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
            `🥇 **${limparTexto(ouro)}**`,
            '',
            'Agora escolha o 🥈 **segundo lugar**.'
        ].join('\n'),
        components: menu ? [menu] : []
    });
}


async function escolherPrata(interaction) {

    const ouro = decodeURIComponent(
        interaction.customId.replace(
            'olymp_result_prata_',
            ''
        )
    );

    const dados = carregarConfig();

    const prata = paisSelecionado(
        interaction,
        dados,
        [ouro]
    );

    if (!prata) {

        return interaction.reply({
            content: '❌ País em 2º lugar inválido.',
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
            `🥇 **${limparTexto(ouro)}**`,
            `🥈 **${limparTexto(prata)}**`,
            '',
            'Agora escolha o 🥉 **terceiro lugar**.'
        ].join('\n'),
        components: menu ? [menu] : []
    });
}


async function escolherBronze(interaction) {

    if (!podeContabilizar()) {

        return interaction.reply({
            content: '🚫 A contabilização só pode ser feita nos dias pares de setembro de 2026.',
            flags: MessageFlags.Ephemeral
        });
    }

    const valor = interaction.customId.replace(
        'olymp_result_bronze_',
        ''
    );

    const separador = valor.lastIndexOf('_');

    const ouro = decodeURIComponent(
        valor.slice(0, separador)
    );

    const prata = decodeURIComponent(
        valor.slice(separador + 1)
    );

    const dados = carregarConfig();

    const bronze = paisSelecionado(
        interaction,
        dados,
        [ouro, prata]
    );

    if (!bronze) {

        return interaction.reply({
            content: '❌ País em 3º lugar inválido.',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.reply({
        content: [
            '📸 **ANEXE AGORA O PRINT DA VITÓRIA**',
            '',
            `🥇 ${limparTexto(ouro)}`,
            `🥈 ${limparTexto(prata)}`,
            `🥉 ${limparTexto(bronze)}`,
            '',
            '⚠️ Somente PNG, JPG, JPEG ou WEBP.',
            '🚫 Links não são aceitos.',
            '⏳ Você tem 2 minutos.'
        ].join('\n'),
        flags: MessageFlags.Ephemeral
    });

    const coletor = interaction.channel.createMessageCollector({
        filter: mensagem =>
            mensagem.author.id === interaction.user.id &&
            mensagem.attachments.size > 0,
        time: 120000
    });

    coletor.on('collect', async mensagem => {

        const anexo = mensagem.attachments.find(
            arquivo =>
                (arquivo.contentType || '')
                    .toLowerCase()
                    .startsWith('image/') ||
                /\.(png|jpe?g|webp)$/i.test(
                    arquivo.name || ''
                )
        );

        if (!anexo) {

            await mensagem.reply(
                '❌ Envie uma imagem PNG, JPG, JPEG ou WEBP.'
            ).catch(() => {});

            return;
        }

        coletor.stop('imagem_recebida');

        await finalizarContabilizacao(
            interaction,
            ouro,
            prata,
            bronze,
            anexo
        );
    });

    coletor.on('end', (_, motivo) => {

        if (motivo === 'time') {

            interaction.followUp({
                content: '⌛ Tempo esgotado. A contabilização foi cancelada.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    });
}


// ========================================================================
// SALVAR RESULTADO
// ========================================================================

async function finalizarContabilizacao(
    interaction,
    ouro,
    prata,
    bronze,
    anexo
) {

    const dados = carregarConfig();

    const duplaOuro = buscarDuplaPorPais(
        dados,
        ouro
    );

    const duplaPrata = buscarDuplaPorPais(
        dados,
        prata
    );

    const duplaBronze = buscarDuplaPorPais(
        dados,
        bronze
    );

    if (!duplaOuro || !duplaPrata || !duplaBronze) {

        return interaction.followUp({
            content: '❌ Uma das duplas selecionadas não foi encontrada.',
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
        printNome: anexo.name,
        printTipo: anexo.contentType || 'image/*',
        registradoPor: interaction.user.id
    };

    dados.resultados.push(resultado);
    dados.ranking = calcularRanking(dados);

    salvarDados(dados);

    const cfg = carregarConfig();

    const canal = await interaction.client.channels
        .fetch(cfg.canalResultados)
        .catch(() => null);

    if (canal?.isTextBased()) {

        await canal.send({
            embeds: [
                new EmbedBuilder()
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
                    .setTimestamp()
            ]
        });
    }

    return interaction.followUp({
        content: [
            '✅ **Resultado contabilizado!**',
            '📸 Print salvo/publicado.',
            '💾 Ranking atualizado permanentemente.'
        ].join('\n'),
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// RANKING
// ========================================================================

function calcularRanking(dados) {

    const ranking = {};

    for (const resultado of dados.resultados) {

        for (const [id, colocacao] of [
            [resultado.ouro, 'ouro'],
            [resultado.prata, 'prata'],
            [resultado.bronze, 'bronze']
        ]) {

            if (!ranking[id]) {

                ranking[id] = {
                    vitorias: 0,
                    prata: 0,
                    bronze: 0,
                    desempate: 0
                };
            }

            if (colocacao === 'ouro') {
                ranking[id].vitorias++;
            }

            if (colocacao === 'prata') {
                ranking[id].prata++;
                ranking[id].desempate += 3;
            }

            if (colocacao === 'bronze') {
                ranking[id].bronze++;
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

            const dupla = buscarDupla(
                dados,
                id
            );

            if (!dupla) continue;

            ranking[dupla.pais] ??= {
                ouro: 0,
                prata: 0,
                bronze: 0,
                total: 0
            };

            ranking[dupla.pais][medalha]++;
            ranking[dupla.pais].total++;
        }
    }

    return Object.entries(ranking)
        .map(([pais, valores]) => ({
            pais,
            ...valores
        }))
        .sort(
            (a, b) =>
                b.ouro - a.ouro ||
                b.prata - a.prata ||
                b.bronze - a.bronze
        );
}


function rankingCompetidores(dados) {

    const ranking = {};

    for (const resultado of dados.resultados) {

        for (const [id, medalha] of [
            [resultado.ouro, 'ouro'],
            [resultado.prata, 'prata'],
            [resultado.bronze, 'bronze']
        ]) {

            const dupla = buscarDupla(
                dados,
                id
            );

            if (!dupla) continue;

            for (const jogador of [
                dupla.jogador1,
                dupla.jogador2
            ]) {

                ranking[jogador] ??= {
                    ouro: 0,
                    prata: 0,
                    bronze: 0,
                    total: 0
                };

                ranking[jogador][medalha]++;
                ranking[jogador].total++;
            }
        }
    }

    return Object.entries(ranking)
        .map(([id, valores]) => ({
            id,
            ...valores
        }))
        .sort(
            (a, b) =>
                b.ouro - a.ouro ||
                b.prata - a.prata ||
                b.bronze - a.bronze
        );
}


// ========================================================================
// VER DUPLAS
// ========================================================================

async function verDuplas(interaction) {

    const dados = carregarConfig();

    if (!dados.duplas.length) {

        return interaction.reply({
            content: '👥 Nenhuma dupla registrada ainda.',
            flags: MessageFlags.Ephemeral
        });
    }

    const texto = dados.duplas
        .slice(0, 20)
        .map(
            (dupla, indice) =>
                [
                    `**${indice + 1}. 🌎 ${limparTexto(dupla.pais)}**`,
                    `👥 <@${dupla.jogador1}> + <@${dupla.jogador2}>`
                ].join('\n')
        )
        .join('\n\n');

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('👥 DUPLAS DAS OLIMPÍADAS')
                .setDescription(texto)
        ],
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// RANKING VISUAL
// ========================================================================

async function verRanking(interaction) {

    const dados = carregarConfig();
    const ranking = calcularRanking(dados);
    const paises = rankingPaises(dados);
    const competidores = rankingCompetidores(dados);

    const duplasTexto = Object.entries(ranking)
        .map(([id, valores]) => ({
            dupla: buscarDupla(dados, id),
            ...valores
        }))
        .filter(item => item.dupla)
        .sort(
            (a, b) =>
                b.vitorias - a.vitorias ||
                b.desempate - a.desempate
        )
        .slice(0, 10)
        .map(
            (item, indice) =>
                `**${indice + 1}. ${limparTexto(item.dupla.pais)}** — 🥇 ${item.vitorias} • 🥈 ${item.prata} • 🥉 ${item.bronze}`
        )
        .join('\n') || 'Sem resultados.';

    const paisesTexto = paises
        .slice(0, 10)
        .map(
            (item, indice) =>
                `**${indice + 1}. ${limparTexto(item.pais)}** — 🥇 ${item.ouro} • 🥈 ${item.prata} • 🥉 ${item.bronze}`
        )
        .join('\n') || 'Sem medalhas.';

    const competidoresTexto = competidores
        .slice(0, 10)
        .map(
            (item, indice) =>
                `**${indice + 1}. <@${item.id}>** — 🥇 ${item.ouro} • 🥈 ${item.prata} • 🥉 ${item.bronze}`
        )
        .join('\n') || 'Sem medalhas.';

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('🏆 RANKING — OLIMPÍADAS DE DUPLAS')
                .addFields(
                    {
                        name: '👥 DUPLAS',
                        value: duplasTexto,
                        inline: false
                    },
                    {
                        name: '🌎 PAÍSES',
                        value: paisesTexto,
                        inline: false
                    },
                    {
                        name: '👤 COMPETIDORES',
                        value: competidoresTexto,
                        inline: false
                    }
                )
        ],
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// GUIA
// ========================================================================

async function guia(interaction) {

    const cfg = carregarConfig();
    const cargo = cfg.cargoTeg
        ? `<@&${cfg.cargoTeg}>`
        : '@• Olímpico';

    const texto = [
        '**🟨 Olimpíadas de Duplas:**',
        '',
        `**Vencedores: ${cargo}**`,
        '**Cada dupla escolherá um País para representar.**',
        '**Todos os dias pares do Mês de Setembro!**',
        '',
        '#️⃣ **Ranking de países por quantidade de medalhas**',
        '#️⃣ **Ranking de competidores por quantidade de medalhas**',
        '**Dupla vencedora:** 🥇',
        '',
        '**Critérios de desempate (apenas para os vivos):**',
        '**Dupla vice:** 🥈 **(peso: 3)**',
        '**Dupla lanterna:** 🥉 **(peso: 1)**',
        '',
        '***1h30min de partida***',
        '',
        '**🚫 Regras:**',
        '',
        '**1️⃣ Em caso de Briga, é possível a troca entre países com as medalhas individuais mantidas.**',
        '**2️⃣ Em caso de Ausência, é possível a substituição DEFINITIVA de um parceiro para outro. As medalhas do País serão mantidas intactas.**',
        '**3️⃣ Em caso de Anti-jogo, será tratado como qualquer outra partida do servidor.**',
        '**4️⃣ Em caso de disputa por um país, será feito um sorteio.**',
        '',
        '**⚠️ As Olimpíadas terão apenas DOIS vencedores!**'
    ].join('\n');

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('📖 GUIA — OLIMPÍADAS DE DUPLAS')
                .setDescription(texto)
        ],
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// ROTEADOR
// ========================================================================

async function handle(interaction) {

    const id = interaction.customId || '';

    if (id === 'olymp_contabilizar') {
        return contabilizar(interaction);
    }

    if (id === 'olymp_duplas') {
        return verDuplas(interaction);
    }

    if (id === 'olymp_registrar') {
        return registrar(interaction);
    }

    if (id === 'olymp_ranking') {
        return verRanking(interaction);
    }

    if (id === 'olymp_guia') {
        return guia(interaction);
    }

    if (id === 'olymp_reg_p1') {
        return registrarJogador1(interaction);
    }

    if (id.startsWith('olymp_reg_p2_')) {
        return registrarJogador2(interaction);
    }

    if (id.startsWith('olymp_buscar_')) {
        return abrirPesquisa(interaction);
    }

    if (id.startsWith('olymp_pesquisa_modal_')) {
        return pesquisarPais(interaction);
    }

    if (id.startsWith('olymp_prev_')) {
        return mudarPaginaPais(interaction, -1);
    }

    if (id.startsWith('olymp_next_')) {
        return mudarPaginaPais(interaction, 1);
    }

    if (id.startsWith('olymp_pais_')) {
        return selecionarPais(interaction);
    }

    if (id === 'olymp_result_ouro') {
        return escolherOuro(interaction);
    }

    if (id.startsWith('olymp_result_prata_')) {
        return escolherPrata(interaction);
    }

    if (id.startsWith('olymp_result_bronze_')) {
        return escolherBronze(interaction);
    }

    return false;
}


// ========================================================================
// EXPORTAÇÕES
// ========================================================================

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
