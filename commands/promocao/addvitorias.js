/* ========================================================================
   ARQUIVO: commands/promocao/addvitorias.js
   DESCRIÇÃO: Adiciona/Remove vitórias manualmente e atualiza patentes (PÚBLICO)
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addvitorias')
        .setDescription('🛠️ (Admin) Adiciona ou remove vitórias do histórico de um jogador.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Protegido, mas a mensagem é pública
        .addUserOption(option => 
            option.setName('jogador')
                .setDescription('Selecione o soldado.')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('quantidade')
                .setDescription('Quantas vitórias adicionar? (Use negativo para remover, ex: -2)')
                .setRequired(true)),

    async execute(interaction) {
        // MENSAGEM PÚBLICA (Sem o ephemeral)
        await interaction.deferReply(); 

        const targetUser = interaction.options.getUser('jogador');
        const quantidade = interaction.options.getInteger('quantidade');
        
        if (targetUser.bot) {
            return interaction.editReply('❌ Você não pode alterar as vitórias de um bot!');
        }

        const progressao = safeReadJson(progressaoPath);
        const carreiras = safeReadJson(carreirasPath);

        if (!progressao[targetUser.id]) {
            progressao[targetUser.id] = { totalWins: 0, nome: targetUser.username };
        }

        const vitAntigas = progressao[targetUser.id].totalWins || 0;
        progressao[targetUser.id].totalWins = Math.max(0, vitAntigas + quantidade);
        const vitNovas = progressao[targetUser.id].totalWins;

        let logPromocao = "";

        if (progressao[targetUser.id].factionId && carreiras.faccoes[progressao[targetUser.id].factionId]) {
            const faccao = carreiras.faccoes[progressao[targetUser.id].factionId];
            let rankCorretoObj = null;
            
            for (const rank of faccao.caminho) {
                if (vitNovas >= rank.custo) rankCorretoObj = rank;
            }

            if (rankCorretoObj && progressao[targetUser.id].currentRankId !== rankCorretoObj.id) {
                const patenteAntigaId = progressao[targetUser.id].currentRankId;
                progressao[targetUser.id].currentRankId = rankCorretoObj.id;
                
                try {
                    const memberDiscord = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                    if (memberDiscord) {
                        await memberDiscord.roles.add(rankCorretoObj.id).catch(()=>{});
                        if (patenteAntigaId && memberDiscord.roles.cache.has(patenteAntigaId)) {
                            await memberDiscord.roles.remove(patenteAntigaId).catch(()=>{});
                        }
                        
                        if (quantidade > 0) {
                            logPromocao = `\n🎖️ **Bônus:** O soldado também foi promovido para o cargo de <@&${rankCorretoObj.id}> no Discord!`;
                        } else {
                            logPromocao = `\n📉 **Rebaixamento:** O soldado perdeu a patente e voltou para <@&${rankCorretoObj.id}> no Discord.`;
                        }
                    }
                } catch(e) {}
            }
        }

        safeWriteJson(progressaoPath, progressao);

        const acaoTxt = quantidade >= 0 ? 'Adicionadas' : 'Removidas';
        const embed = new EmbedBuilder()
            .setColor(quantidade >= 0 ? '#2ECC71' : '#E74C3C')
            .setTitle(`🔧 Ficha de ${targetUser.username} Atualizada!`)
            .setDescription(`A operação de gestão manual foi concluída.`)
            .addFields(
                { name: 'Vitórias Anteriores', value: `${vitAntigas}`, inline: true },
                { name: `Vitórias ${acaoTxt}`, value: `${quantidade}`, inline: true },
                { name: 'Novo Total', value: `**${vitNovas}**`, inline: false }
            );

        if (logPromocao) embed.setDescription(`A operação de gestão manual foi concluída.${logPromocao}`);

        await interaction.editReply({ embeds: [embed] });
    }
};