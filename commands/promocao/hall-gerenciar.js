const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const HISTORICO_PATH = path.join(__dirname, 'historico.json');
const CATEGORIAS = ['liga', 'eventos', 'records', 'imperador'];

function carregar() {
    const d = safeReadJson(HISTORICO_PATH) || {};
    for (const c of CATEGORIAS) if (!Array.isArray(d[c])) d[c] = [];
    return d;
}

function texto(v) {
    return v === null || v === undefined ? '' : String(v).trim();
}

function limitar(v, n) {
    const s = texto(v);
    return s.length <= n ? s : s.slice(0, n - 3) + '...';
}

function permitido(interaction) {
    return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function encontrar(d, categoria, id) {
    const lista = d[categoria] || [];
    const indice = lista.findIndex(r => r && typeof r === 'object' && String(r.id) === String(id));
    return { lista, indice, registro: indice >= 0 ? lista[indice] : null };
}

async function atualizarMural(guild) {
    try {
        const painel = require('./painel-ranking.js');
        if (typeof painel.atualizarMural === 'function') await painel.atualizarMural(guild);
    } catch (e) {
        console.error('[HALL] Falha ao atualizar mural:', e);
    }
}

function valorCampo(r, chave) {
    const v = r?.[chave];
    return v === null || v === undefined ? '' : String(v);
}

function modalEditar(categoria, id, r) {
    const modal = new ModalBuilder()
        .setCustomId(`hall_edit_submit_${categoria}_${id}`)
        .setTitle('✏️ Editar registro do Hall');

    const campos = [
        ['nome', 'Nome', TextInputStyle.Short, 100, true],
        ['vencedor', 'Vencedor', TextInputStyle.Short, 500, false],
        ['segundo', '2º lugar', TextInputStyle.Short, 500, false],
        ['terceiro', '3º lugar', TextInputStyle.Short, 500, false],
        ['descricao', 'Descrição', TextInputStyle.Paragraph, 1000, false]
    ];

    for (const [idCampo, label, estilo, max, obrigatorio] of campos) {
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(idCampo)
                .setLabel(label)
                .setStyle(estilo)
                .setRequired(obrigatorio)
                .setMaxLength(max)
                .setValue(limitar(valorCampo(r, idCampo), max))
        ));
    }
    return modal;
}

function embedResumo(categoria, r) {
    const e = new EmbedBuilder()
        .setColor('#C9A227')
        .setTitle('🏛️ Gerenciamento do Hall da Fama')
        .setDescription(`**${limitar(r.nome || 'Sem nome', 256)}**\nCategoria: **${categoria}**\nID: \`${r.id}\``)
        .addFields(
            { name: '🥇 Vencedor', value: limitar(r.vencedor || 'Não informado', 500), inline: true },
            { name: '🥈 2º lugar', value: limitar(r.segundo || 'Não informado', 500), inline: true },
            { name: '🥉 3º lugar', value: limitar(r.terceiro || 'Não informado', 500), inline: true },
            { name: '📝 Descrição', value: limitar(r.descricao || 'Não informado', 1000), inline: false }
        );
    return e;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hall-gerenciar')
        .setDescription('✏️ Edita ou remove um registro do Hall da Fama.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('categoria').setDescription('Categoria do registro.').setRequired(true).addChoices(
            { name: '🏆 Liga', value: 'liga' },
            { name: '⚔️ Eventos', value: 'eventos' },
            { name: '📊 Records', value: 'records' },
            { name: '👑 Imperador', value: 'imperador' }
        ))
        .addStringOption(o => o.setName('id').setDescription('ID do registro exibido no Hall.').setRequired(true)),

    async execute(interaction) {
        if (!permitido(interaction)) return interaction.reply({ content: '❌ Apenas administradores podem gerenciar o Hall.', flags: MessageFlags.Ephemeral });

        const categoria = interaction.options.getString('categoria');
        const id = interaction.options.getString('id');
        const d = carregar();
        const achado = encontrar(d, categoria, id);

        if (!achado.registro) {
            return interaction.reply({ content: `❌ Não encontrei o registro \`${id}\` na categoria **${categoria}**.`, flags: MessageFlags.Ephemeral });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`hall_manage_edit_${categoria}_${id}`).setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`hall_manage_delete_${categoria}_${id}`).setLabel('Remover').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({ embeds: [embedResumo(categoria, achado.registro)], components: [row], flags: MessageFlags.Ephemeral });
    }
};

async function handler(interaction) {
    if (!permitido(interaction)) return interaction.reply({ content: '❌ Apenas administradores podem gerenciar o Hall.', flags: MessageFlags.Ephemeral });
    const parts = texto(interaction.customId).split('_');

    if (interaction.isButton() && parts[0] === 'hall' && parts[1] === 'manage') {
        const acao = parts[2], categoria = parts[3], id = parts.slice(4).join('_');
        const d = carregar();
        const achado = encontrar(d, categoria, id);
        if (!achado.registro) return interaction.reply({ content: '❌ Esse registro não existe mais.', flags: MessageFlags.Ephemeral });

        if (acao === 'edit') return interaction.showModal(modalEditar(categoria, id, achado.registro));

        if (acao === 'delete') {
            const confirm = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`hall_manage_confirm_${categoria}_${id}`).setLabel('Confirmar remoção').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('hall_manage_cancel').setLabel('Cancelar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
            );
            return interaction.update({ content: `⚠️ **Confirma a remoção de ${limitar(achado.registro.nome || 'este registro', 150)}?**\nEssa ação remove o registro do Hall da Fama.`, embeds: [], components: [confirm] });
        }

        if (acao === 'confirm') {
            achado.lista.splice(achado.indice, 1);
            safeWriteJson(HISTORICO_PATH, d);
            await atualizarMural(interaction.guild);
            return interaction.update({ content: '✅ Registro removido do Hall da Fama e mural atualizado.', embeds: [], components: [] });
        }
    }

    if (interaction.isButton() && interaction.customId === 'hall_manage_cancel') {
        return interaction.update({ content: '↩️ Remoção cancelada.', embeds: [], components: [] });
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('hall_edit_submit_')) {
        const parts2 = interaction.customId.split('_');
        const categoria = parts2[3];
        const id = parts2.slice(4).join('_');
        const d = carregar();
        const achado = encontrar(d, categoria, id);
        if (!achado.registro) return interaction.reply({ content: '❌ Esse registro não existe mais.', flags: MessageFlags.Ephemeral });

        for (const chave of ['nome', 'vencedor', 'segundo', 'terceiro', 'descricao']) {
            const valor = texto(interaction.fields.getTextInputValue(chave));
            achado.registro[chave] = valor || null;
        }

        safeWriteJson(HISTORICO_PATH, d);
        await atualizarMural(interaction.guild);
        return interaction.reply({ content: `✅ Registro **${achado.registro.nome || id}** atualizado com sucesso.`, flags: MessageFlags.Ephemeral });
    }
}

module.exports.handler = handler;
