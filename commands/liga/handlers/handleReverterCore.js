/* ========================================================================
   ARQUIVO: commands/liga/handlers/handleReverter.js

   ANULAÇÃO / ESTORNO DE PARTIDA DA LIGA

   CORREÇÕES:
   - Usa o ID da mensagem da interação como chave principal.
   - Aceita registros novos e registros antigos da Caixa Preta.
   - Aceita Staff/Suporte/Mod/Adm pelos IDs oficiais ou Administrador.
   - Evita defer/reply duplicado.
   - Estorna pontos positivos e negativos corretamente.
   - Estorna WarCoins, vitória, partidas, kills, mortes e continentes
     quando esses dados existem no registro.
   - Recalcula patente após o estorno.
   ======================================================================== */

const path = require('path');

const {
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');

const {
    safeReadJson,
    safeWriteJson,
    isStaff
} = require('../utils/helpers.js');


// ========================================================================
// LIMITE DA LIGA
// ========================================================================

const MAX_PARTIDAS_LIGA = 80;


// ========================================================================
// CAMINHOS
// ========================================================================

const economyPath = path.join(
    __dirname,
    '..',
    '..',
    'economy',
    'economy.json'
);

const progressaoPath = path.join(
    __dirname,
    '..',
    '..',
    'promocao',
    'progressao.json'
);

const carreirasPath = path.join(
    __dirname,
    '..',
    '..',
    'promocao',
    'carreiras.json'
);


// ========================================================================
// AUXILIARES
// ========================================================================

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function diminuir(objeto, chave, quantidade) {
    if (!objeto || objeto[chave] === undefined) return;

    objeto[chave] = Math.max(
        0,
        numero(objeto[chave]) - numero(quantidade)
    );
}

function estornarNumero(objeto, chave, valor) {
    if (!objeto || objeto[chave] === undefined) return;

    // Ex.: saldo atual 100 e partida deu -15.
    // Ao anular, devolvemos os 15 pontos: 100 - (-15) = 115.
    objeto[chave] = numero(objeto[chave]) - numero(valor);
}

function possuiNovoFormato(dados) {
    return Boolean(
        dados &&
        typeof dados === 'object' &&
        dados.pontos &&
        typeof dados.pontos === 'object'
    );
}

async function garantirResposta(interaction) {
    if (interaction.replied || interaction.deferred) return true;

    try {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });
        return true;
    } catch (erro) {
        if (erro?.code === 40060 || erro?.code === 10062) {
            return false;
        }

        console.error(
            '[LIGA] Falha ao confirmar interação do reverter:',
            erro
        );

        return false;
    }
}

async function editarResposta(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(payload);
        }

        return await interaction.reply({
            ...payload,
            flags: payload.flags ?? MessageFlags.Ephemeral
        });
    } catch (erro) {
        if (erro?.code !== 40060 && erro?.code !== 10062) {
            console.error(
                '[LIGA] Falha ao responder o reverter:',
                erro
            );
        }

        return null;
    }
}

function obterIdDaPartida(interaction) {
    const customId = String(interaction.customId || '');

    if (customId.startsWith('edit_match_')) {
        return customId.slice('edit_match_'.length);
    }

    return interaction.message?.id || null;
}

function encontrarPartida(partidas, matchId) {
    if (!partidas || !matchId) return null;

    // Formato atual: a própria mensagem é a chave.
    if (partidas[matchId]) {
        return {
            key: matchId,
            data: partidas[matchId]
        };
    }

    // Compatibilidade com registros que possam ter guardado o ID dentro do objeto.
    for (const [key, partida] of Object.entries(partidas)) {
        if (!partida || typeof partida !== 'object') continue;

        const ids = [
            partida.messageId,
            partida.mensagemId,
            partida.id,
            partida.meta?.messageId,
            partida.meta?.mensagemId,
            partida.meta?.id
        ].filter(Boolean).map(String);

        if (ids.includes(String(matchId))) {
            return {
                key,
                data: partida
            };
        }
    }

    return null;
}

function obterPontosPartida(dadosPartida) {
    if (!dadosPartida || typeof dadosPartida !== 'object') return {};

    if (dadosPartida.pontos && typeof dadosPartida.pontos === 'object') {
        return dadosPartida.pontos;
    }

    // Compatibilidade com alguns registros antigos:
    // objeto inteiro de pontos sem jogadoresBrutos/respostas.
    const resultado = {};

    for (const [uid, valor] of Object.entries(dadosPartida)) {
        if (uid === 'adminId' || uid === 'respostas' || uid === 'jogadoresBrutos' || uid === 'meta') {
            continue;
        }

        if (typeof valor === 'number') {
            resultado[uid] = {
                ptsLiga: valor,
                wcRecebido: valor > 0 ? valor * 100 : 0,
                vitoria: 0
            };
        }
    }

    return resultado;
}

