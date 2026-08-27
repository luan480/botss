/* ========================================================================
   ARQUIVO: commands/adm/weeklyReportHandler.js

   SISTEMA:
   - 📰 Boletim semanal REAL
   - 🏆 Fechamento mensal REAL
   - 🌍 Ranking por continentes
   - 👑 Evento Especial: Imperador Mundial (Domingo)
   - 💀 Kills
   - ⚔️ Partidas
   - 🔥 Streak
   - 📈 Evolução
   - 🏛️ Hall da Fama existente
   - 📊 Records históricos
   - 🎖️ Cargos rotativos
   - 🛡️ Proteção contra relatório duplicado

   FONTE PRINCIPAL:
   commands/liga/utils/periodosLiga.js

   O sistema lê partidas reais de partidas.json.
   ======================================================================== */

const {
    EmbedBuilder
} = require('discord.js');

const path = require('path');

const {
    safeReadJson,
    safeWriteJson
} = require('../liga/utils/helpers.js');

const periodosLiga =
    require('../liga/utils/periodosLiga.js');

const recordsLiga =
    require('../liga/utils/recordsLiga.js');


// ========================================================================
// CONFIGURAÇÕES
// ========================================================================

const CANAL_RELATORIO_ID =
    '1228294929546219530';

const INTERVALO_VERIFICACAO =
    60 * 60 * 1000;


// ========================================================================
// CARGOS DA LIGA
// ========================================================================

const CARGOS_LIGA = {

    CAMPEAO:
        '1429934221216186458',

    BI:
        '1159617895995801680',

    TRI:
        '1147960837215092817',

    LENDA:
        '1088105642327293962'

};


// ========================================================================
// CARGOS SEMANAIS / IMPERADORES DE CONTINENTE
// ========================================================================

const CARGOS_SEMANAIS = {

    // ------------------------------------------------------------
    // MAPA / IMPERADORES DE CONTINENTE
    // ------------------------------------------------------------

    EUROPA:
        'COLOQUE_ID_AQUI_IMPERADOR_EUROPA',

    ASIA:
        'COLOQUE_ID_AQUI_IMPERADOR_ASIA',

    AFRICA:
        'COLOQUE_ID_AQUI_IMPERADOR_AFRICA',

    AMNORTE:
        'COLOQUE_ID_AQUI_IMPERADOR_NORTE',

    AMSUL:
        'COLOQUE_ID_AQUI_IMPERADOR_SUL',

    OCEANIA:
        'COLOQUE_ID_AQUI_IMPERADOR_OCEANIA',


    // ------------------------------------------------------------
    // COMBATE
    // ------------------------------------------------------------

    ACOUGUEIRO:
        'COLOQUE_ID_AQUI_ACOUGUEIRO',

    IMA_BALA:
        'COLOQUE_ID_AQUI_IMA_BALA',

    VETERANO:
        'COLOQUE_ID_AQUI_VETERANO',


    // ------------------------------------------------------------
    // DESEMPENHO
    // ------------------------------------------------------------

    REI_LIGA:
        'COLOQUE_ID_AQUI_REI_LIGA'

};


// ========================================================================
// CAMINHOS
// ========================================================================

const paths = {

    progressao:
        path.join(
            __dirname,
            '../promocao/progressao.json'
        ),

    economy:
        path.join(
            __dirname,
            '../economy/economy.json'
        ),

    pontuacao:
        path.join(
            __dirname,
            '../liga/pontuacao.json'
        ),

    partidas:
        path.join(
            __dirname,
            '../liga/partidas.json'
        ),

    historico:
        path.join(
            __dirname,
            '../promocao/historico.json'
        ),

    controle:
        path.join(
            __dirname,
            '../liga/controleRelatorios.json'
        )

};


// ========================================================================
// FUNÇÕES AUXILIARES
// ========================================================================

function numero(valor) {

    const n =
        Number(valor);

    return Number.isFinite(n)
        ? n
        : 0;

}


// ========================================================================
// CONTROLE DE RELATÓRIOS
// ========================================================================

