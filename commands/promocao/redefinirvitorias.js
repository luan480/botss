/* ========================================================================
   ARQUIVO: commands/promocao/redefinirvitorias.js
   DESCRIÇÃO: Define um valor EXATO de vitórias (PÚBLICO)
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('redefinirvitorias')
        .setDescription('🛠️ (Admin) Define o número EXATO de vitórias de um soldado.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Protegido, mas a mensagem é pública
        .addUserOption(option => 
            option.setName('jogador')
                .setDescription('Selecione o soldado que terá a ficha alterada.')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('quantidade')
                .setDescription('Qual será o novo número EXATO de vitórias? (Digite 0 para resetar)')
                .setRequired(true)),

    async execute(interaction) {
        // MENSAGEM PÚBLICA (Sem o ephemeral)
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('jogador');
        const novaQuantidade = interaction.options.getInteger('quantidade');
        
        if (targetUser.bot) {
            return interaction.editReply('❌ Bots não possuem ficha militar!');
        }

        if (novaQuantidade < 0) {
            return interaction.editReply('❌ O número de vitórias não pode ser negativo. Digite 0 ou mais.');
        }

        const progressao = safeReadJson(progressaoPath);
        const carreiras = safeReadJson(carreirasPath);

        if (!progressao[targetUser.id]) {
            progressao[targetUser.id] = { totalWins: 0, nome: targetUser.username };
        }

        const vitAntigas = progressao[targetUser.id].totalWins || 0;
        progressao[targetUser.id].totalWins = novaQuantidade;

        let logAcao = "";

        if (progressao[targetUser.id].factionId && carreiras.faccoes[progressao[targetUser.id].factionId]) {
            const faccao = carreiras.faccoes[progressao[targetUser.id].factionId];
            let rankCorretoObj = null;
            
            for (const rank of faccao.caminho) {
                if (novaQuantidade >= rank.custo) rankCorretoObj = rank;
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
                        
                        if (novaQuantidade === 0) {
                            logAcao = `\n📉 **Resetado:** O soldado perdeu todas as patentes e foi rebaixado para <@&${rankCorretoObj.id}>.`;
                        } else if (novaQuantidade > vitAntigas) {
                            logAcao = `\n🎖️ **Promovido:** A nova ficha concedeu o cargo de <@&${rankCorretoObj.id}>.`;
                        } else {
                            logAcao = `\n📉 **Rebaixado:** O soldado caiu para a patente de <@&${rankCorretoObj.id}>.`;
                        }
                    }
                } catch(e) {}
            }
        }

        safeWriteJson(progressaoPath, progressao);

        const embed = new EmbedBuilder()
            .setColor(novaQuantidade === 0 ? '#E74C3C' : '#F1C40F')
            .setTitle(novaQuantidade === 0 ? `🔥 Ficha de ${targetUser.username} Resetada!` : `🔧 Ficha de ${targetUser.username} Redefinida!`)
            .addFields(
                { name: 'Vitórias Anteriores', value: `${vitAntigas}`, inline: true },
                { name: 'Novo Valor Exato', value: `**${novaQuantidade}**`, inline: true }
            );

        if (logAcao) {
            embed.setDescription(`O banco de dados foi atualizado com sucesso.${logAcao}`);
        } else if (novaQuantidade === 0) {
            embed.setDescription(`Todas as vitórias do jogador foram apagadas do sistema.`);
        } else {
            embed.setDescription(`A ficha foi atualizada para o valor exato.`);
        }

        await interaction.editReply({ embeds: [embed] });
    }
};