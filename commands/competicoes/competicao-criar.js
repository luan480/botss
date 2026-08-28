const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');
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
const state = new Map();

function canManage(i) { return Boolean(i.memberPermissions?.has(ADMIN)); }
function cut(v, n = 1000) { const s = String(v ?? ''); return s.length <= n ? s : `${s.slice(0, n - 3)}...`; }
function typeLabel(type) { return TYPES.find(x => x[1] === type)?.[0] || '⚙️ Personalizado'; }

function builderEmbed(c) {
    const q = c.registration.questions.length;
    const fields = [
        { name: '📝 Geral', value: `${c.metadata.name || '—'}\n${c.metadata.subtitle || 'Sem subtítulo'}`, inline: true },
        { name: '🎨 Visual', value: `${c.visual.banner ? '🖼️ Banner definido' : '⚪ Sem banner'}\nCor: ${c.visual.color}`, inline: true },
        { name: '👥 Participantes', value: `${c.registration.minimum}–${c.registration.maximum}\n${c.registration.teamMode}`, inline: true },
        { name: '❓ Perguntas', value: `${q} configurada(s)`, inline: true },
        { name: '⚔️ Fases', value: `${c.stages.length} configurada(s)`, inline: true },
        { name: '📊 Pontuação', value: `${c.scoring.rules.length} regra(s)`, inline: true },
        { name: '🏆 Premiação', value: `${c.rewards.length} prêmio(s)`, inline: true },
        { name: '📜 Regras', value: `${c.rules.length} regra(s)`, inline: true },
        { name: '🧩 Campos', value: `${c.customFields.length} personalizado(s)`, inline: true }
    ];
    return new EmbedBuilder()
        .setColor(c.visual.color || '#C9A227')
        .setTitle(`${c.metadata.emoji || '🏆'} CONSTRUTOR DE COMPETIÇÃO`)
        .setDescription(`**${cut(c.metadata.name || 'Nova Competição', 256)}**\nTipo: **${typeLabel(c.type)}**\nStatus: **${c.status === 'draft' ? '🟡 RASCUNHO' : c.status.toUpperCase()}**\n\nConfigure cada seção abaixo. Você pode voltar e alterar tudo antes de publicar.`)
        .addFields(fields)
        .setFooter({ text: 'WorldWarBR • Competition Engine' });
}

