/* ========================================================================
   ARQUIVO: commands/promocao/historicoHandler.js

   WORLDWARBR — HALL DA FAMA PREMIUM

   RECURSOS:
   - 1 evento real por página
   - Liga/Imperador: agrupamento do histórico legado
   - Liga encerrada: Top 10 + botão de estatísticas completas
   - Estatísticas históricas congeladas por temporada
   - Paginação das estatísticas de todos os jogadores
   - Compatível com registros antigos e novos
   - Navegação premium
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

const HISTORICO_PATH = path.join(__dirname, 'historico.json');

const CATEGORIAS = {
    liga: {
        titulo: 'HALL DA FAMA — LIGA',
        cor: '#3498DB',
        emoji: '🏆',
        subtitulo: 'Temporadas, campeões e estatísticas históricas'
    },
    imperador: {
        titulo: 'HALL DA FAMA — IMPERADORES',
        cor: '#F1C40F',
        emoji: '👑',
        subtitulo: 'Histórico dos Imperadores'
    },
    eventos: {
        titulo: 'HALL DA FAMA — EVENTOS',
        cor: '#95A5A6',
        emoji: '⚔️',
        subtitulo: 'Eventos e competições históricas'
    },
    records: {
        titulo: 'HALL DA FAMA — RECORDS',
        cor: '#E74C3C',
        emoji: '📊',
        subtitulo: 'Grandes marcas do servidor'
    }
};

const NOMES_TIPOS = {
    semanal: '📅 Evento semanal',
    individual: '👤 Evento individual',
    campeonato: '🏆 Campeonato',
    recorde: '📊 Recorde',
    destaque: '🌟 Destaque especial'
};

const STATS_POR_PAGINA = 6;

function carregarHistorico() {
    const dados = safeReadJson(HISTORICO_PATH);

    if (!dados || typeof dados !== 'object') {
        return { destaque: '', liga: [], imperador: [], eventos: [], records: [] };
    }

    return {
        destaque: typeof dados.destaque === 'string' ? dados.destaque : '',
        liga: Array.isArray(dados.liga) ? dados.liga : [],
        imperador: Array.isArray(dados.imperador) ? dados.imperador : [],
        eventos: Array.isArray(dados.eventos) ? dados.eventos : [],
        records: Array.isArray(dados.records) ? dados.records : []
    };
}

function limparMarkdown(texto) {
    return String(texto || '').replace(/\*\*/g, '').trim();
}

function limitarTexto(texto, limite = 1024) {
    const valor = String(texto || '');
    return valor.length <= limite ? valor : `${valor.slice(0, limite - 3)}...`;
}

function ehCabecalhoAno(linha) {
    return /^\*\*📅\s*\d{4}\*\*$/u.test(String(linha || '').trim());
}

function extrairAno(linha) {
    const encontrado = String(linha || '').match(/\d{4}/u);
    return encontrado ? encontrado[0] : 'Histórico';
}

function ehTituloEventoAntigo(linha) {
    return /^[^\s]+\s+\*\*.+\*\*$/u.test(String(linha || '').trim());
}

