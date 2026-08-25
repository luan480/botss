/* ========================================================================
   ARQUIVO: commands/promocao/painel-ranking.js

   MURAL DA FAMA — WARGROW

   RANKINGS:
   🏆 Top 10 Global
   ⚓ Marinha
   🪖 Exército
   ✈️ Aeronáutica
   💰 Mercenários

   HALL DA FAMA:
   🏆 Liga
   👑 Imperadores
   ⚔️ Eventos
   📊 Records

   BANCO:
   commands/promocao/historico.json

   IMPORTANTE:
   - Não cria outro banco de histórico.
   - O ID/canal do mural é salvo dentro do próprio historico.json.
   - O mural pode ser criado ou atualizado.
   ======================================================================== */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const path =
    require('path');

const {
    safeReadJson,
    safeWriteJson
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
// IMAGEM
// ========================================================================

const IMAGEM_MURAL =
    'https://media.discordapp.net/attachments/1082774011676729365/1541522022327390398/Impactful_Tactical_Military_Banner_Design.png?ex=6a8de5c2&is=6a8c9442&hm=3a0dc70639d80e2297fe08618e1268e4ee32b2305f39556e94aee6123b129b7e&=&format=webp&quality=lossless&width=1536&height=865';


// ========================================================================
// CARREGAR HISTÓRICO
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
                [],

            mural:
                null

        };

    }


    return {

        destaque:

            typeof dados.destaque === 'string'
                ? dados.destaque
                : '',

        liga:

            Array.isArray(
                dados.liga
            )
                ? dados.liga
                : [],

        imperador:

            Array.isArray(
                dados.imperador
            )
                ? dados.imperador
                : [],

        eventos:

            Array.isArray(
                dados.eventos
            )
                ? dados.eventos
                : [],

        records:

            Array.isArray(
                dados.records
            )
                ? dados.records
                : [],

        mural:

            dados.mural &&
            typeof dados.mural === 'object'

                ? dados.mural

                : null

    };

}


// ========================================================================
// GARANTIR ESTRUTURA
// ========================================================================

function garantirEstruturaHistorico() {

    const dados =
        safeReadJson(
            HISTORICO_PATH
        );


    const historico =

        dados &&
        typeof dados === 'object'

            ? dados

            : {};


    if (
        !Array.isArray(
            historico.liga
        )
    ) {

        historico.liga = [];

    }


    if (
        !Array.isArray(
            historico.imperador
        )
    ) {

        historico.imperador = [];

    }


    if (
        !Array.isArray(
            historico.eventos
        )
    ) {

        historico.eventos = [];

    }


    if (
        !Array.isArray(
            historico.records
        )
    ) {

        historico.records = [];

    }


    if (
        typeof historico.destaque !==
        'string'
    ) {

        historico.destaque =
            '';

    }


    return historico;

}


// ========================================================================
// NOME DO REGISTRO
// ========================================================================

function obterNomeRegistro(
    registro
) {

    if (
        registro &&
        typeof registro === 'object'
    ) {

        return (

            registro.nome ||
            'Registro histórico'

        );

    }


    if (
        typeof registro === 'string'
    ) {

        const linhas =
            registro.split(
                '\n'
            );


        const linhaNome =
            linhas.find(
                linha =>
                    linha.includes(
                        '🏆'
                    )
            );


        if (
            linhaNome
        ) {

            return linhaNome

                .replace(
                    /\*\*/g,
                    ''
                )

                .replace(
                    '🏆',
                    ''
                )

                .trim();

        }


        return (

            registro
                .slice(
                    0,
                    100
                ) ||

            'Registro histórico'

        );

    }


    return 'Registro histórico';

}


// ========================================================================
// ÚLTIMOS REGISTROS
// ========================================================================

function criarUltimosRegistros(
    historico
) {

    const categorias = [

        {
            chave:
                'liga',

            emoji:
                '🏆'

        },

        {
            chave:
                'imperador',

            emoji:
                '👑'

        },

        {
            chave:
                'eventos',

            emoji:
                '⚔️'

        },

        {
            chave:
                'records',

            emoji:
                '📊'

        }

    ];


    const registros = [];


    for (
        const categoria
        of categorias
    ) {

        const lista =
            historico[
                categoria.chave
            ] || [];


        if (
            !lista.length
        ) {

            continue;

        }


        const ultimo =
            lista[
                lista.length - 1
            ];


        const nome =
            obterNomeRegistro(
                ultimo
            );


        registros.push(

            `${categoria.emoji} **${nome}**`

        );

    }


    if (
        !registros.length
    ) {

        return (
            '*Nenhum registro histórico ainda.*'
        );

    }


    return registros.join(
        '\n'
    );

}


