const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isStaff } = require('../utils/staffPermissions.js');

const MODOS = {
    tudo: 'all',
    all: 'all',
    mensagens: 'mensagens',
    imagens: 'imagens',
    embeds: 'embeds',
    bots: 'bots',
    usuarios: 'usuarios'
};

function classificarMensagem(msg, modo) {
    if (modo === 'all') return true;
    if (modo === 'mensagens') return !msg.author?.bot && msg.attachments.size === 0 && msg.embeds.length === 0;
    if (modo === 'imagens') return msg.attachments.some(a => a.contentType?.startsWith('image/'));
    if (modo === 'embeds') return msg.embeds.length > 0;
    if (modo === 'bots') return msg.author?.bot === true;
    if (modo === 'usuarios') return msg.author?.bot !== true;
    return false;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('limpar')
        .setDescription('Apaga mensagens do canal usando um filtro.')
        .addIntegerOption(option => option
            .setName('quantidade')
            .setDescription('Quantidade de mensagens a analisar (1 a 100).')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100))
        .addStringOption(option => option
            .setName('tipo')
            .setDescription('O que deseja apagar?')
            .setRequired(true)
            .addChoices(
                { name: '🧹 Tudo', value: 'all' },
                { name: '💬 Apenas mensagens', value: 'mensagens' },
                { name: '🖼️ Apenas imagens/anexos de imagem', value: 'imagens' },
                { name: '📑 Apenas embeds', value: 'embeds' },
                { name: '🤖 Apenas mensagens de bots', value: 'bots' },
                { name: '👤 Apenas mensagens de usuários', value: 'usuarios' }
            )),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.guild || !interaction.member || !isStaff(interaction.member)) {
            return interaction.editReply('❌ Apenas Staff, Suporte, Mod ou ADM podem limpar mensagens.');
        }

        const quantidade = interaction.options.getInteger('quantidade', true);
        const modo = MODOS[interaction.options.getString('tipo', true)];
        const canal = interaction.channel;

        if (!canal?.isTextBased?.() || typeof canal.messages?.fetch !== 'function') {
            return interaction.editReply('❌ Este canal não permite limpeza de mensagens.');
        }

        try {
            const mensagens = await canal.messages.fetch({ limit: quantidade });
            const selecionadas = mensagens.filter(msg => classificarMensagem(msg, modo));
            const limite = Date.now() - (14 * 24 * 60 * 60 * 1000);
            const recentes = selecionadas.filter(msg => msg.createdTimestamp >= limite);
            const antigas = selecionadas.filter(msg => msg.createdTimestamp < limite);

            let total = 0;
            if (recentes.size) total += (await canal.bulkDelete(recentes, true)).size;

            for (const msg of antigas.values()) {
                try {
                    await msg.delete();
                    total++;
                    await new Promise(resolve => setTimeout(resolve, 650));
                } catch (err) {
                    console.error(`[LIMPAR] Falha ao apagar ${msg.id}:`, err?.message || err);
                }
            }

            const nomes = {
                all: 'tudo',
                mensagens: 'apenas mensagens',
                imagens: 'apenas imagens/anexos de imagem',
                embeds: 'apenas embeds',
                bots: 'apenas mensagens de bots',
                usuarios: 'apenas mensagens de usuários'
            };

            await interaction.editReply(`✅ Limpeza concluída!\n🧹 **Filtro:** ${nomes[modo]}\n🗑️ **Apagadas:** ${total} mensagens.`);
        } catch (error) {
            console.error('[LIMPAR] Erro:', error);
            await interaction.editReply('❌ Ocorreu um erro ao tentar limpar as mensagens deste canal.');
        }
    }
};