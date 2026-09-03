/* ========================================================================
   WORLDWARBR — OLIMPÍADAS DE DUPLAS
   RUNTIME / COMPATIBILIDADE

   O handler principal continua contendo toda a lógica das Olimpíadas.
   Este arquivo recompõe os exports do handler e centraliza a confirmação
   rápida das interações para evitar "Esta interação falhou".
   ======================================================================== */

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { MessageFlags } = require('discord.js');

const handlerPath = path.join(__dirname, 'olimpiadas-handler.js');
const source = fs.readFileSync(handlerPath, 'utf8');

const runtimeModule = new Module(handlerPath, module);
runtimeModule.filename = handlerPath;
runtimeModule.paths = Module._nodeModulePaths(__dirname);

const exportBlock = `
module.exports = {
    handle,
    painel,
    criarPainel,
    criarBotoes,
    atualizarPainel,
    calcularRanking,
    rankingPaises,
    podeContabilizar
};
`;

runtimeModule._compile(`${source}\n${exportBlock}`, handlerPath);

const olimp = runtimeModule.exports;

if (typeof olimp.handle !== 'function') {
    throw new Error('[OLIMPIADAS] O handler não expôs a função handle.');
}

/*
 * O index.js existente faz require direto de olimpiadas-handler.js nos
 * eventos de botão/select/modal. Como este runtime recompõe o handler
 * corretamente, colocamos sua instância no cache do Node para que esses
 * requires recebam exatamente o mesmo objeto e o mesmo estado em memória.
 */
require.cache[handlerPath] = runtimeModule;

/* ========================================================================
   PROTEÇÃO DAS INTERAÇÕES
   ======================================================================== */

const handleOriginal = olimp.handle;

olimp.handle = async function handleProtegido(interaction, ...args) {
    const customId = String(interaction?.customId || '');

    if (!customId.startsWith('olymp_')) {
        return handleOriginal.call(this, interaction, ...args);
    }

    /* Modal já precisa ser respondido com reply(). */
    if (interaction.isModalSubmit?.()) {
        return handleOriginal.call(this, interaction, ...args);
    }

    /* Este botão precisa chamar showModal() diretamente. */
    if (customId.startsWith('olymp_buscar_')) {
        return handleOriginal.call(this, interaction, ...args);
    }

    if (interaction.replied || interaction.deferred) {
        return handleOriginal.call(this, interaction, ...args);
    }

    const updateOriginal = interaction.update?.bind(interaction);
    const replyOriginal = interaction.reply?.bind(interaction);

    try {
        /* Confirma imediatamente qualquer botão/select das Olimpíadas. */
        await interaction.deferUpdate();

        if (interaction.update) {
            interaction.update = options => interaction.editReply(options);
        }

        if (interaction.reply) {
            interaction.reply = options => interaction.followUp(options);
        }

        return await handleOriginal.call(this, interaction, ...args);
    } catch (erro) {
        console.error('[OLIMPIADAS] Erro processando interação:', erro);

        if (!interaction.replied && !interaction.deferred && replyOriginal) {
            await replyOriginal({
                content: '❌ Não foi possível processar esta ação das Olimpíadas.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        return null;
    } finally {
        if (updateOriginal) interaction.update = updateOriginal;
        if (replyOriginal) interaction.reply = replyOriginal;
    }
};

module.exports = olimp;
