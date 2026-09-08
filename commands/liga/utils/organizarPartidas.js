/* ========================================================================
   LIGA DAS NAÇÕES — ORGANIZAÇÃO DO partidas.json

   Mantém compatibilidade com os formatos antigos, mas materializa cada
   partida moderna em blocos claros para facilitar leitura, auditoria e
   manutenção manual.
   ======================================================================== */

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function texto(valor, fallback = '') {
    return valor === undefined || valor === null ? fallback : String(valor);
}

function nomeContinente(cont) {
    const nomes = {
        africa: 'África',
        europa: 'Europa',
        asia: 'Ásia',
        amnorte: 'América do Norte',
        amsul: 'América do Sul',
        oceania: 'Oceania'
    };
    return nomes[cont] || texto(cont, 'Desconhecido');
}

function organizarPartida(id, partida) {
    if (!partida || typeof partida !== 'object') return partida;

    const respostas = partida.respostas && typeof partida.respostas === 'object'
        ? partida.respostas
        : null;

    const jogadores = Array.isArray(partida.jogadoresBrutos)
        ? partida.jogadoresBrutos
        : [];

    const pontos = partida.pontos && typeof partida.pontos === 'object'
        ? partida.pontos
        : {};

    // Registros antigos não têm respostas/jogadores estruturados.
    // Não inventamos dados: apenas identificamos o legado e preservamos tudo.
    if (!respostas || jogadores.length === 0) {
        return {
            _organizacao: {
                versao: 2,
                tipo: 'legado',
                observacao: 'Registro antigo sem dados estruturados da partida.'
            },
            id: texto(id),
            ...partida
        };
    }

    const abates = Array.isArray(respostas.abates) ? respostas.abates : [];
    const continentes = Array.isArray(respostas.continentes) ? respostas.continentes : [];

    const porJogador = jogadores.map(jogador => {
        const idJogador = texto(jogador.id);
        const dadoPontos = pontos[idJogador] && typeof pontos[idJogador] === 'object'
            ? pontos[idJogador]
            : {};

        const kills = abates.filter(a => texto(a.matador) === idJogador).length;
        const mortes = abates.filter(a => texto(a.vitima) === idJogador).length;
        const conts = continentes
            .filter(c => texto(c.dono) === idJogador)
            .map(c => ({
                id: texto(c.cont),
                nome: nomeContinente(c.cont)
            }));

        return {
            id: idJogador,
            username: texto(jogador.username, 'Desconhecido'),
            resultado: {
                vencedor: texto(respostas.vencedor) === idJogador,
                segundoLugar: texto(respostas.segundo) === idJogador,
                terceiroLugar: texto(respostas.terceiro) === idJogador,
                maisTropas: texto(respostas.maisTropas) === idJogador
            },
            combate: {
                kills,
                mortes,
                saldo: kills - mortes
            },
            continentes: conts,
            pontuacao: {
                pontosLiga: numero(dadoPontos.ptsLiga),
                warCoins: numero(dadoPontos.wcRecebido),
                vitoria: numero(dadoPontos.vitoria),
                entraNaLiga: dadoPontos.entraNaLiga !== false,
                numeroPartida: dadoPontos.numeroPartida ?? null
            }
        };
    });

    const sobreviventes = jogadores
        .map(j => texto(j.id))
        .filter(jogadorId => !abates.some(a => texto(a.vitima) === jogadorId));

    const resultado = {
        modo: texto(respostas.modo, 'não informado'),
        vencedor: texto(respostas.vencedor, null),
        segundoLugar: texto(respostas.segundo, null),
        terceiroLugar: texto(respostas.terceiro, null),
        maisTropas: texto(respostas.maisTropas, null)
    };

    const estatisticas = {
        jogadores: jogadores.length,
        abates: abates.length,
        mortes: abates.length,
        sobreviventes: sobreviventes.length,
        continentes: continentes.length,
        continentesPorTipo: continentes.reduce((acc, item) => {
            const chave = texto(item.cont, 'desconhecido');
            acc[chave] = (acc[chave] || 0) + 1;
            return acc;
        }, {})
    };

    const dataRegistro = partida.meta?.registradaEm
        ? new Date(partida.meta.registradaEm)
        : null;

    const auditoria = {
        mensagemDiscordId: texto(id),
        administradorId: texto(partida.adminId, null),
        registradaEm: partida.meta?.registradaEm ?? null,
        registradaEmISO: dataRegistro && !Number.isNaN(dataRegistro.getTime())
            ? dataRegistro.toISOString()
            : null,
        limiteLiga: partida.meta?.limiteLiga ?? 80,
        anulada: partida.anulada === true,
        anuladaEm: partida.anuladaEm ?? null,
        anuladaPor: partida.anuladaPor ?? null,
        motivoAnulacao: partida.motivoAnulacao ?? null
    };

    // Mantemos os campos antigos no fim para não quebrar nenhum módulo que
    // ainda dependa deles. Os novos blocos ficam no topo e são a forma humana
    // recomendada para consultar o arquivo.
    return {
        _organizacao: {
            versao: 2,
            tipo: 'partida_liga',
            descricao: 'Registro estruturado e auditável de uma partida da Liga.'
        },
        id: texto(id),
        identificacao: {
            mensagemDiscordId: texto(id),
            data: auditoria.registradaEmISO,
            administradorId: auditoria.administradorId
        },
        resultado,
        participantes: porJogador,
        estatisticas,
        auditoria,
        respostas,
        jogadoresBrutos: jogadores,
        pontos,
        meta: partida.meta || {
            limiteLiga: 80,
            registradaEm: null
        }
    };
}

function organizarPartidas(dados) {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return dados;

    const resultado = {};

    for (const [id, partida] of Object.entries(dados)) {
        resultado[id] = organizarPartida(id, partida);
    }

    return resultado;
}

module.exports = {
    organizarPartida,
    organizarPartidas
};
