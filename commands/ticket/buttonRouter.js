/* commands/ticket/buttonRouter.js (NOVO FICHEIRO) */

// Importa os handlers especÃ­ficos de ticket
const ticketOpenHandler = require('./ticketOpenHandler.js');
const ticketCloseHandler = require('./ticketCloseHandler.js');

/**
 * Este Ã© o roteador de botÃµes APENAS para o sistema de TICKET.
 * O 'interactionCreate.js' chama este ficheiro, e este ficheiro
 * decide qual lÃ³gica de ticket executar.
 */
module.exports = async (interaction, client) => {
    const { customId } = interaction;

    // Adiciona 'await' e passa o 'client' se os handlers precisarem
    if (customId === 'ticket_abrir_denuncia') {
        await ticketOpenHandler(interaction, client); 
    }
    else if (customId === 'ticket_fechar') {
        await ticketCloseHandler(interaction, client);
    }
    // Se tiveres mais botÃµes de ticket (ex: 'ticket_reabrir'),
    // adiciona o 'else if' aqui.
};