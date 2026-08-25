const fs = require('fs');
const path = require('path');
const { safeReadJson } = require('./helpers.js');

const PARTIDAS_PATH = path.join(__dirname, '..', 'partidas.json');

const DISCORD_EPOCH = 1420070400000n;

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function idDe(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'object') {
        return idDe(valor.id) || idDe(valor.userId) || idDe(valor.jogadorId) || idDe(valor.discordId);
    }
    const texto = String(valor);
    const mencao = texto.match(/^<@!?(\d+)>$/);
    return mencao ? mencao[1] : texto;
}

function timestampSnowflake(id) {
    const texto = String(id || '');
    if (!/^\d+$/.test(texto)) return null;
    try {
        return Number((BigInt(texto) >> 22n) + DISCORD_EPOCH);
    } catch {
        return null;
    }
}

function criarPerfil(id) {
    return {
        id: String(id),
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
        winrate: 0
    };
}

function garantir(mapa, id) {
    if (!id) return null;
    if (!mapa[id]) mapa[id] = criarPerfil(id);
    return mapa[id];
}

function carregarPartidas() {
    const dados = safeReadJson(PARTIDAS_PATH) || {};
    if (Array.isArray(dados)) return dados.map((partida, indice) => ({ id: String(indice), partida }));
    if (Array.isArray(dados.partidas)) return dados.partidas.map((partida, indice) => ({ id: String(indice), partida }));
    return Object.entries(dados).map(([id, partida]) => ({ id: String(id), partida }));
}

function jogadoresDaPartida(partida) {
    const ids = new Set();
    for (const jogador of partida?.jogadoresBrutos || []) {
        const id = idDe(jogador);
        if (id) ids.add(id);
    }
    for (const idOriginal of Object.keys(partida?.pontos || {})) {
        const id = idDe(idOriginal);
        if (id) ids.add(id);
    }
    for (const chave of ['vencedor', 'winner', 'ganhador', 'segundo', 'segundoLugar', 'runnerUp']) {
        const id = idDe(partida?.respostas?.[chave]);
        if (id) ids.add(id);
    }
    return [...ids];
}

function obterVencedor(partida) {
    return idDe(partida?.respostas?.vencedor || partida?.respostas?.winner || partida?.respostas?.ganhador);
}

function obterSegundo(partida) {
    return idDe(partida?.respostas?.segundo || partida?.respostas?.segundoLugar || partida?.respostas?.runnerUp);
}

function processar(porId, partida) {
    if (!partida || partida.anulada === true || partida.anulado === true || partida.cancelada === true || partida.cancelado === true) return;

    for (const id of jogadoresDaPartida(partida)) {
        garantir(porId, id).partidas++;
    }

    const vencedor = obterVencedor(partida);
    if (vencedor) {
        const jogador = garantir(porId, vencedor);
        jogador.vitorias++;
        jogador.primeiroLugar++;
    }

    const segundo = obterSegundo(partida);
    if (segundo && segundo !== '0') {
        const jogador = garantir(porId, segundo);
        jogador.segundoLugar++;
    }

    for (const kill of (partida?.respostas?.abates || partida?.respostas?.kills || partida?.respostas?.eliminacoes || [])) {
        const matador = idDe(kill?.matador || kill?.killer || kill?.atacante || kill?.quemMatou);
        const vitima = idDe(kill?.vitima || kill?.victim || kill?.morto || kill?.quemMorreu);
        if (matador) garantir(porId, matador).kills++;
        if (vitima) garantir(porId, vitima).mortes++;
    }

    for (const continente of (partida?.respostas?.continentes || partida?.respostas?.territorios || [])) {
        const id = idDe(continente?.dono || continente?.jogador || continente?.jogadorId || continente?.userId || continente?.conquistador);
        if (!id) continue;
        const jogador = garantir(porId, id);
        jogador.continentes++;
        const nome = String(continente?.cont || continente?.continente || continente?.territorio || '').toLowerCase().trim();
        if (nome === 'europa' || nome === 'europe') jogador.europa++;
        else if (nome === 'asia' || nome === 'ásia') jogador.asia++;
        else if (nome === 'africa' || nome === 'áfrica') jogador.africa++;
        else if (['amnorte','am_norte','america_do_norte','américa_do_norte','america-norte'].includes(nome)) jogador.amnorte++;
        else if (['amsul','am_sul','america_do_sul','américa_do_sul','america-sul'].includes(nome)) jogador.amsul++;
        else if (nome === 'oceania' || nome === 'oceânia') jogador.oceania++;
    }

    for (const [idOriginal, dados] of Object.entries(partida?.pontos || {})) {
        const id = idDe(idOriginal);
        if (!id) continue;
        const jogador = garantir(porId, id);
        if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
            const pontos = numero(dados.ptsLiga ?? dados.pontos ?? dados.pontuacao);
            jogador.pontos += pontos;
            if (pontos >= 0) jogador.pontosGanhos += pontos;
            else jogador.pontosPerdidos += Math.abs(pontos);
            jogador.warCoins += numero(dados.wcRecebido ?? dados.warCoins ?? dados.wc);
        } else {
            const pontos = numero(dados);
            jogador.pontos += pontos;
            if (pontos >= 0) jogador.pontosGanhos += pontos;
            else jogador.pontosPerdidos += Math.abs(pontos);
        }
    }
}

function calcular(inicioIso, pontuacaoAtual = null) {
    const inicioMs = inicioIso ? new Date(inicioIso).getTime() : 0;
    const jogadores = {};

    for (const registro of carregarPartidas()) {
        const partida = registro?.partida;
        const id = registro?.id || partida?.id;
        const ts = timestampSnowflake(id);
        if (inicioMs && ts !== null && ts < inicioMs) continue;
        processar(jogadores, partida);
    }

    // Em registros legados sem pontos por partida, preserva o saldo atual.
    if (pontuacaoAtual && typeof pontuacaoAtual === 'object') {
        for (const [idOriginal, pontos] of Object.entries(pontuacaoAtual)) {
            const id = idDe(idOriginal);
            if (!id) continue;
            const jogador = garantir(jogadores, id);
            if (jogador.pontos === 0 && numero(pontos) !== 0) jogador.pontos = numero(pontos);
        }
    }

    for (const jogador of Object.values(jogadores)) {
        jogador.derrotas = Math.max(0, jogador.partidas - jogador.vitorias);
        jogador.winrate = jogador.partidas > 0 ? Number(((jogador.vitorias / jogador.partidas) * 100).toFixed(2)) : 0;
    }

    return jogadores;
}

module.exports = { calcular };
