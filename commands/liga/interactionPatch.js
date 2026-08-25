/* ========================================================================
   FIX DE INTERAÇÃO DA LIGA

   O index.js já encaminha liga_estatisticas através de liga_estat_.
   Portanto este patch NÃO deve tratar estatísticas, pois isso cria dois
   fluxos para a mesma interação e pode causar DiscordAPIError 40060.

   O único ID tratado aqui é liga_guia, que ainda não é encaminhado pelo
   roteador legado do index.js.
   ======================================================================== */

const { Client, MessageFlags } = require('discord.js');

if (!Client.prototype.__worldwarLigaInteractionFix) {

    const originalOn = Client.prototype.on;

    Client.prototype.on = function patchedOn(eventName, listener) {

        if (eventName !== 'interactionCreate') {
            return originalOn.call(this, eventName, listener);
        }

        const wrappedListener = async interaction => {

            const customId = interaction?.customId || '';

            // Estatísticas já são tratadas diretamente pelo index.js.
            // Não interceptar aqui evita processamento duplo e erro 40060.
            if (
                !interaction?.isButton?.() ||
                customId !== 'liga_guia'
            ) {
                return listener(interaction);
            }

            try {

                // O handler da guia usa editReply().
                // Portanto a interação precisa estar em modo deferReply.
                if (
                    !interaction.replied &&
                    !interaction.deferred
                ) {

                    await interaction.deferReply({
                        flags: MessageFlags.Ephemeral
                    });

                }

                const handler = require('./buttons.js');

                await handler(this, interaction);

            } catch (erro) {

                console.error(
                    '[LIGA] Erro ao processar botão Guia:',
                    erro
                );

                try {

                    const resposta = {
                        content: '❌ Não foi possível abrir o Guia da Liga.',
                        flags: MessageFlags.Ephemeral
                    };

                    if (
                        interaction.replied ||
                        interaction.deferred
                    ) {

                        await interaction.followUp(resposta);

                    } else {

                        await interaction.reply(resposta);

                    }

                } catch {}

            }

        };

        return originalOn.call(this, eventName, wrappedListener);
    };

    Client.prototype.__worldwarLigaInteractionFix = true;
}

module.exports = {};
