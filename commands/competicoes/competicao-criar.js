const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, PermissionFlagsBits } = require('discord.js');
const engine = require('./competitionEngine.js');

const TYPES = [
    ['🏆 Liga', 'liga'],
    ['⚔️ Torneio', 'torneio'],
    ['🎯 Evento', 'evento'],
    ['🏟️ Campeonato', 'campeonato'],
    ['🛡️ Guerra de Clãs', 'clans'],
    ['⚙️ Personalizado', 'personalizado']
];

const ADMIN = PermissionFlagsBits.Administrator;
const sessions = new Map();
const yes = v => /^(sim|s|yes|y|true|1)$/i.test(String(v || '').trim());
const cut = (v, n = 1000) => { const s = String(v ?? ''); return s.length <= n ? s : s.slice(0, n - 3) + '...'; };
const typeLabel = t => TYPES.find(x => x[1] === t)?.[0] || '⚙️ Personalizado';

function embed(c, title = '') {
    const f = [
        ['📝 Geral', `${c.metadata.name}\n${c.metadata.subtitle || 'Sem subtítulo'}`],
        ['🎨 Visual', `${c.visual.banner ? '🖼️ Banner' : '⚪ Sem banner'}\n${c.visual.thumbnail ? '🖼️ Thumbnail' : '⚪ Sem thumbnail'}`],
        ['👥 Participantes', `${c.registration.minimum}–${c.registration.maximum} • ${c.registration.teamMode}`],
        ['❓ Perguntas', `${c.registration.questions.length}`],
        ['⚔️ Fases', `${c.stages.length}`],
        ['📊 Pontuação', `${c.scoring.rules.length}`],
        ['🏆 Prêmios', `${c.rewards.length}`],
        ['📜 Regras', `${c.rules.length}`],
        ['🧩 Campos', `${c.customFields.length}`],
        ['📅 Agenda', `${c.schedule.length}`]
    ];
    const e = new EmbedBuilder()
        .setColor(c.visual.color || '#C9A227')
        .setTitle(title || `${c.metadata.emoji || '🏆'} CONSTRUTOR DE COMPETIÇÃO`)
        .setDescription(`**${cut(c.metadata.name, 256)}**\nTipo: **${typeLabel(c.type)}**\nStatus: **${c.status === 'draft' ? '🟡 RASCUNHO' : c.status.toUpperCase()}**\n\nConfigure tudo pelo Discord antes de publicar.`)
        .addFields(f.map(x => ({ name: x[0], value: x[1], inline: true })))
        .setFooter({ text: c.visual.footer || 'WorldWarBR • Competition Engine' });
    if (c.visual.banner) e.setImage(c.visual.banner);
    if (c.visual.thumbnail) e.setThumbnail(c.visual.thumbnail);
    return e;
}

function rows(c) {
    return [
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`cmp_section:${c.id}`)
                .setPlaceholder('⚙️ Escolha o que configurar')
                .addOptions([
                    { label: '📝 Geral', value: 'general' },
                    { label: '🎨 Visual', value: 'visual' },
                    { label: '👥 Participantes', value: 'participants' },
                    { label: '❓ Perguntas', value: 'questions' },
                    { label: '⚔️ Fases', value: 'stages' },
                    { label: '📊 Pontuação', value: 'scoring' },
                    { label: '🏆 Premiação', value: 'rewards' },
                    { label: '📜 Regras', value: 'rules' },
                    { label: '🧩 Campos', value: 'fields' },
                    { label: '📅 Calendário', value: 'schedule' },
                    { label: '📢 Canais/Cargos', value: 'access' },
                    { label: '🔘 Painel', value: 'panel' },
                    { label: '🤖 Automação', value: 'automation' },
                    { label: '🏛️ Hall da Fama', value: 'hall' }
                ])
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`cmp_preview:${c.id}`).setLabel('Pré-visualizar').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`cmp_save:${c.id}`).setLabel('Salvar').setEmoji('💾').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`cmp_publish:${c.id}`).setLabel('Publicar').setEmoji('🚀').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`cmp_cancel:${c.id}`).setLabel('Cancelar').setEmoji('✖️').setStyle(ButtonStyle.Danger)
        )
    ];
}

