/* ========================================================================
   ARQUIVO: commands/promocao/historicoHandler.js

   HALL DA FAMA — UM EVENTO POR PÁGINA

   IMPORTANTE:
   - O mural público nunca é alterado.
   - O Hall abre em resposta efêmera.
   - Um único evento é mostrado por página.
   - Cada evento possui visual próprio.
   - Compatível com registros antigos em string.
   - Compatível com registros novos em objeto.
   ======================================================================== */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const path =
    require('path');

const {
    safeReadJson
} =
    require('../liga/utils/helpers.js');


// ========================================================================
// CAMINHO
// ========================================================================

const HISTORICO_PATH =
    path.join(
        __dirname,
        'historico.json'
    );


// ========================================================================
// CATEGORIAS
// ========================================================================

const CATEGORIAS = {

    liga: {

        titulo:
            '🏆 HALL DA FAMA — LIGA',

        cor:
            '#3498DB',

        emoji:
            '🏆'

    },

    imperador: {

        titulo:
            '👑 HALL DA FAMA — IMPERADORES',

        cor:
            '#F1C40F',

        emoji:
            '👑'

    },

    eventos: {

        titulo:
            '⚔️ HALL DA FAMA — EVENTOS',

        cor:
            '#95A5A6',

        emoji:
            '⚔️'

    },

    records: {

        titulo:
            '📊 HALL DA FAMA — RECORDS',

        cor:
            '#E74C3C',

        emoji:
            '📊'

    }

};


// ========================================================================
// TIPOS
// ========================================================================

const NOMES_TIPOS = {

    semanal:
        '📅 Evento semanal',

    individual:
        '👤 Evento individual',

    campeonato:
        '🏆 Campeonato',

    recorde:
        '📊 Recorde',

    destaque:
        '🌟 Destaque especial'

};


// ========================================================================
// CARREGAR
// ========================================================================

function carregarHistorico() {

    const dados =
        safeReadJson(
            HISTORICO_PATH
        );


    if (
        !dados ||
        typeof dados !== 'object'
    ) {

        return {

            destaque:
                '',

            liga:
                [],

            imperador:
                [],

            eventos:
                [],

            records:
                []

        };

    }


    return {

        destaque:
            typeof dados.destaque === 'string'
                ? dados.destaque
                : '',

        liga:
            Array.isArray(dados.liga)
                ? dados.liga
                : [],

        imperador:
            Array.isArray(dados.imperador)
                ? dados.imperador
                : [],

        eventos:
            Array.isArray(dados.eventos)
                ? dados.eventos
                : [],

        records:
            Array.isArray(dados.records)
                ? dados.records
                : []

    };

}


// ========================================================================
// FORMATAR REGISTRO ANTIGO
// ========================================================================

function formatarRegistroAntigo(
    registro
) {

    const texto =
        String(
            registro || ''
        ).trim();


    if (
        !texto
    ) {

        return {

            titulo:
                'Evento histórico',

            descricao:
                '*Registro vazio.*'

        };

    }


    const linhas =
        texto
            .split('\n')
            .map(
                linha =>
                    linha
                        .replace(
                            /\*\*/g,
                            ''
                        )
                        .trim()
            )
            .filter(
                Boolean
            );


    let titulo =
        'Evento histórico';


    const participantes =
        [];


    const detalhes =
        [];


    for (
        const linha
        of linhas
    ) {

        // ---------------------------------------------------------------
        // Nome
        // ---------------------------------------------------------------

        if (

            linha.startsWith(
                '🏆'
            ) ||

            linha.startsWith(
                '⚔️'
            )

        ) {

            titulo =
                linha

                    .replace(
                        /^🏆\s*/u,
                        ''
                    )

                    .replace(
                        /^⚔️\s*/u,
                        ''
                    )

                    .trim();


            continue;

        }


        // ---------------------------------------------------------------
        // Primeiro
        // ---------------------------------------------------------------

        if (
            /^(1ª|1º|🥇)/u.test(
                linha
            )
        ) {

            detalhes.push(

                `🥇 **Vencedor:** ` +

                linha.replace(
                    /^(1ª|1º|🥇)\s*/u,
                    ''
                )

            );


            continue;

        }


        // ---------------------------------------------------------------
        // Segundo
        // ---------------------------------------------------------------

        if (
            /^(2ª|2º|🥈)/u.test(
                linha
            )
        ) {

            detalhes.push(

                `🥈 **2º lugar:** ` +

                linha.replace(
                    /^(2ª|2º|🥈)\s*/u,
                    ''
                )

            );


            continue;

        }


        // ---------------------------------------------------------------
        // Terceiro
        // ---------------------------------------------------------------

        if (
            /^(3ª|3º|🥉)/u.test(
                linha
            )
        ) {

            detalhes.push(

                `🥉 **3º lugar:** ` +

                linha.replace(
                    /^(3ª|3º|🥉)\s*/u,
                    ''
                )

            );


            continue;

        }


        // ---------------------------------------------------------------
        // Data
        // ---------------------------------------------------------------

        if (
            linha.startsWith(
                '📅'
            )
        ) {

            detalhes.push(
                linha
            );


            continue;

        }


        // ---------------------------------------------------------------
        // Descrição
        // ---------------------------------------------------------------

        if (
            linha.startsWith(
                '📝'
            )
        ) {

            detalhes.push(
                linha
            );


            continue;

        }


        // ---------------------------------------------------------------
        // Valor
        // ---------------------------------------------------------------

        if (
            linha.startsWith(
                '📊'
            )
        ) {

            detalhes.push(
                linha
            );


            continue;

        }


        // ---------------------------------------------------------------
        // Participantes
        // ---------------------------------------------------------------

        participantes.push(
            linha
        );

    }


    return {

        titulo,

        descricao:

            detalhes.length > 0

                ? detalhes.join(
                    '\n\n'
                )

                : participantes.length > 0

                    ? `👥 **Informações:**\n${participantes.join('\n')}`

                    : '*Nenhuma informação adicional.*'

    };

}


