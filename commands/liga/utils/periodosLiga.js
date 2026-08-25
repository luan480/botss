/* ========================================================================
   ARQUIVO: commands/liga/utils/periodosLiga.js

   SISTEMA DE PERÍODOS DA LIGA

   Calcula:
   - Semana atual
   - Mês atual
   - Temporada atual
   - Temporada anterior
   - Estatísticas por período
   - Continentes por período
   - Streak de vitórias
   - Evolução de pontos

   IMPORTANTE:
   Não altera partidas.json.
   Não altera pontuacao.json.
   Apenas lê os dados.
   ======================================================================== */

const path = require('path');

const {
    carregarPartidas
} = require('./estatisticasLiga.js');


// ========================================================================
// CONSTANTES
// ========================================================================

const DISCORD_EPOCH =
    1420070400000;


// ========================================================================
// CONVERTER SNOWFLAKE EM DATA
// ========================================================================

function dataDaPartida(registro) {

    if (
        !registro ||
        !registro.id
    ) {

        return null;
    }


    const id =
        String(
            registro.id
        );


    // ------------------------------------------------------------
    // IDs do Discord são Snowflakes.
    // ------------------------------------------------------------

    if (
        !/^\d+$/.test(id)
    ) {

        return null;
    }


    try {

        const timestamp =
            Number(
                BigInt(id) >> 22n
            ) +
            DISCORD_EPOCH;


        const data =
            new Date(
                timestamp
            );


        if (
            Number.isNaN(
                data.getTime()
            )
        ) {

            return null;
        }


        return data;

    } catch {

        return null;
    }

}


// ========================================================================
// DATA INICIAL / FINAL
// ========================================================================

function estaNoPeriodo(
    data,
    inicio,
    fim
) {

    if (
        !data
    ) {

        return false;
    }


    if (
        inicio &&
        data < inicio
    ) {

        return false;
    }


    if (
        fim &&
        data >= fim
    ) {

        return false;
    }


    return true;
}


// ========================================================================
// INÍCIO DA SEMANA
// ========================================================================

function inicioDaSemana(
    data = new Date()
) {

    const inicio =
        new Date(
            data
        );


    const dia =
        inicio.getDay();


    // Segunda-feira = início da semana.
    const distancia =
        dia === 0
            ? 6
            : dia - 1;


    inicio.setHours(
        0,
        0,
        0,
        0
    );


    inicio.setDate(
        inicio.getDate() -
        distancia
    );


    return inicio;
}


// ========================================================================
// FIM DA SEMANA
// ========================================================================

function fimDaSemana(
    data = new Date()
) {

    const inicio =
        inicioDaSemana(
            data
        );


    const fim =
        new Date(
            inicio
        );


    fim.setDate(
        fim.getDate() +
        7
    );


    return fim;
}


// ========================================================================
// INÍCIO DO MÊS
// ========================================================================

function inicioDoMes(
    data = new Date()
) {

    return new Date(
        data.getFullYear(),
        data.getMonth(),
        1,
        0,
        0,
        0,
        0
    );

}


// ========================================================================
// FIM DO MÊS
// ========================================================================

function fimDoMes(
    data = new Date()
) {

    return new Date(
        data.getFullYear(),
        data.getMonth() + 1,
        1,
        0,
        0,
        0,
        0
    );

}


// ========================================================================
// INÍCIO DA TEMPORADA
//
// Por enquanto a temporada coincide com o mês.
// Depois podemos transformar isso em configuração.
// ========================================================================

function inicioDaTemporada(
    data = new Date()
) {

    return inicioDoMes(
        data
    );

}


// ========================================================================
// FIM DA TEMPORADA
// ========================================================================

function fimDaTemporada(
    data = new Date()
) {

    return fimDoMes(
        data
    );

}


// ========================================================================
// NORMALIZAR ID
// ========================================================================

function normalizarId(
    valor
) {

    if (
        valor === null ||
        valor === undefined
    ) {

        return null;
    }


    const texto =
        String(
            valor
        );


    const mencao =
        texto.match(
            /^<@!?(\d+)>$/
        );


    if (
        mencao
    ) {

        return mencao[1];
    }


    // IDs reais do Discord.
    if (
        /^\d+$/.test(
            texto
        )
    ) {

        return texto;
    }


    return null;
}


// ========================================================================
// CONVERTER NÚMERO
// ========================================================================

function numero(
    valor
) {

    const resultado =
        Number(
            valor
        );


    return Number.isFinite(
        resultado
    )
        ? resultado
        : 0;

}


// ========================================================================
// GARANTIR JOGADOR
// ========================================================================