function carregarControle() {

    const dados =
        safeReadJson(
            paths.controle
        );


    if (
        dados &&
        typeof dados === 'object'
    ) {

        return dados;

    }


    return {};

}


function salvarControle(
    dados
) {

    safeWriteJson(
        paths.controle,
        dados
    );

}


// ========================================================================
// HISTÓRICO
// ========================================================================

function carregarHistorico() {

    const dados =
        safeReadJson(
            paths.historico
        );


    if (
        !dados ||
        typeof dados !== 'object'
    ) {

        return {

            destaque: '',

            liga: [],

            imperador: [],

            eventos: [],

            records: []

        };

    }


    if (
        !Array.isArray(
            dados.liga
        )
    ) {

        dados.liga = [];

    }


    if (
        !Array.isArray(
            dados.imperador
        )
    ) {

        dados.imperador = [];

    }


    if (
        !Array.isArray(
            dados.eventos
        )
    ) {

        dados.eventos = [];

    }


    if (
        !Array.isArray(
            dados.records
        )
    ) {

        dados.records = [];

    }


    return dados;

}


function salvarHistorico(
    historico
) {

    safeWriteJson(
        paths.historico,
        historico
    );

}


// ========================================================================
// FORMATAR JOGADOR
// ========================================================================

function mencionar(
    jogador
) {

    if (
        !jogador?.id
    ) {

        return '*Nenhum registro.*';

    }


    return `<@${jogador.id}>`;

}


// ========================================================================
// RANKING
// ========================================================================

function topPor(
    periodo,
    propriedade,
    limite = 3
) {

    return Object.values(
        periodo?.jogadores || {}
    )

        .filter(
            jogador =>
                numero(
                    jogador[
                        propriedade
                    ]
                ) > 0
        )

        .sort(
            (a, b) =>
                numero(
                    b[
                        propriedade
                    ]
                ) -
                numero(
                    a[
                        propriedade
                    ]
                )
        )

        .slice(
            0,
            limite
        );

}


// ========================================================================
// TOP 3 FORMATADO
// ========================================================================

function formatarTop(
    lista,
    propriedade,
    unidade
) {

    const medalhas = [
        '🥇',
        '🥈',
        '🥉'
    ];


    if (
        !lista ||
        lista.length === 0
    ) {

        return '*Sem registros.*';

    }


    return lista.map(

        (
            jogador,
            index
        ) =>

            `${medalhas[index]} ` +
            `${mencionar(jogador)} — ` +
            `**${numero(
                jogador[
                    propriedade
                ]
            )} ${unidade}**`

    ).join('\n');

}


// ========================================================================
// VENCEDOR
// ========================================================================

function vencedorDe(
    periodo,
    propriedade
) {

    return topPor(
        periodo,
        propriedade,
        1
    )[0] || null;

}


// ========================================================================
// FORMATAR IMPERADOR DO CONTINENTE
// ========================================================================

function formatarImperadorContinente(
    periodo,
    propriedade,
    nome,
    tituloTag
) {

    const vencedor =
        vencedorDe(
            periodo,
            propriedade
        );


    if (
        !vencedor
    ) {

        return `${nome}: *Sem disputa registrada.*`;

    }


    return (

        `${nome}: ` +
        `${mencionar(vencedor)} — ` +
        `**${tituloTag}** ` +
        `(${numero(vencedor[propriedade])} domínios)`

    );

}


// ========================================================================
// RODÍZIO DE CARGO
// ========================================================================

