const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const partidasPath = path.join(__dirname, '..', 'liga', 'partidas.json');
const temporadaPath = path.join(__dirname, '..', 'liga', 'temporada.json');
const CANAL_REGISTROS_LIGA = '1071976981924687912';
const TITULO_REGISTRO = /LIGA\s+DAS\s+NAÇÕES\s*[—-]\s*RESULTADO\s+REGISTRADO/i;
const { dataDaPartida } = require('../liga/utils/periodosLiga.js');

const historicosAtivos = new Map();
const TEMPO_CACHE = 15 * 60 * 1000;

function lerJson(caminho, fallback = {}) {
    try { return JSON.parse(fs.readFileSync(caminho, 'utf8')); } catch { return fallback; }
}

function temporadaAtual() {
    const n = Number(lerJson(temporadaPath).numero);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function inicioTemporada() {
    const d = new Date(lerJson(temporadaPath).inicio);
    return Number.isFinite(d.getTime()) ? d : null;
}

function temporadasDisponiveis() {
    const dados = lerJson(temporadaPath);
    const atual = temporadaAtual();
    const catalogo = Array.isArray(dados.temporadas)
        ? dados.temporadas
        : Array.isArray(dados.historico) ? dados.historico : [];

    const temporadas = catalogo
        .map(t => ({
            numero: Number(t?.numero),
            inicio: t?.inicio || t?.dataInicio,
            fim: t?.fim || t?.dataFim || null,
            atual: Number(t?.numero) === atual
        }))
        .filter(t => Number.isInteger(t.numero) && t.numero > 0);

    if (atual && !temporadas.some(t => t.numero === atual)) {
        const inicio = inicioTemporada();
        temporadas.push({
            numero: atual,
            inicio: inicio?.toISOString() || null,
            fim: null,
            atual: true
        });
    }

    return temporadas.sort((a, b) => b.numero - a.numero);
}

function dadosTemporada(numero) {
    return temporadasDisponiveis().find(t => t.numero === Number(numero)) || null;
}

function mensagemId(id, partida) {
    if (/^\d{15,22}$/.test(String(id))) return String(id);
    const m = partida?.meta?.mensagemResultadoId;
    return /^\d{15,22}$/.test(String(m)) ? String(m) : null;
}

function pertence(partida, uid) {
    return (Array.isArray(partida?.jogadoresBrutos) ? partida.jogadoresBrutos : []).some(j => {
        const id = typeof j === 'object'
            ? (j.id || j.userId || j.jogadorId || j.discordId)
            : j;
        return String(id) === String(uid);
    });
}

function botoes(pagina, total, uid) {
    const ultimo = Math.max(total - 1, 0);
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`estatisticas_historico_paginacao_first_${uid}`).setLabel('Primeiro').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(pagina <= 0),
        new ButtonBuilder().setCustomId(`estatisticas_historico_paginacao_prev_${uid}`).setLabel('Anterior').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(pagina <= 0),
        new ButtonBuilder().setCustomId(`estatisticas_historico_paginacao_page_${uid}`).setLabel(`${pagina + 1}/${Math.max(total, 1)}`).setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId(`estatisticas_historico_paginacao_next_${uid}`).setLabel('Próxima').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(total === 0 || pagina >= ultimo),
        new ButtonBuilder().setCustomId(`estatisticas_historico_paginacao_last_${uid}`).setLabel('Último').setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(total === 0 || pagina >= ultimo)
    );
}

async function buscar(interaction, uid, temporada) {
    const info = dadosTemporada(temporada);
    const atual = temporadaAtual();
    const inicioAtual = inicioTemporada();

    if (!info) return { invalida: true, registros: [] };

    const inicio = info.inicio
        ? new Date(info.inicio)
        : Number(temporada) === atual ? inicioAtual : null;
    const fim = info.fim ? new Date(info.fim) : null;

    if (!inicio || !Number.isFinite(inicio.getTime())) {
        return { invalida: true, registros: [] };
    }

    const canal = await interaction.client.channels.fetch(CANAL_REGISTROS_LIGA).catch(() => null);
    if (!canal?.isTextBased()) throw new Error('Canal de registros não encontrado.');

    const candidatos = Object.entries(lerJson(partidasPath))
        .map(([id, partida]) => ({
            id,
            partida,
            data: dataDaPartida({ id, partida }),
            mid: mensagemId(id, partida)
        }))
        .filter(x =>
            x.mid &&
            x.data &&
            x.data >= inicio &&
            (!fim || x.data < fim) &&
            pertence(x.partida, uid)
        )
        .sort((a, b) => b.data - a.data);

    const registros = [];
    for (const candidato of candidatos) {
        const mensagem = await canal.messages.fetch(candidato.mid).catch(() => null);
        if (mensagem?.embeds?.some(e => TITULO_REGISTRO.test(String(e.title || '')))) {
            registros.push({ mensagem });
        }
    }

    return { invalida: false, registros };
}

function salvarCache(chave, estado) {
    historicosAtivos.set(chave, { ...estado, criadoEm: Date.now() });
}