function obterJogadores(dadosPartida) {
    return Array.isArray(dadosPartida?.jogadoresBrutos)
        ? dadosPartida.jogadoresBrutos
        : [];
}

function obterAbates(dadosPartida) {
    return Array.isArray(dadosPartida?.respostas?.abates)
        ? dadosPartida.respostas.abates
        : [];
}

function obterContinentes(dadosPartida) {
    return Array.isArray(dadosPartida?.respostas?.continentes)
        ? dadosPartida.respostas.continentes
        : [];
}

async function recalcularPatente(
    interaction,
    uid,
    progressaoData,
    carreirasConfig
) {
    const jogador = progressaoData[uid];
    if (!jogador) return;

    const factionId = jogador.factionId;
    const faccao = carreirasConfig?.faccoes?.[factionId];

    if (!faccao) return;

    const caminho = Array.isArray(faccao.caminho)
        ? faccao.caminho
        : [];

    let rankCorreto = null;

    for (const rank of caminho) {
        if (numero(jogador.totalWins) >= numero(rank.custo)) {
            rankCorreto = rank;
        }
    }

    const targetRankId = rankCorreto?.id || null;
    jogador.currentRankId = targetRankId;

    try {
        const membro = await interaction.guild.members
            .fetch(uid)
            .catch(() => null);

        if (!membro) return;

        if (targetRankId && !membro.roles.cache.has(targetRankId)) {
            await membro.roles.add(targetRankId).catch(() => {});
        }

        for (const rank of caminho) {
            if (
                rank.id !== targetRankId &&
                membro.roles.cache.has(rank.id)
            ) {
                await membro.roles.remove(rank.id).catch(() => {});
            }
        }
    } catch (erro) {
        console.error(
            `[LIGA] Erro ao recalcular patente de ${uid}:`,
            erro
        );
    }
}


// ========================================================================
// PRINCIPAL
// ========================================================================

