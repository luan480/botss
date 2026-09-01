/* ========================================================================
   MIGRAÇÃO DE INTEGRIDADE DA LIGA

   Idempotente: só altera registros novos/estruturados que possuem jogadores
   com IDs Discord válidos e não possuem pontos persistidos.
   Registros legados sem estrutura suficiente são preservados.
   ======================================================================== */

const path = require('path');
const { safeReadJson, safeWriteJson } = require('./helpers.js');
const liga = require('./pontuacaoLiga.js');

const PARTIDAS = path.join(__dirname, '..', 'partidas.json');
const PONTOS = path.join(__dirname, '..', 'pontuacao.json');
const TEMPORADA = path.join(__dirname, '..', 'temporada.json');

function idValido(id) { return /^\d{17,20}$/.test(String(id || '')); }

function executar() {
    const partidas = safeReadJson(PARTIDAS) || {};
    let reparados = 0;

    for (const [matchId, partida] of Object.entries(partidas)) {
        if (!partida || partida.anulada || partida.anulado || partida.cancelada || partida.cancelado) continue;
        if (!Array.isArray(partida.jogadoresBrutos) || !partida.jogadoresBrutos.length) continue;

        const jogadores = partida.jogadoresBrutos.filter(j => idValido(j?.id));
        if (!jogadores.length) continue;

        const pontos = partida.pontos && typeof partida.pontos === 'object' ? { ...partida.pontos } : {};
        let alterou = false;

        for (const jogador of jogadores) {
            const id = String(jogador.id);
            if (pontos[id] !== undefined && pontos[id] !== null) continue;

            const valor = liga.pontosDaPartida(partida, id);
            pontos[id] = {
                ptsLiga: valor,
                wcRecebido: valor > 0 ? valor * 100 : 0,
                vitoria: id === String(partida.respostas?.vencedor || '') ? 1 : 0,
                migradoEm: new Date().toISOString()
            };
            reparados++;
            alterou = true;
        }

        if (alterou) partidas[matchId] = { ...partida, pontos };
    }

    if (reparados > 0) {
        if (!safeWriteJson(PARTIDAS, partidas)) throw new Error('Não foi possível salvar a migração da Liga.');
        liga.sincronizarArquivo(PONTOS, PARTIDAS, TEMPORADA);
    }

    return reparados;
}

module.exports = { executar };
