/* ========================================================================
   SISTEMA DE PERÍODOS DA LIGA
   A temporada atual começa em commands/liga/temporada.json.inicio.
   O histórico de partidas continua permanente em partidas.json.
   ======================================================================== */

const path = require('path');
const fs = require('fs');
const { carregarPartidas } = require('./estatisticasLiga.js');

const DISCORD_EPOCH = 1420070400000;
const temporadaPath = path.join(__dirname, '..', 'temporada.json');

function lerTemporada() {
    try {
        if (!fs.existsSync(temporadaPath)) return {};
        const dados = JSON.parse(fs.readFileSync(temporadaPath, 'utf8'));
        return dados && typeof dados === 'object' ? dados : {};
    } catch (erro) {
        console.error('[LIGA] Erro ao ler temporada.json:', erro);
        return {};
    }
}

function dataDaPartida(registro) {
    if (!registro || !registro.id) return null;
    const id = String(registro.id);
    if (!/^\d+$/.test(id)) return null;
    try {
        const timestamp = Number(BigInt(id) >> 22n) + DISCORD_EPOCH;
        const data = new Date(timestamp);
        return Number.isNaN(data.getTime()) ? null : data;
    } catch {
        return null;
    }
}

function estaNoPeriodo(data, inicio, fim) {
    if (!data) return false;
    if (inicio && data < inicio) return false;
    if (fim && data >= fim) return false;
    return true;
}

function inicioDaSemana(data = new Date()) {
    const inicio = new Date(data);
    const dia = inicio.getDay();
    const distancia = dia === 0 ? 6 : dia - 1;
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - distancia);
    return inicio;
}

function fimDaSemana(data = new Date()) {
    const fim = inicioDaSemana(data);
    fim.setDate(fim.getDate() + 7);
    return fim;
}

function inicioDoMes(data = new Date()) {
    return new Date(data.getFullYear(), data.getMonth(), 1, 0, 0, 0, 0);
}

function fimDoMes(data = new Date()) {
    return new Date(data.getFullYear(), data.getMonth() + 1, 1, 0, 0, 0, 0);
}

function inicioDaTemporada(data = new Date()) {
    const temporada = lerTemporada();
    if (temporada.inicio) {
        const inicio = new Date(temporada.inicio);
        if (Number.isFinite(inicio.getTime())) return inicio;
    }
    return inicioDoMes(data);
}

function fimDaTemporada(data = new Date()) {
    return new Date(data);
}

function normalizarId(valor) {
    if (valor === null || valor === undefined) return null;
    const texto = String(valor);
    const mencao = texto.match(/^<@!?(\d+)>$/);
    if (mencao) return mencao[1];
    return /^\d+$/.test(texto) ? texto : null;
}

function extrairId(valor) {
    if (!valor) return null;
    if (typeof valor === 'string' || typeof valor === 'number') return normalizarId(valor);
    if (typeof valor === 'object') return extrairId(valor.id) || extrairId(valor.userId) || extrairId(valor.jogadorId) || extrairId(valor.discordId);
    return null;
}

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function garantirJogador(mapa, id) {
    if (!id) return null;
    const jogadorId = String(id);
    if (!mapa[jogadorId]) {
        mapa[jogadorId] = { id: jogadorId, partidas: 0, vitorias: 0, derrotas: 0, pontos: 0, pontosGanhos: 0, pontosPerdidos: 0, kills: 0, mortes: 0, continentes: 0, europa: 0, asia: 0, africa: 0, amnorte: 0, amsul: 0, oceania: 0, warCoins: 0, primeiroLugar: 0, segundoLugar: 0 };
    }
    return mapa[jogadorId];
}

function participantes(partida) {
    const ids = new Set();
    for (const jogador of Array.isArray(partida?.jogadoresBrutos) ? partida.jogadoresBrutos : []) {
        const id = extrairId(jogador); if (id) ids.add(id);
    }
    for (const idOriginal of Object.keys(partida?.pontos || {})) {
        const id = extrairId(idOriginal); if (id) ids.add(id);
    }
    for (const chave of ['vencedor', 'segundo', 'segundoLugar', 'runnerUp']) {
        const id = extrairId(partida?.respostas?.[chave]); if (id) ids.add(id);
    }
    return [...ids];
}