function normalizarRegistros(categoria, registros) {
    const eventos = [];

    if (categoria === 'liga' || categoria === 'imperador') {
        let atual = null;

        for (const item of registros) {
            if (item && typeof item === 'object') {
                if (atual) eventos.push(atual);
                atual = null;
                eventos.push(item);
                continue;
            }

            const linha = String(item || '').trim();
            if (!linha) continue;

            if (ehCabecalhoAno(linha)) {
                if (atual) eventos.push(atual);
                const ano = extrairAno(linha);
                atual = {
                    __normalizado: true,
                    tipo: 'ano',
                    ano,
                    nome: ano,
                    linhas: []
                };
                continue;
            }

            if (!atual) {
                atual = {
                    __normalizado: true,
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

    if (categoria === 'eventos') {
        let atual = null;

        for (const item of registros) {
            if (item && typeof item === 'object') {
                if (atual) eventos.push(atual);
                atual = null;
                eventos.push(item);
                continue;
            }

            const linha = String(item || '').trim();
            if (!linha) continue;

            if (ehTituloEventoAntigo(linha)) {
                if (atual) eventos.push(atual);
                atual = {
                    __normalizado: true,
                    tipo: 'evento_antigo',
                    nome: limparMarkdown(linha.replace(/^\S+\s+/u, '')),
                    emoji: linha.match(/^[^\s]+/u)?.[0] || '⚔️',
                    linhas: []
                };
                continue;
            }

            if (!atual) {
                atual = {
                    __normalizado: true,
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

    if (categoria === 'records') {
        const linhas = registros
            .filter(item => typeof item === 'string')
            .map(limparMarkdown)
            .filter(Boolean);
        const objetos = registros.filter(item => item && typeof item === 'object');

        if (linhas.length) {
            eventos.push({
                __normalizado: true,
                tipo: 'records_antigos',
                nome: 'Records históricos',
                linhas
            });
        }

        eventos.push(...objetos);
        return eventos;
    }

    return registros.filter(item => item !== null && item !== undefined && item !== '');
}

function criarTop10(ranking) {
    if (!Array.isArray(ranking) || !ranking.length) {
        return '*Nenhum competidor registrado.*';
    }

    return ranking.slice(0, 10).map((jogador, index) => {
        const medalha = ['🥇', '🥈', '🥉'][index] || `**${index + 1}º**`;
        return `${medalha} <@${jogador.id}> — **${Number(jogador.pontos) || 0} pts**`;
    }).join('\n');
}

function estatisticasDeRegistro(registro) {
    if (!registro || typeof registro !== 'object') return [];
    const fonte = registro.estatisticas || registro.rankingCompleto || [];
    return Array.isArray(fonte) ? fonte : Object.values(fonte);
}

function formatarRegistro(registro) {
    if (registro && typeof registro === 'object' && registro.__normalizado) {
        if (registro.tipo === 'ano') {
            return {
                titulo: registro.ano,
                descricao: '📜 **Histórico preservado**',
                campos: [{
                    name: '🗓️ REGISTRO',
                    value: registro.linhas.join('\n') || '*Nenhum registro disponível.*',
                    inline: false
                }],
                estatisticas: []
            };
        }

        if (registro.tipo === 'evento_antigo') {
            return {
                titulo: registro.nome || 'Evento histórico',
                descricao: '🏅 **Registro histórico do evento**',
                campos: [{
                    name: '🏆 RESULTADO',
                    value: registro.linhas.join('\n') || '*Nenhum resultado registrado.*',
                    inline: false
                }],
                estatisticas: []
            };
        }

        if (registro.tipo === 'records_antigos') {
            return {
                titulo: 'Records históricos',
                descricao: '📈 **Marcas históricas do WorldWarBR**',
                campos: [{
                    name: '🏅 RECORDS',
                    value: registro.linhas.join('\n') || '*Nenhum recorde registrado.*',
                    inline: false
                }],
                estatisticas: []
            };
        }
    }

    if (registro && typeof registro === 'object') {
        const top10 = registro.top10 || registro.rankingCompleto || [];
        const campos = [];

        if (registro.tipo) {
            campos.push({
                name: '🏷️ TIPO',
                value: NOMES_TIPOS[registro.tipo] || String(registro.tipo),
                inline: true
            });
        }

        if (registro.data) {
            campos.push({
                name: '📅 DATA',
                value: registro.horario ? `${registro.data} às ${registro.horario}` : String(registro.data),
                inline: true
            });
        }

        if (registro.vencedor) campos.push({ name: '🥇 CAMPEÃO', value: String(registro.vencedor), inline: true });
        if (registro.segundo) campos.push({ name: '🥈 2º LUGAR', value: String(registro.segundo), inline: true });
        if (registro.terceiro) campos.push({ name: '🥉 3º LUGAR', value: String(registro.terceiro), inline: true });
        if (registro.totalCompetidores !== undefined) campos.push({ name: '👥 PARTICIPANTES', value: String(registro.totalCompetidores), inline: true });

        if (registro.categoria === 'liga' && top10.length) {
            campos.push({
                name: '🏆 TOP 10 — CLASSIFICAÇÃO FINAL',
                value: criarTop10(top10),
                inline: false
            });
        }

        if (registro.descricao && registro.categoria !== 'liga') {
            campos.push({ name: '📝 DESCRIÇÃO', value: String(registro.descricao), inline: false });
        }

        if (registro.observacoes) campos.push({ name: '📌 OBSERVAÇÕES', value: String(registro.observacoes), inline: false });
        if (registro.premio) campos.push({ name: '🎁 PRÊMIO', value: String(registro.premio), inline: true });
        if (registro.valor !== null && registro.valor !== undefined) campos.push({ name: '📊 VALOR', value: String(registro.valor), inline: true });
        if (registro.registradoPor?.username) {
            campos.push({ name: '🖊️ REGISTRADO POR', value: `@${registro.registradoPor.username}`, inline: true });
        }

        return {
            titulo: registro.nome || 'Evento histórico',
            descricao: registro.categoria === 'liga'
                ? '🏆 **Temporada encerrada e arquivada no Hall da Fama**'
                : (registro.descricao || '📜 **Registro oficial do Hall da Fama**'),
            campos,
            imagem: registro.imagem || null,
            estatisticas: estatisticasDeRegistro(registro),
            ehLiga: registro.categoria === 'liga'
        };
    }

    return {
        titulo: 'Evento histórico',
        descricao: '📜 **Registro histórico**',
        campos: [{
            name: '📝 INFORMAÇÕES',
            value: limitarTexto(limparMarkdown(registro) || 'Registro vazio.'),
            inline: false
        }],
        estatisticas: []
    };
}

function criarNavegacao(categoria, pagina, totalPaginas) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`hist_ephem_first_${categoria}_${pagina}`)
            .setLabel('Primeiro')
            .setEmoji('⏮️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina <= 1),
        new ButtonBuilder()
            .setCustomId(`hist_ephem_prev_${categoria}_${pagina}`)
            .setLabel('Anterior')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina <= 1),
        new ButtonBuilder()
            .setCustomId(`hist_ephem_page_${categoria}_${pagina}`)
            .setLabel(`${pagina}/${totalPaginas}`)
            .setEmoji('📄')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`hist_ephem_next_${categoria}_${pagina}`)
            .setLabel('Próximo')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pagina >= totalPaginas),
        new ButtonBuilder()
            .setCustomId('hist_ephem_fechar')
            .setLabel('Fechar')
            .setEmoji('✖️')
            .setStyle(ButtonStyle.Danger)
    );
}

function criarBotoesEvento(categoria, pagina, totalPaginas, temEstatisticas) {
    const linhas = [criarNavegacao(categoria, pagina, totalPaginas)];

    if (categoria === 'liga' && temEstatisticas) {
        linhas.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`hist_liga_stats_${pagina}`)
                    .setLabel('Ver estatísticas completas')
                    .setEmoji('📊')
                    .setStyle(ButtonStyle.Primary)
            )
        );
    }

    return linhas;
}

