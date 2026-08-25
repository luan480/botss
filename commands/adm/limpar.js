/* ========================================================================
   ARQUIVO: commands/adm/limpar.js
   DESCRIÇÃO: Comando de limpeza profunda (suporta mensagens > 14 dias)
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('limpar')
        .setDescription('Limpa mensagens do canal (incluindo mensagens com mais de 14 dias).')
        .addIntegerOption(option =>
            option.setName('quantidade')
                .setDescription('Número de mensagens para apagar (de 1 a 100).')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const quantidade = interaction.options.getInteger('quantidade');

        if (quantidade < 1 || quantidade > 100) {
            return interaction.editReply({ content: '❌ Você precisa escolher um valor entre 1 e 100 mensagens.' });
        }

        const channel = interaction.channel;

        try {
            // Busca as mensagens no canal
            const messages = await channel.messages.fetch({ limit: quantidade });
            
            const agora = Date.now();
            const quatorzeDiasMs = 14 * 24 * 60 * 60 * 1000;

            const mensagensNovas = [];
            const mensagensAntigas = [];

            // Separa o que tem menos de 14 dias e o que tem mais
            messages.forEach(msg => {
                if (agora - msg.createdTimestamp < quatorzeDiasMs) {
                    mensagensNovas.push(msg);
                } else {
                    mensagensAntigas.push(msg);
                }
            });

            let totalApagadas = 0;

            // 1. Apaga as mensagens recentes em lote (bulkDelete) se houver alguma
            if (mensagensNovas.length > 0) {
                const deleted = await channel.bulkDelete(mensagensNovas, true);
                totalApagadas += deleted.size;
            }

            // 2. Apaga as mensagens com mais de 14 dias uma por uma (limpeza profunda)
            if (mensagensAntigas.length > 0) {
                for (const msg of mensagensAntigas) {
                    try {
                        await msg.delete();
                        totalApagadas++;
                        // Pequeno atraso para evitar bloqueio de Rate Limit da API do Discord
                        await new Promise(resolve => setTimeout(resolve, 600));
                    } catch (err) {
                        console.error(`Não foi possível apagar a mensagem antiga: ${err.message}`);
                    }
                }
            }

            await interaction.editReply({ content: `✅ Sucesso! Um total de **${totalApagadas}** mensagens foram apagadas (incluindo mensagens com mais de 14 dias).` });

        } catch (error) {
            console.error('Erro ao executar o comando de limpeza:', error);
            await interaction.editReply({ content: '❌ Ocorreu um erro ao tentar limpar as mensagens deste canal.' });
        }
    },
};