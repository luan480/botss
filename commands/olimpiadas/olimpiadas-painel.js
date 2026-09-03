/* ========================================================================
   ARQUIVO: commands/olimpiadas/olimpiadas-painel.js

   SISTEMA:
   - 🟨 Olimpíadas de Duplas
   - 📝 Publicação do único painel oficial

   COMANDO:
   /olimpiadas-painel

   IMPORTANTE:
   - O comando confirma a interação imediatamente.
   - Componentes das Olimpíadas são protegidos contra timeout.
   - O botão de pesquisa continua usando showModal() sem defer antes dele.
   ======================================================================== */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');

const olimp = require('./olimpiadas-handler.js');
const { painel } = olimp;

/* ========================================================================
   PROTEÇÃO DAS INTERAÇÕES DAS OLIMPÍADAS

   Alguns handlers fazem operações assíncronas antes de responder ao
   Discord (fetch de canal, envio de log, atualização do painel etc.).
   Se isso demora mais que a janela da interação, aparece:
   "Esta interação falhou".

   A correção é reconhecer primeiro a interação de componente com
   deferUpdate(). Depois, o handler original continua usando a mesma lógica,
   mas update() vira editReply() e reply() vira followUp().

   EXCEÇÃO:
   - olymp_buscar_* abre um modal e NÃO pode ser deferido antes de
     showModal().
   ======================================================================== */

if (typeof olimp.handle === 'function' && !olimp.__interactionProtectionInstalled) {
    const handleOriginal = olimp.handle;

    olimp.handle = async function handleOlimpiadasProtegido(interaction, ...args) {
        const customId = String(interaction?.customId || '');

        if (
            !customId.startsWith('olymp_') ||
            interaction.replied ||
            interaction.deferred
        ) {
            return handleOriginal.call(this, interaction, ...args);
        }

        // Este botão precisa chamar showModal() diretamente.
        const abreModal = customId.startsWith('olymp_buscar_');

        if (abreModal) {
            return handleOriginal.call(this, interaction, ...args);
        }

        const updateOriginal = interaction.update.bind(interaction);
        const replyOriginal = interaction.reply.bind(interaction);

        try {
            // Confirma imediatamente qualquer botão/select das Olimpíadas.
            await interaction.deferUpdate();

            // O handler original continua funcionando sem precisar ser
            // reescrito inteiro.
            interaction.update = options => interaction.editReply(options);
            interaction.reply = options => interaction.followUp(options);

            return await handleOriginal.call(this, interaction, ...args);
        } catch (erro) {
            console.error('[OLIMPIADAS] Erro após defer da interação:', erro);

            if (!interaction.replied && !interaction.deferred) {
                return replyOriginal({
                    content: '❌ Não foi possível processar esta ação.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }

            return null;
        } finally {
            interaction.update = updateOriginal;
            interaction.reply = replyOriginal;
        }
    };

    Object.defineProperty(olimp, '__interactionProtectionInstalled', {
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
        // O painel pode fazer fetch/send/edit e, por isso, também precisa
        // confirmar o slash command antes do processamento.
        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            const replyOriginal = interaction.reply.bind(interaction);

            try {
                // O handler do painel normalmente usa reply() para confirmar
                // a publicação. Como já deferimos, editamos essa resposta.
                interaction.reply = options => interaction.editReply(options);
                return await painel(interaction);
            } catch (erro) {
                console.error('[OLIMPIADAS] Erro no /olimpiadas-painel:', erro);

                return interaction.editReply({
                    content: '❌ Não foi possível publicar o painel das Olimpíadas.'
                }).catch(() => {});
            } finally {
                interaction.reply = replyOriginal;
            }
        }

        return painel(interaction);
    }
};
