/* ========================================================================
   ARQUIVO: commands/liga/handlers/handleReverter.js

   ANULAÇÃO / ESTORNO DE PARTIDA DA LIGA

   REGRAS:
   - Até a 80ª partida:
       -> estorna pontos da Liga
       -> estorna WarCoins concedidos
       -> estorna vitória
       -> estorna estatísticas/progressão

   - A partir da 81ª partida:
       -> NÃO estorna pontos da Liga, porque não foram adicionados
       -> NÃO estorna WarCoins provenientes desses pontos
       -> ESTORNA normalmente:
            • vitória
            • kills
            • mortes
            • continentes
            • partidas
            • progressão

   SEGURANÇA:
   - Administrador pode anular.
   - Autor do registro pode anular.
   ======================================================================== */

const path =
    require('path');

const {
    MessageFlags,
    PermissionFlagsBits
} =
    require('discord.js');

const {
    safeReadJson,
    safeWriteJson
} =
    require('../utils/helpers.js');


// ========================================================================
// LIMITE DA LIGA
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


const carreirasPath =
    path.join(
        __dirname,
        '..',
        '..',
        'promocao',
        'carreiras.json'
    );


// ========================================================================
// AUXILIAR — GARANTIR NÚMERO
// ========================================================================

function numero(
    valor
) {

    const n =
        Number(
            valor
        );


    return Number.isFinite(n)
        ? n
        : 0;

}


// ========================================================================
// AUXILIAR — SUBTRAIR SEM FICAR NEGATIVO
// ========================================================================

function diminuir(
    objeto,
    chave,
    quantidade
) {

    if (
        !objeto
    ) {

        return;

    }


    if (
        objeto[chave] === undefined
    ) {

        return;

    }


    objeto[chave] =
        Math.max(

            0,

            numero(
                objeto[chave]
            ) -
            numero(
                quantidade
            )

        );

}


// ========================================================================
// RECALCULAR PATENTE
// ========================================================================

async function recalcularPatente(
    interaction,
    uid,
    progressaoData,
    carreirasConfig
) {

    const jogador =
        progressaoData[uid];


    if (
        !jogador
    ) {

        return;

    }


    const factionId =
        jogador.factionId;


    if (

        !factionId ||

        !carreirasConfig ||

        !carreirasConfig.faccoes ||

        !carreirasConfig.faccoes[factionId]

    ) {

        return;

    }


    const faccao =
        carreirasConfig.faccoes[
            factionId
        ];


    const caminho =
        Array.isArray(
            faccao.caminho
        )

            ? faccao.caminho

            : [];


    let rankCorreto =
        null;


    for (
        const rank
        of caminho
    ) {

        if (

            numero(
                jogador.totalWins
            ) >=

            numero(
                rank.custo
            )

        ) {

            rankCorreto =
                rank;

        }

    }


    const targetRankId =
        rankCorreto
            ? rankCorreto.id
            : null;


    jogador.currentRankId =
        targetRankId;


    // ====================================================================
    // TENTAR READEQUAR CARGOS
    // ====================================================================

    try {

        const membro =
            await interaction.guild.members
                .fetch(
                    uid
                )
                .catch(
                    () => null
                );


        if (
            !membro
        ) {

            return;

        }


        // ---------------------------------------------------------------
        // Adicionar patente correta
        // ---------------------------------------------------------------

        if (
            targetRankId &&
            !membro.roles.cache.has(
                targetRankId
            )
        ) {

            await membro.roles
                .add(
                    targetRankId
                )
                .catch(
                    () => {}
                );

        }


        // ---------------------------------------------------------------
        // Remover patentes antigas da mesma facção
        // ---------------------------------------------------------------

        for (
            const rank
            of caminho
        ) {

            if (

                rank.id !==
                targetRankId &&

                membro.roles.cache.has(
                    rank.id
                )

            ) {

                await membro.roles
                    .remove(
                        rank.id
                    )
                    .catch(
                        () => {}
                    );

            }

        }

    } catch (erro) {

        console.error(

            `[LIGA] Erro ao recalcular patente de ${uid}:`,

            erro

        );

    }

}


// ========================================================================
// EXTRAIR PARTICIPANTES
// ========================================================================

function obterJogadores(
    dadosPartida
) {

    if (
        Array.isArray(
            dadosPartida.jogadoresBrutos
        )
    ) {

        return dadosPartida.jogadoresBrutos;

    }


    return [];

}


