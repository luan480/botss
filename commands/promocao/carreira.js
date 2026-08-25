/* ========================================================================
   COMANDO: /carreira status (PÚBLICO, COM OPÇÃO DE MEMBRO E NOTIFICAÇÃO)
   ======================================================================== */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');

const carreirasPath = path.join(__dirname, 'carreiras.json');
const progressaoPath = path.join(__dirname, 'progressao.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('carreira')
        .setDescription('Comandos do sistema de progressão de carreira.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Mostra o status de vitórias e patente de um membro.')
                .addUserOption(option =>
                    option.setName('membro')
                        .setDescription('Escolha o membro (deixe vazio para ver o seu)')
                        .setRequired(false)
                )
        ),
    
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'status') {
            // Pega o membro selecionado ou quem executou o comando
            const targetMember = interaction.options.getMember('membro') || interaction.member;
            const userId = targetMember.id;

            const carreirasConfig = safeReadJson(carreirasPath);
            const progressao = safeReadJson(progressaoPath);

            const userProgress = progressao[userId];

            if (!userProgress) {
                return interaction.reply({ 
                    content: `❌ ${targetMember.displayName} ainda não registrou nenhuma vitória no sistema.`, 
                    ephemeral: true 
                });
            }

            const faccaoId = userProgress.factionId;
            const faccao = carreirasConfig.faccoes[faccaoId];

            if (!faccao) {
                return interaction.reply({ content: '❌ Erro: Não consegui encontrar a facção deste usuário no sistema.', ephemeral: true });
            }

            const totalWins = userProgress.totalWins;
            let currentRankName = "• Recruta";
            let nextRankName = "N/A";
            let progressString = "Patente Máxima Atingida!";

            if (userProgress.currentRankId) {
                const rankAtual = faccao.caminho.find(r => r.id === userProgress.currentRankId);
                if (rankAtual) currentRankName = rankAtual.nome;

                const rankAtualIndex = faccao.caminho.findIndex(r => r.id === userProgress.currentRankId);
                
                if (rankAtualIndex !== -1 && rankAtualIndex < faccao.caminho.length - 1) {
                    const proximoCargo = faccao.caminho[rankAtualIndex + 1];
                    nextRankName = proximoCargo.nome;
                    const winsNeeded = proximoCargo.custo;
                    const winsRemaining = winsNeeded - totalWins;
                    progressString = `Faltam ${winsRemaining > 0 ? winsRemaining : 0} vitórias para a próxima patente. (${totalWins} / ${winsNeeded})`;
                }
            } else {
                if (faccao.caminho && faccao.caminho.length > 0) {
                    const proximoCargo = faccao.caminho[0];
                    nextRankName = proximoCargo.nome;
                    const winsNeeded = proximoCargo.custo;
                    const winsRemaining = winsNeeded - totalWins;
                    progressString = `Faltam ${winsRemaining > 0 ? winsRemaining : 0} vitórias para a próxima patente. (${totalWins} / ${winsNeeded})`;
                }
            }
            
            // Constrói o Embed
            const embed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setAuthor({ name: `Status de Carreira: ${targetMember.user.username}`, iconURL: targetMember.user.displayAvatarURL() })
                .setThumbnail(targetMember.guild.iconURL())
                .addFields(
                    { name: "Facção", value: faccao.nome, inline: true },
                    { name: "Patente Atual", value: currentRankName, inline: true },
                    { name: "Total de Vitórias", value: `🏆 ${totalWins}`, inline: true },
                    { name: "Próxima Patente", value: nextRankName, inline: false },
                    { name: "Progresso", value: progressString, inline: false }
                )
                .setTimestamp();
            
            // Envia publicamente no canal onde o comando foi digitado, marcando o usuário fora do embed
            await interaction.reply({
                content: `📊 ${targetMember}, aqui está o status de carreira!`,
                embeds: [embed]
            });
        }
    }
};