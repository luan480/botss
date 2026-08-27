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

const FILE = path.join(__dirname, 'historico.json');
const CATEGORIAS = ['liga', 'eventos', 'records', 'imperador'];
const CAMPOS_FIXOS = {
    liga: [
        ['nome', '🏆 Nome da liga', 'short'],
        ['ano', '📅 Ano', 'short'],
        ['descricao', '📝 Descrição', 'paragraph'],
        ['meses', '🗓️ Meses / vencedores', 'paragraph'],
        ['campeao', '🥇 Campeão', 'short'],
        ['vice', '🥈 Vice-campeão', 'short'],
        ['terceiro', '🥉 3º lugar', 'short'],
        ['premio', '🎁 Prêmio', 'paragraph'],
        ['participantes', '👥 Participantes', 'paragraph'],
        ['observacoes', '📌 Observações', 'paragraph'],
        ['imagem', '🖼️ Imagem / URL', 'short']
    ],
    eventos: [
        ['nome', '⚔️ Nome do evento', 'short'],
        ['vencedor', '🥇 Vencedor', 'short'],
        ['segundo', '🥈 2º lugar', 'short'],
        ['terceiro', '🥉 3º lugar', 'short'],
        ['participantes', '👥 Participantes', 'paragraph'],
        ['valor', '💰 Valor', 'short'],
        ['premio', '🎁 Prêmio', 'paragraph'],
        ['descricao', '📝 Descrição', 'paragraph'],
        ['data', '📅 Data', 'short'],
        ['horario', '🕐 Horário', 'short'],
        ['observacoes', '📌 Observações', 'paragraph'],
        ['imagem', '🖼️ Imagem / URL', 'short']
    ],
    records: [
        ['nome', '📊 Nome do record', 'short'],
        ['descricao', '📝 Descrição', 'paragraph'],
        ['linhas', '📈 Records', 'paragraph'],
        ['campeao', '🏆 Recordista', 'short'],
        ['valor', '📈 Valor', 'short'],
        ['premio', '🎁 Prêmio', 'paragraph'],
        ['observacoes', '📌 Observações', 'paragraph'],
        ['imagem', '🖼️ Imagem / URL', 'short']
    ],
    imperador: [
        ['nome', '👑 Nome do Imperador', 'short'],
        ['ano', '📅 Ano', 'short'],
        ['descricao', '📝 Descrição', 'paragraph'],
        ['meses', '🗓️ Meses / vencedores', 'paragraph'],
        ['campeao', '👑 Campeão', 'short'],
        ['vice', '🥈 Vice-campeão', 'short'],
        ['terceiro', '🥉 3º lugar', 'short'],
        ['premio', '🎁 Prêmio', 'paragraph'],
        ['participantes', '👥 Participantes', 'paragraph'],
        ['observacoes', '📌 Observações', 'paragraph'],
        ['imagem', '🖼️ Imagem / URL', 'short']
    ]
};

const texto = value => value == null ? '' : String(value).trim();
const limitar = (value, max = 1024) => {
    const s = texto(value);
    return s.length <= max ? s : `${s.slice(0, max - 3)}...`;
};
const isAdmin = i => Boolean(i.memberPermissions?.has(PermissionFlagsBits.Administrator));

function nomeRegistro(r) {
    return texto(r?.nome || r?.titulo || r?.temporada || r?.evento || r?.descricao || 'Registro sem nome');
}

function carregar() {
    const d = safeReadJson(FILE) || {};
    for (const c of CATEGORIAS) if (!Array.isArray(d[c])) d[c] = [];
    return d;
}

function localizar(d, categoria, id) {
    const lista = d[categoria] || [];
    const indice = lista.findIndex(r => r && String(r.id) === String(id));
    return { lista, indice, registro: indice >= 0 ? lista[indice] : null };
}

function valorCampo(r, key) {
    const v = r?.[key];
    if (v == null) return '';
    if (Array.isArray(v)) return v.join('\n');
    if (typeof v === 'object') return JSON.stringify(v, null, 2);
    return String(v);
}

function rotuloCampo(key) {
    return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).slice(0, 45);
}

function obterCampos(categoria, registro) {
    const fixos = CAMPOS_FIXOS[categoria] || [];
    const usados = new Set(fixos.map(([key]) => key));
    const extras = Object.keys(registro || {})
        .filter(key => key !== 'id' && !usados.has(key))
        .map(key => [key, `🧩 ${rotuloCampo(key)}`, typeof registro[key] === 'object' ? 'paragraph' : 'short']);
    return [...fixos, ...extras];
}

