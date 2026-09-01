/* ========================================================================
   LIGA — HANDLER DE ANULAÇÃO
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

const numero = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const clone = v => JSON.parse(JSON.stringify(v ?? {}));

function idDe(v) {
    if (!v) return null;
    if (typeof v === 'object') return idDe(v.id || v.userId || v.jogadorId || v.discordId);
    const id = String(v).replace(/^<@!?(\d+)>$/, '$1');
    return /^\d{17,20}$/.test(id) ? id : null;
}

function estornarSaldo(obj, id, valor) {
    if (!obj || obj[id] === undefined) return;
    obj[id] = numero(obj[id]) - numero(valor);
}

function diminuir(obj, chave, valor = 1) {
    if (!obj) return;
    obj[chave] = Math.max(0, numero(obj[chave]) - numero(valor));
}

function obterPontos(partida) {
    const saida = {};
    const jogadores = Array.isArray(partida?.jogadoresBrutos) ? partida.jogadoresBrutos : [];
    for (const jogador of jogadores) {
        const id = idDe(jogador);
        if (!id) continue;
        const salvo = partida?.pontos?.[id];
        if (salvo && typeof salvo === 'object') {
            saida[id] = numero(salvo.ptsLiga ?? salvo.pontos ?? salvo.pontuacao);
        } else if (salvo !== undefined) {
            saida[id] = numero(salvo);
        } else {
            saida[id] = pontuacaoLiga.pontosDaPartida(partida, id);
        }
    }
    return saida;
}

function obterJogadores(partida, pontos) {
    const ids = new Set(Object.keys(pontos || {}));
    for (const jogador of Array.isArray(partida?.jogadoresBrutos) ? partida.jogadoresBrutos : []) {
        const id = idDe(jogador);
        if (id) ids.add(id);
    }
    const respostas = partida?.respostas || partida?.resultado || {};
    for (const chave of ['vencedor', 'segundo', 'segundoLugar', 'runnerUp', 'terceiro', 'terceiroLugar', 'maisTropas', 'maiorTropas']) {
        const id = idDe(respostas?.[chave]);
        if (id) ids.add(id);
    }
    return ids;
}

module.exports = async function handleReverter(client, interaction, pontuacaoPath = PONTOS, partidasPath = PARTIDAS) {
    if (!interaction?.customId?.startsWith('edit_match_')) return;

    if (!interaction.replied && !interaction.deferred) {
        try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch { return; }
    }

    const matchId = String(interaction.customId).slice('edit_match_'.length);
    const partidas = safeReadJson(partidasPath) || {};
    const partida = partidas[matchId];

    if (!partida) return interaction.editReply({ content: `❌ Partida não encontrada: \`${matchId}\`` });
    if (partida.anulada === true || partida.anulado === true || partida.cancelada === true || partida.cancelado === true) {
        return interaction.editReply({ content: '⚠️ Esta partida já está anulada.' });
    }

    const autorizado = Boolean(
        interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator) ||
        isStaff(interaction.member) ||
        String(partida.adminId || '') === String(interaction.user.id)
    );
    if (!autorizado) return interaction.editReply({ content: '❌ **ACESSO NEGADO!** Você não pode anular esta partida.' });

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

        // Reverte o saldo atual exatamente pelo delta registrado na partida.
        // Pontuação negativa é válida: nunca usamos Math.max() aqui.
        for (const uid of jogadores) {
            const pts = numero(pontos[uid]);
            if (pontos[uid] !== undefined) estornarSaldo(antes.pontuacao, uid, pts);

            const salvo = partida.pontos?.[uid];
            const wc = salvo && typeof salvo === 'object' && salvo.wcRecebido !== undefined
                ? numero(salvo.wcRecebido)
                : Math.max(0, pts) * 100;
            if (wc !== 0) estornarSaldo(antes.economy, uid, wc);

            if (antes.progressao[uid]) {
                if (uid === vencedor) {
                    diminuir(antes.progressao[uid], 'totalWins');
                    diminuir(antes.progressao[uid], 'vitoriasSemanais');
                    diminuir(antes.progressao[uid], 'vitoriasMensais');
                }
                diminuir(antes.progressao[uid], 'partidasSemanais');
                diminuir(antes.progressao[uid], 'partidasLigaTotal');
                diminuir(antes.progressao[uid], 'partidasConsideradasLiga');
            }
        }

        for (const abate of Array.isArray(respostas.abates) ? respostas.abates : []) {
            const matador = idDe(abate.matador || abate.killer || abate.atacante || abate.quemMatou);
            const vitima = idDe(abate.vitima || abate.victim || abate.morto || abate.quemMorreu);
            if (matador && antes.progressao[matador]) diminuir(antes.progressao[matador], 'killsSemanais');
            if (vitima && antes.progressao[vitima]) diminuir(antes.progressao[vitima], 'mortesSemanais');
        }

        for (const cont of Array.isArray(respostas.continentes) ? respostas.continentes : []) {
            const dono = idDe(cont.dono || cont.jogador || cont.jogadorId || cont.userId || cont.conquistador);
            const codigo = String(cont.cont || cont.continente || cont.territorio || '').trim();
            if (dono && codigo && antes.progressao[dono]) {
                const chaves = [
                    `${codigo}Semanal`,
                    `${codigo.toLowerCase()}Semanal`,
                    `${codigo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}Semanal`
                ];
                for (const chave of new Set(chaves)) diminuir(antes.progressao[dono], chave);
            }
        }

        // Preserva a partida para auditoria. Ela deixa de participar dos cálculos.
        partidas[matchId] = {
            ...partida,
            anulada: true,
            anuladaEm: new Date().toISOString(),
            anuladaPor: interaction.user.id,
            motivoAnulacao: 'Anulação manual pela Liga'
        };

        if (!safeWriteJson(partidasPath, partidas)) throw new Error('Falha ao salvar a anulação.');
        if (!safeWriteJson(pontuacaoPath, antes.pontuacao)) throw new Error('Falha ao salvar pontos.');
        if (!safeWriteJson(ECONOMY, antes.economy)) throw new Error('Falha ao salvar WarCoins.');
        if (!safeWriteJson(PROGRESSAO, antes.progressao)) throw new Error('Falha ao salvar progressão.');

        // Recalcula estatísticas sem incluir a partida anulada e preserva o saldo atual.
        pontuacaoLiga.sincronizarArquivo(pontuacaoPath, partidasPath, TEMPORADA);

        await interaction.editReply({ content: '✅ **Partida anulada.** O registro foi preservado para auditoria e deixou de contar nas estatísticas.' });
        await painelLiga(interaction.guild, '1543636868682354748').catch(erro => console.error('[LIGA] Painel pós-anulação:', erro));
    } catch (erro) {
        console.error('[LIGA] Erro ao anular:', erro);
        safeWriteJson(partidasPath, antes.partidas);
        safeWriteJson(pontuacaoPath, antes.pontuacao);
        safeWriteJson(ECONOMY, antes.economy);
        safeWriteJson(PROGRESSAO, antes.progressao);
        await interaction.editReply({ content: `❌ **Anulação não concluída.**\n${erro.message}` }).catch(() => {});
    }
};