function components(c) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`cmp_section_${c.id}`)
        .setPlaceholder('⚙️ Escolha uma seção para configurar')
        .addOptions(
            { label: '📝 Geral', value: 'general', description: 'Nome, descrição, temporada e organizador' },
            { label: '🎨 Visual', value: 'visual', description: 'Banner, thumbnail, logo, cor e textos' },
            { label: '👥 Participantes', value: 'participants', description: 'Limites, equipes e inscrição' },
            { label: '❓ Perguntas', value: 'questions', description: 'Crie e edite perguntas da inscrição' },
            { label: '⚔️ Fases e formato', value: 'stages', description: 'Monte fases, grupos e mata-mata' },
            { label: '📊 Pontuação', value: 'scoring', description: 'Crie regras e critérios de desempate' },
            { label: '🏆 Premiação', value: 'rewards', description: 'Configure prêmios e conquistas' },
            { label: '📜 Regras', value: 'rules', description: 'Adicione regras personalizadas' },
            { label: '🧩 Campos personalizados', value: 'fields', description: 'Crie campos de qualquer tipo' },
            { label: '📅 Calendário', value: 'schedule', description: 'Datas e horários' },
            { label: '📢 Canais e cargos', value: 'access', description: 'Onde publicar e quem gerencia' },
            { label: '🔘 Painel', value: 'panel', description: 'Botões e textos do painel público' },
            { label: '🤖 Automação', value: 'automation', description: 'Avisos, W.O. e notificações' },
            { label: '🏛️ Hall da Fama', value: 'hall', description: 'Integração com o Hall da Fama' }
        );
    const row1 = new ActionRowBuilder().addComponents(menu);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cmp_preview_${c.id}`).setLabel('Pré-visualizar').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`cmp_snapshot_${c.id}`).setLabel('Salvar versão').setEmoji('💾').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`cmp_publish_${c.id}`).setLabel('Publicar').setEmoji('🚀').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`cmp_cancel_${c.id}`).setLabel('Cancelar').setEmoji('✖️').setStyle(ButtonStyle.Danger)
    );
    return [row1, row2];
}

async function askModal(interaction, idValue, title, fields) {
    const modal = new ModalBuilder().setCustomId(`cmp_modal_${idValue}`).setTitle(title.slice(0, 45));
    modal.addComponents(...fields.map(f => new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId(f.id).setLabel(f.label.slice(0, 45)).setStyle(f.long ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(Boolean(f.required)).setPlaceholder(f.placeholder || '').setValue(String(f.value ?? '').slice(0, 4000))
    )));
    await interaction.showModal(modal);
}

async function refresh(message, c) {
    await message.edit({ embeds: [builderEmbed(c)], components: components(c) }).catch(() => {});
}

function addQuestion(c, data) {
    c.registration.questions.push({ id: engine.id('q'), title: data.title, type: data.type, required: data.required, options: data.options ? data.options.split('\n').map(x => x.trim()).filter(Boolean) : [] });
}

async function section(interaction, c, sectionName) {
    if (sectionName === 'general') return askModal(interaction, c.id, '📝 Informações gerais', [
        { id: 'name', label: 'Nome', value: c.metadata.name, required: true },
        { id: 'subtitle', label: 'Subtítulo', value: c.metadata.subtitle },
        { id: 'description', label: 'Descrição', value: c.metadata.description, long: true },
        { id: 'season', label: 'Temporada / edição', value: c.metadata.season },
        { id: 'organizer', label: 'Organizador', value: c.metadata.organizer }
    ]);
    if (sectionName === 'visual') return askModal(interaction, c.id, '🎨 Aparência', [
        { id: 'color', label: 'Cor hexadecimal', value: c.visual.color, placeholder: '#C9A227' },
        { id: 'banner', label: 'URL do banner', value: c.visual.banner },
        { id: 'thumbnail', label: 'URL da thumbnail', value: c.visual.thumbnail },
        { id: 'logo', label: 'URL da logo', value: c.visual.logo },
        { id: 'footer', label: 'Rodapé', value: c.visual.footer }
    ]);
    if (sectionName === 'participants') return askModal(interaction, c.id, '👥 Participantes', [
        { id: 'minimum', label: 'Mínimo', value: c.registration.minimum },
        { id: 'maximum', label: 'Máximo', value: c.registration.maximum },
        { id: 'reserves', label: 'Reservas', value: c.registration.reserves },
        { id: 'teamMode', label: 'Modo', value: c.registration.teamMode, placeholder: 'individual, dupla, equipe, clã...' }
    ]);
    if (sectionName === 'questions') return askModal(interaction, c.id, '❓ Nova pergunta', [
        { id: 'title', label: 'Pergunta', required: true },
        { id: 'type', label: 'Tipo', required: true, placeholder: 'text, long, number, select, multi, yesno, user, role, channel, date, time, image, file, url' },
        { id: 'required', label: 'Obrigatória? sim/não', value: 'sim' },
        { id: 'options', label: 'Opções (uma por linha)', long: true }
    ]);
    if (sectionName === 'stages') return askModal(interaction, c.id, '⚔️ Nova fase', [
        { id: 'name', label: 'Nome da fase', required: true },
        { id: 'format', label: 'Formato', required: true, placeholder: 'grupos, pontos, mata-mata, suíço, manual...' },
        { id: 'rounds', label: 'Rodadas', value: '1' },
        { id: 'qualify', label: 'Classificam', value: '' },
        { id: 'bestOf', label: 'Melhor de', value: '1' }
    ]);
    if (sectionName === 'scoring') return askModal(interaction, c.id, '📊 Nova regra de pontuação', [
        { id: 'name', label: 'Nome da regra', required: true },
        { id: 'condition', label: 'Condição', required: true, placeholder: 'ex.: resultado=win' },
        { id: 'points', label: 'Pontos', required: true, value: '0' },
        { id: 'description', label: 'Descrição', long: true }
    ]);
    if (sectionName === 'rewards') return askModal(interaction, c.id, '🏆 Novo prêmio', [
        { id: 'name', label: 'Nome', required: true },
        { id: 'place', label: 'Colocação', required: true, placeholder: '1, 2, 3, MVP...' },
        { id: 'value', label: 'Valor / recompensa' },
        { id: 'description', label: 'Descrição', long: true }
    ]);
    if (sectionName === 'rules') return askModal(interaction, c.id, '📜 Nova regra', [
        { id: 'title', label: 'Título', required: true },
        { id: 'text', label: 'Texto da regra', required: true, long: true }
    ]);
    if (sectionName === 'fields') return askModal(interaction, c.id, '🧩 Campo personalizado', [
        { id: 'name', label: 'Nome do campo', required: true },
        { id: 'type', label: 'Tipo', required: true, placeholder: 'text, number, select, image, date...' },
        { id: 'required', label: 'Obrigatório? sim/não', value: 'não' },
        { id: 'description', label: 'Descrição' }
    ]);
    if (sectionName === 'schedule') return askModal(interaction, c.id, '📅 Novo evento do calendário', [
        { id: 'name', label: 'Nome', required: true },
        { id: 'date', label: 'Data', required: true, placeholder: 'YYYY-MM-DD HH:mm' },
        { id: 'description', label: 'Descrição', long: true }
    ]);
    if (sectionName === 'panel') return askModal(interaction, c.id, '🔘 Painel público', [
        { id: 'title', label: 'Título', value: c.panel.title },
        { id: 'description', label: 'Descrição', value: c.panel.description, long: true },
        { id: 'buttons', label: 'Botões (um por linha)', value: c.panel.buttons.map(x => `${x.emoji || ''}|${x.label}|${x.action}`).join('\n'), long: true, placeholder: 'emoji|texto|acao' }
    ]);
    if (sectionName === 'automation') return askModal(interaction, c.id, '🤖 Automação', [
        { id: 'reminders', label: 'Lembretes? sim/não', value: c.automation.reminders ? 'sim' : 'não' },
        { id: 'matchNotifications', label: 'Avisar partidas? sim/não', value: c.automation.matchNotifications ? 'sim' : 'não' },
        { id: 'resultNotifications', label: 'Avisar resultados? sim/não', value: c.automation.resultNotifications ? 'sim' : 'não' },
        { id: 'autoWalkover', label: 'W.O. automático? sim/não', value: c.automation.autoWalkover ? 'sim' : 'não' }
    ]);
    if (sectionName === 'hall') return askModal(interaction, c.id, '🏛️ Hall da Fama', [
        { id: 'enabled', label: 'Ativar? sim/não', value: c.hallOfFame.enabled ? 'sim' : 'não' },
        { id: 'category', label: 'Categoria', value: c.hallOfFame.category, placeholder: 'liga, eventos, records, imperador' },
        { id: 'image', label: 'URL da imagem', value: c.hallOfFame.image }
    ]);
    if (sectionName === 'access') return askModal(interaction, c.id, '📢 Canais e cargos', [
        { id: 'panelChannel', label: 'Canal do painel', value: c.channels.panel || '' },
        { id: 'registrationChannel', label: 'Canal de inscrições', value: c.channels.registration || '' },
        { id: 'resultsChannel', label: 'Canal de resultados', value: c.channels.results || '' },
        { id: 'managerRole', label: 'Cargo de gestor', value: c.roles.manager || '' }
    ]);
}

async function create(i) {
    const c = engine.defaultCompetition('personalizado', i.user.id);
    state.set(c.id, c);
    const menu = new StringSelectMenuBuilder().setCustomId(`cmp_type_${c.id}`).setPlaceholder('Escolha o modelo inicial').addOptions(TYPES.map(([label, value]) => ({ label: label.slice(0, 100), value })));
    const msg = await i.reply({ embeds: [builderEmbed(c)], components: [new ActionRowBuilder().addComponents(menu)], flags: MessageFlags.Ephemeral, fetchReply: true });
    const collector = msg.createMessageComponentCollector({ time: 30 * 60 * 1000, filter: x => x.user.id === i.user.id });
    collector.on('collect', async x => {
        try {
            if (x.isStringSelectMenu() && x.customId === `cmp_type_${c.id}`) {
                c.type = x.values[0];
                await x.update({ embeds: [builderEmbed(c)], components: components(c) });
                return;
            }
            if (x.isStringSelectMenu() && x.customId === `cmp_section_${c.id}`) {
                await x.deferUpdate();
                await section(x, c, x.values[0]);
                return;
            }
            if (x.isButton() && x.customId === `cmp_preview_${c.id}`) {
                const e = builderEmbed(c).setTitle(`${c.metadata.emoji || '🏆'} PRÉ-VISUALIZAÇÃO • ${c.metadata.name || 'Competição'}`).setImage(c.visual.banner || null).setThumbnail(c.visual.thumbnail || null);
                await x.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
                return;
            }
            if (x.isButton() && x.customId === `cmp_snapshot_${c.id}`) {
                engine.snapshot(c, i.user.id, 'manual');
                engine.save(c, i.user.id, 'snapshot');
                await x.reply({ content: `💾 Versão **${c.version}** salva.`, flags: MessageFlags.Ephemeral });
                return;
            }
            if (x.isButton() && x.customId === `cmp_publish_${c.id}`) {
                if (!c.metadata.name || c.metadata.name === 'Nova Competição') return x.reply({ content: '❌ Defina um nome antes de publicar.', flags: MessageFlags.Ephemeral });
                c.status = 'published';
                engine.save(c, i.user.id, 'publish');
                await x.update({ embeds: [builderEmbed(c)], components: [] });
                collector.stop('published');
                return;
            }
            if (x.isButton() && x.customId === `cmp_cancel_${c.id}`) {
                state.delete(c.id);
                await x.update({ content: '✖️ Criação cancelada.', embeds: [], components: [] });
                collector.stop('cancelled');
            }
        } catch (e) { console.error('[COMPETICOES] builder:', e); if (!x.replied && !x.deferred) await x.reply({ content: '❌ Erro no construtor.', flags: MessageFlags.Ephemeral }).catch(() => {}); }
    });
    // Modal submissions are routed here while this builder is active.
    const modalCollector = i.channel.createMessageComponentCollector ? null : null;
    const client = i.client;
    const onModal = async interaction => {
        if (!interaction.isModalSubmit() || interaction.customId !== `cmp_modal_${c.id}` || interaction.user.id !== i.user.id) return;
        try {
            const v = id => interaction.fields.getTextInputValue(id);
            const action = state.get(c.id);
            if (!action) return;
            const currentSection = interaction.customId;
            // Infer the target from the fields present; this keeps the builder modular.
            const ids = interaction.fields.fields.map(f => f.customId);
            if (ids.includes('color')) Object.assign(c.visual, { color: v('color') || c.visual.color, banner: v('banner'), thumbnail: v('thumbnail'), logo: v('logo'), footer: v('footer') });
            else if (ids.includes('minimum')) Object.assign(c.registration, { minimum: Number(v('minimum')) || 1, maximum: Number(v('maximum')) || 32, reserves: Number(v('reserves')) || 0, teamMode: v('teamMode') || 'individual' });
            else if (ids.includes('condition')) c.scoring.rules.push({ id: engine.id('score'), name: v('name'), condition: v('condition'), points: Number(v('points')) || 0, description: v('description') });
            else if (ids.includes('place')) c.rewards.push({ id: engine.id('reward'), name: v('name'), place: v('place'), value: v('value'), description: v('description') });
            else if (ids.includes('text') && ids.includes('title')) c.rules.push({ id: engine.id('rule'), title: v('title'), text: v('text') });
            else if (ids.includes('options')) addQuestion(c, { title: v('title'), type: v('type'), required: /^(sim|yes|true|1)$/i.test(v('required')), options: v('options') });
            else if (ids.includes('bestOf')) c.stages.push({ id: engine.id('stage'), name: v('name'), format: v('format'), rounds: Number(v('rounds')) || 1, qualify: v('qualify'), bestOf: Number(v('bestOf')) || 1 });
            else if (ids.includes('description') && ids.includes('name') && ids.includes('date')) c.schedule.push({ id: engine.id('date'), name: v('name'), date: v('date'), description: v('description') });
            else if (ids.includes('required') && ids.includes('description') && !ids.includes('options')) c.customFields.push({ id: engine.id('field'), name: v('name'), type: v('type'), required: /^(sim|yes|true|1)$/i.test(v('required')), description: v('description') });
            else if (ids.includes('buttons')) { c.panel.title = v('title'); c.panel.description = v('description'); c.panel.buttons = v('buttons').split('\n').filter(Boolean).map(line => { const [emoji, label, actionName] = line.split('|'); return { emoji: emoji || '🔘', label: label || 'Ação', action: actionName || 'noop' }; }); }
            else if (ids.includes('reminders')) Object.assign(c.automation, { reminders: /^(sim|yes|true|1)$/i.test(v('reminders')), matchNotifications: /^(sim|yes|true|1)$/i.test(v('matchNotifications')), resultNotifications: /^(sim|yes|true|1)$/i.test(v('resultNotifications')), autoWalkover: /^(sim|yes|true|1)$/i.test(v('autoWalkover')) });
            else if (ids.includes('category')) Object.assign(c.hallOfFame, { enabled: /^(sim|yes|true|1)$/i.test(v('enabled')), category: v('category') || 'eventos', image: v('image') });
            else if (ids.includes('panelChannel')) Object.assign(c.channels, { panel: v('panelChannel'), registration: v('registrationChannel'), results: v('resultsChannel') }), c.roles.manager = v('managerRole');
            else if (ids.includes('season')) Object.assign(c.metadata, { name: v('name'), subtitle: v('subtitle'), description: v('description'), season: v('season'), organizer: v('organizer') });
            engine.save(c, i.user.id, 'edit');
            await interaction.reply({ content: '✅ Alteração salva no construtor.', flags: MessageFlags.Ephemeral });
            await refresh(msg, c);
        } catch (e) { console.error('[COMPETICOES] modal:', e); await interaction.reply({ content: '❌ Não foi possível salvar essa alteração.', flags: MessageFlags.Ephemeral }).catch(() => {}); }
    };
    client.on('interactionCreate', onModal);
    collector.on('end', () => { client.off('interactionCreate', onModal); state.delete(c.id); });
}

module.exports = {
    data: new SlashCommandBuilder().setName('competicao-criar').setDescription('🏆 Cria uma competição totalmente configurável.').setDefaultMemberPermissions(ADMIN),
    async execute(interaction) {
        if (!canManage(interaction)) return interaction.reply({ content: '❌ Apenas administradores podem criar competições.', flags: MessageFlags.Ephemeral });
        return create(interaction);
    }
};