function garantirJogador(
    mapa,
    id
) {

    if (
        !id
    ) {

        return null;
    }


    const jogadorId =
        String(
            id
        );


    if (
        !mapa[jogadorId]
    ) {

        mapa[jogadorId] = {

            id:
                jogadorId,

            partidas: 0,

            vitorias: 0,

            derrotas: 0,

            pontos: 0,

            pontosGanhos: 0,

            pontosPerdidos: 0,

            kills: 0,

            mortes: 0,

            continentes: 0,

            europa: 0,

            asia: 0,

            africa: 0,

            amnorte: 0,

            amsul: 0,

            oceania: 0,

            warCoins: 0,

            primeiroLugar: 0,

            segundoLugar: 0

        };

    }


    return mapa[jogadorId];
}


// ========================================================================
// LIMPAR ID
// ========================================================================

function extrairId(
    valor
) {

    if (
        !valor
    ) {

        return null;
    }


    if (
        typeof valor === 'string' ||
        typeof valor === 'number'
    ) {

        return normalizarId(
            valor
        );

    }


    if (
        typeof valor === 'object'
    ) {

        return (

            extrairId(
                valor.id
            ) ||

            extrairId(
                valor.userId
            ) ||

            extrairId(
                valor.jogadorId
            ) ||

            extrairId(
                valor.discordId
            )

        );

    }


    return null;
}


// ========================================================================
// PROCESSAR PONTOS
// ========================================================================

function processarPontos(
    jogadores,
    partida
) {

    if (
        !partida?.pontos ||
        typeof partida.pontos !== 'object'
    ) {

        return;
    }


    for (
        const [
            idOriginal,
            dados
        ]
        of Object.entries(
            partida.pontos
        )
    ) {

        const id =
            extrairId(
                idOriginal
            );


        if (
            !id
        ) {

            continue;
        }


        const jogador =
            garantirJogador(
                jogadores,
                id
            );


        if (
            !jogador
        ) {

            continue;
        }


        // --------------------------------------------------------
        // FORMATO NOVO
        // --------------------------------------------------------

        if (
            typeof dados === 'object' &&
            dados !== null &&
            !Array.isArray(dados)
        ) {

            jogador.pontosGanhos +=
                Math.max(
                    0,
                    numero(
                        dados.ptsLiga
                    )
                );


            jogador.pontosPerdidos +=
                Math.max(
                    0,
                    -numero(
                        dados.ptsLiga
                    )
                );


            jogador.warCoins +=
                numero(
                    dados.wcRecebido
                );


            if (
                numero(
                    dados.vitoria
                ) === 1
            ) {

                jogador.vitorias++;

            }


            continue;
        }


        // --------------------------------------------------------
        // FORMATO ANTIGO
        // --------------------------------------------------------

        const pontos =
            numero(
                dados
            );


        jogador.pontosGanhos +=
            Math.max(
                0,
                pontos
            );


        jogador.pontosPerdidos +=
            Math.max(
                0,
                -pontos
            );

    }

}


// ========================================================================
// PROCESSAR KILLS
// ========================================================================

function processarKills(
    jogadores,
    partida
) {

    const abates =
        partida?.respostas?.abates;


    if (
        !Array.isArray(
            abates
        )
    ) {

        return;
    }


    for (
        const kill
        of abates
    ) {

        if (
            !kill ||
            typeof kill !== 'object'
        ) {

            continue;
        }


        const matador =
            extrairId(
                kill.matador ||
                kill.killer ||
                kill.atacante ||
                kill.quemMatou
            );


        const vitima =
            extrairId(
                kill.vitima ||
                kill.victim ||
                kill.morto ||
                kill.quemMorreu
            );


        if (
            matador
        ) {

            const jogador =
                garantirJogador(
                    jogadores,
                    matador
                );


            jogador.kills++;

        }


        if (
            vitima
        ) {

            const jogador =
                garantirJogador(
                    jogadores,
                    vitima
                );


            jogador.mortes++;

        }

    }

}


// ========================================================================
// PROCESSAR CONTINENTES
// ========================================================================

