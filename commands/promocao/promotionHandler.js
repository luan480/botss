/* ========================================================================
   ARQUIVO: commands/promocao/promotionHandler.js
   DESCRIÇÃO: Atribui cargos de patente no Discord usando diretamente os IDs do carreiras.json
   ======================================================================== */

const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');

const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');

/**
 * Atualiza os cargos de um membro com base no ID do cargo definido no carreiras.json
 * @import { GuildMember } from 'discord.js'
 */
async function atualizarCargoPatente(member) {
    if (!member || member.user.bot) return;

    const progressao = safeReadJson(progressaoPath);
    const carreiras = safeReadJson(carreirasPath);

    const dadosMembro = progressao[member.id];
    if (!dadosMembro || !dadosMembro.currentRankId) return;

    const faccao = carreiras.faccoes?.[dadosMembro.factionId];
    if (!faccao) return;

    // Acha a patente atual do membro no JSON de carreiras
    const rankAtual = faccao.caminho.find(r => r.id === dadosMembro.currentRankId);
    if (!rankAtual || !rankAtual.id) return;

    const cargoIdDesejado = rankAtual.id; // ID exato do cargo no Discord (ex: "874481262520315934")

    // Busca o cargo diretamente pelo ID no servidor
    const cargoDiscord = member.guild.roles.cache.get(cargoIdDesejado);

    if (!cargoDiscord) {
        console.log(`[CARGOS] ⚠️ Aviso: O cargo com ID ${cargoIdDesejado} (${rankAtual.nome}) não foi encontrado no servidor!`);
        return;
    }

    // Verifica se o membro já possui o cargo correto
    if (member.roles.cache.has(cargoDiscord.id)) return;

    try {
        // Coleta todos os IDs de cargos possíveis desta facção para fazer a limpeza correta
        const idsCargosFaccao = faccao.caminho.map(r => r.id).filter(Boolean);

        // Remove os cargos antigos de patentes anteriores da mesma facção
        const cargosParaRemover = member.roles.cache.filter(role => idsCargosFaccao.includes(role.id) && role.id !== cargoDiscord.id);
        if (cargosParaRemover.size > 0) {
            await member.roles.remove(cargosParaRemover).catch(() => {});
        }

        // Adiciona a nova patente no perfil do usuário usando o ID
        await member.roles.add(cargoDiscord);
        console.log(`[CARGOS] ✅ Sucesso! Cargo "${cargoDiscord.name}" (${cargoIdDesejado}) entregue ao membro ${member.user.tag}.`);

    } catch (error) {
        console.error(`[CARGOS] ❌ Erro ao atribuir cargo a ${member.user.tag}:`, error.message);
        console.log(`[DICA] Certifique-se de que o cargo do bot está posicionado ACIMA do cargo "${cargoDiscord.name}" na lista de cargos do Discord!`);
    }
}

module.exports = (client) => {
    client.atualizarCargoPatente = atualizarCargoPatente;
    console.log("✅ Sistema de Atribuição de Cargos por ID (PromotionHandler) ativado.");
};

module.exports.atualizarCargoPatente = atualizarCargoPatente;