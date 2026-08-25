/* ========================================================================
   ARQUIVO: commands/liga/handlers/handleIniciar.js

   MOTOR LÓGICO COMPLETO

   REGRAS:
   - Até a 80ª partida: participa da pontuação da Liga.
   - A partir da 81ª: continua registrando tudo, porém não recebe pontos
     para o ranking competitivo da Liga.
   - Vitória continua contando.
   - Kills continuam contando.
   - Mortes continuam contando.
   - Continentes continuam contando.
   - Progressão continua contando.
   - Histórico continua sendo salvo.
   ======================================================================== */

const path = require('path');
const fs = require('fs');

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags
} = require('discord.js');

const {
    safeReadJson,
    safeWriteJson
} = require('../utils/helpers.js');

const menus =
    require('../utils/menusLiga.js');

const configPontos =
    require('../utils/configPontos.js');

const painelMod =
    require('../painel.js');


// ========================================================================
// LIMITE DE PARTIDAS DA LIGA
// ========================================================================

const MAX_PARTIDAS_LIGA =
    80;


// ========================================================================
// CAMINHOS
// ========================================================================

const economyPath =
    path.join(
        __dirname,
        '..',
        '..',
        'economy',
        'economy.json'
    );


const progressaoPath =
    path.join(
        __dirname,
        '..',
        '..',
        'promocao',
        'progressao.json'
    );


const punicoesPath =
    path.join(
        __dirname,
        '..',
        'punicoes.json'
    );


const carreirasPath =
    path.join(
        __dirname,
        '..',
        '..',
        'promocao',
        'carreiras.json'
    );


const tempPrintsDir =
    path.join(
        __dirname,
        '..',
        '..',
        '..',
        'temp_prints'
    );


// ========================================================================
// CONTAGEM DE PARTIDAS DO JOGADOR
// ========================================================================
//
// Conta TODAS as partidas registradas em partidas.json em que o jogador
// participou.
//
// Isso é intencional:
// a 81ª partida não é apagada nem ignorada; ela apenas fica fora da
// pontuação competitiva da Liga.
//
// ========================================================================

function contarPartidasRegistradasDoJogador(
    partidas,
    jogadorId
) {

    let total = 0;


    for (
        const partida
        of Object.values(
            partidas || {}
        )
    ) {

        if (
            !partida
        ) {

            continue;

        }


        const jogadores =
            Array.isArray(
                partida.jogadoresBrutos
            )

                ? partida.jogadoresBrutos

                : [];


        const participou =
            jogadores.some(
                jogador =>
                    String(
                        jogador?.id
                    ) ===
                    String(
                        jogadorId
                    )
            );


        if (
            participou
        ) {

            total++;

        }

    }


    return total;

}


// ========================================================================
// PAINEL AO VIVO
// ========================================================================

function gerarPainelAoVivo(
    respostas,
    fase,
    anexoPrintPrincipal
) {

    let desc =
        'Preencha os dados usando os menus abaixo. **Este quadro atualiza em tempo real!**';


    if (
        fase === 1
    ) {

        desc =
            '📍 **FASE 1:** Defina o Modo, Vencedor e 2º Lugar.\n\n' +
            desc;

    }


    if (
        fase === 2
    ) {

        desc =
            '📍 **FASE 2:** Registre quem eliminou quem.\n\n' +
            desc;

    }


    if (
        fase === 3
    ) {

        desc =
            '📍 **FASE 3:** Registre as dominações de continente.\n\n' +
            desc;

    }


    if (
        fase === 4
    ) {

        desc =
            '✅ **DADOS CONFIRMADOS!** Gerando quadro final e calculando resultados...';

    }


    const emb =
        new EmbedBuilder()

            .setColor(
                fase === 4
                    ? '#2ECC71'
                    : '#F1C40F'
            )

            .setTitle(
                '📡 LIGA DAS NAÇÕES — PAINEL AO VIVO'
            )

            .setDescription(
                desc
            );


    if (
        anexoPrintPrincipal
    ) {

        emb.setThumbnail(
            anexoPrintPrincipal
        );

    }


    emb.addFields(

        {
            name:
                '⚙️ Modo',

            value:
                respostas.modo
                    ? respostas.modo.toUpperCase()
                    : '⏳ Pendente',

            inline:
                true

        },

        {
            name:
                '🥇 Vencedor',

            value:
                respostas.vencedor
                    ? `<@${respostas.vencedor}>`
                    : '⏳ Pendente',

            inline:
                true

        },

        {
            name:
                '🥈 2º Lugar',

            value:

                respostas.segundo

                    ? (

                        respostas.segundo === '0'

                            ? 'Nenhum'

                            : `<@${respostas.segundo}>`

                    )

                    : '⏳ Pendente',

            inline:
                true

        }

    );


    if (

        fase >= 2 &&

        respostas.abates.length > 0

    ) {

        const abatesAgrupados = {};


        respostas.abates.forEach(
            abate => {

                if (
                    !abatesAgrupados[
                        abate.matador
                    ]
                ) {

                    abatesAgrupados[
                        abate.matador
                    ] = [];

                }


                abatesAgrupados[
                    abate.matador
                ].push(
                    `<@${abate.vitima}>`
                );

            }
        );


        const abatesStr =

            Object.entries(
                abatesAgrupados
            )

                .map(
                    ([matador, vitimas]) =>

                        `⚔️ <@${matador}> eliminou: ` +
                        `${vitimas.join(', ')}`

                )

                .join(
                    '\n'
                );


        emb.addFields({

            name:
                '💀 Histórico de Abates',

            value:
                abatesStr,

            inline:
                false

        });

    }

    else if (
        fase >= 2
    ) {

        emb.addFields({

            name:
                '💀 Histórico de Abates',

            value:
                '*Nenhuma baixa registrada ainda.*',

            inline:
                false

        });

    }


    if (

        fase >= 3 &&

        respostas.continentes.length > 0

    ) {

        const contsAgrupados = {};


        respostas.continentes.forEach(
            continente => {

                if (
                    !contsAgrupados[
                        continente.dono
                    ]
                ) {

                    contsAgrupados[
                        continente.dono
                    ] = [];

                }


                const infoContinente =
                    configPontos.continentes[
                        continente.cont
                    ];


                const nomeContinente =
                    infoContinente?.nome ||
                    continente.cont;


                contsAgrupados[
                    continente.dono
                ].push(
                    `**${nomeContinente}**`
                );

            }
        );


        const contStr =

            Object.entries(
                contsAgrupados
            )

                .map(
                    ([dono, conts]) =>

                        `🌍 <@${dono}> dominou: ` +
                        `${conts.join(', ')}`

                )

                .join(
                    '\n'
                );


        emb.addFields({

            name:
                '🗺️ Mapa Global',

            value:
                contStr,

            inline:
                false

        });

    }

    else if (
        fase >= 3
    ) {

        emb.addFields({

            name:
                '🗺️ Mapa Global',

            value:
                '*Nenhum continente dominado.*',

            inline:
                false

        });

    }


    return emb;

}


