/* ========================================================================
   ARQUIVO: commands/promocao/syncEngine.js
   DESCRIÇÃO: Motor automático de prints + ficha militar unificada.
   ======================================================================== */

const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
const { criarResumoPrint } = require('./printSummaryBuilder.js');

const carreirasPath = path.join(__dirname, 'carreiras.json');
const progressaoPath = path.join(__dirname, 'progressao.json');
const economyPath = path.join(__dirname, '../economy/economy.json');

function calcularRank(faccao, totalWins) {
    let rank = faccao?.caminho?.[0] || null;
    if (!rank) return null;
    for (const r of faccao.caminho) {
        if (totalWins >= Number(r.custo || 0)) rank = r;
    }
    return rank;
}

async function sincronizarCargo(member, faccao, rank) {
    if (!member || !faccao || !rank?.id) return false;
    const cargo = member.guild.roles.cache.get(rank.id);
    if (!cargo) {
        console.error(`[PROMOÇÃO] Cargo ${rank.id} (${rank.nome || 'sem nome'}) não existe no servidor.`);
        return false;
    }

    const botMember = member.guild.members.me || await member.guild.members.fetch(member.client.user.id).catch(() => null);
    if (!botMember || cargo.position >= botMember.roles.highest.position) {
        console.error(`[PROMOÇÃO] Bot não pode gerenciar o cargo ${cargo.name} (${cargo.id}). Verifique a hierarquia.`);
        return false;
    }

    try {
        const idsPatentes = new Set(faccao.caminho.map(r => r.id).filter(Boolean));
        const antigos = member.roles.cache.filter(r => idsPatentes.has(r.id) && r.id !== cargo.id);
        if (antigos.size) await member.roles.remove(antigos);
        if (!member.roles.cache.has(cargo.id)) await member.roles.add(cargo);
        return true;
    } catch (error) {
        console.error(`[PROMOÇÃO] Falha ao sincronizar cargo de ${member.user.tag}:`, error);
        return false;
    }
}

