/* ========================================================================
   ARQUIVO: commands/promocao/historicoHandler.js

   WORLDWARBR — HALL DA FAMA

   REGRAS:
   - Cada temporada/evento é UMA ficha.
   - O conteúdo de uma Liga fica junto: campeão, pódio, Top 10 e resumo.
   - Estatísticas completas ficam em uma tela própria da temporada.
   - O total de páginas é calculado SOMENTE sobre as fichas realmente
     renderizadas. Isso impede "1/16" quando só existem 4 fichas.
   - Histórico antigo em texto continua compatível.
   - Registros novos em objeto são tratados como registros individuais.
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
const STATS_POR_PAGINA = 6;

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

function texto(valor) {
    return String(valor ?? '').trim();
}

function limparMarkdown(valor) {
    return texto(valor).replace(/\*\*/g, '').trim();
}

function limitar(valor, limite = 1024) {
    const s = texto(valor);
    return s.length <= limite ? s : `${s.slice(0, limite - 3)}...`;
}

function idValido(id) {
    return /^\d{15,22}$/.test(texto(id));
}

function mencaoOuTexto(valor) {
    const s = texto(valor);
    if (!s) return null;
    if (idValido(s)) return `<@${s}>`;
    return s;
}

function estatisticasDeRegistro(registro) {
    if (!registro || typeof registro !== 'object') return [];
    const fonte = registro.estatisticas ?? registro.rankingCompleto ?? registro.stats ?? [];
    if (Array.isArray(fonte)) return fonte.filter(Boolean);
    if (fonte && typeof fonte === 'object') {
        return Object.entries(fonte).map(([id, dados]) => ({
            ...(dados && typeof dados === 'object' ? dados : { pontos: dados }),
            id: dados?.id || id
        }));
    }
    return [];
}

/* ------------------------------------------------------------------------
   NORMALIZAÇÃO

   O histórico antigo possui strings. Não transformamos cada linha em uma
   página. Um cabeçalho de ano inicia uma ficha e todas as linhas seguintes
   pertencem àquele ano até o próximo cabeçalho.

   Eventos antigos seguem a mesma ideia: "🌙 **Nome**" inicia uma ficha.
   Objetos novos continuam sendo UMA ficha por objeto.
   ------------------------------------------------------------------------ */
function normalizarRegistros(categoria, registros) {
    const saida = [];
    let atual = null;

    const fechar = () => {
        if (atual) {
            atual.linhas = (atual.linhas || []).filter(Boolean);
            if (atual.linhas.length || atual.tipo === 'ano' || atual.tipo === 'evento_antigo') {
                saida.push(atual);
            }
        }
        atual = null;
    };

    for (const item of registros) {
        if (item && typeof item === 'object') {
            fechar();
            saida.push(item);
            continue;
        }

        const linha = texto(item);
        if (!linha) continue;

        if (categoria === 'liga' || categoria === 'imperador') {
            const ano = linha.match(/^\*\*📅\s*(\d{4})\*\*$/u);
            if (ano) {
                fechar();
                atual = {
                    __normalizado: true,
                    tipo: 'ano',
                    ano: ano[1],
                    nome: ano[1],
                    linhas: []
                };
                continue;
            }

            if (!atual) {
                atual = {
                    __normalizado: true,
                    tipo: 'ano',
                    ano: 'Histórico',
                    nome: 'Histórico',
                    linhas: []
                };
            }

            atual.linhas.push(limparMarkdown(linha));
            continue;
        }

        if (categoria === 'eventos') {
            const titulo = linha.match(/^([^\s]+)\s+\*\*(.+)\*\*$/u);
            if (titulo) {
                fechar();
                atual = {
                    __normalizado: true,
                    tipo: 'evento_antigo',
                    emoji: titulo[1],
                    nome: titulo[2].trim(),
                    linhas: []
                };
                continue;
            }

            if (!atual) {
                atual = {
                    __normalizado: true,
                    tipo: 'evento_antigo',
                    emoji: '⚔️',
                    nome: 'Evento histórico',
                    linhas: []
                };
            }

            atual.linhas.push(limparMarkdown(linha));
            continue;
        }

        if (categoria === 'records') {
            if (!atual) {
                atual = {
                    __normalizado: true,
                    tipo: 'records_antigos',
                    nome: 'Records históricos',
                    linhas: []
                };
            }
            atual.linhas.push(limparMarkdown(linha));
        }
    }

    fechar();
    return saida;
}

