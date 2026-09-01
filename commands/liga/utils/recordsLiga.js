/* ========================================================================
   LIGA — RECORDES HISTÓRICOS
   ======================================================================== */

const path = require('path');
const { safeReadJson, safeWriteJson } = require('./helpers.js');
const HISTORICO_PATH = path.join(__dirname, '..', '..', 'promocao', 'historico.json');
const numero = v => Number.isFinite(Number(v)) ? Number(v) : 0;

function carregarHistorico() {
    const dados = safeReadJson(HISTORICO_PATH) || {};
    if (!Array.isArray(dados.liga)) dados.liga = [];
    if (!Array.isArray(dados.imperador)) dados.imperador = [];
    if (!Array.isArray(dados.eventos)) dados.eventos = [];
    if (!Array.isArray(dados.records)) dados.records = [];
    return dados;
}
function salvarHistorico(historico) { return safeWriteJson(HISTORICO_PATH, historico); }
function estrutura() {
    return {
        maiorPontuacao: { valor: 0, jogadorId: null, temporada: null },
        maisVitorias: { valor: 0, jogadorId: null, temporada: null },
        maisKills: { valor: 0, jogadorId: null, temporada: null },
        maisPartidas: { valor: 0, jogadorId: null, temporada: null },
        maisTitulos: { valor: 0, jogadorId: null, temporada: null }
    };
}
function normalizarId(valor) {
    if (!valor) return null;
    if (typeof valor === 'object') return normalizarId(valor.id || valor.jogadorId);
    const texto = String(valor);
    return texto.match(/<@!?(\d+)>/)?.[1] || (/^\d{17,20}$/.test(texto) ? texto : null);
}
function rankingDe(registro) {
    return Array.isArray(registro?.rankingCompleto) ? registro.rankingCompleto : (Array.isArray(registro?.estatisticas) ? registro.estatisticas : []);
}
function calcularRecords(historico) {
    const records = estrutura();
    const temporadas = historico.liga.filter(r => r && typeof r === 'object');
    for (const registro of temporadas) {
        const ranking = rankingDe(registro);
        const temporada = registro.temporada || registro.nome || null;
        for (const [chave, campo] of [['maiorPontuacao','pontos'],['maisVitorias','vitorias'],['maisKills','kills'],['maisPartidas','partidas']]) {
            for (const jogador of ranking) {
                const valor = numero(jogador?.[campo]);
                if (valor > records[chave].valor) records[chave] = { valor, jogadorId: normalizarId(jogador?.id || jogador?.jogadorId), temporada };
            }
        }
    }
    const titulos = {};
    for (const registro of temporadas) {
        const id = normalizarId(registro.vencedor || registro.campeao || rankingDe(registro)[0]?.id);
        if (!id) continue;
        titulos[id] ||= { valor: 0, temporada: null };
        titulos[id].valor++;
        titulos[id].temporada = registro.temporada || registro.nome || null;
    }
    const top = Object.entries(titulos).sort((a,b)=>b[1].valor-a[1].valor)[0];
    if (top) records.maisTitulos = { valor: top[1].valor, jogadorId: top[0], temporada: top[1].temporada };
    return records;
}
function registrarTemporada({ temporada, campeao, pontuacaoCampeao, topVitorias, topKills, topPartidas }) {
    const historico = carregarHistorico();
    const records = calcularRecords(historico);
    const considerar = (chave, valor, jogadorId) => {
        if (numero(valor) > records[chave].valor) records[chave] = { valor: numero(valor), jogadorId: normalizarId(jogadorId), temporada: temporada || null };
    };
    considerar('maiorPontuacao', pontuacaoCampeao, campeao);
    if (topVitorias) considerar('maisVitorias', topVitorias.valor, topVitorias.jogadorId);
    if (topKills) considerar('maisKills', topKills.valor, topKills.jogadorId);
    if (topPartidas) considerar('maisPartidas', topPartidas.valor, topPartidas.jogadorId);
    historico.recordsLiga = records;
    salvarHistorico(historico);
    return { houveAlteracao: true, records };
}
function obterRecords() { return calcularRecords(carregarHistorico()); }
function gerarTextoRecords() {
    const r = obterRecords();
    const linhas = [];
    if (r.maiorPontuacao.jogadorId) linhas.push(`🏆 **Maior Pontuação:** <@${r.maiorPontuacao.jogadorId}> — **${r.maiorPontuacao.valor} pts**`);
    if (r.maisVitorias.jogadorId) linhas.push(`✅ **Mais Vitórias:** <@${r.maisVitorias.jogadorId}> — **${r.maisVitorias.valor} vitórias**`);
    if (r.maisKills.jogadorId) linhas.push(`💀 **Mais Kills:** <@${r.maisKills.jogadorId}> — **${r.maisKills.valor} kills**`);
    if (r.maisPartidas.jogadorId) linhas.push(`⚔️ **Mais Partidas:** <@${r.maisPartidas.jogadorId}> — **${r.maisPartidas.valor} partidas**`);
    if (r.maisTitulos.jogadorId) linhas.push(`👑 **Mais Títulos:** <@${r.maisTitulos.jogadorId}> — **${r.maisTitulos.valor} títulos**`);
    return linhas.join('\n') || '*Ainda não existem records registrados.*';
}
module.exports = { carregarHistorico, salvarHistorico, registrarTemporada, obterRecords, gerarTextoRecords };
