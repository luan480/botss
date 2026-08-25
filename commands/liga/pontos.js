/* ========================================================================
   ARQUIVO: commands/liga/pontos.js
   DESCRIÇÃO: Gerencia os pontos da liga de forma segura usando o ID do usuário.
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('./utils/helpers.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pontos')
        .setDescription('Gerencia os pontos dos competidores na Liga.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('adicionar').setDescription('Adiciona pontos a um jogador.')
                .addUserOption(opt => opt.setName('jogador').setDescription('Selecione o jogador').setRequired(true))
                .addIntegerOption(opt => opt.setName('quantidade').setDescription('Pontos a adicionar').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remover').setDescription('Remove pontos de um jogador.')
                .addUserOption(opt => opt.setName('jogador').setDescription('Selecione o jogador').setRequired(true))
                .addIntegerOption(opt => opt.setName('quantidade').setDescription('Pontos a remover').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('definir').setDescription('Define o total de pontos de um jogador.')
                .addUserOption(opt => opt.setName('jogador').setDescription('Selecione o jogador').setRequired(true))
                .addIntegerOption(opt => opt.setName('quantidade').setDescription('Total de pontos').setRequired(true))
        ),
        
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        // AGORA PEGAMOS O USUÁRIO DIRETAMENTE PELO DISCORD (ID SEGURO)
        const targetUser = interaction.options.getUser('jogador');
        const quantidade = interaction.options.getInteger('quantidade');
        
        const pontosPath = path.join(__dirname, 'pontuacao.json');

        const ranking = safeReadJson(pontosPath);
        if (ranking === null) {
            return interaction.reply({ content: '❌ Erro ao ler o arquivo de pontuação.', ephemeral: true });
        }

        // BUSCA PELO ID EM VEZ DO NOME DIGITADO
        const idJogador = targetUser.id;
        const pontosAtuais = ranking[idJogador] || 0;
        let novoTotal;
        let replyMessage;

        if (subcommand === 'adicionar') {
            novoTotal = pontosAtuais + quantidade;
            replyMessage = `✅ **${quantidade}** pontos adicionados para **${targetUser.username}**. Novo total: **${novoTotal}** pts.`;
        } else if (subcommand === 'remover') {
            novoTotal = pontosAtuais - quantidade;
            replyMessage = `✅ **${quantidade}** pontos removidos de **${targetUser.username}**. Novo total: **${novoTotal}** pts.`;
        } else if (subcommand === 'definir') {
            novoTotal = quantidade;
            replyMessage = `✅ Pontos de **${targetUser.username}** definidos para **${novoTotal}** pts.`;
        }

        // SALVA USANDO O ID NUMÉRICO
        ranking[idJogador] = novoTotal;

        try {
            safeWriteJson(pontosPath, ranking);
            await interaction.reply({ content: replyMessage, ephemeral: false });
        } catch (err) {
            console.error("Erro ao salvar pontuação:", err);
            await interaction.reply({ content: '❌ Erro interno ao salvar o arquivo de pontuação.', ephemeral: true });
        }
    }
};