function paginas(categoria, registro) {
    const campos = obterCampos(categoria, registro);
    const resultado = [];
    for (let i = 0; i < campos.length; i += 5) resultado.push(campos.slice(i, i + 5));
    return resultado.length ? resultado : [[]];
}

function criarModal(categoria, id, registro, pagina) {
    const lista = paginas(categoria, registro);
    const campos = lista[pagina - 1] || [];
    const modal = new ModalBuilder()
        .setCustomId(`hall_edit:${categoria}:${id}:${pagina}:${lista.length}`)
        .setTitle(`✏️ ${categoria.toUpperCase()} • ${pagina}/${lista.length}`.slice(0, 45));

    for (const [key, label, type] of campos) {
        const input = new TextInputBuilder()
            .setCustomId(key.slice(0, 100))
            .setLabel(label.slice(0, 45))
            .setStyle(type === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(4000)
            .setPlaceholder('Vazio = manter • - = apagar');
        const atual = limitar(valorCampo(registro, key), 4000);
        if (atual) input.setValue(atual);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
    }
    return modal;
}

function aplicar(registro, key, value) {
    const v = texto(value);
    if (!v) return;
    if (v === '-') {
        delete registro[key];
        return;
    }
    if (key === 'meses' || key === 'linhas') {
        registro[key] = v.split('\n').map(x => x.trim()).filter(Boolean);
        return;
    }
    try {
        if (registro[key] && typeof registro[key] === 'object' && !Array.isArray(registro[key])) {
            registro[key] = JSON.parse(v);
            return;
        }
    } catch (_) {}
    registro[key] = v;
}

async function atualizarMural(guild) {
    try {
        const painel = require('./painel-ranking.js');
        if (typeof painel.atualizarMural === 'function') await painel.atualizarMural(guild);
    } catch (e) {
        console.error('[HALL] mural:', e);
    }
}

function criarEmbed(categoria, r) {
    const e = new EmbedBuilder()
        .setColor('#C9A227')
        .setTitle('🏛️ HALL DA FAMA — GERENCIAMENTO')
        .setDescription(`**${limitar(nomeRegistro(r), 256)}**\nCategoria: **${categoria.toUpperCase()}**`);
    const campos = obterCampos(categoria, r);
    for (const [key, label] of campos.slice(0, 25)) {
        e.addFields({ name: label.slice(0, 256), value: limitar(valorCampo(r, key) || 'Não informado'), inline: true });
    }
    return e.setFooter({ text: 'Somente administradores • edição por formulário' });
}

async function autocomplete(interaction) {
    if (!isAdmin(interaction)) return interaction.respond([]);
    const categoria = interaction.options.getString('categoria');
    if (!CATEGORIAS.includes(categoria)) return interaction.respond([]);
    const termo = texto(interaction.options.getString('registro')).toLowerCase();
    const d = carregar();
    return interaction.respond(d[categoria].filter(r => {
        const n = nomeRegistro(r).toLowerCase();
        const id = texto(r?.id).toLowerCase();
        return !termo || n.includes(termo) || id.includes(termo);
    }).slice(0, 25).map(r => ({ name: limitar(nomeRegistro(r), 100), value: String(r.id) })));
}

async function editar(interaction, categoria, id, pagina = 1) {
    const d = carregar();
    const found = localizar(d, categoria, id);
    if (!found.registro) return interaction.reply({ content: '❌ Registro não encontrado.', flags: MessageFlags.Ephemeral });
    return interaction.showModal(criarModal(categoria, id, found.registro, pagina));
}

async function processarModal(interaction) {
    const p = interaction.customId.split(':');
    const categoria = p[1];
    const id = p[2];
    const pagina = Number(p[3]);
    const totalInformado = Number(p[4]);
    if (!CATEGORIAS.includes(categoria) || !pagina) return interaction.reply({ content: '❌ Dados da edição inválidos.', flags: MessageFlags.Ephemeral });

    const d = carregar();
    const found = localizar(d, categoria, id);
    if (!found.registro) return interaction.reply({ content: '❌ Esse registro não existe mais.', flags: MessageFlags.Ephemeral });

    const lista = paginas(categoria, found.registro);
    const campos = lista[pagina - 1] || [];
    for (const [key] of campos) aplicar(found.registro, key, interaction.fields.getTextInputValue(key));

    try {
        if (safeWriteJson(FILE, d) === false) throw new Error('SAVE_FAILED');
    } catch (e) {
        console.error('[HALL] salvar:', e);
        return interaction.reply({ content: '❌ Falha ao salvar as alterações.', flags: MessageFlags.Ephemeral });
    }

    const total = paginas(categoria, found.registro).length;
    if (pagina < total) return interaction.showModal(criarModal(categoria, id, found.registro, pagina + 1));

    await atualizarMural(interaction.guild);
    return interaction.reply({ content: `✅ **${nomeRegistro(found.registro)}** foi atualizado completamente.`, flags: MessageFlags.Ephemeral });
}

async function confirmarRemocao(interaction, categoria, id) {
    const d = carregar();
    const found = localizar(d, categoria, id);
    if (!found.registro) return interaction.update({ content: '❌ Registro não encontrado.', embeds: [], components: [] });
    const nome = nomeRegistro(found.registro);
    found.lista.splice(found.indice, 1);
    try {
        if (safeWriteJson(FILE, d) === false) throw new Error('SAVE_FAILED');
    } catch (e) {
        console.error('[HALL] remoção:', e);
        return interaction.update({ content: '❌ Falha ao salvar a remoção.', embeds: [], components: [] });
    }
    await atualizarMural(interaction.guild);
    return interaction.update({ content: `🗑️ **${nome}** foi removido do Hall da Fama.`, embeds: [], components: [] });
}

async function remover(interaction, categoria, id) {
    const d = carregar();
    const found = localizar(d, categoria, id);
    if (!found.registro) return interaction.reply({ content: '❌ Registro não encontrado.', flags: MessageFlags.Ephemeral });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`hall_confirm_delete_${categoria}_${id}`).setLabel('Confirmar remoção').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('hall_cancel_delete').setLabel('Cancelar').setEmoji('❌').setStyle(ButtonStyle.Secondary)
    );
    return interaction.reply({
        content: `⚠️ **Confirma a remoção de ${nomeRegistro(found.registro)}?**`,
        embeds: [criarEmbed(categoria, found.registro)],
        components: [row],
        flags: MessageFlags.Ephemeral
    });
}

