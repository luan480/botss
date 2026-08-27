/* ========================================================================
   WORLDWARBR — PROTOCOLO ANTI-NUKE
   Detecta ações destrutivas administrativas e registra o responsável.
   ======================================================================== */

const { AuditLogEvent, EmbedBuilder } = require('discord.js');

const rastreadorAntiNuke = new Map();
const LIMITE_ACOES = 3;
const TEMPO_ANALISE = 60000;

async function registrarAcaoSuspeita(guild, executor, tipoAcao, client) {
    if (!executor || executor.bot || executor.id === guild.ownerId || executor.id === client.user.id) return;

    const chave = `${guild.id}-${executor.id}`;
    let ficha = rastreadorAntiNuke.get(chave);
    if (!ficha) {
        ficha = { contagem: 0, acoes: [], timer: null };
        rastreadorAntiNuke.set(chave, ficha);
    }

    ficha.contagem++;
    ficha.acoes.push(tipoAcao);

    if (ficha.contagem < LIMITE_ACOES) return;

    if (ficha.timer) clearTimeout(ficha.timer);
    rastreadorAntiNuke.delete(chave);

    let medidaAplicada = 'Nenhuma: o bot não possui hierarquia/permissão suficiente.';
    try {
        const membroInfrator = await guild.members.fetch(executor.id).catch(() => null);
        const botMember = await guild.members.fetch(client.user.id).catch(() => null);

        if (membroInfrator && botMember && botMember.roles.highest.position > membroInfrator.roles.highest.position) {
            const cargosRemovidos = await membroInfrator.roles.set([], 'ANTI-NUKE: Atividade destrutiva detectada').then(() => true).catch(() => false);
            const timeoutAplicado = await membroInfrator.timeout(7 * 24 * 60 * 60 * 1000, 'ANTI-NUKE: Atividade destrutiva detectada').then(() => true).catch(() => false);
            medidaAplicada = `${cargosRemovidos ? 'Cargos removidos' : 'Não foi possível remover cargos'}; ${timeoutAplicado ? 'timeout de 7 dias aplicado' : 'não foi possível aplicar timeout'}.`;
        }
    } catch (erro) {
        console.error('[ANTI-NUKE] Falha ao aplicar contenção:', erro?.message || erro);
    }

    const detalhes = `👤 **Infrator:** ${executor} (\`${executor.id}\`)\n⚠️ **Ações identificadas:**\n${ficha.acoes.join('\n')}\n\n🛡️ **Providência:** ${medidaAplicada}`;

    if (typeof client.logger?.auditoria === 'function') {
        await client.logger.auditoria(executor, executor, 'ANTI-NUKE', detalhes, '#ff0000').catch(() => null);
    }

    try {
        const dono = await guild.fetchOwner().catch(() => null);
        if (!dono) return;

        const embedAlerta = new EmbedBuilder()
            .setTitle('🚨 ALERTA: ANTI-NUKE ATIVADO')
            .setColor('#FF0000')
            .setThumbnail(executor.displayAvatarURL())
            .setDescription(`O protocolo de segurança detectou atividade destrutiva de **${executor.tag}**.`)
            .addFields(
                { name: '👤 Infrator', value: `${executor} (\`${executor.id}\`)`, inline: false },
                { name: '⚠️ Ações', value: ficha.acoes.join('\n').slice(0, 1024), inline: false },
                { name: '🛡️ Providência', value: medidaAplicada.slice(0, 1024), inline: false }
            )
            .setTimestamp();

        await dono.send({ embeds: [embedAlerta] }).catch(() => null);
    } catch (erro) {
        console.error('[ANTI-NUKE] Falha ao notificar o dono:', erro?.message || erro);
    }
}

module.exports = (client) => {
    const ehLogValido = (log) => log?.executor && (Date.now() - log.createdTimestamp < 5000);

    client.on('channelDelete', async channel => {
        const logs = await channel.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.ChannelDelete }).catch(() => null);
        const log = logs?.entries.find(e => e.target?.id === channel.id && ehLogValido(e));
        if (log) await registrarAcaoSuspeita(channel.guild, log.executor, `🗑️ Deletou o canal: #${channel.name}`, client);
    });

    client.on('roleDelete', async role => {
        const logs = await role.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.RoleDelete }).catch(() => null);
        const log = logs?.entries.find(e => e.target?.id === role.id && ehLogValido(e));
        if (log) await registrarAcaoSuspeita(role.guild, log.executor, `🛡️ Deletou o cargo: @${role.name}`, client);
    });

    client.on('guildBanAdd', async ban => {
        const logs = await ban.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
        const log = logs?.entries.find(e => e.target?.id === ban.user.id && ehLogValido(e));
        if (log) await registrarAcaoSuspeita(ban.guild, log.executor, `🔨 Baniu: ${ban.user.tag}`, client);
    });

    client.on('guildMemberRemove', async member => {
        const logs = await member.guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberKick }).catch(() => null);
        const log = logs?.entries.find(e => e.target?.id === member.id && ehLogValido(e));
        if (log) await registrarAcaoSuspeita(member.guild, log.executor, `🥾 Expulsou: ${member.user.tag}`, client);
    });

    console.log('🛡️ Sistema Anti-Nuke Profissional Blindado e Ativo.');
};