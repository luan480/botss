/* ========================================================================
   WRAPPER DA LIGA — handleIniciar

   Responsável por garantir caminhos consistentes e restaurar os bancos se
   o motor falhar antes de gravar a partida.
   ======================================================================== */

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

const clonar = valor => JSON.parse(JSON.stringify(valor ?? {}));
const contar = dados => Object.keys(dados && typeof dados === 'object' ? dados : {}).length;

module.exports = async function handleIniciar(...args) {
    const pontuacaoPath = typeof args[2] === 'string' && args[2].trim() ? args[2] : PONTUACAO_PADRAO;
    const partidasPath = typeof args[3] === 'string' && args[3].trim() ? args[3] : PARTIDAS_PADRAO;
    const argsCorrigidos = [...args];
    argsCorrigidos[2] = pontuacaoPath;
    argsCorrigidos[3] = partidasPath;

    const snapshot = {
        pontuacao: clonar(safeReadJson(pontuacaoPath) || {}),
        partidas: clonar(safeReadJson(partidasPath) || {}),
        economy: clonar(safeReadJson(ECONOMY) || {}),
        progressao: clonar(safeReadJson(PROGRESSAO) || {}),
        punicoes: clonar(safeReadJson(PUNICOES) || {})
    };

    const partidasAntes = contar(snapshot.partidas);
    let erro = null;

    try {
        await core(...argsCorrigidos);
    } catch (e) {
        erro = e;
        console.error('[LIGA] Falha no motor de contabilização:', e);
    }

    const partidasDepois = contar(safeReadJson(partidasPath) || {});
    const criouPartida = partidasDepois > partidasAntes;

    // O core antigo captura alguns erros internamente. Portanto não basta
    // testar throw: a existência de uma nova partida é o commit lógico.
    if (!criouPartida) {
        safeWriteJson(pontuacaoPath, snapshot.pontuacao);
        safeWriteJson(partidasPath, snapshot.partidas);
        safeWriteJson(ECONOMY, snapshot.economy);
        safeWriteJson(PROGRESSAO, snapshot.progressao);
        safeWriteJson(PUNICOES, snapshot.punicoes);

        // Recoloca o arquivo em formato estruturado somente a partir do
        // estado anterior, sem conversões temporárias no meio de uma leitura.
        try {
            pontuacaoLiga.sincronizarArquivo(
                pontuacaoPath,
                partidasPath,
                TEMPORADA_PADRAO
            );
        } catch (syncErro) {
            console.error('[LIGA] Falha ao restaurar pontuação após abort:', syncErro);
        }
    } else {
        // Após o commit, garante o perfil estruturado. Os pontos da partida
        // são lidos do próprio histórico, inclusive quando o registro antigo
        // não possui o campo pontos.
        try {
            pontuacaoLiga.sincronizarArquivo(
                pontuacaoPath,
                partidasPath,
                TEMPORADA_PADRAO
            );
        } catch (syncErro) {
            console.error('[LIGA] Falha ao sincronizar pontuação pós-registro:', syncErro);
        }
    }

    if (erro) throw erro;
};
