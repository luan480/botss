/* ========================================================================
   LIGA DAS NAÇÕES — /pontos
   ======================================================================== */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { isStaff } = require('./utils/helpers.js');
const pontuacaoLiga = require('./utils/pontuacaoLiga.js');

const CAMPOS = [
    ['pontos', 'Pontos Liga'],
    ['pontosGanhos', 'Pontos ganhos'],
    ['pontosPerdidos', 'Pontos perdidos'],
    ['vitorias', 'Vitórias'],
    ['derrotas', 'Derrotas'],
    ['partidas', 'Partidas'],
    ['kills', 'Abates'],
    ['mortes', 'Mortes'],
    ['continentes', 'Continentes'],
    ['asia', 'Ásia'],
    ['europa', 'Europa'],
    ['africa', 'África'],
    ['amnorte', 'América do Norte'],
    ['amsul', 'América do Sul'],
    ['oceania', 'Oceania'],
    ['primeiroLugar', '1º lugar'],
    ['segundoLugar', '2º lugar'],
    ['terceiroLugar', '3º lugar'],
    ['maisTropas', 'Mais tropas'],
    ['warCoins', 'WarCoins']
];

const escolhasCampo = CAMPOS.map(([value, name]) => ({ name, value }));

function valorAtual(perfil, campo) {
    if (campo === 'asia' || campo === 'europa' || campo === 'africa' || campo === 'amnorte' || campo === 'amsul' || campo === 'oceania') {
        return Number(perfil?.continentesDetalhes?.[campo]) || 0;
    }
    return Number(perfil?.[campo]) || 0;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pontos')
        .setDescription('Gerencia qualquer estatística manual da Liga.')
        .addSubcommand(subcommand => subcommand
            .setName('ajustar')
            .setDescription('Adiciona, remove ou define uma estatística do jogador.')
            .addUserOption(opt => opt.setName('jogador').setDescription('Selecione o jogador').setRequired(true))
            .addStringOption(opt => opt.setName('campo').setDescription('O que deseja alterar').setRequired(true).addChoices(...escolhasCampo))
            .addIntegerOption(opt => opt.setName('quantidade').setDescription('Quantidade ou novo valor').setRequired(true).setMinValue(0))
            .addStringOption(opt => opt.setName('operacao').setDescription('Como aplicar o valor').setRequired(true).addChoices(
                { name: 'Adicionar', value: 'adicionar' },
                { name: 'Remover', value: 'remover' },
                { name: 'Definir', value: 'definir' }
            )))
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
            return interaction.reply({ content: '❌ Você não possui permissão para usar este comando.', flags: MessageFlags.Ephemeral });
        }

        const pontuacaoPath = path.join(__dirname, 'pontuacao.json');
        const partidasPath = path.join(__dirname, 'partidas.json');
        const temporadaPath = path.join(__dirname, 'temporada.json');
        const dados = pontuacaoLiga.carregar(pontuacaoPath);
        const ranking = pontuacaoLiga.normalizarTodos(dados, partidasPath, temporadaPath);
        const historico = pontuacaoLiga.calcularEstatisticasTemporada(partidasPath, temporadaPath);
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('jogador');
        const idJogador = String(targetUser.id);

        if (!ranking[idJogador]) ranking[idJogador] = pontuacaoLiga.criarPerfil(idJogador, targetUser.username);
        const perfil = ranking[idJogador];
        perfil.nome = targetUser.username;
        perfil.ajustesManuais = perfil.ajustesManuais && typeof perfil.ajustesManuais === 'object' ? { ...perfil.ajustesManuais } : {};

        let campo = 'pontos';
        let quantidade;
        let operacao;

        if (subcommand === 'ajustar') {
            campo = interaction.options.getString('campo', true);
            quantidade = interaction.options.getInteger('quantidade', true);
            operacao = interaction.options.getString('operacao', true);
        } else {
            quantidade = interaction.options.getInteger('quantidade', true);
            operacao = subcommand;
        }

        const historicoPerfil = historico[idJogador] || pontuacaoLiga.criarPerfil(idJogador, targetUser.username);
        const baseHistorica = campo === 'pontos'
            ? Number(historicoPerfil.pontos) || 0
            : (['asia','europa','africa','amnorte','amsul','oceania'].includes(campo)
                ? Number(historicoPerfil.continentesDetalhes?.[campo]) || 0
                : Number(historicoPerfil[campo]) || 0);
        const ajusteAnterior = Number(perfil.ajustesManuais[campo]) || 0;
        const atual = baseHistorica + ajusteAnterior;

        let novoValor;
        if (operacao === 'adicionar') novoValor = atual + quantidade;
        else if (operacao === 'remover') novoValor = Math.max(0, atual - quantidade);
        else novoValor = quantidade;

        const novoAjuste = novoValor - baseHistorica;
        perfil.ajustesManuais[campo] = novoAjuste;

        if (campo === 'pontos') {
            perfil.pontos = novoValor;
            perfil.ajusteManual = true;
            perfil.ajusteManualValor = novoAjuste;
            perfil.ajusteManualEm = Date.now();
            perfil.ajusteManualPor = interaction.user.id;
        } else if (['asia','europa','africa','amnorte','amsul','oceania'].includes(campo)) {
            perfil.continentesDetalhes[campo] = novoValor;
        } else {
            perfil[campo] = novoValor;
        }

        // winrate é calculado automaticamente a partir de vitórias/partidas.
        perfil.winrate = perfil.partidas > 0 ? Number(((perfil.vitorias / perfil.partidas) * 100).toFixed(2)) : 0;

        if (!pontuacaoLiga.salvar(pontuacaoPath, ranking)) {
            return interaction.reply({ content: '❌ Não foi possível salvar a alteração.', flags: MessageFlags.Ephemeral });
        }

        const nomeCampo = CAMPOS.find(([valor]) => valor === campo)?.[1] || campo;
        return interaction.reply({
            content: `✅ **${targetUser.username}** — **${nomeCampo}**: **${novoValor}**.\n📝 Ajuste manual salvo e protegido contra sincronizações do histórico.`
        });
    }
};