function criarEmbedEvento(categoria, registro, pagina, totalPaginas) {
    const config = CATEGORIAS[categoria];
    const formatado = formatarRegistro(registro);

    const embed = new EmbedBuilder()
        .setColor(config.cor)
        .setAuthor({ name: `${config.emoji} ${config.titulo}` })
        .setTitle(formatado.titulo)
        .setDescription(
            `${config.subtitulo}\n\n` +
            '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n' +
            `┃  ${formatado.descricao}\n` +
            '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'
        );

    for (const campo of formatado.campos) {
        embed.addFields({
            name: limitarTexto(campo.name),
            value: limitarTexto(campo.value),
            inline: Boolean(campo.inline)
        });
    }

    if (formatado.ehLiga && formatado.estatisticas?.length) {
        embed.addFields({
            name: '📊 ESTATÍSTICAS',
            value: 'Use o botão **Ver estatísticas completas** para consultar partidas, vitórias, kills, mortes, continentes, WarCoins e winrate de todos os jogadores.',
            inline: false
        });
    }

    if (formatado.imagem) {
        try {
            const url = new URL(formatado.imagem);
            if (url.protocol === 'https:' || url.protocol === 'http:') embed.setImage(formatado.imagem);
        } catch {}
    }

    embed.addFields({
        name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        value: `📖 **${pagina} / ${totalPaginas}**  •  ${config.emoji} Histórico oficial`,
        inline: false
    });

    embed.setFooter({ text: `WorldWarBR • Hall da Fama • ${config.titulo}` });
    return embed;
}