function rankingDoRegistro(registro) {
    if (!registro || typeof registro !== 'object') return [];
    const ranking = registro.top10 ?? registro.rankingCompleto ?? registro.ranking ?? registro.estatisticas ?? [];
    const lista = Array.isArray(ranking) ? ranking : Object.entries(ranking || {}).map(([id, dados]) => ({ ...(dados || {}), id }));
    return lista
        .filter(j => j && (j.id || j.userId || j.jogadorId))
        .map(j => ({ ...j, id: j.id || j.userId || j.jogadorId }))
        .sort((a, b) => (Number(b.pontos) || 0) - (Number(a.pontos) || 0));
}

function linhaTop10(ranking) {
    if (!ranking.length) return '*Nenhuma classificação arquivada.*';
    return ranking.slice(0, 10).map((j, i) => {
        const medalha = ['🥇', '🥈', '🥉'][i] || `**${i + 1}º**`;
        const nome = mencaoOuTexto(j.id) || 'Jogador';
        const pontos = Number(j.pontos) || 0;
        return `${medalha} ${nome} — **${pontos} pts**`;
    }).join('\n');
}

function campo(name, value, inline = false) {
    return { name: limitar(name, 256), value: limitar(value || '*Não informado.*'), inline };
}

function formatarRegistro(categoria, registro) {
    const config = CATEGORIAS[categoria];

    if (registro && typeof registro === 'object' && registro.__normalizado) {
        if (registro.tipo === 'ano') {
            return {
                titulo: categoria === 'liga' ? `🏆 Liga — ${registro.ano}` : `👑 Imperador — ${registro.ano}`,
                descricao: '📜 **Registro histórico preservado**',
                campos: [campo('🗓️ REGISTRO', registro.linhas.join('\n') || '*Nenhum registro disponível.*')],
                estatisticas: [],
                ehLiga: false
            };
        }

        if (registro.tipo === 'evento_antigo') {
            return {
                titulo: `${registro.emoji || '⚔️'} ${registro.nome || 'Evento histórico'}`,
                descricao: '🏅 **Registro histórico do evento**',
                campos: [campo('🏆 RESULTADO', registro.linhas.join('\n') || '*Nenhum resultado registrado.*')],
                estatisticas: [],
                ehLiga: false
            };
        }

        if (registro.tipo === 'records_antigos') {
            return {
                titulo: '📊 Records históricos',
                descricao: '📈 **Grandes marcas do WorldWarBR**',
                campos: [campo('🏅 RECORDS', registro.linhas.join('\n') || '*Nenhum recorde registrado.*')],
                estatisticas: [],
                ehLiga: false
            };
        }
    }

    if (!registro || typeof registro !== 'object') {
        return {
            titulo: 'Evento histórico',
            descricao: '📜 **Registro histórico**',
            campos: [campo('📝 INFORMAÇÕES', limparMarkdown(registro))],
            estatisticas: [],
            ehLiga: false
        };
    }

    const stats = estatisticasDeRegistro(registro);
    const ranking = rankingDoRegistro(registro);
    const campos = [];

    if (registro.tipo) campos.push(campo('🏷️ TIPO', NOMES_TIPOS[registro.tipo] || registro.tipo, true));
    if (registro.data) campos.push(campo('📅 DATA', registro.horario ? `${registro.data} às ${registro.horario}` : registro.data, true));
    if (registro.vencedor) campos.push(campo('🥇 CAMPEÃO', registro.vencedor, true));
    if (registro.segundo) campos.push(campo('🥈 2º LUGAR', registro.segundo, true));
    if (registro.terceiro) campos.push(campo('🥉 3º LUGAR', registro.terceiro, true));
    if (registro.totalCompetidores !== undefined) campos.push(campo('👥 PARTICIPANTES', registro.totalCompetidores, true));

    const ehLiga = categoria === 'liga' || registro.categoria === 'liga';

    if (ehLiga && ranking.length) {
        campos.push(campo('🏆 TOP 10 — CLASSIFICAÇÃO FINAL', linhaTop10(ranking)));
    }

    if (registro.participantes) campos.push(campo('👥 PARTICIPANTES', registro.participantes));
    if (registro.premio) campos.push(campo('🎁 PRÊMIO', registro.premio, true));
    if (registro.valor !== null && registro.valor !== undefined) campos.push(campo('📊 VALOR', registro.valor, true));
    if (registro.descricao) campos.push(campo('📝 DESCRIÇÃO', registro.descricao));
    if (registro.observacoes) campos.push(campo('📌 OBSERVAÇÕES', registro.observacoes));
    if (registro.registradoPor?.username) campos.push(campo('🖊️ REGISTRADO POR', `@${registro.registradoPor.username}`, true));

    if (ehLiga && !ranking.length && stats.length) {
        campos.push(campo('🏆 CLASSIFICAÇÃO FINAL', linhaTop10(stats)));
    }

    return {
        titulo: registro.nome || (ehLiga ? 'Liga' : 'Evento histórico'),
        descricao: ehLiga ? '🏆 **Temporada encerrada e arquivada no Hall da Fama**' : (registro.descricao || '📜 **Registro oficial do Hall da Fama**'),
        campos,
        imagem: registro.imagem || null,
        estatisticas: stats,
        ranking,
        ehLiga
    };
}

