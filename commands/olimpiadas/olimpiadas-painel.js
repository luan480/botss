/* ========================================================================
   ARQUIVO: commands/olimpiadas/olimpiadas-painel.js

   SISTEMA:
   - 🟨 Olimpíadas de Duplas
   - 📝 Publicação do painel oficial
   - 🔎 Registro com pesquisa de país

   LOCALIZAÇÃO:
   commands/olimpiadas/

   COMANDO:
   /olimpiadas-painel

   O QUE ESTE COMANDO FAZ:
   Publica o painel oficial no canal configurado.
   A versão nova usa o fluxo de registro que permite digitar o nome do país.

   COMO USAR:
   1. Execute /olimpiadas-painel.
   2. O bot publica o painel no canal configurado.
   3. A confirmação aparece somente para quem executou o comando.
   4. Para registrar, escolha os dois jogadores e pesquise o país.

   PERMISSÃO:
   - Administrador.

   ======================================================================== */

const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const {
    publicarPainel,
    instalar
} = require('./olimpiadas-patch.js');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('olimpiadas-painel')
        .setDescription('🏅 Publica o painel das Olimpíadas de Duplas.')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {
        instalar(interaction.client);
        return publicarPainel(interaction);
    }
};
