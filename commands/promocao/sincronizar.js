/* ========================================================================
   ARQUIVO: commands/promocao/sincronizar.js
   DESCRIÇÃO: Sincronizador Absoluto - Recalcula patentes, atualiza o JSON 
              e aplica os cargos corretos no Discord baseando-se nas vitórias.
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');

// Função de pausa para evitar Rate Limit (bloqueio) da API do Discord
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sincronizar-tudo')
        .setDescription('🕵️ Recalcula as vitórias, corrige o banco de dados e restaura os cargos no Discord.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        const carreirasConfig = safeReadJson(carreirasPath);
        const progressao = safeReadJson(progressaoPath);
        
        let restaurados = 0;
        let erros = 0;
        let jsonAlterado = false;

        try {
            await interaction.editReply("🔄 Baixando lista de membros e analisando o banco de dados...\n*Isso pode levar alguns minutos, não use outros comandos.*");
            const members = await guild.members.fetch();

            const userIds = Object.keys(progressao);

            for (const userId of userIds) {
                const userData = progressao[userId];
                const member = members.get(userId);

                if (!member) continue;

                // 1. ATUALIZA O NOME NO BANCO DE DADOS
                if (userData.nome !== member.user.username) {
                    userData.nome = member.user.username;
                    jsonAlterado = true;
                }

                // 2. VALIDAÇÃO DE FACÇÃO
                if (!userData.factionId || !carreirasConfig.faccoes[userData.factionId]) continue;
                const faccao = carreirasConfig.faccoes[userData.factionId];

                // 3. CÁLCULO DA PATENTE CORRETA (Proteção para quem tem 0 vitórias)
                const totalWins = userData.totalWins || 0;
                let rankCorretoObj = null; // Começa NULO (Sem patente / Recruta)
                
                // Varre o caminho para descobrir qual é a patente que ele tem direito
                for (const rank of faccao.caminho) {
                    if (totalWins >= rank.custo) {
                        rankCorretoObj = rank;
                    }
                }

                const novoRankId = rankCorretoObj ? rankCorretoObj.id : null;
                if (userData.currentRankId !== novoRankId) {
                    userData.currentRankId = novoRankId;
                    jsonAlterado = true;
                }

                // 4. VERIFICAÇÃO E APLICAÇÃO DOS CARGOS NO DISCORD
                let precisaAtualizarDiscord = false;
                const cargosMembro = member.roles.cache;

                if (rankCorretoObj) {
                    // JOGADOR TEM VITÓRIAS (Deve ter a patente e NÃO deve ter Recruta)
                    if (!cargosMembro.has(rankCorretoObj.id)) precisaAtualizarDiscord = true;
                    
                    for (const rank of faccao.caminho) {
                        if (rank.id !== rankCorretoObj.id && cargosMembro.has(rank.id)) {
                            precisaAtualizarDiscord = true;
                            break;
                        }
                    }
                    if (carreirasConfig.cargoRecrutaId && cargosMembro.has(carreirasConfig.cargoRecrutaId)) {
                        precisaAtualizarDiscord = true;
                    }
                } else {
                    // JOGADOR TEM 0 VITÓRIAS (Deve ter Recruta e NÃO ter nenhuma patente)
                    if (carreirasConfig.cargoRecrutaId && !cargosMembro.has(carreirasConfig.cargoRecrutaId)) {
                        precisaAtualizarDiscord = true;
                    }
                    for (const rank of faccao.caminho) {
                        if (cargosMembro.has(rank.id)) {
                            precisaAtualizarDiscord = true;
                            break;
                        }
                    }
                }

                // 5. SE ESTIVER ERRADO, O BOT CORRIGE
                if (precisaAtualizarDiscord) {
                    try {
                        if (rankCorretoObj) {
                            // Entrega a patente certa
                            await member.roles.add(rankCorretoObj.id).catch(() => {});
                            // Tira o Recruta
                            if (carreirasConfig.cargoRecrutaId && cargosMembro.has(carreirasConfig.cargoRecrutaId)) {
                                await member.roles.remove(carreirasConfig.cargoRecrutaId).catch(() => {});
                            }
                            // Tira as patentes erradas
                            for (const rank of faccao.caminho) {
                                if (rank.id !== rankCorretoObj.id && cargosMembro.has(rank.id)) {
                                    await member.roles.remove(rank.id).catch(() => {});
                                }
                            }
                        } else {
                            // Devolve Recruta
                            if (carreirasConfig.cargoRecrutaId && !cargosMembro.has(carreirasConfig.cargoRecrutaId)) {
                                await member.roles.add(carreirasConfig.cargoRecrutaId).catch(() => {});
                            }
                            // Arranca as patentes que não tem direito
                            for (const rank of faccao.caminho) {
                                if (cargosMembro.has(rank.id)) {
                                    await member.roles.remove(rank.id).catch(() => {});
                                }
                            }
                        }

                        restaurados++;
                        await sleep(500); 

                    } catch (e) {
                        console.error(`Erro ao atualizar cargos de ${member.user.tag}:`, e);
                        erros++;
                    }
                }
            }

            // SALVA AS CORREÇÕES NO progressao.json
            if (jsonAlterado) {
                safeWriteJson(progressaoPath, progressao);
            }

            await interaction.editReply(
                `✅ **Sincronização Perfeita Concluída!**\n\n` +
                `👥 **Jogadores Analisados:** ${userIds.length}\n` +
                `🔄 **Cargos/Patentes Corrigidos no Discord:** ${restaurados}\n` +
                `⚠️ **Erros encontrados:** ${erros}`
            );

        } catch (err) {
            console.error(err);
            await interaction.editReply(`❌ Ocorreu um erro crítico durante a sincronização: ${err.message}`);
        }
    }
};