/* ========================================================================
   WRAPPER DA LIGA — estatisticasLiga

   Responsável por manter compatibilidade entre o formato antigo
   { id: pontos } e o formato atual de pontuacao.json:
   { id: { pontos, vitorias, ... } }.

   IMPORTANTE:
   - nunca perde os pontos já salvos no pontuacao.json;
   - rankings de pontos usam a pontuação persistida como fonte de verdade;
   - rankings estatísticos continuam sendo calculados a partir das partidas;
   - o arquivo volta ao formato atual ao terminar cada operação.
   ======================================================================== */

const path = require('path');
const core = require('./estatisticasLigaCore.js');
const pontuacaoLiga = require('./pontuacaoLiga.js');

const pontuacaoPath = path.join(__dirname, '..', 'pontuacao.json');
const partidasPath = path.join(__dirname, '..', 'partidas.json');
const temporadaPath = path.join(__dirname, '..', 'temporada.json');

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function carregarPerfis() {
    const dados = pontuacaoLiga.normalizarTodos(
        pontuacaoLiga.carregar(pontuacaoPath)
    );

    return dados && typeof dados === 'object' ? dados : {};
}

function aplicarPontuacaoPersistida(resultado, perfis) {
    if (!resultado || typeof resultado !== 'object') {
        return resultado;
    }

    if (Array.isArray(resultado)) {
        return resultado.map((jogador) => {
            if (!jogador || typeof jogador !== 'object') return jogador;

            const id = String(jogador.id || '');
            const perfil = perfis[id];
            if (!perfil) return jogador;

            return {
                ...jogador,
                pontos: numero(perfil.pontos),
                pontosGanhos: numero(perfil.pontosGanhos),
                pontosPerdidos: numero(perfil.pontosPerdidos),
                warCoins: jogador.warCoins ?? numero(perfil.warCoins)
            };
        });
    }

    const saida = { ...resultado };

    for (const [id, jogador] of Object.entries(saida)) {
        if (!jogador || typeof jogador !== 'object') continue;

        const perfil = perfis[String(jogador.id || id)];
        if (!perfil) continue;

        saida[id] = {
            ...jogador,
            pontos: numero(perfil.pontos),
            pontosGanhos: numero(perfil.pontosGanhos),
            pontosPerdidos: numero(perfil.pontosPerdidos),
            warCoins: jogador.warCoins ?? numero(perfil.warCoins)
        };
    }

    return saida;
}

function executar(nome, args) {
    // O core legado trabalha com { id: pontos }.
    // A conversão é temporária e é restaurada no finally.
    pontuacaoLiga.prepararFormatoAntigo(pontuacaoPath);

    try {
        const resultado = core[nome](...args);
        const perfis = carregarPerfis();
        return aplicarPontuacaoPersistida(resultado, perfis);
    } finally {
        pontuacaoLiga.sincronizarArquivo(
            pontuacaoPath,
            partidasPath,
            temporadaPath
        );
    }
}

function rankingPorPontos(limite = 10) {
    pontuacaoLiga.prepararFormatoAntigo(pontuacaoPath);

    try {
        const estatisticas = core.calcularEstatisticas();
        const perfis = carregarPerfis();
        const jogadores = Object.values(
            aplicarPontuacaoPersistida(estatisticas, perfis)
        );

        return jogadores
            .filter((jogador) => jogador && jogador.id)
            .sort((a, b) => {
                const pontos = numero(b.pontos) - numero(a.pontos);
                if (pontos !== 0) return pontos;

                const vitorias = numero(b.vitorias) - numero(a.vitorias);
                if (vitorias !== 0) return vitorias;

                return numero(b.kills) - numero(a.kills);
            })
            .slice(0, Math.max(0, numero(limite) || 10));
    } finally {
        pontuacaoLiga.sincronizarArquivo(
            pontuacaoPath,
            partidasPath,
            temporadaPath
        );
    }
}

module.exports = {
    carregarPartidas: (...args) => core.carregarPartidas(...args),
    carregarPontuacao: (...args) => executar('carregarPontuacao', args),
    criarPerfil: (...args) => core.criarPerfil(...args),
    calcularEstatisticas: (...args) => executar('calcularEstatisticas', args),
    calcularPerfil: (...args) => executar('calcularPerfil', args),
    rankingPorPontos,
    rankingPorVitorias: (...args) => executar('rankingPorVitorias', args),
    rankingPorKills: (...args) => executar('rankingPorKills', args),
    rankingPorMortes: (...args) => executar('rankingPorMortes', args),
    rankingPorContinentes: (...args) => executar('rankingPorContinentes', args),
    rankingPorEuropa: (...args) => executar('rankingPorEuropa', args),
    rankingPorAsia: (...args) => executar('rankingPorAsia', args),
    rankingPorAfrica: (...args) => executar('rankingPorAfrica', args),
    rankingPorAmericaDoNorte: (...args) => executar('rankingPorAmericaDoNorte', args),
    rankingPorAmericaDoSul: (...args) => executar('rankingPorAmericaDoSul', args),
    rankingPorOceania: (...args) => executar('rankingPorOceania', args),
    rankingPorWinrate: (...args) => executar('rankingPorWinrate', args),
    rankingPorWarCoins: (...args) => executar('rankingPorWarCoins', args),
    resumoLiga: (...args) => executar('resumoLiga', args)
};
