/* ========================================================================
   ARQUIVO: commands/adm/antiNukeHandler.js
   DESCRIÇÃO: Protocolo de Segurança Máxima (Blindado + Notificação de Ameaça)
   ======================================================================== */

const { AuditLogEvent, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const rastreadorAntiNuke = new Map(); 
const LIMITE_ACOES = 3; 
const TEMPO_ANALISE = 60000; 

async function registrarAcaoSuspeita(guild, executor, tipoAcao, client) {
    // Blindagem: Ignora se for o bot, dono ou executor inexistente
    if (!executor || executor.bot || executor.id === guild.ownerId || executor.id === client.user.id) return;

    const chave = `${guild.id}-${executor.id}`;

    if (!rastreadorAntiNuke.has(chave)) {
        rastreadorAntiNuke.set(chave, { contagem: 0, acoes: [] });
        setTimeout(() => rastreadorAntiNuke.delete(chave), TEMPO_ANALISE);
    }

    const ficha = rastreadorAntiNuke.get(chave);
    ficha.contagem++;
    ficha.acoes.push(tipoAcao);

    if (ficha.contagem >= LIMITE_ACOES) {
        rastreadorAntiNuke.delete(chave);

        try {
            const membroInfrator = await guild.members.fetch(executor.id).catch(() => null);
            
            if (membroInfrator) {
                // VERIFICAÇÃO DE PODER: Só tenta punir se o bot tiver hierarquia superior
                const botMember = await guild.members.fetch(client.user.id);
                if (botMember.roles.highest.position > membroInfrator.roles.highest.position) {
                    
                    await membroInfrator.roles.set([]).catch(() => null);
                    await membroInfrator.timeout(7 * 24 * 60 * 60 * 1000, "ANTI-NUKE: Atividade Destrutiva Detectada").catch(() => null);
                }
            }

            const dono = await guild.fetchOwner().catch(() => null);
            if (dono) {
                const embedAlerta = new EmbedBuilder()
                    .setTitle('🚨 ALERTA VERMELHO: AMEAÇA NEUTRALIZADA')
                    .setColor('#FF0000')
                    .setThumbnail(executor.displayAvatarURL())
                    .setDescription(`Comandante, a conta **${executor.tag}** disparou o protocolo de segurança.`)
                    .addFields(
                        { name: '👤 Infrator', value: `${executor} (\`${executor.id}\`)`, inline: false },
                        { name: '⚠️ Ações Identificadas', value: ficha.acoes.join('\n'), inline: false },
                        { name: '🛡️ Providência', value: 'Cargos removidos e conta em timeout de 7 dias.', inline: false }
                    )
                    .setTimestamp();
                
                await dono.send({ embeds: [embedAlerta] }).catch(() => console.error("DM do dono bloqueada."));
            }
        } catch (erro) {
            console.error("Erro Crítico no Anti-Nuke:", erro);
        }
    }
}

module.exports = (client) => {
    // Filtro de segurança para validar se o executor do log existe
    const ehLogValido = (log) => log && log.executor && (Date.now() - log.createdTimestamp < 5000);

    client.on('channelDelete', async (channel) => {
        const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(()=>null);
        if (ehLogValido(logs?.entries.first())) await registrarAcaoSuspeita(channel.guild, logs.entries.first().executor, `🗑️ Deletou o canal: #${channel.name}`, client);
    });

    client.on('roleDelete', async (role) => {
        const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(()=>null);
        if (ehLogValido(logs?.entries.first())) await registrarAcaoSuspeita(role.guild, logs.entries.first().executor, `🛡️ Deletou o cargo: @${role.name}`, client);
    });

    client.on('guildBanAdd', async (ban) => {
        const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(()=>null);
        if (ehLogValido(logs?.entries.first())) await registrarAcaoSuspeita(ban.guild, logs.entries.first().executor, `🔨 Baniu: ${ban.user.tag}`, client);
    });

    client.on('guildMemberRemove', async (member) => {
        const logs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick }).catch(()=>null);
        const log = logs?.entries.first();
        if (log && log.target && log.target.id === member.id && ehLogValido(log)) {
            await registrarAcaoSuspeita(member.guild, log.executor, `🥾 Expulsou: ${member.user.tag}`, client);
        }
    });

    console.log("🛡️ Sistema Anti-Nuke Profissional Blindado e Ativo.");
};