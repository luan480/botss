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
    const dados = safeReadJson(HISTORICO_PATH) || {};
    for (const categoria of CATEGORIAS) {
        if (!Array.isArray(dados[categoria])) dados[categoria] = [];
    }
    return dados;
}

function texto(valor) {
    return valor == null ? '' : String(valor).trim();
}

function limitar(valor, limite) {
    const valorTexto = texto(valor);
    return valorTexto.length <= limite ? valorTexto : valorTexto.slice(0, limite - 3) + '...';
}

function permitido(interaction) {
    return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
}

function nomeRegistro(registro) {
    return texto(registro?.nome || registro?.titulo || registro?.temporada || registro?.evento || registro?.descricao || 'Registro sem nome');
}

function encontrar(dados, categoria, id) {
    const lista = dados[categoria] || [];
    const indice = lista.findIndex(registro => registro && String(registro.id) === String(id));
    return { lista, indice, registro: indice >= 0 ? lista[indice] : null };
}

function campoAtual(registro, campo) {
    const valor = registro?.[campo];
    if (valor == null) return '';
    if (Array.isArray(valor)) return valor.join('\n');
    if (typeof valor === 'object') return JSON.stringify(valor);
    return String(valor);
}

function adicionarCampo(modal, id, label, estilo, maxLength, valor, required = false) {
    const input = new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(estilo)
        .setRequired(required)
        .setMaxLength(maxLength);
    const atual = limitar(valor, maxLength);
    if (atual) input.setValue(atual);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
}

function criarModalEdicao(categoria, id, registro) {
    const modal = new ModalBuilder()
        .setCustomId(`hall_edit_submit_${categoria}_${id}`)
        .setTitle(`✏️ Editar ${categoria}`.slice(0, 45));

    adicionarCampo(modal, 'nome', 'Nome', TextInputStyle.Short, 100, campoAtual(registro, 'nome'), true);

    if (categoria === 'liga' || categoria === 'imperador') {
        adicionarCampo(modal, 'ano', 'Ano', TextInputStyle.Short, 10, campoAtual(registro, 'ano'));
        adicionarCampo(modal, 'descricao', 'Descrição', TextInputStyle.Paragraph, 1000, campoAtual(registro, 'descricao'));
        adicionarCampo(modal, 'meses', 'Meses / vencedores', TextInputStyle.Paragraph, 1000, campoAtual(registro, 'meses'));
        return modal;
    }

    if (categoria === 'records') {
        adicionarCampo(modal, 'descricao', 'Descrição', TextInputStyle.Paragraph, 1000, campoAtual(registro, 'descricao'));
        adicionarCampo(modal, 'linhas', 'Records / linhas', TextInputStyle.Paragraph, 1000, campoAtual(registro, 'linhas'));
        return modal;
    }

    // Discord permite no máximo 5 componentes em um modal.
    // Os campos menos usados (participantes/valor/data/horário) continuam preservados.
    adicionarCampo(modal, 'vencedor', 'Vencedor', TextInputStyle.Short, 500, campoAtual(registro, 'vencedor'));
    adicionarCampo(modal, 'segundo', '2º lugar', TextInputStyle.Short, 500, campoAtual(registro, 'segundo'));
    adicionarCampo(modal, 'terceiro', '3º lugar', TextInputStyle.Short, 500, campoAtual(registro, 'terceiro'));
    adicionarCampo(modal, 'descricao', 'Descrição', TextInputStyle.Paragraph, 1000, campoAtual(registro, 'descricao'));

    return modal;
}

