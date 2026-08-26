const path = require('path');
const { safeReadJson } = require('./helpers.js');

const PARTIDAS_PATH = path.join(__dirname, '..', 'partidas.json');
const DISCORD_EPOCH = 1420070400000n;
function numero(valor) { const n = Number(valor); return Number.isFinite(n) ? n : 0; }
function idDe(valor) { if (valor === null || valor === undefined) return null; if (typeof valor === 'object') return idDe(valor.id) || idDe(valor.userId) || idDe(valor.jogadorId) || idDe(valor.discordId); const texto = String(valor); const mencao = texto.match(/^<@!?(\d+)>$/); return mencao ? mencao[1] : texto; }
function timestampSnowflake(id) { const texto = String(id || ''); if (!/^\d+$/.test(texto)) return null; try { return Number((BigInt(texto) >> 22n) + DISCORD_EPOCH); } catch { return null; } }
function timestampDaPartida(partida, fallbackId) { for (const valor of [partida?.id, partida?.messageId, partida?.mensagemId, partida?.registroId, partida?.createdAt, partida?.criadoEm, partida?.data, fallbackId]) { const snowflake = timestampSnowflake(valor); if (snowflake !== null) return snowflake; const data = new Date(valor || '').getTime(); if (Number.isFinite(data) && data > 0) return data; } return null; }
function criarPerfil(id) { return { id: String(id), partidas: 0, vitorias: 0, derrotas: 0, primeiroLugar: 0, segundoLugar: 0, kills: 0, mortes: 0, continentes: 0, europa: 0, asia: 0, africa: 0, amnorte: 0, amsul: 0, oceania: 0, pontos: 0, pontosGanhos: 0, pontosPerdidos: 0, warCoins: 0, winrate: 0 }; }
function garantir(mapa, id) { if (!id) return null; if (!mapa[id]) mapa[id] = criarPerfil(id); return mapa[id]; }
function carregarPartidas() { const dados = safeReadJson(PARTIDAS_PATH) || {}; if (Array.isArray(dados)) return dados.map((partida, indice) => ({ id: String(indice), partida })); if (Array.isArray(dados.partidas)) return dados.partidas.map((partida, indice) => ({ id: String(indice), partida })); return Object.entries(dados).map(([id, partida]) => ({ id: String(id), partida })); }
function jogadoresDaPartida(partida) { const ids = new Set(); for (const jogador of partida?.jogadoresBrutos || []) { const id = idDe(jogador); if (id) ids.add(id); } for (const idOriginal of Object.keys(partida?.pontos || {})) { const id = idDe(idOriginal); if (id) ids.add(id); } for (const chave of ['vencedor', 'winner', 'ganhador', 'segundo', 'segundoLugar', 'runnerUp']) { const id = idDe(partida?.respostas?.[chave]); if (id) ids.add(id); } return [...ids]; }
function processar(porId, partida) {
    if (!partida || partida.anulada === true || partida.anulado === true || partida.cancelada === true || partida.cancelado === true) return;
    for (const id of jogadoresDaPartida(partida)) garantir(porId, id).partidas++;
    const respostas = partida.respostas || {};
    const vencedor = idDe(respostas.vencedor || respostas.winner || respostas.ganhador); if (vencedor) { const j = garantir(porId, vencedor); j.vitorias++; j.primeiroLugar++; }
    const segundo = idDe(respostas.segundo || respostas.segundoLugar || respostas.runnerUp); if (segundo && segundo !== '0') garantir(porId, segundo).segundoLugar++;
    for (const kill of (respostas.abates || respostas.kills || respostas.eliminacoes || [])) { const matador = idDe(kill?.matador || kill?.killer || kill?.atacante || kill?.quemMatou); const vitima = idDe(kill?.vitima || kill?.victim || kill?.morto || kill?.quemMorreu); if (matador) garantir(porId, matador).kills++; if (vitima) garantir(porId, vitima).mortes++; }
    for (const continente of (respostas.continentes || respostas.territorios || [])) { const id = idDe(continente?.dono || continente?.jogador || continente?.jogadorId || continente?.userId || continente?.conquistador); if (!id) continue; const j = garantir(porId, id); j.continentes++; const nome = String(continente?.cont || continente?.continente || continente?.territorio || '').toLowerCase().trim(); if (nome === 'europa' || nome === 'europe') j.europa++; else if (nome === 'asia' || nome === 'ásia') j.asia++; else if (nome === 'africa' || nome === 'áfrica') j.africa++; else if (['amnorte','am_norte','america_do_norte','américa_do_norte','america-norte'].includes(nome)) j.amnorte++; else if (['amsul','am_sul','america_do_sul','américa_do_sul','america-sul'].includes(nome)) j.amsul++; else if (nome === 'oceania' || nome === 'oceânia') j.oceania++; }
    for (const [idOriginal, dados] of Object.entries(partida.pontos || {})) { const id = idDe(idOriginal); if (!id) continue; const j = garantir(porId, id); const pontos = dados && typeof dados === 'object' && !Array.isArray(dados) ? numero(dados.ptsLiga ?? dados.pontos ?? dados.pontuacao) : numero(dados); j.pontos += pontos; if (pontos >= 0) j.pontosGanhos += pontos; else j.pontosPerdidos += Math.abs(pontos); if (dados && typeof dados === 'object' && !Array.isArray(dados)) j.warCoins += numero(dados.wcRecebido ?? dados.warCoins ?? dados.wc); }
}
function calcular(inicioIso, pontuacaoAtual = null) {
    const inicioMs = inicioIso ? new Date(inicioIso).getTime() : 0;
    const jogadores = {};
    for (const registro of carregarPartidas()) {
        const ts = timestampDaPartida(registro.partida, registro.id);
        // Com uma temporada explícita, registros sem data confiável não podem
        // contaminar o novo ciclo. Registros atuais usam IDs de mensagem Discord.
        if (inicioMs && (ts === null || ts < inicioMs)) continue;
        processar(jogadores, registro.partida);
    }
    if (pontuacaoAtual && typeof pontuacaoAtual === 'object') for (const [idOriginal, dados] of Object.entries(pontuacaoAtual)) { const id = idDe(idOriginal); if (!id) continue; const j = garantir(jogadores, id); const pontos = dados && typeof dados === 'object' && !Array.isArray(dados) ? numero(dados.ptsLiga ?? dados.pontos ?? dados.pontuacao ?? dados.pontosLiga) : numero(dados); if (j.pontos === 0 && pontos !== 0) j.pontos = pontos; }
    for (const j of Object.values(jogadores)) { j.derrotas = Math.max(0, j.partidas - j.vitorias); j.winrate = j.partidas > 0 ? Number(((j.vitorias / j.partidas) * 100).toFixed(2)) : 0; }
    return jogadores;
}
module.exports = { calcular };