const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');


// ========================================================================
// PAINEL DA LIGA
// ========================================================================
//
// IMPORTANTE:
// O seu painel.js atual exporta a função diretamente:
//
// module.exports = async function (...) { ... }
//
// Portanto usamos:
//
// painel(...)
//
// e NÃO:
//
// painel.criarPainelDashboard(...)
// ========================================================================

const painel =
    require('./painel.js');


// ========================================================================
// COMANDO
// ========================================================================

module.exports = {

    data:

        new SlashCommandBuilder()

            .setName(
                'liga'
            )

            .setDescription(
                'Comandos de gerenciamento da Liga.'
            )

            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator
            )

            .addSubcommand(

                subcommand =>

                    subcommand

                        .setName(
                            'painel'
                        )

                        .setDescription(
                            'Cria ou atualiza o painel de controle da Liga.'
                        )

                        .addChannelOption(

                            option =>

                                option

                                    .setName(
                                        'canal'
                                    )

                                    .setDescription(
                                        'O canal onde o painel será criado.'
                                    )

                                    .addChannelTypes(
                                        ChannelType.GuildText
                                    )

                                    .setRequired(
                                        true
                                    )

                        )

            ),


    // ====================================================================
    // EXECUTAR
    // ====================================================================

    async execute(
        interaction
    ) {

        const subcomando =
            interaction.options.getSubcommand();


        // ================================================================
        // PAINEL
        // ================================================================

        if (
            subcomando !==
            'painel'
        ) {

            return;

        }


        // ================================================================
        // CANAL
        // ================================================================

        const canal =
            interaction.options.getChannel(
                'canal'
            );


        if (
            !canal
        ) {

            return interaction.reply({

                content:
                    '❌ Canal da Liga não informado.',

                flags:
                    64

            });

        }


        // ================================================================
        // RESPOSTA
        // ================================================================

        await interaction
            .deferReply({
                flags: 64
            })
            .catch(
                () => {}
            );


        // ================================================================
        // VALIDAR PAINEL
        // ================================================================

        if (
            typeof painel !==
            'function'
        ) {

            console.error(
                '[LIGA] painel.js não exportou uma função válida.'
            );


            return interaction.editReply({

                content:
                    '❌ O `painel.js` não está exportando uma função válida.'

            });

        }


        // ================================================================
        // CRIAR / ATUALIZAR PAINEL
        // ================================================================

        try {

            await painel(

                interaction.guild,

                canal.id

            );


            return interaction.editReply({

                content:

                    `✅ **Painel da Liga criado/atualizado com sucesso!**\n\n` +

                    `📍 Canal: ${canal}`

            });

        } catch (erro) {

            console.error(
                '[LIGA] Erro ao criar painel:',
                erro
            );


            return interaction.editReply({

                content:

                    '❌ **Não foi possível criar o painel da Liga.**\n' +

                    'Verifique o console para o erro detalhado.'

            });

        }

    }

};