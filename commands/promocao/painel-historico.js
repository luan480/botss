/* ========================================================================
   ARQUIVO: commands/promocao/painel-historico.js

   HALL DA FAMA ÚNICO DO WORLDWARBR

   Categorias:
   🏆 Liga
   👑 Imperadores
   ⚔️ Eventos
   📊 Records
   ======================================================================== */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');


// ========================================================================
// COMANDO
// ========================================================================

module.exports = {

    data: new SlashCommandBuilder()

        .setName('painel-historico')

        .setDescription(
            'Cria o painel único do Hall da Fama do servidor.'
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),


    // ====================================================================
    // EXECUTAR
    // ====================================================================

    async execute(interaction) {

        // ---------------------------------------------------------------
        // EMBED PRINCIPAL
        // ---------------------------------------------------------------

        const embed =
            new EmbedBuilder()

                .setTitle(
                    '🏛️ HALL DA FAMA — WORLDWARBR'
                )

                .setDescription(

                    [
                        'Bem-vindo ao museu dos campeões.',

                        '',

                        'Aqui ficam registrados os jogadores,',
                        'campeões e recordistas que fizeram história no servidor.',

                        '',

                        '🔎 **Escolha uma categoria abaixo:**',

                        '',

                        '🏆 **Liga**',
                        'Campeões e temporadas da Liga.',

                        '',

                        '👑 **Imperadores**',
                        'Histórico dos Imperadores do servidor.',

                        '',

                        '⚔️ **Eventos**',
                        'Campeões dos eventos realizados.',

                        '',

                        '📊 **Records**',
                        'Os maiores feitos e recordes históricos.'

                    ].join('\n')

                )

                .setColor(
                    '#B9BBBE'
                )

                .setImage(
                    'https://i.imgur.com/XFv0Hl7.png'
                )

                .setFooter({

                    text:
                        'WorldWarBR • A história nunca é apagada.'

                })

                .setTimestamp();


        // ---------------------------------------------------------------
        // BOTÕES
        // ---------------------------------------------------------------

        const row =
            new ActionRowBuilder()

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
                            'Imperador'
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


        // ---------------------------------------------------------------
        // ENVIAR PAINEL
        // ---------------------------------------------------------------

        await interaction.reply({

            embeds: [
                embed
            ],

            components: [
                row
            ]

        });

    }

};