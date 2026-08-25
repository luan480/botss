const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isStaff } = require('../utils/staffPermissions.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('limpar')
        .setDescription('Limpa mensagens do canal (incluindo mensagens com mais de 14 dias).')
        .addIntegerOption(option => option.setName('quantidade').setDescription('Número de mensagens para apagar (1 a 100).').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!isStaff(interaction.member)) {
            return interaction.editReply('❌ Apenas Staff, Suporte, Mod ou ADM podem limpar mensagens.');
        }

        const quantidade = interaction.options.getInteger('quantidade');
        if (quantidade < 1 || quantidade > 100) {
            return interaction.editReply('❌ Você precisa escolher um valor entre 1 e 100 mensagens.');
        }

        try {
            const messages = await interaction.channel.messages.fetch({ limit: quantidade });
            const limite = Date.now() - (14 * 24 * 60 * 60 * 1000);
            const recentes = [];
            const antigas = [];

            messages.forEach(msg => (msg.createdTimestamp >= limite ? recentes : antigas).push(msg));

            let total = 0;
            if (recentes.length) total += (await interaction.channel.bulkDelete(recentes, true)).size;

            for (const msg of antigas) {
                try {
                    await msg.delete();
                    total++;
                    await new Promise(resolve => setTimeout(resolve, 600));
                } catch (err) {
                    console.error(`[LIMPAR] Falha ao apagar ${msg.id}:`, err.message);
                }
            }

            await interaction.editReply(`✅ Sucesso! **${total}** mensagens foram apagadas.`);
        } catch (error) {
            console.error('[LIMPAR] Erro:', error);
            await interaction.editReply('❌ Ocorreu um erro ao tentar limpar as mensagens deste canal.');
        }
    }
};