function paginaSegura(total, pagina) {
    const totalPaginas = Math.max(1, total);
    const atual = Number(pagina) || 1;
    return {
        pagina: Math.min(Math.max(1, atual), totalPaginas),
        totalPaginas
    };
}

function criarEmbedEstatisticas(registro, pagina, totalPaginas) {
    const config = CATEGORIAS.liga;
    const stats = estatisticasDeRegistro(registro);
    const inicio = (pagina - 1) * STATS_POR_PAGINA;
    const paginaStats = stats.slice(inicio, inicio + STATS_POR_PAGINA);

    const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setAuthor({ name: '📊 HALL DA FAMA — ESTATÍSTICAS DA TEMPORADA' })
        .setTitle(registro.nome || 'Temporada')
        .setDescription(
            `🏆 **${registro.vencedor || 'Sem campeão'}**\n\n` +
            `Página **${pagina}/${totalPaginas}** • ${stats.length} participante(s) arquivado(s)`
        );

    for (const jogador of paginaStats) {
        const posicao = stats.indexOf(jogador) + 1;
        const medalha = ['🥇', '🥈', '🥉'][posicao - 1] || `#${posicao}`;

        embed.addFields({
            name: `${medalha} ${jogador.id ? `<@${jogador.id}>` : 'Jogador'}`,
            value:
                `🏆 **Pontos:** ${Number(jogador.pontos) || 0}\n` +
                `⚔️ **Partidas:** ${Number(jogador.partidas) || 0}  •  ✅ **Vitórias:** ${Number(jogador.vitorias) || 0}\n` +
                `💀 **Kills:** ${Number(jogador.kills) || 0}  •  ☠️ **Mortes:** ${Number(jogador.mortes) || 0}\n` +
                `🌍 **Continentes:** ${Number(jogador.continentes) || 0}\n` +
                `💰 **WarCoins:** ${Number(jogador.warCoins) || 0}\n` +
                `📈 **Winrate:** ${Number(jogador.winrate) || 0}%`,
            inline: false
        });
    }

    embed.setFooter({ text: `WorldWarBR • ${config.emoji} ${registro.nome || 'Temporada'} • Estatísticas congeladas` });
    return embed;
}

function criarBotoesEstatisticas(eventoPagina, pagina, totalPaginas) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`hist_liga_stats_prev_${eventoPagina}_${pagina}`)
                .setLabel('Anterior')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pagina <= 1),
            new ButtonBuilder()
                .setCustomId(`hist_liga_stats_page_${eventoPagina}_${pagina}`)
                .setLabel(`${pagina}/${totalPaginas}`)
                .setEmoji('📄')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`hist_liga_stats_next_${eventoPagina}_${pagina}`)
                .setLabel('Próximo')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pagina >= totalPaginas),
            new ButtonBuilder()
                .setCustomId(`hist_liga_stats_back_${eventoPagina}`)
                .setLabel('Voltar à temporada')
                .setEmoji('🏆')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('hist_ephem_fechar')
                .setLabel('Fechar')
                .setEmoji('✖️')
                .setStyle(ButtonStyle.Danger)
        )
    ];
}

async function mostrarEvento(interaction, categoria, pagina) {
    if (!CATEGORIAS[categoria]) {
        return interaction.reply({ content: '❌ Categoria inválida.', flags: MessageFlags.Ephemeral });
    }

    const historico = carregarHistorico();
    const registros = normalizarRegistros(categoria, historico[categoria] || []);

    if (!registros.length) {
        const config = CATEGORIAS[categoria];
        const embed = new EmbedBuilder()
            .setColor(config.cor)
            .setAuthor({ name: `${config.emoji} ${config.titulo}` })
            .setTitle('Nenhum registro')
            .setDescription('📭 Nenhum evento histórico foi encontrado nesta categoria.');

        return interaction.reply({
            embeds: [embed],
            components: [criarNavegacao(categoria, 1, 1)],
            flags: MessageFlags.Ephemeral
        });
    }

    const pg = paginaSegura(registros.length, pagina);
    const registro = registros[pg.pagina - 1];
    const formatado = formatarRegistro(registro);

    return interaction.reply({
        embeds: [criarEmbedEvento(categoria, registro, pg.pagina, pg.totalPaginas)],
        components: criarBotoesEvento(categoria, pg.pagina, pg.totalPaginas, formatado.estatisticas?.length > 0),
        flags: MessageFlags.Ephemeral
    });
}

