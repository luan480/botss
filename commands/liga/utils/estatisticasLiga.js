const fs = require('fs');
const path = require('path');

const {
    safeReadJson,
    safeWriteJson
} = require('./helpers.js');


// ============================================================
// CAMINHOS
// ============================================================

const PARTIDAS_PATH = path.join(
    __dirname,
    '..',
    'partidas.json'
);

const PONTUACAO_PATH = path.join(
    __dirname,
    '..',
    'pontuacao.json'
);


// ============================================================
// LER JSON
// ============================================================

function lerJson(
    caminho,
    padrao = {}
) {

    try {

        if (
            !fs.existsSync(caminho)
        ) {

            return padrao;

        }


        const conteudo =
            fs.readFileSync(
                caminho,
                'utf8'
            );


        if (
            !conteudo.trim()
        ) {

            return padrao;

        }


        return JSON.parse(
            conteudo
        );

    } catch (erro) {

        console.error(
            `[LIGA] Erro ao ler: ${caminho}`
        );

        console.error(
            erro
        );

        return padrao;

    }

}


// ============================================================
// CARREGAR PARTIDAS
// ============================================================

function carregarPartidas() {

    const dados =
        lerJson(
            PARTIDAS_PATH,
            {}
        );


    if (
        Array.isArray(
            dados
        )
    ) {

        return dados.map(
            (
                partida,
                indice
            ) => ({

                id:
                    String(indice),

                partida

            })
        );

    }


    if (
        dados &&
        Array.isArray(
            dados.partidas
        )
    ) {

        return dados.partidas.map(
            (
                partida,
                indice
            ) => ({

                id:
                    String(indice),

                partida

            })
        );

    }


    if (
        dados &&
        typeof dados === 'object'
    ) {

        return Object.entries(
            dados
        ).map(
            (
                [id, partida]
            ) => ({

                id:
                    String(id),

                partida

            })
        );

    }


    return [];

}


// ============================================================
// CARREGAR PONTUAÇÃO
// ============================================================

function carregarPontuacao() {

    const dados =
        lerJson(
            PONTUACAO_PATH,
            {}
        );


    if (
        dados &&
        typeof dados === 'object' &&
        typeof dados.content === 'string'
    ) {

        try {

            return JSON.parse(
                dados.content
            );

        } catch {

            return {};

        }

    }


    return dados;

}


// ============================================================
// CRIAR PERFIL
// ============================================================

function criarPerfil(
    id
) {

    return {

        id:
            String(id),

        partidas: 0,

        vitorias: 0,

        derrotas: 0,

        primeiroLugar: 0,

        segundoLugar: 0,

        kills: 0,

        mortes: 0,

        continentes: 0,

        europa: 0,

        asia: 0,

        africa: 0,

        amnorte: 0,

        amsul: 0,

        oceania: 0,

        pontos: 0,

        pontosGanhos: 0,

        pontosPerdidos: 0,

        warCoins: 0,

        winrate: 0,

        streakAtual: 0,

        maiorStreak: 0

    };

}


// ============================================================
// GARANTIR JOGADOR
// ============================================================

function garantirJogador(
    jogadores,
    id
) {

    if (
        !id
    ) {

        return null;

    }


    const jogadorId =
        String(id);


    if (
        !jogadores[jogadorId]
    ) {

        jogadores[jogadorId] =
            criarPerfil(
                jogadorId
            );

    }


    return jogadores[jogadorId];

}


// ============================================================
// CONVERTER NÚMERO
// ============================================================

function numero(
    valor
) {

    const resultado =
        Number(
            valor
        );


    if (
        !Number.isFinite(
            resultado
        )
    ) {

        return 0;

    }


    return resultado;

}


// ============================================================
// EXTRAIR ID
// ============================================================

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


        return texto;

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


// ============================================================
// VENCEDOR
// ============================================================

function obterVencedor(
    partida
) {

    const respostas =
        partida?.respostas;


    if (
        !respostas
    ) {

        return null;

    }


    return extrairId(

        respostas.vencedor ||

        respostas.winner ||

        respostas.ganhador

    );

}


// ============================================================
// SEGUNDO LUGAR
// ============================================================

function obterSegundo(
    partida
) {

    const respostas =
        partida?.respostas;


    if (
        !respostas
    ) {

        return null;

    }


    return extrairId(

        respostas.segundo ||

        respostas.segundoLugar ||

        respostas.runnerUp

    );

}


// ============================================================
// JOGADORES DA PARTIDA
// ============================================================