function processarPartida(jogadores, registro) {
    const partida = registro?.partida;
    if (!partida || typeof partida !== 'object') return;
    if (partida.anulada === true || partida.anulado === true || partida.cancelada === true || partida.cancelado === true) return;
    for (const id of participantes(partida)) garantirJogador(jogadores, id).partidas++;
    const vencedor = extrairId(partida?.respostas?.vencedor);
    if (vencedor) garantirJogador(jogadores, vencedor).primeiroLugar++;
    const segundo = extrairId(partida?.respostas?.segundo || partida?.respostas?.segundoLugar || partida?.respostas?.runnerUp);
    if (segundo) garantirJogador(jogadores, segundo).segundoLugar++;
    const abates = partida?.respostas?.abates;
    if (Array.isArray(abates)) for (const kill of abates) {
        const matador = extrairId(kill?.matador || kill?.killer || kill?.atacante || kill?.quemMatou);
        const vitima = extrairId(kill?.vitima || kill?.victim || kill?.morto || kill?.quemMorreu);
        if (matador) garantirJogador(jogadores, matador).kills++;
        if (vitima) garantirJogador(jogadores, vitima).mortes++;
    }
    const continentes = partida?.respostas?.continentes;
    if (Array.isArray(continentes)) for (const continente of continentes) {
        const id = extrairId(continente?.dono || continente?.jogador || continente?.jogadorId || continente?.userId || continente?.conquistador);
        if (!id) continue;
        const jogador = garantirJogador(jogadores, id); jogador.continentes++;
        const nome = String(continente?.cont || continente?.continente || continente?.territorio || '').toLowerCase().trim();
        if (nome === 'europa' || nome === 'europe') jogador.europa++;
        else if (nome === 'asia' || nome === 'ásia') jogador.asia++;
        else if (nome === 'africa' || nome === 'áfrica') jogador.africa++;
        else if (['amnorte', 'am_norte', 'america_do_norte', 'américa_do_norte'].includes(nome)) jogador.amnorte++;
        else if (['amsul', 'am_sul', 'america_do_sul', 'américa_do_sul'].includes(nome)) jogador.amsul++;
        else if (nome === 'oceania' || nome === 'oceânia') jogador.oceania++;
    }
    for (const [idOriginal, dados] of Object.entries(partida.pontos || {})) {
        const id = extrairId(idOriginal); if (!id) continue;
        const jogador = garantirJogador(jogadores, id);
        let pontos = 0, wc = 0;
        if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
            pontos = numero(dados.ptsLiga ?? dados.pontos ?? dados.pontuacao);
            wc = numero(dados.wcRecebido ?? dados.warCoins ?? dados.wc);
        } else pontos = numero(dados);
        jogador.pontosGanhos += Math.max(0, pontos);
        jogador.pontosPerdidos += Math.max(0, -pontos);
        jogador.warCoins += wc;
    }
}

function filtrarRegistros(inicio, fim) {
    return carregarPartidas().map(registro => ({ registro, data: dataDaPartida(registro) }))
        .filter(item => estaNoPeriodo(item.data, inicio, fim))
        .sort((a, b) => a.data.getTime() - b.data.getTime());
}

function calcularPeriodo(inicio, fim) {
    const jogadores = {};
    const registros = filtrarRegistros(inicio, fim);
    for (const item of registros) processarPartida(jogadores, item.registro);
    for (const jogador of Object.values(jogadores)) {
        jogador.vitorias = jogador.primeiroLugar;
        jogador.derrotas = Math.max(0, jogador.partidas - jogador.vitorias);
        jogador.pontos = jogador.pontosGanhos - jogador.pontosPerdidos;
        jogador.winrate = jogador.partidas ? Number(((jogador.vitorias / jogador.partidas) * 100).toFixed(2)) : 0;
    }
    return { inicio, fim, partidas: registros.length, jogadores, registros };
}

function calcularSemanaAtual(data = new Date()) { return calcularPeriodo(inicioDaSemana(data), fimDaSemana(data)); }
function calcularMesAtual(data = new Date()) { return calcularPeriodo(inicioDoMes(data), fimDoMes(data)); }
function calcularTemporadaAtual(data = new Date()) { return calcularPeriodo(inicioDaTemporada(data), fimDaTemporada(data)); }

