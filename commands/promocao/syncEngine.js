/* ========================================================================
   ARQUIVO: commands/promocao/syncEngine.js
   DESCRIÇÃO: Motor 100% Automático - O próprio bot aprova e reage com ✅
   ======================================================================== */

const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

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
    
    // Varre as últimas 30 mensagens por segurança, mas vai agir instantaneamente a cada nova mensagem
    const messages = await channel.messages.fetch({ limit: 30 }).catch(() => null);
    if (!messages) return { processados: 0 };

    let totalProcessados = 0;
    const messagesArray = Array.from(messages.values()).reverse();

    for (const message of messagesArray) {
        if (message.author.bot) continue;
        if (message.attachments.size === 0) continue; // Ignora texto sem imagem

        const userId = message.author.id;
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (!member) continue;

        const nomeUsuario = member.user.username;

        let faccaoId = null;
        for (const id of Object.keys(carreirasConfig.faccoes)) {
            if (member.roles.cache.has(id)) { faccaoId = id; break; }
        }
        if (!faccaoId) faccaoId = Object.keys(carreirasConfig.faccoes)[0];
        const faccao = carreirasConfig.faccoes[faccaoId];

        if (!progressao[userId]) {
            progressao[userId] = { nome: nomeUsuario, factionId: faccaoId, currentRankId: faccao.caminho[0].id, totalWins: 0, vitoriasSemanais: 0, vitoriasMensais: 0, printsProcessados: [] };
        } else {
            progressao[userId].nome = nomeUsuario; 
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

        // ==========================================
        // CENÁRIO 1: APROVAÇÃO 100% AUTOMÁTICA
        // ==========================================
        if (!estaInvalidado && !foiProcessado) {
            progressao[userId].totalWins = (progressao[userId].totalWins || 0) + 1;
            progressao[userId].vitoriasSemanais = (progressao[userId].vitoriasSemanais || 0) + 1;
            progressao[userId].vitoriasMensais = (progressao[userId].vitoriasMensais || 0) + 1;
            progressao[userId].printsProcessados.push(message.id);
            economy[userId] = (economy[userId] || 0) + 50; 
            
            totalProcessados++;

            // 🤖 O BOT CARIMBA O ✅ SOZINHO PARA AVISAR QUE CONTOU
            await message.react('✅').catch(() => {});

            let novoRankObj = faccao.caminho[0];
            let proximoRankObj = null;
            for (let i = 0; i < faccao.caminho.length; i++) {
                const r = faccao.caminho[i];
                if (progressao[userId].totalWins >= r.custo) {
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
            } catch (e) {}

            const rowBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ver_ficha_${userId}`).setLabel('Ver Ficha').setStyle(ButtonStyle.Secondary).setEmoji('📋')
            );

            if (subiuDePatente) {
                economy[userId] = (economy[userId] || 0) + 500; 
                const embedPromo = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🏆 PROMOÇÃO AUTOMÁTICA 🏆')
                    .setDescription(`Parabéns, ${member}! Você subiu para **${novoRankObj.nome}**!\n💰 **Bônus:** +500 WarCoins`)
                    .setTimestamp();
                
                let canalDestino = message.channel;
                if (faccao.canalDeAnuncio) {
                    const canalFaccao = await message.guild.channels.fetch(faccao.canalDeAnuncio).catch(() => null);
                    if (canalFaccao) canalDestino = canalFaccao;
                }
                await canalDestino.send({ content: `${member}`, embeds: [embedPromo], components: [rowBtn] }).catch(() => {});
            } else {
                let metaTexto = proximoRankObj ? `Faltam ${proximoRankObj.custo - progressao[userId].totalWins} para **${proximoRankObj.nome}**` : "Patente Máxima Atingida!";
                const embedConfirmacao = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setDescription(`✅ **Print processado!** (+50 💰)\n👤 **Membro:** ${member}\n🏆 **Vitórias:** ${progressao[userId].totalWins}\n🎖️ **Patente:** ${novoRankObj.nome}\n💳 **Saldo:** ${economy[userId]} WarCoins\n🎯 **Meta:** ${metaTexto}`)
                    .setTimestamp();
                await message.channel.send({ embeds: [embedConfirmacao], components: [rowBtn] }).catch(() => {});
            }
        }
        // ==========================================
        // CENÁRIO 2: ESTORNO (A Staff viu erro e deu ❌)
        // ==========================================
        else if (estaInvalidado && foiProcessado) {
            progressao[userId].totalWins = Math.max(0, (progressao[userId].totalWins || 0) - 1);
            progressao[userId].vitoriasSemanais = Math.max(0, (progressao[userId].vitoriasSemanais || 0) - 1);
            progressao[userId].vitoriasMensais = Math.max(0, (progressao[userId].vitoriasMensais || 0) - 1);
            progressao[userId].printsProcessados = progressao[userId].printsProcessados.filter(id => id !== message.id);
            economy[userId] = Math.max(0, (economy[userId] || 0) - 50);

            // Tira a reação de ✅ do bot, já que foi invalidado
            const reactionBot = message.reactions.cache.get('✅');
            if (reactionBot) await reactionBot.remove().catch(()=>{});

            let novoRankObj = faccao.caminho[0];
            for (let i = 0; i < faccao.caminho.length; i++) {
                if (progressao[userId].totalWins >= faccao.caminho[i].custo) novoRankObj = faccao.caminho[i];
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
                } catch (e) {}
            }

            const embedEstorno = new EmbedBuilder()
                .setColor('#E74C3C')
                .setDescription(`❌ **Print Invalidado!** O registro de ${member} foi anulado pela Staff.\n📉 **-1 Vitória** e **-50 WarCoins** removidos da conta.`)
                .setTimestamp();
            await message.channel.send({ embeds: [embedEstorno] }).catch(() => {});
        }
    }

    safeWriteJson(progressaoPath, progressao);
    safeWriteJson(economyPath, economy);
    return { processados: totalProcessados };
}

module.exports = { executarVarreduraCanal };