function obterJogadores(
    partida
) {

    const jogadores =
        new Set();


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

                jogadores.add(
                    id
                );

            }

        }

    }


    const vencedor =
        obterVencedor(
            partida
        );


    if (
        vencedor
    ) {

        jogadores.add(
            vencedor
        );

    }


    const segundo =
        obterSegundo(
            partida
        );


    if (
        segundo
    ) {

        jogadores.add(
            segundo
        );

    }


    if (
        partida?.pontos &&
        typeof partida.pontos === 'object'
    ) {

        for (
            const id
            of Object.keys(
                partida.pontos
            )
        ) {

            const jogadorId =
                extrairId(
                    id
                );


            if (
                jogadorId
            ) {

                jogadores.add(
                    jogadorId
                );

            }

        }

    }


    return [
        ...jogadores
    ];

}


// ============================================================
// ABATES
// ============================================================

function obterAbates(
    partida
) {

    const respostas =
        partida?.respostas;


    if (
        !respostas
    ) {

        return [];

    }


    if (
        Array.isArray(
            respostas.abates
        )
    ) {

        return respostas.abates;

    }


    if (
        Array.isArray(
            respostas.kills
        )
    ) {

        return respostas.kills;

    }


    if (
        Array.isArray(
            respostas.eliminacoes
        )
    ) {

        return respostas.eliminacoes;

    }


    return [];

}


// ============================================================
// CONTINENTES
// ============================================================

function obterContinentes(
    partida
) {

    const respostas =
        partida?.respostas;


    if (
        !respostas
    ) {

        return [];

    }


    if (
        Array.isArray(
            respostas.continentes
        )
    ) {

        return respostas.continentes;

    }


    if (
        Array.isArray(
            respostas.territorios
        )
    ) {

        return respostas.territorios;

    }


    return [];

}


// ============================================================
// PROCESSAR KILL
// ============================================================

function processarKill(
    jogadores,
    kill
) {

    if (
        !kill ||
        typeof kill !== 'object'
    ) {

        return;

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


        if (
            jogador
        ) {

            jogador.kills++;

        }

    }


    if (
        vitima
    ) {

        const jogador =
            garantirJogador(
                jogadores,
                vitima
            );


        if (
            jogador
        ) {

            jogador.mortes++;

        }

    }

}


// ============================================================
// PROCESSAR CONTINENTE
// ============================================================

function processarContinente(
    jogadores,
    continente
) {

    if (
        !continente ||
        typeof continente !== 'object'
    ) {

        return;

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

        return;

    }


    const jogador =
        garantirJogador(
            jogadores,
            jogadorId
        );


    if (
        !jogador
    ) {

        return;

    }


    jogador.continentes++;


    const codigo =
        String(

            continente.cont ||

            continente.continente ||

            continente.territorio ||

            ''

        )
            .toLowerCase()
            .trim();


    if (
        codigo === 'europa' ||
        codigo === 'europe'
    ) {

        jogador.europa++;

    }

    else if (
        codigo === 'asia' ||
        codigo === 'ásia'
    ) {

        jogador.asia++;

    }

    else if (
        codigo === 'africa' ||
        codigo === 'áfrica'
    ) {

        jogador.africa++;

    }

    else if (

        codigo === 'amnorte' ||

        codigo === 'am_norte' ||

        codigo === 'america_do_norte' ||

        codigo === 'américa_do_norte' ||

        codigo === 'america-norte'

    ) {

        jogador.amnorte++;

    }

    else if (

        codigo === 'amsul' ||

        codigo === 'am_sul' ||

        codigo === 'america_do_sul' ||

        codigo === 'américa_do_sul' ||

        codigo === 'america-sul'

    ) {

        jogador.amsul++;

    }

    else if (
        codigo === 'oceania' ||
        codigo === 'oceânia'
    ) {

        jogador.oceania++;

    }

}


// ============================================================
// PROCESSAR PONTOS
// ============================================================

