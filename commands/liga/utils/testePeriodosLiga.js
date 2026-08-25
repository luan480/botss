/* ========================================================================
   ARQUIVO: commands/liga/utils/testePeriodosLiga.js

   TESTE:
   - Semana atual
   - Mês atual
   - Temporada atual
   - Top pontos
   - Top kills
   - Top vitórias
   - Top continentes
   - Top streak
   - Top evolução

   NÃO ALTERA NENHUM ARQUIVO.
   APENAS LÊ E MOSTRA OS RESULTADOS NO CONSOLE.
   ======================================================================== */

const {
    calcularSemanaAtual,
    calcularMesAtual,
    calcularTemporadaAtual,
    rankingContinente,
    rankingStreak,
    calcularEvolucaoSemanal,
    resumoPeriodo
} = require('./periodosLiga.js');


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


function mostrarRanking(
    titulo,
    lista,
    valor,
    unidade,
    limite = 5
) {

    console.log('');
    console.log(titulo);

    if (
        !lista ||
        lista.length === 0
    ) {

        console.log(
            'Nenhum registro encontrado.'
        );

        return;
    }


    lista
        .slice(0, limite)
        .forEach(
            (
                jogador,
                index
            ) => {

                console.log(

                    `${index + 1}º | ` +
                    `${jogador.id} | ` +
                    `${numero(
                        jogador[valor]
                    )} ${unidade}`

                );

            }
        );
}


// ========================================================================
// CABEÇALHO
// ========================================================================

console.log('');

console.log(
    '=============================================='
);

console.log(
    '      TESTE — PERÍODOS DA LIGA'
);

console.log(
    '=============================================='
);


// ========================================================================
// SEMANA ATUAL
// ========================================================================

const semana =
    calcularSemanaAtual();


console.log('');

console.log(
    '=============================================='
);

console.log(
    '📅 SEMANA ATUAL'
);

console.log(
    '=============================================='
);

console.log(
    `Início: ${semana.inicio.toLocaleString('pt-BR')}`
);

console.log(
    `Fim:    ${semana.fim.toLocaleString('pt-BR')}`
);


const resumoSemana =
    resumoPeriodo(
        semana
    );


console.log(
    `Partidas: ${resumoSemana.partidas}`
);

console.log(
    `Jogadores: ${resumoSemana.jogadores}`
);

console.log(
    `Vitórias: ${resumoSemana.vitorias}`
);

console.log(
    `Kills: ${resumoSemana.kills}`
);

console.log(
    `Mortes: ${resumoSemana.mortes}`
);

console.log(
    `Continentes: ${resumoSemana.continentes}`
);


// ========================================================================
// RANKING SEMANAL
// ========================================================================

mostrarRanking(

    '🏆 TOP 5 — PONTOS DA SEMANA',

    Object.values(
        semana.jogadores
    ).sort(
        (a, b) =>
            b.pontos -
            a.pontos
    ),

    'pontos',

    'pts'

);


mostrarRanking(

    '💀 TOP 5 — KILLS DA SEMANA',

    Object.values(
        semana.jogadores
    ).sort(
        (a, b) =>
            b.kills -
            a.kills
    ),

    'kills',

    'kills'

);


mostrarRanking(

    '✅ TOP 5 — VITÓRIAS DA SEMANA',

    Object.values(
        semana.jogadores
    ).sort(
        (a, b) =>
            b.vitorias -
            a.vitorias
    ),

    'vitorias',

    'vitórias'

);


// ========================================================================
// CONTINENTES — SEMANA
// ========================================================================

mostrarRanking(

    '🇪🇺 TOP 5 — EUROPA',

    rankingContinente(
        semana,
        'europa',
        5
    ),

    'europa',

    'conquistas'

);


mostrarRanking(

    '🌏 TOP 5 — ÁSIA',

    rankingContinente(
        semana,
        'asia',
        5
    ),

    'asia',

    'conquistas'

);


mostrarRanking(

    '🌍 TOP 5 — ÁFRICA',

    rankingContinente(
        semana,
        'africa',
        5
    ),

    'africa',

    'conquistas'

);


mostrarRanking(

    '🌎 TOP 5 — AMÉRICA DO NORTE',

    rankingContinente(
        semana,
        'amnorte',
        5
    ),

    'amnorte',

    'conquistas'

);


mostrarRanking(

    '🌎 TOP 5 — AMÉRICA DO SUL',

    rankingContinente(
        semana,
        'amsul',
        5
    ),

    'amsul',

    'conquistas'

);


mostrarRanking(

    '🌊 TOP 5 — OCEANIA',

    rankingContinente(
        semana,
        'oceania',
        5
    ),

    'oceania',

    'conquistas'

);


