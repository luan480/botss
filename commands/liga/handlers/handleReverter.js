/* ========================================================================
   LIGA — HANDLER DE ANULAÇÃO

   REGRA DA REVERSÃO:
   - A partida NÃO é apagada: fica anulada para auditoria.
   - O histórico válido deixa de considerar a partida anulada.
   - A pontuação NÃO é subtraída manualmente: o histórico válido é a fonte
     de verdade e a sincronização reconstrói o total.
   - Ajustes manuais são preservados pelo pontuacaoLiga como delta.
   - WarCoins e progressão operacional são estornados separadamente.
   ======================================================================== */

const path = require('path');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeReadJson, safeWriteJson, isStaff } = require('../utils/helpers.js');
const pontuacaoLiga = require('../utils/pontuacaoLiga.js');
const painelLiga = require('../painel.js');

const PONTOS = path.join(__dirname, '..', 'pontuacao.json');
const PARTIDAS = path.join(__dirname, '..', 'partidas.json');
const TEMPORADA = path.join(__dirname, '..', 'temporada.json');
const ECONOMY = path.join(__dirname, '..', '..', 'economy', 'economy.json');
const PROGRESSAO = path.join(__dirname, '..', '..', 'promocao', 'progressao.json');

const numero = valor => {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
};

const clone = valor => JSON.parse(JSON.stringify(valor ?? {}));

function idDe(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'object') {
        return idDe(valor.id || valor.userId || valor.jogadorId || valor.discordId);
    }

    const id = String(valor).replace(/^<@!?(\d+)>$/, '$1');
    return /^\d{17,20}$/.test(id) ? id : null;
}

function extrairPontos(valor) {
    if (valor && typeof valor === 'object') {
        return numero(valor.ptsLiga ?? valor.pontos ?? valor.pontuacao);
    }
    return numero(valor);
}

function obterPontos(partida) {
    const saida = {};
    const jogadores = Array.isArray(partida?.jogadoresBrutos)
        ? partida.jogadoresBrutos
        : [];

    for (const jogador of jogadores) {
        const id = idDe(jogador);
        if (!id) continue;

        const salvo = partida?.pontos?.[id];
        if (salvo !== undefined) {
            saida[id] = extrairPontos(salvo);
        } else {
            saida[id] = pontuacaoLiga.pontosDaPartida(partida, id);
        }
    }

    return saida;
}

function obterJogadores(partida, pontos) {
    const ids = new Set(Object.keys(pontos || {}));

    for (const jogador of Array.isArray(partida?.jogadoresBrutos)
        ? partida.jogadoresBrutos
        : []) {
        const id = idDe(jogador);
        if (id) ids.add(id);
    }

    const respostas = partida?.respostas || partida?.resultado || {};

    for (const chave of [
        'vencedor', 'winner', 'ganhador', 'segundo', 'segundoLugar',
        'runnerUp', 'terceiro', 'terceiroLugar', 'maisTropas',
        'maiorTropas', 'tropas'
    ]) {
        const id = idDe(respostas?.[chave]);
        if (id) ids.add(id);
    }

    return ids;
}

function obterWarCoins(partida, id, pontos) {
    const salvo = partida?.pontos?.[id];

    if (salvo && typeof salvo === 'object') {
        if (salvo.wcRecebido !== undefined) return numero(salvo.wcRecebido);
        if (salvo.warCoins !== undefined) return numero(salvo.warCoins);
        if (salvo.wc !== undefined) return numero(salvo.wc);
    }

    return pontos > 0 ? pontos * 100 : 0;
}

function marcarAnulada(partida, interaction) {
    return {
        ...partida,
        anulada: true,
        anuladaEm: new Date().toISOString(),
        anuladaPor: interaction.user.id,
        motivoAnulacao: 'Anulação manual pela Liga'
    };
}

function diminuir(objeto, chave, quantidade = 1) {
    if (!objeto || objeto[chave] === undefined) return;
    objeto[chave] = Math.max(0, numero(objeto[chave]) - numero(quantidade));
}

