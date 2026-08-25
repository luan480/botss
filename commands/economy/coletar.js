/* ========================================================================
   ARQUIVO: commands/economy/coletar.js (PADRÃO WARCOINS)
   ======================================================================== */

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const economyPath = path.join(__dirname, 'economy.json');
const cooldownsPath = path.join(__dirname, 'cooldowns.json');
const progressaoPath = path.join(__dirname, '../promocao/progressao.json');
const carreirasPath = path.join(__dirname, '../promocao/carreiras.json');

const CANAL_MERCADO = '1441499321810813001';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coletar')
        .setDescription('📅 Coleta seu salário militar (Valor proporcional à sua Patente).'),

    async execute(interaction) {
        if (interaction.channel.id !== CANAL_MERCADO) {
            return interaction.reply({ content: `❌ Pagamentos são feitos apenas no <#${CANAL_MERCADO}>.`, flags: MessageFlags.Ephemeral });
        }

        const userId = interaction.user.id;
        const cooldowns = safeReadJson(cooldownsPath);
        const economy = safeReadJson(economyPath);
        const progressao = safeReadJson(progressaoPath);
        const carreiras = safeReadJson(carreirasPath);

        const ultimoUso = cooldowns[userId]?.diario || 0;
        const agora = Date.now();
        const tempoEspera = 24 * 60 * 60 * 1000;

        if (agora - ultimoUso < tempoEspera) {
            const horas = Math.floor((tempoEspera - (agora - ultimoUso)) / 3600000);
            return interaction.reply({ content: `⏳ **Aguarde!** O pagamento só sai amanhã. Volte em **${horas} horas**.`, flags: MessageFlags.Ephemeral });
        }

        let salario = 100; 
        let nomePatente = "Recruta Sem Patente";
        let custoPatente = 0;

        const userProg = progressao[userId];

        if (userProg && userProg.factionId && userProg.currentRankId) {
            const faccao = carreiras.faccoes[userProg.factionId];
            if (faccao) {
                const rankObj = faccao.caminho.find(r => r.id === userProg.currentRankId);
                if (rankObj) {
                    nomePatente = rankObj.nome;
                    custoPatente = rankObj.custo;
                    salario = custoPatente * 50; // Multiplicador de 50x
                }
            }
        }

        if (salario < 100) salario = 100;

        economy[userId] = (economy[userId] || 0) + salario;
        safeWriteJson(economyPath, economy);

        if (!cooldowns[userId]) cooldowns[userId] = {};
        cooldowns[userId].diario = agora;
        safeWriteJson(cooldownsPath, cooldowns);

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('💸 SOLDO MILITAR RECEBIDO')
            .setDescription(
                `O Alto Comando liberou seu pagamento.\n\n` +
                `🎖️ **Patente:** ${nomePatente}\n` +
                `📊 **Nível de Poder:** ${custoPatente} vitórias\n` +
                `💰 **Recebido:** \`${salario} WarCoins\`\n` +
                `🏦 **Saldo Total:** \`${economy[userId]} WarCoins\``
            )
            .setFooter({ text: 'Patentes mais altas pagam muito mais!', iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    }
};