// ========================================================================
// EMBED DO MURAL
// ========================================================================

function criarEmbedMural() {

    const historico =
        carregarHistorico();


    const ultimos =
        criarUltimosRegistros(
            historico
        );


    const embed =
        new EmbedBuilder()

            .setTitle(
                '🏛️ MURAL DA FAMA — WARGROW'
            )

            .setDescription(

                'Quem são os maiores guerreiros da nossa história?\n\n' +

                'Aqui estão reunidos os **rankings competitivos** e os **feitos históricos** que marcaram o servidor.\n\n' +

                '━━━━━━━━━━━━━━━━━━━━\n\n' +

                '🏆 **RANKINGS COMPETITIVOS**\n' +

                'Consulte o Top 10 global ou os melhores de cada facção.\n\n' +

                '🏛️ **HALL DA FAMA**\n' +

                'Consulte campeões, imperadores, eventos e records eternizados.'

            )

            .setColor(
                '#C9A227'
            )

            .setImage(
                IMAGEM_MURAL
            )

            .addFields(

                {

                    name:
                        '📊 REGISTROS HISTÓRICOS',

                    value:

                        `🏆 Liga: **${historico.liga.length}**\n` +

                        `👑 Imperadores: **${historico.imperador.length}**\n` +

                        `⚔️ Eventos: **${historico.eventos.length}**\n` +

                        `📊 Records: **${historico.records.length}**`,

                    inline:
                        true

                },

                {

                    name:
                        '🔥 ÚLTIMOS DESTAQUES',

                    value:
                        ultimos,

                    inline:
                        true

                }

            )

            .setFooter({

                text:
                    'WorldWarBR • Sistema de Competição & Hall da Fama'

            })

            .setTimestamp();


    if (
        historico.destaque
    ) {

        embed.addFields({

            name:
                '🌟 DESTAQUE HISTÓRICO',

            value:

                historico.destaque.length >
                1024

                    ? `${historico.destaque.slice(0, 1020)}...`

                    : historico.destaque,

            inline:
                false

        });

    }


    return embed;

}


// ========================================================================
// BOTÃO GLOBAL
// ========================================================================

function criarBotaoGlobal() {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()

                .setCustomId(
                    'rank_global'
                )

                .setLabel(
                    'Top 10 Global'
                )

                .setEmoji(
                    '🏆'
                )

                .setStyle(
                    ButtonStyle.Success
                )

        );

}


// ========================================================================
// BOTÕES FACÇÕES
// ========================================================================

function criarBotoesFaccao() {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()

                .setCustomId(
                    'rank_marinha'
                )

                .setLabel(
                    'Marinha'
                )

                .setEmoji(
                    '⚓'
                )

                .setStyle(
                    ButtonStyle.Primary
                ),

            new ButtonBuilder()

                .setCustomId(
                    'rank_exercito'
                )

                .setLabel(
                    'Exército'
                )

                .setEmoji(
                    '🪖'
                )

                .setStyle(
                    ButtonStyle.Success
                ),

            new ButtonBuilder()

                .setCustomId(
                    'rank_aeronautica'
                )

                .setLabel(
                    'Aeronáutica'
                )

                .setEmoji(
                    '✈️'
                )

                .setStyle(
                    ButtonStyle.Secondary
                ),

            new ButtonBuilder()

                .setCustomId(
                    'rank_mercenarios'
                )

                .setLabel(
                    'Mercenários'
                )

                .setEmoji(
                    '💰'
                )

                .setStyle(
                    ButtonStyle.Danger
                )

        );

}


// ========================================================================
// BOTÕES HALL
// ========================================================================

