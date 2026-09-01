/* ========================================================================
   SISTEMA DE PERÍODOS DA LIGA
   ======================================================================== */

const path = require('path');
const fs = require('fs');
const { carregarPartidas } = require('./estatisticasLiga.js');

const DISCORD_EPOCH = 1420070400000;
const temporadaPath = path.join(__dirname, '..', 'temporada.json');
const numero = v => Number.isFinite(Number(v)) ? Number(v) : 0;

function lerTemporada() {
    try {
        if (!fs.existsSync(temporadaPath)) return {};
        const dados = JSON.parse(fs.readFileSync(temporadaPath, 'utf8'));
        return dados && typeof dados === 'object' ? dados : {};
    } catch (erro) {
        console.error('[LIGA] Erro ao ler temporada.json:', erro.message);
        return {};
    }
}

function dataValida(valor) {
    if (valor instanceof Date) return Number.isFinite(valor.getTime()) ? new Date(valor) : null;
    if (valor === null || valor === undefined || valor === '') return null;
    const d = new Date(valor);
    return Number.isFinite(d.getTime()) ? d : null;
}

function idDiscordParaData(valor) {
    const id = String(valor || '').replace(/^<@!?(\d+)>$/, '$1');
    if (!/^\d{17,20}$/.test(id)) return null;
    try {
        return new Date(Number((BigInt(id) >> 22n) + BigInt(DISCORD_EPOCH)));
    } catch { return null; }
}

function dataDaPartida(registro) {
    const partida = registro?.partida || {};
    const candidatos = [
        partida.meta?.registradaEm,
        partida.meta?.createdAt,
        registro.data,
        registro.dataPartida,
        registro.createdAt,
        registro.timestamp,
        registro.date,
        partida.data,
        partida.dataPartida,
        partida.createdAt,
        partida.timestamp,
        partida.date
    ];
    for (const valor of candidatos) {
        const data = dataValida(valor);
        if (data) return data;
    }
    for (const valor of [registro.id, registro.messageId, partida.id, partida.messageId]) {
        const data = idDiscordParaData(valor);
        if (data) return data;
    }
    return null;
}

