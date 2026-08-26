const {
    SlashCommandBuilder,
    ChannelType
} = require('discord.js');

const painel = require('./painel.js');
const { isStaff } = require('./utils/helpers.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liga')
        .setDescription('Comandos de gerenciamento da Liga.')
        .addSubcommand(subcommand => subcommand
            .setName('painel')
            .setDescription('Cria ou atualiza o painel de controle da Liga.')
            .addChannelOption(option => option
                .setName('canal')
                .setDescription('O canal onde o painel será criado.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        ),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({
                content: '❌ Você não possui cargo autorizado para gerenciar a Liga.',
                flags: 64
            });
        }

        if (interaction.options.getSubcommand() !== 'painel') return;

        const canal = interaction.options.getChannel('canal');
        if (!canal) {
            return interaction.reply({
                content: '❌ Canal da Liga não informado.',
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 }).catch(() => {});

        if (typeof painel !== 'function') {
            console.error('[LIGA] painel.js não exportou uma função válida.');
            return interaction.editReply({
                content: '❌ O `painel.js` não está exportando uma função válida.'
            });
        }

        try {
            await painel(interaction.guild, canal.id);
            return interaction.editReply({
                content: `✅ **Painel da Liga criado/atualizado com sucesso!**\n\n📍 Canal: ${canal}`
            });
        } catch (erro) {
            console.error('[LIGA] Erro ao criar painel:', erro);
            return interaction.editReply({
                content: '❌ **Não foi possível criar o painel da Liga.**\nVerifique o console para o erro detalhado.'
            });
        }
    }
};
