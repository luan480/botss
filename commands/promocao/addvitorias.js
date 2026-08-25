/* ========================================================================
   ARQUIVO: commands/promocao/addvitorias.js
   DESCRIÇÃO: Adiciona/Remove vitórias manualmente e atualiza patentes.
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
const careerHistory = require('./careerHistory.js');

const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addvitorias')
        .setDescription('🛠️ (Admin) Adiciona ou remove vitórias do histórico de um jogador.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option.setName('jogador').setDescription('Selecione o soldado.').setRequired(true))
        .addIntegerOption(option => option.setName('quantidade').setDescription('Quantas vitórias adicionar? Use negativo para remover.').setRequired(true)),

    async execute(interaction) {
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

        const vitAntigas = Number(progressao[targetUser.id].totalWins) || 0;
        progressao[targetUser.id].totalWins = Math.max(0, vitAntigas + quantidade);
        const vitNovas = progressao[targetUser.id].totalWins;

        let logPromocao = '';

        if (progressao[targetUser.id].factionId && carreiras.faccoes?.[progressao[targetUser.id].factionId]) {
            const faccao = carreiras.faccoes[progressao[targetUser.id].factionId];
            let rankCorretoObj = null;

            for (const rank of faccao.caminho || []) {
                if (vitNovas >= Number(rank.custo || 0)) rankCorretoObj = rank;
            }

            if (rankCorretoObj && progressao[targetUser.id].currentRankId !== rankCorretoObj.id) {
                const patenteAntigaId = progressao[targetUser.id].currentRankId;
                progressao[targetUser.id].currentRankId = rankCorretoObj.id;

                try {
                    const memberDiscord = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                    if (memberDiscord) {
                        await memberDiscord.roles.add(rankCorretoObj.id).catch(() => {});
                        if (patenteAntigaId && memberDiscord.roles.cache.has(patenteAntigaId)) {
                            await memberDiscord.roles.remove(patenteAntigaId).catch(() => {});
                        }

                        logPromocao = quantidade > 0
                            ? `\n🎖️ **Bônus:** O soldado também foi promovido para <@&${rankCorretoObj.id}>!`
                            : `\n📉 **Rebaixamento:** O soldado voltou para <@&${rankCorretoObj.id}>.`;
                    }
                } catch (_) {}
            }
        }

        safeWriteJson(progressaoPath, progressao);

        // IMPORTANTE: o histórico de carreira NÃO é o mesmo banco do ciclo da Liga.
        // Remover vitórias do ciclo não apaga automaticamente a carreira já registrada.
        // Alterações manuais positivas entram como carreira; negativas ficam limitadas
        // ao banco atual para não destruir histórico consolidado.
        if (quantidade > 0) {
            careerHistory.registrarDelta(
                targetUser.id,
                { wins: quantidade },
                {},
                targetUser.username
            );
        } else {
            careerHistory.normalizarJogador(targetUser.id, targetUser.username);
        }

        const acaoTxt = quantidade >= 0 ? 'Adicionadas' : 'Removidas';
        const embed = new EmbedBuilder()
            .setColor(quantidade >= 0 ? '#2ECC71' : '#E74C3C')
            .setTitle(`🔧 Ficha de ${targetUser.username} Atualizada!`)
            .setDescription(`A operação de gestão manual foi concluída.${logPromocao}`)
            .addFields(
                { name: 'Vitórias Anteriores', value: `${vitAntigas}`, inline: true },
                { name: `Vitórias ${acaoTxt}`, value: `${quantidade}`, inline: true },
                { name: 'Novo Total da Liga', value: `**${vitNovas}**`, inline: false },
                { name: '📚 Carreira', value: 'Histórico permanente preservado.', inline: false }
            );

        await interaction.editReply({ embeds: [embed] });
    }
};