function processarContinentes(
    jogadores,
    partida
) {

    const continentes =
        partida?.respostas?.continentes;


    if (
        !Array.isArray(
            continentes
        )
    ) {

        return;
    }


    for (
        const continente
        of continentes
    ) {

        if (
            !continente ||
            typeof continente !== 'object'
        ) {

            continue;
        }


        const jogadorId =
            extrairId(
                continente.dono ||
                continente.jogador ||
                continente.jogadorId ||
                continente.userId ||
                continente.conquistador
            );


        if (
            !jogadorId
        ) {

            continue;
        }


        const jogador =
            garantirJogador(
                jogadores,
                jogadorId
            );


        jogador.continentes++;


        const nome =
            String(

                continente.cont ||
                continente.continente ||
                continente.territorio ||
                ''

            )
            .toLowerCase()
            .trim();


        if (
            nome === 'europa' ||
            nome === 'europe'
        ) {

            jogador.europa++;

        }

        else if (
            nome === 'asia' ||
            nome === 'ásia'
        ) {

            jogador.asia++;

        }

        else if (
            nome === 'africa' ||
            nome === 'áfrica'
        ) {

            jogador.africa++;

        }

        else if (

            nome === 'amnorte' ||

            nome === 'am_norte' ||

            nome === 'america_do_norte' ||

            nome === 'américa_do_norte'

        ) {

            jogador.amnorte++;

        }

        else if (

            nome === 'amsul' ||

            nome === 'am_sul' ||

            nome === 'america_do_sul' ||

            nome === 'américa_do_sul'

        ) {

            jogador.amsul++;

        }

        else if (
            nome === 'oceania' ||
            nome === 'oceânia'
        ) {

            jogador.oceania++;

        }

    }

}


// ========================================================================
// PEGAR PARTICIPANTES
// ========================================================================

function pegarParticipantes(
    partida
) {

    const ids =
        new Set();


    // --------------------------------------------------------
    // JOGADORES BRUTOS
    // --------------------------------------------------------

    if (
        Array.isArray(
            partida?.jogadoresBrutos
        )
    ) {

        for (
            const jogador
            of partida.jogadoresBrutos
        ) {

            const id =
                extrairId(
                    jogador
                );


            if (
                id
            ) {

                ids.add(
                    id
                );

            }

        }

    }


    // --------------------------------------------------------
    // VENCEDOR
    // --------------------------------------------------------

    const vencedor =
        extrairId(
            partida?.respostas?.vencedor
        );


    if (
        vencedor
    ) {

        ids.add(
            vencedor
        );

    }


    // --------------------------------------------------------
    // SEGUNDO
    // --------------------------------------------------------

    const segundo =
        extrairId(
            partida?.respostas?.segundo
        );


    if (
        segundo
    ) {

        ids.add(
            segundo
        );

    }


    // --------------------------------------------------------
    // PONTOS
    // --------------------------------------------------------

    if (
        partida?.pontos &&
        typeof partida.pontos === 'object'
    ) {

        for (
            const idOriginal
            of Object.keys(
                partida.pontos
            )
        ) {

            const id =
                extrairId(
                    idOriginal
                );


            if (
                id
            ) {

                ids.add(
                    id
                );

            }

        }

    }


    return [
        ...ids
    ];

}


// ========================================================================
// PROCESSAR UMA PARTIDA
// ========================================================================

function processarPartida(
    jogadores,
    registro
) {

    const partida =
        registro?.partida;


    if (
        !partida ||
        typeof partida !== 'object'
    ) {

        return;
    }


    if (

        partida.anulada === true ||

        partida.anulado === true ||

        partida.cancelada === true ||

        partida.cancelado === true

    ) {

        return;

    }


    const participantes =
        pegarParticipantes(
            partida
        );


    // --------------------------------------------------------
    // PARTICIPAÇÕES
    // --------------------------------------------------------

    for (
        const id
        of participantes
    ) {

        const jogador =
            garantirJogador(
                jogadores,
                id
            );


        jogador.partidas++;

    }


    // --------------------------------------------------------
    // VITÓRIA
    // --------------------------------------------------------

    const vencedor =
        extrairId(
            partida?.respostas?.vencedor
        );


    if (
        vencedor
    ) {

        const jogador =
            garantirJogador(
                jogadores,
                vencedor
            );


        jogador.primeiroLugar++;

    }


    // --------------------------------------------------------
    // SEGUNDO
    // --------------------------------------------------------

    const segundo =
        extrairId(
            partida?.respostas?.segundo
        );


    if (
        segundo
    ) {

        const jogador =
            garantirJogador(
                jogadores,
                segundo
            );


        jogador.segundoLugar++;

    }


    // --------------------------------------------------------
    // KILLS
    // --------------------------------------------------------

    processarKills(
        jogadores,
        partida
    );


    // --------------------------------------------------------
    // CONTINENTES
    // --------------------------------------------------------

    processarContinentes(
        jogadores,
        partida
    );


    // --------------------------------------------------------
    // PONTOS
    // --------------------------------------------------------

    processarPontos(
        jogadores,
        partida
    );

}


// ========================================================================
// FILTRAR REGISTROS POR DATA
// ========================================================================

