/* ========================================================================
   ARQUIVO: commands/promocao/promotionHandler.js
   DESCRIÇÃO: Atribui cargos de patente no Discord usando os IDs do carreiras.json.
   Também registra o roteamento do gerenciamento do Hall da Fama.
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

function registrarHallHandler(client) {
    if (client.__hallManagerInteractionHandler) return;

    client.__hallManagerInteractionHandler = true;

    client.on('interactionCreate', async interaction => {
        try {
            if (interaction.guildId && interaction.guildId !== String(interaction.client.config?.guildId || '8496966981924687914')) {
                // O index.js já faz a validação principal de servidor.
                // Não bloquear aqui para evitar duplicar a configuração.
            }

            if (interaction.isAutocomplete() && interaction.commandName === 'hall-gerenciar') {
                const comando = client.commands?.get('hall-gerenciar');
                if (comando?.autocomplete) {
                    return await comando.autocomplete(interaction);
                }
                return interaction.respond([]).catch(() => {});
            }

            const customId = interaction.customId || '';
            const ehHallGerenciamento =
                (interaction.isButton() && customId.startsWith('hall_manage_')) ||
                (interaction.isModalSubmit() && customId.startsWith('hall_edit_submit_'));

            if (!ehHallGerenciamento) return;

            const comando = client.commands?.get('hall-gerenciar') || require('./hall-gerenciar.js');
            if (typeof comando.handler === 'function') {
                return await comando.handler(interaction);
            }
        } catch (erro) {
            console.error('[HALL] Erro no autocomplete/gerenciamento:', erro);

            if (interaction.isAutocomplete()) {
                return interaction.respond([]).catch(() => {});
            }

            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                return interaction.reply({
                    content: '❌ Ocorreu um erro ao processar o gerenciamento do Hall.',
                    flags: 64
                }).catch(() => {});
            }
        }
    });
}

module.exports = (client) => {
    client.atualizarCargoPatente = atualizarCargoPatente;
    registrarHallHandler(client);
    console.log('✅ Sistema de atribuição de cargos por ID (PromotionHandler) ativado.');
};

module.exports.atualizarCargoPatente = atualizarCargoPatente;
module.exports.registrarHallHandler = registrarHallHandler;
