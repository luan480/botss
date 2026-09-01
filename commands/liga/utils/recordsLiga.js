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

function salvarHistorico(historico) {
    return safeWriteJson(HISTORICO_PATH, historico);
}

function estrutura() {
    return {
        maiorPontuacao: { valor: 0, jogadorId: null, temporada: null },
        maisVitorias: { valor: 0, jogadorId: null, temporada: null },
        maisKills: { valor: 0, jogadorId: null, temporada: null },
        maisPartidas: { valor: 0, jogadorId: null, temporada: null },
        maisTitulos: { valor: 0, jogadorId: null, temporada: null, jogadorId: null }
    };
}

function normalizarCampeao(valor) {
    if (!valor) return null;
    if (typeof valor === 'object') return String(valor.id || valor.jogadorId || '').replace(/^<@!?(\d+)>$/, '$1') || null;
    return String(valor).match(/<@!?(\d+)>/)?.[1] || (/^\d{17,20}$/.test(String(valor)) ? String(valor) : null);
}

function listaTemporadas(historico) {
    return historico.liga.filter(r => r && typeof r === 'object');
}

function maiorPor(temporadas, campo) {
    let melhor = null;
    for (const registro of temporadas) {
        const candidatos = Array.isArray(registro.rankingCompleto) ? registro.rankingCompleto : (Array.isArray(registro.estatisticas) ? registro.estatisticas : []);
        for (const jogador of candidatos) {
            const valor = numero(jogador?.[campo]);
            if (!melhor || valor > melhor.valor) {
                melhor = { valor, jogadorId: normalizarCampeao(jogador?.id || jogador?.jogadorId), temporada: registro.temporada || registro.nome || null };
            }
        }
    }
    return melhor || { valor: 0, jogadorId: null, temporada: null };
}

function calcularRecords(historico) {
    const temporadas = listaTemporadas(historico);
    const records = estrutura();

    for (const registro of temporadas) {
        const ranking = Array.isArray(registro.rankingCompleto) ? registro.rankingCompleto : (Array.isArray(registro.estatisticas) ? registro.estatisticas : []);
        if (!ranking.length) continue;

        const maiorPontos = ranking.reduce((a, b) => numero(b.pontos) > numero(a.pontos) ? b : a, ranking[0]);
        const maiorVitorias = ranking.reduce((a, b) => numero(b.vitorias) > numero(a.vitorias) ? b : a, ranking[0]);
        const maiorKills = ranking.reduce((a, b) => numero(b.kills) > numero(a.kills) ? b : a, ranking[0]);
        const maiorPartidas = ranking.reduce((a, b) => numero(b.partidas) > numero(a.partidas) ? b : a, ranking[0]);
        const temporada = registro.temporada || registro.nome || null;

        const itens = [
            ['maiorPontuacao', maiorPontos, 'pontos'],
            ['maisVitorias', maiorVitorias, 'vitorias'],
            ['maisKills', maiorKills, 'kills'],
            ['maisPartidas', maiorPartidas, 'partidas']
        ];

        for (const [chave, jogador, campo] of itens) {
            const valor = numero(jogador?.[campo]);
            if (valor > numero(records[chave].valor)) {
                records[chave] = { valor, jogadorId: normalizarCampeao(jogador?.id), temporada };
            }
        }
    }

    const titulos = {};
    for (const registro of temporadas) {
        const id = normalizarCampeao(registro.vencedor || registro.campeao || registro.rankingCompleto?.[0]?.id);
        if (!id) continue;
        titulos[id] ||= { valor: 0, ultimaTemporada: null };
        titulos[id].valor++;
        titulos[id].ultimaTemporada = registro.temporada || registro.nome || null;
    }

    const maiorTitulo = Object.entries(titulos).sort((a, b) => b[1].valor - a[1].valor)[0];
    if (maiorTitulo) {
        records.maisTitulos = {
            valor: maiorTitulo[1].valor,
            jogadorId: maiorTitulo[0],
            temporada: maiorTitulo[1].ultimaTemporada
        };
    }

    return records;
}

function registrarTemporada({ temporada, campeao, pontuacaoCampeao, topVitorias, topKills, topPartidas }) {
    const historico = carregarHistorico();
    const recalculados = calcularRecords(historico);
    const records = recalculados;

    const considerar = (chave, valor, jogadorId) => {
        if (numero(valor) > numero(records[chave].valor)) {
            records[chave] = { valor: numero(valor), jogadorId: normalizarCampeao(jogadorId), temporada: temporada || null };
        }
    };

    considerar('maiorPontuacao', pontuacaoCampeao, campeao);
    if (topVitorias) considerar('maisVitorias', topVitorias.valor, topVitorias.jogadorId);
    if (topKills) considerar('maisKills', topKills.valor, topKills.jogadorId);
    if (topPartidas) considerar('maisPartidas', topPartidas.valor, topPartidas.jogadorId);

    historico.recordsLiga = records;
    salvarHistorico(historico);
    return { houveAlteracao: true, records };
}

function obterRecords() {
    const historico = carregarHistorico();
    const records = calcularRecords(historico);
    historico.recordsLiga = records;
    return records;
}

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