function criarBotoesHall() {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()

                .setCustomId(
                    'hist_liga'
                )

                .setLabel(
                    'Liga'
                )

                .setEmoji(
                    '🏆'
                )

                .setStyle(
                    ButtonStyle.Primary
                ),

            new ButtonBuilder()

                .setCustomId(
                    'hist_imperador'
                )

                .setLabel(
                    'Imperadores'
                )

                .setEmoji(
                    '👑'
                )

                .setStyle(
                    ButtonStyle.Success
                ),

            new ButtonBuilder()

                .setCustomId(
                    'hist_eventos'
                )

                .setLabel(
                    'Eventos'
                )

                .setEmoji(
                    '⚔️'
                )

                .setStyle(
                    ButtonStyle.Secondary
                ),

            new ButtonBuilder()

                .setCustomId(
                    'hist_records'
                )

                .setLabel(
                    'Records'
                )

                .setEmoji(
                    '📊'
                )

                .setStyle(
                    ButtonStyle.Danger
                )

        );

}


// ========================================================================
// COMPONENTES DO MURAL
// ========================================================================

function obterComponentesMural() {

    return [

        criarBotaoGlobal(),

        criarBotoesFaccao(),

        criarBotoesHall()

    ];

}


// ========================================================================
// SALVAR REFERÊNCIA DO MURAL
// ========================================================================

function salvarReferenciaMural(
    channelId,
    messageId
) {

    const historico =
        garantirEstruturaHistorico();


    historico.mural = {

        channelId:
            String(
                channelId
            ),

        messageId:
            String(
                messageId
            )

    };


    safeWriteJson(

        HISTORICO_PATH,

        historico

    );


    return historico;

}


// ========================================================================
// ATUALIZAR MURAL EXISTENTE
// ========================================================================

async function atualizarMural(
    guild
) {

    const historico =
        carregarHistorico();


    if (
        !historico.mural
    ) {

        return null;

    }


    if (

        !historico.mural.channelId ||

        !historico.mural.messageId

    ) {

        return null;

    }


    const canal =
        await guild.channels
            .fetch(
                historico.mural.channelId
            )
            .catch(
                () => null
            );


    if (
        !canal ||
        !canal.isTextBased()
    ) {

        return null;

    }


    const mensagem =
        await canal.messages
            .fetch(
                historico.mural.messageId
            )
            .catch(
                () => null
            );


    if (
        !mensagem
    ) {

        return null;

    }


    await mensagem.edit({

        embeds: [

            criarEmbedMural()

        ],

        components:

            obterComponentesMural()

    });


    return mensagem;

}


// ========================================================================
// CRIAR / ATUALIZAR MURAL
// ========================================================================

async function criarMural(
    canal
) {

    if (
        !canal ||
        !canal.isTextBased()
    ) {

        throw new Error(
            'Canal inválido.'
        );

    }


    const historico =
        carregarHistorico();


    // ====================================================================
    // TENTAR ATUALIZAR EXISTENTE
    // ====================================================================

    if (
        historico.mural
    ) {

        const guild =
            canal.guild;


        const atualizado =
            await atualizarMural(
                guild
            );


        if (
            atualizado
        ) {

            return atualizado;

        }

    }


    // ====================================================================
    // CRIAR NOVO
    // ====================================================================

    const mensagem =
        await canal.send({

            embeds: [

                criarEmbedMural()

            ],

            components:

                obterComponentesMural()

        });


    // ====================================================================
    // SALVAR ID
    // ====================================================================

    salvarReferenciaMural(

        canal.id,

        mensagem.id

    );


    return mensagem;

}


// ========================================================================
// COMANDO
// ========================================================================

const comando = {

    data:

        new SlashCommandBuilder()

            .setName(
                'painel-ranking'
            )

            .setDescription(
                '🏛️ Cria ou atualiza o Mural da Fama do servidor.'
            )

            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator
            ),


    async execute(
        interaction
    ) {

        await interaction.deferReply({

            flags:
                MessageFlags.Ephemeral

        });


        try {

            await criarMural(
                interaction.channel
            );


            await interaction.editReply({

                content:
                    '✅ **Mural da Fama criado/atualizado com sucesso!**'

            });


        } catch (erro) {

            console.error(
                '[MURAL] Erro ao criar/atualizar:',
                erro
            );


            await interaction.editReply({

                content:
                    '❌ Não foi possível criar ou atualizar o Mural da Fama.'

            });

        }

    },

    criarMural,

    atualizarMural,

    criarEmbedMural,

    criarBotaoGlobal,

    criarBotoesFaccao,

    criarBotoesHall,

    obterComponentesMural

};


module.exports =
    comando;