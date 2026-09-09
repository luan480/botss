const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');

const HISTORICO_PATH = path.join(__dirname, 'historico.json');
const CATS = ['liga', 'eventos', 'records', 'imperador'];

function load() {
    const d = safeReadJson(HISTORICO_PATH) || {};
    for (const c of CATS) if (!Array.isArray(d[c])) d[c] = [];
    return d;
}
function findRecord(d, id) {
    for (const c of CATS) {
        const i = d[c].findIndex(r => r && typeof r === 'object' && String(r.id) === String(id));
        if (i >= 0) return { categoria: c, index: i, registro: d[c][i] };
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hall-admin')
        .setDescription('🏛️ Gerencia registros do Hall da Fama por ID.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('id').setDescription('ID do registro no historico.json').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const id = interaction.options.getString('id');
        const d = load();
        const found = findRecord(d, id);
        if (!found) return interaction.editReply('❌ Registro não encontrado.');

        const r = found.registro;
        const e = new EmbedBuilder()
            .setTitle('🏛️ Gerenciar Hall da Fama')
            .setDescription(`**${r.nome || 'Registro'}**\nCategoria: **${found.categoria}**\nID: \`${r.id}\``);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`hallmgr_admin_edit_${r.id}`).setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`hallmgr_admin_delete_${r.id}`).setLabel('Remover').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        );

        return interaction.editReply({ embeds: [e], components: [row] });
    }
};