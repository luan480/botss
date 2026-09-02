/* ========================================================================
   WRAPPER DA LIGA — handleIniciar

   O core antigo trabalha com pontuacao.json numérica. A Liga atual usa
   pontuacao.json estruturado. Por isso o core recebe um arquivo temporário
   numérico com o saldo atual e, somente após o registro ser confirmado,
   convertemos de volta para o formato estruturado.

   Também usamos uma visão temporária de partidas da temporada para manter
   o limite de 80 partidas por temporada sem apagar o histórico permanente.
   ======================================================================== */

const fs = require('fs');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../utils/helpers.js');
const core = require('./handleIniciarCore.js');
const pontuacaoLiga = require('../utils/pontuacaoLiga.js');
const painelMod = require('../painel.js');

const PONTUACAO_PADRAO = path.join(__dirname, '..', 'pontuacao.json');
const PARTIDAS_PADRAO = path.join(__dirname, '..', 'partidas.json');
const TEMPORADA_PADRAO = path.join(__dirname, '..', 'temporada.json');
const ECONOMY = path.join(__dirname, '..', '..', 'economy', 'economy.json');
const PROGRESSAO = path.join(__dirname, '..', '..', 'promocao', 'progressao.json');
const PUNICOES = path.join(__dirname, '..', 'punicoes.json');

const clonar = valor => JSON.parse(JSON.stringify(valor ?? {}));
const contar = dados => Object.keys(dados && typeof dados === 'object' ? dados : {}).length;

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function pontosAtuaisParaCore(pontuacao) {
    const saida = {};
    for (const [id, valor] of Object.entries(pontuacao || {})) {
        const ponto = valor && typeof valor === 'object'
            ? numero(valor.pontos ?? valor.ptsLiga ?? valor.pontuacao)
            : numero(valor);
        if (/^\d{17,20}$/.test(String(id))) saida[id] = ponto;
    }
    return saida;
}

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
    const tempPartidasPath = path.join(__dirname, `partidas.registro.${process.pid}.${Date.now()}.tmp.json`);
    const tempPontuacaoPath = path.join(__dirname, `pontuacao.registro.${process.pid}.${Date.now()}.tmp.json`);

    if (!safeWriteJson(tempPartidasPath, temporadaView)) {
        throw new Error('Não foi possível preparar o histórico temporário da partida.');
    }

    // O core antigo precisa de números simples. O arquivo real permanece
    // estruturado e intocado até a operação terminar com sucesso.
    if (!safeWriteJson(tempPontuacaoPath, pontosAtuaisParaCore(snapshot.pontuacao))) {
        try { fs.unlinkSync(tempPartidasPath); } catch {}
        throw new Error('Não foi possível preparar a pontuação temporária.');
    }

    const argsCorrigidos = [...args];
    argsCorrigidos[2] = tempPontuacaoPath;
    argsCorrigidos[3] = tempPartidasPath;

    let erro = null;
    try {
        await core(...argsCorrigidos);
    } catch (e) {
        erro = e;
        console.error('[LIGA] Falha no motor de contabilização:', e);
    }

    const tempDepois = safeReadJson(tempPartidasPath) || {};
    const pontuacaoDepois = safeReadJson(tempPontuacaoPath) || {};
    const criouPartida = contar(tempDepois) > contar(temporadaView);

    try { fs.unlinkSync(tempPartidasPath); } catch {}
    try { fs.unlinkSync(tempPontuacaoPath); } catch {}

    if (!criouPartida || erro) {
        safeWriteJson(pontuacaoPath, snapshot.pontuacao);
        safeWriteJson(partidasPath, snapshot.partidas);
        safeWriteJson(ECONOMY, snapshot.economy);
        safeWriteJson(PROGRESSAO, snapshot.progressao);
        safeWriteJson(PUNICOES, snapshot.punicoes);
        if (erro) throw erro;
        return;
    }

    const novas = Object.entries(tempDepois).filter(([id]) => !Object.prototype.hasOwnProperty.call(temporadaView, id));
    if (novas.length !== 1) {
        console.error(`[LIGA] Registro inesperado: ${novas.length} novas partidas.`);
        safeWriteJson(pontuacaoPath, snapshot.pontuacao);
        safeWriteJson(partidasPath, snapshot.partidas);
        safeWriteJson(ECONOMY, snapshot.economy);
        safeWriteJson(PROGRESSAO, snapshot.progressao);
        safeWriteJson(PUNICOES, snapshot.punicoes);
        return;
    }

    // Mescla somente o registro novo no histórico permanente.
    const historicoAtual = safeReadJson(partidasPath) || {};
    const [novoId, novoRegistro] = novas[0];
    historicoAtual[novoId] = novoRegistro;

    if (!safeWriteJson(partidasPath, historicoAtual)) {
        safeWriteJson(pontuacaoPath, snapshot.pontuacao);
        safeWriteJson(partidasPath, snapshot.partidas);
        safeWriteJson(ECONOMY, snapshot.economy);
        safeWriteJson(PROGRESSAO, snapshot.progressao);
        safeWriteJson(PUNICOES, snapshot.punicoes);
        throw new Error('Não foi possível salvar a partida no histórico permanente.');
    }

    // Converte os pontos numéricos produzidos pelo core para o formato atual.
    // A função de migração agora preserva esse saldo atual, inclusive punições.
    const estruturado = pontuacaoLiga.paraFormatoEstruturado(
        pontuacaoDepois,
        partidasPath,
        TEMPORADA_PADRAO
    );

    if (!safeWriteJson(pontuacaoPath, estruturado)) {
        safeWriteJson(partidasPath, snapshot.partidas);
        safeWriteJson(pontuacaoPath, snapshot.pontuacao);
        safeWriteJson(ECONOMY, snapshot.economy);
        safeWriteJson(PROGRESSAO, snapshot.progressao);
        safeWriteJson(PUNICOES, snapshot.punicoes);
        throw new Error('Não foi possível salvar a pontuação da Liga.');
    }

    // ============================================================
    // PAINEL DA LIGA — ATUALIZAR SOMENTE DEPOIS DE TUDO SALVO
    // ============================================================
    // O core trabalha com arquivos temporários. Portanto, atualizar o painel
    // dentro do core fazia o painel ler os pontos antigos. Agora o painel só
    // é atualizado depois que partidas.json e pontuacao.json permanentes já
    // foram gravados com sucesso.
    try {
        await painelMod(args[0]?.guild || args[1]?.guild);
        console.log('[LIGA] Painel principal atualizado após contabilização.');
    } catch (erroPainel) {
        // A partida já foi salva; falha no painel não deve desfazer o resultado.
        console.error('[LIGA] Erro ao atualizar painel após contabilização:', erroPainel);
    }
};
