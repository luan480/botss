/* ========================================================================
   ARQUIVO: commands/promocao/historicoHandler.js

   HALL DA FAMA — UM EVENTO REAL POR PÁGINA

   CORREÇÕES:
   - Agrupa registros antigos que estavam salvos como linhas soltas.
   - Liga/Imperador: 1 ano = 1 evento.
   - Eventos: título + resultados = 1 evento.
   - Records: todos os records históricos = 1 evento.
   - Ignora linhas vazias como páginas.
   - Paginação usa a quantidade de eventos reais.
   - Mantém compatibilidade com registros novos em objeto.
   - Hall privado/efêmero preservado.
   ======================================================================== */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const path = require('path');

const { safeReadJson } = require('../liga/utils/helpers.js');


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
    liga: {
        titulo: '🏆 HALL DA FAMA — LIGA',
        cor: '#3498DB',
        emoji: '🏆'
    },

    imperador: {
        titulo: '👑 HALL DA FAMA — IMPERADORES',
        cor: '#F1C40F',
        emoji: '👑'
    },

    eventos: {
        titulo: '⚔️ HALL DA FAMA — EVENTOS',
        cor: '#95A5A6',
        emoji: '⚔️'
    },

    records: {
        titulo: '📊 HALL DA FAMA — RECORDS',
        cor: '#E74C3C',
        emoji: '📊'
    }
};


const NOMES_TIPOS = {
    semanal: '📅 Evento semanal',
    individual: '👤 Evento individual',
    campeonato: '🏆 Campeonato',
    recorde: '📊 Recorde',
    destaque: '🌟 Destaque especial'
};


// ========================================================================
// CARREGAR HISTÓRICO
// ========================================================================

function carregarHistorico() {
    const dados = safeReadJson(HISTORICO_PATH);

    if (!dados || typeof dados !== 'object') {
        return {
            destaque: '',
            liga: [],
            imperador: [],
            eventos: [],
            records: []
        };
    }

    return {
        destaque: typeof dados.destaque === 'string' ? dados.destaque : '',
        liga: Array.isArray(dados.liga) ? dados.liga : [],
        imperador: Array.isArray(dados.imperador) ? dados.imperador : [],
        eventos: Array.isArray(dados.eventos) ? dados.eventos : [],
        records: Array.isArray(dados.records) ? dados.records : []
    };
}


// ========================================================================
// HELPERS DE TEXTO
// ========================================================================

function limparMarkdown(texto) {
    return String(texto || '')
        .replace(/\*\*/g, '')
        .trim();
}

function limitarCampo(valor) {
    const texto = String(valor || '');
    return texto.length <= 1024
        ? texto
        : `${texto.slice(0, 1021)}...`;
}

function ehCabecalhoAno(linha) {
    return /^\*\*📅\s*\d{4}\*\*$/u.test(String(linha || '').trim());
}

function extrairAno(linha) {
    const match = String(linha || '').match(/(\d{4})/u);
    return match ? match[1] : 'Ano histórico';
}

function ehTituloEventoAntigo(linha) {
    return /^[^\s]+\s+\*\*.+\*\*$/u.test(String(linha || '').trim());
}


// ========================================================================
// NORMALIZAÇÃO DOS REGISTROS ANTIGOS
// ========================================================================

