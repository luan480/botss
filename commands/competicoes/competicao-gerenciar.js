const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');
const engine = require('./competitionEngine.js');

const ADMIN = PermissionFlagsBits.Administrator;
const cut = (v, n = 1000) => { const s = String(v ?? ''); return s.length <= n ? s : `${s.slice(0, n - 3)}...`; };

function label(c) {
    const types = { liga: '🏆 Liga', torneio: '⚔️ Torneio', evento: '🎯 Evento', campeonato: '🏟️ Campeonato', clans: '🛡️ Guerra de Clãs', personalizado: '⚙️ Personalizado' };
    return types[c.type] || c.type;
}

function isAdmin(i) { return Boolean(i.memberPermissions?.has(ADMIN)); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('competicao-gerenciar')
        .setDescription('⚙️ Gerencia competições criadas pelo Competition Engine.')
        .setDefaultMemberPermissions(ADMIN)
        .addStringOption(o => o.setName('acao').setDescription('Ação').setRequired(true).addChoices(
            { name: '📋 Listar', value: 'listar' },
            { name: '🔎 Ver', value: 'ver' },
            { name: '📋 Duplicar', value: 'duplicar' },
            { name: '🗑️ Excluir', value: 'excluir' },
            { name: '⏸️ Pausar', value: 'pausar' },
            { name: '▶️ Retomar', value: 'retomar' },
            { name: '🏁 Encerrar', value: 'encerrar' }
        ))
        .addStringOption(o => o.setName('id').setDescription('ID da competição (use autocomplete)').setAutocomplete(true)),

    async autocomplete(i) {
        if (!isAdmin(i)) return i.respond([]);
        const q = (i.options.getString('id') || '').toLowerCase();
        return i.respond(engine.list().filter(c => `${c.id} ${c.metadata?.name || ''}`.toLowerCase().includes(q)).slice(0, 25).map(c => ({ name: cut(`${c.metadata?.name || 'Sem nome'} • ${c.status}`, 100), value: c.id })));
    },

    async execute(i) {
        if (!isAdmin(i)) return i.reply({ content: '❌ Apenas administradores podem gerenciar competições.', flags: MessageFlags.Ephemeral });
        const action = i.options.getString('acao');
        const id = i.options.getString('id');
        const all = engine.list();

        if (action === 'listar') {
            if (!all.length) return i.reply({ content: '📭 Nenhuma competição cadastrada.', flags: MessageFlags.Ephemeral });
            const e = new EmbedBuilder().setColor('#C9A227').setTitle('🏆 COMPETIÇÕES WORLDWARBR').setDescription(all.slice(0, 20).map((c, n) => `${n + 1}. **${cut(c.metadata?.name || 'Sem nome', 80)}**\n> ${label(c)} • ${c.status} • \`${c.id}\``).join('\n\n')).setFooter({ text: `${all.length} competição(ões) cadastrada(s)` });
            return i.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
        }

        if (!id) return i.reply({ content: '❌ Informe o **id** da competição.', flags: MessageFlags.Ephemeral });
        const c = engine.get(id);
        if (!c) return i.reply({ content: '❌ Competição não encontrada. Use o autocomplete.', flags: MessageFlags.Ephemeral });

        if (action === 'ver') {
            const e = new EmbedBuilder().setColor(c.visual?.color || '#C9A227').setTitle(`${c.metadata?.emoji || '🏆'} ${c.metadata?.name || 'Competição'}`).setDescription(c.metadata?.description || 'Sem descrição').addFields(
                { name: 'Tipo', value: label(c), inline: true },
                { name: 'Status', value: c.status, inline: true },
                { name: 'Participantes', value: `${c.participants?.length || 0}/${c.registration?.maximum || 0}`, inline: true },
                { name: 'Perguntas', value: String(c.registration?.questions?.length || 0), inline: true },
                { name: 'Fases', value: String(c.stages?.length || 0), inline: true },
                { name: 'Regras de pontos', value: String(c.scoring?.rules?.length || 0), inline: true },
                { name: 'Prêmios', value: String(c.rewards?.length || 0), inline: true },
                { name: 'ID', value: `\`${c.id}\`` }
            );
            if (c.visual?.banner) e.setImage(c.visual.banner);
            return i.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
        }

        if (action === 'duplicar') {
            const copy = engine.duplicate(c, i.user.id);
            return i.reply({ content: `📋 Competição duplicada com sucesso.\n**${copy.metadata.name}**\nNovo ID: \`${copy.id}\`\n\nAbra uma nova criação para continuar a configuração.`, flags: MessageFlags.Ephemeral });
        }

        const statusMap = { pausar: 'paused', retomar: 'published', encerrar: 'finished' };
        if (statusMap[action]) {
            c.status = statusMap[action];
            engine.save(c, i.user.id, action);
            return i.reply({ content: `✅ **${c.metadata.name}** agora está como **${c.status}**.`, flags: MessageFlags.Ephemeral });
        }

        if (action === 'excluir') {
            const remaining = all.filter(x => x.id !== c.id);
            engine.saveAll ? engine.saveAll(remaining) : (() => { throw new Error('saveAll indisponível'); })();
            return i.reply({ content: `🗑️ **${c.metadata.name}** foi excluída.`, flags: MessageFlags.Ephemeral });
        }
    }
};
