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

const olimp = require('./olimpiadas-handler.js');
const { painel } = olimp;

/* ========================================================================
   CORREÇÃO DE INTERAÇÃO — SELEÇÃO DE PAÍS

   A confirmação do país fazia operações assíncronas (fetch do canal,
   envio do log e atualização do painel) antes de responder à interação.
   Isso podia ultrapassar o prazo do Discord e gerar "Esta interação falhou".

   O handler continua com a mesma lógica. Aqui apenas confirmamos a
   interação imediatamente com deferUpdate() e redirecionamos update/reply
   posteriores para editReply/followUp enquanto o processamento termina.
   ======================================================================== */

if (typeof olimp.handle === 'function' && !olimp.__countryInteractionFixed) {
    const handleOriginal = olimp.handle;

    olimp.handle = async function handleOlimpiadasComFix(interaction, ...args) {
        const customId = String(interaction?.customId || '');
        const ehSelecaoDePais = customId.startsWith('olymp_pais_');

        if (
            !ehSelecaoDePais ||
            interaction.replied ||
            interaction.deferred
        ) {
            return handleOriginal.call(this, interaction, ...args);
        }

        const updateOriginal = interaction.update.bind(interaction);
        const replyOriginal = interaction.reply.bind(interaction);

        try {
            // Acknowledge immediately. O Discord.js documenta deferUpdate()
            // especificamente para interações de componentes.
            await interaction.deferUpdate();

            // O handler original chama update/reply depois de operações
            // assíncronas. Como a interação já foi reconhecida, encaminhamos
            // essas respostas para os métodos compatíveis com o estado atual.
            interaction.update = options => interaction.editReply(options);
            interaction.reply = options => interaction.followUp(options);

            return await handleOriginal.call(this, interaction, ...args);
        } finally {
            interaction.update = updateOriginal;
            interaction.reply = replyOriginal;
        }
    };

    Object.defineProperty(olimp, '__countryInteractionFixed', {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
    });
}

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