function paginaSegura(total, pagina) {
    const totalPaginas = Math.max(1, Number(total) || 0);
    const atual = Number(pagina) || 1;
    return {
        pagina: Math.min(Math.max(1, atual), totalPaginas),
        totalPaginas
    };
}

function criarNavegacao(categoria, pagina, totalPaginas) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`hist_ephem_first_${categoria}`).setLabel('Primeiro').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(pagina <= 1),
        new ButtonBuilder().setCustomId(`hist_ephem_prev_${categoria}_${pagina}`).setLabel('Anterior').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(pagina <= 1),
        new ButtonBuilder().setCustomId(`hist_ephem_page_${categoria}_${pagina}`).setLabel(`${pagina}/${totalPaginas}`).setEmoji('📄').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId(`hist_ephem_next_${categoria}_${pagina}`).setLabel('Próximo').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(pagina >= totalPaginas),
        new ButtonBuilder().setCustomId('hist_ephem_fechar').setLabel('Fechar').setEmoji('✖️').setStyle(ButtonStyle.Danger)
    );
}

function criarBotoesEvento(categoria, pagina, totalPaginas, temEstatisticas) {
    const linhas = [criarNavegacao(categoria, pagina, totalPaginas)];
    if (categoria === 'liga' && temEstatisticas) {
        linhas.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`hist_liga_stats_${pagina}`).setLabel('Ver estatísticas completas').setEmoji('📊').setStyle(ButtonStyle.Primary)
        ));
    }
    return linhas;
}