// ========================================================================
// FORMATAR REGISTRO NOVO
// ========================================================================

function formatarRegistroNovo(
    registro
) {

    const campos = [];


    // ====================================================================
    // TIPO
    // ====================================================================

    if (
        registro.tipo
    ) {

        campos.push({

            name:
                '🏷️ TIPO',

            value:

                NOMES_TIPOS[
                    registro.tipo
                ] ||

                registro.tipo,

            inline:
                true

        });

    }


    // ====================================================================
    // PARTICIPANTES
    // ====================================================================

    if (
        registro.participantes
    ) {

        campos.push({

            name:
                '👥 PARTICIPANTES',

            value:
                registro.participantes,

            inline:
                false

        });

    }


    // ====================================================================
    // VENCEDOR
    // ====================================================================

    if (
        registro.vencedor
    ) {

        campos.push({

            name:
                '🥇 VENCEDOR',

            value:
                registro.vencedor,

            inline:
                true

        });

    }


    // ====================================================================
    // SEGUNDO
    // ====================================================================

    if (
        registro.segundo
    ) {

        campos.push({

            name:
                '🥈 2º LUGAR',

            value:
                registro.segundo,

            inline:
                true

        });

    }


    // ====================================================================
    // TERCEIRO
    // ====================================================================

    if (
        registro.terceiro
    ) {

        campos.push({

            name:
                '🥉 3º LUGAR',

            value:
                registro.terceiro,

            inline:
                true

        });

    }


    // ====================================================================
    // PRÊMIO
    // ====================================================================

    if (
        registro.premio
    ) {

        campos.push({

            name:
                '🎁 PRÊMIO',

            value:
                registro.premio,

            inline:
                true

        });

    }


    // ====================================================================
    // VALOR
    // ====================================================================

    if (

        registro.valor !== null &&

        registro.valor !== undefined

    ) {

        campos.push({

            name:
                '📊 VALOR',

            value:
                String(
                    registro.valor
                ),

            inline:
                true

        });

    }


    // ====================================================================
    // DESCRIÇÃO
    // ====================================================================

    if (
        registro.descricao
    ) {

        campos.push({

            name:
                '📝 DESCRIÇÃO',

            value:
                registro.descricao,

            inline:
                false

        });

    }


    // ====================================================================
    // OBSERVAÇÕES
    // ====================================================================

    if (
        registro.observacoes
    ) {

        campos.push({

            name:
                '📌 OBSERVAÇÕES',

            value:
                registro.observacoes,

            inline:
                false

        });

    }


    // ====================================================================
    // DATA
    // ====================================================================

    if (
        registro.data
    ) {

        campos.push({

            name:
                '📅 DATA',

            value:

                registro.horario

                    ? `${registro.data} às ${registro.horario}`

                    : registro.data,

            inline:
                true

        });

    }


    return {

        titulo:

            registro.nome ||
            'Evento histórico',

        campos

    };

}


// ========================================================================
// FORMATAR REGISTRO
// ========================================================================

