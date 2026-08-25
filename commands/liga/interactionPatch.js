/* ========================================================================
   FIX DE INTERAÇÕES DA LIGA

   O index.js possui um roteador legado que não encaminha alguns IDs da Liga
   (como liga_guia e liga_estatisticas) para buttons.js.

   Este módulo é carregado automaticamente pelo command loader e instala um
   pequeno roteador compatível antes dos listeners do index.js serem criados.
   Assim não precisamos duplicar a lógica da Liga nem alterar o fluxo dos
   outros sistemas.
   ======================================================================== */

const { Client } = require('discord.js');

if (!Client.prototype.__worldwarLigaInteractionFix) {

    const originalOn = Client.prototype.on;

    Client.prototype.on = function patchedOn(eventName, listener) {

        if (eventName !== 'interactionCreate') {
            return originalOn.call(this, eventName, listener);
        }

        const wrappedListener = async interaction => {

            const customId = interaction?.customId || '';

            const isLigaButton =
                interaction?.isButton?.() &&
                (
                    customId === 'liga_guia' ||
                    customId === 'liga_estatisticas'
                );

            if (!isLigaButton) {
                return listener(interaction);
            }

            try {

                const handler = require('./buttons.js');

                await handler(this, interaction);

            } catch (erro) {

                console.error(
                    '[LIGA] Erro ao processar botão principal:',
                    erro
                );

                try {

                    if (!interaction.replied && !interaction.deferred) {

                        await interaction.reply({
                            content: '❌ Não foi possível abrir esta seção da Liga.',
                            ephemeral: true
                        });

                    }

                } catch {}

            }

        };

        return originalOn.call(this, eventName, wrappedListener);
    };

    Client.prototype.__worldwarLigaInteractionFix = true;
}

// Não é um Slash Command. O loader do index.js apenas o carrega para ativar
// o patch acima e ignora o arquivo na coleção de comandos.
module.exports = {};
