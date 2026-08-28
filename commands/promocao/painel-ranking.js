/* ========================================================================
   PAINÉIS WORLDWARBR

   🏛️ HALL DA FAMA
   Canal: 1079671915431608372
   Liga • Imperadores • Eventos • Records

   ⚔️ PAINEL DE PATENTES / RANKING
   Canal: 1090178120910389349
   Top 10 • Exército • Marinha • Aeronáutica • Mercenários

   Os dois painéis usam o mesmo historico.json, mas possuem mensagens e
   referências independentes. Nenhum registro histórico é apagado.
   ======================================================================== */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const HISTORICO_PATH = path.join(__dirname, 'historico.json');

const CANAL_HALL = '1079671915431608372';
const CANAL_RANKING = '1090178120910389349';

const IMAGEM_GUERRA =
    'https://media.discordapp.net/attachments/1082774011676729365/1541522022327390398/Impactful_Tactical_Military_Banner_Design.png?format=webp&quality=lossless&width=1536&height=865';

function garantirHistorico() {
    const dados = safeReadJson(HISTORICO_PATH);
    const historico = dados && typeof dados === 'object' ? dados : {};

    for (const chave of ['liga', 'imperador', 'eventos', 'records']) {
        if (!Array.isArray(historico[chave])) historico[chave] = [];
    }

    if (!historico.paineis || typeof historico.paineis !== 'object') {
        historico.paineis = {};
    }

    // Migração segura do formato antigo: o mural antigo era o Hall.
    if (!historico.paineis.hall && historico.mural?.channelId) {
        historico.paineis.hall = {
            channelId: String(historico.mural.channelId),
            messageId: String(historico.mural.messageId)
        };
    }

    return historico;
}

function salvarHistorico(historico) {
    return safeWriteJson(HISTORICO_PATH, historico) !== false;
}

function texto(valor) {
    return valor == null ? '' : String(valor).trim();
}

function cortar(valor, limite = 1024) {
    const valorTexto = texto(valor);
    return valorTexto.length <= limite
        ? valorTexto
        : `${valorTexto.slice(0, limite - 3)}...`;
}

function nomeRegistro(registro) {
    if (!registro || typeof registro !== 'object') return 'Registro histórico';
    return texto(
        registro.nome ||
        registro.titulo ||
        registro.temporada ||
        registro.evento ||
        'Registro histórico'
    );
}

function ultimoRegistro(historico, chave) {
    const lista = Array.isArray(historico[chave]) ? historico[chave] : [];
    return lista.length ? lista[lista.length - 1] : null;
}

function criarEmbedHall() {
    const historico = garantirHistorico();

    return new EmbedBuilder()
        .setColor('#C9A227')
        .setTitle('🏛️ HALL DA FAMA — WORLDWARBR')
        .setDescription(
            '**A história não é esquecida. Ela é eternizada.**\n\n' +
            'Aqui ficam os grandes campeões, imperadores, eventos e records que marcaram o servidor.\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '🏆 **LIGAS** — Campeões e temporadas\n' +
            '👑 **IMPERADORES** — Grandes soberanos\n' +
            '⚔️ **EVENTOS** — Batalhas e competições\n' +
            '📊 **RECORDS** — Marcas históricas\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━'
        )
        .addFields({
            name: '📜 ARQUIVO HISTÓRICO',
            value:
                `🏆 Ligas: **${historico.liga.length}**\n` +
                `👑 Imperadores: **${historico.imperador.length}**\n` +
                `⚔️ Eventos: **${historico.eventos.length}**\n` +
                `📊 Records: **${historico.records.length}**`,
            inline: true
        }, {
            name: '🔥 ÚLTIMOS REGISTROS',
            value:
                `🏆 ${cortar(nomeRegistro(ultimoRegistro(historico, 'liga')), 150)}\n` +
                `👑 ${cortar(nomeRegistro(ultimoRegistro(historico, 'imperador')), 150)}\n` +
                `⚔️ ${cortar(nomeRegistro(ultimoRegistro(historico, 'eventos')), 150)}\n` +
                `📊 ${cortar(nomeRegistro(ultimoRegistro(historico, 'records')), 150)}`,
            inline: true
        })
        .setFooter({ text: 'WorldWarBR • Hall da Fama • Memória de guerra' })
        .setTimestamp();
}

function criarEmbedRanking() {
    return new EmbedBuilder()
        .setColor('#7A0C0C')
        .setTitle('⚔️ COMANDO DE PATENTES — WORLDWARBR')
        .setDescription(
            '**CENTRO DE COMANDO • RANKINGS MILITARES**\n\n' +
            'Consulte a força dos maiores combatentes do servidor.\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '🏆 **TOP 10 GLOBAL**\n' +
            'Os dez maiores nomes do ranking geral.\n\n' +
            '🪖 **EXÉRCITO**  •  ⚓ **MARINHA**\n' +
            '✈️ **AERONÁUTICA**  •  💀 **MERCENÁRIOS**\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '🎖️ Selecione uma categoria abaixo para abrir as estatísticas.'
        )
        .setImage(IMAGEM_GUERRA)
        .addFields({
            name: '🎖️ CENTRO DE COMANDO',
            value: 'Escolha o ranking que deseja consultar usando os botões abaixo.',
            inline: false
        })
        .setFooter({ text: 'WorldWarBR • Patentes & Rankings • Centro de Comando' })
        .setTimestamp();
}