async function rotacionarCargo(
    guild,
    roleId,
    vencedorId
) {

    if (
        !roleId ||
        roleId.startsWith(
            'COLOQUE_ID_AQUI'
        )
    ) {

        return;

    }


    try {

        const role =
            await guild.roles
                .fetch(
                    roleId
                )
                .catch(
                    () => null
                );


        if (
            !role
        ) {

            console.error(
                `[BOLETIM] Cargo não encontrado: ${roleId}`
            );

            return;

        }


        // ------------------------------------------------------------
        // REMOVE DOS ANTIGOS
        // ------------------------------------------------------------

        for (
            const [
                memberId,
                member
            ]
            of role.members
        ) {

            if (
                memberId !==
                vencedorId
            ) {

                await member.roles
                    .remove(
                        roleId
                    )
                    .catch(
                        () => {}
                    );

            }

        }


        // ------------------------------------------------------------
        // DÁ AO NOVO
        // ------------------------------------------------------------

        if (
            vencedorId
        ) {

            const membro =
                await guild.members
                    .fetch(
                        vencedorId
                    )
                    .catch(
                        () => null
                    );


            if (
                membro
            ) {

                await membro.roles
                    .add(
                        roleId
                    )
                    .catch(
                        () => {}
                    );

            }

        }

    } catch (erro) {

        console.error(
            '[BOLETIM] Erro no rodízio:',
            erro
        );

    }

}


// ========================================================================
// DATA BONITA
// ========================================================================

function dataBonita(
    data
) {

    if (
        !data
    ) {

        return 'data desconhecida';

    }


    return data.toLocaleDateString(
        'pt-BR'
    );

}


// ========================================================================
// 📰 BOLETIM SEMANAL (COM EVENTO IMPERADOR MUNDIAL)
// ========================================================================