module.exports = async function handleReverter(
    client,
    interaction,
    pontuacaoPath = PONTOS,
    partidasPath = PARTIDAS
) {
    if (!interaction?.customId?.startsWith('edit_match_')) return;

    if (!interaction.replied && !interaction.deferred) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch {
            return;
        }
    }

    const matchId = String(interaction.customId).slice('edit_match_'.length);
    const partidas = safeReadJson(partidasPath) || {};
    const partida = partidas[matchId];

    if (!partida) {
        return interaction.editReply({
            content: `❌ Partida não encontrada: \`${matchId}\``
        });
    }

    if (partida.anulada === true || partida.anulado === true || partida.cancelada === true || partida.cancelado === true) {
        return interaction.editReply({
            content: '⚠️ Esta partida já está anulada.'
        });
    }

    const autorizado = Boolean(
        interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator) ||
        isStaff(interaction.member) ||
        String(partida.adminId || '') === String(interaction.user.id)
    );

    if (!autorizado) {
        return interaction.editReply({
            content: '❌ **ACESSO NEGADO!** Você não pode anular esta partida.'
        });
    }

    const antes = {
        partidas: clone(partidas),
        pontuacao: clone(safeReadJson(pontuacaoPath) || {}),
        economy: clone(safeReadJson(ECONOMY) || {}),
        progressao: clone(safeReadJson(PROGRESSAO) || {})
    };

    try {
        const pontos = obterPontos(partida);
        const respostas = partida.respostas || partida.resultado || {};
        const vencedor = idDe(respostas.vencedor || respostas.winner || respostas.ganhador);
        const jogadores = obterJogadores(partida, pontos);

        /* ================================================================
           1. NÃO ALTERAR MANUALMENTE pontuacao.json

           O histórico é a fonte de verdade. Depois de marcar a partida como
           anulada, sincronizarArquivo() reconstrói a pontuação somente com
           partidas válidas e preserva apenas os deltas de ajustes manuais.
           ================================================================ */

        /* ================================================================
           2. ESTORNO DE WARCOINS / PROGRESSÃO OPERACIONAL
           ================================================================ */
        for (const uid of jogadores) {
            const pts = numero(pontos[uid]);
            const wc = obterWarCoins(partida, uid, pts);

            if (wc !== 0) {
                antes.economy[uid] = numero(antes.economy[uid]) - wc;
            }

            if (antes.progressao[uid]) {
                const dadosPontos = partida?.pontos?.[uid];
                const vitoriaRegistrada = dadosPontos && typeof dadosPontos === 'object'
                    ? numero(dadosPontos.vitoria) === 1
                    : uid === vencedor;

                if (vitoriaRegistrada) {
                    diminuir(antes.progressao[uid], 'totalWins');
                    diminuir(antes.progressao[uid], 'vitoriasSemanais');
                    diminuir(antes.progressao[uid], 'vitoriasMensais');
                }

                diminuir(antes.progressao[uid], 'partidasSemanais');
                diminuir(antes.progressao[uid], 'partidasLigaTotal');

                if (dadosPontos?.entraNaLiga === true) {
                    diminuir(antes.progressao[uid], 'partidasConsideradasLiga');
                }
            }
        }

        /* ================================================================
           3. ESTORNO DE KILLS / MORTES DA PROGRESSÃO
           ================================================================ */
        for (const abate of Array.isArray(respostas.abates) ? respostas.abates : []) {
            const matador = idDe(abate?.matador || abate?.killer || abate?.atacante || abate?.quemMatou);
            const vitima = idDe(abate?.vitima || abate?.victim || abate?.morto || abate?.quemMorreu);

            if (matador && antes.progressao[matador]) diminuir(antes.progressao[matador], 'killsSemanais');
            if (vitima && antes.progressao[vitima]) diminuir(antes.progressao[vitima], 'mortesSemanais');
        }

        /* ================================================================
           4. ESTORNO DE CONTINENTES DA PROGRESSÃO
           ================================================================ */
        for (const continente of Array.isArray(respostas.continentes) ? respostas.continentes : []) {
            const dono = idDe(
                continente?.dono || continente?.jogador || continente?.jogadorId ||
                continente?.userId || continente?.conquistador
            );
            const codigo = String(
                continente?.cont || continente?.continente || continente?.territorio || ''
            ).trim();

            if (!dono || !codigo || !antes.progressao[dono]) continue;

            const normalizado = codigo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const chaves = new Set([
                `${codigo}Semanal`,
                `${codigo.toLowerCase()}Semanal`,
                `${normalizado}Semanal`
            ]);

            for (const chave of chaves) diminuir(antes.progressao[dono], chave);
        }

        /* ================================================================
           5. MARCAR PARTIDA COMO ANULADA
           ================================================================ */
        partidas[matchId] = marcarAnulada(partida, interaction);

        if (!safeWriteJson(partidasPath, partidas)) {
            throw new Error('Falha ao salvar a anulação da partida.');
        }

        if (!safeWriteJson(ECONOMY, antes.economy)) {
            throw new Error('Falha ao salvar os WarCoins.');
        }

        if (!safeWriteJson(PROGRESSAO, antes.progressao)) {
            throw new Error('Falha ao salvar a progressão.');
        }

        /* ================================================================
           6. RECONSTRUIR PONTUAÇÃO / RANKING
           ================================================================ */
        pontuacaoLiga.sincronizarArquivo(
            pontuacaoPath,
            partidasPath,
            TEMPORADA
        );

        await interaction.editReply({
            content:
                '✅ **Partida anulada com sucesso.**\n' +
                '📊 A pontuação foi reconstruída pelo histórico válido.\n' +
                '📈 O ranking/estatísticas foram atualizados sem essa partida.\n' +
                '🗃️ O registro foi preservado para auditoria.'
        });

        await painelLiga(interaction.guild, '1543636868682354748').catch(erro => {
            console.error('[LIGA] Painel pós-anulação:', erro);
        });
    } catch (erro) {
        console.error('[LIGA] Erro ao anular:', erro);

        safeWriteJson(partidasPath, antes.partidas);
        safeWriteJson(pontuacaoPath, antes.pontuacao);
        safeWriteJson(ECONOMY, antes.economy);
        safeWriteJson(PROGRESSAO, antes.progressao);

        await interaction.editReply({
            content: `❌ **Anulação não concluída.**\n${erro.message}`
        }).catch(() => {});
    }
};