async function processarInteracao(interaction) {
    if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Apenas administradores podem gerenciar o Hall.', flags: MessageFlags.Ephemeral });

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('hall_edit:')) return processarModal(interaction);
        return;
    }
    if (!interaction.isButton()) return;

    if (interaction.customId === 'hall_cancel_delete') {
        return interaction.update({ content: '↩️ Remoção cancelada.', embeds: [], components: [] });
    }
    if (interaction.customId.startsWith('hall_confirm_delete_')) {
        const p = interaction.customId.split('_');
        return confirmarRemocao(interaction, p[3], p.slice(4).join('_'));
    }
    if (interaction.customId.startsWith('hall_edit_')) {
        const p = interaction.customId.split('_');
        return editar(interaction, p[2], p.slice(3).join('_'), 1);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hall-gerenciar')
        .setDescription('✏️ Edita ou remove registros do Hall da Fama.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('acao').setDescription('Ação').setRequired(true).addChoices(
            { name: '✏️ Editar', value: 'editar' },
            { name: '🗑️ Remover', value: 'remover' }
        ))
        .addStringOption(o => o.setName('categoria').setDescription('Categoria').setRequired(true).addChoices(
            { name: '🏆 Liga', value: 'liga' },
            { name: '⚔️ Eventos', value: 'eventos' },
            { name: '📊 Records', value: 'records' },
            { name: '👑 Imperador', value: 'imperador' }
        ))
        .addStringOption(o => o.setName('registro').setDescription('Digite parte do nome e selecione o registro.').setRequired(true).setAutocomplete(true)),
    autocomplete,
    async execute(interaction) {
        if (!isAdmin(interaction)) return interaction.reply({ content: '❌ Apenas administradores podem gerenciar o Hall.', flags: MessageFlags.Ephemeral });
        const acao = interaction.options.getString('acao');
        const categoria = interaction.options.getString('categoria');
        const id = interaction.options.getString('registro');
        if (acao === 'editar') return editar(interaction, categoria, id, 1);
        return remover(interaction, categoria, id);
    },
    processarInteracao
};