function formatarRegistro(
    registro
) {

    if (
        typeof registro === 'string'
    ) {

        const antigo =
            formatarRegistroAntigo(
                registro
            );


        return {

            titulo:
                antigo.titulo,

            campos: [

                {

                    name:
                        '📜 REGISTRO',

                    value:
                        antigo.descricao,

                    inline:
                        false

                }

            ]

        };

    }


    if (
        registro &&
        typeof registro === 'object'
    ) {

        return formatarRegistroNovo(
            registro
        );

    }


    return {

        titulo:
            'Evento histórico',

        campos: [

            {

                name:
                    '📜 REGISTRO',

                value:
                    '*Registro inválido.*',

                inline:
                    false

            }

        ]

    };

}


// ========================================================================
// LIMITAR CAMPO
// ========================================================================

function limitarCampo(
    valor
) {

    const texto =
        String(
            valor || ''
        );


    if (
        texto.length <= 1024
    ) {

        return texto;

    }


    return (
        texto.slice(
            0,
            1021
        ) +
        '...'
    );

}


// ========================================================================
// PAGINAÇÃO
// ========================================================================

function calcularPagina(
    total,
    pagina
) {

    const totalPaginas =
        Math.max(
            1,
            total
        );


    const atual =
        Number(
            pagina
        ) || 1;


    return Math.min(

        Math.max(
            1,
            atual
        ),

        totalPaginas

    );

}


// ========================================================================
// BOTÕES
// ========================================================================

function criarBotoes(
    categoria,
    pagina,
    totalPaginas
) {

    const row =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()

                    .setCustomId(
                        `hist_ephem_prev_${categoria}_${pagina}`
                    )

                    .setLabel(
                        'Anterior'
                    )

                    .setEmoji(
                        '⬅️'
                    )

                    .setStyle(
                        ButtonStyle.Secondary
                    )

                    .setDisabled(
                        pagina <= 1
                    ),


                new ButtonBuilder()

                    .setCustomId(
                        `hist_ephem_page_${categoria}_${pagina}`
                    )

                    .setLabel(
                        `${pagina}/${totalPaginas}`
                    )

                    .setStyle(
                        ButtonStyle.Secondary
                    )

                    .setDisabled(
                        true
                    ),


                new ButtonBuilder()

                    .setCustomId(
                        `hist_ephem_next_${categoria}_${pagina}`
                    )

                    .setLabel(
                        'Próximo'
                    )

                    .setEmoji(
                        '➡️'
                    )

                    .setStyle(
                        ButtonStyle.Secondary
                    )

                    .setDisabled(
                        pagina >= totalPaginas
                    ),


                new ButtonBuilder()

                    .setCustomId(
                        'hist_ephem_fechar'
                    )

                    .setLabel(
                        'Fechar'
                    )

                    .setEmoji(
                        '✖️'
                    )

                    .setStyle(
                        ButtonStyle.Danger
                    )

            );


    return row;

}


// ========================================================================
// EMBED DE UM ÚNICO EVENTO
// ========================================================================

function criarEmbedEvento(
    categoria,
    registro,
    pagina,
    totalPaginas
) {

    const config =
        CATEGORIAS[
            categoria
        ];


    if (
        !config
    ) {

        return null;

    }


    const formatado =
        formatarRegistro(
            registro
        );


    const embed =
        new EmbedBuilder()

            .setTitle(
                `${config.emoji} ${formatado.titulo}`
            )

            .setColor(
                config.cor
            )

            .setDescription(

                `📄 **Evento ${pagina} de ${totalPaginas}**\n\n` +

                '━━━━━━━━━━━━━━━━━━━━'

            );


    // ====================================================================
    // CAMPOS
    // ====================================================================

    for (
        const campo
        of formatado.campos
    ) {

        embed.addFields({

            name:

                limitarCampo(
                    campo.name
                ),

            value:

                limitarCampo(
                    campo.value
                ),

            inline:
                Boolean(
                    campo.inline
                )

        });

    }


    // ====================================================================
    // IMAGEM
    // ====================================================================

    if (

        registro &&
        typeof registro === 'object' &&
        registro.imagem

    ) {

        try {

            const url =
                new URL(
                    registro.imagem
                );


            if (
                url.protocol === 'http:' ||
                url.protocol === 'https:'
            ) {

                embed.setImage(
                    registro.imagem
                );

            }

        } catch {}

    }


    // ====================================================================
    // FOOTER
    // ====================================================================

    embed.setFooter({

        text:
            `WorldWarBR • Hall da Fama • Página ${pagina}/${totalPaginas}`

    });


    return embed;

}