function processarPontos(
    jogadores,
    pontos
) {

    if (
        !pontos ||
        typeof pontos !== 'object'
    ) {

        return;

    }


    for (
        const [
            idOriginal,
            dados
        ]
        of Object.entries(
            pontos
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

            const pontosLiga =
                numero(

                    dados.ptsLiga ??

                    dados.pontos ??

                    dados.pontuacao ??

                    0

                );


            const warCoins =
                numero(

                    dados.wcRecebido ??

                    dados.warCoins ??

                    dados.wc ??

                    0

                );


            jogador.warCoins +=
                warCoins;


            if (
                pontosLiga > 0
            ) {

                jogador.pontosGanhos +=
                    pontosLiga;

            }


            if (
                pontosLiga < 0
            ) {

                jogador.pontosPerdidos +=
                    Math.abs(
                        pontosLiga
                    );

            }


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

        const pontosNumericos =
            numero(
                dados
            );


        if (
            pontosNumericos > 0
        ) {

            jogador.pontosGanhos +=
                pontosNumericos;

        }


        if (
            pontosNumericos < 0
        ) {

            jogador.pontosPerdidos +=
                Math.abs(
                    pontosNumericos
                );

        }

    }

}


// ============================================================
// PROCESSAR PARTIDA
// ============================================================

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


    const jogadoresDaPartida =
        obterJogadores(
            partida
        );


    for (
        const id
        of jogadoresDaPartida
    ) {

        const jogador =
            garantirJogador(
                jogadores,
                id
            );


        if (
            jogador
        ) {

            jogador.partidas++;

        }

    }


    const vencedor =
        obterVencedor(
            partida
        );


    if (
        vencedor
    ) {

        const jogador =
            garantirJogador(
                jogadores,
                vencedor
            );


        if (
            jogador
        ) {

            jogador.primeiroLugar++;

        }

    }


    const segundo =
        obterSegundo(
            partida
        );


    if (
        segundo &&
        segundo !== '0'
    ) {

        const jogador =
            garantirJogador(
                jogadores,
                segundo
            );


        if (
            jogador
        ) {

            jogador.segundoLugar++;

        }

    }


    const abates =
        obterAbates(
            partida
        );


    for (
        const kill
        of abates
    ) {

        processarKill(
            jogadores,
            kill
        );

    }


    const continentes =
        obterContinentes(
            partida
        );


    for (
        const continente
        of continentes
    ) {

        processarContinente(
            jogadores,
            continente
        );

    }


    processarPontos(

        jogadores,

        partida.pontos

    );

}


// ============================================================
// FINALIZAR ESTATÍSTICAS
// ============================================================

function finalizarEstatisticas(
    jogadores
) {

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
                jogador.vitorias

            );


        jogador.winrate =

            jogador.partidas > 0

                ? Number(

                    (

                        (

                            jogador.vitorias /
                            jogador.partidas

                        ) * 100

                    ).toFixed(2)

                )

                : 0;

    }

}


// ============================================================
// CALCULAR ESTATÍSTICAS
// ============================================================

function calcularEstatisticas() {

    const jogadores = {};


    const registros =
        carregarPartidas();


    const pontuacaoAtual =
        carregarPontuacao();


    // --------------------------------------------------------
    // PROCESSAR PARTIDAS
    // --------------------------------------------------------

    for (
        const registro
        of registros
    ) {

        processarPartida(
            jogadores,
            registro
        );

    }


    // --------------------------------------------------------
    // SALDO ATUAL
    // --------------------------------------------------------

    for (
        const [
            idOriginal,
            pontos
        ]
        of Object.entries(
            pontuacaoAtual
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
            jogador
        ) {

            jogador.pontos =
                numero(
                    pontos
                );

        }

    }


    finalizarEstatisticas(
        jogadores
    );


    return jogadores;

}


// ============================================================
// PERFIL
// ============================================================

function calcularPerfil(
    jogadorId
) {

    const estatisticas =
        calcularEstatisticas();


    return (

        estatisticas[
            String(
                jogadorId
            )
        ] || null

    );

}


// ============================================================
// RANKING PONTOS
// ============================================================

