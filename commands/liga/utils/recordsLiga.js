/* ========================================================================
   ARQUIVO: commands/liga/utils/recordsLiga.js

   SISTEMA DE RECORDES HISTÓRICOS DA LIGA

   Mantém os recordes dentro do historico.json existente.

   Recordes preparados:
   - 🏆 Maior pontuação em uma temporada
   - ✅ Mais vitórias em uma temporada
   - 💀 Mais kills em uma temporada
   - ⚔️ Mais partidas em uma temporada
   - 👑 Mais títulos da Liga

   IMPORTANTE:
   Não cria outro arquivo de Hall da Fama.
   ======================================================================== */

const path = require('path');

const {
    safeReadJson,
    safeWriteJson
} = require('./helpers.js');


// ========================================================================
// CAMINHO DO HISTÓRICO EXISTENTE
// ========================================================================

const HISTORICO_PATH = path.join(
    __dirname,
    '..',
    '..',
    'promocao',
    'historico.json'
);


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


// ========================================================================
// SALVAR HISTÓRICO
// ========================================================================

function salvarHistorico(
    historico
) {

    safeWriteJson(
        HISTORICO_PATH,
        historico
    );

}


// ========================================================================
// CRIAR ESTRUTURA DOS RECORDES
// ========================================================================

function criarEstruturaRecordes() {

    return {

        maiorPontuacao: {

            valor: 0,

            jogadorId: null,

            temporada: null

        },

        maisVitorias: {

            valor: 0,

            jogadorId: null,

            temporada: null

        },

        maisKills: {

            valor: 0,

            jogadorId: null,

            temporada: null

        },

        maisPartidas: {

            valor: 0,

            jogadorId: null,

            temporada: null

        },

        maisTitulos: {

            valor: 0,

            jogadorId: null

        }

    };

}


// ========================================================================
// GARANTIR ESTRUTURA
// ========================================================================

function garantirEstrutura(
    historico
) {

    if (
        !historico.recordsLiga ||
        typeof historico.recordsLiga !== 'object'
    ) {

        historico.recordsLiga =
            criarEstruturaRecordes();

    }


    const padrao =
        criarEstruturaRecordes();


    for (
        const chave
        of Object.keys(padrao)
    ) {

        if (
            !historico.recordsLiga[chave] ||
            typeof historico.recordsLiga[chave] !== 'object'
        ) {

            historico.recordsLiga[chave] =
                padrao[chave];

        }

    }


    return historico;

}


// ========================================================================
// ATUALIZAR UM RECORD
// ========================================================================

function atualizarRecord(
    record,
    valor,
    jogadorId,
    temporada
) {

    const numeroAtual =
        Number(valor) || 0;


    const numeroRecorde =
        Number(record.valor) || 0;


    if (
        numeroAtual <=
        numeroRecorde
    ) {

        return false;

    }


    record.valor =
        numeroAtual;


    record.jogadorId =
        jogadorId
            ? String(jogadorId)
            : null;


    record.temporada =
        temporada || null;


    return true;

}


// ========================================================================
// REGISTRAR TEMPORADA
// ========================================================================

function registrarTemporada({
    temporada,
    campeao,
    pontuacaoCampeao,
    topVitorias,
    topKills,
    topPartidas
}) {

    const historico =
        garantirEstrutura(
            carregarHistorico()
        );


    let houveAlteracao =
        false;


    // --------------------------------------------------------------------
    // MAIOR PONTUAÇÃO
    // --------------------------------------------------------------------

    if (
        campeao
    ) {

        const alterou =
            atualizarRecord(

                historico
                    .recordsLiga
                    .maiorPontuacao,

                pontuacaoCampeao,

                campeao,

                temporada

            );


        if (
            alterou
        ) {

            houveAlteracao =
                true;

        }

    }


    // --------------------------------------------------------------------
    // MAIS VITÓRIAS
    // --------------------------------------------------------------------

    if (
        topVitorias
    ) {

        const alterou =
            atualizarRecord(

                historico
                    .recordsLiga
                    .maisVitorias,

                topVitorias.valor,

                topVitorias.jogadorId,

                temporada

            );


        if (
            alterou
        ) {

            houveAlteracao =
                true;

        }

    }


    // --------------------------------------------------------------------
    // MAIS KILLS
    // --------------------------------------------------------------------

    if (
        topKills
    ) {

        const alterou =
            atualizarRecord(

                historico
                    .recordsLiga
                    .maisKills,

                topKills.valor,

                topKills.jogadorId,

                temporada

            );


        if (
            alterou
        ) {

            houveAlteracao =
                true;

        }

    }


    // --------------------------------------------------------------------
    // MAIS PARTIDAS
    // --------------------------------------------------------------------

    if (
        topPartidas
    ) {

        const alterou =
            atualizarRecord(

                historico
                    .recordsLiga
                    .maisPartidas,

                topPartidas.valor,

                topPartidas.jogadorId,

                temporada

            );


        if (
            alterou
        ) {

            houveAlteracao =
                true;

        }

    }


    // --------------------------------------------------------------------
    // MAIS TÍTULOS
    //
    // Conta quantas vezes o jogador aparece como campeão.
    // --------------------------------------------------------------------

    const contagemTitulos = {};


    for (
        const registro
        of historico.liga
    ) {

        if (
            typeof registro !== 'string'
        ) {

            continue;

        }


        const mencoes =
            registro.match(
                /🥇 1º:\s*<@!?(\d+)>/g
            );


        if (!mencoes) {

            continue;

        }


        for (
            const mencao
            of mencoes
        ) {

            const id =
                mencao.match(
                    /<@!?(\d+)>/
                )?.[1];


            if (!id) {

                continue;

            }


            contagemTitulos[id] =
                (
                    contagemTitulos[id] ||
                    0
                ) + 1;

        }

    }


    // Inclui a temporada atual.
    if (
        campeao
    ) {

        const id =
            String(
                campeao
            );


        contagemTitulos[id] =
            (
                contagemTitulos[id] ||
                0
            ) + 1;

    }


    const maiorTitulo =
        Object.entries(
            contagemTitulos
        )
            .sort(
                (
                    [, a],
                    [, b]
                ) =>
                    b - a
            )[0];


    if (
        maiorTitulo
    ) {

        const [jogadorId, titulos] =
            maiorTitulo;


        if (
            titulos >
            Number(
                historico
                    .recordsLiga
                    .maisTitulos
                    .valor || 0
            )
        ) {

            historico
                .recordsLiga
                .maisTitulos
                .valor =
                titulos;


            historico
                .recordsLiga
                .maisTitulos
                .jogadorId =
                jogadorId;


            historico
                .recordsLiga
                .maisTitulos
                .temporada =
                temporada;


            houveAlteracao =
                true;

        }

    }


    // --------------------------------------------------------------------
    // SALVAR
    // --------------------------------------------------------------------

    if (
        houveAlteracao
    ) {

        salvarHistorico(
            historico
        );

    }


    return {

        houveAlteracao,

        records:
            historico.recordsLiga

    };

}