module.exports = async (
    client,
    interaction,
    pontuacaoPath,
    partidasPath
) => {
    if (!interaction?.customId?.startsWith('edit_match_')) {
        return;
    }

    const respondeu = await garantirResposta(interaction);
    if (!respondeu) return;

    const matchId = obterIdDaPartida(interaction);

    if (!matchId) {
        return editarResposta(interaction, {
            content: '❌ Não foi possível identificar a partida.'
        });
    }

    const partidas = safeReadJson(partidasPath) || {};
    const encontrada = encontrarPartida(partidas, matchId);

    if (!encontrada) {
        return editarResposta(interaction, {
            content:
                '❌ Os dados desta partida não foram encontrados na Caixa Preta.\n\n' +
                `🆔 ID procurado: \`${matchId}\``
        });
    }

    const dadosPartida = encontrada.data;

    // ====================================================================
    // SEGURANÇA — ADM ou STAFF OFICIAL ou AUTOR DO REGISTRO
    // ====================================================================

    const membro = interaction.member;

    const isAdministrador = Boolean(
        membro?.permissions?.has?.(PermissionFlagsBits.Administrator)
    );

    const isStaffOficial = Boolean(
        isStaff(membro)
    );

    const isDonoDoRegistro = Boolean(
        interaction.user?.id &&
        dadosPartida?.adminId &&
        String(interaction.user.id) === String(dadosPartida.adminId)
    );

    if (!isAdministrador && !isStaffOficial && !isDonoDoRegistro) {
        return editarResposta(interaction, {
            content:
                '❌ **ACESSO NEGADO!** Você não possui autorização para anular esta partida.'
        });
    }

    // ====================================================================
    // CARREGAR BANCOS
    // ====================================================================

    const pontuacao = safeReadJson(pontuacaoPath) || {};
    const economy = safeReadJson(economyPath) || {};
    const progressaoData = safeReadJson(progressaoPath) || {};
    const carreirasConfig = safeReadJson(carreirasPath) || {};

    const jogadores = obterJogadores(dadosPartida);
    const abates = obterAbates(dadosPartida);
    const continentes = obterContinentes(dadosPartida);
    const pontosPartida = obterPontosPartida(dadosPartida);

    // ====================================================================
    // ESTORNO DOS PONTOS / WARCOINS / VITÓRIAS / PARTIDAS
    // ====================================================================

    for (const [uid, bruto] of Object.entries(pontosPartida)) {
        const pData = bruto && typeof bruto === 'object'
            ? bruto
            : {
                ptsLiga: numero(bruto),
                wcRecebido: numero(bruto) > 0 ? numero(bruto) * 100 : 0,
                vitoria: 0
            };

        const ptsLiga = numero(pData.ptsLiga);
        const wcRecebido = numero(pData.wcRecebido);
        const vitoria = numero(pData.vitoria) === 1;

        // Subtrai tanto positivos como negativos.
        if (pontuacao[uid] !== undefined) {
            estornarNumero(
                pontuacao,
                uid,
                ptsLiga
            );

            if (numero(pontuacao[uid]) === 0) {
                pontuacao[uid] = 0;
            }
        }

        if (economy[uid] !== undefined && wcRecebido !== 0) {
            estornarNumero(
                economy,
                uid,
                wcRecebido
            );

            if (numero(economy[uid]) === 0) {
                economy[uid] = 0;
            }
        }

        if (progressaoData[uid]) {
            if (vitoria) {
                diminuir(
                    progressaoData[uid],
                    'totalWins',
                    1
                );

                diminuir(
                    progressaoData[uid],
                    'vitoriasSemanais',
                    1
                );

                diminuir(
                    progressaoData[uid],
                    'vitoriasMensais',
                    1
                );
            }

            diminuir(
                progressaoData[uid],
                'partidasSemanais',
                1
            );

            diminuir(
                progressaoData[uid],
                'partidasLigaTotal',
                1
            );

            const entraNaLiga =
                pData.entraNaLiga === true ||
                numero(pData.numeroPartida) > 0 &&
                    numero(pData.numeroPartida) <= MAX_PARTIDAS_LIGA;

            if (entraNaLiga) {
                diminuir(
                    progressaoData[uid],
                    'partidasConsideradasLiga',
                    1
                );
            }
        }
    }

    // ====================================================================
    // ESTORNO DE KILLS / MORTES
    // ====================================================================

    for (const abate of abates) {
        const matador = String(abate?.matador || '');
        const vitima = String(abate?.vitima || '');

        if (matador && progressaoData[matador]) {
            diminuir(
                progressaoData[matador],
                'killsSemanais',
                1
            );
        }

        if (vitima && progressaoData[vitima]) {
            diminuir(
                progressaoData[vitima],
                'mortesSemanais',
                1
            );
        }
    }

    // ====================================================================
    // ESTORNO DE CONTINENTES
    // ====================================================================

    for (const continente of continentes) {
        const dono = String(continente?.dono || '');
        const nome = String(continente?.cont || '');

        if (!dono || !nome || !progressaoData[dono]) continue;

        diminuir(
            progressaoData[dono],
            `${nome}Semanal`,
            1
        );
    }

    // ====================================================================
    // RECALCULAR PATENTES
    // ====================================================================

    const jogadoresParaRecalculo = new Set(
        Object.keys(pontosPartida)
    );

    for (const jogador of jogadores) {
        if (jogador?.id) {
            jogadoresParaRecalculo.add(String(jogador.id));
        }
    }

    for (const uid of jogadoresParaRecalculo) {
        await recalcularPatente(
            interaction,
            uid,
            progressaoData,
            carreirasConfig
        );
    }

    // ====================================================================
    // REMOVER APENAS A PARTIDA ANULADA
    // ====================================================================

    delete partidas[encontrada.key];

    safeWriteJson(
        partidasPath,
        partidas
    );

    safeWriteJson(
        pontuacaoPath,
        pontuacao
    );

    safeWriteJson(
        economyPath,
        economy
    );

    safeWriteJson(
        progressaoPath,
        progressaoData
    );

    // ====================================================================
    // TENTAR APAGAR A MENSAGEM DO RESULTADO
    // ====================================================================

    try {
        const canal = interaction.channel;
        const mensagem =
            await canal?.messages?.fetch(matchId).catch(() => null);

        if (mensagem) {
            await mensagem.delete().catch(() => {});
        }
    } catch (erro) {
        console.error(
            '[LIGA] Erro ao apagar mensagem original:',
            erro
        );
    }

    // ====================================================================
    // CONFIRMAÇÃO
    // ====================================================================

    return editarResposta(interaction, {
        content:
            '✅ **Partida anulada com sucesso!**\n\n' +
            '↩️ Pontos da Liga foram estornados.\n' +
            '💰 WarCoins foram estornados quando registrados.\n' +
            '🏆 Vitórias foram estornadas.\n' +
            '💀 Kills e ☠️ mortes foram estornados quando registrados.\n' +
            '🌍 Continentes foram estornados quando registrados.\n' +
            '📊 Contadores de partidas foram corrigidos.\n' +
            '🎖️ Patentes foram readequadas.'
    });
};
