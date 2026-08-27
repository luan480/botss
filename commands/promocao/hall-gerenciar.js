const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
const HISTORICO_PATH = path.join(__dirname, 'historico.json');
const CATEGORIAS = ['liga', 'eventos', 'records', 'imperador'];
const txt = v => v == null ? '' : String(v).trim();
const limit = (v, n = 1024) => { const s = txt(v); return s.length <= n ? s : s.slice(0, n - 3) + '...'; };
const admin = i => Boolean(i.memberPermissions?.has(PermissionFlagsBits.Administrator));
const nome = r => txt(r?.nome || r?.titulo || r?.temporada || r?.evento || r?.descricao || 'Registro sem nome');
function carregar() { const d = safeReadJson(HISTORICO_PATH) || {}; for (const c of CATEGORIAS) if (!Array.isArray(d[c])) d[c] = []; return d; }
function achar(d, c, id) { const lista = d[c] || []; const indice = lista.findIndex(r => r && String(r.id) === String(id)); return { lista, indice, registro: indice >= 0 ? lista[indice] : null }; }
function atual(r, c) { const v = r?.[c]; if (v == null) return ''; if (Array.isArray(v)) return v.join('\n'); if (typeof v === 'object') return JSON.stringify(v); return String(v); }
function valorOu(r, c) { return limit(atual(r, c) || 'Não informado'); }
function embedResumo(c, r) {
    const e = new EmbedBuilder().setColor('#C9A227').setTitle('🏛️ GERENCIAMENTO DO HALL DA FAMA').setDescription(`**${limit(nome(r), 256)}**\n${c === 'liga' ? '🏆' : c === 'imperador' ? '👑' : c === 'eventos' ? '⚔️' : '📊'} Categoria: **${c.toUpperCase()}**`);
    if (c === 'eventos') e.addFields(
        { name: '🥇 VENCEDOR', value: valorOu(r, 'vencedor'), inline: true }, { name: '🥈 2º LUGAR', value: valorOu(r, 'segundo'), inline: true }, { name: '🥉 3º LUGAR', value: valorOu(r, 'terceiro'), inline: true },
        { name: '👥 PARTICIPANTES', value: valorOu(r, 'participantes'), inline: true }, { name: '💰 VALOR', value: valorOu(r, 'valor'), inline: true }, { name: '🎁 PRÊMIO', value: valorOu(r, 'premio'), inline: true },
        { name: '📅 DATA', value: valorOu(r, 'data'), inline: true }, { name: '🕐 HORÁRIO', value: valorOu(r, 'horario'), inline: true }, { name: '📝 DESCRIÇÃO', value: valorOu(r, 'descricao') },
        { name: '📌 OBSERVAÇÕES', value: valorOu(r, 'observacoes') }, { name: '🖼️ IMAGEM', value: valorOu(r, 'imagem') }
    );
    else if (c === 'liga' || c === 'imperador') e.addFields({ name: '📅 ANO', value: valorOu(r, 'ano'), inline: true }, { name: '📝 DESCRIÇÃO', value: valorOu(r, 'descricao') }, { name: '🗓️ MESES / VENCEDORES', value: valorOu(r, 'meses') });
    else e.addFields({ name: '📝 DESCRIÇÃO', value: valorOu(r, 'descricao') }, { name: '📊 RECORDS', value: valorOu(r, 'linhas') });
    return e.setFooter({ text: 'Hall da Fama • Gerenciamento administrativo' });
}
async function atualizarMural(guild) { try { const p = require('./painel-ranking.js'); if (typeof p.atualizarMural === 'function') await p.atualizarMural(guild); } catch (e) { console.error('[HALL] mural:', e); } }

async function perguntar(channel, userId, pergunta, valorAtual = '') {
    const aviso = valorAtual ? `\n**Atual:** ${limit(valorAtual, 700)}\nDigite **pular** para manter ou **-** para limpar.` : '\nDigite **pular** para deixar como está ou **-** para deixar vazio.';
    const perguntaMsg = await channel.send(`✏️ **${pergunta}**${aviso}`);
    const resposta = await new Promise(resolve => {
        const col = channel.createMessageCollector({ filter: m => m.author.id === userId && !m.author.bot, max: 1, time: 120000 });
        col.on('collect', m => resolve(m));
        col.on('end', c => { if (!c.size) resolve(null); });
    });
    await perguntaMsg.delete().catch(() => {});
    if (!resposta) throw new Error('TIMEOUT');
    const valor = txt(resposta.content);
    await resposta.delete().catch(() => {});
    if (valor.toLowerCase() === 'pular') return { changed: false };
    if (valor === '-') return { changed: true, value: null };
    return { changed: true, value: valor };
}
function aplicar(r, campo, res) { if (!res.changed) return; if (res.value === null) delete r[campo]; else if (campo === 'meses' || campo === 'linhas') r[campo] = res.value.split('\n').map(x => x.trim()).filter(Boolean); else r[campo] = res.value; }