// ========================================================================
// STREAK
// ========================================================================

const streaksSemana =
    rankingStreak(
        semana,
        5
    );


console.log('');

console.log(
    '🔥 TOP 5 — MAIOR STREAK DA SEMANA'
);


if (
    streaksSemana.length === 0
) {

    console.log(
        'Nenhum streak encontrado.'
    );

} else {

    streaksSemana.forEach(
        (
            jogador,
            index
        ) => {

            console.log(

                `${index + 1}º | ` +
                `${jogador.id} | ` +
                `${jogador.maiorStreak} vitórias consecutivas`

            );

        }
    );

}


// ========================================================================
// EVOLUÇÃO
// ========================================================================

const evolucao =
    calcularEvolucaoSemanal();


console.log('');

console.log(
    '📈 TOP 5 — MAIOR EVOLUÇÃO DA SEMANA'
);


if (
    evolucao.length === 0
) {

    console.log(
        'Nenhuma evolução encontrada.'
    );

} else {

    evolucao
        .slice(
            0,
            5
        )
        .forEach(
            (
                jogador,
                index
            ) => {

                console.log(

                    `${index + 1}º | ` +
                    `${jogador.id} | ` +
                    `${jogador.variacao >= 0 ? '+' : ''}` +
                    `${jogador.variacao} pts`

                );

            }
        );

}


// ========================================================================
// MÊS ATUAL
// ========================================================================

const mes =
    calcularMesAtual();


console.log('');

console.log(
    '=============================================='
);

console.log(
    '📅 MÊS ATUAL'
);

console.log(
    '=============================================='
);


const resumoMes =
    resumoPeriodo(
        mes
    );


console.log(
    `Início: ${mes.inicio.toLocaleString('pt-BR')}`
);

console.log(
    `Fim:    ${mes.fim.toLocaleString('pt-BR')}`
);

console.log(
    `Partidas: ${resumoMes.partidas}`
);

console.log(
    `Jogadores: ${resumoMes.jogadores}`
);

console.log(
    `Vitórias: ${resumoMes.vitorias}`
);

console.log(
    `Kills: ${resumoMes.kills}`
);

console.log(
    `Mortes: ${resumoMes.mortes}`
);

console.log(
    `Continentes: ${resumoMes.continentes}`
);


// ========================================================================
// TOP DO MÊS
// ========================================================================

mostrarRanking(

    '🏆 TOP 5 — PONTOS DO MÊS',

    Object.values(
        mes.jogadores
    ).sort(
        (a, b) =>
            b.pontos -
            a.pontos
    ),

    'pontos',

    'pts'

);


mostrarRanking(

    '💀 TOP 5 — KILLS DO MÊS',

    Object.values(
        mes.jogadores
    ).sort(
        (a, b) =>
            b.kills -
            a.kills
    ),

    'kills',

    'kills'

);


mostrarRanking(

    '✅ TOP 5 — VITÓRIAS DO MÊS',

    Object.values(
        mes.jogadores
    ).sort(
        (a, b) =>
            b.vitorias -
            a.vitorias
    ),

    'vitorias',

    'vitórias'

);


// ========================================================================
// CONTINENTES — MÊS
// ========================================================================

mostrarRanking(

    '🇪🇺 TOP 5 — EUROPA DO MÊS',

    rankingContinente(
        mes,
        'europa',
        5
    ),

    'europa',

    'conquistas'

);


mostrarRanking(

    '🌏 TOP 5 — ÁSIA DO MÊS',

    rankingContinente(
        mes,
        'asia',
        5
    ),

    'asia',

    'conquistas'

);


mostrarRanking(

    '🌍 TOP 5 — ÁFRICA DO MÊS',

    rankingContinente(
        mes,
        'africa',
        5
    ),

    'africa',

    'conquistas'

);


mostrarRanking(

    '🌎 TOP 5 — AMÉRICA DO NORTE DO MÊS',

    rankingContinente(
        mes,
        'amnorte',
        5
    ),

    'amnorte',

    'conquistas'

);


mostrarRanking(

    '🌎 TOP 5 — AMÉRICA DO SUL DO MÊS',

    rankingContinente(
        mes,
        'amsul',
        5
    ),

    'amsul',

    'conquistas'

);


mostrarRanking(

    '🌊 TOP 5 — OCEANIA DO MÊS',

    rankingContinente(
        mes,
        'oceania',
        5
    ),

    'oceania',

    'conquistas'

);


// ========================================================================
// STREAK — MÊS
// ========================================================================

const streaksMes =
    rankingStreak(
        mes,
        5
    );


console.log('');