function criarEmbedResumo(categoria, registro) {
    const embed = new EmbedBuilder()
        .setColor('#C9A227')
        .setTitle('🏛️ Gerenciamento do Hall da Fama')
        .setDescription(`**${limitar(nomeRegistro(registro), 256)}**\nCategoria: **${categoria}**`);

    if (categoria === 'liga' || categoria === 'imperador') {
        embed.addFields(
            { name: '📅 Ano', value: campoAtual(registro, 'ano') || 'Não informado', inline: true },
            { name: '📝 Descrição', value: limitar(campoAtual(registro, 'descricao') || 'Não informado', 1000) },
            { name: '🏆 Meses / vencedores', value: limitar(campoAtual(registro, 'meses') || 'Não informado', 1000) }
        );
    } else if (categoria === 'records') {
        embed.addFields(
            { name: '📝 Descrição', value: limitar(campoAtual(registro, 'descricao') || 'Não informado', 1000) },
            { name: '📊 Records', value: limitar(campoAtual(registro, 'linhas') || 'Não informado', 1000) }
        );
    } else {
        embed.addFields(
            { name: '🥇 Vencedor', value: limitar(campoAtual(registro, 'vencedor') || 'Não informado', 500), inline: true },
            { name: '🥈 2º lugar', value: limitar(campoAtual(registro, 'segundo') || 'Não informado', 500), inline: true },
            { name: '🥉 3º lugar', value: limitar(campoAtual(registro, 'terceiro') || 'Não informado', 500), inline: true },
            { name: '👥 Participantes', value: limitar(campoAtual(registro, 'participantes') || 'Não informado', 1000) },
            { name: '💰 Valor / prêmio', value: limitar(campoAtual(registro, 'valor') || 'Não informado', 200), inline: true },
            { name: '📝 Descrição', value: limitar(campoAtual(registro, 'descricao') || 'Não informado', 1000) },
            { name: '📅 Data', value: campoAtual(registro, 'data') || 'Não informado', inline: true },
            { name: '🕐 Horário', value: campoAtual(registro, 'horario') || 'Não informado', inline: true }
        );
    }

    return embed;
}

async function atualizarMural(guild) {
    try {
        const painel = require('./painel-ranking.js');
        if (typeof painel.atualizarMural === 'function') await painel.atualizarMural(guild);
    } catch (erro) {
        console.error('[HALL] Falha ao atualizar mural:', erro);
    }
}