function rankingPorPontos(
    limite = 10
) {

    return Object.values(
        calcularEstatisticas()
    )

        .sort(
            (a, b) =>
                b.pontos -
                a.pontos
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// RANKING VITÓRIAS
// ============================================================

function rankingPorVitorias(
    limite = 10
) {

    return Object.values(
        calcularEstatisticas()
    )

        .sort(
            (a, b) =>
                b.vitorias -
                a.vitorias
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// RANKING KILLS
// ============================================================

function rankingPorKills(
    limite = 10
) {

    return Object.values(
        calcularEstatisticas()
    )

        .sort(
            (a, b) =>
                b.kills -
                a.kills
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// RANKING MORTES
// ============================================================

function rankingPorMortes(
    limite = 10
) {

    return Object.values(
        calcularEstatisticas()
    )

        .sort(
            (a, b) =>
                b.mortes -
                a.mortes
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// RANKING CONTINENTES
// ============================================================

function rankingPorContinentes(
    limite = 10
) {

    return Object.values(
        calcularEstatisticas()
    )

        .sort(
            (a, b) =>
                b.continentes -
                a.continentes
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// EUROPA
// ============================================================

function rankingPorEuropa(
    limite = 10
) {

    return Object.values(
        calcularEstatisticas()
    )

        .sort(
            (a, b) =>
                b.europa -
                a.europa
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// ÁSIA
// ============================================================

function rankingPorAsia(
    limite = 10
) {

    return Object.values(
        calcularEstatisticas()
    )

        .sort(
            (a, b) =>
                b.asia -
                a.asia
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// ÁFRICA
// ============================================================

function rankingPorAfrica(
    limite = 10
) {

    return Object.values(
        calcularEstatisticas()
    )

        .sort(
            (a, b) =>
                b.africa -
                a.africa
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// AMÉRICA DO NORTE
// ============================================================

function rankingPorAmericaDoNorte(
    limite = 10
) {

    return Object.values(
        calcularEstatisticas()
    )

        .sort(
            (a, b) =>
                b.amnorte -
                a.amnorte
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// AMÉRICA DO SUL
// ============================================================

function rankingPorAmericaDoSul(
    limite = 10
) {

    return Object.values(
        calcularEstatisticas()
    )

        .sort(
            (a, b) =>
                b.amsul -
                a.amsul
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// OCEANIA
// ============================================================

function rankingPorOceania(
    limite = 10
) {

    return Object.values(
        calcularEstatisticas()
    )

        .sort(
            (a, b) =>
                b.oceania -
                a.oceania
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// WINRATE
// ============================================================

function rankingPorWinrate(
    limite = 10,
    partidasMinimas = 3
) {

    return Object.values(
        calcularEstatisticas()
    )

        .filter(
            jogador =>
                jogador.partidas >=
                partidasMinimas
        )

        .sort(
            (a, b) =>
                b.winrate -
                a.winrate
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// WARCOINS
// ============================================================

function rankingPorWarCoins(
    limite = 10
) {

    return Object.values(
        calcularEstatisticas()
    )

        .sort(
            (a, b) =>
                b.warCoins -
                a.warCoins
        )

        .slice(
            0,
            limite
        );

}


// ============================================================
// RESUMO
// ============================================================

function resumoLiga() {

    const jogadores =
        Object.values(
            calcularEstatisticas()
        );


    return {

        jogadores:
            jogadores.length,

        partidasRegistradas:
            carregarPartidas().length,

        participacoes:
            jogadores.reduce(
                (
                    total,
                    jogador
                ) =>
                    total +
                    jogador.partidas,
                0
            ),

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
            ),

        warCoins:
            jogadores.reduce(
                (
                    total,
                    jogador
                ) =>
                    total +
                    jogador.warCoins,
                0
            ),

        europa:
            jogadores.reduce(
                (
                    total,
                    jogador
                ) =>
                    total +
                    jogador.europa,
                0
            ),

        asia:
            jogadores.reduce(
                (
                    total,
                    jogador
                ) =>
                    total +
                    jogador.asia,
                0
            ),

        africa:
            jogadores.reduce(
                (
                    total,
                    jogador
                ) =>
                    total +
                    jogador.africa,
                0
            ),

        amnorte:
            jogadores.reduce(
                (
                    total,
                    jogador
                ) =>
                    total +
                    jogador.amnorte,
                0
            ),

        amsul:
            jogadores.reduce(
                (
                    total,
                    jogador
                ) =>
                    total +
                    jogador.amsul,
                0
            ),

        oceania:
            jogadores.reduce(
                (
                    total,
                    jogador
                ) =>
                    total +
                    jogador.oceania,
                0
            )

    };

}


// ============================================================
// EXPORTAR
// ============================================================

module.exports = {

    carregarPartidas,

    carregarPontuacao,

    criarPerfil,

    calcularEstatisticas,

    calcularPerfil,

    rankingPorPontos,

    rankingPorVitorias,

    rankingPorKills,

    rankingPorMortes,

    rankingPorContinentes,

    rankingPorEuropa,

    rankingPorAsia,

    rankingPorAfrica,

    rankingPorAmericaDoNorte,

    rankingPorAmericaDoSul,

    rankingPorOceania,

    rankingPorWinrate,

    rankingPorWarCoins,

    resumoLiga

};