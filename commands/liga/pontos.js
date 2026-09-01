/* ========================================================================
   LIGA DAS NAÇÕES — /pontos
   ======================================================================== */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { isStaff } = require('./utils/helpers.js');
const pontuacaoLiga = require('./utils/pontuacaoLiga.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pontos')
        .setDescription('Gerencia os pontos dos competidores na Liga.')
        .addSubcommand(subcommand => subcommand
            .setName('adicionar')
            .setDescription('Adiciona pontos a um jogador.')
            .addUserOption(opt => opt.setName('jogador').setDescription('Selecione o jogador').setRequired(true))
            .addIntegerOption(opt => opt.setName('quantidade').setDescription('Pontos a adicionar').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand => subcommand
            .setName('remover')
            .setDescription('Remove pontos de um jogador.')
            .addUserOption(opt => opt.setName('jogador').setDescription('Selecione o jogador').setRequired(true))
            .addIntegerOption(opt => opt.setName('quantidade').setDescription('Pontos a remover').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand => subcommand
            .setName('definir')
            .setDescription('Define o total de pontos de um jogador.')
            .addUserOption(opt => opt.setName('jogador').setDescription('Selecione o jogador').setRequired(true))
            .addIntegerOption(opt => opt.setName('quantidade').setDescription('Total de pontos').setRequired(true).setMinValue(0))),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({
                content: '❌ Você não possui permissão para usar este comando.',
                flags: MessageFlags.Ephemeral
            });
        }

        const pontuacaoPath = path.join(__dirname, 'pontuacao.json');
        const partidasPath = path.join(__dirname, 'partidas.json');
        const temporadaPath = path.join(__dirname, 'temporada.json');

        const dados = pontuacaoLiga.carregar(pontuacaoPath);
        const ranking = pontuacaoLiga.normalizarTodos(dados);
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('jogador');
        const quantidade = interaction.options.getInteger('quantidade');
        const idJogador = String(targetUser.id);

        if (!ranking[idJogador]) {
            ranking[idJogador] = pontuacaoLiga.criarPerfil(idJogador, targetUser.username);
        }

        ranking[idJogador].nome = targetUser.username;
        const pontosAtuais = Number(ranking[idJogador].pontos) || 0;

        let novoTotal = pontosAtuais;
        if (subcommand === 'adicionar') {
            novoTotal = pontosAtuais + quantidade;
        } else if (subcommand === 'remover') {
            // Mantém o comportamento antigo: /remover nunca força a pontuação abaixo de 0.
            novoTotal = Math.max(0, pontosAtuais - quantidade);
        } else if (subcommand === 'definir') {
            novoTotal = quantidade;
        }

        ranking[idJogador].pontos = novoTotal;

        if (!pontuacaoLiga.salvar(pontuacaoPath, ranking)) {
            return interaction.reply({
                content: '❌ Não foi possível salvar a pontuação.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Mantém partidas/vitórias/kills/mortes/continentes sincronizados.
        pontuacaoLiga.sincronizarArquivo(
            pontuacaoPath,
            partidasPath,
            temporadaPath
        );

        return interaction.reply({
            content: `✅ Pontuação de **${targetUser.username}** atualizada para **${novoTotal} pts**.`
        });
    }
};
