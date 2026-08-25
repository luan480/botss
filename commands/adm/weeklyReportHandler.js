/* ========================================================================
   ARQUIVO: commands/adm/weeklyReportHandler.js

   SISTEMA:
   - 📰 Boletim semanal REAL
   - 🏆 Fechamento mensal REAL
   - 🌍 Ranking por continentes
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
// CARGOS SEMANAIS
//
// Coloque os IDs reais.
// Enquanto estiver "COLOQUE_ID_AQUI", o bot ignora.
// ========================================================================

const CARGOS_SEMANAIS = {

    // ------------------------------------------------------------
    // MAPA
    // ------------------------------------------------------------

    EUROPA:
        'COLOQUE_ID_AQUI_EUROPA',

    ASIA:
        'COLOQUE_ID_AQUI_ASIA',

    AFRICA:
        'COLOQUE_ID_AQUI_AFRICA',

    AMNORTE:
        'COLOQUE_ID_AQUI_AMNORTE',

    AMSUL:
        'COLOQUE_ID_AQUI_AMSUL',

    OCEANIA:
        'COLOQUE_ID_AQUI_OCEANIA',


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
// FORMATAR CONTINENTE
// ========================================================================

function formatarContinente(
    periodo,
    propriedade,
    nome
) {

    const vencedor =
        vencedorDe(
            periodo,
            propriedade
        );


    if (
        !vencedor
    ) {

        return `${nome}: *Sem registros.*`;

    }


    return (

        `${nome}: ` +
        `${mencionar(vencedor)} — ` +
        `**${numero(
            vencedor[
                propriedade
            ]
        )} domínios**`

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
// 📰 BOLETIM SEMANAL
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
    // CONTINENTES
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
    // CARGOS
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
                '📰 BOLETIM SEMANAL — WORLDWARBR'
            )

            .setDescription(

                [
                    '📡 **SITREP DA SEMANA**',

                    '',

                    `📅 ${dataBonita(
                        semana.inicio
                    )} → ${dataBonita(
                        semana.fim
                    )}`,

                    '',

                    `🏟️ **${resumo.partidas} partidas**`,

                    `👥 **${resumo.jogadores} jogadores**`

                ].join('\n')

            )

            .addFields(

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
                // MAPA
                // --------------------------------------------------------

                {
                    name:
                        '🌍 SENHORES DO MAPA',

                    value:

                        formatarContinente(
                            semana,
                            'europa',
                            '🇪🇺 Europa'
                        ) +

                        '\n' +

                        formatarContinente(
                            semana,
                            'asia',
                            '🌏 Ásia'
                        ) +

                        '\n' +

                        formatarContinente(
                            semana,
                            'africa',
                            '🌍 África'
                        ) +

                        '\n' +

                        formatarContinente(
                            semana,
                            'amnorte',
                            '🌎 América do Norte'
                        ) +

                        '\n' +

                        formatarContinente(
                            semana,
                            'amsul',
                            '🌎 América do Sul'
                        ) +

                        '\n' +

                        formatarContinente(
                            semana,
                            'oceania',
                            '🌊 Oceania'
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
                    'WorldWarBR • Boletim calculado a partir das partidas reais.',

                iconURL:
                    guild.iconURL()

            })

            .setTimestamp();


    // ====================================================================
    // PUBLICAR
    // ====================================================================

    await canal.send({

        content:
            '@everyone 📢 **BOLETIM SEMANAL DA LIGA!**',

        embeds: [
            embed
        ]

    });


    console.log(
        '[BOLETIM] Semanal publicado usando estatísticas reais.'
    );

}


// ========================================================================
// 🏆 FECHAMENTO MENSAL
// ========================================================================

async function emitirRelatorioMensal(
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
            '[BOLETIM] Canal mensal não encontrado.'
        );

        return;

    }


    const guild =
        canal.guild;


    // ====================================================================
    // ⚠️ NO DIA 1, O MÊS ATUAL ESTÁ VAZIO.
    //
    // Então o fechamento usa TEMPORADA ANTERIOR.
    // ====================================================================

    const temporada =
        periodosLiga.calcularTemporadaAnterior();


    const ranking =
        topPor(
            temporada,
            'pontos',
            999
        );


    const campeao =
        ranking[0] ||
        null;


    const vice =
        ranking[1] ||
        null;


    const terceiro =
        ranking[2] ||
        null;


    const topVitorias =
        topPor(
            temporada,
            'vitorias',
            3
        );


    const topKills =
        topPor(
            temporada,
            'kills',
            3
        );


    const topPartidas =
        topPor(
            temporada,
            'partidas',
            3
        );


    // ====================================================================
    // CONTINENTES DO MÊS
    // ====================================================================

    const europa =
        vencedorDe(
            temporada,
            'europa'
        );


    const asia =
        vencedorDe(
            temporada,
            'asia'
        );


    const africa =
        vencedorDe(
            temporada,
            'africa'
        );


    const amnorte =
        vencedorDe(
            temporada,
            'amnorte'
        );


    const amsul =
        vencedorDe(
            temporada,
            'amsul'
        );


    const oceania =
        vencedorDe(
            temporada,
            'oceania'
        );


    // ====================================================================
    // STREAK
    // ====================================================================

    const streaks =
        periodosLiga.rankingStreak(
            temporada,
            10
        );


    const melhorStreak =
        streaks[0] ||
        null;


    // ====================================================================
    // ECONOMIA
    //
    // Economia atual é apenas informativa.
    // Não é usada para decidir campeão.
    // ====================================================================

    const economy =
        safeReadJson(
            paths.economy
        );


    const warCoinsServidor =
        Object.values(
            economy || {}
        )
            .reduce(
                (
                    total,
                    valor
                ) =>
                    total +
                    numero(
                        valor
                    ),
                0
            );


    // ====================================================================
    // PROMOÇÃO DO CAMPEÃO
    // ====================================================================

    let tituloCampeao =
        '🎖️ CAMPEÃO DA LIGA';


    if (
        campeao?.id
    ) {

        const membro =
            await guild.members
                .fetch(
                    campeao.id
                )
                .catch(
                    () => null
                );


        if (
            membro
        ) {

            const roles =
                membro.roles.cache;


            if (
                roles.has(
                    CARGOS_LIGA.TRI
                )
            ) {

                await membro.roles
                    .remove(
                        CARGOS_LIGA.TRI
                    )
                    .catch(
                        () => {}
                    );


                await membro.roles
                    .add(
                        CARGOS_LIGA.LENDA
                    )
                    .catch(
                        () => {}
                    );


                tituloCampeao =
                    '👑 LENDA DA LIGA';

            }

            else if (
                roles.has(
                    CARGOS_LIGA.BI
                )
            ) {

                await membro.roles
                    .remove(
                        CARGOS_LIGA.BI
                    )
                    .catch(
                        () => {}
                    );


                await membro.roles
                    .add(
                        CARGOS_LIGA.TRI
                    )
                    .catch(
                        () => {}
                    );


                tituloCampeao =
                    '🎖️ TRI CAMPEÃO';

            }

            else if (
                roles.has(
                    CARGOS_LIGA.CAMPEAO
                )
            ) {

                await membro.roles
                    .remove(
                        CARGOS_LIGA.CAMPEAO
                    )
                    .catch(
                        () => {}
                    );


                await membro.roles
                    .add(
                        CARGOS_LIGA.BI
                    )
                    .catch(
                        () => {}
                    );


                tituloCampeao =
                    '🎖️ BI CAMPEÃO';

            }

            else {

                await membro.roles
                    .add(
                        CARGOS_LIGA.CAMPEAO
                    )
                    .catch(
                        () => {}
                    );

            }

        }

    }


    // ====================================================================
    // NOME DA TEMPORADA
    // ====================================================================

    const inicio =
        temporada.inicio;


    const mes =
        inicio.toLocaleString(
            'pt-BR',
            {
                month: 'long'
            }
        );


    const ano =
        inicio.getFullYear();


    const temporadaNome =
        `${mes} de ${ano}`;


    // ====================================================================
    // HALL DA FAMA
    // ====================================================================

    const historico =
        carregarHistorico();


    const blocoLiga = [

        `**📅 ${mes.toUpperCase()} / ${ano}**`,

        `🥇 1º: ${mencionar(campeao)} — **${numero(
            campeao?.pontos
        )} pts**`,

        `🥈 2º: ${mencionar(vice)} — **${numero(
            vice?.pontos
        )} pts**`,

        `🥉 3º: ${mencionar(terceiro)} — **${numero(
            terceiro?.pontos
        )} pts**`,

        `🎖️ Título: ${tituloCampeao}`,

        `🏟️ Partidas: **${temporada.partidas}**`

    ].join('\n');


    historico.liga.push(
        blocoLiga
    );


    // ====================================================================
    // RECORDS TEXTUAIS
    // ====================================================================

    if (
        campeao
    ) {

        historico.records.push(

            `🏆 **Maior pontuador de ${temporadaNome}:** ` +
            `${mencionar(campeao)} ` +
            `(${campeao.pontos} pts)`

        );

    }


    if (
        topVitorias[0]
    ) {

        historico.records.push(

            `✅ **Mais vitórias de ${temporadaNome}:** ` +
            `${mencionar(topVitorias[0])} ` +
            `(${topVitorias[0].vitorias} vitórias)`

        );

    }


    if (
        topKills[0]
    ) {

        historico.records.push(

            `💀 **Mais kills de ${temporadaNome}:** ` +
            `${mencionar(topKills[0])} ` +
            `(${topKills[0].kills} kills)`

        );

    }


    if (
        melhorStreak
    ) {

        historico.records.push(

            `🔥 **Maior streak de ${temporadaNome}:** ` +
            `<@${melhorStreak.id}> ` +
            `(${melhorStreak.maiorStreak} vitórias consecutivas)`

        );

    }


    // ------------------------------------------------------------
    // CONTINENTES
    // ------------------------------------------------------------

    const continentesRecordes = [

        [
            '🇪🇺 Europa',
            europa,
            'europa'
        ],

        [
            '🌏 Ásia',
            asia,
            'asia'
        ],

        [
            '🌍 África',
            africa,
            'africa'
        ],

        [
            '🌎 América do Norte',
            amnorte,
            'amnorte'
        ],

        [
            '🌎 América do Sul',
            amsul,
            'amsul'
        ],

        [
            '🌊 Oceania',
            oceania,
            'oceania'
        ]

    ];


    for (
        const [
            nome,
            jogador,
            propriedade
        ]
        of continentesRecordes
    ) {

        if (
            jogador
        ) {

            historico.records.push(

                `${nome} — ` +
                `${mencionar(jogador)} ` +
                `(${numero(
                    jogador[
                        propriedade
                    ]
                )} domínios em ${temporadaNome})`

            );

        }

    }


    salvarHistorico(
        historico
    );


    // ====================================================================
    // RECORDS ESTRUTURADOS
    // ====================================================================

    recordsLiga.registrarTemporada({

        temporada:
            temporadaNome,

        campeao:
            campeao?.id || null,

        pontuacaoCampeao:
            campeao?.pontos || 0,

        topVitorias:
            topVitorias[0]
                ? {

                    valor:
                        topVitorias[0].vitorias,

                    jogadorId:
                        topVitorias[0].id

                }
                : null,

        topKills:
            topKills[0]
                ? {

                    valor:
                        topKills[0].kills,

                    jogadorId:
                        topKills[0].id

                }
                : null,

        topPartidas:
            topPartidas[0]
                ? {

                    valor:
                        topPartidas[0].partidas,

                    jogadorId:
                        topPartidas[0].id

                }
                : null

    });


    // ====================================================================
    // TEXTO DO PÓDIO
    // ====================================================================

    const textoPodio = [

        `🥇 ${mencionar(campeao)} — **${numero(
            campeao?.pontos
        )} pts**`,

        `🥈 ${mencionar(vice)} — **${numero(
            vice?.pontos
        )} pts**`,

        `🥉 ${mencionar(terceiro)} — **${numero(
            terceiro?.pontos
        )} pts**`

    ].join('\n');


    // ====================================================================
    // TOP VITÓRIAS
    // ====================================================================

    const textoVitorias =
        formatarTop(
            topVitorias,
            'vitorias',
            'vitórias'
        );


    // ====================================================================
    // TOP KILLS
    // ====================================================================

    const textoKills =
        formatarTop(
            topKills,
            'kills',
            'kills'
        );


    // ====================================================================
    // TOP PARTIDAS
    // ====================================================================

    const textoPartidas =
        formatarTop(
            topPartidas,
            'partidas',
            'partidas'
        );


    // ====================================================================
    // EMBED MENSAL
    // ====================================================================

    const embed =
        new EmbedBuilder()

            .setColor(
                '#FF0000'
            )

            .setTitle(
                '🏆 RELATÓRIO MENSAL — FECHAMENTO DA TEMPORADA'
            )

            .setDescription(

                [
                    `📅 **Temporada:** ${temporadaNome}`,

                    '',

                    `👑 **CAMPEÃO:** ${mencionar(
                        campeao
                    )}`,

                    `🏆 **${numero(
                        campeao?.pontos
                    )} pontos**`,

                    `🎖️ **${tituloCampeao}**`

                ].join('\n')

            )

            .addFields(

                {
                    name:
                        '🏆 PÓDIO',

                    value:
                        textoPodio,

                    inline:
                        false
                },

                {
                    name:
                        '✅ TOP 3 — VITÓRIAS',

                    value:
                        textoVitorias,

                    inline:
                        false
                },

                {
                    name:
                        '💀 TOP 3 — KILLS',

                    value:
                        textoKills,

                    inline:
                        false
                },

                {
                    name:
                        '⚔️ TOP 3 — PARTIDAS',

                    value:
                        textoPartidas,

                    inline:
                        false
                },

                {
                    name:
                        '🌍 DOMINAÇÃO DOS CONTINENTES',

                    value:

                        formatarContinente(
                            temporada,
                            'europa',
                            '🇪🇺 Europa'
                        ) +

                        '\n' +

                        formatarContinente(
                            temporada,
                            'asia',
                            '🌏 Ásia'
                        ) +

                        '\n' +

                        formatarContinente(
                            temporada,
                            'africa',
                            '🌍 África'
                        ) +

                        '\n' +

                        formatarContinente(
                            temporada,
                            'amnorte',
                            '🌎 América do Norte'
                        ) +

                        '\n' +

                        formatarContinente(
                            temporada,
                            'amsul',
                            '🌎 América do Sul'
                        ) +

                        '\n' +

                        formatarContinente(
                            temporada,
                            'oceania',
                            '🌊 Oceania'
                        ),

                    inline:
                        false
                },

                {
                    name:
                        '🔥 MAIOR STREAK',

                    value:
                        melhorStreak

                            ? `<@${melhorStreak.id}> — **${melhorStreak.maiorStreak} vitórias consecutivas**`

                            : '*Nenhum registro.*',

                    inline:
                        true
                },

                {
                    name:
                        '💰 WARCOINS',

                    value:
                        `**${warCoinsServidor} WC** atualmente registrados.`,

                    inline:
                        true
                },

                {
                    name:
                        '🏛️ HALL DA FAMA',

                    value:
                        '✅ Campeão, pódio, continentes e records arquivados no histórico oficial.',

                    inline:
                        false
                }

            )

            .setFooter({

                text:
                    'WorldWarBR • Nova temporada iniciada após o fechamento.',

                iconURL:
                    guild.iconURL()

            })

            .setTimestamp();


    // ====================================================================
    // PUBLICAR
    // ====================================================================

    await canal.send({

        content:
            '@everyone 🚨 **TEMPORADA ENCERRADA! HALL DA FAMA ATUALIZADO!**',

        embeds: [
            embed
        ]

    });


    // ====================================================================
    // RESET OFICIAL DA PONTUAÇÃO
    // ====================================================================

    safeWriteJson(
        paths.pontuacao,
        {}
    );


    // --------------------------------------------------------------------
    // Reset apenas dos contadores mensais legados.
    // --------------------------------------------------------------------

    const progressao =
        safeReadJson(
            paths.progressao
        );


    for (
        const jogador
        of Object.values(
            progressao || {}
        )
    ) {

        jogador.vitoriasMensais =
            0;

        jogador.killsMensais =
            0;

    }


    safeWriteJson(
        paths.progressao,
        progressao
    );


    console.log(
        `[BOLETIM] Temporada ${temporadaNome} encerrada com dados reais.`
    );

}


// ========================================================================
// AGENDADOR
// ========================================================================

function iniciarMuralGuerra(
    client
) {

    console.log(
        '✅ Sistema de Relatórios Inteligentes (Semanal e Mensal) ativado.'
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
            //
            // IMPORTANTE:
            // Fecha o mês anterior.
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


// ========================================================================
// EXPORTAÇÕES
// ========================================================================

iniciarMuralGuerra.emitirBoletimSemanal =
    emitirBoletimSemanal;


iniciarMuralGuerra.emitirRelatorioMensal =
    emitirRelatorioMensal;


module.exports =
    iniciarMuralGuerra;