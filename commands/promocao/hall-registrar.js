/* ========================================================================
   ARQUIVO: commands/promocao/hall-registrar.js

   HALL DA FAMA — REGISTRO

   USO:
   /hall-registrar registrar

   O gerenciamento de EDITAR/REMOVER acontece diretamente dentro do
   Hall da Fama, sem necessidade de digitar ID.
   ======================================================================== */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require('discord.js');

const path = require('path');

const {
    safeReadJson,
    safeWriteJson
} = require('../liga/utils/helpers.js');


// ========================================================================
// CAMINHO
// ========================================================================

const HISTORICO_PATH = path.join(
    __dirname,
    'historico.json'
);


// ========================================================================
// CATEGORIAS
// ========================================================================

const CATEGORIAS = {
    liga: '🏆 Liga',
    eventos: '⚔️ Eventos',
    records: '📊 Records',
    imperador: '👑 Imperador'
};


// ========================================================================
// TIPOS
// ========================================================================

const TIPOS = {
    semanal: '📅 Evento semanal',
    individual: '👤 Evento individual',
    campeonato: '🏆 Campeonato',
    recorde: '📊 Recorde',
    destaque: '🌟 Destaque especial'
};


// ========================================================================
// CORES
// ========================================================================

const CORES = {
    liga: '#3498DB',
    eventos: '#95A5A6',
    records: '#E74C3C',
    imperador: '#F1C40F'
};


// ========================================================================
// FUNÇÕES
// ========================================================================

function limpar(valor) {
    if (valor === null || valor === undefined) {
        return null;
    }

    const texto = String(valor).trim();

    return texto || null;
}


function validarImagem(valor) {
    const texto = limpar(valor);

    if (!texto) {
        return null;
    }

    try {
        const url = new URL(texto);

        if (
            url.protocol !== 'http:' &&
            url.protocol !== 'https:'
        ) {
            return null;
        }

        return texto;
    } catch {
        return null;
    }
}


function carregarHistorico() {
    const dados = safeReadJson(HISTORICO_PATH);

    const historico =
        dados &&
        typeof dados === 'object'
            ? dados
            : {};

    if (!Array.isArray(historico.liga)) {
        historico.liga = [];
    }

    if (!Array.isArray(historico.eventos)) {
        historico.eventos = [];
    }

    if (!Array.isArray(historico.records)) {
        historico.records = [];
    }

    if (!Array.isArray(historico.imperador)) {
        historico.imperador = [];
    }

    if (typeof historico.destaque !== 'string') {
        historico.destaque = '';
    }

    if (
        !historico.mural ||
        typeof historico.mural !== 'object'
    ) {
        historico.mural = null;
    }

    return historico;
}


function atualizarDestaque(historico) {
    const destaques = [];

    for (const categoria of Object.keys(CATEGORIAS)) {
        const registros = historico[categoria] || [];

        for (const registro of registros) {
            if (
                registro &&
                typeof registro === 'object' &&
                registro.tipo === 'destaque'
            ) {
                destaques.push(registro);
            }
        }
    }

    if (!destaques.length) {
        historico.destaque = '';
        return;
    }

    const ultimo = destaques[destaques.length - 1];
    const partes = [];

    partes.push(`🌟 **${ultimo.nome || 'Destaque'}**`);

    if (ultimo.vencedor) {
        partes.push(ultimo.vencedor);
    }

    if (ultimo.descricao) {
        partes.push(ultimo.descricao);
    }

    historico.destaque = partes.join(' — ');
}


async function atualizarMural(guild) {
    try {
        const painelRanking = require('./painel-ranking.js');

        if (
            painelRanking &&
            typeof painelRanking.atualizarMural === 'function'
        ) {
            const resultado =
                await painelRanking.atualizarMural(guild);

            return Boolean(resultado);
        }
    } catch (erro) {
        console.error(
            '[HALL] Erro ao atualizar mural:',
            erro
        );
    }

    return false;
}


// ========================================================================
// COMANDO
// ========================================================================