// ========================================================================
// PEGAR RECORDES
// ========================================================================

function obterRecords() {

    const historico =
        garantirEstrutura(
            carregarHistorico()
        );


    return historico.recordsLiga;

}


// ========================================================================
// GERAR TEXTO PARA O PAINEL
// ========================================================================

function gerarTextoRecords() {

    const records =
        obterRecords();


    const linhas = [];


    // --------------------------------------------------------------------
    // PONTUAÇÃO
    // --------------------------------------------------------------------

    if (
        records.maiorPontuacao.valor > 0 &&
        records.maiorPontuacao.jogadorId
    ) {

        linhas.push(

            `🏆 **Maior Pontuação:** ` +
            `<@${records.maiorPontuacao.jogadorId}> — ` +
            `**${records.maiorPontuacao.valor} pts**` +

            (

                records.maiorPontuacao.temporada

                    ? ` (${records.maiorPontuacao.temporada})`

                    : ''

            )

        );

    }


    // --------------------------------------------------------------------
    // VITÓRIAS
    // --------------------------------------------------------------------

    if (
        records.maisVitorias.valor > 0 &&
        records.maisVitorias.jogadorId
    ) {

        linhas.push(

            `✅ **Mais Vitórias:** ` +
            `<@${records.maisVitorias.jogadorId}> — ` +
            `**${records.maisVitorias.valor} vitórias**` +

            (

                records.maisVitorias.temporada

                    ? ` (${records.maisVitorias.temporada})`

                    : ''

            )

        );

    }


    // --------------------------------------------------------------------
    // KILLS
    // --------------------------------------------------------------------

    if (
        records.maisKills.valor > 0 &&
        records.maisKills.jogadorId
    ) {

        linhas.push(

            `💀 **Mais Kills:** ` +
            `<@${records.maisKills.jogadorId}> — ` +
            `**${records.maisKills.valor} kills**` +

            (

                records.maisKills.temporada

                    ? ` (${records.maisKills.temporada})`

                    : ''

            )

        );

    }


    // --------------------------------------------------------------------
    // PARTIDAS
    // --------------------------------------------------------------------

    if (
        records.maisPartidas.valor > 0 &&
        records.maisPartidas.jogadorId
    ) {

        linhas.push(

            `⚔️ **Mais Partidas:** ` +
            `<@${records.maisPartidas.jogadorId}> — ` +
            `**${records.maisPartidas.valor} partidas**` +

            (

                records.maisPartidas.temporada

                    ? ` (${records.maisPartidas.temporada})`

                    : ''

            )

        );

    }


    // --------------------------------------------------------------------
    // TÍTULOS
    // --------------------------------------------------------------------

    if (
        records.maisTitulos.valor > 0 &&
        records.maisTitulos.jogadorId
    ) {

        linhas.push(

            `👑 **Mais Títulos:** ` +
            `<@${records.maisTitulos.jogadorId}> — ` +
            `**${records.maisTitulos.valor} títulos**`

        );

    }


    if (
        linhas.length === 0
    ) {

        return '*Ainda não existem records registrados pela nova Liga.*';

    }


    return linhas.join('\n');

}


// ========================================================================
// EXPORTAR
// ========================================================================

module.exports = {

    carregarHistorico,

    salvarHistorico,

    registrarTemporada,

    obterRecords,

    gerarTextoRecords

};