async function editarNoChat(interaction, categoria, id) {
    const d = carregar(), a = achar(d, categoria, id);
    if (!a.registro) return interaction.reply({ content: '❌ Esse registro não existe mais.', flags: MessageFlags.Ephemeral });
    await interaction.reply({ content: `✏️ Edição iniciada para **${nome(a.registro)}**. Vou fazer as perguntas aqui no chat.`, flags: MessageFlags.Ephemeral });
    const r = a.registro, canal = interaction.channel, uid = interaction.user.id;
    const campos = [{ k: 'nome', p: 'Nome do registro' }];
    if (categoria === 'liga' || categoria === 'imperador') campos.push({ k: 'ano', p: 'Ano' }, { k: 'descricao', p: 'Descrição' }, { k: 'meses', p: 'Meses / vencedores — envie um por linha' });
    else if (categoria === 'records') campos.push({ k: 'descricao', p: 'Descrição' }, { k: 'linhas', p: 'Records — envie um por linha' });
    else campos.push(
        { k: 'vencedor', p: 'Vencedor' }, { k: 'segundo', p: '2º lugar' }, { k: 'terceiro', p: '3º lugar' }, { k: 'participantes', p: 'Participantes' },
        { k: 'valor', p: 'Valor' }, { k: 'premio', p: 'Prêmio' }, { k: 'descricao', p: 'Descrição' }, { k: 'data', p: 'Data' }, { k: 'horario', p: 'Horário' }, { k: 'observacoes', p: 'Observações' }, { k: 'imagem', p: 'Imagem — URL' }
    );
    try {
        for (const f of campos) aplicar(r, f.k, await perguntar(canal, uid, f.p, atual(r, f.k)));
        if (!safeWriteJson(HISTORICO_PATH, d)) throw new Error('SAVE');
        await atualizarMural(interaction.guild);
        await canal.send(`✅ **${nome(r)}** foi editado com sucesso. O Hall da Fama foi atualizado.`);
    } catch (e) {
        await canal.send(e.message === 'TIMEOUT' ? '⏱️ Edição cancelada por falta de resposta durante 2 minutos.' : '❌ Não consegui salvar a edição no historico.json.').catch(() => {});
        console.error('[HALL] edição:', e);
    }
}

async function handler(interaction) {
    if (!admin(interaction)) return interaction.reply({ content: '❌ Apenas administradores podem gerenciar o Hall.', flags: MessageFlags.Ephemeral });
    if (!interaction.isButton()) return;
    const p = interaction.customId.split('_'); if (p[0] !== 'hall' || p[1] !== 'manage') return;
    if (p[2] === 'cancel') return interaction.update({ content: '↩️ Remoção cancelada.', embeds: [], components: [] });
    const categoria = p[3], id = p.slice(4).join('_'), d = carregar(), a = achar(d, categoria, id);
    if (!a.registro) return interaction.reply({ content: '❌ Esse registro não existe mais.', flags: MessageFlags.Ephemeral });
    if (p[2] === 'edit') return editarNoChat(interaction, categoria, id);
    if (p[2] === 'delete') return interaction.update({ content: `⚠️ **Confirma a remoção de ${nome(a.registro)}?**`, embeds: [], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`hall_manage_confirm_${categoria}_${id}`).setLabel('Confirmar remoção').setEmoji('🗑️').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('hall_manage_cancel').setLabel('Cancelar').setEmoji('↩️').setStyle(ButtonStyle.Secondary))] });
    if (p[2] === 'confirm') { const n = nome(a.registro); a.lista.splice(a.indice, 1); if (!safeWriteJson(HISTORICO_PATH, d)) return interaction.reply({ content: '❌ Não consegui salvar a remoção.', flags: MessageFlags.Ephemeral }); await atualizarMural(interaction.guild); return interaction.update({ content: `✅ **${n}** foi removido do Hall da Fama.`, embeds: [], components: [] }); }
}

module.exports = {
    data: new SlashCommandBuilder().setName('hall-gerenciar').setDescription('✏️ Edita ou remove registros do Hall da Fama.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('categoria').setDescription('Categoria do registro.').setRequired(true).addChoices({ name: '🏆 Liga', value: 'liga' }, { name: '⚔️ Eventos', value: 'eventos' }, { name: '📊 Records', value: 'records' }, { name: '👑 Imperador', value: 'imperador' }))
        .addStringOption(o => o.setName('registro').setDescription('Digite parte do nome e escolha o registro.').setRequired(true).setAutocomplete(true)),
    async autocomplete(interaction) {
        if (!admin(interaction)) return interaction.respond([]);
        const c = interaction.options.getString('categoria'); if (!CATEGORIAS.includes(c)) return interaction.respond([]);
        const termo = txt(interaction.options.getString('registro')).toLowerCase(), d = carregar();
        return interaction.respond((d[c] || []).filter(r => { const n = nome(r).toLowerCase(); return !termo || n.includes(termo) || txt(r.id).toLowerCase().includes(termo); }).slice(0, 25).map(r => ({ name: limit(nome(r), 100), value: String(r.id) })));
    },
    async execute(interaction) {
        if (!admin(interaction)) return interaction.reply({ content: '❌ Apenas administradores.', flags: MessageFlags.Ephemeral });
        const c = interaction.options.getString('categoria'), id = interaction.options.getString('registro'), a = achar(carregar(), c, id);
        if (!a.registro) return interaction.reply({ content: '❌ Registro não encontrado. Escolha um item do autocomplete.', flags: MessageFlags.Ephemeral });
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`hall_manage_edit_${c}_${id}`).setLabel('Editar no chat').setEmoji('✏️').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`hall_manage_delete_${c}_${id}`).setLabel('Remover').setEmoji('🗑️').setStyle(ButtonStyle.Danger));
        return interaction.reply({ embeds: [embedResumo(c, a.registro)], components: [row], flags: MessageFlags.Ephemeral });
    },
    handler
};
