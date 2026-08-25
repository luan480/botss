/* ========================================================================
   ARQUIVO: commands/adm/onboardingSyncHandler.js
   DESCRIÇÃO: Olheiro Automático V2 - Sincroniza Entradas, Trocas e Saídas
   ======================================================================== */

const { Events } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const progressaoPath = path.join(__dirname, '../promocao/progressao.json');
const carreirasPath = path.join(__dirname, '../promocao/carreiras.json');

module.exports = (client) => {
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        // Se a quantidade de cargos for a mesma, nada mudou, então ignora.
        if (oldMember.roles.cache.size === newMember.roles.cache.size) return;

        try {
            const carreiras = safeReadJson(carreirasPath);
            const progressao = safeReadJson(progressaoPath);
            let faccaoEncontrada = null;

            // Varre o perfil atual do membro procurando se ele tem ALGUMA farda de facção AGORA
            for (const [factionId, faccaoDados] of Object.entries(carreiras.faccoes)) {
                const cargosDaFaccao = faccaoDados.caminho.map(rank => rank.id);
                const temCargoDessaFaccao = cargosDaFaccao.some(id => newMember.roles.cache.has(id));

                if (temCargoDessaFaccao) {
                    faccaoEncontrada = factionId; // Achou! Ele veste essa farda.
                    break;
                }
            }

            // Garante que a ficha dele existe no sistema
            if (!progressao[newMember.id]) {
                progressao[newMember.id] = { totalWins: 0, nome: newMember.user.username };
            }

            // Compara o que está no banco de dados com o que ele está vestindo agora
            if (progressao[newMember.id].factionId !== faccaoEncontrada) {
                
                // Atualiza o banco de dados (Se ele tirou a farda, isso aqui vai virar 'null' ou vazio)
                progressao[newMember.id].factionId = faccaoEncontrada; 
                safeWriteJson(progressaoPath, progressao);
                
                if (faccaoEncontrada) {
                    console.log(`[SYNC] ${newMember.user.username} agora pertence à facção: ${faccaoEncontrada}.`);
                } else {
                    console.log(`[SYNC] ${newMember.user.username} perdeu/tirou a farda e agora é um Civil.`);
                }
            }

        } catch (error) {
            console.error("❌ Erro no Radar de Onboarding:", error);
        }
    });

    console.log("👁️ Radar de Onboarding (Atualizado: Trocas e Deserções) ativado!");
};