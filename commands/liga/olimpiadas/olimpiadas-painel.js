/* ========================================================================
   ARQUIVO: commands/liga/olimpiadas/olimpiadas-painel.js
   LOCAL: commands/liga/olimpiadas/

   FUNÇÃO:
   Publica/atualiza o painel das OLIMPÍADAS DE DUPLAS.

   CANAIS:
   - Painel: 1543944529747382282
   - Resultados: 1071976981924687912
   - TEG OLIMPIADA: 1543391902252933170

   REGRA:
   O botão CONTABILIZAR só funciona nos dias pares de setembro de 2026.
   ======================================================================== */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = __dirname;
const DATA_FILE = path.join(DATA_DIR, 'olimpiadas.json');
const PANEL_FILE = path.join(DATA_DIR, 'painel.json');
const PANEL_CHANNEL_ID = '1543944529747382282';
const RESULTS_CHANNEL_ID = '1071976981924687912';
const TEG_CHANNEL_ID = '1543391902252933170';
const BANNER_URL = 'https://cdn.discordapp.com/attachments/1082774011676729365/1543598573864886393/share_1788092920482.jpg';

function readData() {
    if (!fs.existsSync(DATA_FILE)) return { duplas: [], resultados: [], seq: 0 };
    try {
        const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        return { duplas: Array.isArray(d.duplas) ? d.duplas : [], resultados: Array.isArray(d.resultados) ? d.resultados : [], seq: Number(d.seq) || 0 };
    } catch { return { duplas: [], resultados: [], seq: 0 }; }
}

function writeData(data) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, DATA_FILE);
}

function isEvenSeptember() {
    const now = new Date();
    const br = new Date(now.toLocaleString('en-US', { timeZone: 'America/Fortaleza' }));
    return br.getFullYear() === 2026 && br.getMonth() === 8 && br.getDate() % 2 === 0;
}

function makePanel(data) {
    const medalhas = new Map();
    for (const r of data.resultados) {
        for (const [key, id] of [['ouro', r.vencedor], ['prata', r.segundo], ['bronze', r.terceiro]]) {
            const d = medalhas.get(id) || { ouro: 0, prata: 0, bronze: 0 };
            d[key]++;
            medalhas.set(id, d);
        }
    }

    const ranking = [...medalhas.entries()].sort((a, b) => {
        const x = a[1], y = b[1];
        return (y.ouro - x.ouro) || ((y.prata * 3 + y.bronze) - (x.prata * 3 + x.bronze));
    }).slice(0, 10);

    const rankingText = ranking.length
        ? ranking.map(([id, m], i) => `${i + 1}. ${id} — 🥇 ${m.ouro}  🥈 ${m.prata}  🥉 ${m.bronze}`).join('\n')
        : '*Nenhum resultado registrado ainda.*';

    const canCount = isEvenSeptember();
    const embed = new EmbedBuilder()
        .setColor(0xD4AF37)
        .setTitle('🟨 OLIMPÍADAS DE DUPLAS')
        .setDescription('**Cada dupla escolherá um País para representar.**\n\n📅 **Partidas:** somente nos dias pares de setembro de 2026.\n⏱️ **Duração:** 1h30 por partida.\n\n🏆 **Classificação:** vitórias primeiro; em caso de empate, 🥈 vale peso 3 e 🥉 vale peso 1.')
        .addFields(
            { name: '🏅 CONTABILIZAÇÃO', value: canCount ? '🟢 **ABERTA HOJE** — dias pares.' : '🔒 **FECHADA HOJE** — disponível somente nos dias pares de setembro.', inline: false },
            { name: '👥 DUPLAS REGISTRADAS', value: `**${data.duplas.length}**`, inline: true },
            { name: '⚔️ RESULTADOS', value: `**${data.resultados.length}**`, inline: true },
            { name: '📊 TOP 10', value: rankingText, inline: false },
            { name: '📖 REGRAS', value: 'Briga: troca de país mantendo medalhas. Ausência: substituição definitiva mantendo medalhas do país. Anti-jogo: regra normal do servidor. Disputa por país: sorteio. **Apenas duas duplas serão vencedoras da competição.**', inline: false }
        )
        .setImage(BANNER_URL)
        .setFooter({ text: 'Olimpíadas de Duplas • WorldWarBR' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('olymp_contabilizar').setLabel('Contabilizar').setEmoji('🏅').setStyle(ButtonStyle.Success).setDisabled(!canCount),
        new ButtonBuilder().setCustomId('olymp_duplas').setLabel('Ver Duplas').setEmoji('👥').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('olymp_registrar').setLabel('Registrar Dupla').setEmoji('📝').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('olymp_guia').setLabel('Guia da Liga').setEmoji('📖').setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [row] };
}

async function publish(guild) {
    const channel = await guild.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) throw new Error(`Canal do painel ${PANEL_CHANNEL_ID} não encontrado.`);
    const data = readData();
    const payload = makePanel(data);
    let message = null;
    if (fs.existsSync(PANEL_FILE)) {
        try { const p = JSON.parse(fs.readFileSync(PANEL_FILE, 'utf8')); if (p.messageId) message = await channel.messages.fetch(p.messageId).catch(() => null); } catch {}
    }
    if (message) await message.edit(payload);
    else { message = await channel.send(payload); fs.writeFileSync(PANEL_FILE, JSON.stringify({ messageId: message.id, channelId: PANEL_CHANNEL_ID }, null, 2)); }
    return message;
}

module.exports = {
    data: new SlashCommandBuilder().setName('olimpiadas-painel').setDescription('🏅 Publica/atualiza o painel das Olimpíadas de Duplas.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        try {
            const message = await publish(interaction.guild);
            await interaction.reply({ content: `✅ Painel das Olimpíadas publicado/atualizado em <#${PANEL_CHANNEL_ID}>.\n📋 Resultados: <#${RESULTS_CHANNEL_ID}>\n🏷️ TEG: <#${TEG_CHANNEL_ID}>`, ephemeral: true });
            return message;
        } catch (e) {
            return interaction.reply({ content: `❌ Não foi possível publicar o painel: ${e.message}`, ephemeral: true });
        }
    },
    readData,
    writeData,
    publish,
    makePanel,
    constants: { PANEL_CHANNEL_ID, RESULTS_CHANNEL_ID, TEG_CHANNEL_ID, BANNER_URL }
};
