/* ========================================================================
   ARQUIVO: commands/economy/duelar.js (PADRÃO WARCOINS)
   ======================================================================== */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
const economyPath = path.join(__dirname, 'economy.json');
const CANAL_MERCADO = '1441499321810813001';

module.exports = {
    data: new SlashCommandBuilder().setName('duelar').setDescription('⚔️ Apostar WarCoins.').addUserOption(o => o.setName('oponente').setRequired(true).setDescription('Contra quem?')).addIntegerOption(o => o.setName('valor').setRequired(true).setDescription('Valor em WarCoins')),
    async execute(interaction) {
        if (interaction.channel.id !== CANAL_MERCADO) return interaction.reply({ content: `❌ Duelos apenas no <#${CANAL_MERCADO}>.`, flags: MessageFlags.Ephemeral });
        const p1 = interaction.user; const p2 = interaction.options.getUser('oponente'); const valor = interaction.options.getInteger('valor');
        if (p1.id === p2.id || p2.bot) return interaction.reply({ content: '❌ Oponente inválido.', flags: MessageFlags.Ephemeral });
        
        const economy = safeReadJson(economyPath);
        if ((economy[p1.id] || 0) < valor) return interaction.reply({ content: `❌ Você não tem **${valor} WarCoins**.`, flags: MessageFlags.Ephemeral });
        if ((economy[p2.id] || 0) < valor) return interaction.reply({ content: `❌ ${p2} não tem **${valor} WarCoins**.`, flags: MessageFlags.Ephemeral });

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('aceitar').setLabel('ACEITAR').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('recusar').setLabel('FUGIR').setStyle(ButtonStyle.Danger));
        const msg = await interaction.reply({ content: `${p2}`, embeds: [new EmbedBuilder().setTitle('⚔️ DUELO').setDescription(`🔥 **${p1}** vs **${p2}**\n💰 **Aposta:** ${valor} WarCoins`).setColor('#e74c3c')], components: [row] });

        const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === p2.id, time: 60000, componentType: ComponentType.Button });
        collector.on('collect', async i => {
            if (i.customId === 'recusar') return i.update({ content: `🏳️ **${p2} fugiu!**`, embeds: [], components: [] });
            const db = safeReadJson(economyPath);
            if ((db[p1.id] || 0) < valor || (db[p2.id] || 0) < valor) return i.update({ content: '❌ Dinheiro insuficiente.', components: [] });
            
            const d1 = Math.floor(Math.random()*100)+1; const d2 = Math.floor(Math.random()*100)+1;
            let res = `⚖️ **EMPATE!** (${d1} vs ${d2})`;
            if (d1 > d2) { res = `💀 **${p1.username} venceu!**`; db[p1.id] = (db[p1.id]||0)+valor; db[p2.id] = (db[p2.id]||0)-valor; }
            else if (d2 > d1) { res = `💀 **${p2.username} venceu!**`; db[p2.id] = (db[p2.id]||0)+valor; db[p1.id] = (db[p1.id]||0)-valor; }
            safeWriteJson(economyPath, db);
            await i.update({ content: '', embeds: [new EmbedBuilder().setTitle('🏁 RESULTADO').setDescription(`🛡️ **${p1.username}:** ${d1}\n🛡️ **${p2.username}:** ${d2}\n\n${res}\n💰 **Valendo:** ${valor} WarCoins`).setColor('Gold')], components: [] });
        });
    }
};