/* ========================================================================
   COMANDO: /carreira status
   STATUS PÚBLICO DA CARREIRA
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
        .addSubcommand(subcommand => subcommand
            .setName('status')
            .setDescription('Mostra a ficha completa de carreira de um membro.')
            .addUserOption(option => option
                .setName('membro')
                .setDescription('Escolha o membro ou deixe vazio para ver o seu.')
                .setRequired(false)
            )
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() !== 'status') return;

        const targetMember = interaction.options.getMember('membro') || interaction.member;
        const userId = targetMember.id;

        const ficha = criarFicha({
            progressao: safeReadJson(progressaoPath) || {},
            carreiras: safeReadJson(carreirasPath) || {},
            economy: safeReadJson(economyPath) || {},
            userId,
            member: targetMember,
            modo: 'carreira'
        });

        if (!ficha) {
            return interaction.reply({
                content: `❌ ${targetMember} ainda não possui registro de carreira no sistema.`,
                flags: 64
            });
        }

        return interaction.reply({
            content: `📊 ${targetMember}, esta é a sua ficha completa de carreira:`,
            embeds: [ficha]
        });
    }
};