function normalizarRegistros(categoria, registros) {
    const eventos = [];

    // ---------------------------------------------------------------
    // LIGA / IMPERADOR
    // O JSON antigo guarda:
    //  **📅 2022**
    //  • Janeiro: @alguem
    //  • Fevereiro: @alguem
    //  ...
    // Cada ano deve virar uma única página.
    // ---------------------------------------------------------------

    if (categoria === 'liga' || categoria === 'imperador') {
        let atual = null;

        for (const item of registros) {
            if (typeof item === 'object' && item !== null) {
                if (atual) {
                    eventos.push(atual);
                    atual = null;
                }
                eventos.push(item);
                continue;
            }

            const linha = String(item || '').trim();
            if (!linha) continue;

            if (ehCabecalhoAno(linha)) {
                if (atual) eventos.push(atual);

                const ano = extrairAno(linha);
                atual = {
                    __historicoNormalizado: true,
                    tipo: 'ano',
                    ano,
                    nome: ano,
                    linhas: []
                };
                continue;
            }

            if (!atual) {
                atual = {
                    __historicoNormalizado: true,
                    tipo: 'legado',
                    nome: 'Histórico',
                    linhas: []
                };
            }

            atual.linhas.push(limparMarkdown(linha));
        }

        if (atual) eventos.push(atual);
        return eventos;
    }

    // ---------------------------------------------------------------
    // EVENTOS
    // Título + resultados até o próximo título = 1 página.
    // ---------------------------------------------------------------

    if (categoria === 'eventos') {
        let atual = null;

        for (const item of registros) {
            if (typeof item === 'object' && item !== null) {
                if (atual) {
                    eventos.push(atual);
                    atual = null;
                }
                eventos.push(item);
                continue;
            }

            const linha = String(item || '').trim();
            if (!linha) continue;

            if (ehTituloEventoAntigo(linha)) {
                if (atual) eventos.push(atual);

                atual = {
                    __historicoNormalizado: true,
                    tipo: 'evento_antigo',
                    nome: limparMarkdown(
                        linha.replace(/^\S+\s+/u, '')
                    ),
                    emoji: linha.match(/^[^\s]+/u)?.[0] || '⚔️',
                    linhas: []
                };
                continue;
            }

            if (!atual) {
                atual = {
                    __historicoNormalizado: true,
                    tipo: 'evento_antigo',
                    nome: 'Evento histórico',
                    emoji: '⚔️',
                    linhas: []
                };
            }

            atual.linhas.push(limparMarkdown(linha));
        }

        if (atual) eventos.push(atual);
        return eventos;
    }

    // ---------------------------------------------------------------
    // RECORDS
    // Todos os records antigos pertencem ao mesmo painel.
    // ---------------------------------------------------------------

    if (categoria === 'records') {
        const linhas = registros
            .filter(item => typeof item === 'string')
            .map(limparMarkdown)
            .filter(Boolean);

        const objetos = registros.filter(
            item => typeof item === 'object' && item !== null
        );

        if (linhas.length) {
            eventos.push({
                __historicoNormalizado: true,
                tipo: 'records_antigos',
                nome: 'Records históricos',
                linhas
            });
        }

        eventos.push(...objetos);
        return eventos;
    }

    // Fallback
    return registros.filter(item => item !== null && item !== undefined && item !== '');
}


// ========================================================================
// FORMATAR REGISTRO NOVO
// ========================================================================

function formatarRegistroNovo(registro) {
    const campos = [];

    if (registro.tipo) {
        campos.push({
            name: '🏷️ TIPO',
            value: NOMES_TIPOS[registro.tipo] || registro.tipo,
            inline: true
        });
    }

    if (registro.participantes) {
        campos.push({
            name: '👥 PARTICIPANTES',
            value: registro.participantes,
            inline: false
        });
    }

    if (registro.vencedor) {
        campos.push({
            name: '🥇 VENCEDOR',
            value: registro.vencedor,
            inline: true
        });
    }

    if (registro.segundo) {
        campos.push({
            name: '🥈 2º LUGAR',
            value: registro.segundo,
            inline: true
        });
    }

    if (registro.terceiro) {
        campos.push({
            name: '🥉 3º LUGAR',
            value: registro.terceiro,
            inline: true
        });
    }

    if (registro.premio) {
        campos.push({
            name: '🎁 PRÊMIO',
            value: registro.premio,
            inline: true
        });
    }

    if (registro.valor !== null && registro.valor !== undefined) {
        campos.push({
            name: '📊 VALOR',
            value: String(registro.valor),
            inline: true
        });
    }

    if (registro.descricao) {
        campos.push({
            name: '📝 DESCRIÇÃO',
            value: registro.descricao,
            inline: false
        });
    }

    if (registro.observacoes) {
        campos.push({
            name: '📌 OBSERVAÇÕES',
            value: registro.observacoes,
            inline: false
        });
    }

    if (registro.data) {
        campos.push({
            name: '📅 DATA',
            value: registro.horario
                ? `${registro.data} às ${registro.horario}`
                : registro.data,
            inline: true
        });
    }

    return {
        titulo: registro.nome || 'Evento histórico',
        campos
    };
}


