/* ========================================================================
   ARQUIVO: commands/promocao/syncEngine.js
   DESCRIÇÃO: Motor automático de prints + ficha militar unificada.
   ======================================================================== */

const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
const { criarFicha } = require('./fichaBuilder.js');

const carreirasPath = path.join(__dirname, 'carreiras.json');
const progressaoPath = path.join(__dirname, 'progressao.json');
const economyPath = path.join(__dirname, '../economy/economy.json');

async function executarVarreduraCanal(client) {
    const carreirasConfig = safeReadJson(carreirasPath);
    if (!carreirasConfig || !carreirasConfig.canalDePrints) return { processados: 0 };

    const channel = await client.channels.fetch(carreirasConfig.canalDePrints).catch(() => null);
    if (!channel) return { processados: 0 };

    const progressao = safeReadJson(progressaoPath);
    const economy = safeReadJson(economyPath);

    const messages = await channel.messages.fetch({ limit: 30 }).catch(() => null);
    if (!messages) return { processados: 0 };

    let totalProcessados = 0;
    const messagesArray = Array.from(messages.values()).reverse();

    for (const message of messagesArray) {
        if (message.author.bot) continue;
        if (message.attachments.size === 0) continue;

        const userId = message.author.id;
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (!member) continue;

        const nomeUsuario = member.user.username;

        let faccaoId = null;
        for (const id of Object.keys(carreirasConfig.faccoes || {})) {
            if (member.roles.cache.has(id)) {
                faccaoId = id;
                break;
            }
        }

        if (!faccaoId) faccaoId = Object.keys(carreirasConfig.faccoes || {})[0];
        const faccao = carreirasConfig.faccoes?.[faccaoId];
        if (!faccao?.caminho?.length) continue;

        if (!progressao[userId]) {
            progressao[userId] = {
                nome: nomeUsuario,
                factionId: faccaoId,
                currentRankId: faccao.caminho[0].id,
                totalWins: 0,
                vitoriasSemanais: 0,
                vitoriasMensais: 0,
                printsProcessados: []
            };
        } else {
            progressao[userId].nome = nomeUsuario;
            // Se o usuário não tinha facção registrada, aproveita a atual.
            if (!progressao[userId].factionId) progressao[userId].factionId = faccaoId;
        }

        if (!progressao[userId].printsProcessados) progressao[userId].printsProcessados = [];

        const reactionInvalid = message.reactions.cache.get('❌');
        let estaInvalidado = false;

        if (reactionInvalid) {
            const usersInvalid = await reactionInvalid.users.fetch().catch(() => null);
            if (usersInvalid) estaInvalidado = usersInvalid.some(u => !u.bot);
        }

        const foiProcessado = progressao[userId].printsProcessados.includes(message.id);
        const rankAntigoId = progressao[userId].currentRankId;

        // ================================================================
        // APROVAÇÃO AUTOMÁTICA
        // ================================================================
        if (!estaInvalidado && !foiProcessado) {
            progressao[userId].totalWins = (Number(progressao[userId].totalWins) || 0) + 1;
            progressao[userId].vitoriasSemanais = (Number(progressao[userId].vitoriasSemanais) || 0) + 1;
            progressao[userId].vitoriasMensais = (Number(progressao[userId].vitoriasMensais) || 0) + 1;
            progressao[userId].printsProcessados.push(message.id);

            economy[userId] = (Number(economy[userId]) || 0) + 50;
            totalProcessados++;

            await message.react('✅').catch(() => {});

            let novoRankObj = faccao.caminho[0];
            let proximoRankObj = null;

            for (let i = 0; i < faccao.caminho.length; i++) {
                const r = faccao.caminho[i];
                if (progressao[userId].totalWins >= Number(r.custo || 0)) {
                    novoRankObj = r;
                    proximoRankObj = faccao.caminho[i + 1] || null;
                }
            }

            const subiuDePatente = novoRankObj.id !== rankAntigoId;
            progressao[userId].currentRankId = novoRankObj.id;

            try {
                if (subiuDePatente) {
                    await member.roles.add(novoRankObj.id).catch(() => {});

                    for (const r of faccao.caminho) {
                        if (r.id !== novoRankObj.id && member.roles.cache.has(r.id)) {
                            await member.roles.remove(r.id).catch(() => {});
                        }
                    }
                }

                if (carreirasConfig.cargoRecrutaId && member.roles.cache.has(carreirasConfig.cargoRecrutaId)) {
                    await member.roles.remove(carreirasConfig.cargoRecrutaId).catch(() => {});
                }
            } catch (e) {
                console.error('[PROMOÇÃO] Erro ao ajustar cargos:', e);
            }

            const rowBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ver_ficha_${userId}`)
                    .setLabel('Ver Ficha')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋')
            );

            // Bônus de promoção continua separado da ficha.
            if (subiuDePatente) {
                economy[userId] = (Number(economy[userId]) || 0) + 500;

                const embedPromo = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🏆 PROMOÇÃO AUTOMÁTICA 🏆')
                    .setDescription(
                        `Parabéns, ${member}! Você subiu para **${novoRankObj.nome}**!\n` +
                        `💰 **Bônus de promoção:** +500 WarCoins`
                    )
                    .setTimestamp();

                let canalDestino = message.channel;
                if (faccao.canalDeAnuncio) {
                    const canalFaccao = await message.guild.channels.fetch(faccao.canalDeAnuncio).catch(() => null);
                    if (canalFaccao) canalDestino = canalFaccao;
                }

                await canalDestino.send({
                    content: `${member}`,
                    embeds: [embedPromo],
                    components: [rowBtn]
                }).catch(() => {});
            } else {
                // A mesma ficha usada pelo /carreira e pelo botão Ver Ficha.
                const ficha = criarFicha({
                    progressao,
                    carreiras: carreirasConfig,
                    economy,
                    userId,
                    member,
                    modo: 'print'
                });

                await message.channel.send({
                    content: `📋 ${member}`,
                    embeds: ficha ? [ficha] : [],
                    components: [rowBtn]
                }).catch(() => {});
            }
        }

        // ================================================================
        // ESTORNO POR ❌
        // ================================================================
        else if (estaInvalidado && foiProcessado) {
            progressao[userId].totalWins = Math.max(0, (Number(progressao[userId].totalWins) || 0) - 1);
            progressao[userId].vitoriasSemanais = Math.max(0, (Number(progressao[userId].vitoriasSemanais) || 0) - 1);
            progressao[userId].vitoriasMensais = Math.max(0, (Number(progressao[userId].vitoriasMensais) || 0) - 1);
            progressao[userId].printsProcessados = progressao[userId].printsProcessados.filter(id => id !== message.id);
            economy[userId] = Math.max(0, (Number(economy[userId]) || 0) - 50);

            const reactionBot = message.reactions.cache.get('✅');
            if (reactionBot) await reactionBot.remove().catch(() => {});

            let novoRankObj = faccao.caminho[0];
            for (let i = 0; i < faccao.caminho.length; i++) {
                if (progressao[userId].totalWins >= Number(faccao.caminho[i].custo || 0)) {
                    novoRankObj = faccao.caminho[i];
                }
            }

            const mudouDePatente = novoRankObj.id !== rankAntigoId;
            progressao[userId].currentRankId = novoRankObj.id;

            if (mudouDePatente) {
                try {
                    await member.roles.add(novoRankObj.id).catch(() => {});
                    for (const r of faccao.caminho) {
                        if (r.id !== novoRankObj.id && member.roles.cache.has(r.id)) {
                            await member.roles.remove(r.id).catch(() => {});
                        }
                    }
                } catch (e) {
                    console.error('[PROMOÇÃO] Erro ao reajustar patente:', e);
                }
            }

            const embedEstorno = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ PRINT INVALIDADO')
                .setDescription(
                    `O registro de ${member} foi anulado pela Staff.\n\n` +
                    `📉 **-1 Vitória**\n` +
                    `💰 **-50 WarCoins**`
                )
                .setTimestamp();

            await message.channel.send({ embeds: [embedEstorno] }).catch(() => {});
        }
    }

    safeWriteJson(progressaoPath, progressao);
    safeWriteJson(economyPath, economy);

    return { processados: totalProcessados };
}

module.exports = { executarVarreduraCanal };
