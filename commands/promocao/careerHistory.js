const fs = require('fs');
const path = require('path');

const historyPath = path.join(__dirname, 'careerHistory.json');

function ler() {
    try {
        if (!fs.existsSync(historyPath)) return { version: 1, jogadores: {} };
        const raw = fs.readFileSync(historyPath, 'utf8');
        const data = JSON.parse(raw);
        if (!data.jogadores || typeof data.jogadores !== 'object') data.jogadores = {};
        return data;
    } catch (error) {
        console.error('[CARREIRA] Falha ao ler careerHistory.json:', error);
        return { version: 1, jogadores: {} };
    }
}

function salvar(data) {
    const temporario = `${historyPath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temporario, historyPath);
}

function normalizarJogador(id, nome = null) {
    const data = ler();
    const atual = data.jogadores[id] || {};

    data.jogadores[id] = {
        nome: nome || atual.nome || null,
        totalWins: Number(atual.totalWins) || 0,
        totalKills: Number(atual.totalKills) || 0,
        totalDeaths: Number(atual.totalDeaths) || 0,
        totalMatches: Number(atual.totalMatches) || 0,
        totalContinents: Number(atual.totalContinents) || 0,
        temporadas: Array.isArray(atual.temporadas) ? atual.temporadas : [],
        ligas: Array.isArray(atual.ligas) ? atual.ligas : [],
        recordes: atual.recordes && typeof atual.recordes === 'object' ? atual.recordes : {}
    };

    salvar(data);
    return data.jogadores[id];
}

function registrarDelta(id, delta = {}, contexto = {}, nome = null) {
    const data = ler();
    const atual = data.jogadores[id] || {
        nome: null,
        totalWins: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalMatches: 0,
        totalContinents: 0,
        temporadas: [],
        ligas: [],
        recordes: {}
    };

    atual.nome = nome || atual.nome || null;
    atual.totalWins = Math.max(0, (Number(atual.totalWins) || 0) + (Number(delta.wins) || 0));
    atual.totalKills = Math.max(0, (Number(atual.totalKills) || 0) + (Number(delta.kills) || 0));
    atual.totalDeaths = Math.max(0, (Number(atual.totalDeaths) || 0) + (Number(delta.deaths) || 0));
    atual.totalMatches = Math.max(0, (Number(atual.totalMatches) || 0) + (Number(delta.matches) || 0));
    atual.totalContinents = Math.max(0, (Number(atual.totalContinents) || 0) + (Number(delta.continents) || 0));

    if (contexto.temporada && !atual.temporadas.includes(String(contexto.temporada))) {
        atual.temporadas.push(String(contexto.temporada));
    }

    if (contexto.liga) {
        const chave = String(contexto.liga);
        if (!atual.ligas.includes(chave)) atual.ligas.push(chave);
    }

    data.jogadores[id] = atual;
    salvar(data);
    return atual;
}

function obter(id) {
    return ler().jogadores[id] || null;
}

module.exports = {
    historyPath,
    ler,
    salvar,
    normalizarJogador,
    registrarDelta,
    obter
};
