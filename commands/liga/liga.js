const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const painel = require('./painel.js');
const pontuacaoLiga = require('./utils/pontuacaoLiga.js');
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
        )
        .addSubcommand(subcommand => subcommand
            .setName('recalcular')
            .setDescription('Reconstrói o pontuacao.json usando o histórico da Liga.')
        ),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({
                content: '❌ Você não possui cargo autorizado para gerenciar a Liga.',
                flags: MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'painel') {
            const canal = interaction.options.getChannel('canal');
            if (!canal) {
                return interaction.reply({
                    content: '❌ Canal da Liga não informado.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

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

        if (subcommand !== 'recalcular') return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

        const pontuacaoPath = path.join(__dirname, 'pontuacao.json');
        const partidasPath = path.join(__dirname, 'partidas.json');
        const temporadaPath = path.join(__dirname, 'temporada.json');

        try {
            const dadosAtuais = pontuacaoLiga.carregar(pontuacaoPath);
            const registros = pontuacaoLiga.lerPartidas(partidasPath);
            const perfis = pontuacaoLiga.normalizarTodos(
                dadosAtuais,
                partidasPath,
                temporadaPath
            );

            const historico = pontuacaoLiga.calcularEstatisticasTemporada(
                partidasPath,
                temporadaPath
            ) || {};

            const jogadores = Object.values(perfis).filter(p =>
                Number(p.partidas) > 0 || Number(p.pontos) !== 0
            );

            const partidasValidas = registros.filter(({ partida }) =>
                !partida?.anulada &&
                !partida?.anulado &&
                !partida?.cancelada &&
                !partida?.cancelado
            ).length;

            // Backup automático antes de substituir o arquivo atual.
            if (fs.existsSync(pontuacaoPath)) {
                const backupPath = path.join(
                    __dirname,
                    `pontuacao.backup-${Date.now()}.json`
                );
                fs.copyFileSync(pontuacaoPath, backupPath);
            }

            if (!pontuacaoLiga.salvar(pontuacaoPath, perfis)) {
                throw new Error('Não foi possível salvar o novo pontuacao.json.');
            }

            const totalPontos = jogadores.reduce(
                (soma, jogador) => soma + (Number(jogador.pontos) || 0),
                0
            );

            const manual = jogadores.filter(j => j.ajusteManual === true).length;

            return interaction.editReply({
                content:
                    '✅ **PONTUAÇÃO DA LIGA RECONSTRUÍDA!**\n\n' +
                    `📚 Partidas lidas: **${registros.length}**\n` +
                    `⚔️ Partidas válidas: **${partidasValidas}**\n` +
                    `👥 Jogadores no ranking: **${jogadores.length}**\n` +
                    `🏆 Vitórias registradas: **${Object.values(historico).reduce((s, p) => s + (Number(p.vitorias) || 0), 0)}**\n` +
                    `⭐ 1º lugares: **${jogadores.reduce((s, p) => s + (Number(p.primeiroLugar) || 0), 0)}**\n` +
                    `🥈 2º lugares: **${jogadores.reduce((s, p) => s + (Number(p.segundoLugar) || 0), 0)}**\n` +
                    `🥉 3º lugares: **${jogadores.reduce((s, p) => s + (Number(p.terceiroLugar) || 0), 0)}**\n` +
                    `💠 Pontos no arquivo: **${totalPontos}**\n` +
                    `🔒 Ajustes manuais preservados: **${manual}**\n\n` +
                    'O histórico continua sendo lido de `partidas.json` e o saldo atual permanece persistente em `pontuacao.json`.'
            });
        } catch (erro) {
            console.error('[LIGA] Erro ao reconstruir pontuacao.json:', erro);
            return interaction.editReply({
                content: `❌ **Falha ao reconstruir a pontuação.**\n\`${String(erro.message || erro).slice(0, 1800)}\``
            });
        }
    }
};