function criarEmbedEvento(categoria, registro, pagina, totalPaginas) {
    const config = CATEGORIAS[categoria];
    const f = formatarRegistro(categoria, registro);

    const embed = new EmbedBuilder()
        .setColor(config.cor)
        .setAuthor({ name: `${config.emoji} ${config.titulo}` })
        .setTitle(limitar(f.titulo, 256))
        .setDescription(`${config.subtitulo}\n\n${f.descricao}`);

    for (const c of f.campos) embed.addFields(c);

    if (f.ehLiga && f.estatisticas.length) {
        embed.addFields(campo('📊 ESTATÍSTICAS DA TEMPORADA', 'A temporada possui estatísticas congeladas. Clique em **Ver estatísticas completas** para consultar todos os jogadores.', false));
    }

    if (f.imagem) {
        try {
            const u = new URL(f.imagem);
            if (u.protocol === 'http:' || u.protocol === 'https:') embed.setImage(f.imagem);
        } catch {}
    }

    embed.addFields(campo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━', `📄 **Página ${pagina}/${totalPaginas}** • ${config.emoji} Registro oficial`, false));
    embed.setFooter({ text: 'WorldWarBR • Hall da Fama • A história nunca é apagada.' });
    return embed;
}

function criarEmbedEstatisticas(registro, pagina, totalPaginas) {
    const stats = estatisticasDeRegistro(registro);
    const inicio = (pagina - 1) * STATS_POR_PAGINA;
    const itens = stats.slice(inicio, inicio + STATS_POR_PAGINA);

    const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setAuthor({ name: '📊 HALL DA FAMA — ESTATÍSTICAS DA TEMPORADA' })
        .setTitle(limitar(registro?.nome || 'Temporada', 256))
        .setDescription(`🏆 **${registro?.vencedor || 'Campeão não arquivado'}**\n\n📄 Página **${pagina}/${totalPaginas}** • **${stats.length}** jogador(es) arquivado(s)`);

    for (let i = 0; i < itens.length; i++) {
        const jogador = itens[i];
        const posicao = inicio + i + 1;
        const medalha = ['🥇', '🥈', '🥉'][posicao - 1] || `#${posicao}`;
        const nome = mencaoOuTexto(jogador.id || jogador.userId || jogador.jogadorId) || jogador.nome || 'Jogador';
        const partidas = Number(jogador.partidas) || 0;
        const vitorias = Number(jogador.vitorias) || 0;
        const winrate = jogador.winrate !== undefined ? Number(jogador.winrate).toFixed(1) : (partidas ? ((vitorias / partidas) * 100).toFixed(1) : '0.0');

        embed.addFields({
            name: `${medalha} ${limitar(nome, 200)} — ${Number(jogador.pontos) || 0} pts`,
            value:
                `⚔️ Partidas: **${partidas}**  •  🏆 Vitórias: **${vitorias}**\n` +
                `💀 Kills: **${Number(jogador.kills) || 0}**  •  ☠️ Mortes: **${Number(jogador.mortes) || 0}**\n` +
                `🌍 Continentes: **${Number(jogador.continentes) || 0}**  •  📈 Winrate: **${winrate}%**\n` +
                `💰 WarCoins: **${Number(jogador.warCoins) || 0}**`,
            inline: false
        });
    }

    if (!itens.length) embed.addFields(campo('📭 SEM DADOS', 'Nenhuma estatística foi arquivada nesta temporada.'));
    embed.setFooter({ text: `WorldWarBR • ${registro?.nome || 'Temporada'} • Estatísticas congeladas` });
    return embed;
}

function criarBotoesEstatisticas(eventoPagina, pagina, totalPaginas) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`hist_liga_stats_prev_${eventoPagina}_${pagina}`).setLabel('Anterior').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(pagina <= 1),
        new ButtonBuilder().setCustomId(`hist_liga_stats_page_${eventoPagina}_${pagina}`).setLabel(`${pagina}/${totalPaginas}`).setEmoji('📄').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId(`hist_liga_stats_next_${eventoPagina}_${pagina}`).setLabel('Próximo').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(pagina >= totalPaginas),
        new ButtonBuilder().setCustomId(`hist_liga_stats_back_${eventoPagina}`).setLabel('Voltar à temporada').setEmoji('🏆').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('hist_ephem_fechar').setLabel('Fechar').setEmoji('✖️').setStyle(ButtonStyle.Danger)
    )];
}

