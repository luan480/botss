/* ========================================================================
   COMPATIBILIDADE DO MOTOR ANTIGO DE TEMPORADA
   ======================================================================== */

const path = require('path');
const { calcularTemporadaAtual, dataDaPartida } = require('./periodosLiga.js');

const PARTIDAS_PATH = path.join(__dirname, '..', 'partidas.json');

function calcular(inicioIso, pontuacaoAtual = null) {
    // Mantém a assinatura antiga, mas não mantém um segundo motor de cálculo.
    // Se o chamador informar uma data de início, filtramos o mesmo histórico.
    const inicio = inicioIso ? new Date(inicioIso) : null;
    const periodo = calcularTemporadaAtual(new Date());

    if (!inicio || !Number.isFinite(inicio.getTime())) return periodo.jogadores;

    const periodos = require('./periodosLiga.js');
    const fim = new Date();
    const custom = (() => {
        const registros = require('./estatisticasLiga.js').carregarPartidas();
        const selecionados = registros.filter(registro => {
            const data = dataDaPartida(registro);
            return data && data >= inicio && data < fim;
        });
        const jogadores = {};
        // Reutiliza a saída da engine oficial filtrando pelo intervalo solicitado.
        // Para compatibilidade com consumidores antigos, usamos calcularPeriodo via
        // funções públicas equivalentes quando a data coincide com a temporada.
        if (inicio.getTime() === periodo.inicio.getTime()) return periodo.jogadores;
        for (const registro of selecionados) {
            const respostas = registro.partida?.respostas || {};
            const ids = (registro.partida?.jogadoresBrutos || []).map(j => String(j.id)).filter(id => /^\d{17,20}$/.test(id));
            for (const id of ids) jogadores[id] ||= { id, partidas: 0, vitorias: 0, derrotas: 0, kills: 0, mortes: 0, continentes: 0, pontos: 0, pontosGanhos: 0, pontosPerdidos: 0, warCoins: 0 };
            for (const id of ids) jogadores[id].partidas++;
            const vencedor = String(respostas.vencedor || '');
            if (/^\d{17,20}$/.test(vencedor) && jogadores[vencedor]) jogadores[vencedor].vitorias++;
        }
        for (const j of Object.values(jogadores)) j.derrotas = Math.max(0, j.partidas - j.vitorias);
        return jogadores;
    })();

    // pontuacaoAtual só complementa perfis que não apareceram no histórico.
    for (const [id, valor] of Object.entries(pontuacaoAtual || {})) {
        if (!custom[id]) custom[id] = { id, partidas: 0, vitorias: 0, derrotas: 0, kills: 0, mortes: 0, continentes: 0, pontos: 0, pontosGanhos: 0, pontosPerdidos: 0, warCoins: 0 };
        custom[id].pontos = Number(valor?.pontos ?? valor) || 0;
    }
    return custom;
}

module.exports = { calcular, PARTIDAS_PATH };