function estaNoPeriodo(data, inicio, fim) {
    if (!data) return false;
    return (!inicio || data >= inicio) && (!fim || data < fim);
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

function inicioDoMes(data = new Date()) { return new Date(data.getFullYear(), data.getMonth(), 1); }
function fimDoMes(data = new Date()) { return new Date(data.getFullYear(), data.getMonth() + 1, 1); }

function inicioDaTemporada(data = new Date()) {
    const temporada = lerTemporada();
    const inicio = dataValida(temporada.inicio || temporada.dataInicio);
    return inicio || inicioDoMes(data);
}

function fimDaTemporada(data = new Date()) { return new Date(data); }

function normalizarId(valor) {
    if (valor === null || valor === undefined) return null;
    const texto = String(valor).replace(/^<@!?(\d+)>$/, '$1');
    return /^\d{17,20}$/.test(texto) ? texto : null;
}

function extrairId(valor) {
    if (!valor) return null;
    if (typeof valor === 'string' || typeof valor === 'number') return normalizarId(valor);
    if (typeof valor === 'object') return extrairId(valor.id) || extrairId(valor.userId) || extrairId(valor.jogadorId) || extrairId(valor.discordId);
    return null;
}

function garantirJogador(mapa, id) {
    if (!id) return null;
    const jogadorId = String(id);
    mapa[jogadorId] ||= {
        id: jogadorId,
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
    return mapa[jogadorId];
}

function participantes(partida) {
    const ids = new Set();
    for (const jogador of Array.isArray(partida?.jogadoresBrutos) ? partida.jogadoresBrutos : []) {
        const id = extrairId(jogador);
        if (id) ids.add(id);
    }
    for (const idOriginal of Object.keys(partida?.pontos || {})) {
        const id = extrairId(idOriginal);
        if (id) ids.add(id);
    }
    const respostas = partida?.respostas || partida?.resultado || {};
    for (const chave of ['vencedor', 'segundo', 'segundoLugar', 'runnerUp', 'terceiro', 'terceiroLugar', 'maisTropas', 'maiorTropas']) {
        const id = extrairId(respostas?.[chave]);
        if (id) ids.add(id);
    }
    for (const abate of Array.isArray(respostas?.abates) ? respostas.abates : []) {
        const matador = extrairId(abate?.matador || abate?.killer || abate?.atacante || abate?.quemMatou);
        const vitima = extrairId(abate?.vitima || abate?.victim || abate?.morto || abate?.quemMorreu);
        if (matador) ids.add(matador);
        if (vitima) ids.add(vitima);
    }
    for (const cont of Array.isArray(respostas?.continentes) ? respostas.continentes : []) {
        const id = extrairId(cont?.dono || cont?.jogador || cont?.jogadorId || cont?.userId || cont?.conquistador);
        if (id) ids.add(id);
    }
    return [...ids];
}

function processarPartida(jogadores, registro) {
    const partida = registro?.partida;
    if (!partida || partida.anulada || partida.anulado || partida.cancelada || partida.cancelado) return;

    const respostas = partida?.respostas || partida?.resultado || {};
    const ids = participantes(partida);
    for (const id of ids) garantirJogador(jogadores, id).partidas++;

    const vencedor = extrairId(respostas.vencedor || respostas.winner || respostas.ganhador);
    if (vencedor) garantirJogador(jogadores, vencedor).primeiroLugar++;

    const segundo = extrairId(respostas.segundo || respostas.segundoLugar || respostas.runnerUp);
    if (segundo) garantirJogador(jogadores, segundo).segundoLugar++;

    const terceiro = extrairId(respostas.terceiro || respostas.terceiroLugar);
    if (terceiro) garantirJogador(jogadores, terceiro).terceiroLugar = numero(garantirJogador(jogadores, terceiro).terceiroLugar) + 1;

    const tropas = extrairId(respostas.maisTropas || respostas.maiorTropas || respostas.tropas);
    if (tropas) garantirJogador(jogadores, tropas).maisTropas = numero(garantirJogador(jogadores, tropas).maisTropas) + 1;

    for (const kill of Array.isArray(respostas.abates) ? respostas.abates : []) {
        const matador = extrairId(kill?.matador || kill?.killer || kill?.atacante || kill?.quemMatou);
        const vitima = extrairId(kill?.vitima || kill?.victim || kill?.morto || kill?.quemMorreu);
        if (matador) garantirJogador(jogadores, matador).kills++;
        if (vitima) garantirJogador(jogadores, vitima).mortes++;
    }

    for (const cont of Array.isArray(respostas.continentes) ? respostas.continentes : []) {
        const id = extrairId(cont?.dono || cont?.jogador || cont?.jogadorId || cont?.userId || cont?.conquistador);
        if (!id) continue;
        const j = garantirJogador(jogadores, id);
        j.continentes++;
        const codigo = String(cont?.cont || cont?.continente || cont?.territorio || '').toLowerCase().trim();
        if (codigo === 'europa' || codigo === 'europe') j.europa++;
        else if (codigo === 'asia' || codigo === 'ásia') j.asia++;
        else if (codigo === 'africa' || codigo === 'áfrica') j.africa++;
        else if (['amnorte', 'am_norte', 'america_do_norte', 'américa_do_norte', 'america-norte'].includes(codigo)) j.amnorte++;
        else if (['amsul', 'am_sul', 'america_do_sul', 'américa_do_sul', 'america-sul'].includes(codigo)) j.amsul++;
        else if (codigo === 'oceania' || codigo === 'oceânia') j.oceania++;
    }

    for (const [idOriginal, dados] of Object.entries(partida.pontos || {})) {
        const id = extrairId(idOriginal);
        if (!id) continue;
        const j = garantirJogador(jogadores, id);
        const pontos = dados && typeof dados === 'object'
            ? numero(dados.ptsLiga ?? dados.pontos ?? dados.pontuacao)
            : numero(dados);
        const wc = dados && typeof dados === 'object'
            ? numero(dados.wcRecebido ?? dados.warCoins ?? dados.wc)
            : 0;
        j.pontosGanhos += Math.max(0, pontos);
        j.pontosPerdidos += Math.max(0, -pontos);
        j.warCoins += wc;
    }
}

function filtrarRegistros(inicio, fim) {
    return carregarPartidas()
        .map(registro => ({ registro, data: dataDaPartida(registro) }))
        .filter(x => estaNoPeriodo(x.data, inicio, fim))
        .sort((a, b) => a.data - b.data);
}

function calcularPeriodo(inicio, fim) {
    const jogadores = {};
    const registros = filtrarRegistros(inicio, fim);
    for (const item of registros) processarPartida(jogadores, item.registro);
    for (const j of Object.values(jogadores)) {
        j.vitorias = j.primeiroLugar;
        j.derrotas = Math.max(0, j.partidas - j.vitorias);
        j.pontos = j.pontosGanhos - j.pontosPerdidos;
        j.winrate = j.partidas ? Number(((j.vitorias / j.partidas) * 100).toFixed(2)) : 0;
    }
    return { inicio, fim, partidas: registros.length, jogadores, registros };
}

function calcularSemanaAtual(data = new Date()) { return calcularPeriodo(inicioDaSemana(data), fimDaSemana(data)); }
function calcularMesAtual(data = new Date()) { return calcularPeriodo(inicioDoMes(data), fimDoMes(data)); }
function calcularTemporadaAtual(data = new Date()) { return calcularPeriodo(inicioDaTemporada(data), fimDaTemporada(data)); }
function calcularTemporadaAnterior(data = new Date()) {
    const inicio = new Date(data.getFullYear(), data.getMonth() - 1, 1);
    const fim = new Date(data.getFullYear(), data.getMonth(), 1);
    return calcularPeriodo(inicio, fim);
}
function ordenar(periodo, campo, limite = 10) { return Object.values(periodo?.jogadores || {}).sort((a, b) => numero(b[campo]) - numero(a[campo]) || numero(b.pontos) - numero(a.pontos)).slice(0, limite); }
function melhorJogador(periodo, campo) { return ordenar(periodo, campo, 1)[0] || null; }
function rankingContinente(periodo, continente, limite = 10) { return Object.values(periodo?.jogadores || {}).filter(j => numero(j[continente]) > 0).sort((a,b) => numero(b[continente])-numero(a[continente]) || numero(b.pontos)-numero(a.pontos)).slice(0, limite); }
function rankingStreak(periodo, limite = 10) {
    const atual = {};
    for (const item of periodo?.registros || []) {
        const p = item.registro;
        const vencedor = extrairId((p?.respostas || p?.resultado || {}).vencedor);
        for (const id of participantes(p)) {
            atual[id] ||= { id, streakAtual: 0, maiorStreak: 0, vitorias: 0 };
            if (id === vencedor) {
                atual[id].streakAtual++;
                atual[id].vitorias++;
                atual[id].maiorStreak = Math.max(atual[id].maiorStreak, atual[id].streakAtual);
            } else {
                atual[id].streakAtual = 0;
            }
        }
    }
    return Object.values(atual).sort((a,b)=>b.maiorStreak-a.maiorStreak).slice(0,limite);
}
function calcularEvolucao(atual, anterior) {
    const ids = new Set([...Object.keys(atual?.jogadores || {}), ...Object.keys(anterior?.jogadores || {})]);
    return [...ids].map(id => ({
        id,
        pontosAtual: numero(atual?.jogadores?.[id]?.pontos),
        pontosAnterior: numero(anterior?.jogadores?.[id]?.pontos),
        variacao: numero(atual?.jogadores?.[id]?.pontos)-numero(anterior?.jogadores?.[id]?.pontos)
    })).sort((a,b)=>b.variacao-a.variacao);
}
function calcularEvolucaoSemanal(data = new Date()) { const i = inicioDaSemana(data), f = fimDaSemana(data), ai = new Date(i); ai.setDate(ai.getDate()-7); return calcularEvolucao(calcularPeriodo(i,f), calcularPeriodo(ai,i)); }
function calcularEvolucaoMensal(data = new Date()) { const i = inicioDoMes(data), f = fimDoMes(data), ai = new Date(data.getFullYear(),data.getMonth()-1,1); return calcularEvolucao(calcularPeriodo(i,f), calcularPeriodo(ai,i)); }
function resumoPeriodo(periodo) { const js = Object.values(periodo?.jogadores || {}); return { partidas: numero(periodo?.partidas), jogadores: js.length, vitorias: js.reduce((s,j)=>s+numero(j.vitorias),0), kills: js.reduce((s,j)=>s+numero(j.kills),0), mortes: js.reduce((s,j)=>s+numero(j.mortes),0), continentes: js.reduce((s,j)=>s+numero(j.continentes),0) }; }

module.exports = { dataDaPartida, inicioDaSemana, fimDaSemana, inicioDoMes, fimDoMes, inicioDaTemporada, fimDaTemporada, calcularPeriodo, filtrarRegistros, calcularSemanaAtual, calcularMesAtual, calcularTemporadaAtual, calcularTemporadaAnterior, ordenar, melhorJogador, rankingContinente, rankingStreak, calcularEvolucao, calcularEvolucaoSemanal, calcularEvolucaoMensal, resumoPeriodo };
