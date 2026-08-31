/* ============================================================================
   ARQUIVO:
   commands/olimpiadas/olimpiadas-handler.js

   SISTEMA:
   OLIMPÍADAS DE DUPLAS

   FUNCIONALIDADES:
   - Registro de duplas
   - Escolha de país
   - Pesquisa de país
   - Até 100 países
   - Paginação de países
   - Contabilização de partidas
   - Print obrigatório
   - Salvamento permanente
   - Ranking somente de países
   - Medalhas acumuladas
   ============================================================================ */

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


/* ============================================================================
   ARQUIVO DE DADOS
   ============================================================================ */

const ARQUIVO_DADOS = path.join(
    __dirname,
    'olimpiadas.json'
);


/* ============================================================================
   CONFIGURAÇÃO
   ============================================================================ */

function config() {
    return JSON.parse(
        fs.readFileSync(
            ARQUIVO_DADOS,
            'utf8'
        )
    );
}


/* ============================================================================
   CARREGAR DADOS
   ============================================================================ */

function carregarDados() {
    try {
        const dados = config();

        dados.duplas = Array.isArray(dados.duplas)
            ? dados.duplas
            : [];

        dados.resultados = Array.isArray(dados.resultados)
            ? dados.resultados
            : [];

        dados.ranking =
            dados.ranking &&
            typeof dados.ranking === 'object'
                ? dados.ranking
                : {};

        dados.paises = Array.isArray(dados.paises)
            ? dados.paises
            : [];

        return dados;

    } catch (erro) {

        console.error(
            '[OLIMPIADAS] Erro lendo olimpiadas.json:',
            erro
        );

        return {
            duplas: [],
            resultados: [],
            ranking: {},
            paises: []
        };
    }
}


/* ============================================================================
   SALVAR DADOS
   ============================================================================ */