// ========================================================================
// FORMATAR REGISTRO NORMALIZADO
// ========================================================================

function formatarRegistroNormalizado(registro) {
    if (registro.tipo === 'ano') {
        return {
            titulo: registro.ano,
            campos: [
                {
                    name: '📅 HISTÓRICO DO ANO',
                    value: registro.linhas.join('\n'),
                    inline: false
                }
            ]
        };
    }

    if (registro.tipo === 'evento_antigo') {
        return {
            titulo: registro.nome || 'Evento histórico',
            campos: [
                {
                    name: '🏆 RESULTADO',
                    value: registro.linhas.length
                        ? registro.linhas.join('\n')
                        : '*Sem informações adicionais.*',
                    inline: false
                }
            ]
        };
    }

    if (registro.tipo === 'records_antigos') {
        return {
            titulo: 'Records históricos',
            campos: [
                {
                    name: '📊 RECORDS',
                    value: registro.linhas.join('\n'),
                    inline: false
                }
            ]
        };
    }

    return formatarRegistroNovo(registro);
}


// ========================================================================
// FORMATAR REGISTRO
// ========================================================================

function formatarRegistro(registro) {
    if (
        registro &&
        typeof registro === 'object'
    ) {
        return formatarRegistroNormalizado(registro);
    }

    return {
        titulo: 'Evento histórico',
        campos: [
            {
                name: '📜 REGISTRO',
                value: limitarCampo(limparMarkdown(registro) || 'Registro vazio.'),
                inline: false
            }
        ]
    };
}


// ========================================================================
// BOTÕES
// ========================================================================

