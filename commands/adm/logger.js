/* ========================================================================
   ARQUIVO: commands/adm/logger.js
   DESCRIÇÃO: Motor Blindado de Logs Administrativos (Protocolo Olho de Deus)
   ======================================================================== */

const { EmbedBuilder } = require('discord.js');

// ⚠️ Insira aqui o ID do canal de texto exclusivo para os administradores verem os logs
const CANAL_LOGS_ADM_ID = "1529523610321162300"; 

/**
 * Envia um registro de log detalhado para o canal de adm e para o console.
 * @param {import('discord.js').Client} client 
 * @param {string} tipo - 'ECONOMIA', 'PROMOÇÃO', 'MODERAÇÃO', 'SERVIDOR', 'ERRO'
 * @param {string} titulo - Título descritivo da ação
 * @param {string} descricao - Detalhes completos do ocorrido
 * @param {string} cor - Cor do Embed em HEX
 */
async function enviarLogAdm(client, tipo, titulo, descricao, cor = '#3498db') {
    try {
        // Exibição no terminal do host (Encurtado para não poluir sua tela)
        let logConsole = descricao.replace(/\n/g, ' ');
        if (logConsole.length > 100) logConsole = logConsole.substring(0, 100) + '...';
        console.log(`[LOG-ADM][${tipo}] ${titulo} -> ${logConsole}`);

        if (!CANAL_LOGS_ADM_ID || CANAL_LOGS_ADM_ID === "SEU_CANAL_DE_LOGS_ADMIN_ID_AQUI") return;

        const canal = await client.channels.fetch(CANAL_LOGS_ADM_ID).catch(() => null);
        if (!canal) return;

        // 🛡️ BLINDAGEM CONTRA TEXTOS GIGANTES (Evita crash no Discord)
        let textoSeguro = descricao;
        if (textoSeguro.length > 4000) {
            textoSeguro = textoSeguro.substring(0, 3990) + "\n\n*[... Texto muito longo, cortado por segurança ...]*";
        }

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ [LOG ADMIN] ${titulo}`)
            .setDescription(`**Categoria:** \`${tipo}\`\n\n${textoSeguro}`)
            .setColor(cor)
            .setTimestamp();

        await canal.send({ embeds: [embed] }).catch((e) => {
            console.error("Erro ao despachar log para o canal (Possível texto longo demais ou sem permissão):", e.message);
        });
    } catch (err) {
        console.error("Erro Crítico no Logger Administrativo:", err);
    }
}

module.exports = { enviarLogAdm };