function salvarDados(dados) {
    try {

        fs.writeFileSync(
            ARQUIVO_DADOS,
            JSON.stringify(
                dados,
                null,
                2
            ),
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


/* ============================================================================
   LIMPAR TEXTO
   ============================================================================ */

function limparTexto(valor) {

    return String(valor ?? '')
        .replace(/[\\`*_~|]/g, '');

}


/* ============================================================================
   NORMALIZAR TEXTO
   ============================================================================ */

function normalizar(valor) {

    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

}


/* ============================================================================
   PAÍS OCUPADO
   ============================================================================ */

function paisOcupado(
    dados,
    pais
) {

    return dados.duplas.some(
        dupla =>
            normalizar(dupla.pais) ===
            normalizar(pais)
    );

}


/* ============================================================================
   JOGADOR OCUPADO
   ============================================================================ */

function jogadorOcupado(
    dados,
    id
) {

    return dados.duplas.some(
        dupla =>
            dupla.jogador1 === id ||
            dupla.jogador2 === id
    );

}


/* ============================================================================
   BUSCAR DUPLA POR ID
   ============================================================================ */

function buscarDupla(
    dados,
    id
) {

    return dados.duplas.find(
        dupla =>
            dupla.id === id
    );

}


/* ============================================================================
   BUSCAR DUPLA POR PAÍS
   ============================================================================ */

function buscarDuplaPorPais(
    dados,
    pais
) {

    return dados.duplas.find(
        dupla =>
            normalizar(dupla.pais) ===
            normalizar(pais)
    );

}


/* ============================================================================
   PAÍSES DISPONÍVEIS
   ============================================================================ */

function paisesDisponiveis(
    dados,
    excluir = []
) {

    const ocupados = new Set(
        dados.duplas.map(
            dupla =>
                normalizar(dupla.pais)
        )
    );

    const ignorar = new Set(
        excluir.map(
            pais =>
                normalizar(pais)
        )
    );

    return (dados.paises || []).filter(
        pais =>
            !ocupados.has(
                normalizar(pais)
            ) &&
            !ignorar.has(
                normalizar(pais)
            )
    );

}


/* ============================================================================
   VERIFICAR DIA DE CONTABILIZAÇÃO
   ============================================================================ */

function podeContabilizar() {

    const agora = new Date();
    const cfg = config();

    return (
        agora.getFullYear() === Number(cfg.ano) &&
        agora.getMonth() + 1 === Number(cfg.mes) &&
        agora.getDate() % 2 === 0
    );

}


/* ============================================================================
   PESQUISAS ATIVAS
   ============================================================================ */

const pesquisas = new Map();


/* ============================================================================
   CRIAR PESQUISA
   ============================================================================ */

function criarPesquisa(
    dados,
    jogador1,
    jogador2,
    termo = ''
) {

    const lista = paisesDisponiveis(
        dados
    ).filter(
        pais =>
            !termo ||
            normalizar(pais).includes(
                normalizar(termo)
            )
    );

    const token =
        `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    pesquisas.set(
        token,
        {
            jogador1,
            jogador2,
            paises: lista,
            criadoEm: Date.now()
        }
    );

    const timer = setTimeout(
        () => {
            pesquisas.delete(token);
        },
        5 * 60 * 1000
    );

    if (typeof timer.unref === 'function') {
        timer.unref();
    }

    return token;

}


/* ============================================================================
   MENU DE PAÍSES
   ============================================================================ */

function menuPesquisaPais(
    token,
    pagina = 0
) {

    const pesquisa = pesquisas.get(
        token
    );

    if (!pesquisa) {
        return [];
    }

    const inicio = pagina * 25;

    const lista = pesquisa.paises.slice(
        inicio,
        inicio + 25
    );

    const total = Math.max(
        1,
        Math.ceil(
            pesquisa.paises.length / 25
        )
    );

    const menu = new StringSelectMenuBuilder()
        .setCustomId(
            `olymp_pais_${token}_${pagina}`
        )
        .setPlaceholder(
            '🌎 Escolha um país'
        )
        .addOptions(
            lista.map(
                (pais, indice) => ({
                    label: pais.slice(0, 100),
                    value: `pais_${inicio + indice}`,
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
                .setLabel(
                    'Pesquisar país'
                )
                .setEmoji('🔎')
                .setStyle(
                    ButtonStyle.Primary
                ),

            new ButtonBuilder()
                .setCustomId(
                    `olymp_prev_${token}_${pagina}`
                )
                .setLabel(
                    'Anterior'
                )
                .setEmoji('⬅️')
                .setStyle(
                    ButtonStyle.Secondary
                )
                .setDisabled(
                    pagina === 0
                ),

            new ButtonBuilder()
                .setCustomId(
                    `olymp_pag_${token}`
                )
                .setLabel(
                    `Página ${pagina + 1}/${total}`
                )
                .setStyle(
                    ButtonStyle.Secondary
                )
                .setDisabled(true),

            new ButtonBuilder()
                .setCustomId(
                    `olymp_next_${token}_${pagina}`
                )
                .setLabel(
                    'Próxima'
                )
                .setEmoji('➡️')
                .setStyle(
                    ButtonStyle.Secondary
                )
                .setDisabled(
                    pagina >= total - 1
                )

        );

    return [
        new ActionRowBuilder()
            .addComponents(menu),

        botoes
    ];

}


/* ============================================================================
   MENU DE RESULTADO
   ============================================================================ */

function menuResultadoPais(
    dados,
    customId,
    placeholder,
    excluir = []
) {

    const paises = dados.duplas
        .map(
            dupla =>
                dupla.pais
        )
        .filter(
            pais =>
                !excluir.some(
                    excluido =>
                        normalizar(excluido) ===
                        normalizar(pais)
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


/* ============================================================================
   LER PAÍS DO MENU DE RESULTADO
   ============================================================================ */

function paisDoResultadoMenu(
    interaction,
    dados,
    excluir = []
) {

    const paises = dados.duplas
        .map(
            dupla =>
                dupla.pais
        )
        .filter(
            pais =>
                !excluir.some(
                    excluido =>
                        normalizar(excluido) ===
                        normalizar(pais)
                )
        );

    const valor =
        interaction.values?.[0] || '';

    const indice = Number(
        valor.replace(
            'resultado_',
            ''
        )
    );

    if (!Number.isInteger(indice)) {
        return null;
    }

    return paises[indice] || null;

}


/* ============================================================================
   PAINEL PRINCIPAL
   ============================================================================ */

function criarPainel(
    dados = carregarDados()
) {

    const cfg = config();

    const cargo = cfg.cargoTeg
        ? `<@&${cfg.cargoTeg}>`
        : '@• Olímpico';

    return new EmbedBuilder()
        .setColor('#D4AF37')
        .setTitle(
            '🟨 OLIMPÍADAS DE DUPLAS'
        )
        .setDescription(
            [
                `**Vencedores: ${cargo}**`,
                '',
                '**Cada dupla escolherá um País para representar.**',
                '',
                '📅 **Contabilização somente nos dias pares de setembro de 2026.**',
                '📝 **Registro de duplas pode ser feito qualquer dia.**',
                '',
                '🥇 Vitória = critério principal',
                '🥈 2º lugar = peso 3 no desempate',
                '🥉 3º lugar = peso 1 no desempate',
                '',
                `👥 **Duplas registradas:** ${dados.duplas.length}`,
                `📊 **Partidas registradas:** ${dados.resultados.length}`,
                `🌎 **Países disponíveis:** ${paisesDisponiveis(dados).length}`,
                '',
                '⏱️ **Partida: 1h30min**',
                '',
                '⚠️ **Apenas DOIS vencedores!**'
            ].join('\n')
        )
        .setImage(cfg.imagem)
        .setFooter({
            text:
                'WorldWarBR • Olimpíadas de Duplas'
        });

}


/* ============================================================================
   BOTÕES
   ============================================================================ */

function criarBotoes() {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()
                .setCustomId(
                    'olymp_contabilizar'
                )
                .setLabel(
                    'Contabilizar'
                )
                .setEmoji('🏅')
                .setStyle(
                    ButtonStyle.Success
                ),

            new ButtonBuilder()
                .setCustomId(
                    'olymp_duplas'
                )
                .setLabel(
                    'Ver duplas'
                )
                .setEmoji('👥')
                .setStyle(
                    ButtonStyle.Primary
                ),

            new ButtonBuilder()
                .setCustomId(
                    'olymp_registrar'
                )
                .setLabel(
                    'Registrar dupla'
                )
                .setEmoji('📝')
                .setStyle(
                    ButtonStyle.Secondary
                ),

            new ButtonBuilder()
                .setCustomId(
                    'olymp_ranking'
                )
                .setLabel(
                    'Ranking'
                )
                .setEmoji('🏆')
                .setStyle(
                    ButtonStyle.Secondary
                ),

            new ButtonBuilder()
                .setCustomId(
                    'olymp_guia'
                )
                .setLabel(
                    'Guia'
                )
                .setEmoji('📖')
                .setStyle(
                    ButtonStyle.Secondary
                )

        );

}


/* ============================================================================
   PUBLICAR PAINEL
   ============================================================================ */

async function painel(
    interaction
) {

    const cfg = config();

    const canal =
        await interaction.client.channels
            .fetch(cfg.canalPainel)
            .catch(() => null);

    if (!canal?.isTextBased()) {

        return interaction.reply({
            content:
                '❌ Canal do painel das Olimpíadas não encontrado.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    await canal.send({
        embeds: [
            criarPainel()
        ],
        components: [
            criarBotoes()
        ]
    });

    return interaction.reply({
        content:
            '✅ Painel publicado.',
        flags:
            MessageFlags.Ephemeral
    });

}


/* ============================================================================
   REGISTRAR DUPLA
   ============================================================================ */

async function registrar(
    interaction
) {

    return interaction.reply({

        content:
            '📝 **REGISTRO DE DUPLA**\n\n' +
            'Selecione o primeiro integrante.',

        components: [

            new ActionRowBuilder()
                .addComponents(

                    new UserSelectMenuBuilder()
                        .setCustomId(
                            'olymp_reg_p1'
                        )
                        .setPlaceholder(
                            '👤 Selecione o jogador 1'
                        )

                )

        ],

        flags:
            MessageFlags.Ephemeral

    });

}


/* ============================================================================
   JOGADOR 1
   ============================================================================ */

async function registrarJogador1(
    interaction
) {

    const jogador1 =
        interaction.values?.[0];

    if (!jogador1) {

        return interaction.reply({
            content:
                '❌ Jogador inválido.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const dados =
        carregarDados();

    if (
        jogadorOcupado(
            dados,
            jogador1
        )
    ) {

        return interaction.reply({
            content:
                '❌ Esse jogador já pertence a uma dupla.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    return interaction.update({

        content:
            '📝 **JOGADOR 2**\n\n' +
            'Selecione o segundo integrante.',

        components: [

            new ActionRowBuilder()
                .addComponents(

                    new UserSelectMenuBuilder()
                        .setCustomId(
                            `olymp_reg_p2_${jogador1}`
                        )
                        .setPlaceholder(
                            '👤 Selecione o jogador 2'
                        )

                )

        ]

    });

}


/* ============================================================================
   JOGADOR 2
   ============================================================================ */

async function registrarJogador2(
    interaction
) {

    const jogador1 =
        interaction.customId.replace(
            'olymp_reg_p2_',
            ''
        );

    const jogador2 =
        interaction.values?.[0];

    const dados =
        carregarDados();

    if (!jogador2) {

        return interaction.reply({
            content:
                '❌ Jogador inválido.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    if (
        jogador1 === jogador2
    ) {

        return interaction.reply({
            content:
                '❌ Os dois integrantes precisam ser diferentes.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    if (
        jogadorOcupado(
            dados,
            jogador1
        ) ||
        jogadorOcupado(
            dados,
            jogador2
        )
    ) {

        return interaction.reply({
            content:
                '❌ Um dos jogadores já pertence a uma dupla registrada.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const token =
        criarPesquisa(
            dados,
            jogador1,
            jogador2
        );

    const pesquisa =
        pesquisas.get(token);

    if (
        !pesquisa ||
        !pesquisa.paises.length
    ) {

        pesquisas.delete(token);

        return interaction.reply({
            content:
                '❌ Todos os países disponíveis já foram escolhidos.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    return interaction.update({

        content:
            '🌎 **ESCOLHA O PAÍS**\n\n' +
            `**${pesquisa.paises.length} países disponíveis.**\n\n` +
            '📋 Escolha um país pela lista.\n' +
            '🔎 Se não encontrar, use **Pesquisar país**.',

        components:
            menuPesquisaPais(
                token,
                0
            )

    });

}


/* ============================================================================
   ABRIR PESQUISA
   ============================================================================ */

async function abrirPesquisa(
    interaction
) {

    const token =
        interaction.customId.replace(
            'olymp_buscar_',
            ''
        );

    if (!pesquisas.has(token)) {

        return interaction.reply({
            content:
                '⌛ Esta pesquisa expirou. Faça o registro novamente.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                `olymp_pesquisa_modal_${token}`
            )
            .setTitle(
                '🔎 Pesquisar país'
            );

    const campo =
        new TextInputBuilder()
            .setCustomId(
                'termo'
            )
            .setLabel(
                'Digite o nome do país'
            )
            .setPlaceholder(
                'Ex.: Brasil, Colombia, Alemanha'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setMaxLength(
                50
            )
            .setRequired(
                true
            );

    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                campo
            )
    );

    return interaction.showModal(
        modal
    );

}


/* ============================================================================
   PESQUISAR PAÍS
   ============================================================================ */

async function pesquisarPais(
    interaction
) {

    const token =
        interaction.customId.replace(
            'olymp_pesquisa_modal_',
            ''
        );

    const pesquisa =
        pesquisas.get(token);

    if (!pesquisa) {

        return interaction.reply({
            content:
                '⌛ Esta pesquisa expirou. Faça o registro novamente.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const termo =
        interaction.fields
            .getTextInputValue(
                'termo'
            )
            .trim();

    const dados =
        carregarDados();

    pesquisa.paises =
        paisesDisponiveis(
            dados
        ).filter(
            pais =>
                normalizar(pais).includes(
                    normalizar(termo)
                )
        );

    if (
        !pesquisa.paises.length
    ) {

        return interaction.reply({
            content:
                `❌ Nenhum país disponível encontrado para **${limparTexto(termo)}**.`,
            flags:
                MessageFlags.Ephemeral
        });

    }

    return interaction.reply({

        content:
            `🔎 **RESULTADO DA PESQUISA:** ${limparTexto(termo)}\n\n` +
            `🌎 ${pesquisa.paises.length} país(es) encontrado(s).\n\n` +
            'Selecione o país:',

        components:
            menuPesquisaPais(
                token,
                0
            ),

        flags:
            MessageFlags.Ephemeral

    });

}


/* ============================================================================
   PAGINAÇÃO DOS PAÍSES
   ============================================================================ */

async function mudarPaginaPais(
    interaction,
    direcao
) {

    const partes =
        interaction.customId.split('_');

    const token =
        partes[2];

    const pagina =
        Number(partes[3]);

    const pesquisa =
        pesquisas.get(token);

    if (!pesquisa) {

        return interaction.reply({
            content:
                '⌛ Pesquisa expirada.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const total =
        Math.max(
            1,
            Math.ceil(
                pesquisa.paises.length / 25
            )
        );

    const nova =
        Math.max(
            0,
            Math.min(
                total - 1,
                pagina + direcao
            )
        );

    return interaction.update({

        content:
            `🌎 **PAÍSES DISPONÍVEIS — PÁGINA ${nova + 1}/${total}**`,

        components:
            menuPesquisaPais(
                token,
                nova
            )

    });

}


/* ============================================================================
   SELECIONAR PAÍS
   ============================================================================ */

async function selecionarPais(
    interaction
) {

    const partes =
        interaction.customId.split('_');

    const token =
        partes[2];

    const pesquisa =
        pesquisas.get(token);

    if (!pesquisa) {

        return interaction.reply({
            content:
                '⌛ Pesquisa expirada. Faça o registro novamente.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const valor =
        interaction.values?.[0] || '';

    const indice =
        Number(
            valor.replace(
                'pais_',
                ''
            )
        );

    const pais =
        pesquisa.paises[indice];

    if (!pais) {

        return interaction.reply({
            content:
                '❌ País inválido. Abra o registro novamente.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const dados =
        carregarDados();

    if (
        jogadorOcupado(
            dados,
            pesquisa.jogador1
        ) ||
        jogadorOcupado(
            dados,
            pesquisa.jogador2
        )
    ) {

        pesquisas.delete(token);

        return interaction.reply({
            content:
                '❌ Um dos jogadores já pertence a outra dupla.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    if (
        paisOcupado(
            dados,
            pais
        )
    ) {

        pesquisas.delete(token);

        return interaction.reply({
            content:
                '❌ Esse país acabou de ser escolhido por outra dupla.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const dupla = {

        id:
            `dupla_${Date.now()}_${pesquisa.jogador1}`,

        pais,

        jogador1:
            pesquisa.jogador1,

        jogador2:
            pesquisa.jogador2,

        criadoPor:
            interaction.user.id,

        criadoEm:
            new Date().toISOString(),

        ativa:
            true

    };

    dados.duplas.push(
        dupla
    );

    dados.ranking =
        calcularRanking(
            dados
        );

    salvarDados(
        dados
    );

    pesquisas.delete(
        token
    );

    const cfg =
        config();

    const canalTeg =
        await interaction.client.channels
            .fetch(cfg.canalTeg)
            .catch(() => null);

    if (
        canalTeg?.isTextBased()
    ) {

        await canalTeg.send({

            content:
                cfg.cargoTeg
                    ? `<@&${cfg.cargoTeg}>`
                    : undefined,

            embeds: [

                new EmbedBuilder()
                    .setColor('#D4AF37')
                    .setTitle(
                        '📝 NOVA DUPLA REGISTRADA'
                    )
                    .setDescription(
                        [
                            `🌎 **País:** ${limparTexto(pais)}`,
                            `👥 **Jogadores:** <@${pesquisa.jogador1}> + <@${pesquisa.jogador2}>`
                        ].join('\n')
                    )
                    .setTimestamp()

            ]

        });

    }

    return interaction.update({

        content:
            '✅ **DUPLA REGISTRADA COM SUCESSO!**\n\n' +
            `🌎 **País:** ${limparTexto(pais)}\n` +
            `👥 **Jogadores:** <@${pesquisa.jogador1}> + <@${pesquisa.jogador2}>\n\n` +
            '📋 A dupla já está disponível em **👥 Ver duplas**.',

        components: []

    });

}


/* ============================================================================
   CONTABILIZAÇÃO
   ============================================================================ */

async function contabilizar(
    interaction
) {

    if (
        !podeContabilizar()
    ) {

        return interaction.reply({
            content:
                '🚫 **A contabilização só pode ser feita nos dias pares de setembro de 2026.**\n\n' +
                '📝 O registro de duplas pode ser feito qualquer dia.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const dados =
        carregarDados();

    if (
        dados.duplas.length < 3
    ) {

        return interaction.reply({
            content:
                '❌ É necessário ter pelo menos 3 duplas registradas.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const menu =
        menuResultadoPais(
            dados,
            'olymp_result_ouro',
            '🥇 Selecione o país vencedor'
        );

    if (!menu) {

        return interaction.reply({
            content:
                '❌ Não há países registrados para contabilizar.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    return interaction.reply({

        content:
            '🏅 **CONTABILIZAÇÃO DE PARTIDA**\n\n' +
            'Selecione os três países:\n\n' +
            '🥇 **1º lugar — Ouro**\n' +
            '🥈 **2º lugar — Prata**\n' +
            '🥉 **3º lugar — Bronze**\n\n' +
            '📸 No final será obrigatório enviar o **print anexado**.\n' +
            '🚫 Links não são aceitos.',

        components: [
            menu
        ],

        flags:
            MessageFlags.Ephemeral

    });

}


/* ============================================================================
   ESCOLHER OURO
   ============================================================================ */

async function escolherOuro(
    interaction
) {

    const dados =
        carregarDados();

    const ouro =
        paisDoResultadoMenu(
            interaction,
            dados
        );

    if (!ouro) {

        return interaction.reply({
            content:
                '❌ País vencedor inválido.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const menu =
        menuResultadoPais(
            dados,
            `olymp_result_prata_${encodeURIComponent(ouro)}`,
            '🥈 Selecione o país em 2º lugar',
            [ouro]
        );

    if (!menu) {

        return interaction.reply({
            content:
                '❌ Não há outro país disponível.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    return interaction.update({

        content:
            `🥇 **${limparTexto(ouro)}**\n\n` +
            'Agora escolha o 🥈 segundo lugar.',

        components: [
            menu
        ]

    });

}


/* ============================================================================
   ESCOLHER PRATA
   ============================================================================ */

async function escolherPrata(
    interaction
) {

    const ouro =
        decodeURIComponent(
            interaction.customId.replace(
                'olymp_result_prata_',
                ''
            )
        );

    const dados =
        carregarDados();

    const prata =
        paisDoResultadoMenu(
            interaction,
            dados,
            [ouro]
        );

    if (!prata) {

        return interaction.reply({
            content:
                '❌ País em 2º lugar inválido.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const menu =
        menuResultadoPais(
            dados,
            `olymp_result_bronze_${encodeURIComponent(ouro)}_${encodeURIComponent(prata)}`,
            '🥉 Selecione o país em 3º lugar',
            [
                ouro,
                prata
            ]
        );

    if (!menu) {

        return interaction.reply({
            content:
                '❌ Não há outro país disponível.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    return interaction.update({

        content:
            `🥇 **${limparTexto(ouro)}**\n` +
            `🥈 **${limparTexto(prata)}**\n\n` +
            'Agora escolha o 🥉 terceiro lugar.',

        components: [
            menu
        ]

    });

}


/* ============================================================================
   ESCOLHER BRONZE
   ============================================================================ */

async function escolherBronze(
    interaction
) {

    if (
        !podeContabilizar()
    ) {

        return interaction.reply({
            content:
                '🚫 A contabilização só pode ser feita nos dias pares de setembro de 2026.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const valor =
        interaction.customId.replace(
            'olymp_result_bronze_',
            ''
        );

    const separador =
        valor.lastIndexOf('_');

    const ouro =
        decodeURIComponent(
            valor.slice(
                0,
                separador
            )
        );

    const prata =
        decodeURIComponent(
            valor.slice(
                separador + 1
            )
        );

    const dados =
        carregarDados();

    const bronze =
        paisDoResultadoMenu(
            interaction,
            dados,
            [
                ouro,
                prata
            ]
        );

    if (!bronze) {

        return interaction.reply({
            content:
                '❌ País em 3º lugar inválido.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    await interaction.reply({

        content:
            '📸 **ANEXE AGORA O PRINT DA VITÓRIA**\n\n' +
            `🥇 ${limparTexto(ouro)}\n` +
            `🥈 ${limparTexto(prata)}\n` +
            `🥉 ${limparTexto(bronze)}\n\n` +
            '⚠️ Somente PNG, JPG, JPEG ou WEBP.\n' +
            '🚫 Links não são aceitos.\n' +
            '⏳ Você tem 2 minutos.',

        flags:
            MessageFlags.Ephemeral

    });

    const canal =
        interaction.channel;

    if (!canal?.createMessageCollector) {

        return interaction.followUp({
            content:
                '❌ Não foi possível iniciar o recebimento do print.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const coletor =
        canal.createMessageCollector({

            filter:
                mensagem =>
                    mensagem.author.id ===
                    interaction.user.id &&
                    mensagem.attachments.size > 0,

            time:
                120000

        });

    coletor.on(
        'collect',
        async mensagem => {

            const anexo =
                mensagem.attachments.find(
                    arquivo => {

                        const tipo =
                            String(
                                arquivo.contentType || ''
                            ).toLowerCase();

                        const nome =
                            String(
                                arquivo.name || ''
                            );

                        return (
                            tipo.startsWith('image/')
                            ||
                            /\.(png|jpe?g|webp)$/i.test(
                                nome
                            )
                        );

                    }
                );

            if (!anexo) {

                await mensagem.reply(
                    '❌ Envie uma imagem PNG, JPG, JPEG ou WEBP.'
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

            if (
                motivo === 'time'
            ) {

                interaction.followUp({

                    content:
                        '⌛ Tempo esgotado. A contabilização foi cancelada.',

                    flags:
                        MessageFlags.Ephemeral

                }).catch(() => {});

            }

        }
    );

}


/* ============================================================================
   FINALIZAR CONTABILIZAÇÃO
   ============================================================================ */

async function finalizarContabilizacao(
    interaction,
    ouro,
    prata,
    bronze,
    anexo
) {

    const dados =
        carregarDados();

    const duplaOuro =
        buscarDuplaPorPais(
            dados,
            ouro
        );

    const duplaPrata =
        buscarDuplaPorPais(
            dados,
            prata
        );

    const duplaBronze =
        buscarDuplaPorPais(
            dados,
            bronze
        );

    if (
        !duplaOuro ||
        !duplaPrata ||
        !duplaBronze
    ) {

        return interaction.followUp({
            content:
                '❌ Uma das duplas selecionadas não foi encontrada.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const resultado = {

        id:
            `resultado_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,

        data:
            new Date().toISOString(),

        ouro:
            duplaOuro.id,

        prata:
            duplaPrata.id,

        bronze:
            duplaBronze.id,

        print:
            anexo.url,

        printNome:
            anexo.name || null,

        printTipo:
            anexo.contentType || null,

        registradoPor:
            interaction.user.id

    };

    dados.resultados.push(
        resultado
    );

    /*
       Recalcula o ranking inteiro.

       Isso garante que as medalhas de partidas anteriores
       continuem acumuladas.
    */

    dados.ranking =
        calcularRanking(
            dados
        );

    const salvou =
        salvarDados(
            dados
        );

    if (!salvou) {

        return interaction.followUp({
            content:
                '❌ O resultado foi processado, mas houve erro ao salvar os dados.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const cfg =
        config();

    const canal =
        await interaction.client.channels
            .fetch(cfg.canalResultados)
            .catch(() => null);

    if (
        canal?.isTextBased()
    ) {

        await canal.send({

            embeds: [

                new EmbedBuilder()
                    .setColor('#D4AF37')
                    .setTitle(
                        '🏅 RESULTADO — OLIMPÍADAS DE DUPLAS'
                    )
                    .setDescription(
                        [
                            `🥇 **${limparTexto(duplaOuro.pais)}**`,
                            `🥈 **${limparTexto(duplaPrata.pais)}**`,
                            `🥉 **${limparTexto(duplaBronze.pais)}**`,
                            '',
                            '🥇 Ouro',
                            '🥈 Prata',
                            '🥉 Bronze'
                        ].join('\n')
                    )
                    .setImage(anexo.url)
                    .setTimestamp()

            ]

        }).catch(
            erro =>
                console.error(
                    '[OLIMPIADAS] Erro enviando resultado:',
                    erro
                )
        );

    }

    return interaction.followUp({

        content:
            '✅ **Resultado contabilizado!**\n' +
            '📸 Print salvo/publicado.\n' +
            '💾 Medalhas somadas ao histórico permanente.\n' +
            '🏆 Ranking de países atualizado.',

        flags:
            MessageFlags.Ephemeral

    });

}


/* ============================================================================
   RANKING INTERNO
   ============================================================================ */

function calcularRanking(
    dados
) {

    const ranking = {};

    for (
        const resultado of dados.resultados
    ) {

        if (
            resultado.ouro
        ) {

            ranking[resultado.ouro] ??= {
                vitorias: 0,
                prata: 0,
                bronze: 0,
                desempate: 0
            };

            ranking[
                resultado.ouro
            ].vitorias++;

        }

        if (
            resultado.prata
        ) {

            ranking[resultado.prata] ??= {
                vitorias: 0,
                prata: 0,
                bronze: 0,
                desempate: 0
            };

            ranking[
                resultado.prata
            ].prata++;

            ranking[
                resultado.prata
            ].desempate += 3;

        }

        if (
            resultado.bronze
        ) {

            ranking[resultado.bronze] ??= {
                vitorias: 0,
                prata: 0,
                bronze: 0,
                desempate: 0
            };

            ranking[
                resultado.bronze
            ].bronze++;

            ranking[
                resultado.bronze
            ].desempate += 1;

        }

    }

    return ranking;

}


/* ============================================================================
   RANKING DE PAÍSES
   ============================================================================ */

function rankingPaises(
    dados
) {

    const ranking = {};

    for (
        const resultado of dados.resultados
    ) {

        /*
           OURO
        */

        if (
            resultado.ouro
        ) {

            const dupla =
                buscarDupla(
                    dados,
                    resultado.ouro
                );

            if (dupla) {

                const pais =
                    dupla.pais;

                ranking[pais] ??= {
                    ouro: 0,
                    prata: 0,
                    bronze: 0,
                    total: 0
                };

                ranking[pais].ouro++;
                ranking[pais].total++;

            }

        }

        /*
           PRATA
        */

        if (
            resultado.prata
        ) {

            const dupla =
                buscarDupla(
                    dados,
                    resultado.prata
                );

            if (dupla) {

                const pais =
                    dupla.pais;

                ranking[pais] ??= {
                    ouro: 0,
                    prata: 0,
                    bronze: 0,
                    total: 0
                };

                ranking[pais].prata++;
                ranking[pais].total++;

            }

        }

        /*
           BRONZE
        */

        if (
            resultado.bronze
        ) {

            const dupla =
                buscarDupla(
                    dados,
                    resultado.bronze
                );

            if (dupla) {

                const pais =
                    dupla.pais;

                ranking[pais] ??= {
                    ouro: 0,
                    prata: 0,
                    bronze: 0,
                    total: 0
                };

                ranking[pais].bronze++;
                ranking[pais].total++;

            }

        }

    }

    return Object.entries(
        ranking
    )
        .map(
            ([pais, valores]) => ({
                pais,
                ...valores
            })
        )
        .sort(
            (a, b) =>
                b.ouro - a.ouro ||
                b.prata - a.prata ||
                b.bronze - a.bronze
        );

}


/* ============================================================================
   RANKING DE COMPETIDORES
   ============================================================================

   Mantido para compatibilidade com outros arquivos.

   O BOTÃO RANKING NÃO MOSTRA COMPETIDORES.
   ============================================================================ */

function rankingCompetidores(
    dados
) {

    const ranking = {};

    for (
        const resultado of dados.resultados
    ) {

        for (
            const [id, medalha] of [
                [resultado.ouro, 'ouro'],
                [resultado.prata, 'prata'],
                [resultado.bronze, 'bronze']
            ]
        ) {

            if (!id) {
                continue;
            }

            const dupla =
                buscarDupla(
                    dados,
                    id
                );

            if (!dupla) {
                continue;
            }

            for (
                const jogador of [
                    dupla.jogador1,
                    dupla.jogador2
                ]
            ) {

                ranking[jogador] ??= {
                    ouro: 0,
                    prata: 0,
                    bronze: 0,
                    total: 0
                };

                ranking[jogador][
                    medalha
                ]++;

                ranking[jogador].total++;

            }

        }

    }

    return Object.entries(
        ranking
    )
        .map(
            ([id, valores]) => ({
                id,
                ...valores
            })
        )
        .sort(
            (a, b) =>
                b.ouro - a.ouro ||
                b.prata - a.prata ||
                b.bronze - a.bronze
        );

}


/* ============================================================================
   VER DUPLAS
   ============================================================================ */

async function verDuplas(
    interaction
) {

    const dados =
        carregarDados();

    if (
        !dados.duplas.length
    ) {

        return interaction.reply({
            content:
                '👥 Nenhuma dupla registrada ainda.',
            flags:
                MessageFlags.Ephemeral
        });

    }

    const texto =
        dados.duplas
            .slice(0, 25)
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
                .setTitle(
                    '👥 DUPLAS DAS OLIMPÍADAS'
                )
                .setDescription(
                    texto
                )

        ],

        flags:
            MessageFlags.Ephemeral

    });

}


/* ============================================================================
   VER RANKING
   ============================================================================

   IMPORTANTE:

   O RANKING MOSTRA SOMENTE PAÍSES.

   NÃO MOSTRA:
   - ❌ jogadores
   - ❌ competidores
   - ❌ nomes das duplas

   FORMATO:

   🥇 Brasil
   🥇 3  🥈 2  🥉 1

   As medalhas são acumuladas de todas as partidas.
   ============================================================================ */

async function verRanking(
    interaction
) {

    const dados =
        carregarDados();

    const paises =
        rankingPaises(
            dados
        );

    if (!paises.length) {

        return interaction.reply({

            embeds: [

                new EmbedBuilder()
                    .setColor('#D4AF37')
                    .setTitle(
                        '🏆 RANKING — OLIMPÍADAS DE DUPLAS'
                    )
                    .setDescription(
                        '🌎 **PAÍSES**\n\n' +
                        'Sem medalhas ainda.'
                    )

            ],

            flags:
                MessageFlags.Ephemeral

        });

    }

    const paisesTexto =
        paises
            .slice(0, 25)
            .map(
                (pais, indice) =>
                    [
                        `**${indice + 1}. 🌎 ${limparTexto(pais.pais)}**`,
                        `🥇 **${pais.ouro}**  •  🥈 **${pais.prata}**  •  🥉 **${pais.bronze}**`
                    ].join('\n')
            )
            .join('\n\n');

    return interaction.reply({

        embeds: [

            new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle(
                    '🏆 RANKING — OLIMPÍADAS DE DUPLAS'
                )
                .setDescription(
                    [
                        '🌎 **PAÍSES**',
                        '',
                        paisesTexto
                    ].join('\n')
                )
                .setFooter({
                    text:
                        '🥇 Ouro • 🥈 Prata • 🥉 Bronze — Medalhas acumuladas em todas as partidas.'
                })
                .setTimestamp()

        ],

        flags:
            MessageFlags.Ephemeral

    });

}


/* ============================================================================
   GUIA
   ============================================================================ */

async function guia(
    interaction
) {

    const cfg =
        config();

    const cargo =
        cfg.cargoTeg
            ? `<@&${cfg.cargoTeg}>`
            : '@• Olímpico';

    const texto = [

        '## 🟨 Olimpíadas de Duplas',

        '',

        `**Vencedores: ${cargo}**`,

        '',

        '**Cada dupla escolherá um País para representar.**',

        '**A contabilização acontecerá somente nos dias pares do mês de Setembro.**',

        '',

        '🌎 **Ranking somente de países por quantidade de medalhas.**',

        '',

        '**🥇 Ouro:** 1º lugar',

        '**🥈 Prata:** 2º lugar',

        '**🥉 Bronze:** 3º lugar',

        '',

        '⏱️ **1h30min de partida**',

        '',

        '🚫 **Regras:**',

        '',

        '1️⃣ **Em caso de Briga, é possível a troca entre países com as medalhas individuais mantidas.**',

        '2️⃣ **Em caso de Ausência, é possível a substituição DEFINITIVA de um parceiro para outro. As medalhas do País serão mantidas intactas.**',

        '3️⃣ **Em caso de Anti-jogo, será tratado como qualquer outra partida do servidor.**',

        '4️⃣ **Em caso de disputa por um país, será feito um sorteio.**',

        '',

        '⚠️ **As Olimpíadas terão apenas DOIS vencedores!**'

    ].join('\n');

    return interaction.reply({

        embeds: [

            new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle(
                    '📖 GUIA — OLIMPÍADAS DE DUPLAS'
                )
                .setDescription(
                    texto
                )
                .setFooter({
                    text:
                        'WorldWarBR • Olimpíadas de Duplas'
                })

        ],

        flags:
            MessageFlags.Ephemeral

    });

}


/* ============================================================================
   ROTEADOR
   ============================================================================ */

async function handle(
    interaction
) {

    const id =
        interaction.customId || '';

    /*
       BOTÕES PRINCIPAIS
    */

    if (
        id === 'olymp_contabilizar'
    ) {
        return contabilizar(
            interaction
        );
    }

    if (
        id === 'olymp_duplas'
    ) {
        return verDuplas(
            interaction
        );
    }

    if (
        id === 'olymp_registrar'
    ) {
        return registrar(
            interaction
        );
    }

    if (
        id === 'olymp_ranking'
    ) {
        return verRanking(
            interaction
        );
    }

    if (
        id === 'olymp_guia'
    ) {
        return guia(
            interaction
        );
    }

    /*
       REGISTRO
    */

    if (
        id === 'olymp_reg_p1'
    ) {
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

    /*
       PESQUISA
    */

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
            'olymp_pesquisa_modal_'
        )
    ) {
        return pesquisarPais(
            interaction
        );
    }

    /*
       PAGINAÇÃO
    */

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

    /*
       SELEÇÃO DO PAÍS
    */

    if (
        id.startsWith(
            'olymp_pais_'
        )
    ) {
        return selecionarPais(
            interaction
        );
    }

    /*
       CONTABILIZAÇÃO
    */

    if (
        id === 'olymp_result_ouro'
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

    return false;

}


/* ============================================================================
   EXPORTAÇÕES
   ============================================================================ */

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