function filtrarRegistros(
    inicio,
    fim
) {

    const registros =
        carregarPartidas();


    return registros

        .map(
            registro => ({

                registro,

                data:
                    dataDaPartida(
                        registro
                    )

            })
        )

        .filter(
            item =>
                estaNoPeriodo(
                    item.data,
                    inicio,
                    fim
                )
        )

        .sort(
            (a, b) =>
                a.data.getTime() -
                b.data.getTime()
        );

}


// ========================================================================
// CALCULAR PERÍODO
// ========================================================================

function calcularPeriodo(
    inicio,
    fim
) {

    const jogadores = {};

    const registros =
        filtrarRegistros(
            inicio,
            fim
        );


    for (
        const item
        of registros
    ) {

        processarPartida(
            jogadores,
            item.registro
        );

    }


    // --------------------------------------------------------
    // DERROTAS
    // --------------------------------------------------------

    for (
        const jogador
        of Object.values(
            jogadores
        )
    ) {

        jogador.derrotas =
            Math.max(

                0,

                jogador.partidas -
                jogador.primeiroLugar

            );


        jogador.vitorias =
            jogador.primeiroLugar;


        jogador.pontos =
            jogador.pontosGanhos -
            jogador.pontosPerdidos;

    }


    return {

        inicio,

        fim,

        partidas:
            registros.length,

        jogadores,

        registros

    };

}


// ========================================================================
// SEMANA ATUAL
// ========================================================================

function calcularSemanaAtual(
    data = new Date()
) {

    return calcularPeriodo(

        inicioDaSemana(
            data
        ),

        fimDaSemana(
            data
        )

    );

}


// ========================================================================
// MÊS ATUAL
// ========================================================================

function calcularMesAtual(
    data = new Date()
) {

    return calcularPeriodo(

        inicioDoMes(
            data
        ),

        fimDoMes(
            data
        )

    );

}


// ========================================================================
// TEMPORADA ATUAL
// ========================================================================

function calcularTemporadaAtual(
    data = new Date()
) {

    return calcularPeriodo(

        inicioDaTemporada(
            data
        ),

        fimDaTemporada(
            data
        )

    );

}


// ========================================================================
// TEMPORADA ANTERIOR
// ========================================================================

function calcularTemporadaAnterior(
    data = new Date()
) {

    const inicio =
        new Date(
            data.getFullYear(),
            data.getMonth() - 1,
            1,
            0,
            0,
            0,
            0
        );


    const fim =
        new Date(
            data.getFullYear(),
            data.getMonth(),
            1,
            0,
            0,
            0,
            0
        );


    return calcularPeriodo(
        inicio,
        fim
    );

}


// ========================================================================
// ORDENAR
// ========================================================================