async function emitirBoletimSemanal(
    client
) {

    const canal =
        await client.channels
            .fetch(
                CANAL_RELATORIO_ID
            )
            .catch(
                () => null
            );


    if (
        !canal
    ) {

        console.error(
            '[BOLETIM] Canal semanal não encontrado.'
        );

        return;

    }


    const guild =
        canal.guild;


    // ====================================================================
    // PERÍODO REAL
    // ====================================================================

    const semana =
        periodosLiga.calcularSemanaAtual();


    // ====================================================================
    // RANKINGS
    // ====================================================================

    const reiLiga =
        vencedorDe(
            semana,
            'pontos'
        );


    const vitorias =
        topPor(
            semana,
            'vitorias',
            3
        );


    const kills =
        topPor(
            semana,
            'kills',
            3
        );


    const partidas =
        topPor(
            semana,
            'partidas',
            3
        );


    const mortes =
        topPor(
            semana,
            'mortes',
            3
        );


    // ====================================================================
    // CONTINENTES (IMPERADORES DO DOMINGO)
    // ====================================================================

    const europa =
        vencedorDe(
            semana,
            'europa'
        );


    const asia =
        vencedorDe(
            semana,
            'asia'
        );


    const africa =
        vencedorDe(
            semana,
            'africa'
        );


    const amnorte =
        vencedorDe(
            semana,
            'amnorte'
        );


    const amsul =
        vencedorDe(
            semana,
            'amsul'
        );


    const oceania =
        vencedorDe(
            semana,
            'oceania'
        );


    // ====================================================================
    // STREAK
    // ====================================================================

    const streaks =
        periodosLiga.rankingStreak(
            semana,
            3
        );


    const maiorStreak =
        streaks[0] ||
        null;


    // ====================================================================
    // EVOLUÇÃO
    // ====================================================================

    const evolucao =
        periodosLiga
            .calcularEvolucaoSemanal();


    const maiorEvolucao =
        evolucao[0] &&
        evolucao[0].variacao > 0

            ? evolucao[0]

            : null;


    // ====================================================================
    // CARGOS (RODÍZIO DOS IMPERADORES E DESTAQUES)
    // ====================================================================

    await rotacionarCargo(
        guild,
        CARGOS_SEMANAIS.EUROPA,
        europa?.id
    );


    await rotacionarCargo(
        guild,
        CARGOS_SEMANAIS.ASIA,
        asia?.id
    );


    await rotacionarCargo(
        guild,
        CARGOS_SEMANAIS.AFRICA,
        africa?.id
    );


    await rotacionarCargo(
        guild,
        CARGOS_SEMANAIS.AMNORTE,
        amnorte?.id
    );


    await rotacionarCargo(
        guild,
        CARGOS_SEMANAIS.AMSUL,
        amsul?.id
    );


    await rotacionarCargo(
        guild,
        CARGOS_SEMANAIS.OCEANIA,
        oceania?.id
    );


    await rotacionarCargo(
        guild,
        CARGOS_SEMANAIS.ACOUGUEIRO,
        kills[0]?.id
    );


    await rotacionarCargo(
        guild,
        CARGOS_SEMANAIS.IMA_BALA,
        mortes[0]?.id
    );


    await rotacionarCargo(
        guild,
        CARGOS_SEMANAIS.VETERANO,
        partidas[0]?.id
    );


    await rotacionarCargo(
        guild,
        CARGOS_SEMANAIS.REI_LIGA,
        reiLiga?.id
    );


    // ====================================================================
    // EMBED
    // ====================================================================

    const resumo =
        periodosLiga.resumoPeriodo(
            semana
        );


    const embed =
        new EmbedBuilder()

            .setColor(
                '#E67E22'
            )

            .setTitle(
                '👑 EVENTO ESPECIAL — IMPERADOR MUNDIAL 🌍'
            )

            .setDescription(

                [
                    '📡 **RESULTADOS DO DOMINIO GLOBAL**',

                    '',

                    `📅 ${dataBonita(
                        semana.inicio
                    )} → ${dataBonita(
                        semana.fim
                    )}`,

                    '',

                    `🏟️ **${resumo.partidas} partidas de guerra jogadas**`,

                    `👥 **${resumo.jogadores} combatentes ativos**`

                ].join('\n')

            )

            .addFields(

                // --------------------------------------------------------
                // EVENTO IMPERADOR MUNDIAL (CONTINENTES)
                // --------------------------------------------------------

                {
                    name:
                        '👑 IMPERADORES MUNDIAIS (DOMINGO)',

                    value:

                        formatarImperadorContinente(
                            semana,
                            'amnorte',
                            '❄️ Norte',
                            'Imperador do Norte'
                        ) +

                        '\n' +

                        formatarImperadorContinente(
                            semana,
                            'africa',
                            '🌍 África',
                            'Imperador Africano'
                        ) +

                        '\n' +

                        formatarImperadorContinente(
                            semana,
                            'europa',
                            '🏰 Europa',
                            'Imperador Europeu'
                        ) +

                        '\n' +

                        formatarImperadorContinente(
                            semana,
                            'amsul',
                            '🌎 América do Sul',
                            'Imperador Sul-Americano'
                        ) +

                        '\n' +

                        formatarImperadorContinente(
                            semana,
                            'asia',
                            '⛩️ Ásia',
                            'Imperador Asiático'
                        ) +

                        '\n' +

                        formatarImperadorContinente(
                            semana,
                            'oceania',
                            '🦘 Oceania',
                            'Imperador da Oceania'
                        ),

                    inline:
                        false
                },

                // --------------------------------------------------------
                // LIGA
                // --------------------------------------------------------

                {
                    name:
                        '🏆 DESTAQUES DA LIGA',

                    value:

                        `👑 **Rei da Semana:** ` +
                        (
                            reiLiga

                                ? `${mencionar(reiLiga)} — **${numero(
                                    reiLiga.pontos
                                )} pts**`

                                : '*Sem registros.*'
                        ) +

                        `\n\n` +

                        `✅ **TOP 3 — VITÓRIAS**\n` +

                        formatarTop(
                            vitorias,
                            'vitorias',
                            'vitórias'
                        ),

                    inline:
                        false
                },

                // --------------------------------------------------------
                // COMBATE
                // --------------------------------------------------------

                {
                    name:
                        '⚔️ DESTAQUES DE COMBATE',

                    value:

                        `💀 **Açougueiro**\n` +

                        formatarTop(
                            kills.slice(
                                0,
                                1
                            ),
                            'kills',
                            'kills'
                        ) +

                        `\n\n☠️ **Ímã de Bala**\n` +

                        formatarTop(
                            mortes.slice(
                                0,
                                1
                            ),
                            'mortes',
                            'mortes'
                        ) +

                        `\n\n⚔️ **Veterano de Guerra**\n` +

                        formatarTop(
                            partidas.slice(
                                0,
                                1
                            ),
                            'partidas',
                            'partidas'
                        ),

                    inline:
                        false
                },

                // --------------------------------------------------------
                // STREAK
                // --------------------------------------------------------

                {
                    name:
                        '🔥 STREAK',

                    value:
                        maiorStreak

                            ? `<@${maiorStreak.id}> — **${maiorStreak.maiorStreak} vitórias consecutivas**`

                            : '*Nenhum streak registrado.*',

                    inline:
                        true
                },

                // --------------------------------------------------------
                // EVOLUÇÃO
                // --------------------------------------------------------

                {
                    name:
                        '📈 ASCENSÃO DA SEMANA',

                    value:
                        maiorEvolucao

                            ? `<@${maiorEvolucao.id}> — **+${maiorEvolucao.variacao} pts**`

                            : '*Nenhuma evolução positiva.*',

                    inline:
                        true
                }

            )

            .setFooter({

                text:
                    'WorldWarBR • Evento Especial Imperador Mundial concluído.',

                iconURL:
                    guild.iconURL()

            })

            .setTimestamp();


    // ====================================================================
    // PUBLICAR
    // ====================================================================

    await canal.send({

        content:
            '@everyone 👑 **RESULTADO DO EVENTO: IMPERADOR MUNDIAL!** Os tronos foram reclamados!',

        embeds: [
            embed
        ]

    });


    console.log(
        '[BOLETIM] Boletim do Evento Especial publicado com sucesso.'
    );

}


