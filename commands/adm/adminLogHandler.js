/* ========================================================================
   WORLDWARBR — CENTRAL DE AUDITORIA
   Tudo em português + responsável quando o Discord disponibilizar a informação.
   ======================================================================== */

const { Events, AuditLogEvent } = require('discord.js');
const { enviarLogAdm } = require('./logger.js');

module.exports = (client) => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    async function buscarExecutor(guild, tipo, alvoId, janela = 6000) {
        try {
            const logs = await guild.fetchAuditLogs({ limit: 10, type: tipo });
            const agora = Date.now();
            const entrada = logs.entries.find(e =>
                e.target?.id === alvoId &&
                e.executor &&
                agora - e.createdTimestamp <= janela &&
                e.executor.id !== client.user?.id
            );
            return entrada?.executor || null;
        } catch {
            return null;
        }
    }

    client.logger = {
        auditoria: async (executor, alvo, comando, detalhes, cor) => {
            const desc = `👮 **Responsável:** ${executor} (\`${executor.id}\`)\n🎯 **Alvo:** ${alvo} (\`${alvo.id}\`)\n💻 **Comando:** \`${comando}\`\n\n📄 **Detalhes:**\n${detalhes}`;
            await enviarLogAdm(client, 'SISTEMA MILITAR', 'Alteração de Ficha', desc, cor);
        },
        partidas: async (admin, acao, detalhes, cor) => {
            const desc = `👮 **Responsável:** ${admin} (\`${admin.id}\`)\n\n📄 **Detalhes:**\n${detalhes}`;
            await enviarLogAdm(client, 'SISTEMA MILITAR', `Partida - ${acao}`, desc, cor);
        }
    };

    // ==================== COMANDOS ====================
    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isCommand() || !interaction.guild) return;
        const desc = `👤 **Responsável:** ${interaction.user} (\`${interaction.user.id}\`)\n📌 **Comando:** \`/${interaction.commandName}\`\n📍 **Canal:** ${interaction.channel || 'Desconhecido'}`;
        await enviarLogAdm(client, 'COMANDOS', 'Comando executado', desc, '#2ecc71');
    });

    // ==================== MENSAGENS ====================
    client.on(Events.MessageDelete, async message => {
        if (!message.guild || !message.author || message.author.bot) return;
        let texto = message.content || '';
        const anexos = message.attachments?.map(a => a.url).join('\n') || '';
        if (anexos) texto += `\n\n🖼️ **Anexos apagados:**\n${anexos}`;
        if (!texto) texto = '*[Embed/Vazio]*';
        if (texto.length > 3000) texto = texto.slice(0, 3000) + '...';

        await sleep(1200);
        const executor = await buscarExecutor(message.guild, AuditLogEvent.MessageDelete, message.author.id);
        const responsavel = executor || 'Não identificado pelo Discord';
        const desc = `👤 **Autor:** ${message.author} (\`${message.author.id}\`)\n📍 **Canal:** ${message.channel}\n👮 **Quem apagou:** ${responsavel}\n\n**Conteúdo:**\n\`\`\`${texto}\`\`\``;
        await enviarLogAdm(client, 'MENSAGENS', 'Mensagem apagada', desc, '#e74c3c');
    });

    client.on(Events.MessageBulkDelete, async messages => {
        const first = messages.first();
        if (!first?.guild) return;
        await sleep(1000);
        const executor = await buscarExecutor(first.guild, AuditLogEvent.MessageBulkDelete, first.channelId);
        const desc = `📍 **Canal:** ${first.channel}\n👮 **Responsável:** ${executor || 'Não identificado pelo Discord'}\n🗑️ **Quantidade:** ${messages.size} mensagens`;
        await enviarLogAdm(client, 'MENSAGENS', 'Mensagens apagadas em massa', desc, '#c0392b');
    });

    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
        if (!oldMessage.guild || !oldMessage.author || oldMessage.author.bot) return;
        if (oldMessage.content === newMessage.content) return;
        let antes = oldMessage.content || '*[Vazio/Embed]*';
        let depois = newMessage.content || '*[Vazio/Embed]*';
        if (antes.length > 1200) antes = antes.slice(0, 1200) + '...';
        if (depois.length > 1200) depois = depois.slice(0, 1200) + '...';
        const desc = `👤 **Quem editou:** ${oldMessage.author} (\`${oldMessage.author.id}\`)\n📍 **Canal:** ${oldMessage.channel}\n\n**Antes:**\n\`\`\`${antes}\`\`\`\n\n**Depois:**\n\`\`\`${depois}\`\`\``;
        await enviarLogAdm(client, 'MENSAGENS', 'Mensagem editada', desc, '#f1c40f');
    });

    // ==================== MEMBROS ====================
    client.on(Events.GuildMemberAdd, async member => {
        const desc = `👤 **Membro:** ${member} (\`${member.id}\`)\n📅 **Conta criada:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`;
        await enviarLogAdm(client, 'MEMBROS', 'Membro entrou no servidor', desc, '#3498db');
    });

    client.on(Events.GuildMemberRemove, async member => {
        await sleep(1000);
        const executor = await buscarExecutor(member.guild, AuditLogEvent.MemberKick, member.id, 7000);
        if (executor) {
            await enviarLogAdm(client, 'MODERAÇÃO', 'Membro expulso', `👮 **Responsável:** ${executor}\n👤 **Alvo:** ${member.user.tag} (\`${member.id}\`)`, '#e67e22');
        } else {
            await enviarLogAdm(client, 'MEMBROS', 'Membro saiu do servidor', `👤 **Membro:** ${member.user.tag} (\`${member.id}\`)\n👮 **Responsável:** Não identificado pelo Discord`, '#95a5a6');
        }
    });

    client.on(Events.GuildBanAdd, async ban => {
        await sleep(700);
        const executor = await buscarExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id, 7000);
        await enviarLogAdm(client, 'MODERAÇÃO', 'Membro banido', `👮 **Responsável:** ${executor || 'Não identificado pelo Discord'}\n🎯 **Alvo:** ${ban.user.tag} (\`${ban.user.id}\`)`, '#8e44ad');
    });

    client.on(Events.GuildBanRemove, async ban => {
        await sleep(700);
        const executor = await buscarExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id, 7000);
        await enviarLogAdm(client, 'MODERAÇÃO', 'Banimento removido', `👮 **Responsável:** ${executor || 'Não identificado pelo Discord'}\n🎯 **Alvo:** ${ban.user.tag} (\`${ban.user.id}\`)`, '#2ecc71');
    });

    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        const mudancas = [];
        if (oldMember.nickname !== newMember.nickname) mudancas.push(`🏷️ **Apelido:** \`${oldMember.nickname || 'Nenhum'}\` ➜ \`${newMember.nickname || 'Nenhum'}\``);

        const antigos = new Set(oldMember.roles.cache.keys());
        const novos = new Set(newMember.roles.cache.keys());
        const adicionados = newMember.roles.cache.filter(r => !antigos.has(r.id) && r.id !== newMember.guild.id);
        const removidos = oldMember.roles.cache.filter(r => !novos.has(r.id) && r.id !== newMember.guild.id);
        if (adicionados.size) mudancas.push(`➕ **Cargos adicionados:** ${adicionados.map(r => r).join(', ')}`);
        if (removidos.size) mudancas.push(`➖ **Cargos removidos:** ${removidos.map(r => r).join(', ')}`);
        if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
            mudancas.push(newMember.communicationDisabledUntilTimestamp ? '🔇 **Timeout aplicado**' : '🔊 **Timeout removido**');
        }
        if (!mudancas.length) return;

        await sleep(700);
        let executor = null;
        if (adicionados.size || removidos.size) executor = await buscarExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
        if (!executor && oldMember.nickname !== newMember.nickname) executor = await buscarExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
        if (!executor && oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) executor = await buscarExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);

        const desc = `👤 **Membro:** ${newMember} (\`${newMember.id}\`)\n👮 **Responsável:** ${executor || 'O próprio membro ou não identificado pelo Discord'}\n\n${mudancas.join('\n')}`;
        await enviarLogAdm(client, 'MEMBROS', 'Membro alterado', desc, '#f39c12');
    });

    // ==================== VOZ ====================
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;
        const oldChannel = oldState.channel;
        const newChannel = newState.channel;

        if (!oldChannel && newChannel) {
            await enviarLogAdm(client, 'VOZ', 'Entrou na call', `👤 **Membro:** ${member}\n🎙️ **Canal:** ${newChannel.name}\n👮 **Responsável:** O próprio membro`, '#1abc9c');
            return;
        }
        if (oldChannel && !newChannel) {
            await sleep(800);
            const executor = await buscarExecutor(newState.guild, AuditLogEvent.MemberDisconnect, member.id, 5000);
            await enviarLogAdm(client, 'VOZ', executor ? 'Membro desconectado da call' : 'Saiu da call', `👤 **Membro:** ${member}\n📍 **Canal:** ${oldChannel.name}\n👮 **Responsável:** ${executor || 'O próprio membro ou não identificado pelo Discord'}`, executor ? '#c0392b' : '#e67e22');
            return;
        }
        if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
            await sleep(800);
            const executor = await buscarExecutor(newState.guild, AuditLogEvent.MemberMove, member.id, 5000);
            await enviarLogAdm(client, 'VOZ', executor ? 'Membro movido de call' : 'Membro trocou de call', `👤 **Membro:** ${member}\n📍 **De:** ${oldChannel.name}\n📍 **Para:** ${newChannel.name}\n👮 **Responsável:** ${executor || 'O próprio membro ou não identificado pelo Discord'}`, executor ? '#8e44ad' : '#9b59b6');
        }
    });

    // ==================== AUDITORIA ESTRUTURAL ====================
    client.on(Events.GuildAuditLogEntryCreate, async (auditLog, guild) => {
        const { action, executor, target, changes, reason } = auditLog;
        if (!executor || executor.id === client.user?.id) return;

        const acoesIgnoradas = [
            AuditLogEvent.MessageDelete,
            AuditLogEvent.MemberKick,
            AuditLogEvent.MemberBanAdd,
            AuditLogEvent.MemberBanRemove,
            AuditLogEvent.MemberDisconnect,
            AuditLogEvent.MemberMove,
            AuditLogEvent.MemberRoleUpdate,
            AuditLogEvent.MemberUpdate,
            AuditLogEvent.MessageBulkDelete
        ];
        if (acoesIgnoradas.includes(action)) return;

        const nomes = {
            [AuditLogEvent.GuildUpdate]: 'Servidor alterado',
            [AuditLogEvent.ChannelCreate]: 'Canal criado',
            [AuditLogEvent.ChannelDelete]: 'Canal apagado',
            [AuditLogEvent.ChannelUpdate]: 'Canal alterado',
            [AuditLogEvent.RoleCreate]: 'Cargo criado',
            [AuditLogEvent.RoleDelete]: 'Cargo apagado',
            [AuditLogEvent.RoleUpdate]: 'Cargo alterado',
            [AuditLogEvent.WebhookCreate]: 'Webhook criado',
            [AuditLogEvent.WebhookDelete]: 'Webhook apagado',
            [AuditLogEvent.WebhookUpdate]: 'Webhook alterado',
            [AuditLogEvent.EmojiCreate]: 'Emoji criado',
            [AuditLogEvent.EmojiDelete]: 'Emoji apagado',
            [AuditLogEvent.EmojiUpdate]: 'Emoji alterado',
            [AuditLogEvent.StickerCreate]: 'Sticker criado',
            [AuditLogEvent.StickerDelete]: 'Sticker apagado',
            [AuditLogEvent.StickerUpdate]: 'Sticker alterado',
            [AuditLogEvent.InviteCreate]: 'Convite criado',
            [AuditLogEvent.InviteDelete]: 'Convite apagado',
            [AuditLogEvent.IntegrationCreate]: 'Integração adicionada',
            [AuditLogEvent.IntegrationDelete]: 'Integração removida',
            [AuditLogEvent.IntegrationUpdate]: 'Integração alterada'
        };

        const nomeAcao = nomes[action] || Object.keys(AuditLogEvent).find(k => AuditLogEvent[k] === action) || `Ação ${action}`;
        let alvo = 'Desconhecido';
        if (target) alvo = target.name || target.username || target.tag || (target.id ? `<@${target.id}> (\`${target.id}\`)` : 'Desconhecido');

        let detalhes = '*(Nenhum detalhe adicional fornecido pelo Discord)*';
        if (changes?.length) {
            detalhes = changes.map(c => {
                const velho = c.old !== undefined ? JSON.stringify(c.old) : 'Vazio';
                const novo = c.new !== undefined ? JSON.stringify(c.new) : 'Vazio';
                return `🔹 **${c.key}:** \`${velho}\` ➜ \`${novo}\``;
            }).join('\n');
        }

        const desc = `🕵️ **Ação:** ${nomeAcao}\n👮 **Quem fez:** ${executor} (\`${executor.id}\`)\n🎯 **Alvo:** ${alvo}\n\n📄 **Alterações:**\n${detalhes}\n\n📝 **Motivo:** ${reason || 'Não informado'}`;
        await enviarLogAdm(client, 'AUDITORIA GERAL', nomeAcao, desc, '#36393F');
    });

    console.log('👁️ Central de Auditoria ativa: eventos + responsável + Audit Log.');
};