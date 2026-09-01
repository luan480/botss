/* ========================================================================
   LIGA DAS NAÇÕES — API DE ESTATÍSTICAS

   Não converte pontuacao.json em formatos diferentes.
   Todas as estatísticas são derivadas do histórico válido da temporada.
   ======================================================================== */

const path = require('path');
const pontuacaoLiga = require('./pontuacaoLiga.js');

const pontuacaoPath = path.join(__dirname, '..', 'pontuacao.json');
const partidasPath = path.join(__dirname, '..', 'partidas.json');
const temporadaPath = path.join(__dirname, '..', 'temporada.json');

function perfis() {
    return pontuacaoLiga.normalizarTodos(
        pontuacaoLiga.carregar(pontuacaoPath),
        partidasPath,
        temporadaPath
    );
}

function limitar(lista, limite = 10) {
    const n = Math.max(0, Number(limite) || 10);
    return lista.slice(0, n);
}

function ordenar(campo, limite = 10, filtro = () => true) {
    return limitar(
        Object.values(perfis())
            .filter(filtro)
            .sort((a, b) =>
                Number(b[campo]) - Number(a[campo]) ||
                Number(b.pontos) - Number(a.pontos) ||
                String(a.id).localeCompare(String(b.id))
            ),
        limite
    );
}

function calcularEstatisticas() {
    return perfis();
}

function calcularPerfil(jogadorId) {
    return perfis()[String(jogadorId)] || null;
}

function carregarPartidas() {
    return pontuacaoLiga.carregarPartidas(partidasPath);
}

function carregarPontuacao() {
    return pontuacaoLiga.carregar(pontuacaoPath);
}

function criarPerfil(id) {
    return pontuacaoLiga.criarPerfil(String(id));
}

function rankingPorPontos(limite = 10) {
    return ordenar('pontos', limite);
}
function rankingPorVitorias(limite = 10) {
    return ordenar('vitorias', limite);
}
function rankingPorKills(limite = 10) {
    return ordenar('kills', limite);
}
function rankingPorMortes(limite = 10) {
    return ordenar('mortes', limite);
}
function rankingPorContinentes(limite = 10) {
    return ordenar('continentes', limite);
}
function rankingPorEuropa(limite = 10) {
    return ordenar('continentesDetalhes', limite, j => Number(j.continentesDetalhes?.europa) >= 0)
        .map(j => ({ ...j, europa: Number(j.continentesDetalhes?.europa) || 0 }))
        .sort((a, b) => b.europa - a.europa || b.pontos - a.pontos)
        .slice(0, Math.max(0, Number(limite) || 10));
}
function rankingPorAsia(limite = 10) {
    return Object.values(perfis()).sort((a,b) => (b.continentesDetalhes?.asia||0)-(a.continentesDetalhes?.asia||0) || b.pontos-a.pontos).slice(0, limite);
}
function rankingPorAfrica(limite = 10) {
    return Object.values(perfis()).sort((a,b) => (b.continentesDetalhes?.africa||0)-(a.continentesDetalhes?.africa||0) || b.pontos-a.pontos).slice(0, limite);
}
function rankingPorAmericaDoNorte(limite = 10) {
    return Object.values(perfis()).sort((a,b) => (b.continentesDetalhes?.amnorte||0)-(a.continentesDetalhes?.amnorte||0) || b.pontos-a.pontos).slice(0, limite);
}
function rankingPorAmericaDoSul(limite = 10) {
    return Object.values(perfis()).sort((a,b) => (b.continentesDetalhes?.amsul||0)-(a.continentesDetalhes?.amsul||0) || b.pontos-a.pontos).slice(0, limite);
}
function rankingPorOceania(limite = 10) {
    return Object.values(perfis()).sort((a,b) => (b.continentesDetalhes?.oceania||0)-(a.continentesDetalhes?.oceania||0) || b.pontos-a.pontos).slice(0, limite);
}
function rankingPorWinrate(limite = 10, partidasMinimas = 3) {
    return ordenar('winrate', limite, j => Number(j.partidas) >= Number(partidasMinimas));
}
function rankingPorWarCoins(limite = 10) {
    return ordenar('warCoins', limite);
}

function resumoLiga() {
    const jogadores = Object.values(perfis());
    return {
        jogadores: jogadores.length,
        partidasRegistradas: pontuacaoLiga.calcularEstatisticasTemporada(partidasPath, temporadaPath)
            ? pontuacaoLiga.carregarPartidas(partidasPath).filter(r => !r.partida?.anulada).length
            : 0,
        participacoes: jogadores.reduce((s, j) => s + Number(j.partidas || 0), 0),
        vitorias: jogadores.reduce((s, j) => s + Number(j.vitorias || 0), 0),
        kills: jogadores.reduce((s, j) => s + Number(j.kills || 0), 0),
        mortes: jogadores.reduce((s, j) => s + Number(j.mortes || 0), 0),
        continentes: jogadores.reduce((s, j) => s + Number(j.continentes || 0), 0),
        warCoins: jogadores.reduce((s, j) => s + Number(j.warCoins || 0), 0),
        europa: jogadores.reduce((s, j) => s + Number(j.continentesDetalhes?.europa || 0), 0),
        asia: jogadores.reduce((s, j) => s + Number(j.continentesDetalhes?.asia || 0), 0),
        africa: jogadores.reduce((s, j) => s + Number(j.continentesDetalhes?.africa || 0), 0),
        amnorte: jogadores.reduce((s, j) => s + Number(j.continentesDetalhes?.amnorte || 0), 0),
        amsul: jogadores.reduce((s, j) => s + Number(j.continentesDetalhes?.amsul || 0), 0),
        oceania: jogadores.reduce((s, j) => s + Number(j.continentesDetalhes?.oceania || 0), 0)
    };
}

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
