const fs = require('fs');
const path = require('path');

const historyPath = path.join(__dirname, 'careerHistory.json');

function ler() {
    try {
        if (!fs.existsSync(historyPath)) return { version: 2, jogadores: {}, temporadas: {} };
        const raw = fs.readFileSync(historyPath, 'utf8');
        const data = JSON.parse(raw);
        if (!data.jogadores || typeof data.jogadores !== 'object') data.jogadores = {};
        if (!data.temporadas || typeof data.temporadas !== 'object') data.temporadas = {};
        data.version = 2;
        return data;
    } catch (error) {
        console.error('[CARREIRA] Falha ao ler careerHistory.json:', error);
        return { version: 2, jogadores: {}, temporadas: {} };
    }
}

function salvar(data) {
    const temporario = `${historyPath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temporario, historyPath);
}

function estruturaJogador(atual = {}) {
    return {
        nome: atual.nome || null,
        totalWins: Number(atual.totalWins) || 0,
        totalKills: Number(atual.totalKills) || 0,
        totalDeaths: Number(atual.totalDeaths) || 0,
        totalMatches: Number(atual.totalMatches) || 0,
        totalContinents: Number(atual.totalContinents) || 0,
        totalPoints: Number(atual.totalPoints) || 0,
        temporadas: Array.isArray(atual.temporadas) ? atual.temporadas : [],
        ligas: Array.isArray(atual.ligas) ? atual.ligas : [],
        titulos: Array.isArray(atual.titulos) ? atual.titulos : [],
        recordes: atual.recordes && typeof atual.recordes === 'object' ? atual.recordes : {}
    };
}

function normalizarJogador(id, nome = null) {
    const data = ler();
    data.jogadores[id] = estruturaJogador(data.jogadores[id]);
    if (nome) data.jogadores[id].nome = nome;
    salvar(data);
    return data.jogadores[id];
}

function registrarDelta(id, delta = {}, contexto = {}, nome = null) {
    const data = ler();
    const atual = estruturaJogador(data.jogadores[id]);

    atual.nome = nome || atual.nome || null;
    atual.totalWins = Math.max(0, atual.totalWins + (Number(delta.wins) || 0));
    atual.totalKills = Math.max(0, atual.totalKills + (Number(delta.kills) || 0));
    atual.totalDeaths = Math.max(0, atual.totalDeaths + (Number(delta.deaths) || 0));
    atual.totalMatches = Math.max(0, atual.totalMatches + (Number(delta.matches) || 0));
    atual.totalContinents = Math.max(0, atual.totalContinents + (Number(delta.continents) || 0));
    atual.totalPoints = Math.max(0, atual.totalPoints + (Number(delta.points) || 0));

    if (contexto.temporada) {
        const temporada = String(contexto.temporada);
        if (!atual.temporadas.includes(temporada)) atual.temporadas.push(temporada);
    }

    if (contexto.liga) {
        const liga = String(contexto.liga);
        if (!atual.ligas.includes(liga)) atual.ligas.push(liga);
    }

    data.jogadores[id] = atual;
    salvar(data);
    return atual;
}

/**
 * Congela uma Liga/temporada no histórico permanente.
 * Não altera pontuacao.json, partidas.json ou qualquer outro banco do ciclo atual.
 * Pode ser chamado imediatamente antes de um reset.
 */
function registrarLigaFinalizada({ temporada, liga, jogadores = [], campeao = null, top10 = [] } = {}) {
    if (!temporada || !liga) {
        throw new Error('[CARREIRA] temporada e liga são obrigatórias.');
    }

    const data = ler();
    const temporadaKey = String(temporada);
    const ligaKey = String(liga);

    if (!data.temporadas[temporadaKey]) {
        data.temporadas[temporadaKey] = { ligas: {} };
    }
    if (!data.temporadas[temporadaKey].ligas) {
        data.temporadas[temporadaKey].ligas = {};
    }

    // Idempotência: executar o reset novamente não duplica a Liga.
    const existente = data.temporadas[temporadaKey].ligas[ligaKey];
    if (existente) return existente;

    const ranking = jogadores
        .map((j, index) => ({
            id: String(j.id || j.userId || ''),
            nome: j.nome || null,
            posicao: Number(j.posicao) || index + 1,
            pontos: Number(j.pontos) || 0,
            vitorias: Number(j.vitorias) || 0,
            derrotas: Number(j.derrotas) || 0,
            kills: Number(j.kills) || 0,
            mortes: Number(j.mortes) || 0,
            partidas: Number(j.partidas) || 0,
            continentes: Number(j.continentes) || 0
        }))
        .filter(j => j.id)
        .sort((a, b) => a.posicao - b.posicao);

    const registro = {
        temporada: temporadaKey,
        liga: ligaKey,
        encerradaEm: new Date().toISOString(),
        campeao: campeao || (ranking[0] ? ranking[0] : null),
        top10: top10.length ? top10 : ranking.slice(0, 10),
        jogadores: ranking
    };

    data.temporadas[temporadaKey].ligas[ligaKey] = registro;

    for (const jogador of ranking) {
        const atual = estruturaJogador(data.jogadores[jogador.id]);
        atual.nome = jogador.nome || atual.nome;
        atual.totalPoints += jogador.pontos;
        atual.totalWins += jogador.vitorias;
        atual.totalKills += jogador.kills;
        atual.totalDeaths += jogador.mortes;
        atual.totalMatches += jogador.partidas;
        atual.totalContinents += jogador.continentes;

        if (!atual.temporadas.includes(temporadaKey)) atual.temporadas.push(temporadaKey);
        if (!atual.ligas.includes(ligaKey)) atual.ligas.push(ligaKey);

        data.jogadores[jogador.id] = atual;
    }

    salvar(data);
    return registro;
}

function obter(id) {
    return ler().jogadores[id] || null;
}

function obterTemporada(temporada) {
    return ler().temporadas[String(temporada)] || null;
}

function obterLiga(temporada, liga) {
    return obterTemporada(temporada)?.ligas?.[String(liga)] || null;
}

module.exports = {
    historyPath,
    ler,
    salvar,
    normalizarJogador,
    registrarDelta,
    registrarLigaFinalizada,
    obter,
    obterTemporada,
    obterLiga
};