// ========================================================================
// EXTRAIR ABATES
// ========================================================================

function obterAbates(
    dadosPartida
) {

    if (
        Array.isArray(
            dadosPartida.respostas?.abates
        )
    ) {

        return dadosPartida.respostas.abates;

    }


    return [];

}


// ========================================================================
// EXTRAIR CONTINENTES
// ========================================================================

function obterContinentes(
    dadosPartida
) {

    if (
        Array.isArray(
            dadosPartida.respostas?.continentes
        )
    ) {

        return dadosPartida.respostas.continentes;

    }


    return [];

}


// ========================================================================
// PRINCIPAL
// ========================================================================

module.exports =
    async (
        client,
        interaction,
        pontuacaoPath,
        partidasPath
    ) => {

        // ================================================================
        // VALIDAR ID
        // ================================================================

        if (
            !interaction.customId ||
            !interaction.customId.startsWith(
                'edit_match_'
            )
        ) {

            return;

        }


        // ================================================================
        // RESPONDER INTERAÇÃO
        // ================================================================

        await interaction
            .deferReply({

                flags:
                    MessageFlags.Ephemeral

            })
            .catch(
                () => {}
            );


        // ================================================================
        // ID DA PARTIDA
        // ================================================================

        const matchId =
            interaction.customId.replace(
                'edit_match_',
                ''
            );


        // ================================================================
        // CARREGAR PARTIDA
        // ================================================================

        const partidas =
            safeReadJson(
                partidasPath
            ) || {};


        const dadosPartida =
            partidas[matchId];


        if (
            !dadosPartida
        ) {

            return interaction.editReply({

                content:
                    '❌ Os dados desta partida não foram encontrados na Caixa Preta.'

            });

        }


        // ================================================================
        // SEGURANÇA
        // ================================================================

        const isAdministrador =
            interaction.member &&
            interaction.member.permissions &&
            interaction.member.permissions.has(
                PermissionFlagsBits.Administrator
            );


        const isDonoDoRegistro =
            interaction.user.id ===
            dadosPartida.adminId;


        if (
            !isAdministrador &&
            !isDonoDoRegistro
        ) {

            return interaction.editReply({

                content:
                    '❌ **ACESSO NEGADO!** Apenas Oficiais do Alto Comando ou o jogador que registrou esta partida podem anulá-la.'

            });

        }


        // ================================================================
        // CARREGAR BANCOS
        // ================================================================

        const pontuacao =
            safeReadJson(
                pontuacaoPath
            ) || {};


        const economy =
            safeReadJson(
                economyPath
            ) || {};


        const progressaoData =
            safeReadJson(
                progressaoPath
            ) || {};


        const carreirasConfig =
            safeReadJson(
                carreirasPath
            ) || {};


        // ================================================================
        // DADOS DA PARTIDA
        // ================================================================

        const jogadores =
            obterJogadores(
                dadosPartida
            );


        const abates =
            obterAbates(
                dadosPartida
            );


        const continentes =
            obterContinentes(
                dadosPartida
            );


        const pontosPartida =
            dadosPartida.pontos || {};


        // ================================================================
        // PROCESSAR CADA JOGADOR
        // ================================================================

        for (
            const uid
            of Object.keys(
                pontosPartida
            )
        ) {

            const pData =
                pontosPartida[uid] || {};


            // ============================================================
            // 1. PONTOS DA LIGA
            // ============================================================

            const ptsLiga =
                numero(
                    pData.ptsLiga
                );


            if (
                ptsLiga > 0
            ) {

                pontuacao[uid] =
                    Math.max(

                        0,

                        numero(
                            pontuacao[uid]
                        ) -
                        ptsLiga

                    );

            }


            // ============================================================
            // 2. WARCOINS
            // ============================================================

            const wcRecebido =
                numero(
                    pData.wcRecebido
                );


            if (
                wcRecebido > 0
            ) {

                economy[uid] =
                    Math.max(

                        0,

                        numero(
                            economy[uid]
                        ) -
                        wcRecebido

                    );

            }


            // ============================================================
            // 3. VITÓRIA
            // ============================================================

            if (
                numero(
                    pData.vitoria
                ) === 1
            ) {

                if (
                    progressaoData[uid]
                ) {

                    diminuir(
                        progressaoData[uid],
                        'totalWins',
                        1
                    );


                    diminuir(
                        progressaoData[uid],
                        'vitoriasSemanais',
                        1
                    );


                    diminuir(
                        progressaoData[uid],
                        'vitoriasMensais',
                        1
                    );

                }

            }


            // ============================================================
            // 4. PARTIDAS
            // ============================================================

            if (
                progressaoData[uid]
            ) {

                diminuir(
                    progressaoData[uid],
                    'partidasSemanais',
                    1
                );


                diminuir(
                    progressaoData[uid],
                    'partidasLigaTotal',
                    1
                );


                // --------------------------------------------------------
                // Se a partida estava dentro das 80 consideradas para
                // a Liga, devolvemos o contador de partidas válidas.
                // --------------------------------------------------------

                const entrouNaLiga =

                    pData.entraNaLiga === true ||

                    numero(
                        pData.numeroPartida
                    ) <=
                    MAX_PARTIDAS_LIGA;


                if (
                    entrouNaLiga
                ) {

                    diminuir(

                        progressaoData[uid],

                        'partidasConsideradasLiga',

                        1

                    );

                }

            }

        }


        // ================================================================
        // 5. KILLS
        // ================================================================
        //
        // Cada abate registrado gera +1 para o matador.
        //
        // ================================================================

        for (
            const abate
            of abates
        ) {

            const matador =
                String(
                    abate.matador
                );


            const vitima =
                String(
                    abate.vitima
                );


            if (
                progressaoData[matador]
            ) {

                diminuir(

                    progressaoData[matador],

                    'killsSemanais',

                    1

                );

            }


            if (
                progressaoData[vitima]
            ) {

                diminuir(

                    progressaoData[vitima],

                    'mortesSemanais',

                    1

                );

            }

        }


        // ================================================================
        // 6. CONTINENTES
        // ================================================================

        for (
            const continente
            of continentes
        ) {

            const dono =
                String(
                    continente.dono
                );


            if (
                !progressaoData[dono]
            ) {

                continue;

            }


            const chave =
                `${continente.cont}Semanal`;


            diminuir(

                progressaoData[dono],

                chave,

                1

            );

        }


        // ================================================================
        // 7. RECALCULAR PATENTES
        // ================================================================

        const jogadoresParaRecalculo =
            new Set();


        Object.keys(
            pontosPartida
        )
            .forEach(
                uid =>
                    jogadoresParaRecalculo.add(
                        String(uid)
                    )
            );


        for (
            const uid
            of jogadoresParaRecalculo
        ) {

            await recalcularPatente(

                interaction,

                uid,

                progressaoData,

                carreirasConfig

            );

        }


        // ================================================================
        // 8. REMOVER PARTIDA DA CAIXA PRETA
        // ================================================================

        delete partidas[
            matchId
        ];


        // ================================================================
        // 9. SALVAR TUDO
        // ================================================================

        safeWriteJson(

            partidasPath,

            partidas

        );


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


        // ================================================================
        // 10. TENTAR APAGAR A MENSAGEM ORIGINAL
        // ================================================================

        try {

            const canalOriginal =
                interaction.channel;


            if (
                canalOriginal &&
                canalOriginal.messages
            ) {

                const mensagem =
                    await canalOriginal.messages

                        .fetch(
                            matchId
                        )

                        .catch(
                            () => null
                        );


                if (
                    mensagem
                ) {

                    await mensagem
                        .delete()
                        .catch(
                            () => {}
                        );

                }

            }

        } catch (erro) {

            console.error(
                '[LIGA] Erro ao apagar mensagem original:',
                erro
            );

        }


        // ================================================================
        // CONFIRMAÇÃO
        // ================================================================

        return interaction.editReply({

            content:

                '✅ **Partida anulada com sucesso!**\n\n' +

                '↩️ Pontos da Liga foram estornados quando aplicável.\n' +

                '💰 WarCoins foram estornados quando aplicável.\n' +

                '🏆 Vitórias foram estornadas.\n' +

                '💀 Kills e ☠️ mortes foram estornados das estatísticas.\n' +

                '🌍 Continentes foram estornados das estatísticas.\n' +

                '📊 Contadores de partidas foram corrigidos.\n' +

                '🎖️ Patentes foram readequadas.'

        });

    };