// ========================================================================
// MOTOR PRINCIPAL
// ========================================================================

module.exports =
    async (
        client,
        interaction,
        pontuacaoPath,
        partidasPath
    ) => {

        try {

            // ============================================================
            // VOZ
            // ============================================================

            const member =
                interaction.member;


            const voiceChannel =
                member.voice.channel;


            if (
                !voiceChannel
            ) {

                return interaction.editReply({

                    content:
                        '❌ Entre em uma call primeiro!'

                });

            }


            // ============================================================
            // JOGADORES NA CALL
            // ============================================================

            const jogadoresNaCall =
                voiceChannel.members.filter(
                    jogador =>
                        !jogador.user.bot
                );


            // ============================================================
            // CRIAR TÓPICO
            // ============================================================

            const topico =
                await interaction.channel.threads.create({

                    name:
                        `registro-${interaction.user.username}-${Date.now().toString().slice(-4)}`,

                    autoArchiveDuration:
                        60,

                    type:
                        ChannelType.PrivateThread

                });


            await topico.members
                .add(
                    interaction.user.id
                );


            await interaction.editReply({

                content:
                    `✅ **Operação Iniciada!** Vá para o tópico para preencher os dados: ${topico}`

            });


            // ============================================================
            // PRINTS
            // ============================================================

            await topico.send(

                '📸 **PASSO 1:** Envie **TODOS OS PRINTS** de comprovação ' +
                '(se for mais de um, mande todos na mesma mensagem).'

            );


            const filterMsg =
                mensagem =>
                    jogadoresNaCall.has(
                        mensagem.author.id
                    ) ||
                    mensagem.author.id ===
                    interaction.user.id;


            const collectedMsg =
                await topico
                    .awaitMessages({

                        filter:
                            filterMsg,

                        max:
                            1,

                        time:
                            120000

                    })
                    .catch(
                        () => null
                    );


            const mensagemPrint =
                collectedMsg?.first();


            if (

                !mensagemPrint ||

                mensagemPrint.attachments.size === 0

            ) {

                await topico.send(

                    '❌ Tempo esgotado ou mensagem sem imagens. Tópico será deletado.'

                );


                setTimeout(
                    async () => {

                        await topico
                            .delete()
                            .catch(
                                () => {}
                            );

                    },

                    3000

                );


                return;

            }


            // ============================================================
            // URLS DOS PRINTS
            // ============================================================

            const anexosUrls =
                Array.from(
                    mensagemPrint.attachments.values()
                )
                    .map(
                        attachment =>
                            attachment.url
                    );


            const anexoPrintPrincipal =
                anexosUrls[0];


            // ============================================================
            // PARTICIPANTES
            // ============================================================

            let jogadoresBrutos = [];


            while (
                true
            ) {

                await topico.send(

                    '👥 **PASSO 2:** Mencione (`@`) os **6 jogadores** na mesma mensagem.'

                );


                const msgJogadores =
                    await topico
                        .awaitMessages({

                            filter:
                                filterMsg,

                            max:
                                1,

                            time:
                                120000

                        })
                        .catch(
                            () => null
                        );


                if (
                    !msgJogadores
                ) {

                    setTimeout(

                        async () => {

                            await topico
                                .delete()
                                .catch(
                                    () => {}
                                );

                        },

                        3000

                    );


                    return;

                }


                const mentions =
                    msgJogadores
                        .first()
                        .mentions
                        .users
                        .filter(
                            usuario =>
                                !usuario.bot
                        );


                if (
                    mentions.size >= 6
                ) {

                    jogadoresBrutos =
                        Array.from(
                            mentions.values()
                        );


                    break;

                }


                await topico.send(
                    '❌ Preciso de 6 jogadores.'
                );

            }


            // ============================================================
            // PROGRESSÃO
            // ============================================================

            const progressaoData =
                safeReadJson(
                    progressaoPath
                );


            const jogadoresInfo =
                jogadoresBrutos.map(

                    jogador => {

                        const vit =
                            progressaoData[
                                jogador.id
                            ]

                                ? (

                                    progressaoData[
                                        jogador.id
                                    ].totalWins || 0

                                )

                                : 0;


                        return {

                            id:
                                jogador.id,

                            username:
                                jogador.username,

                            label:
                                `${jogador.username} 🏆 ${vit} vit`

                        };

                    }

                );


            // ============================================================
            // RESPOSTAS
            // ============================================================

            const respostas = {

                vencedor:
                    null,

                segundo:
                    null,

                modo:
                    null,

                abates:
                    [],

                continentes:
                    []

            };


            let fase =
                1;


            let jogadoresMortos =
                [];


            // ============================================================
            // CONTINENTES
            // ============================================================

            const continentesDispTotal =

                Object.entries(
                    configPontos.continentes
                )

                    .map(

                        ([id, info]) => ({

                            label:
                                `${info.nome} (+${info.pontos} pts)`,

                            value:
                                id

                        })

                    );


            let continentesDisp =
                [
                    ...continentesDispTotal
                ];


            // ============================================================
            // PAINEL AO VIVO
            // ============================================================

            let painelMsg =
                await topico.send({

                    embeds: [

                        gerarPainelAoVivo(

                            respostas,

                            fase,

                            anexoPrintPrincipal

                        )

                    ],

                    components:

                        menus.criarPainelFase1(

                            jogadoresInfo,

                            respostas

                        )

                });


            // ============================================================
            // FASES
            // ============================================================

            while (
                fase < 4
            ) {

                const int =
                    await painelMsg
                        .awaitMessageComponent({

                            filter:
                                i =>
                                    i.user.id ===
                                    interaction.user.id,

                            time:
                                180000

                        })
                        .catch(
                            () => null
                        );


                if (
                    !int
                ) {

                    await topico.send(
                        '❌ Tempo esgotado. Tópico deletado.'
                    );


                    setTimeout(

                        async () => {

                            await topico
                                .delete()
                                .catch(
                                    () => {}
                                );

                        },

                        3000

                    );


                    return;

                }


                // ========================================================
                // FASE 1
                // ========================================================

                if (
                    fase === 1
                ) {

                    if (
                        int.customId ===
                        'sel_modo'
                    ) {

                        respostas.modo =
                            int.values[0];

                    }


                    if (
                        int.customId ===
                        'sel_venc'
                    ) {

                        respostas.vencedor =
                            int.values[0];


                        if (
                            respostas.segundo ===
                            respostas.vencedor
                        ) {

                            respostas.segundo =
                                null;

                        }

                    }


                    if (
                        int.customId ===
                        'sel_seg'
                    ) {

                        respostas.segundo =
                            int.values[0];

                    }


                    if (
                        int.customId ===
                        'reset_p1'
                    ) {

                        respostas.vencedor =
                            null;

                        respostas.segundo =
                            null;

                        respostas.modo =
                            null;

                    }


                    if (
                        int.customId ===
                        'btn_confirmar_p1'
                    ) {

                        if (

                            !respostas.vencedor ||

                            !respostas.segundo ||

                            !respostas.modo

                        ) {

                            await int.reply({

                                content:
                                    '❌ Preencha todas as 3 caixas antes de avançar!',

                                flags:
                                    MessageFlags.Ephemeral

                            });


                            continue;

                        }


                        fase =
                            2;


                        await int.update({

                            embeds: [

                                gerarPainelAoVivo(

                                    respostas,

                                    fase,

                                    anexoPrintPrincipal

                                )

                            ],

                            components: [

                                menus.criarBotoesAbate()

                            ]

                        });


                        continue;

                    }


                    await int.update({

                        embeds: [

                            gerarPainelAoVivo(

                                respostas,

                                fase,

                                anexoPrintPrincipal

                            )

                        ],

                        components:

                            menus.criarPainelFase1(

                                jogadoresInfo,

                                respostas

                            )

                    });

                }


                // ========================================================
                // FASE 2
                // ========================================================

                else if (
                    fase === 2
                ) {

                    if (
                        int.customId ===
                        'reset_abates'
                    ) {

                        respostas.abates =
                            [];

                        jogadoresMortos =
                            [];


                        await int.update({

                            embeds: [

                                gerarPainelAoVivo(

                                    respostas,

                                    fase,

                                    anexoPrintPrincipal

                                )

                            ],

                            components: [

                                menus.criarBotoesAbate()

                            ]

                        });


                        continue;

                    }


                    if (
                        int.customId ===
                        'fim_abates'
                    ) {

                        fase =
                            3;


                        await int.update({

                            embeds: [

                                gerarPainelAoVivo(

                                    respostas,

                                    fase,

                                    anexoPrintPrincipal

                                )

                            ],

                            components: [

                                menus.criarBotoesContinente()

                            ]

                        });


                        continue;

                    }


                    if (
                        int.customId ===
                        'add_abate_lote'
                    ) {

                        await int.update({

                            components: [

                                menus.criarMenuMatador(
                                    jogadoresInfo
                                )

                            ]

                        });


                        const intMatador =
                            await painelMsg
                                .awaitMessageComponent({

                                    filter:
                                        i =>
                                            i.user.id ===
                                            interaction.user.id,

                                    time:
                                        60000

                                })
                                .catch(
                                    () => null
                                );


                        if (
                            !intMatador
                        ) {

                            await painelMsg
                                .edit({

                                    components: [

                                        menus.criarBotoesAbate()

                                    ]

                                });


                            continue;

                        }


                        const matadorId =
                            intMatador.values[0];


                        const assassinosDoMatador =
                            respostas.abates

                                .filter(
                                    a =>
                                        a.vitima ===
                                        matadorId
                                )

                                .map(
                                    a =>
                                        a.matador
                                );


                        const vitimasValidasInfo =
                            jogadoresInfo.filter(

                                jogador =>

                                    jogador.id !==
                                    respostas.vencedor &&

                                    jogador.id !==
                                    respostas.segundo &&

                                    !jogadoresMortos.includes(
                                        jogador.id
                                    ) &&

                                    !assassinosDoMatador.includes(
                                        jogador.id
                                    )

                            );


                        await intMatador
                            .update({

                                components: [

                                    menus.criarMenuMultiplasVitimas(

                                        vitimasValidasInfo,

                                        matadorId

                                    )

                                ]

                            });


                        const intVitimas =
                            await painelMsg
                                .awaitMessageComponent({

                                    filter:
                                        i =>
                                            i.user.id ===
                                            interaction.user.id,

                                    time:
                                        60000

                                })
                                .catch(
                                    () => null
                                );


                        if (
                            !intVitimas
                        ) {

                            await painelMsg
                                .edit({

                                    components: [

                                        menus.criarBotoesAbate()

                                    ]

                                });


                            continue;

                        }


                        intVitimas.values
                            .forEach(
                                vitimaId => {

                                    if (
                                        matadorId !==
                                        vitimaId
                                    ) {

                                        respostas.abates.push({

                                            matador:
                                                matadorId,

                                            vitima:
                                                vitimaId

                                        });


                                        if (
                                            !jogadoresMortos.includes(
                                                vitimaId
                                            )
                                        ) {

                                            jogadoresMortos.push(
                                                vitimaId
                                            );

                                        }

                                    }

                                }
                            );


                        await intVitimas.update({

                            embeds: [

                                gerarPainelAoVivo(

                                    respostas,

                                    fase,

                                    anexoPrintPrincipal

                                )

                            ],

                            components: [

                                menus.criarBotoesAbate()

                            ]

                        });

                    }

                }


                // ========================================================
                // FASE 3
                // ========================================================

                else if (
                    fase === 3
                ) {

                    if (
                        int.customId ===
                        'reset_conts'
                    ) {

                        respostas.continentes =
                            [];

                        continentesDisp =
                            [
                                ...continentesDispTotal
                            ];


                        await int.update({

                            embeds: [

                                gerarPainelAoVivo(

                                    respostas,

                                    fase,

                                    anexoPrintPrincipal

                                )

                            ],

                            components: [

                                menus.criarBotoesContinente()

                            ]

                        });


                        continue;

                    }


                    if (
                        int.customId ===
                        'fim_cont'
                    ) {

                        fase =
                            4;


                        await int.update({

                            embeds: [

                                gerarPainelAoVivo(

                                    respostas,

                                    4,

                                    anexoPrintPrincipal

                                )

                            ],

                            components:
                                []

                        });


                        break;

                    }


                    if (
                        int.customId ===
                        'add_cont_lote'
                    ) {

                        const jogadoresVivosInfo =
                            jogadoresInfo.filter(

                                jogador =>
                                    !jogadoresMortos.includes(
                                        jogador.id
                                    )

                            );


                        if (
                            continentesDisp.length === 0
                        ) {

                            await int.reply({

                                content:
                                    '❌ Todos os continentes já foram registrados!',

                                flags:
                                    MessageFlags.Ephemeral

                            });


                            continue;

                        }


                        if (
                            jogadoresVivosInfo.length === 0
                        ) {

                            await int.reply({

                                content:
                                    '❌ Não há sobreviventes!',

                                flags:
                                    MessageFlags.Ephemeral

                            });


                            continue;

                        }


                        await int.update({

                            components: [

                                menus.criarMenuDonoContinente(

                                    jogadoresVivosInfo

                                )

                            ]

                        });


                        const intDono =
                            await painelMsg
                                .awaitMessageComponent({

                                    filter:
                                        i =>
                                            i.user.id ===
                                            interaction.user.id,

                                    time:
                                        60000

                                })
                                .catch(
                                    () => null
                                );


                        if (
                            !intDono
                        ) {

                            await painelMsg
                                .edit({

                                    components: [

                                        menus.criarBotoesContinente()

                                    ]

                                });


                            continue;

                        }


                        const donoId =
                            intDono.values[0];


                        await intDono
                            .update({

                                components: [

                                    menus.criarMenuMultiplosContinentes(

                                        continentesDisp

                                    )

                                ]

                            });


                        const intConts =
                            await painelMsg
                                .awaitMessageComponent({

                                    filter:
                                        i =>
                                            i.user.id ===
                                            interaction.user.id,

                                    time:
                                        60000

                                })
                                .catch(
                                    () => null
                                );


                        if (
                            !intConts
                        ) {

                            await painelMsg
                                .edit({

                                    components: [

                                        menus.criarBotoesContinente()

                                    ]

                                });


                            continue;

                        }


                        intConts.values
                            .forEach(
                                contVal => {

                                    respostas.continentes.push({

                                        cont:
                                            contVal,

                                        dono:
                                            donoId

                                    });

                                }
                            );


                        continentesDisp =
                            continentesDisp
                                .filter(

                                    continente =>

                                        !intConts.values.includes(
                                            continente.value
                                        )

                                );


                        await intConts.update({

                            embeds: [

                                gerarPainelAoVivo(

                                    respostas,

                                    fase,

                                    anexoPrintPrincipal

                                )

                            ],

                            components: [

                                menus.criarBotoesContinente()

                            ]

                        });

                    }

                }

            }


            // ============================================================
            // TABELA DA PARTIDA
            // ============================================================

            const tabela = {};


            jogadoresBrutos.forEach(
                jogador => {

                    tabela[jogador.id] = {

                        pts:
                            0,

                        vitoria:
                            0,

                        wc:
                            0,

                        detalhes:
                            []

                    };

                }
            );


            const garantirJogador =
                id => {

                    if (
                        !id
                    ) {

                        return;

                    }


                    if (
                        !tabela[id]
                    ) {

                        tabela[id] = {

                            pts:
                                0,

                            vitoria:
                                0,

                            wc:
                                0,

                            detalhes:
                                []

                        };

                    }

                };


            // ============================================================
            // VENCEDOR
            // ============================================================

            garantirJogador(
                respostas.vencedor
            );


            const ptsVitoria =

                respostas.modo ===
                'objetivo'

                    ? configPontos.vitoria.objetivo

                    : configPontos.vitoria.territorios;


            tabela[
                respostas.vencedor
            ].pts +=
                ptsVitoria;


            tabela[
                respostas.vencedor
            ].vitoria =
                1;


            tabela[
                respostas.vencedor
            ].detalhes.push(

                `+${ptsVitoria} Vitória`

            );


            // ============================================================
            // SEGUNDO LUGAR
            // ============================================================

            if (

                respostas.segundo &&

                respostas.segundo !== '0'

            ) {

                garantirJogador(
                    respostas.segundo
                );


                tabela[
                    respostas.segundo
                ].pts +=
                    configPontos.segundoLugar;


                tabela[
                    respostas.segundo
                ].detalhes.push(

                    `+${configPontos.segundoLugar} 2º Lugar`

                );

            }


            // ============================================================
            // CONTINENTES
            // ============================================================

            respostas.continentes
                .forEach(
                    continente => {

                        garantirJogador(
                            continente.dono
                        );


                        const configContinente =
                            configPontos.continentes[
                                continente.cont
                            ];


                        if (
                            !configContinente
                        ) {

                            return;

                        }


                        const ptsCont =
                            Number(
                                configContinente.pontos
                            ) || 0;


                        tabela[
                            continente.dono
                        ].pts +=
                            ptsCont;


                        tabela[
                            continente.dono
                        ].detalhes.push(

                            `+${ptsCont} ` +
                            `${configContinente.nome}`

                        );

                    }
                );


            // ============================================================
            // ABATES
            // ============================================================

            const vitimasIds = [];


            respostas.abates
                .forEach(
                    abate => {

                        garantirJogador(
                            abate.matador
                        );


                        garantirJogador(
                            abate.vitima
                        );


                        tabela[
                            abate.matador
                        ].pts +=
                            configPontos.combate.kill;


                        tabela[
                            abate.matador
                        ].detalhes.push(

                            `+${configPontos.combate.kill} Abate`

                        );


                        tabela[
                            abate.vitima
                        ].pts +=
                            configPontos.combate.morte;


                        tabela[
                            abate.vitima
                        ].detalhes.push(

                            `${configPontos.combate.morte} Morte`

                        );


                        if (
                            !vitimasIds.includes(
                                abate.vitima
                            )
                        ) {

                            vitimasIds.push(
                                abate.vitima
                            );

                        }

                    }
                );


            // ============================================================
            // SOBREVIVÊNCIA
            // ============================================================

            let logSobreviventes =
                '';


            const sobreviventesArr =
                [];


            jogadoresBrutos.forEach(
                jogador => {

                    if (
                        !vitimasIds.includes(
                            jogador.id
                        )
                    ) {

                        tabela[
                            jogador.id
                        ].pts +=
                            configPontos.sobrevivencia;


                        tabela[
                            jogador.id
                        ].detalhes.push(

                            `+${configPontos.sobrevivencia} Sobrevivência`

                        );


                        sobreviventesArr.push(
                            `<@${jogador.id}>`
                        );

                    }

                }
            );


            if (
                sobreviventesArr.length > 0
            ) {

                logSobreviventes =

                    `🛡️ ${sobreviventesArr.join(', ')}` +

                    ` (+${configPontos.sobrevivencia} pts)`;

            }


            // ============================================================
            // CARREGAR DADOS
            // ============================================================

            const pontuacao =
                safeReadJson(
                    pontuacaoPath
                );


            const economy =
                safeReadJson(
                    economyPath
                );


            const partidas =
                safeReadJson(
                    partidasPath
                );


            const punicoes =
                safeReadJson(
                    punicoesPath
                );


            const carreirasConfig =
                safeReadJson(
                    carreirasPath
                );


            // ============================================================
            // REGRA DOS 80
            // ============================================================
            //
            // Calculamos quantas partidas cada jogador já possui ANTES
            // desta nova partida.
            //
            // Exemplo:
            //
            // 79 anteriores -> esta será a 80ª -> entra na Liga.
            // 80 anteriores -> esta será a 81ª -> fora da pontuação.
            //
            // ============================================================

            const partidasAntesDaAtual =
                {};


            for (
                const jogador
                of jogadoresBrutos
            ) {

                partidasAntesDaAtual[
                    jogador.id
                ] =
                    contarPartidasRegistradasDoJogador(

                        partidas,

                        jogador.id

                    );

            }


            // ============================================================
            // RESUMO
            // ============================================================

            let resumo =
                '';


            let avisoDesertorLog =
                '';


            let avisoForaDaLigaLog =
                '';


            // ============================================================
            // PROCESSAR JOGADORES
            // ============================================================

            for (
                const [
                    uid,
                    d
                ]
                of Object.entries(
                    tabela
                )
            ) {

                // --------------------------------------------------------
                // NÚMERO DA PARTIDA DESTE JOGADOR
                // --------------------------------------------------------

                const partidasAntes =
                    Number(
                        partidasAntesDaAtual[uid]
                    ) || 0;


                const numeroPartida =
                    partidasAntes + 1;


                // --------------------------------------------------------
                // VERIFICAR SE A PARTIDA ENTRA NA LIGA
                // --------------------------------------------------------

                const entraNaLiga =
                    numeroPartida <=
                    MAX_PARTIDAS_LIGA;


                // --------------------------------------------------------
                // SALVAR INFORMAÇÃO NA TABELA
                // --------------------------------------------------------

                d.numeroPartida =
                    numeroPartida;


                d.partidasAntes =
                    partidasAntes;


                d.entraNaLiga =
                    entraNaLiga;


                // --------------------------------------------------------
                // PUNIÇÃO DE DESERTOR
                // --------------------------------------------------------

                const punicaoAtiva =
                    punicoes[uid];


                if (

                    punicaoAtiva &&

                    punicaoAtiva.nivel ===
                    'desertor'

                ) {

                    if (
                        Date.now() <
                        punicaoAtiva.expiraEm
                    ) {

                        const pontosOriginais =
                            d.pts;


                        d.pts =
                            0;


                        d.wc =
                            0;


                        d.vitoria =
                            0;


                        avisoDesertorLog +=

                            `🏴‍☠️ <@${uid}>\n`;


                        resumo +=

                            `🔹 <@${uid}>: **0 pts** ` +
                            `*(Punição por Deserção)*\n`;


                        // ------------------------------------------------
                        // Importante:
                        // A partida continua sendo registrada.
                        // Vitória progressão não será dada aqui por causa
                        // da punição.
                        // ------------------------------------------------

                        continue;

                    }


                    delete punicoes[
                        uid
                    ];


                    safeWriteJson(
                        punicoesPath,
                        punicoes
                    );

                }


                // --------------------------------------------------------
                // REGRA DAS 80 PARTIDAS
                // --------------------------------------------------------

                if (
                    !entraNaLiga
                ) {

                    const pontosBloqueados =
                        d.pts;


                    d.pts =
                        0;


                    d.wc =
                        0;


                    avisoForaDaLigaLog +=

                        `📌 <@${uid}> — ` +

                        `**${numeroPartida}ª partida** ` +

                        `(fora da pontuação da Liga)\n`;


                    // ----------------------------------------------------
                    // Os detalhes são preservados no histórico.
                    // ----------------------------------------------------

                    if (
                        pontosBloqueados !== 0
                    ) {

                        d.detalhes.push(

                            `🚫 ${pontosBloqueados > 0 ? '+' : ''}` +
                            `${pontosBloqueados} pts fora da Liga`

                        );

                    }

                }


                // --------------------------------------------------------
                // PONTUAÇÃO DA LIGA
                // --------------------------------------------------------

                if (
                    entraNaLiga
                ) {

                    pontuacao[uid] =
                        (
                            Number(
                                pontuacao[uid]
                            ) || 0
                        ) +
                        d.pts;

                }


                // --------------------------------------------------------
                // WARCOINS
                // --------------------------------------------------------
                //
                // Mantemos a lógica existente:
                // os WarCoins só são calculados quando existem pontos
                // positivos na premiação.
                //
                // Depois da 80ª, os pontos de Liga são 0, então não há
                // WarCoins provenientes desses pontos.
                //
                // --------------------------------------------------------

                if (
                    d.pts > 0
                ) {

                    d.wc =
                        d.pts *
                        100;


                    economy[uid] =
                        (
                            Number(
                                economy[uid]
                            ) || 0
                        ) +
                        d.wc;

                }


                // --------------------------------------------------------
                // PROGRESSÃO
                // --------------------------------------------------------

                if (
                    !progressaoData[uid]
                ) {

                    const membroBusca =
                        jogadoresBrutos.find(
                            jogador =>
                                jogador.id ===
                                uid
                        );


                    progressaoData[uid] = {

                        totalWins:
                            0,

                        nome:
                            membroBusca
                                ? membroBusca.username
                                : 'Desconhecido'

                    };

                }


                // --------------------------------------------------------
                // VITÓRIA CONTINUA VALENDO MESMO APÓS 80
                // --------------------------------------------------------

                if (
                    d.vitoria === 1
                ) {

                    progressaoData[uid].totalWins =

                        (
                            Number(
                                progressaoData[uid].totalWins
                            ) || 0
                        ) + 1;


                    progressaoData[uid].vitoriasSemanais =

                        (
                            Number(
                                progressaoData[uid].vitoriasSemanais
                            ) || 0
                        ) + 1;


                    progressaoData[uid].vitoriasMensais =

                        (
                            Number(
                                progressaoData[uid].vitoriasMensais
                            ) || 0
                        ) + 1;


                    // ----------------------------------------------------
                    // PATENTE
                    // ----------------------------------------------------

                    if (

                        progressaoData[uid].factionId &&

                        carreirasConfig.faccoes &&

                        carreirasConfig.faccoes[
                            progressaoData[uid].factionId
                        ]

                    ) {

                        const faccao =
                            carreirasConfig.faccoes[
                                progressaoData[uid].factionId
                            ];


                        let rankCorretoObj =
                            null;


                        for (
                            const rank
                            of faccao.caminho || []
                        ) {

                            if (

                                progressaoData[uid].totalWins >=

                                Number(
                                    rank.custo
                                )

                            ) {

                                rankCorretoObj =
                                    rank;

                            }

                        }


                        if (

                            rankCorretoObj &&

                            progressaoData[uid].currentRankId !==
                            rankCorretoObj.id

                        ) {

                            progressaoData[uid].currentRankId =
                                rankCorretoObj.id;


                            try {

                                const memberDiscord =

                                    await interaction.guild.members
                                        .fetch(
                                            uid
                                        )
                                        .catch(
                                            () => null
                                        );


                                if (
                                    memberDiscord
                                ) {

                                    await memberDiscord.roles

                                        .add(
                                            rankCorretoObj.id
                                        )

                                        .catch(
                                            () => {}
                                        );


                                    for (
                                        const r
                                        of faccao.caminho || []
                                    ) {

                                        if (

                                            r.id !==
                                            rankCorretoObj.id &&

                                            memberDiscord.roles.cache.has(
                                                r.id
                                            )

                                        ) {

                                            await memberDiscord.roles

                                                .remove(
                                                    r.id
                                                )

                                                .catch(
                                                    () => {}
                                                );

                                        }

                                    }

                                }

                            } catch (erro) {

                                console.error(
                                    '[LIGA] Erro ao atualizar patente:',
                                    erro
                                );

                            }

                        }

                    }

                }


                // --------------------------------------------------------
                // RESUMO
                // --------------------------------------------------------

                const textoDetalhes =

                    d.detalhes.length > 0

                        ? ` *(${d.detalhes.join(', ')})*`

                        : '';


                if (
                    !entraNaLiga
                ) {

                    resumo +=

                        `🔹 <@${uid}>: **0 pts Liga** ` +

                        `*(partida ${numeroPartida} fora da disputa)*` +

                        `${textoDetalhes}\n`;

                } else {

                    resumo +=

                        `🔹 <@${uid}>: **${d.pts > 0 ? '+' : ''}${d.pts} pts**` +

                        `${textoDetalhes}\n`;

                }

            }


            // ============================================================
            // PARTIDAS SEMANAIS
            // ============================================================

            jogadoresBrutos.forEach(
                jogador => {

                    if (
                        !progressaoData[
                            jogador.id
                        ]
                    ) {

                        progressaoData[
                            jogador.id
                        ] = {

                            totalWins:
                                0,

                            nome:
                                jogador.username

                        };

                    }


                    progressaoData[
                        jogador.id
                    ].partidasSemanais =

                        (
                            Number(
                                progressaoData[
                                    jogador.id
                                ].partidasSemanais
                            ) || 0
                        ) + 1;


                    // ----------------------------------------------------
                    // TOTAL DE PARTIDAS REGISTRADAS
                    // ----------------------------------------------------

                    progressaoData[
                        jogador.id
                    ].partidasLigaTotal =

                        (
                            Number(
                                progressaoData[
                                    jogador.id
                                ].partidasLigaTotal
                            ) || 0
                        ) + 1;


                    // ----------------------------------------------------
                    // CONTADOR DE PARTICIPAÇÕES NA LIGA
                    // ----------------------------------------------------

                    const contadorAnterior =

                        Number(
                            progressaoData[
                                jogador.id
                            ].partidasConsideradasLiga
                        ) || 0;


                    if (
                        contadorAnterior <
                        MAX_PARTIDAS_LIGA
                    ) {

                        progressaoData[
                            jogador.id
                        ].partidasConsideradasLiga =

                            Math.min(

                                MAX_PARTIDAS_LIGA,

                                contadorAnterior + 1

                            );

                    }

                }

            );


            // ============================================================
            // KILLS / MORTES
            // ============================================================

            respostas.abates
                .forEach(
                    abate => {

                        if (
                            progressaoData[
                                abate.matador
                            ]
                        ) {

                            progressaoData[
                                abate.matador
                            ].killsSemanais =

                                (
                                    Number(
                                        progressaoData[
                                            abate.matador
                                        ].killsSemanais
                                    ) || 0
                                ) + 1;

                        }


                        if (
                            progressaoData[
                                abate.vitima
                            ]
                        ) {

                            progressaoData[
                                abate.vitima
                            ].mortesSemanais =

                                (
                                    Number(
                                        progressaoData[
                                            abate.vitima
                                        ].mortesSemanais
                                    ) || 0
                                ) + 1;

                        }

                    }
                );


            // ============================================================
            // CONTINENTES
            // ============================================================

            respostas.continentes
                .forEach(
                    continente => {

                        if (
                            progressaoData[
                                continente.dono
                            ]
                        ) {

                            const chave =
                                `${continente.cont}Semanal`;


                            progressaoData[
                                continente.dono
                            ][chave] =

                                (
                                    Number(
                                        progressaoData[
                                            continente.dono
                                        ][chave]
                                    ) || 0
                                ) + 1;

                        }

                    }
                );


            // ============================================================
            // SALVAR PUNIÇÕES
            // ============================================================

            safeWriteJson(
                punicoesPath,
                punicoes
            );


            // ============================================================
            // SALVAR
            // ============================================================

            safeWriteJson(
                pontuacaoPath,
                pontuacao
            );


            safeWriteJson(
                economyPath,
                economy
            );


            safeWriteJson(
                progressaoPath,
                progressaoData
            );


            // ============================================================
            // LOG DE ABATES
            // ============================================================

            let logAbates =
                '';


            if (
                respostas.abates.length > 0
            ) {

                const abatesAgrupadosLog =
                    {};


                respostas.abates.forEach(
                    abate => {

                        if (
                            !abatesAgrupadosLog[
                                abate.matador
                            ]
                        ) {

                            abatesAgrupadosLog[
                                abate.matador
                            ] = [];

                        }


                        abatesAgrupadosLog[
                            abate.matador
                        ].push(
                            `<@${abate.vitima}>`
                        );

                    }
                );


                logAbates =

                    Object.entries(
                        abatesAgrupadosLog
                    )

                        .map(
                            ([matador, vitimas]) =>

                                `⚔️ <@${matador}> eliminou: ` +
                                `${vitimas.join(', ')}`

                        )

                        .join(
                            '\n'
                        );

            }


            // ============================================================
            // LOG DE CONTINENTES
            // ============================================================

            let logContinentes =
                '';


            if (
                respostas.continentes.length > 0
            ) {

                const contsAgrupadosLog =
                    {};


                respostas.continentes.forEach(
                    continente => {

                        if (
                            !contsAgrupadosLog[
                                continente.dono
                            ]
                        ) {

                            contsAgrupadosLog[
                                continente.dono
                            ] = [];

                        }


                        const infoContinente =
                            configPontos.continentes[
                                continente.cont
                            ];


                        contsAgrupadosLog[
                            continente.dono
                        ].push(

                            `**${infoContinente?.nome || continente.cont}**`

                        );

                    }
                );


                logContinentes =

                    Object.entries(
                        contsAgrupadosLog
                    )

                        .map(
                            ([dono, conts]) =>

                                `🌍 <@${dono}> dominou: ` +
                                `${conts.join(', ')}`

                        )

                        .join(
                            '\n'
                        );

            }


            // ============================================================
            // LOG FORA DA LIGA
            // ============================================================

            if (
                avisoForaDaLigaLog
            ) {

                resumo +=

                    `\n📌 **FORA DA DISPUTA DA LIGA — LIMITE DE ${MAX_PARTIDAS_LIGA} PARTIDAS**\n` +

                    avisoForaDaLigaLog;

            }


            // ============================================================
            // DOWNLOAD DOS PRINTS
            // ============================================================

            if (
                !fs.existsSync(
                    tempPrintsDir
                )
            ) {

                fs.mkdirSync(
                    tempPrintsDir,
                    {
                        recursive:
                            true
                    }
                );

            }


            const arquivosLocais =
                [];


            let indexArquivo =
                0;


            for (
                const urlImg
                of anexosUrls
            ) {

                const nomeArquivoLocal =

                    `print_${Date.now()}_${indexArquivo}.png`;


                const caminhoLocal =
                    path.join(
                        tempPrintsDir,
                        nomeArquivoLocal
                    );


                try {

                    const response =
                        await fetch(
                            urlImg
                        );


                    const buffer =
                        await response.arrayBuffer();


                    fs.writeFileSync(

                        caminhoLocal,

                        Buffer.from(
                            buffer
                        )

                    );


                    arquivosLocais.push({

                        attachment:
                            caminhoLocal,

                        name:
                            nomeArquivoLocal

                    });

                } catch (erro) {

                    console.error(
                        'Erro ao baixar anexo:',
                        erro
                    );

                }


                indexArquivo++;

            }


            // ============================================================
            // EMBED FINAL
            // ============================================================

            const embedFinal =
                new EmbedBuilder()

                    .setTitle(
                        '🏆 LIGA DAS NAÇÕES — RESULTADO REGISTRADO'
                    )

                    .setColor(
                        '#0a4d5c'
                    )

                    .setDescription(

                        `Partida contabilizada por ${interaction.user}.`

                    );


            if (
                arquivosLocais.length > 0
            ) {

                embedFinal.setImage(

                    `attachment://${arquivosLocais[0].name}`

                );

            }


            const modoIcone =

                respostas.modo ===
                'objetivo'

                    ? '🎯 Objetivo'

                    : '🌎 Territórios';


            embedFinal.addFields({

                name:
                    '🥇 VENCEDOR',

                value:

                    `<@${respostas.vencedor}> — ` +

                    `**[ ${modoIcone} ]**`,

                inline:
                    false

            });


            embedFinal.addFields({

                name:
                    '🥈 2º LUGAR',

                value:

                    respostas.segundo !==
                    '0'

                        ? `<@${respostas.segundo}>`

                        : 'Nenhum',

                inline:
                    false

            });


            if (
                logContinentes
            ) {

                embedFinal.addFields({

                    name:
                        '🗺️ DOMÍNIOS',

                    value:
                        logContinentes,

                    inline:
                        false

                });

            }


            if (
                logAbates
            ) {

                embedFinal.addFields({

                    name:
                        '⚔️ COMBATES',

                    value:
                        logAbates,

                    inline:
                        false

                });

            }


            if (
                logSobreviventes
            ) {

                embedFinal.addFields({

                    name:
                        '🛡️ SOBREVIVENTES',

                    value:
                        logSobreviventes,

                    inline:
                        false

                });

            }


            if (
                avisoDesertorLog
            ) {

                embedFinal.addFields({

                    name:
                        '🏴‍☠️ PUNIÇÕES ATIVAS',

                    value:
                        avisoDesertorLog,

                    inline:
                        false

                });

            }


            if (
                avisoForaDaLigaLog
            ) {

                embedFinal.addFields({

                    name:
                        '📌 PARTIDAS FORA DA DISPUTA',

                    value:
                        avisoForaDaLigaLog,

                    inline:
                        false

                });

            }


            embedFinal.addFields({

                name:
                    '📊 EXTRATO FINAL',

                value:
                    resumo,

                inline:
                    false

            });


            // ============================================================
            // CANAL DE RESULTADOS
            // ============================================================

            const canalRes =
                await interaction.guild.channels
                    .fetch(
                        '1071976981924687912'
                    )
                    .catch(
                        () =>
                            interaction.channel
                    );


            // ============================================================
            // ENVIAR RESULTADO
            // ============================================================

            const msgRes =
                await canalRes.send({

                    embeds: [

                        embedFinal

                    ],

                    files:
                        arquivosLocais

                });


            // ============================================================
            // LIMPAR PRINTS
            // ============================================================

            setTimeout(

                () => {

                    arquivosLocais.forEach(
                        arquivo => {

                            if (
                                fs.existsSync(
                                    arquivo.attachment
                                )
                            ) {

                                fs.unlinkSync(
                                    arquivo.attachment
                                );

                            }

                        }
                    );

                },

                5000

            );


            // ============================================================
            // BOTÃO DE ANULAÇÃO
            // ============================================================

            const btnReverter =

                new ActionRowBuilder()
                    .addComponents(

                        new ButtonBuilder()

                            .setCustomId(
                                `edit_match_${msgRes.id}`
                            )

                            .setLabel(
                                'Editar / Anular'
                            )

                            .setStyle(
                                ButtonStyle.Danger
                            )

                            .setEmoji(
                                '⏪'
                            )

                    );


            await msgRes.edit({

                components: [

                    btnReverter

                ]

            });


            // ============================================================
            // SALVAR PARTIDA
            // ============================================================

            partidas[
                msgRes.id
            ] = {

                adminId:
                    interaction.user.id,

                respostas:
                    respostas,

                jogadoresBrutos:

                    jogadoresBrutos.map(
                        jogador => ({

                            id:
                                jogador.id,

                            username:
                                jogador.username

                        })
                    ),

                // --------------------------------------------------------
                // PONTUAÇÃO DE CADA JOGADOR
                // --------------------------------------------------------

                pontos:

                    Object.fromEntries(

                        Object.entries(
                            tabela
                        ).map(

                            (
                                [
                                    idJogador,
                                    valor
                                ]
                            ) => ({

                                [idJogador]: {

                                    // Pontos que foram realmente
                                    // adicionados à Liga.
                                    ptsLiga:
                                        valor.pts,

                                    // Informação se entrou na disputa.
                                    entraNaLiga:
                                        valor.entraNaLiga,

                                    // Número da partida do jogador.
                                    numeroPartida:
                                        valor.numeroPartida,

                                    // WarCoins reais concedidos.
                                    wcRecebido:
                                        valor.wc,

                                    // Vitória continua registrada.
                                    vitoria:
                                        valor.vitoria

                                }

                            })

                        )

                    ),

                // --------------------------------------------------------
                // CONTROLE GLOBAL DA PARTIDA
                // --------------------------------------------------------

                meta:

                    {

                        limiteLiga:
                            MAX_PARTIDAS_LIGA,

                        registradaEm:
                            Date.now()

                    }

            };


            safeWriteJson(
                partidasPath,
                partidas
            );


            // ============================================================
            // ATUALIZAR PAINEL
            // ============================================================

            try {

                await painelMod(

                    interaction.guild,

                    '1429504377395351854'

                );

            } catch (erro) {

                console.error(

                    'Erro ao atualizar o painel principal:',

                    erro

                );

            }


            // ============================================================
            // FINALIZAR TÓPICO
            // ============================================================

            await topico.send(

                '✅ **Pronto!** A partida foi salva no ' +

                '<#1071976981924687912> e o painel foi atualizado. ' +

                'Este tópico se **autodestruirá** em 5 segundos.'

            );


            setTimeout(

                async () => {

                    await topico
                        .delete()
                        .catch(
                            () => {}
                        );

                },

                5000

            );


        } catch (erro) {

            console.error(
                '[LIGA] Erro no registro da partida:',
                erro
            );

        }

    };