function fieldsFor(s, c) {
    if (s === 'general') return [['name', 'Nome', c.metadata.name, true], ['subtitle', 'Subtítulo', c.metadata.subtitle], ['description', 'Descrição', c.metadata.description, false, true], ['season', 'Temporada', c.metadata.season], ['edition', 'Edição', c.metadata.edition]];
    if (s === 'visual') return [['color', 'Cor HEX', c.visual.color], ['banner', 'URL banner', c.visual.banner], ['thumbnail', 'URL thumbnail', c.visual.thumbnail], ['logo', 'URL logo', c.visual.logo], ['footer', 'Rodapé', c.visual.footer]];
    if (s === 'participants') return [['minimum', 'Mínimo', c.registration.minimum], ['maximum', 'Máximo', c.registration.maximum], ['reserves', 'Reservas', c.registration.reserves], ['teamMode', 'Modo', c.registration.teamMode]];
    if (s === 'questions') return [['title', 'Pergunta', null, true], ['type', 'Tipo', null, true], ['required', 'Obrigatória? sim/não', 'sim'], ['options', 'Opções, uma por linha', '', false, true]];
    if (s === 'stages') return [['name', 'Nome da fase', null, true], ['format', 'Formato', null, true], ['rounds', 'Rodadas', '1'], ['qualify', 'Classificam', ''], ['bestOf', 'Melhor de', '1']];
    if (s === 'scoring') return [['name', 'Nome da regra', null, true], ['condition', 'Condição ex.: result=win', null, true], ['points', 'Pontos', '0', true], ['description', 'Descrição', '', false, true]];
    if (s === 'rewards') return [['name', 'Nome do prêmio', null, true], ['place', 'Colocação', null, true], ['value', 'Valor/recompensa'], ['description', 'Descrição', '', false, true]];
    if (s === 'rules') return [['title', 'Título', null, true], ['text', 'Texto', null, true, true]];
    if (s === 'fields') return [['name', 'Nome do campo', null, true], ['type', 'Tipo', null, true], ['required', 'Obrigatório? sim/não', 'não'], ['description', 'Descrição']];
    if (s === 'schedule') return [['name', 'Nome', null, true], ['date', 'Data e hora', null, true], ['description', 'Descrição', '', false, true]];
    if (s === 'access') return [['panelChannel', 'Canal painel', c.channels.panel || ''], ['registrationChannel', 'Canal inscrição', c.channels.registration || ''], ['resultsChannel', 'Canal resultados', c.channels.results || ''], ['managerRole', 'Cargo gestor', c.roles.manager || '']];
    if (s === 'panel') return [['title', 'Título', c.panel.title], ['description', 'Descrição', c.panel.description, false, true], ['buttons', 'Botões emoji|texto|ação', c.panel.buttons.map(b => `${b.emoji || '🔘'}|${b.label || 'Ação'}|${b.action || 'noop'}`).join('\n'), false, true]];
    if (s === 'automation') return [['reminders', 'Lembretes? sim/não', yes(c.automation.reminders) ? 'sim' : 'não'], ['matchNotifications', 'Avisar partidas? sim/não', yes(c.automation.matchNotifications) ? 'sim' : 'não'], ['resultNotifications', 'Avisar resultados? sim/não', yes(c.automation.resultNotifications) ? 'sim' : 'não'], ['autoWalkover', 'W.O. automático? sim/não', yes(c.automation.autoWalkover) ? 'sim' : 'não']];
    if (s === 'hall') return [['enabled', 'Ativar? sim/não', yes(c.hallOfFame.enabled) ? 'sim' : 'não'], ['category', 'Categoria', c.hallOfFame.category], ['image', 'URL imagem', c.hallOfFame.image]];
    return null;
}

async function modal(i, c, s) {
    const fs = fieldsFor(s, c);
    if (!fs) return i.reply({ content: '❌ Seção inválida.', flags: MessageFlags.Ephemeral });
    const m = new ModalBuilder().setCustomId(`cmp_modal:${c.id}:${s}`).setTitle(`⚙️ ${s}`.slice(0, 45));
    m.addComponents(...fs.slice(0, 5).map(([id, label, value, required, long]) => new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(label.slice(0, 45)).setStyle(long ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(Boolean(required)).setValue(String(value ?? '').slice(0, 4000))
    )));
    return i.showModal(m);
}

