/* ========================================================================
   COMANDO: /carreira status
   DESCRIÇÃO: Status público usando a mesma Ficha Militar do sistema de prints.
   ======================================================================== */

const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');
const { criarFicha } = require('./fichaBuilder.js');

const carreirasPath = path.join(__dirname, 'carreiras.json');
const progressaoPath = path.join(__dirname, 'progressao.json');
const economyPath = path.join(__dirname, '../economy/economy.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('carreira')
        .setDescription('Comandos do sistema de progressão de carreira.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Mostra a ficha completa de carreira de um membro.')
                .addUserOption(option =>
                    option
                        .setName('membro')
                        .setDescription('Escolha o membro ou deixe vazio para ver o seu.')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() !== 'status') return;

        const targetMember = interaction.options.getMember('membro') || interaction.member;
        const userId = targetMember.id;

        const carreiras = safeReadJson(carreirasPath);
        const progressao = safeReadJson(progressaoPath);
        const economy = safeReadJson(economyPath);

        const ficha = criarFicha({
            progressao,
            carreiras,
            economy,
            userId,
            member: targetMember,
            modo: 'carreira'
        });

        if (!ficha) {
            return interaction.reply({
                content: `❌ ${targetMember} ainda não possui registro de carreira no sistema.`,
                ephemeral: true
            });
        }

        return interaction.reply({
            content: `📊 ${targetMember}, esta é a sua ficha completa de carreira:`,
            embeds: [ficha]
        });
    }
};