function obterCache(chave) {
    const estado = historicosAtivos.get(chave);
    if (!estado) return null;
    if (Date.now() - estado.criadoEm > TEMPO_CACHE) {
        historicosAtivos.delete(chave);
        return null;
    }
    return estado;
}

function payloadPagina(estado, pagina) {
    const total = estado.registros.length;
    const indice = Math.min(Math.max(pagina, 0), Math.max(total - 1, 0));
    const registro = estado.registros[indice];

    return {
        content: total
            ? `🏆 **Temporada ${estado.temporada}** • 📜 Histórico de partidas de <@${estado.uid}>`
            : `❌ Nenhum registro original encontrado para <@${estado.uid}> na **Temporada ${estado.temporada}**.`,
        embeds: registro ? registro.mensagem.embeds : [],
        components: total > 1 ? [botoes(indice, total, estado.uid)] : []
    };
}

async function mostrarHistorico(interaction, uid, temporada = null) {
    const ehComponente = interaction.isMessageComponent?.();
    const n = Number(temporada) || temporadaAtual();

    try {
        if (!ehComponente && !interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        if (ehComponente && !interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        const r = await buscar(interaction, uid, n);

        if (r.invalida) {
            const payload = {
                content: `❌ A Temporada ${n} não está disponível para consulta.`,
                embeds: [],
                components: []
            };

            if (ehComponente) {
                return interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            return interaction.editReply(payload).catch(() => {});
        }

        const estado = {
            uid: String(uid),
            requesterId: String(interaction.user.id),
            temporada: n,
            registros: r.registros
        };

        const payload = payloadPagina(estado, 0);

        // Quando o histórico é aberto pelo botão das estatísticas,
        // ele deve aparecer em uma NOVA mensagem, preservando o embed de estatísticas.
        if (ehComponente) {
            const resposta = await interaction.followUp({
                ...payload,
                flags: MessageFlags.Ephemeral
            });
            salvarCache(resposta.id, estado);
            return resposta;
        }

        const resposta = await interaction.editReply(payload);
        salvarCache(resposta.id, estado);
        return resposta;
    } catch (erro) {
        console.error('[HISTORICO]', erro);

        const payload = {
            content: '❌ Não foi possível carregar o histórico de partidas.',
            embeds: [],
            components: []
        };

        if (ehComponente) {
            return interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        return interaction.editReply(payload).catch(() => {});
    }
}

async function tratarPaginacao(interaction) {
    const id = String(interaction.customId || '');
    const match = id.match(/^estatisticas_historico_paginacao_(first|prev|next|last|page)_(\d{15,22})$/);
    if (!match) return false;

    await interaction.deferUpdate().catch(() => {});

    const estado = obterCache(interaction.message.id);
    if (!estado) {
        return interaction.followUp({
            content: '⚠️ Esta consulta expirou. Use o botão **Histórico de Partidas** novamente.',
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
    }

    if (String(interaction.user.id) !== String(estado.requesterId)) {
        return interaction.followUp({
            content: '❌ Apenas quem abriu esta consulta pode usar estes botões.',
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
    }

    const paginaAtual = Number(
        interaction.message.components?.[0]?.components?.[2]?.label?.split('/')?.[0] || 1
    ) - 1;

    const total = estado.registros.length;
    let pagina = paginaAtual;
    if (match[1] === 'first') pagina = 0;
    if (match[1] === 'prev') pagina = Math.max(0, paginaAtual - 1);
    if (match[1] === 'next') pagina = Math.min(Math.max(total - 1, 0), paginaAtual + 1);
    if (match[1] === 'last') pagina = Math.max(total - 1, 0);

    return interaction.editReply(payloadPagina(estado, pagina)).catch(() => {});
}

const data = new SlashCommandBuilder()
    .setName('historico')
    .setDescription('Consulta o histórico da Liga das Nações')
    .addSubcommand(s => s
        .setName('partidas')
        .setDescription('Mostra as partidas de um jogador')
        .addUserOption(o => o
            .setName('usuario')
            .setDescription('Jogador cujo histórico será consultado')
            .setRequired(true)
        )
        .addIntegerOption(o => {
            o.setName('temporada')
                .setDescription('Temporada que deseja consultar')
                .setRequired(true);

            const temporadas = temporadasDisponiveis();
            if (temporadas.length) {
                o.addChoices(...temporadas.slice(0, 25).map(t => ({
                    name: `Temporada ${t.numero}${t.atual ? ' (atual)' : ''}`,
                    value: t.numero
                })));
            }
            return o;
        })
    );

async function execute(interaction) {
    if (interaction.options.getSubcommand() !== 'partidas') return;

    const uid = interaction.options.getUser('usuario', true).id;
    const temporada = interaction.options.getInteger('temporada', true);
    return mostrarHistorico(interaction, uid, temporada);
}

module.exports = {
    data,
    execute,
    mostrarHistorico,
    tratarPaginacao,
    temporadasDisponiveis
};