function criarBotoes(categoria, pagina, totalPaginas) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`hist_ephem_prev_${categoria}_${pagina}`)
            .setLabel('Anterior')
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina <= 1),

        new ButtonBuilder()
            .setCustomId(`hist_ephem_page_${categoria}_${pagina}`)
            .setLabel(`${pagina}/${totalPaginas}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),

        new ButtonBuilder()
            .setCustomId(`hist_ephem_next_${categoria}_${pagina}`)
            .setLabel('Próximo')
            .setEmoji('➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina >= totalPaginas),

        new ButtonBuilder()
            .setCustomId('hist_ephem_fechar')
            .setLabel('Fechar')
            .setEmoji('✖️')
            .setStyle(ButtonStyle.Danger)
    );
}


// ========================================================================
// EMBED
// ========================================================================

function criarEmbedEvento(categoria, registro, pagina, totalPaginas) {
    const config = CATEGORIAS[categoria];
    if (!config) return null;

    const formatado = formatarRegistro(registro);

    const embed = new EmbedBuilder()
        .setTitle(`${config.emoji} ${formatado.titulo}`)
        .setColor(config.cor)
        .setDescription(
            `📄 **Evento ${pagina} de ${totalPaginas}**\n\n` +
            '━━━━━━━━━━━━━━━━━━━━'
        );

    for (const campo of formatado.campos) {
        embed.addFields({
            name: limitarCampo(campo.name),
            value: limitarCampo(campo.value),
            inline: Boolean(campo.inline)
        });
    }

    if (
        registro &&
        typeof registro === 'object' &&
        registro.imagem
    ) {
        try {
            const url = new URL(registro.imagem);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                embed.setImage(registro.imagem);
            }
        } catch {}
    }

    embed.setFooter({
        text: `WorldWarBR • Hall da Fama • Página ${pagina}/${totalPaginas}`
    });

    return embed;
}


// ========================================================================
// PAGINAÇÃO
// ========================================================================

function paginaSegura(total, pagina) {
    const totalPaginas = Math.max(1, total);
    const atual = Number(pagina) || 1;
    return {
        pagina: Math.min(Math.max(1, atual), totalPaginas),
        totalPaginas
    };
}


// ========================================================================
// MOSTRAR EVENTO
// ========================================================================

async function mostrarEvento(interaction, categoria, pagina) {
    if (!CATEGORIAS[categoria]) {
        return interaction.reply({
            content: '❌ Categoria inválida.',
            flags: MessageFlags.Ephemeral
        });
    }

    const historico = carregarHistorico();
    const registrosOriginais = historico[categoria] || [];
    const registros = normalizarRegistros(categoria, registrosOriginais);

    if (!registros.length) {
        const embed = new EmbedBuilder()
            .setTitle(CATEGORIAS[categoria].titulo)
            .setColor(CATEGORIAS[categoria].cor)
            .setDescription('📭 **Nenhum registro encontrado.**');

        return interaction.reply({
            embeds: [embed],
            components: [criarBotoes(categoria, 1, 1)],
            flags: MessageFlags.Ephemeral
        });
    }

    const pg = paginaSegura(registros.length, pagina);
    const registro = registros[pg.pagina - 1];
    const embed = criarEmbedEvento(
        categoria,
        registro,
        pg.pagina,
        pg.totalPaginas
    );

    return interaction.reply({
        content: '',
        embeds: [embed],
        components: [
            criarBotoes(
                categoria,
                pg.pagina,
                pg.totalPaginas
            )
        ],
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// ATUALIZAR EVENTO
// ========================================================================

async function atualizarEvento(interaction, categoria, pagina) {
    if (!CATEGORIAS[categoria]) {
        return interaction.update({
            content: '❌ Categoria inválida.',
            embeds: [],
            components: []
        });
    }

    const historico = carregarHistorico();
    const registrosOriginais = historico[categoria] || [];
    const registros = normalizarRegistros(categoria, registrosOriginais);

    if (!registros.length) {
        return interaction.update({
            content: '📭 Nenhum registro encontrado.',
            embeds: [],
            components: []
        });
    }

    const pg = paginaSegura(registros.length, pagina);
    const registro = registros[pg.pagina - 1];

    const embed = criarEmbedEvento(
        categoria,
        registro,
        pg.pagina,
        pg.totalPaginas
    );

    return interaction.update({
        content: '',
        embeds: [embed],
        components: [
            criarBotoes(
                categoria,
                pg.pagina,
                pg.totalPaginas
            )
        ]
    });
}


// ========================================================================
// INTERAÇÃO
// ========================================================================

module.exports = async (interaction, client) => {
    const id = interaction.customId;

    // Abrir categoria
    if (
        id === 'hist_liga' ||
        id === 'hist_imperador' ||
        id === 'hist_eventos' ||
        id === 'hist_records'
    ) {
        return mostrarEvento(
            interaction,
            id.replace('hist_', ''),
            1
        );
    }

    // Próximo
    if (id.startsWith('hist_ephem_next_')) {
        const partes = id.split('_');
        const categoria = partes[3];
        const paginaAtual = Number(partes[4]) || 1;

        return atualizarEvento(
            interaction,
            categoria,
            paginaAtual + 1
        );
    }

    // Anterior
    if (id.startsWith('hist_ephem_prev_')) {
        const partes = id.split('_');
        const categoria = partes[3];
        const paginaAtual = Number(partes[4]) || 1;

        return atualizarEvento(
            interaction,
            categoria,
            paginaAtual - 1
        );
    }

    // Indicador da página
    if (id.startsWith('hist_ephem_page_')) {
        return;
    }

    // Fechar
    if (id === 'hist_ephem_fechar') {
        return interaction.update({
            content: '✅ **Hall da Fama fechado.**',
            embeds: [],
            components: []
        });
    }
};
