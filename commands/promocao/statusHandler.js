/* ========================================================================
   ARQUIVO: commands/promocao/statusHandler.js (V-AutoRegister)
   DESCRIÇÃO: Se o usuário não existe, cria ele na hora baseado nos cargos.
   ======================================================================== */

const { EmbedBuilder, ActionRowBuilder, UserSelectMenuBuilder, MessageFlags } = require('discord.js');
const path = require('path');
// Adicionei safeWriteJson aqui para poder salvar o novo usuário
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js'); 

const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');

module.exports = async (interaction, client) => {
    const customId = interaction.customId;

    // 1. Botão inicial
    if (customId === 'stt_btn_ver') {
        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('stt_menu_sel')
            .setPlaceholder('Selecione o membro para ver a ficha...')
            .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(userSelect);

        await interaction.reply({
            content: 'De quem você deseja ver a Ficha Militar?',
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    }

    // 2. Resposta do Menu
    if (interaction.isUserSelectMenu() && customId === 'stt_menu_sel') {
        const targetUserId = interaction.values[0];
        
        const progressao = safeReadJson(progressaoPath);
        const carreiras = safeReadJson(carreirasPath);
        let userData = progressao[targetUserId];

        // =================================================================
        // 🧠 AUTO-REGISTRO (Se o usuário não existir)
        // =================================================================
        if (!userData) {
            // Tenta buscar o membro no servidor para ler os cargos
            try {
                const targetMember = await interaction.guild.members.fetch(targetUserId);
                
                // 1. Tenta descobrir a facção
                let faccaoIdFound = null;
                for (const id of Object.keys(carreiras.faccoes)) {
                    if (targetMember.roles.cache.has(id)) {
                        faccaoIdFound = id;
                        break;
                    }
                }

                if (faccaoIdFound) {
                    // 2. Descobre o maior cargo dessa facção
                    const faccao = carreiras.faccoes[faccaoIdFound];
                    let rankFound = null;
                    
                    // Varre do maior para o menor
                    for (let i = faccao.caminho.length - 1; i >= 0; i--) {
                        const r = faccao.caminho[i];
                        if (targetMember.roles.cache.has(r.id)) {
                            rankFound = r;
                            break;
                        }
                    }

                    // 3. Cria o registro novo
                    userData = {
                        factionId: faccaoIdFound,
                        currentRankId: rankFound ? rankFound.id : null,
                        // Se tiver rank, dá as vitórias do rank. Se não, 0.
                        totalWins: rankFound ? rankFound.custo : 0
                    };

                    // Salva no JSON e na variável local
                    progressao[targetUserId] = userData;
                    safeWriteJson(progressaoPath, progressao);
                    console.log(`[Status] Novo usuário registrado automaticamente: ${targetMember.displayName}`);
                }
            } catch (err) {
                console.error("Erro ao tentar auto-registrar membro:", err);
            }
        }
        // =================================================================

        // Se ainda assim não tiver dados (ex: membro sem facção nenhuma)
        if (!userData) {
            return interaction.update({
                content: `❌ <@${targetUserId}> não possui facção ou registro na Carreira Militar.`,
                components: [],
                embeds: []
            });
        }

        // Monta a Ficha
        let faccaoNome = "Sem Facção";
        let cargoNome = "Recruta";
        let corEmbed = "#99AAB5"; 

        if (userData.factionId && carreiras.faccoes[userData.factionId]) {
            const faccao = carreiras.faccoes[userData.factionId];
            faccaoNome = faccao.nome;
            corEmbed = faccao.cor || '#FFD700'; 

            if (userData.currentRankId) {
                const rankEncontrado = faccao.caminho.find(r => r.id === userData.currentRankId);
                if (rankEncontrado) {
                    cargoNome = rankEncontrado.nome;
                }
            }
        }

        const targetUser = await client.users.fetch(targetUserId);
        
        const embedFicha = new EmbedBuilder()
            .setAuthor({ name: `Ficha Militar: ${targetUser.username}`, iconURL: targetUser.displayAvatarURL() })
            .setTitle(`🎖️ ${cargoNome.toUpperCase()}`)
            .setColor(corEmbed)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: '🏴 Facção', value: `**${faccaoNome}**`, inline: true },
                { name: '🏆 Vitórias Confirmadas', value: `\`${userData.totalWins || 0}\``, inline: true },
                { name: '📅 Última Atualização', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true } 
            )
            .setFooter({ text: 'Sistema de Promoção da Guilda', iconURL: interaction.guild.iconURL() });

        await interaction.update({
            content: '', // Limpa a pergunta
            embeds: [embedFicha],
            components: [] // Remove o menu
        });
    }
};