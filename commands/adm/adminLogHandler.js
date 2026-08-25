/* ========================================================================
   ARQUIVO: commands/adm/adminLogHandler.js
   DESCRIÇÃO: Protocolo Olho de Deus (Auditoria Visual + Intercepção Pura Blindada)
   ======================================================================== */

const { Events, AuditLogEvent } = require('discord.js');
const { enviarLogAdm } = require('./logger.js');

module.exports = (client) => {
    
    // ==============================================================
    // 🕵️ MOTOR INTERNO (Fichas e Partidas do War)
    // ==============================================================
    client.logger = {
        auditoria: async (executor, alvo, comando, detalhes, cor) => {
            const desc = `👮 **Oficial:** ${executor} (\`${executor.id}\`)\n🎯 **Alvo:** ${alvo} (\`${alvo.id}\`)\n💻 **Comando:** \`${comando}\`\n\n📄 **Detalhes:**\n${detalhes}`;
            await enviarLogAdm(client, 'SISTEMA MILITAR', 'Alteração de Ficha', desc, cor);
        },
        partidas: async (admin, acao, detalhes, cor) => {
            const desc = `👮 **Oficial:** ${admin} (\`${admin.id}\`)\n\n📄 **Detalhes:**\n${detalhes}`;
            await enviarLogAdm(client, 'SISTEMA MILITAR', `Partida - ${acao}`, desc, cor);
        }
    };

    // ==============================================================
    // 1. EVENTOS VISUAIS: MENSAGENS E COMANDOS
    // ==============================================================
    
    // Comandos de Barra executados
    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isCommand()) return;
        const desc = `👤 **Usuário:** ${interaction.user} (${interaction.user.tag})\n📌 **Comando:** \`/${interaction.commandName}\`\n📍 **Canal:** ${interaction.channel}`;
        await enviarLogAdm(client, 'COMANDO', 'Slash Command Usado', desc, '#2ecc71');
    });

    // Mensagens Apagadas (Rastreia anexos e QUEM apagou)
    client.on(Events.MessageDelete, async message => {
        if (!message.guild || !message.author || message.author.bot) return;
        
        let texto = message.content || "";
        let anexos = message.attachments.map(a => a.url).join('\n');
        
        if (anexos) texto += `\n\n🖼️ **Anexos apagados:**\n${anexos}`;
        if (!texto) texto = "*[Embed/Vazio]*";
        if (texto.length > 3500) texto = texto.slice(0, 3500) + '...';

        let apagadoPor = message.author; 
        await new Promise(resolve => setTimeout(resolve, 1500)); // Atraso tático

        try {
            const logs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
            const log = logs.entries.first();
            if (log && log.target && log.target.id === message.author.id && log.extra && log.extra.channel && log.extra.channel.id === message.channel.id && Date.now() - log.createdTimestamp < 6000) {
                if (log.executor) apagadoPor = log.executor; 
            }
        } catch (e) {}

        const desc = `🗑️ **De:** ${message.author}\n📍 **No Canal:** ${message.channel}\n👮 **Quem apagou:** ${apagadoPor}\n\n**Conteúdo:**\n\`\`\`${texto}\`\`\``;
        await enviarLogAdm(client, 'MENSAGENS', 'Mensagem Deletada', desc, '#e74c3c');
    });

    // Mensagens Editadas
    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
        if (!oldMessage.guild || !oldMessage.author || oldMessage.author.bot || oldMessage.content === newMessage.content) return;
        
        let antes = oldMessage.content || '*[Vazio/Embed]*';
        let depois = newMessage.content || '*[Vazio/Embed]*';
        if (antes.length > 1000) antes = antes.slice(0, 1000) + '...';
        if (depois.length > 1000) depois = depois.slice(0, 1000) + '...';

        const desc = `✏️ **Editada por:** ${oldMessage.author}\n📍 **Canal:** ${oldMessage.channel}\n\n**Antes:** \`${antes}\`\n**Depois:** \`${depois}\``;
        await enviarLogAdm(client, 'MENSAGENS', 'Mensagem Editada', desc, '#f1c40f');
    });

    // ==============================================================
    // 2. EVENTOS VISUAIS: ENTRADA, SAÍDA E VOZ
    // ==============================================================
    
    // Entrou no Servidor
    client.on(Events.GuildMemberAdd, async member => {
        const desc = `📥 **Novo Membro:** ${member} (${member.user.tag})\n📅 **Conta criada:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`;
        await enviarLogAdm(client, 'MEMBROS', 'Entrada no Servidor', desc, '#3498db');
    });

    // Saiu ou foi Kickado
    client.on(Events.GuildMemberRemove, async member => {
        let executor = null;
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
            const logs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
            const log = logs.entries.first();
            if (log && log.target && log.target.id === member.id && Date.now() - log.createdTimestamp < 5000) executor = log.executor;
        } catch (e) {}

        if (executor) await enviarLogAdm(client, 'MODERAÇÃO', 'Expulsão Aplicada', `👢 O Oficial ${executor} expulsou ${member.user.tag} (\`${member.user.id}\`)`, '#e67e22');
        else await enviarLogAdm(client, 'MEMBROS', 'Saída do Servidor', `📤 **Saiu:** ${member.user.tag} (\`${member.user.id}\`)`, '#95a5a6');
    });

    // Canais de Voz (Puxões, Quedas e Entradas)
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        const member = newState.member;
        if (!member || member.user.bot) return;

        const channelOld = oldState.channel;
        const channelNew = newState.channel;

        if (!channelOld && channelNew) {
            await enviarLogAdm(client, 'VOZ', 'Entrou na Call', `🎙️ ${member} conectou-se em **${channelNew.name}**`, '#1abc9c');
        } else if (channelOld && !channelNew) {
            let executor = null;
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                const logs = await newState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberDisconnect });
                const log = logs.entries.first();
                if (log && log.target && log.target.id === member.id && Date.now() - log.createdTimestamp < 4000) executor = log.executor;
            } catch (e) {}

            if (executor) await enviarLogAdm(client, 'VOZ', 'Derrubado da Call', `🔌 O Oficial ${executor} desconectou ${member} de **${channelOld.name}**`, '#c0392b');
            else await enviarLogAdm(client, 'VOZ', 'Saiu da Call', `🔇 ${member} desconectou-se de **${channelOld.name}**`, '#e67e22');
        } else if (channelOld && channelNew && channelOld.id !== channelNew.id) {
            let executor = null;
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                const logs = await newState.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberMove });
                const log = logs.entries.first();
                if (log && log.target && log.target.id === member.id && Date.now() - log.createdTimestamp < 4000) executor = log.executor;
            } catch (e) {}

            if (executor) await enviarLogAdm(client, 'VOZ', 'Puxado (Movido)', `🧲 O Oficial ${executor} arrastou ${member} para **${channelNew.name}**`, '#8e44ad');
            else await enviarLogAdm(client, 'VOZ', 'Trocou de Call', `🔀 ${member} moveu-se para **${channelNew.name}**`, '#9b59b6');
        }
    });

    // ==============================================================
    // 3. A INTERCEPÇÃO SUPREMA (AUDITORIA PURA BLINDADA)
    // ==============================================================
    client.on(Events.GuildAuditLogEntryCreate, async (auditLog, guild) => {
        const { action, executor, target, changes, reason } = auditLog;

        // BLINDAGEM CONTRA EXECUTOR NULO
        if (!executor) return;

        // IGNORAR: O próprio bot e ações que já temos eventos visuais mais bonitos ali em cima
        if (executor.id === client.user.id) return;
        const acoesIgnoradas = [
            AuditLogEvent.MessageDelete, 
            AuditLogEvent.MemberKick, 
            AuditLogEvent.MemberDisconnect, 
            AuditLogEvent.MemberMove,
            AuditLogEvent.MessageBulkDelete
        ];
        if (acoesIgnoradas.includes(action)) return;

        // Descobre o tipo de Ação
        const tipoAcao = Object.keys(AuditLogEvent).find(key => AuditLogEvent[key] === action) || `Ação: ${action}`;

        // Mapeia o que o Administrador alterou
        let detalhesMudanca = "*(Nenhum detalhe técnico extraído)*";
        if (changes && changes.length > 0) {
            detalhesMudanca = changes.map(c => {
                let velho = c.old !== undefined ? c.old : 'Vazio';
                let novo = c.new !== undefined ? c.new : 'Vazio';
                return `🔹 **[${c.key}]**: \`${velho}\` ➔ \`${novo}\``;
            }).join('\n');
        }

        // Descobre o alvo (Canal, cargo, pessoa...)
        let nomeAlvo = 'Desconhecido';
        if (target) {
            if (target.username) nomeAlvo = target.username; // Membro
            else if (target.name) nomeAlvo = target.name; // Canal, Cargo, Emoji
            else nomeAlvo = `ID: ${target.id}`; // Objeto sem nome
        }

        const desc = `🕵️ **Operação:** \`${tipoAcao}\`\n👮 **Oficial:** ${executor} (\`${executor.id}\`)\n🎯 **Alvo:** ${nomeAlvo}\n\n📄 **O que foi modificado:**\n${detalhesMudanca}\n\n📝 **Motivo:** ${reason || 'Não informado'}`;
        
        await enviarLogAdm(client, 'AUDITORIA GERAL', 'Alteração Estrutural (Staff)', desc, '#36393F');
    });

    console.log("👁️ A MÁQUINA DE ESPIONAGEM ESTÁ NO AR. Protocolo Olho de Deus Ativo!");
};