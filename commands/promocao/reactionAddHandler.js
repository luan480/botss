/* ========================================================================
   ARQUIVO: commands/promocao/reactionAddHandler.js (V-AUTO APROVAÇÃO BLINDADA)
   DESCRIÇÃO: O Bot aprova prints sozinho. A Staff usa o ❌. Civis são bloqueados.
   ======================================================================== */

const { Events } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');
const { executarVarreduraCanal } = require('./syncEngine.js');

const carreirasPath = path.join(__dirname, 'carreiras.json');

module.exports = (client) => {
    
    // ===============================================================
    // 1. GATILHO AUTOMÁTICO: ALGUÉM MANDOU IMAGEM NO CANAL
    // ===============================================================
    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot) return; // Ignora os próprios bots

        const carreirasConfig = safeReadJson(carreirasPath);
        if (!carreirasConfig || message.channel.id !== carreirasConfig.canalDePrints) return;

        // Se a mensagem contém uma imagem (attachment), o bot trabalha instantaneamente!
        if (message.attachments.size > 0) {
            console.log(`[Auto-Print] Nova imagem de ${message.author.tag} detectada. Processando...`);
            await executarVarreduraCanal(client);
        }
    });

    // ===============================================================
    // 2. GATILHO MANUAL: A STAFF COLOCOU O ❌ PARA INVALIDAR
    // ===============================================================
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => {});

        const carreirasConfig = safeReadJson(carreirasPath);
        if (!carreirasConfig || reaction.message.channel.id !== carreirasConfig.canalDePrints) return;

        if (reaction.emoji.name === '❌') {
            // 🛡️ BLINDAGEM DE PATENTE: Puxa o perfil de quem reagiu no servidor
            const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            const isStaff = member.permissions.has('Administrator') || member.roles.cache.some(r => {
                const n = r.name.toLowerCase();
                return n.includes('admin') || n.includes('moderador') || n.includes('mod') || n.includes('gm');
            });

            // Se for um civil intruso, o bot arranca o X dele e cancela a operação!
            if (!isStaff) {
                console.log(`[Segurança] Intruso detectado: ${user.tag} tentou cancelar um print. Reação removida.`);
                await reaction.users.remove(user.id).catch(() => {});
                return; 
            }

            console.log(`[Varredura] Print INVALIDADO por ${user.tag}.`);
            await executarVarreduraCanal(client);
        }
    });

    // ===============================================================
    // 3. GATILHO MANUAL: A STAFF TIROU O ❌ E PERDOOU O SOLDADO
    // ===============================================================
    client.on(Events.MessageReactionRemove, async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => {});

        const carreirasConfig = safeReadJson(carreirasPath);
        if (!carreirasConfig || reaction.message.channel.id !== carreirasConfig.canalDePrints) return;

        if (reaction.emoji.name === '❌') {
            // 🛡️ BLINDAGEM SECUNDÁRIA: Só recalcula se quem tirou o X for da Staff
            const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            const isStaff = member.permissions.has('Administrator') || member.roles.cache.some(r => {
                const n = r.name.toLowerCase();
                return n.includes('admin') || n.includes('moderador') || n.includes('mod') || n.includes('gm');
            });

            if (!isStaff) return; 

            console.log(`[Reversão] Punição removida por ${user.tag}. Recalculando...`);
            await executarVarreduraCanal(client);
        }
    });

    console.log("🤖 Sistema de Auto-Aprovação de Prints blindado contra civis ativado.");
};