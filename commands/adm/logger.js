/* ========================================================================
   WORLDWARBR — MOTOR CENTRAL DE LOGS ADMINISTRATIVOS
   ======================================================================== */

const { EmbedBuilder } = require('discord.js');

const CANAL_LOGS_ADM_ID = process.env.CANAL_LOGS_ADM_ID || '1529523610321162300';

async function enviarLogAdm(client, tipo, titulo, descricao, cor = '#3498db') {
    try {
        let logConsole = String(descricao ?? '').replace(/\n/g, ' ');
        if (logConsole.length > 180) logConsole = `${logConsole.slice(0, 180)}...`;
        console.log(`[LOG-ADM][${tipo}] ${titulo} -> ${logConsole}`);

        if (!CANAL_LOGS_ADM_ID) return;

        const canal = await client.channels.fetch(CANAL_LOGS_ADM_ID).catch(() => null);
        if (!canal || !canal.isTextBased?.()) return;

        let textoSeguro = String(descricao ?? '');
        if (textoSeguro.length > 3900) {
            textoSeguro = `${textoSeguro.slice(0, 3890)}\n\n*[... Texto cortado por segurança ...]*`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ ${titulo}`)
            .setDescription(`**Categoria:** \`${tipo}\`\n\n${textoSeguro}`)
            .setColor(cor)
            .setTimestamp();

        await canal.send({ embeds: [embed] });
    } catch (err) {
        console.error('Erro Crítico no Logger Administrativo:', err?.message || err);
    }
}

module.exports = { enviarLogAdm };