function apply(c, s, i) {
    const v = k => { try { return i.fields.getTextInputValue(k); } catch { return ''; } };
    if (s === 'general') Object.assign(c.metadata, { name: v('name'), subtitle: v('subtitle'), description: v('description'), season: v('season'), edition: v('edition') });
    else if (s === 'visual') Object.assign(c.visual, { color: v('color') || '#C9A227', banner: v('banner'), thumbnail: v('thumbnail'), logo: v('logo'), footer: v('footer') });
    else if (s === 'participants') Object.assign(c.registration, { minimum: Math.max(1, Number(v('minimum')) || 1), maximum: Math.max(1, Number(v('maximum')) || 32), reserves: Math.max(0, Number(v('reserves')) || 0), teamMode: v('teamMode') || 'individual' });
    else if (s === 'questions') c.registration.questions.push({ id: engine.id('q'), title: v('title'), type: v('type'), required: yes(v('required')), options: v('options').split('\n').map(x => x.trim()).filter(Boolean) });
    else if (s === 'stages') c.stages.push({ id: engine.id('stage'), name: v('name'), format: v('format'), rounds: Math.max(1, Number(v('rounds')) || 1), qualify: v('qualify'), bestOf: Math.max(1, Number(v('bestOf')) || 1), status: 'pending' });
    else if (s === 'scoring') c.scoring.rules.push({ id: engine.id('score'), name: v('name'), condition: v('condition'), points: Number(v('points')) || 0, description: v('description') });
    else if (s === 'rewards') c.rewards.push({ id: engine.id('reward'), name: v('name'), place: v('place'), value: v('value'), description: v('description') });
    else if (s === 'rules') c.rules.push({ id: engine.id('rule'), title: v('title'), text: v('text') });
    else if (s === 'fields') c.customFields.push({ id: engine.id('field'), name: v('name'), type: v('type'), required: yes(v('required')), description: v('description') });
    else if (s === 'schedule') c.schedule.push({ id: engine.id('date'), name: v('name'), date: v('date'), description: v('description') });
    else if (s === 'access') { c.channels.panel = v('panelChannel'); c.channels.registration = v('registrationChannel'); c.channels.results = v('resultsChannel'); c.roles.manager = v('managerRole'); }
    else if (s === 'panel') { c.panel.title = v('title'); c.panel.description = v('description'); c.panel.buttons = v('buttons').split('\n').filter(Boolean).map(x => { const [emoji, label, action] = x.split('|'); return { emoji: emoji || '🔘', label: label || 'Ação', action: action || 'noop' }; }); }
    else if (s === 'automation') Object.assign(c.automation, { reminders: yes(v('reminders')), matchNotifications: yes(v('matchNotifications')), resultNotifications: yes(v('resultNotifications')), autoWalkover: yes(v('autoWalkover')) });
    else if (s === 'hall') Object.assign(c.hallOfFame, { enabled: yes(v('enabled')), category: v('category') || 'eventos', image: v('image') });
}

async function create(i, type) {
    const c = engine.defaultCompetition(type, i.user.id);
    engine.save(c, i.user.id, 'create_draft');
    sessions.set(c.id, { userId: i.user.id });

    const msg = await i.reply({ embeds: [embed(c)], components: rows(c), flags: MessageFlags.Ephemeral, fetchReply: true });
    const collector = msg.createMessageComponentCollector({ filter: x => x.user.id === i.user.id, time: 30 * 60 * 1000 });

    const onModal = async x => {
        if (!x.isModalSubmit() || x.user.id !== i.user.id || !x.customId.startsWith(`cmp_modal:${c.id}:`)) return;
        const s = x.customId.split(':')[2];
        try {
            apply(c, s, x);
            engine.save(c, i.user.id, `configure_${s}`);
            await x.reply({ content: `✅ **${s}** atualizado.`, flags: MessageFlags.Ephemeral });
            await msg.edit({ embeds: [embed(c)], components: rows(c) });
        } catch (err) {
            console.error('[COMPETICOES] modal', err);
            await x.reply({ content: '❌ Falha ao salvar.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    };

    i.client.on('interactionCreate', onModal);

    collector.on('collect', async x => {
        try {
            if (x.isStringSelectMenu() && x.customId === `cmp_section:${c.id}`) return modal(x, c, x.values[0]);
            if (!x.isButton()) return;
            if (x.customId === `cmp_preview:${c.id}`) return x.reply({ embeds: [embed(c, `${c.metadata.emoji || '🏆'} PRÉ-VISUALIZAÇÃO`)], flags: MessageFlags.Ephemeral });
            if (x.customId === `cmp_save:${c.id}`) { engine.snapshot(c, i.user.id, 'manual'); engine.save(c, i.user.id, 'snapshot'); return x.reply({ content: `💾 Versão ${c.version} salva.`, flags: MessageFlags.Ephemeral }); }
            if (x.customId === `cmp_publish:${c.id}`) {
                const v = engine.validate(c);
                if (!v.valid) return x.reply({ content: `❌ Não pode publicar:\n${v.errors.map(z => '• ' + z).join('\n')}`, flags: MessageFlags.Ephemeral });
                c.status = 'published';
                engine.save(c, i.user.id, 'publish');
                await x.update({ embeds: [embed(c)], components: [] });
                return collector.stop('published');
            }
            if (x.customId === `cmp_cancel:${c.id}`) {
                await x.update({ content: '✖️ Criação cancelada.', embeds: [], components: [] });
                collector.stop('cancelled');
            }
        } catch (err) {
            console.error('[COMPETICOES] builder', err);
            if (!x.replied && !x.deferred) await x.reply({ content: '❌ Erro no construtor.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    });

    collector.on('end', () => { i.client.off('interactionCreate', onModal); sessions.delete(c.id); });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('competicao-criar')
        .setDescription('🏆 Cria uma competição totalmente configurável.')
        .setDefaultMemberPermissions(ADMIN)
        .addStringOption(o => o.setName('tipo').setDescription('Tipo da competição').setRequired(true).addChoices(...TYPES.map(([name, value]) => ({ name, value })))),

    async execute(i) {
        if (!i.memberPermissions?.has(ADMIN)) return i.reply({ content: '❌ Apenas administradores.', flags: MessageFlags.Ephemeral });
        return create(i, i.options.getString('tipo'));
    }
};