// ========================================================================
// MOSTRAR EVENTO
// ========================================================================

async function mostrarEvento(
    interaction,
    categoria,
    pagina
) {

    const historico =
        carregarHistorico();


    const registros =
        historico[
            categoria
        ] || [];


    if (
        !CATEGORIAS[
            categoria
        ]
    ) {

        return interaction.reply({

            content:
                '❌ Categoria inválida.',

            flags:
                MessageFlags.Ephemeral

        });

    }


    const total =
        registros.length;


    const totalPaginas =
        Math.max(
            1,
            total
        );


    const paginaSegura =
        calcularPagina(
            total,
            pagina
        );


    const indice =
        paginaSegura - 1;


    const registro =
        registros[indice];


    if (
        !registro
    ) {

        const embed =
            new EmbedBuilder()

                .setTitle(
                    CATEGORIAS[categoria].titulo
                )

                .setColor(
                    CATEGORIAS[categoria].cor
                )

                .setDescription(
                    '📭 **Nenhum registro encontrado.**'
                );


        return interaction.reply({

            embeds: [

                embed

            ],

            components: [

                criarBotoes(
                    categoria,
                    1,
                    1
                )

            ],

            flags:
                MessageFlags.Ephemeral

        });

    }


    const embed =
        criarEmbedEvento(

            categoria,

            registro,

            paginaSegura,

            totalPaginas

        );


    return interaction.reply({

        content:
            '',

        embeds: [

            embed

        ],

        components: [

            criarBotoes(

                categoria,

                paginaSegura,

                totalPaginas

            )

        ],

        flags:
            MessageFlags.Ephemeral

    });

}


// ========================================================================
// EDITAR EVENTO PRIVADO
// ========================================================================

async function atualizarEvento(
    interaction,
    categoria,
    pagina
) {

    const historico =
        carregarHistorico();


    const registros =
        historico[
            categoria
        ] || [];


    const total =
        registros.length;


    const totalPaginas =
        Math.max(
            1,
            total
        );


    const paginaSegura =
        calcularPagina(
            total,
            pagina
        );


    const registro =
        registros[
            paginaSegura - 1
        ];


    if (
        !registro
    ) {

        return interaction.update({

            content:
                '📭 Nenhum registro encontrado.',

            embeds: [],

            components: []

        });

    }


    const embed =
        criarEmbedEvento(

            categoria,

            registro,

            paginaSegura,

            totalPaginas

        );


    return interaction.update({

        content:
            '',

        embeds: [

            embed

        ],

        components: [

            criarBotoes(

                categoria,

                paginaSegura,

                totalPaginas

            )

        ]

    });

}


// ========================================================================
// INTERAÇÃO
// ========================================================================

module.exports =
    async (
        interaction,
        client
    ) => {

        const id =
            interaction.customId;


        // ================================================================
        // ABRIR CATEGORIA
        // ================================================================

        if (

            id === 'hist_liga' ||

            id === 'hist_imperador' ||

            id === 'hist_eventos' ||

            id === 'hist_records'

        ) {

            const categoria =
                id.replace(
                    'hist_',
                    ''
                );


            return mostrarEvento(

                interaction,

                categoria,

                1

            );

        }


        // ================================================================
        // PRÓXIMO EVENTO
        // ================================================================

        if (
            id.startsWith(
                'hist_ephem_next_'
            )
        ) {

            const partes =
                id.split('_');


            const categoria =
                partes[3];


            const paginaAtual =
                Number(
                    partes[4]
                ) || 1;


            return atualizarEvento(

                interaction,

                categoria,

                paginaAtual + 1

            );

        }


        // ================================================================
        // EVENTO ANTERIOR
        // ================================================================

        if (
            id.startsWith(
                'hist_ephem_prev_'
            )
        ) {

            const partes =
                id.split('_');


            const categoria =
                partes[3];


            const paginaAtual =
                Number(
                    partes[4]
                ) || 1;


            return atualizarEvento(

                interaction,

                categoria,

                paginaAtual - 1

            );

        }


        // ================================================================
        // BOTÃO PÁGINA
        // ================================================================

        if (
            id.startsWith(
                'hist_ephem_page_'
            )
        ) {

            return;

        }


        // ================================================================
        // FECHAR
        // ================================================================

        if (
            id ===
            'hist_ephem_fechar'
        ) {

            return interaction.update({

                content:
                    '✅ **Hall da Fama fechado.**',

                embeds: [],

                components: []

            });

        }

    };