/* ========================================================================
   ARQUIVO: commands/adm/autoResponseHandler.js
   DESCRIÇÃO: Ouve o chat e responde se encontrar um gatilho de forma precisa.
   ======================================================================== */

const { Events } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');

const dbPath = path.join(__dirname, 'auto_respostas.json');

module.exports = (client) => {
    client.on(Events.MessageCreate, async message => {
        // Ignora bots e mensagens vazias
        if (message.author.bot || !message.content) return;

        const conteudo = message.content.toLowerCase();
        const db = safeReadJson(dbPath);

        // Verifica cada gatilho salvo
        for (const [gatilho, respostas] of Object.entries(db)) {
            const gatilhoLimpo = gatilho.toLowerCase().trim();
            
            // Cria uma expressão regular para garantir que é a PALAVRA EXATA isolada,
            // evitando que "oi" ative em "coisa" ou "moita".
            const regex = new RegExp(`(^|\\s)${gatilhoLimpo}(\\s|$)`, 'i');

            if (regex.test(conteudo)) {
                
                // [OPCIONAL] Chance de ativação (Ex: 50% de chance do bot realmente responder)
                // Se quiser que ele responda SEMPRE que a palavra exata aparecer, comente ou remova a linha abaixo:
                if (Math.random() > 0.5) return; // 0.5 significa 50% de chance de ignorar

                let respostaFinal = "";

                // Se for uma lista de respostas, sorteia uma
                if (Array.isArray(respostas)) {
                    const sorteio = Math.floor(Math.random() * respostas.length);
                    respostaFinal = respostas[sorteio];
                } else {
                    respostaFinal = respostas; // Legado (se for string única)
                }

                try {
                    await message.reply({ content: respostaFinal, allowedMentions: { repliedUser: false } });
                    console.log(`[Auto-Resposta] Gatilho: "${gatilho}" acionado por ${message.author.tag}`);
                    return; // Para de procurar outros gatilhos na mesma mensagem
                } catch (e) {
                    console.error("Erro ao enviar auto-resposta:", e);
                }
            }
        }
    });
};