async function handler(interaction) {
    if (!permitido(interaction)) {
        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: '❌ Apenas administradores podem gerenciar o Hall.', flags: MessageFlags.Ephemeral });
        }
        return;
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'hall_manage_cancel') {
            return interaction.update({ content: '↩️ Remoção cancelada.', embeds: [], components: [] });
        }

        const partes = interaction.customId.split('_');
        if (partes[0] !== 'hall' || partes[1] !== 'manage') return;

        const acao = partes[2];
        const categoria = partes[3];
        const id = partes.slice(4).join('_');
        const dados = carregar();
        const encontrado = encontrar(dados, categoria, id);

        if (!encontrado.registro) {
            return interaction.reply({ content: '❌ Esse registro não existe mais.', flags: MessageFlags.Ephemeral });
        }

        if (acao === 'edit') {
            return interaction.showModal(criarModalEdicao(categoria, id, encontrado.registro));
        }

        if (acao === 'delete') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`hall_manage_confirm_${categoria}_${id}`).setLabel('Confirmar remoção').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('hall_manage_cancel').setLabel('Cancelar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
            );

            return interaction.update({
                content: `⚠️ **Confirma a remoção de ${limitar(nomeRegistro(encontrado.registro), 150)}?**\n\nEssa ação removerá o registro do Hall da Fama.`,
                embeds: [],
                components: [row]
            });
        }

        if (acao === 'confirm') {
            const nome = nomeRegistro(encontrado.registro);
            encontrado.lista.splice(encontrado.indice, 1);
            if (!safeWriteJson(HISTORICO_PATH, dados)) {
                return interaction.reply({ content: '❌ Não consegui salvar a remoção no historico.json.', flags: MessageFlags.Ephemeral });
            }
            await atualizarMural(interaction.guild);
            return interaction.update({ content: `✅ **${nome}** foi removido do Hall da Fama.`, embeds: [], components: [] });
        }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('hall_edit_submit_')) {
        const partes = interaction.customId.split('_');
        const categoria = partes[3];
        const id = partes.slice(4).join('_');
        const dados = carregar();
        const encontrado = encontrar(dados, categoria, id);

        if (!encontrado.registro) {
            return interaction.reply({ content: '❌ Esse registro não existe mais.', flags: MessageFlags.Ephemeral });
        }

        const obter = campo => texto(interaction.fields.getTextInputValue(campo));
        const registro = encontrado.registro;
        registro.nome = obter('nome') || registro.nome;

        if (categoria === 'liga' || categoria === 'imperador') {
            const ano = obter('ano');
            const descricao = obter('descricao');
            const meses = obter('meses');
            if (ano) registro.ano = ano; else delete registro.ano;
            if (descricao) registro.descricao = descricao; else delete registro.descricao;
            registro.meses = meses ? meses.split('\n').map(v => v.trim()).filter(Boolean) : [];
        } else if (categoria === 'records') {
            const descricao = obter('descricao');
            const linhas = obter('linhas');
            if (descricao) registro.descricao = descricao; else delete registro.descricao;
            registro.linhas = linhas ? linhas.split('\n').map(v => v.trim()).filter(Boolean) : [];
        } else {
            for (const campo of ['vencedor', 'segundo', 'terceiro', 'descricao']) {
                const valor = obter(campo);
                registro[campo] = valor || null;
            }
        }

        if (!safeWriteJson(HISTORICO_PATH, dados)) {
            return interaction.reply({ content: '❌ Não consegui salvar a edição no historico.json.', flags: MessageFlags.Ephemeral });
        }

        await atualizarMural(interaction.guild);
        return interaction.reply({ content: `✅ Registro **${nomeRegistro(registro)}** atualizado com sucesso.`, flags: MessageFlags.Ephemeral });
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hall-gerenciar')
        .setDescription('✏️ Edita ou remove um registro do Hall da Fama.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option => option
            .setName('categoria')
            .setDescription('Categoria do registro.')
            .setRequired(true)
            .addChoices(
                { name: '🏆 Liga', value: 'liga' },
                { name: '⚔️ Eventos', value: 'eventos' },
                { name: '📊 Records', value: 'records' },
                { name: '👑 Imperador', value: 'imperador' }
            ))
        .addStringOption(option => option
            .setName('registro')
            .setDescription('Digite parte do nome e escolha o registro.')
            .setRequired(true)
            .setAutocomplete(true)),

    async autocomplete(interaction) {
        if (!permitido(interaction)) return interaction.respond([]);

        const categoria = interaction.options.getString('categoria');
        if (!CATEGORIAS.includes(categoria)) return interaction.respond([]);

        const termo = texto(interaction.options.getString('registro')).toLowerCase();
        const dados = carregar();
        const resultados = (dados[categoria] || [])
            .filter(registro => {
                const nome = nomeRegistro(registro).toLowerCase();
                const id = texto(registro?.id).toLowerCase();
                return !termo || nome.includes(termo) || id.includes(termo);
            })
            .slice(0, 25)
            .map(registro => ({ name: limitar(nomeRegistro(registro), 100), value: String(registro.id) }));

        return interaction.respond(resultados);
    },

    async execute(interaction) {
        if (!permitido(interaction)) {
            return interaction.reply({ content: '❌ Apenas administradores podem gerenciar o Hall.', flags: MessageFlags.Ephemeral });
        }

        const categoria = interaction.options.getString('categoria');
        const id = interaction.options.getString('registro');
        const dados = carregar();
        const encontrado = encontrar(dados, categoria, id);

        if (!encontrado.registro) {
            return interaction.reply({ content: '❌ Registro não encontrado. Escolha um registro pela lista de sugestões.', flags: MessageFlags.Ephemeral });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`hall_manage_edit_${categoria}_${id}`).setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`hall_manage_delete_${categoria}_${id}`).setLabel('Remover').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({
            embeds: [criarEmbedResumo(categoria, encontrado.registro)],
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    },

    handler
};
