const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const e = require('./competitionEngine');

const ADMIN = PermissionFlagsBits.Administrator;
const SECTIONS = [
    ['📝 Geral', 'general'], ['🎨 Visual', 'visual'], ['👥 Participantes', 'participants'],
    ['❓ Perguntas', 'questions'], ['⚔️ Fases', 'stages'], ['📊 Pontuação', 'scoring'],
    ['🏆 Prêmios', 'rewards'], ['📜 Regras', 'rules'], ['🧩 Campos', 'fields'],
    ['📅 Calendário', 'schedule'], ['📢 Canais/Cargos', 'access'], ['🔘 Painel', 'panel'],
    ['🤖 Automação', 'automation'], ['🏛️ Hall da Fama', 'hall']
];
const ARRAYS = new Set(['questions', 'stages', 'scoring', 'rewards', 'rules', 'fields', 'schedule']);
const isAdmin = i => Boolean(i.memberPermissions?.has(ADMIN));
const cut = (v, n = 1000) => { const s = String(v ?? ''); return s.length <= n ? s : `${s.slice(0, n - 3)}...`; };
const get = i => e.get(i.options.getString('id'));
const getArray = (c, type) => type === 'questions' ? c.registration.questions : c[type];
const parse = s => { try { return JSON.parse(s || '{}'); } catch { return null; } };
const itemName = x => x?.name || x?.title || x?.label || x?.question || x?.id || 'Sem nome';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('competicao-configurar')
        .setDescription('🧩 Edita qualquer parte de uma competição.')
        .setDefaultMemberPermissions(ADMIN)
        .addStringOption(o => o.setName('acao').setDescription('Ação').setRequired(true).addChoices(
            { name: '➕ Adicionar item', value: 'add' },
            { name: '✏️ Editar item/configuração', value: 'edit' },
            { name: '🗑️ Remover item', value: 'remove' },
            { name: '⬆️ Subir item', value: 'up' },
            { name: '⬇️ Descer item', value: 'down' },
            { name: '📋 Listar', value: 'list' },
            { name: '💾 Snapshot', value: 'snapshot' },
            { name: '🧪 Validar', value: 'validate' }
        ))
        .addStringOption(o => o.setName('id').setDescription('Competição').setRequired(true).setAutocomplete(true))
        .addStringOption(o => o.setName('tipo').setDescription('Seção').setRequired(false).addChoices(...SECTIONS.map(([name, value]) => ({ name, value }))))
        .addIntegerOption(o => o.setName('indice').setDescription('Item da lista, começando em 1'))
        .addStringOption(o => o.setName('dados').setDescription('JSON. Para objetos, envie a configuração completa/parcial.')),

    async autocomplete(i) {
        if (!isAdmin(i)) return i.respond([]);
        const q = (i.options.getString('id') || '').toLowerCase();
        return i.respond(e.list().filter(c => `${c.id} ${c.metadata?.name || ''}`.toLowerCase().includes(q)).slice(0, 25).map(c => ({
            name: cut(`${c.metadata?.name || 'Sem nome'} • ${c.type} • ${c.status}`, 100),
            value: c.id
        })));
    },

    async execute(i) {
        if (!isAdmin(i)) return i.reply({ content: '❌ Apenas administradores.', flags: MessageFlags.Ephemeral });
        const c = get(i);
        if (!c) return i.reply({ content: '❌ Competição não encontrada.', flags: MessageFlags.Ephemeral });

        const action = i.options.getString('acao');
        const type = i.options.getString('tipo');
        const idx = i.options.getInteger('indice');
        const raw = i.options.getString('dados');

        if (action === 'snapshot') {
            e.snapshot(c, i.user.id, 'manual');
            e.save(c, i.user.id, 'snapshot');
            return i.reply({ content: `💾 Snapshot criado. Versão **${c.version}**.`, flags: MessageFlags.Ephemeral });
        }

        if (action === 'validate') {
            const v = e.validate(c);
            return i.reply({ content: `${v.valid ? '✅ CONFIGURAÇÃO VÁLIDA' : '❌ CONFIGURAÇÃO COM ERROS'}\n${v.errors.map(x => '• ' + x).join('\n') || 'Nenhum erro.'}\n${v.warnings.map(x => '⚠️ ' + x).join('\n') || 'Sem avisos.'}`.slice(0, 1900), flags: MessageFlags.Ephemeral });
        }

        if (!SECTIONS.some(x => x[1] === type)) return i.reply({ content: '❌ Escolha uma seção.', flags: MessageFlags.Ephemeral });

        // Configurações simples/objetos: permitem editar tudo depois da criação.
        if (!ARRAYS.has(type)) {
            const source = type === 'general' ? c.metadata : type === 'visual' ? c.visual : type === 'participants' ? c.registration : type === 'access' ? { channels: c.channels, roles: c.roles } : c[type === 'panel' ? 'panel' : type === 'automation' ? 'automation' : 'hallOfFame'];
            if (action === 'list') {
                const emb = new EmbedBuilder().setColor(c.visual?.color || '#C9A227').setTitle(`${SECTIONS.find(x => x[1] === type)?.[0]} • ${c.metadata.name}`).setDescription(`\`\`\`json\n${cut(JSON.stringify(source, null, 2), 3800)}\n\`\`\``);
                return i.reply({ embeds: [emb], flags: MessageFlags.Ephemeral });
            }
            if (action === 'edit' || action === 'add') {
                const obj = parse(raw);
                if (!obj || Array.isArray(obj)) return i.reply({ content: '❌ Para esta seção, **dados** precisa ser um objeto JSON válido.', flags: MessageFlags.Ephemeral });
                if (type === 'general') Object.assign(c.metadata, obj);
                else if (type === 'visual') Object.assign(c.visual, obj);
                else if (type === 'participants') Object.assign(c.registration, obj);
                else if (type === 'access') { if (obj.channels) Object.assign(c.channels, obj.channels); if (obj.roles) Object.assign(c.roles, obj.roles); }
                else if (type === 'panel') Object.assign(c.panel, obj);
                else if (type === 'automation') Object.assign(c.automation, obj);
                else if (type === 'hall') Object.assign(c.hallOfFame, obj);
                e.save(c, i.user.id, `configure_${type}`);
                return i.reply({ content: `✅ Seção **${type}** atualizada.`, flags: MessageFlags.Ephemeral });
            }
            return i.reply({ content: '❌ Para configurações gerais use **editar** com JSON ou **listar** para consultar.', flags: MessageFlags.Ephemeral });
        }

        const a = getArray(c, type);
        if (!Array.isArray(a)) return i.reply({ content: '❌ Estrutura da seção inválida.', flags: MessageFlags.Ephemeral });

        if (action === 'list') {
            const emb = new EmbedBuilder().setColor(c.visual?.color || '#C9A227').setTitle(`${SECTIONS.find(x => x[1] === type)?.[0]} • ${c.metadata.name}`).setDescription(a.length ? a.slice(0, 25).map((x, n) => `**${n + 1}.** ${itemName(x)}`).join('\n') : 'Nenhum item.').setFooter({ text: `${a.length} item(ns)` });
            return i.reply({ embeds: [emb], flags: MessageFlags.Ephemeral });
        }

        if (action === 'add' || action === 'edit') {
            const obj = parse(raw);
            if (!obj || Array.isArray(obj)) return i.reply({ content: '❌ JSON inválido. Exemplo: `{ "name": "Final", "points": 3 }`', flags: MessageFlags.Ephemeral });
            if (action === 'edit') {
                if (!idx || idx < 1 || idx > a.length) return i.reply({ content: '❌ Índice inválido.', flags: MessageFlags.Ephemeral });
                a[idx - 1] = { ...a[idx - 1], ...obj, id: a[idx - 1].id || obj.id || e.id(type.slice(0, -1)) };
            } else {
                obj.id = obj.id || e.id(type.slice(0, -1));
                a.push(obj);
            }
            e.save(c, i.user.id, action === 'add' ? 'add_item' : 'edit_item');
            return i.reply({ content: `✅ Item ${action === 'add' ? 'adicionado' : 'editado'} em **${type}**.`, flags: MessageFlags.Ephemeral });
        }

        if (!idx || idx < 1 || idx > a.length) return i.reply({ content: '❌ Informe um índice válido.', flags: MessageFlags.Ephemeral });
        if (action === 'remove') {
            const [x] = a.splice(idx - 1, 1);
            e.save(c, i.user.id, 'remove_item');
            return i.reply({ content: `🗑️ Removido: **${itemName(x)}**.`, flags: MessageFlags.Ephemeral });
        }
        if (action === 'up' || action === 'down') {
            const to = action === 'up' ? idx - 2 : idx;
            if (to < 0 || to >= a.length) return i.reply({ content: '↩️ Item já está no limite.', flags: MessageFlags.Ephemeral });
            [a[idx - 1], a[to]] = [a[to], a[idx - 1]];
            e.save(c, i.user.id, action);
            return i.reply({ content: '✅ Ordem atualizada.', flags: MessageFlags.Ephemeral });
        }
    }
};