async function executarVarreduraCanal(client) {
    const carreirasConfig = safeReadJson(carreirasPath);
    if (!carreirasConfig?.canalDePrints) return { processados: 0 };

    const channel = await client.channels.fetch(carreirasConfig.canalDePrints).catch(() => null);
    if (!channel?.messages?.fetch) return { processados: 0 };

    const progressao = safeReadJson(progressaoPath);
    const economy = safeReadJson(economyPath);
    const messages = await channel.messages.fetch({ limit: 30 }).catch(() => null);
    if (!messages) return { processados: 0 };

    let totalProcessados = 0;
    for (const message of Array.from(messages.values()).reverse()) {
        if (message.author.bot || message.attachments.size === 0) continue;

        const userId = message.author.id;
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (!member) continue;

        const nomeUsuario = member.user.username;
        let faccaoId = progressao[userId]?.factionId || null;
        if (!faccaoId) {
            faccaoId = Object.keys(carreirasConfig.faccoes || {}).find(id => member.roles.cache.has(id)) || null;
        }

        const faccao = faccaoId ? carreirasConfig.faccoes?.[faccaoId] : null;
        if (!faccao?.caminho?.length) {
            console.warn(`[PROMOÇÃO] Print ${message.id} ignorado: facção não identificada para ${member.user.tag}.`);
            continue;
        }

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
            progressao[userId].factionId = faccaoId;
        }
        if (!Array.isArray(progressao[userId].printsProcessados)) progressao[userId].printsProcessados = [];

        const reactionInvalid = message.reactions.cache.get('❌');
        let estaInvalidado = false;
        if (reactionInvalid) {
            const usersInvalid = await reactionInvalid.users.fetch().catch(() => null);
            if (usersInvalid) estaInvalidado = usersInvalid.some(u => !u.bot);
        }

        const foiProcessado = progressao[userId].printsProcessados.includes(message.id);
        const rankAntigoId = progressao[userId].currentRankId;

        if (!estaInvalidado && !foiProcessado) {
            progressao[userId].totalWins = (Number(progressao[userId].totalWins) || 0) + 1;
            progressao[userId].vitoriasSemanais = (Number(progressao[userId].vitoriasSemanais) || 0) + 1;
            progressao[userId].vitoriasMensais = (Number(progressao[userId].vitoriasMensais) || 0) + 1;
            progressao[userId].printsProcessados.push(message.id);
            economy[userId] = (Number(economy[userId]) || 0) + 50;
            totalProcessados++;
            await message.react('✅').catch(() => {});

            const novoRankObj = calcularRank(faccao, progressao[userId].totalWins);
            if (!novoRankObj) continue;
            const subiuDePatente = novoRankObj.id !== rankAntigoId;
            progressao[userId].currentRankId = novoRankObj.id;

            if (subiuDePatente) {
                economy[userId] += 500;
                const cargoSincronizado = await sincronizarCargo(member, faccao, novoRankObj);
                if (!cargoSincronizado) console.warn(`[PROMOÇÃO] Cargo não sincronizado para ${member.user.tag}.`);

                const resumo = criarResumoPrint({
                    progressao,
                    carreiras: carreirasConfig,
                    economy,
                    userId,
                    member,
                    promocao: { anterior: faccao.caminho.find(r => r.id === rankAntigoId)?.nome || 'Patente anterior', nova: novoRankObj.nome }
                });

                let canalDestino = message.channel;
                if (faccao.canalDeAnuncio) {
                    const canalFaccao = await message.guild.channels.fetch(faccao.canalDeAnuncio).catch(() => null);
                    if (canalFaccao) canalDestino = canalFaccao;
                }

                if (resumo) {
                    await canalDestino.send({ content: `${member}`, embeds: [resumo.embed], components: resumo.components })
                        .catch(error => console.error('[PROMOÇÃO] Falha ao anunciar:', error));
                }
            } else {
                const resumo = criarResumoPrint({ progressao, carreiras: carreirasConfig, economy, userId, member });
                if (resumo) {
                    await message.channel.send({ content: `${member}`, embeds: [resumo.embed], components: resumo.components })
                        .catch(error => console.error('[PROMOÇÃO] Falha ao enviar resumo:', error));
                }
            }
        } else if (estaInvalidado && foiProcessado) {
            progressao[userId].totalWins = Math.max(0, (Number(progressao[userId].totalWins) || 0) - 1);
            progressao[userId].vitoriasSemanais = Math.max(0, (Number(progressao[userId].vitoriasSemanais) || 0) - 1);
            progressao[userId].vitoriasMensais = Math.max(0, (Number(progressao[userId].vitoriasMensais) || 0) - 1);
            progressao[userId].printsProcessados = progressao[userId].printsProcessados.filter(id => id !== message.id);
            economy[userId] = Math.max(0, (Number(economy[userId]) || 0) - 50);

            const novoRankObj = calcularRank(faccao, progressao[userId].totalWins);
            if (!novoRankObj) continue;
            const perdeuPromocao = novoRankObj.id !== rankAntigoId;
            if (perdeuPromocao) economy[userId] = Math.max(0, economy[userId] - 500);
            progressao[userId].currentRankId = novoRankObj.id;
            if (perdeuPromocao) await sincronizarCargo(member, faccao, novoRankObj);

            const reactionBot = message.reactions.cache.get('✅');
            if (reactionBot) await reactionBot.remove().catch(() => {});

            const embedEstorno = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('❌ PRINT INVALIDADO')
                .setDescription(`O registro de ${member} foi anulado pela Staff.\n\n📉 **-1 Vitória**\n💰 **-50 WarCoins**${perdeuPromocao ? '\n🏅 **Bônus de promoção revertido: -500 WarCoins**' : ''}`)
                .setTimestamp();
            await message.channel.send({ embeds: [embedEstorno] })
                .catch(error => console.error('[PROMOÇÃO] Falha ao enviar estorno:', error));
        }
    }

    safeWriteJson(progressaoPath, progressao);
    safeWriteJson(economyPath, economy);
    return { processados: totalProcessados };
}

module.exports = { executarVarreduraCanal };
