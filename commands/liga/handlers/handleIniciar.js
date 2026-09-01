/* ========================================================================
   WRAPPER DA LIGA — handleIniciar

   O core antigo conta partidas pelo arquivo recebido. Para preservar a
   regra correta de **80 partidas por temporada**, ele recebe uma visão
   temporária contendo somente as partidas da temporada atual. Depois do
   commit, o novo registro é mesclado no histórico permanente.
   ======================================================================== */

const fs = require('fs');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../utils/helpers.js');
const core = require('./handleIniciarCore.js');
const pontuacaoLiga = require('../utils/pontuacaoLiga.js');

const PONTUACAO_PADRAO = path.join(__dirname, '..', 'pontuacao.json');
const PARTIDAS_PADRAO = path.join(__dirname, '..', 'partidas.json');
const TEMPORADA_PADRAO = path.join(__dirname, '..', 'temporada.json');
const ECONOMY = path.join(__dirname, '..', '..', 'economy', 'economy.json');
const PROGRESSAO = path.join(__dirname, '..', '..', 'promocao', 'progressao.json');
const PUNICOES = path.join(__dirname, '..', 'punicoes.json');
const MAX_PARTIDAS = 80;

const clonar = valor => JSON.parse(JSON.stringify(valor ?? {}));
const contar = dados => Object.keys(dados && typeof dados === 'object' ? dados : {}).length;

function inicioTemporada() {
    const temporada = safeReadJson(TEMPORADA_PADRAO) || {};
    const data = new Date(temporada.inicio || temporada.dataInicio || 0);
    return Number.isFinite(data.getTime()) && data.getTime() > 0 ? data.getTime() : 0;
}

function dataPartida(registro) {
    const partida = registro?.partida || registro || {};
    const candidatos = [
        partida.meta?.registradaEm,
        partida.meta?.createdAt,
        partida.data,
        partida.createdAt,
        registro?.data,
        registro?.createdAt,
        registro?.id
    ];
    for (const valor of candidatos) {
        if (/^\d{17,20}$/.test(String(valor || ''))) {
            try { return Number((BigInt(String(valor)) >> 22n) + 1420070400000n); } catch {}
        }
        const ms = new Date(valor || '').getTime();
        if (Number.isFinite(ms) && ms > 0) return ms;
    }
    return null;
}

function partidasDaTemporada(partidas) {
    const inicio = inicioTemporada();
    if (!inicio) return {};
    const saida = {};
    for (const [id, partida] of Object.entries(partidas || {})) {
        const data = dataPartida({ id, partida });
        // Registros antigos sem data confiável não entram na contagem da
        // temporada nova; continuam preservados no histórico permanente.
        if (data !== null && data >= inicio) saida[id] = partida;
    }
    return saida;
}

module.exports = async function handleIniciar(...args) {
    const pontuacaoPath = typeof args[2] === 'string' && args[2].trim() ? args[2] : PONTUACAO_PADRAO;
    const partidasPath = typeof args[3] === 'string' && args[3].trim() ? args[3] : PARTIDAS_PADRAO;

    const snapshot = {
        pontuacao: clonar(safeReadJson(pontuacaoPath) || {}),
        partidas: clonar(safeReadJson(partidasPath) || {}),
        economy: clonar(safeReadJson(ECONOMY) || {}),
        progressao: clonar(safeReadJson(PROGRESSAO) || {}),
        punicoes: clonar(safeReadJson(PUNICOES) || {})
    };

    const temporadaView = partidasDaTemporada(snapshot.partidas);
    const tempPath = path.join(__dirname, `partidas.registro.${process.pid}.${Date.now()}.tmp.json`);
    safeWriteJson(tempPath, temporadaView);

    const argsCorrigidos = [...args];
    argsCorrigidos[2] = pontuacaoPath;
    argsCorrigidos[3] = tempPath;

    let erro = null;
    try {
        await core(...argsCorrigidos);
    } catch (e) {
        erro = e;
        console.error('[LIGA] Falha no motor de contabilização:', e);
    }

    const tempDepois = safeReadJson(tempPath) || {};
    const criouPartida = contar(tempDepois) > contar(temporadaView);

    try { fs.unlinkSync(tempPath); } catch {}

    if (!criouPartida) {
        safeWriteJson(pontuacaoPath, snapshot.pontuacao);
        safeWriteJson(partidasPath, snapshot.partidas);
        safeWriteJson(ECONOMY, snapshot.economy);
        safeWriteJson(PROGRESSAO, snapshot.progressao);
        safeWriteJson(PUNICOES, snapshot.punicoes);
        try { pontuacaoLiga.sincronizarArquivo(pontuacaoPath, partidasPath, TEMPORADA_PADRAO); } catch (e) { console.error('[LIGA] Restauração de pontos:', e); }
        if (erro) throw erro;
        return;
    }

    // O limite continua explícito para impedir que o core antigo conte
    // acidentalmente partidas de outras temporadas.
    const novas = Object.entries(tempDepois).filter(([id]) => !Object.prototype.hasOwnProperty.call(temporadaView, id));
    if (novas.length !== 1) {
        console.error(`[LIGA] Registro inesperado: ${novas.length} novas partidas.`);
        safeWriteJson(pontuacaoPath, snapshot.pontuacao);
        safeWriteJson(partidasPath, snapshot.partidas);
        safeWriteJson(ECONOMY, snapshot.economy);
        safeWriteJson(PROGRESSAO, snapshot.progressao);
        return;
    }

    // Mescla somente o registro novo no histórico permanente.
    const historicoAtual = safeReadJson(partidasPath) || {};
    const [novoId, novoRegistro] = novas[0];
    historicoAtual[novoId] = novoRegistro;
    safeWriteJson(partidasPath, historicoAtual);

    try {
        pontuacaoLiga.sincronizarArquivo(pontuacaoPath, partidasPath, TEMPORADA_PADRAO);
    } catch (syncErro) {
        console.error('[LIGA] Falha ao sincronizar pontuação pós-registro:', syncErro);
    }

    if (erro) throw erro;
};
