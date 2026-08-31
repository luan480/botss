/* ========================================================================
   ARQUIVO: commands/olimpiadas/olimpiadas-painel.js

   SISTEMA:
   - 🟨 Olimpíadas de Duplas

   LOCALIZAÇÃO:
   commands/olimpiadas/

   COMANDO:
   /olimpiadas-painel

   O QUE ELE FAZ:
   Publica o painel oficial das Olimpíadas no canal definido em
   commands/olimpiadas/olimpiadas.json.

   COMO USAR:
   1. Execute /olimpiadas-painel.
   2. O bot publica o painel no canal configurado.
   3. A confirmação do comando aparece somente para quem executou.
   4. O canal não fica com uma mensagem dizendo que o comando foi usado.

   PERMISSÃO:
   - Administrador.

   ======================================================================== */

const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const {
    painel
} = require('./olimpiadas-handler.js');


// ========================================================================
// COMANDO SLASH
// ========================================================================

module.exports = {

    data: new SlashCommandBuilder()

        .setName('olimpiadas-painel')

        .setDescription(
            '🏅 Publica o painel das Olimpíadas de Duplas.'
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),


    // ====================================================================
    // EXECUÇÃO
    // ====================================================================
    // Entrega a execução ao handler principal das Olimpíadas.
    // ====================================================================

    async execute(interaction) {

        return painel(interaction);
    }
};
