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

function texto(valor) {
    return valor == null ? '' : String(valor).trim();
}

function limitar(valor, limite = 1024) {
    const valorTexto = texto(valor);
    return valorTexto.length <= limite
        ? valorTexto
        : `${valorTexto.slice(0, limite - 3)}...`;
}

function isAdmin(interaction) {
    return Boolean(
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        )
    );
}

function nomeRegistro(registro) {
    return texto(
        registro?.nome ||
        registro?.titulo ||
        registro?.temporada ||
        registro?.evento ||
        registro?.descricao ||
        'Registro sem nome'
    );
}

function carregarHistorico() {
    const dados = safeReadJson(FILE) || {};

    for (const categoria of CATEGORIAS) {
        if (!Array.isArray(dados[categoria])) {
            dados[categoria] = [];
        }
    }

    return dados;
}

function encontrarRegistro(dados, categoria, id) {
    const registros = dados[categoria] || [];
    const indice = registros.findIndex(
        registro => registro && String(registro.id) === String(id)
    );

    return {
        registros,
        indice,
        registro: indice >= 0 ? registros[indice] : null
    };
}

function valorCampo(registro, campo) {
    const valor = registro?.[campo];

    if (valor == null) return '';
    if (Array.isArray(valor)) return valor.join('\n');
    if (typeof valor === 'object') return JSON.stringify(valor, null, 2);

    return String(valor);
}

function campoEmbed(nome, valor, inline = false) {
    return {
        name: nome,
        value: limitar(valor || 'Não informado'),
        inline
    };
}

function criarEmbed(categoria, registro) {
    const embed = new EmbedBuilder()
        .setColor('#C9A227')
        .setTitle('🏛️ HALL DA FAMA — GERENCIAMENTO')
        .setDescription(
            `**${limitar(nomeRegistro(registro), 256)}**\n` +
            `Categoria: **${categoria.toUpperCase()}**`
        );

    if (categoria === 'eventos') {
        embed.addFields(
            campoEmbed('🥇 VENCEDOR', valorCampo(registro, 'vencedor'), true),
            campoEmbed('🥈 2º LUGAR', valorCampo(registro, 'segundo'), true),
            campoEmbed('🥉 3º LUGAR', valorCampo(registro, 'terceiro'), true),
            campoEmbed('👥 PARTICIPANTES', valorCampo(registro, 'participantes'), true),
            campoEmbed('💰 VALOR', valorCampo(registro, 'valor'), true),
            campoEmbed('🎁 PRÊMIO', valorCampo(registro, 'premio'), true),
            campoEmbed('📅 DATA', valorCampo(registro, 'data'), true),
            campoEmbed('🕐 HORÁRIO', valorCampo(registro, 'horario'), true),
            campoEmbed('📝 DESCRIÇÃO', valorCampo(registro, 'descricao')),
            campoEmbed('📌 OBSERVAÇÕES', valorCampo(registro, 'observacoes')),
            campoEmbed('🖼️ IMAGEM', valorCampo(registro, 'imagem'))
        );
    } else if (categoria === 'liga' || categoria === 'imperador') {
        embed.addFields(
            campoEmbed('📅 ANO', valorCampo(registro, 'ano'), true),
            campoEmbed('📝 DESCRIÇÃO', valorCampo(registro, 'descricao')),
            campoEmbed('🗓️ MESES / VENCEDORES', valorCampo(registro, 'meses'))
        );
    } else {
        embed.addFields(
            campoEmbed('📝 DESCRIÇÃO', valorCampo(registro, 'descricao')),
            campoEmbed('📊 RECORDS', valorCampo(registro, 'linhas'))
        );
    }

    return embed.setFooter({
        text: 'Somente administradores • gerenciamento do Hall da Fama'
    });
}

function criarBotoes(categoria, id) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`hall_edit_${categoria}_${id}`)
            .setLabel('Editar')
            .setEmoji('✏️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`hall_delete_${categoria}_${id}`)
            .setLabel('Remover')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger)
    );
}

