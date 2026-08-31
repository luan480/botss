/* ========================================================================
   ARQUIVO: commands/olimpiadas/olimpiadas-painel.js

   SISTEMA:
   - 🟨 Olimpíadas de Duplas
   - 📝 Publicação do único painel oficial

   COMANDO:
   /olimpiadas-painel

   O QUE FAZ:
   Publica o painel no canal configurado em olimpiadas.json.
   O painel usa diretamente o handler principal.

   IMPORTANTE:
   - Não existe segundo painel.
   - Não utiliza olimpiadas-patch.js.
   - O registro permite lista de países + pesquisa por nome.
   - A confirmação do comando é privada.
   ======================================================================== */

const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const { painel } = require('./olimpiadas-handler.js');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('olimpiadas-painel')
        .setDescription('🏅 Publica o painel das Olimpíadas de Duplas.')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {
        return painel(interaction);
    }
};
