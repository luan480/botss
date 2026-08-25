/* ========================================================================
   ARQUIVO: commands/economy/admin-eco.js (CORRIGIDO)
   DESCRIÇÃO: Gerencia a economia (Dar/Tirar dinheiro) com nomes corretos.
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

// Garante que o caminho do banco de dados esteja certo
const economyPath = path.join(__dirname, 'economy.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-eco')
        .setDescription('🔧 Gerencia a economia (Dar/Tirar dinheiro do Cofre).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('adicionar')
                .setDescription('Dá dinheiro para um membro (Eventos/Prêmios).')
                .addUserOption(op => op.setName('usuario').setDescription('Quem vai receber?').setRequired(true))
                .addIntegerOption(op => op.setName('valor').setDescription('Quanto?').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('remover')
                .setDescription('Remove dinheiro de um membro (Punição/Correção).')
                .addUserOption(op => op.setName('usuario').setDescription('Quem vai perder?').setRequired(true))
                .addIntegerOption(op => op.setName('valor').setDescription('Quanto?').setRequired(true))
        ),

    async execute(interaction) {
        try {
            const sub = interaction.options.getSubcommand();
            // Agora usamos os nomes que aparecem no Discord: 'usuario' e 'valor'
            const target = interaction.options.getUser('usuario');
            const valor = interaction.options.getInteger('valor');

            if (!target) {
                return interaction.reply({ content: '❌ Erro: Usuário não encontrado.', flags: MessageFlags.Ephemeral });
            }

            // Lê o banco
            const economy = safeReadJson(economyPath);
            const saldoAtual = economy[target.id] || 0;
            let novoSaldo = saldoAtual;

            // Lógica de Adicionar
            if (sub === 'adicionar') {
                novoSaldo = saldoAtual + valor;
                economy[target.id] = novoSaldo;
                safeWriteJson(economyPath, economy);

                const embed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('💰 Injeção de Recursos (Admin)')
                    .setDescription(
                        `O Comando Central enviou recursos.\n\n` +
                        `📥 **Destinatário:** ${target}\n` +
                        `💰 **Valor Adicionado:** $${valor} WarCoins\n` +
                        `🏦 **Novo Saldo:** \`$${novoSaldo} WarCoins\``
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
            }

            // Lógica de Remover
            if (sub === 'remover') {
                novoSaldo = saldoAtual - valor;
                if (novoSaldo < 0) novoSaldo = 0; // Não deixa ficar negativo
                
                economy[target.id] = novoSaldo;
                safeWriteJson(economyPath, economy);

                const embed = new EmbedBuilder()
                    .setColor('Red')
                    .setTitle('📉 Confisco de Recursos (Admin)')
                    .setDescription(
                        `O Comando Central confiscou recursos.\n\n` +
                        `📤 **Alvo:** ${target}\n` +
                        `💸 **Valor Removido:** $${valor} WarCoins\n` +
                        `🏦 **Novo Saldo:** \`$${novoSaldo} WarCoins\``
                    )
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });
            }

        } catch (err) {
            console.error("Erro no admin-eco:", err);
            // Evita que o bot trave sem resposta
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ Ocorreu um erro interno ao executar o comando.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};