function criarModal(categoria, id, registro, pagina = 1) {
    const modal = new ModalBuilder()
        .setCustomId(`hall_edit_submit_${categoria}_${id}_${pagina}`)
        .setTitle(`✏️ Editar ${categoria}`);

    const campos = categoria === 'eventos'
        ? [
            ['nome', 'Nome', TextInputStyle.Short, 100],
            ['vencedor', 'Vencedor', TextInputStyle.Short, 500],
            ['segundo', '2º lugar', TextInputStyle.Short, 500],
            ['terceiro', '3º lugar', TextInputStyle.Short, 500],
            ['descricao', 'Descrição', TextInputStyle.Paragraph, 1000]
        ]
        : categoria === 'liga' || categoria === 'imperador'
            ? [
                ['nome', 'Nome', TextInputStyle.Short, 100],
                ['ano', 'Ano', TextInputStyle.Short, 10],
                ['descricao', 'Descrição', TextInputStyle.Paragraph, 1000],
                ['meses', 'Meses / vencedores', TextInputStyle.Paragraph, 1000]
            ]
            : [
                ['nome', 'Nome', TextInputStyle.Short, 100],
                ['descricao', 'Descrição', TextInputStyle.Paragraph, 1000],
                ['linhas', 'Records', TextInputStyle.Paragraph, 1000]
            ];

    for (const [campo, label, estilo, maxLength] of campos) {
        const input = new TextInputBuilder()
            .setCustomId(campo)
            .setLabel(label)
            .setStyle(estilo)
            .setRequired(false)
            .setMaxLength(maxLength);

        const atual = limitar(valorCampo(registro, campo), maxLength);
        if (atual) input.setValue(atual);

        modal.addComponents(
            new ActionRowBuilder().addComponents(input)
        );
    }

    return modal;
}

function atualizarCampo(registro, campo, valor) {
    const novoValor = texto(valor);

    // Vazio mantém o valor atual para evitar apagar dados antigos por acidente.
    if (!novoValor) return;

    if (campo === 'meses' || campo === 'linhas') {
        registro[campo] = novoValor
            .split('\n')
            .map(linha => linha.trim())
            .filter(Boolean);
        return;
    }

    registro[campo] = novoValor;
}

async function atualizarMural(guild) {
    try {
        const painel = require('./painel-ranking.js');

        if (typeof painel.atualizarMural === 'function') {
            await painel.atualizarMural(guild);
        }
    } catch (erro) {
        console.error('[HALL] Erro ao atualizar mural:', erro);
    }
}

async function autocomplete(interaction) {
    if (!isAdmin(interaction)) {
        return interaction.respond([]);
    }

    const categoria = interaction.options.getString('categoria');

    if (!CATEGORIAS.includes(categoria)) {
        return interaction.respond([]);
    }

    const termo = texto(
        interaction.options.getString('registro')
    ).toLowerCase();

    const dados = carregarHistorico();

    const resultados = dados[categoria]
        .filter(registro => {
            const nome = nomeRegistro(registro).toLowerCase();
            const id = texto(registro?.id).toLowerCase();

            return (
                !termo ||
                nome.includes(termo) ||
                id.includes(termo)
            );
        })
        .slice(0, 25)
        .map(registro => ({
            name: limitar(nomeRegistro(registro), 100),
            value: String(registro.id)
        }));

    return interaction.respond(resultados);
}

async function executarEdicao(interaction, categoria, id) {
    const dados = carregarHistorico();
    const encontrado = encontrarRegistro(dados, categoria, id);

    if (!encontrado.registro) {
        return interaction.reply({
            content: '❌ Registro não encontrado.',
            flags: MessageFlags.Ephemeral
        });
    }

    const modal = criarModal(
        categoria,
        id,
        encontrado.registro
    );

    return interaction.showModal(modal);
}

async function executarRemocao(interaction, categoria, id) {
    const dados = carregarHistorico();
    const encontrado = encontrarRegistro(dados, categoria, id);

    if (!encontrado.registro) {
        return interaction.reply({
            content: '❌ Registro não encontrado.',
            flags: MessageFlags.Ephemeral
        });
    }

    const confirmar = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`hall_confirm_delete_${categoria}_${id}`)
            .setLabel('Confirmar remoção')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('hall_cancel_delete')
            .setLabel('Cancelar')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
        embeds: [criarEmbed(categoria, encontrado.registro)],
        content:
            `⚠️ **Confirma a remoção de ${nomeRegistro(encontrado.registro)}?**`,
        components: [confirmar],
        flags: MessageFlags.Ephemeral
    });
}

async function confirmarRemocao(interaction, categoria, id) {
    const dados = carregarHistorico();
    const encontrado = encontrarRegistro(dados, categoria, id);

    if (!encontrado.registro) {
        return interaction.update({
            content: '❌ Registro não encontrado.',
            embeds: [],
            components: []
        });
    }

    const nome = nomeRegistro(encontrado.registro);

    encontrado.registros.splice(encontrado.indice, 1);

    const salvo = safeWriteJson(FILE, dados);

    if (salvo === false) {
        return interaction.update({
            content: '❌ Falha ao salvar a remoção.',
            embeds: [],
            components: []
        });
    }

    await atualizarMural(interaction.guild);

    return interaction.update({
        content: `🗑️ **${nome}** foi removido do Hall da Fama.`,
        embeds: [],
        components: []
    });
}