console.log(
    '🔥 TOP 5 — MAIOR STREAK DO MÊS'
);


if (
    streaksMes.length === 0
) {

    console.log(
        'Nenhum streak encontrado.'
    );

} else {

    streaksMes.forEach(
        (
            jogador,
            index
        ) => {

            console.log(

                `${index + 1}º | ` +
                `${jogador.id} | ` +
                `${jogador.maiorStreak} vitórias consecutivas`

            );

        }
    );

}


// ========================================================================
// TEMPORADA ATUAL
// ========================================================================

const temporada =
    calcularTemporadaAtual();


console.log('');

console.log(
    '=============================================='
);

console.log(
    '🏆 TEMPORADA ATUAL'
);

console.log(
    '=============================================='
);


const resumoTemporada =
    resumoPeriodo(
        temporada
    );


console.log(
    `Início: ${temporada.inicio.toLocaleString('pt-BR')}`
);

console.log(
    `Fim:    ${temporada.fim.toLocaleString('pt-BR')}`
);

console.log(
    `Partidas: ${resumoTemporada.partidas}`
);

console.log(
    `Jogadores: ${resumoTemporada.jogadores}`
);

console.log(
    `Vitórias: ${resumoTemporada.vitorias}`
);

console.log(
    `Kills: ${resumoTemporada.kills}`
);

console.log(
    `Mortes: ${resumoTemporada.mortes}`
);

console.log(
    `Continentes: ${resumoTemporada.continentes}`
);


// ========================================================================
// TOP DA TEMPORADA
// ========================================================================

mostrarRanking(

    '🏆 TOP 10 — PONTOS DA TEMPORADA',

    Object.values(
        temporada.jogadores
    ).sort(
        (a, b) =>
            b.pontos -
            a.pontos
    ),

    'pontos',

    'pts',

    10

);


mostrarRanking(

    '✅ TOP 10 — VITÓRIAS DA TEMPORADA',

    Object.values(
        temporada.jogadores
    ).sort(
        (a, b) =>
            b.vitorias -
            a.vitorias
    ),

    'vitorias',

    'vitórias',

    10

);


mostrarRanking(

    '💀 TOP 10 — KILLS DA TEMPORADA',

    Object.values(
        temporada.jogadores
    ).sort(
        (a, b) =>
            b.kills -
            a.kills
    ),

    'kills',

    'kills',

    10

);


// ========================================================================
// CONTINENTES — TEMPORADA
// ========================================================================

mostrarRanking(

    '🇪🇺 TOP 5 — EUROPA DA TEMPORADA',

    rankingContinente(
        temporada,
        'europa',
        5
    ),

    'europa',

    'conquistas'

);


mostrarRanking(

    '🌏 TOP 5 — ÁSIA DA TEMPORADA',

    rankingContinente(
        temporada,
        'asia',
        5
    ),

    'asia',

    'conquistas'

);


mostrarRanking(

    '🌍 TOP 5 — ÁFRICA DA TEMPORADA',

    rankingContinente(
        temporada,
        'africa',
        5
    ),

    'africa',

    'conquistas'

);


mostrarRanking(

    '🌎 TOP 5 — AMÉRICA DO NORTE DA TEMPORADA',

    rankingContinente(
        temporada,
        'amnorte',
        5
    ),

    'amnorte',

    'conquistas'

);


mostrarRanking(

    '🌎 TOP 5 — AMÉRICA DO SUL DA TEMPORADA',

    rankingContinente(
        temporada,
        'amsul',
        5
    ),

    'amsul',

    'conquistas'

);


mostrarRanking(

    '🌊 TOP 5 — OCEANIA DA TEMPORADA',

    rankingContinente(
        temporada,
        'oceania',
        5
    ),

    'oceania',

    'conquistas'

);


// ========================================================================
// STREAK — TEMPORADA
// ========================================================================

const streaksTemporada =
    rankingStreak(
        temporada,
        10
    );


console.log('');

console.log(
    '🔥 TOP 10 — MAIOR STREAK DA TEMPORADA'
);


if (
    streaksTemporada.length === 0
) {

    console.log(
        'Nenhum streak encontrado.'
    );

} else {

    streaksTemporada.forEach(
        (
            jogador,
            index
        ) => {

            console.log(

                `${index + 1}º | ` +
                `${jogador.id} | ` +
                `${jogador.maiorStreak} vitórias consecutivas`

            );

        }
    );

}


// ========================================================================
// FINAL
// ========================================================================

console.log('');

console.log(
    '=============================================='
);

console.log(
    '       TESTE — PERÍODOS FINALIZADO'
);

console.log(
    '=============================================='
);

console.log('');