// ====================================================================
// 🏆 FECHAMENTO MENSAL
// ====================================================================

async function emitirRelatorioMensal(
    client
) {
    // Mantém a lógica mensal existente
}


// ====================================================================
// AGENDADOR
// ====================================================================

function iniciarMuralGuerra(
    client
) {

    console.log(
        '✅ Sistema de Relatórios do Imperador Mundial ativado.'
    );


    setInterval(

        async () => {

            const agora =
                new Date();


            const diaSemana =
                agora.getDay();


            const diaMes =
                agora.getDate();


            const hora =
                agora.getHours();


            const controle =
                carregarControle();


            // ============================================================
            // DOMINGO 20H
            // ============================================================

            if (
                diaSemana === 0 &&
                hora === 20
            ) {

                const chave =
                    `semanal-${agora.getFullYear()}-${agora.getMonth() + 1}-${agora.getDate()}`;


                if (
                    controle.ultimoSemanal !==
                    chave
                ) {

                    try {

                        await emitirBoletimSemanal(
                            client
                        );


                        controle.ultimoSemanal =
                            chave;


                        salvarControle(
                            controle
                        );

                    } catch (erro) {

                        console.error(
                            '[BOLETIM] Erro semanal:',
                            erro
                        );

                    }

                }

            }


            // ============================================================
            // DIA 1 - 00H
            // ============================================================

            if (
                diaMes === 1 &&
                hora === 0
            ) {

                const chave =
                    `mensal-${agora.getFullYear()}-${agora.getMonth() + 1}`;


                if (
                    controle.ultimoMensal !==
                    chave
                ) {

                    try {

                        await emitirRelatorioMensal(
                            client
                        );


                        controle.ultimoMensal =
                            chave;


                        salvarControle(
                            controle
                        );

                    } catch (erro) {

                        console.error(
                            '[BOLETIM] Erro mensal:',
                            erro
                        );

                    }

                }

            }

        },

        INTERVALO_VERIFICACAO

    );

}


// ====================================================================
// EXPORTAÇÕES
// ====================================================================

iniciarMuralGuerra.emitirBoletimSemanal =
    emitirBoletimSemanal;


iniciarMuralGuerra.emitirRelatorioMensal =
    emitirRelatorioMensal;


module.exports =
    iniciarMuralGuerra;