async function processarModal(interaction) {
    const partes = interaction.customId.split('_');
    const categoria = partes[3];
    const id = partes.slice(4, -1).join('_');

    if (!CATEGORIAS.includes(categoria)) {
        return interaction.reply({
            content: '❌ Categoria inválida.',
            flags: MessageFlags.Ephemeral
        });
    }

    const dados = carregarHistorico();
    const encontrado = encontrarRegistro(dados, categoria, id);

    if (!encontrado.registro) {
        return interaction.reply({
            content: '❌ Esse registro não existe mais.',
            flags: MessageFlags.Ephemeral
        });
    }

    const campos = categoria === 'eventos'
        ? ['nome', 'vencedor', 'segundo', 'terceiro', 'descricao']
        : categoria === 'liga' || categoria === 'imperador'
            ? ['nome', 'ano', 'descricao', 'meses']
            : ['nome', 'descricao', 'linhas'];

    for (const campo of campos) {
        atualizarCampo(
            encontrado.registro,
            campo,
            interaction.fields.getTextInputValue(campo)
        );
    }

    const salvo = safeWriteJson(FILE, dados);

    if (salvo === false) {
        return interaction.reply({
            content: '❌ Falha ao salvar as alterações.',
            flags: MessageFlags.Ephemeral
        });
    }

    await atualizarMural(interaction.guild);

    return interaction.reply({
        content:
            `✅ **${nomeRegistro(encontrado.registro)}** foi atualizado com sucesso.`,
        flags: MessageFlags.Ephemeral
    });
}

async function processarInteracao(interaction) {
    if (!isAdmin(interaction)) {
        return interaction.reply({
            content: '❌ Apenas administradores podem gerenciar o Hall.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'hall_cancel_delete') {
            return interaction.update({
                content: '↩️ Remoção cancelada.',
                embeds: [],
                components: []
            });
        }

        const partes = interaction.customId.split('_');

        if (partes[0] !== 'hall') return;

        if (partes[1] === 'edit') {
            const categoria = partes[2];
            const id = partes.slice(3).join('_');
            return executarEdicao(interaction, categoria, id);
        }

        if (partes[1] === 'delete') {
            const categoria = partes[2];
            const id = partes.slice(3).join('_');
            return executarRemocao(interaction, categoria, id);
        }

        if (partes[1] === 'confirm') {
            const categoria = partes[3];
            const id = partes.slice(4).join('_');
            return confirmarRemocao(interaction, categoria, id);
        }
    }

    if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith('hall_edit_submit_')
    ) {
        return processarModal(interaction);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hall-gerenciar')
        .setDescription('✏️ Edita ou remove registros do Hall da Fama.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addStringOption(option =>
            option
                .setName('acao')
                .setDescription('O que deseja fazer?')
                .setRequired(true)
                .addChoices(
                    {
                        name: '✏️ Editar',
                        value: 'editar'
                    },
                    {
                        name: '🗑️ Remover',
                        value: 'remover'
                    }
                )
        )

        .addStringOption(option =>
            option
                .setName('categoria')
                .setDescription('Categoria do Hall.')
                .setRequired(true)
                .addChoices(
                    {
                        name: '🏆 Liga',
                        value: 'liga'
                    },
                    {
                        name: '⚔️ Eventos',
                        value: 'eventos'
                    },
                    {
                        name: '📊 Records',
                        value: 'records'
                    },
                    {
                        name: '👑 Imperador',
                        value: 'imperador'
                    }
                )
        )

        .addStringOption(option =>
            option
                .setName('registro')
                .setDescription('Digite parte do nome e selecione o registro.')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        return autocomplete(interaction);
    },

    async execute(interaction) {
        if (!isAdmin(interaction)) {
            return interaction.reply({
                content: '❌ Apenas administradores podem gerenciar o Hall.',
                flags: MessageFlags.Ephemeral
            });
        }

        const acao = interaction.options.getString('acao');
        const categoria = interaction.options.getString('categoria');
        const id = interaction.options.getString('registro');

        const dados = carregarHistorico();
        const encontrado = encontrarRegistro(dados, categoria, id);

        if (!encontrado.registro) {
            return interaction.reply({
                content:
                    '❌ Registro não encontrado. Escolha um registro pela lista de sugestões.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (acao === 'editar') {
            return executarEdicao(interaction, categoria, id);
        }

        return executarRemocao(interaction, categoria, id);
    },

    processarInteracao
};