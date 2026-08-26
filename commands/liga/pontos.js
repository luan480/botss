/* ========================================================================
   ARQUIVO: commands/liga/pontos.js
   DESCRIÇÃO: Gerencia os pontos da liga de forma segura usando o ID do usuário.
   ======================================================================== */

const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson, isStaff } = require('./utils/helpers.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pontos')
        .setDescription('Gerencia os pontos dos competidores na Liga.')
        .addSubcommand(subcommand => subcommand.setName('adicionar').setDescription('Adiciona pontos a um jogador.')
            .addUserOption(opt => opt.setName('jogador').setDescription('Selecione o jogador').setRequired(true))
            .addIntegerOption(opt => opt.setName('quantidade').setDescription('Pontos a adicionar').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand => subcommand.setName('remover').setDescription('Remove pontos de um jogador.')
            .addUserOption(opt => opt.setName('jogador').setDescription('Selecione o jogador').setRequired(true))
            .addIntegerOption(opt => opt.setName('quantidade').setDescription('Pontos a remover').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand => subcommand.setName('definir').setDescription('Define o total de pontos de um jogador.')
            .addUserOption(opt => opt.setName('jogador').setDescription('Selecione o jogador').setRequired(true))
            .addIntegerOption(opt => opt.setName('quantidade').setDescription('Total de pontos').setRequired(true).setMinValue(0))),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ Você não possui permissão para usar este comando.', flags: 64 });
        }

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('jogador');
        const quantidade = interaction.options.getInteger('quantidade');
        const pontosPath = path.join(__dirname, 'pontuacao.json');
        const ranking = safeReadJson(pontosPath) || {};
        const idJogador = targetUser.id;
        const pontosAtuais = Number(ranking[idJogador]) || 0;
        let novoTotal;

        if (subcommand === 'adicionar') novoTotal = pontosAtuais + quantidade;
        else if (subcommand === 'remover') novoTotal = Math.max(0, pontosAtuais - quantidade);
        else novoTotal = quantidade;

        ranking[idJogador] = novoTotal;

        if (!safeWriteJson(pontosPath, ranking)) {
            return interaction.reply({ content: '❌ Não foi possível salvar a pontuação.', flags: 64 });
        }

        return interaction.reply({
            content: `✅ Pontuação de **${targetUser.username}** atualizada para **${novoTotal} pts**.`
        });
    }
};