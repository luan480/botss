/* ========================================================================
   ARQUIVO: commands/promocao/promotionHandler.js
   DESCRIÇÃO: Atribui cargos de patente no Discord usando os IDs do carreiras.json.
   ======================================================================== */

const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');

const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');

async function atualizarCargoPatente(member) {
    if (!member || member.user?.bot) return false;

    const progressao = safeReadJson(progressaoPath);
    const carreiras = safeReadJson(carreirasPath);
    const dadosMembro = progressao?.[member.id];

    if (!dadosMembro?.currentRankId || !dadosMembro?.factionId) return false;

    const faccao = carreiras?.faccoes?.[dadosMembro.factionId];
    if (!faccao?.caminho?.length) return false;

    const rankAtual = faccao.caminho.find(r => r.id === dadosMembro.currentRankId);
    if (!rankAtual?.id) return false;

    const cargoDiscord = member.guild.roles.cache.get(rankAtual.id);
    if (!cargoDiscord) {
        console.error(`[CARGOS] Cargo da patente não encontrado: ${rankAtual.id} (${rankAtual.nome || 'sem nome'})`);
        return false;
    }

    const botMember = member.guild.members.me || await member.guild.members.fetch(member.client.user.id).catch(() => null);
    if (!botMember) {
        console.error('[CARGOS] Não foi possível localizar o membro do bot no servidor.');
        return false;
    }

    if (cargoDiscord.id !== member.guild.id && cargoDiscord.position >= botMember.roles.highest.position) {
        console.error(`[CARGOS] O cargo ${cargoDiscord.name} está acima (ou no mesmo nível) do cargo do bot.`);
        return false;
    }

    if (member.roles.cache.has(cargoDiscord.id)) return true;

    const idsCargosFaccao = new Set(faccao.caminho.map(r => r.id).filter(Boolean));
    const cargosParaRemover = member.roles.cache.filter(
        role => idsCargosFaccao.has(role.id) && role.id !== cargoDiscord.id
    );

    try {
        if (cargosParaRemover.size > 0) {
            await member.roles.remove(cargosParaRemover);
        }
        await member.roles.add(cargoDiscord);
        console.log(`[CARGOS] ✅ Cargo "${cargoDiscord.name}" (${cargoDiscord.id}) entregue a ${member.user.tag}.`);
        return true;
    } catch (error) {
        console.error(`[CARGOS] ❌ Erro ao atualizar patente de ${member.user.tag}:`, error);
        return false;
    }
}

module.exports = (client) => {
    client.atualizarCargoPatente = atualizarCargoPatente;
    console.log('✅ Sistema de atribuição de cargos por ID (PromotionHandler) ativado.');
};

module.exports.atualizarCargoPatente = atualizarCargoPatente;
