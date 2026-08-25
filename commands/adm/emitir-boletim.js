/* ========================================================================
   ARQUIVO: commands/adm/emitir-boletim.js
   DESCRIÇÃO: Força a emissão do Boletim Semanal ou Mensal manualmente
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const geradorRelatorios = require('./weeklyReportHandler.js'); // Importa o arquivo inteiro

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emitir-relatorio')
        .setDescription('🚨 [STAFF] Força a publicação imediata de um Boletim.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt => 
            opt.setName('tipo')
                .setDescription('Qual relatório você quer gerar agora?')
                .setRequired(true)
                .addChoices(
                    { name: '📅 Boletim Semanal (Zera Kills/Continentes)', value: 'semanal' },
                    { name: '🏆 Relatório Mensal (Zera a Liga)', value: 'mensal' }
                )
        ),

    async execute(interaction) {
        // Uso da nova flag do Discord.js para mensagens invisíveis (evita aquele aviso amarelo no console)
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const tipo = interaction.options.getString('tipo');

        try {
            if (tipo === 'semanal') {
                // Chama a função atrelada ao arquivo
                await geradorRelatorios.emitirBoletimSemanal(interaction.client);
                await interaction.editReply('✅ **Boletim Semanal** emitido com sucesso! Kills, Mortes e Continentes foram zerados.');
            } else {
                await geradorRelatorios.emitirRelatorioMensal(interaction.client);
                await interaction.editReply('✅ **Relatório Mensal** emitido com sucesso! A Liga foi zerada e os campeões receberam os cargos.');
            }
        } catch (erro) {
            console.error(erro);
            await interaction.editReply('❌ Erro crítico ao gerar o relatório. Olhe o console.');
        }
    }
};