function calcularTemporadaAnterior(data = new Date()) {
    const inicio = new Date(data.getFullYear(), data.getMonth() - 1, 1, 0, 0, 0, 0);
    const fim = new Date(data.getFullYear(), data.getMonth(), 1, 0, 0, 0, 0);
    return calcularPeriodo(inicio, fim);
}

function ordenar(periodo, propriedade, limite = 10) { return Object.values(periodo?.jogadores || {}).sort((a, b) => numero(b[propriedade]) - numero(a[propriedade])).slice(0, limite); }
function melhorJogador(periodo, propriedade) { return ordenar(periodo, propriedade, 1)[0] || null; }
function rankingContinente(periodo, continente, limite = 10) { return ordenar(periodo, continente, limite).filter(j => numero(j[continente]) > 0); }

function calcularStreaks(registros) {
    const porJogador = {};
    for (const item of registros || []) {
        const partida = item.registro?.partida; if (!partida) continue;
        const vencedor = extrairId(partida?.respostas?.vencedor);
        for (const id of participantes(partida)) {
            porJogador[id] ||= { atual: 0, maior: 0, vitorias: 0 };
            if (id === vencedor) {
                porJogador[id].atual++; porJogador[id].vitorias++;
                porJogador[id].maior = Math.max(porJogador[id].maior, porJogador[id].atual);
            } else porJogador[id].atual = 0;
        }
    }
    return porJogador;
}

function rankingStreak(periodo, limite = 10) {
    const streaks = calcularStreaks(periodo?.registros || []);
    return Object.entries(streaks).map(([id, dados]) => ({ id, streakAtual: dados.atual, maiorStreak: dados.maior, vitorias: dados.vitorias })).sort((a, b) => b.maiorStreak - a.maiorStreak).slice(0, limite);
}

function calcularEvolucao(atual, anterior) {
    const ids = new Set([...Object.keys(atual?.jogadores || {}), ...Object.keys(anterior?.jogadores || {})]);
    return [...ids].map(id => {
        const pontosAtual = numero(atual?.jogadores?.[id]?.pontos);
        const pontosAnterior = numero(anterior?.jogadores?.[id]?.pontos);
        return { id, pontosAtual, pontosAnterior, variacao: pontosAtual - pontosAnterior };
    }).sort((a, b) => b.variacao - a.variacao);
}

function calcularEvolucaoSemanal(data = new Date()) {
    const atualInicio = inicioDaSemana(data), atualFim = fimDaSemana(data);
    const anteriorInicio = new Date(atualInicio); anteriorInicio.setDate(anteriorInicio.getDate() - 7);
    return calcularEvolucao(calcularPeriodo(atualInicio, atualFim), calcularPeriodo(anteriorInicio, atualInicio));
}

function calcularEvolucaoMensal(data = new Date()) {
    const atualInicio = inicioDoMes(data), atualFim = fimDoMes(data);
    const anteriorInicio = new Date(data.getFullYear(), data.getMonth() - 1, 1, 0, 0, 0, 0);
    return calcularEvolucao(calcularPeriodo(atualInicio, atualFim), calcularPeriodo(anteriorInicio, atualInicio));
}

function resumoPeriodo(periodo) {
    const jogadores = Object.values(periodo?.jogadores || {});
    return {
        partidas: numero(periodo?.partidas), jogadores: jogadores.length,
        vitorias: jogadores.reduce((t, j) => t + numero(j.vitorias), 0),
        kills: jogadores.reduce((t, j) => t + numero(j.kills), 0),
        mortes: jogadores.reduce((t, j) => t + numero(j.mortes), 0),
        continentes: jogadores.reduce((t, j) => t + numero(j.continentes), 0)
    };
}

module.exports = {
    dataDaPartida, inicioDaSemana, fimDaSemana, inicioDoMes, fimDoMes,
    inicioDaTemporada, fimDaTemporada, calcularSemanaAtual, calcularMesAtual,
    calcularTemporadaAtual, calcularTemporadaAnterior, ordenar, melhorJogador,
    rankingContinente, rankingStreak, calcularEvolucao, calcularEvolucaoSemanal,
    calcularEvolucaoMensal, resumoPeriodo
};