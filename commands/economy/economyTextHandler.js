/* ========================================================================
   ARQUIVO: commands/economy/economyTextHandler.js
   DESCRIÇÃO: Permite usar comandos de economia com o prefixo %
   ======================================================================== */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const economyPath = path.join(__dirname, 'economy.json');
const cooldownsPath = path.join(__dirname, 'cooldowns.json');
const progressaoPath = path.join(__dirname, '../promocao/progressao.json');
const carreirasPath = path.join(__dirname, '../promocao/carreiras.json');

const CANAL_MERCADO = '1441499321810813001';
const PREFIX = '%';

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.content.startsWith(PREFIX)) return;

        // Trava de Canal (Comentada para testar, descomente se quiser travar)
        if (message.channel.id !== CANAL_MERCADO) {
             // return message.reply(`❌ Comandos de economia apenas no <#${CANAL_MERCADO}>.`);
        }

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const userId = message.author.id;

        // --- %SALDO ---
        if (commandName === 'saldo') {
            const target = message.mentions.users.first() || message.author;
            const economy = safeReadJson(economyPath);
            const saldo = economy[target.id] || 0;

            const embed = new EmbedBuilder()
                .setTitle(`🗄️ COFRE: ${target.username.toUpperCase()}`)
                .setDescription(`**Recursos Disponíveis:**\n# 💰 ${saldo} WarCoins`)
                .setColor('#FFD700')
                .setThumbnail(target.displayAvatarURL());
            return message.reply({ embeds: [embed] });
        }

        // --- %TRABALHAR ---
        if (commandName === 'trabalhar') {
            const cooldowns = safeReadJson(cooldownsPath);
            const economy = safeReadJson(economyPath);
            const ultimo = cooldowns[userId]?.trabalho || 0;
            const agora = Date.now();
            
            if (agora - ultimo < 3600000) {
                const min = Math.floor((3600000 - (agora - ultimo)) / 60000);
                return message.reply(`⏳ Aguarde **${min} minutos**.`);
            }

            const missoes = ["saqueou um bunker", "vendeu munição", "interceptou suprimentos", "cobrou proteção"];
            const pagamento = Math.floor(Math.random() * (100 - 20 + 1)) + 20;
            
            economy[userId] = (economy[userId] || 0) + pagamento;
            safeWriteJson(economyPath, economy);
            
            if(!cooldowns[userId]) cooldowns[userId] = {};
            cooldowns[userId].trabalho = agora;
            safeWriteJson(cooldownsPath, cooldowns);

            return message.reply(`🪖 **MISSÃO:** Você ${missoes[Math.floor(Math.random()*missoes.length)]} e ganhou **${pagamento} WarCoins**.`);
        }

        // --- %COLETAR ---
        if (commandName === 'coletar') {
            const cooldowns = safeReadJson(cooldownsPath);
            const economy = safeReadJson(economyPath);
            const progressao = safeReadJson(progressaoPath);
            const carreiras = safeReadJson(carreirasPath);

            const ultimo = cooldowns[userId]?.diario || 0;
            const agora = Date.now();

            if (agora - ultimo < 86400000) {
                const horas = Math.floor((86400000 - (agora - ultimo)) / 3600000);
                return message.reply(`⏳ Volte em **${horas} horas**.`);
            }

            let salario = 100;
            let custo = 0;
            let patente = "Recruta";
            
            if (progressao[userId]?.currentRankId) {
                const faccao = carreiras.faccoes[progressao[userId].factionId];
                if (faccao) {
                    const rank = faccao.caminho.find(r => r.id === progressao[userId].currentRankId);
                    if (rank) {
                        patente = rank.nome;
                        custo = rank.custo;
                        salario = rank.custo * 50;
                    }
                }
            }
            if (salario < 100) salario = 100;

            economy[userId] = (economy[userId] || 0) + salario;
            safeWriteJson(economyPath, economy);
            
            if(!cooldowns[userId]) cooldowns[userId] = {};
            cooldowns[userId].diario = agora;
            safeWriteJson(cooldownsPath, cooldowns);

            return message.reply(`💸 **PAGAMENTO:** Recebeu **${salario} WarCoins** (Patente: ${patente}).`);
        }

        // --- %PAGAR @usuario valor ---
        if (commandName === 'pagar') {
            const recebedor = message.mentions.users.first();
            const valor = parseInt(args[1]);

            if (!recebedor) return message.reply('❌ Mencione alguém. Ex: `%pagar @Luan 100`');
            if (isNaN(valor) || valor <= 0) return message.reply('❌ Valor inválido.');
            if (recebedor.id === userId || recebedor.bot) return message.reply('❌ Operação inválida.');

            const economy = safeReadJson(economyPath);
            if ((economy[userId] || 0) < valor) return message.reply('❌ Saldo insuficiente.');

            economy[userId] -= valor;
            economy[recebedor.id] = (economy[recebedor.id] || 0) + valor;
            safeWriteJson(economyPath, economy);

            return message.reply(`💸 **Transferência:** Você enviou **${valor} WarCoins** para ${recebedor}.`);
        }

        // --- %DUELAR @usuario valor ---
        if (commandName === 'duelar') {
            const oponente = message.mentions.users.first();
            const aposta = parseInt(args[1]);

            if (!oponente) return message.reply('❌ Mencione o oponente. Ex: `%duelar @Inimigo 100`');
            if (isNaN(aposta) || aposta < 10) return message.reply('❌ Aposta mínima: 10.');
            if (oponente.id === userId || oponente.bot) return message.reply('❌ Oponente inválido.');

            const economy = safeReadJson(economyPath);
            if ((economy[userId] || 0) < aposta) return message.reply('❌ Você não tem esse dinheiro.');
            if ((economy[oponente.id] || 0) < aposta) return message.reply('❌ O oponente não tem esse dinheiro.');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('aceitar').setLabel('ACEITAR').setStyle(ButtonStyle.Success).setEmoji('⚔️'),
                new ButtonBuilder().setCustomId('recusar').setLabel('FUGIR').setStyle(ButtonStyle.Secondary)
            );

            const embed = new EmbedBuilder()
                .setTitle('⚔️ DUELO')
                .setDescription(`🔥 **${message.author}** vs **${oponente}**\n💰 **Aposta:** ${aposta} WarCoins`)
                .setColor('#e74c3c');

            const msg = await message.channel.send({ content: `${oponente}`, embeds: [embed], components: [row] });

            const filter = i => i.user.id === oponente.id;
            const collector = msg.createMessageComponentCollector({ filter, time: 60000, componentType: ComponentType.Button });

            collector.on('collect', async i => {
                if (i.customId === 'recusar') {
                    await i.update({ content: `🏳️ **${oponente} fugiu!**`, embeds: [], components: [] });
                    return collector.stop('recusou');
                }
                
                const db = safeReadJson(economyPath);
                if ((db[userId] || 0) < aposta || (db[oponente.id] || 0) < aposta) {
                    await i.update({ content: '❌ Erro: Alguém gastou a grana antes de aceitar.', components: [] });
                    return collector.stop('sem_grana');
                }

                const d1 = Math.floor(Math.random()*100)+1;
                const d2 = Math.floor(Math.random()*100)+1;
                let res = `⚖️ **EMPATE!** (${d1} vs ${d2})`;

                if (d1 > d2) { 
                    res = `💀 **${message.author.username} venceu!**`; 
                    db[userId] += aposta; db[oponente.id] -= aposta; 
                } else if (d2 > d1) { 
                    res = `💀 **${oponente.username} venceu!**`; 
                    db[oponente.id] += aposta; db[userId] -= aposta; 
                }
                
                safeWriteJson(economyPath, db);
                await i.update({ content: '', embeds: [new EmbedBuilder().setTitle('🏁 RESULTADO').setDescription(`${res}\n🛡️ ${d1} vs ${d2} 🛡️\n💰 **Saque:** +${aposta} WarCoins`).setColor('Gold')], components: [] });
                
                collector.stop('concluido');
            });
        }

        // --- %TOP-GRANA ---
        if (commandName === 'top-grana' || commandName === 'rank') {
            const economy = safeReadJson(economyPath);
            const ricos = Object.entries(economy).map(([k, v]) => ({ id: k, val: v })).sort((a, b) => b.val - a.val).slice(0, 10);
            let desc = "";
            ricos.forEach((r, i) => desc += `${i+1}º <@${r.id}>: **${r.val} WarCoins**\n`);
            return message.reply({ embeds: [new EmbedBuilder().setTitle('💎 TOP 10 RICOS').setDescription(desc || 'Ninguém.').setColor('Purple')] });
        }
    });
};