function ordenar(
    periodo,
    propriedade,
    limite = 10
) {

    return Object.values(
        periodo.jogadores
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
// MELHOR JOGADOR
// ========================================================================

function melhorJogador(
    periodo,
    propriedade
) {

    return ordenar(
        periodo,
        propriedade,
        1
    )[0] || null;

}


// ========================================================================
// CONTINENTE
// ========================================================================

function rankingContinente(
    periodo,
    continente,
    limite = 10
) {

    return ordenar(
        periodo,
        continente,
        limite
    )
        .filter(
            jogador =>
                numero(
                    jogador[
                        continente
                    ]
                ) > 0
        );

}


// ========================================================================
// STREAK
//
// Calcula sequência de vitórias consecutivas usando as partidas
// em ordem cronológica.
// ========================================================================

function calcularStreaks(
    registros
) {

    const porJogador = {};


    for (
        const item
        of registros
    ) {

        const partida =
            item.registro?.partida;


        if (
            !partida
        ) {

            continue;
        }


        const vencedor =
            extrairId(
                partida?.respostas?.vencedor
            );


        const participantes =
            pegarParticipantes(
                partida
            );


        for (
            const id
            of participantes
        ) {

            if (
                !porJogador[id]
            ) {

                porJogador[id] = {

                    atual: 0,

                    maior: 0,

                    vitorias: 0

                };

            }


            const dados =
                porJogador[id];


            if (
                id === vencedor
            ) {

                dados.atual++;

                dados.vitorias++;


                if (
                    dados.atual >
                    dados.maior
                ) {

                    dados.maior =
                        dados.atual;

                }

            } else {

                dados.atual =
                    0;

            }

        }

    }


    return porJogador;

}


// ========================================================================
// RANKING DE STREAK
// ========================================================================

function rankingStreak(
    periodo,
    limite = 10
) {

    const streaks =
        calcularStreaks(
            periodo.registros
        );


    return Object.entries(
        streaks
    )

        .map(
            ([id, dados]) => ({

                id,

                streakAtual:
                    dados.atual,

                maiorStreak:
                    dados.maior,

                vitorias:
                    dados.vitorias

            })
        )

        .sort(
            (a, b) =>
                b.maiorStreak -
                a.maiorStreak
        )

        .slice(
            0,
            limite
        );

}


// ========================================================================
// EVOLUÇÃO
//
// Compara dois períodos equivalentes.
// ========================================================================

function calcularEvolucao(
    atual,
    anterior
) {

    const ids =
        new Set([

            ...Object.keys(
                atual.jogadores
            ),

            ...Object.keys(
                anterior.jogadores
            )

        ]);


    const resultado = [];


    for (
        const id
        of ids
    ) {

        const jogadorAtual =
            atual.jogadores[id];


        const jogadorAnterior =
            anterior.jogadores[id];


        const pontosAtual =
            numero(
                jogadorAtual?.pontos
            );


        const pontosAnterior =
            numero(
                jogadorAnterior?.pontos
            );


        const variacao =
            pontosAtual -
            pontosAnterior;


        resultado.push({

            id,

            pontosAtual,

            pontosAnterior,

            variacao

        });

    }


    return resultado.sort(
        (a, b) =>
            b.variacao -
            a.variacao
    );

}


// ========================================================================
// EVOLUÇÃO DA SEMANA
//
// Compara semana atual com semana anterior.
// ========================================================================

function calcularEvolucaoSemanal(
    data = new Date()
) {

    const atualInicio =
        inicioDaSemana(
            data
        );


    const atualFim =
        fimDaSemana(
            data
        );


    const anteriorInicio =
        new Date(
            atualInicio
        );


    anteriorInicio.setDate(
        anteriorInicio.getDate() -
        7
    );


    const anteriorFim =
        new Date(
            atualInicio
        );


    const atual =
        calcularPeriodo(
            atualInicio,
            atualFim
        );


    const anterior =
        calcularPeriodo(
            anteriorInicio,
            anteriorFim
        );


    return calcularEvolucao(
        atual,
        anterior
    );

}


// ========================================================================
// EVOLUÇÃO DO MÊS
//
// Compara o mês atual com o mês anterior.
// ========================================================================

function calcularEvolucaoMensal(
    data = new Date()
) {

    const atualInicio =
        inicioDoMes(
            data
        );


    const atualFim =
        fimDoMes(
            data
        );


    const anteriorInicio =
        new Date(
            data.getFullYear(),
            data.getMonth() - 1,
            1,
            0,
            0,
            0,
            0
        );


    const anteriorFim =
        new Date(
            atualInicio
        );


    const atual =
        calcularPeriodo(
            atualInicio,
            atualFim
        );


    const anterior =
        calcularPeriodo(
            anteriorInicio,
            anteriorFim
        );


    return calcularEvolucao(
        atual,
        anterior
    );

}


// ========================================================================
// RESUMO DO PERÍODO
// ========================================================================

function resumoPeriodo(
    periodo
) {

    const jogadores =
        Object.values(
            periodo.jogadores
        );


    return {

        partidas:
            periodo.partidas,

        jogadores:
            jogadores.length,

        vitorias:
            jogadores.reduce(
                (
                    total,
                    jogador
                ) =>
                    total +
                    jogador.vitorias,
                0
            ),

        kills:
            jogadores.reduce(
                (
                    total,
                    jogador
                ) =>
                    total +
                    jogador.kills,
                0
            ),

        mortes:
            jogadores.reduce(
                (
                    total,
                    jogador
                ) =>
                    total +
                    jogador.mortes,
                0
            ),

        continentes:
            jogadores.reduce(
                (
                    total,
                    jogador
                ) =>
                    total +
                    jogador.continentes,
                0
            )

    };

}


// ========================================================================
// EXPORTAR
// ========================================================================

module.exports = {

    // DATAS

    dataDaPartida,

    inicioDaSemana,

    fimDaSemana,

    inicioDoMes,

    fimDoMes,

    inicioDaTemporada,

    fimDaTemporada,


    // PERÍODOS

    calcularSemanaAtual,

    calcularMesAtual,

    calcularTemporadaAtual,

    calcularTemporadaAnterior,


    // RANKINGS

    ordenar,

    melhorJogador,

    rankingContinente,

    rankingStreak,


    // EVOLUÇÃO

    calcularEvolucao,

    calcularEvolucaoSemanal,

    calcularEvolucaoMensal,


    // RESUMO

    resumoPeriodo

};