async function atualizarEvento(interaction, categoria, pagina) {
    const historico = carregarHistorico();
    const registros = normalizarRegistros(categoria, historico[categoria] || []);

    if (!registros.length) {
        return interaction.update({ content: '📭 Nenhum registro encontrado.', embeds: [], components: [] });
    }

    const pg = paginaSegura(registros.length, pagina);
    const registro = registros[pg.pagina - 1];
    const formatado = formatarRegistro(registro);

    return interaction.update({
        content: '',
        embeds: [criarEmbedEvento(categoria, registro, pg.pagina, pg.totalPaginas)],
        components: criarBotoesEvento(categoria, pg.pagina, pg.totalPaginas, formatado.estatisticas?.length > 0)
    });
}

async function mostrarEstatisticas(interaction, eventoPagina, paginaStats) {
    const historico = carregarHistorico();
    const registros = normalizarRegistros('liga', historico.liga || []);

    const pgEvento = paginaSegura(registros.length, eventoPagina);
    const registro = registros[pgEvento.pagina - 1];
    const stats = estatisticasDeRegistro(registro);

    if (!stats.length) {
        return interaction.update({
            content: '📭 Esta temporada não possui estatísticas arquivadas.',
            embeds: [],
            components: []
        });
    }

    const totalPaginas = Math.max(1, Math.ceil(stats.length / STATS_POR_PAGINA));
    const pg = paginaSegura(totalPaginas, paginaStats);

    return interaction.update({
        content: '',
        embeds: [criarEmbedEstatisticas(registro, pg.pagina, pg.totalPaginas)],
        components: criarBotoesEstatisticas(pgEvento.pagina, pg.pagina, pg.totalPaginas)
    });
}

module.exports = async (interaction, client) => {
    const id = interaction.customId || '';

    if (id === 'hist_liga' || id === 'hist_imperador' || id === 'hist_eventos' || id === 'hist_records') {
        return mostrarEvento(interaction, id.replace('hist_', ''), 1);
    }

    if (id.startsWith('hist_ephem_first_')) {
        const partes = id.split('_');
        return atualizarEvento(interaction, partes[3], 1);
    }

    if (id.startsWith('hist_ephem_prev_')) {
        const partes = id.split('_');
        return atualizarEvento(interaction, partes[3], Number(partes[4]) - 1);
    }

    if (id.startsWith('hist_ephem_next_')) {
        const partes = id.split('_');
        return atualizarEvento(interaction, partes[3], Number(partes[4]) + 1);
    }

    if (id.startsWith('hist_ephem_page_')) return;

    if (id.startsWith('hist_liga_stats_') && !id.startsWith('hist_liga_stats_prev_') && !id.startsWith('hist_liga_stats_next_') && !id.startsWith('hist_liga_stats_page_') && !id.startsWith('hist_liga_stats_back_')) {
        const partes = id.split('_');
        return mostrarEstatisticas(interaction, Number(partes[3]) || 1, 1);
    }

    if (id.startsWith('hist_liga_stats_prev_')) {
        const partes = id.split('_');
        return mostrarEstatisticas(interaction, Number(partes[4]) || 1, (Number(partes[5]) || 1) - 1);
    }

    if (id.startsWith('hist_liga_stats_next_')) {
        const partes = id.split('_');
        return mostrarEstatisticas(interaction, Number(partes[4]) || 1, (Number(partes[5]) || 1) + 1);
    }

    if (id.startsWith('hist_liga_stats_page_')) return;

    if (id.startsWith('hist_liga_stats_back_')) {
        const partes = id.split('_');
        return atualizarEvento(interaction, 'liga', Number(partes[4]) || 1);
    }

    if (id === 'hist_ephem_fechar') {
        return interaction.update({
            content: '✅ **Hall da Fama fechado.**',
            embeds: [],
            components: []
        });
    }
};