async function mostrarEvento(interaction, categoria, pagina) {
    const config = CATEGORIAS[categoria];
    if (!config) return interaction.reply({ content: '❌ Categoria inválida.', flags: MessageFlags.Ephemeral });

    const historico = carregarHistorico();
    const registros = normalizarRegistros(categoria, historico[categoria]);

    if (!registros.length) {
        const embed = new EmbedBuilder().setColor(config.cor).setAuthor({ name: `${config.emoji} ${config.titulo}` }).setTitle('Nenhum registro').setDescription('📭 Nenhum registro histórico foi encontrado nesta categoria.');
        return interaction.reply({ embeds: [embed], components: [criarNavegacao(categoria, 1, 1)], flags: MessageFlags.Ephemeral });
    }

    const pg = paginaSegura(registros.length, pagina);
    const registro = registros[pg.pagina - 1];
    const f = formatarRegistro(categoria, registro);

    return interaction.reply({
        embeds: [criarEmbedEvento(categoria, registro, pg.pagina, pg.totalPaginas)],
        components: criarBotoesEvento(categoria, pg.pagina, pg.totalPaginas, f.ehLiga && f.estatisticas.length > 0),
        flags: MessageFlags.Ephemeral
    });
}

async function atualizarEvento(interaction, categoria, pagina) {
    const historico = carregarHistorico();
    const registros = normalizarRegistros(categoria, historico[categoria]);
    if (!registros.length) return interaction.update({ content: '📭 Nenhum registro encontrado.', embeds: [], components: [] });

    const pg = paginaSegura(registros.length, pagina);
    const registro = registros[pg.pagina - 1];
    const f = formatarRegistro(categoria, registro);

    return interaction.update({
        content: '',
        embeds: [criarEmbedEvento(categoria, registro, pg.pagina, pg.totalPaginas)],
        components: criarBotoesEvento(categoria, pg.pagina, pg.totalPaginas, f.ehLiga && f.estatisticas.length > 0)
    });
}

async function mostrarEstatisticas(interaction, eventoPagina, paginaStats) {
    const historico = carregarHistorico();
    const registros = normalizarRegistros('liga', historico.liga);
    const pgEvento = paginaSegura(registros.length, eventoPagina);
    const registro = registros[pgEvento.pagina - 1];
    const stats = estatisticasDeRegistro(registro);

    if (!stats.length) {
        return interaction.update({ content: '📭 Esta temporada não possui estatísticas arquivadas.', embeds: [], components: [] });
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
    const id = texto(interaction.customId);

    if (id === 'hist_liga' || id === 'hist_imperador' || id === 'hist_eventos' || id === 'hist_records') {
        return mostrarEvento(interaction, id.replace('hist_', ''), 1);
    }

    if (id.startsWith('hist_ephem_first_')) {
        const [, , , categoria] = id.split('_');
        return atualizarEvento(interaction, categoria, 1);
    }

    if (id.startsWith('hist_ephem_prev_')) {
        const [, , , categoria, pagina] = id.split('_');
        return atualizarEvento(interaction, categoria, Number(pagina) - 1);
    }

    if (id.startsWith('hist_ephem_next_')) {
        const [, , , categoria, pagina] = id.split('_');
        return atualizarEvento(interaction, categoria, Number(pagina) + 1);
    }

    if (id.startsWith('hist_ephem_page_')) return;

    if (/^hist_liga_stats_\d+$/.test(id)) {
        const [, , , eventoPagina] = id.split('_');
        return mostrarEstatisticas(interaction, Number(eventoPagina), 1);
    }

    if (id.startsWith('hist_liga_stats_prev_')) {
        const [, , , , eventoPagina, pagina] = id.split('_');
        return mostrarEstatisticas(interaction, Number(eventoPagina), Number(pagina) - 1);
    }

    if (id.startsWith('hist_liga_stats_next_')) {
        const [, , , , eventoPagina, pagina] = id.split('_');
        return mostrarEstatisticas(interaction, Number(eventoPagina), Number(pagina) + 1);
    }

    if (id.startsWith('hist_liga_stats_page_')) return;

    if (id.startsWith('hist_liga_stats_back_')) {
        const [, , , , eventoPagina] = id.split('_');
        return atualizarEvento(interaction, 'liga', Number(eventoPagina));
    }

    if (id === 'hist_ephem_fechar') {
        return interaction.update({ content: '✅ **Hall da Fama fechado.**', embeds: [], components: [] });
    }
};