function botoesHall() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('hist_liga').setLabel('Liga').setEmoji('🏆').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('hist_imperador').setLabel('Imperadores').setEmoji('👑').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('hist_eventos').setLabel('Eventos').setEmoji('⚔️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hist_records').setLabel('Records').setEmoji('📊').setStyle(ButtonStyle.Danger)
    );
}

function botoesRanking() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rank_global').setLabel('Top 10 Global').setEmoji('🏆').setStyle(ButtonStyle.Danger)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rank_exercito').setLabel('Exército').setEmoji('🪖').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('rank_marinha').setLabel('Marinha').setEmoji('⚓').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rank_aeronautica').setLabel('Aeronáutica').setEmoji('✈️').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('rank_mercenarios').setLabel('Mercenários').setEmoji('💀').setStyle(ButtonStyle.Danger)
        )
    ];
}

async function buscarMensagem(guild, referencia) {
    if (!referencia?.channelId || !referencia?.messageId) return null;

    const canal = await guild.channels.fetch(referencia.channelId).catch(() => null);
    if (!canal?.isTextBased()) return null;

    return canal.messages.fetch(referencia.messageId).catch(() => null);
}

async function publicarPainel(guild, tipo, channelId, embed, components) {
    const historico = garantirHistorico();
    const referencia = historico.paineis?.[tipo];
    const existente = await buscarMensagem(guild, referencia);

    if (existente) {
        await existente.edit({ embeds: [embed], components });
        return existente;
    }

    const canal = await guild.channels.fetch(channelId).catch(() => null);
    if (!canal?.isTextBased()) {
        throw new Error(`Canal ${channelId} não encontrado ou não é de texto.`);
    }

    const mensagem = await canal.send({ embeds: [embed], components });

    historico.paineis[tipo] = {
        channelId: String(channelId),
        messageId: String(mensagem.id)
    };

    // Mantém compatibilidade com módulos antigos que ainda consultem mural.
    if (tipo === 'hall') {
        historico.mural = {
            channelId: String(channelId),
            messageId: String(mensagem.id)
        };
    }

    if (!salvarHistorico(historico)) {
        throw new Error('Não foi possível salvar a referência do painel.');
    }

    return mensagem;
}

async function atualizarHall(guild) {
    const historico = garantirHistorico();
    const referencia = historico.paineis?.hall || historico.mural;
    const mensagem = await buscarMensagem(guild, referencia);

    if (!mensagem) return null;

    await mensagem.edit({
        embeds: [criarEmbedHall()],
        components: [botoesHall()]
    });

    if (!historico.paineis.hall) {
        historico.paineis.hall = {
            channelId: String(referencia.channelId),
            messageId: String(referencia.messageId)
        };
        salvarHistorico(historico);
    }

    return mensagem;
}

async function atualizarRanking(guild) {
    const historico = garantirHistorico();
    const referencia = historico.paineis?.ranking;
    const mensagem = await buscarMensagem(guild, referencia);
    if (!mensagem) return null;

    await mensagem.edit({
        embeds: [criarEmbedRanking()],
        components: botoesRanking()
    });

    return mensagem;
}

async function criarMural(canal) {
    if (!canal?.guild) throw new Error('Canal inválido.');

    const guild = canal.guild;

    // O comando agora garante os dois painéis nos canais corretos.
    const hall = await publicarPainel(
        guild,
        'hall',
        CANAL_HALL,
        criarEmbedHall(),
        [botoesHall()]
    );

    const ranking = await publicarPainel(
        guild,
        'ranking',
        CANAL_RANKING,
        criarEmbedRanking(),
        botoesRanking()
    );

    return { hall, ranking };
}

const comando = {
    data: new SlashCommandBuilder()
        .setName('painel-ranking')
        .setDescription('⚔️ Cria ou atualiza os painéis separados de Hall e Patentes.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            await criarMural(interaction.channel);
            await interaction.editReply({
                content:
                    '✅ **Painéis separados com sucesso!**\n\n' +
                    `🏛️ Hall da Fama → <#${CANAL_HALL}>\n` +
                    `⚔️ Patentes/Ranking → <#${CANAL_RANKING}>`
            });
        } catch (erro) {
            console.error('[PAINEIS] Erro:', erro);
            await interaction.editReply({
                content: `❌ Falha ao criar/atualizar os painéis: ${erro.message}`
            });
        }
    },

    criarMural,
    atualizarMural: atualizarHall,
    atualizarHall,
    atualizarRanking,
    criarEmbedMural: criarEmbedHall,
    criarEmbedHall,
    criarEmbedRanking,
    criarBotoesHall: botoesHall,
    criarBotoesFaccao: botoesRanking,
    obterComponentesMural: () => [botoesHall()]
};

module.exports = comando;