module.exports = {

    data:
        new SlashCommandBuilder()

            .setName('hall-registrar')

            .setDescription(
                '🏛️ Administração do Hall da Fama.'
            )

            .setDefaultMemberPermissions(
                PermissionFlagsBits.Administrator
            )

            .addSubcommand(sub =>
                sub
                    .setName('registrar')
                    .setDescription(
                        '🏛️ Registra um novo evento no Hall.'
                    )

                    // ----------------------------------------------------
                    // CATEGORIA
                    // ----------------------------------------------------

                    .addStringOption(option =>
                        option
                            .setName('categoria')
                            .setDescription(
                                'Categoria do registro.'
                            )
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

                    // ----------------------------------------------------
                    // TIPO
                    // ----------------------------------------------------

                    .addStringOption(option =>
                        option
                            .setName('tipo')
                            .setDescription(
                                'Tipo do registro.'
                            )
                            .setRequired(true)
                            .addChoices(

                                {
                                    name: '📅 Evento semanal',
                                    value: 'semanal'
                                },

                                {
                                    name: '👤 Evento individual',
                                    value: 'individual'
                                },

                                {
                                    name: '🏆 Campeonato',
                                    value: 'campeonato'
                                },

                                {
                                    name: '📊 Recorde',
                                    value: 'recorde'
                                },

                                {
                                    name: '🌟 Destaque especial',
                                    value: 'destaque'
                                }

                            )
                    )

                    // ----------------------------------------------------
                    // NOME
                    // ----------------------------------------------------

                    .addStringOption(option =>
                        option
                            .setName('nome')
                            .setDescription(
                                'Nome do evento.'
                            )
                            .setRequired(true)
                            .setMaxLength(100)
                    )

                    // ----------------------------------------------------
                    // PARTICIPANTES
                    // ----------------------------------------------------

                    .addStringOption(option =>
                        option
                            .setName('participantes')
                            .setDescription(
                                'Marque todos os participantes.'
                            )
                            .setRequired(false)
                            .setMaxLength(1000)
                    )

                    // ----------------------------------------------------
                    // VENCEDOR
                    // ----------------------------------------------------

                    .addStringOption(option =>
                        option
                            .setName('vencedor')
                            .setDescription(
                                'Marque o vencedor/equipe vencedora.'
                            )
                            .setRequired(false)
                            .setMaxLength(500)
                    )

                    // ----------------------------------------------------
                    // SEGUNDO
                    // ----------------------------------------------------

                    .addStringOption(option =>
                        option
                            .setName('segundo')
                            .setDescription(
                                'Marque o segundo colocado/equipe.'
                            )
                            .setRequired(false)
                            .setMaxLength(500)
                    )

                    // ----------------------------------------------------
                    // TERCEIRO
                    // ----------------------------------------------------

                    .addStringOption(option =>
                        option
                            .setName('terceiro')
                            .setDescription(
                                'Marque o terceiro colocado/equipe.'
                            )
                            .setRequired(false)
                            .setMaxLength(500)
                    )

                    // ----------------------------------------------------
                    // PRÊMIO
                    // ----------------------------------------------------

                    .addStringOption(option =>
                        option
                            .setName('premio')
                            .setDescription(
                                'Prêmio recebido.'
                            )
                            .setRequired(false)
                            .setMaxLength(300)
                    )

                    // ----------------------------------------------------
                    // VALOR
                    // ----------------------------------------------------

                    .addIntegerOption(option =>
                        option
                            .setName('valor')
                            .setDescription(
                                'Valor numérico do recorde/prêmio.'
                            )
                            .setRequired(false)
                            .setMinValue(0)
                    )

                    // ----------------------------------------------------
                    // DESCRIÇÃO
                    // ----------------------------------------------------

                    .addStringOption(option =>
                        option
                            .setName('descricao')
                            .setDescription(
                                'Descrição do evento.'
                            )
                            .setRequired(false)
                            .setMaxLength(1000)
                    )

                    // ----------------------------------------------------
                    // OBSERVAÇÕES
                    // ----------------------------------------------------

                    .addStringOption(option =>
                        option
                            .setName('observacoes')
                            .setDescription(
                                'Informações extras.'
                            )
                            .setRequired(false)
                            .setMaxLength(1000)
                    )

                    // ----------------------------------------------------
                    // IMAGEM
                    // ----------------------------------------------------

                    .addStringOption(option =>
                        option
                            .setName('imagem')
                            .setDescription(
                                'URL da imagem do evento.'
                            )
                            .setRequired(false)
                            .setMaxLength(1000)
                    )

                    // ----------------------------------------------------
                    // DATA
                    // ----------------------------------------------------

                    .addStringOption(option =>
                        option
                            .setName('data')
                            .setDescription(
                                'Data do evento.'
                            )
                            .setRequired(false)
                            .setMaxLength(30)
                    )
            ),


    // ====================================================================
    // EXECUTE
    // ====================================================================

    async execute(interaction) {

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {

            const subcomando =
                interaction.options.getSubcommand();

            if (subcomando !== 'registrar') {

                return interaction.editReply({
                    content:
                        '❌ Esta operação é administrada diretamente pelo Hall.'
                });

            }

            const categoria =
                interaction.options.getString(
                    'categoria'
                );

            const tipo =
                interaction.options.getString(
                    'tipo'
                );

            const nome =
                limpar(
                    interaction.options.getString(
                        'nome'
                    )
                );

            const participantes =
                limpar(
                    interaction.options.getString(
                        'participantes'
                    )
                );

            const vencedor =
                limpar(
                    interaction.options.getString(
                        'vencedor'
                    )
                );

            const segundo =
                limpar(
                    interaction.options.getString(
                        'segundo'
                    )
                );

            const terceiro =
                limpar(
                    interaction.options.getString(
                        'terceiro'
                    )
                );

            const premio =
                limpar(
                    interaction.options.getString(
                        'premio'
                    )
                );

            const valor =
                interaction.options.getInteger(
                    'valor'
                );

            const descricao =
                limpar(
                    interaction.options.getString(
                        'descricao'
                    )
                );

            const observacoes =
                limpar(
                    interaction.options.getString(
                        'observacoes'
                    )
                );

            const imagemBruta =
                limpar(
                    interaction.options.getString(
                        'imagem'
                    )
                );

            const imagem =
                validarImagem(
                    imagemBruta
                );

            if (
                imagemBruta &&
                !imagem
            ) {

                return interaction.editReply({
                    content:
                        '❌ A URL da imagem é inválida.'
                });

            }

            const dataInformada =
                limpar(
                    interaction.options.getString(
                        'data'
                    )
                );

            const agora =
                new Date();

            const registro = {

                id:
                    `${Date.now()}-${interaction.user.id}`,

                categoria,

                tipo,

                nome,

                participantes:
                    participantes || null,

                vencedor:
                    vencedor || null,

                segundo:
                    segundo || null,

                terceiro:
                    terceiro || null,

                premio:
                    premio || null,

                valor:
                    valor !== null
                        ? valor
                        : null,

                descricao:
                    descricao || null,

                observacoes:
                    observacoes || null,

                imagem:
                    imagem || null,

                data:
                    dataInformada ||
                    agora.toLocaleDateString(
                        'pt-BR'
                    ),

                horario:
                    agora.toLocaleTimeString(
                        'pt-BR',
                        {
                            hour:
                                '2-digit',

                            minute:
                                '2-digit'
                        }
                    ),

                registradoPor: {

                    id:
                        interaction.user.id,

                    username:
                        interaction.user.username

                },

                timestamp:
                    agora.toISOString()

            };


            const historico =
                carregarHistorico();


            historico[categoria].push(
                registro
            );


            atualizarDestaque(
                historico
            );


            safeWriteJson(
                HISTORICO_PATH,
                historico
            );


            const muralAtualizado =
                await atualizarMural(
                    interaction.guild
                );


            const embed =
                new EmbedBuilder()

                    .setTitle(
                        '🏛️ EVENTO REGISTRADO NO HALL'
                    )

                    .setDescription(

                        `**${nome}**\n\n` +

                        `${CATEGORIAS[categoria]}\n` +

                        `${TIPOS[tipo]}`

                    )

                    .setColor(
                        CORES[categoria] || '#C9A227'
                    );


            if (participantes) {
                embed.addFields({
                    name:
                        '👥 PARTICIPANTES',
                    value:
                        participantes,
                    inline:
                        false
                });
            }

            if (vencedor) {
                embed.addFields({
                    name:
                        '🥇 VENCEDOR',
                    value:
                        vencedor,
                    inline:
                        true
                });
            }

            if (segundo) {
                embed.addFields({
                    name:
                        '🥈 2º LUGAR',
                    value:
                        segundo,
                    inline:
                        true
                });
            }

            if (terceiro) {
                embed.addFields({
                    name:
                        '🥉 3º LUGAR',
                    value:
                        terceiro,
                    inline:
                        true
                });
            }

            if (premio) {
                embed.addFields({
                    name:
                        '🎁 PRÊMIO',
                    value:
                        premio,
                    inline:
                        true
                });
            }

            if (valor !== null) {
                embed.addFields({
                    name:
                        '📊 VALOR',
                    value:
                        String(valor),
                    inline:
                        true
                });
            }

            if (descricao) {
                embed.addFields({
                    name:
                        '📝 DESCRIÇÃO',
                    value:
                        descricao,
                    inline:
                        false
                });
            }

            if (observacoes) {
                embed.addFields({
                    name:
                        '📌 OBSERVAÇÕES',
                    value:
                        observacoes,
                    inline:
                        false
                });
            }

            embed.addFields({
                name:
                    '📅 DATA',
                value:
                    `${registro.data} às ${registro.horario}`,
                inline:
                    true
            });

            if (imagem) {
                embed.setImage(
                    imagem
                );
            }

            embed.setFooter({
                text:
                    'WorldWarBR • Hall da Fama'
            });

            embed.setTimestamp();


            return interaction.editReply({
                content:

                    muralAtualizado
                        ? '✅ Evento registrado e Mural atualizado.'
                        : '✅ Evento registrado. Mural não encontrado.',

                embeds: [
                    embed
                ]
            });

        } catch (erro) {

            console.error(
                '[HALL] Erro:',
                erro
            );

            return interaction.editReply({
                content:
                    '❌ Ocorreu um erro ao registrar o evento.'
            });

        }

    }

};