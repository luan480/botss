/* ========================================================================
   ARQUIVO: commands/liga/regras.js
   DESCRIÇÃO: Exibe o Guia Oficial e Regras da Liga WorldWarBR
   ======================================================================== */

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { isStaff } = require('./utils/helpers.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('regras')
        .setDescription('📜 Exibe o Guia Oficial e Regras da Liga WorldWarBR.')
        .addBooleanOption(opt => 
            opt.setName('publico')
               .setDescription('Se true, envia no canal visível para todos (Requer Staff).')
               .setRequired(false)
        ),

    async execute(interaction) {
        const publico = interaction.options.getBoolean('publico') || false;

        if (publico && !isStaff(interaction.member)) {
            return interaction.reply({ 
                content: '❌ Apenas membros da Staff podem enviar as regras publicamente no canal.', 
                flags: MessageFlags.Ephemeral 
            });
        }

        const embedRegras = new EmbedBuilder()
            .setTitle('📜 LIGA WORLDWAR BR • Regras Oficiais & Guia de Registro')
            .setColor('#0a4d5c')
            .setDescription('Nossas regras foram elaboradas para garantir uma experiência de jogo madura, justa e desafiadora para todos os generais.')
            .addFields(
                { 
                    name: '🛡️ REQUISITOS OBRIGATÓRIOS', 
                    value: '• **Duração:** Máx. 1 hora (Termina após a rodada do último jogador).\n• **Jogadores:** Mínimo de 6 participantes.\n• **Inscrição:** Todos devem ser membros do servidor.\n• **Limite:** Máx. 80 partidas por jogador.\n• **1ª Rodada:** Proibido alocar todas as tropas no mesmo continente.' 
                },
                { 
                    name: '🚨 ANTI-JOGO (PROIBIDO)', 
                    value: '• **Bugs/Cheats:** Explorar falhas ou usar hacks.\n• **Ghosting:** Dar dicas por call/live para quem está jogando.\n• **Farming:** Ceder territórios propositalmente para gerar cartas.\n• **Retirada de Tropas por Trégua:** Proibido remover as defesas de uma fronteira com um jogador por trégua para atacar outro.\n• **Perseguição:** Focar um jogador por motivos pessoais/externos.\n• **Kamikaze:** Sacrificar tropas sem lógica estratégica.\n• **Entregar Abate:** Facilitar a eliminação propositalmente.' 
                },
                { 
                    name: '📋 COMO REGISTRAR UMA PARTIDA', 
                    value: '• **Iniciar:** Vá ao Painel da Liga e clique em "Contabilizar" (Se ocupado, aguarde sua vez).\n• **Comprovante:** O bot abrirá o chat. Envie o Print da Vitória em até 2 minutos.\n• **Responder:** O bot fará as perguntas do registro marcando os jogadores.' 
                },
                { 
                    name: '📊 PERGUNTAS & PONTUAÇÃO', 
                    value: '• **Grande Vencedor:** +30 pts (Objetivo) ou +20 pts (Territórios).\n• **2º Lugar:** +10 pts.\n• **Combates:** +10 pts por Kill / -20 pts por Morte.\n• **Continentes:** Ásia (+7), Am. Norte/Europa (+5), África (+3), Am. Sul/Oceania (+2).\n• **Sobreviventes:** +5 pts automáticos.' 
                },
                { 
                    name: '💸 ECONOMIA & RECOMPENSAS', 
                    value: '• **Ranking:** Atualizado instantaneamente.\n• **Dinheiro:** Cada 1 Ponto = WC$ 100 na conta!\n• **Errou?:** Use o botão "Reverter" no final do registro para cancelar.' 
                }
            )
            .setFooter({ text: 'WorldWarBR • A disciplina garante a vitória.' })
            .setTimestamp();

        if (publico) {
            await interaction.channel.send({ embeds: [embedRegras] });
            return interaction.reply({ content: '✅ Regras publicadas com sucesso!', flags: MessageFlags.Ephemeral });
        } else {
            return interaction.reply({ embeds: [embedRegras], flags: MessageFlags.Ephemeral });
        }
    }
};