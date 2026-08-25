/* ========================================================================
   SISTEMA DE CANAIS DE VOZ TEMPORÁRIOS ("CRIE SUA SALA") - COMPLETO E BLINDADO
   ======================================================================== */

const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const CANAL_GATILHO_ID = '1532094431891558400'; 

// Lista de controle na memória para registrar apenas as salas geradas pelo bot
const salasTemporarias = new Set();

module.exports = (client) => {
    console.log("✅ Sistema de Calls Temporárias completo e blindado ativado.");

    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        const member = newState.member;
        if (!member || member.user.bot) return;

        const canalNovo = newState.channel;
        const canalAntigo = oldState.channel;

        // 1. Se o usuário entrou no canal de gatilho "Criar Sala"
        if (canalNovo && canalNovo.id === CANAL_GATILHO_ID) {
            try {
                const guild = newState.guild;
                const categoria = canalNovo.parent; 
                const nomeSala = `🔊 • ${member.displayName}`;

                const salaCriada = await guild.channels.create({
                    name: nomeSala,
                    type: ChannelType.GuildVoice,
                    parent: categoria ? categoria.id : null,
                    userLimit: 8,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
                        },
                        {
                            id: member.id,
                            allow: [
                                PermissionFlagsBits.ManageChannels, 
                                PermissionFlagsBits.MoveMembers, 
                                PermissionFlagsBits.MuteMembers, 
                                PermissionFlagsBits.DeafenMembers,
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages
                            ],
                        },
                    ],
                });

                // Registra o ID da sala para controle exclusivo de exclusão
                salasTemporarias.add(salaCriada.id);

                await member.voice.setChannel(salaCriada).catch(() => {});
                console.log(`🎙️ Sala temporária criada para ${member.user.tag}`);

                setTimeout(async () => {
                    try {
                        const embedPainel = new EmbedBuilder()
                            .setColor('#8B0000')
                            .setTitle('TempVoice Interface')
                            .setDescription(
                                `Painel de controle exclusivo para **${member.displayName}**.\n\n` +
                                '```diff\n' +
                                '- NOMEAR  | 👥 LIMITAR  | 🔒 PRIVACIDADE | ⏱️ SALA DE ESPERA | 💬 CHAT\n' +
                                '- 👤 CONFIAR | 👥 DES-CONFIAR | 📞 CONVIDAR | ⛔ EXPULSAR | 🌐 REGIÃO\n' +
                                '- 🚫 BLOQUEAR | 🚫 DES-BLOQUEAR | 👑 REIVINDICAR | 🔸 TRANSFERIR | 🗑️ EXCLUIR\n' +
                                '```\n' +
                                'Pressione os botões abaixo para gerenciar sua call'
                            );

                        const row1 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('tvoice_nomear').setLabel('Nomear').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('tvoice_limitar').setLabel('Limitar').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('tvoice_privacidade').setLabel('Privacidade').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('tvoice_espera').setLabel('Espera').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('tvoice_chat').setLabel('Chat').setStyle(ButtonStyle.Secondary),
                        );

                        const row2 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('tvoice_confiar').setLabel('Confiar').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('tvoice_desconfiar').setLabel('Des-confiar').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('tvoice_convidar').setLabel('Convidar').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('tvoice_expulsar').setLabel('Expulsar').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('tvoice_regiao').setLabel('Região').setStyle(ButtonStyle.Secondary),
                        );

                        const row3 = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('tvoice_bloquear').setLabel('Bloquear').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('tvoice_desbloquear').setLabel('Des-bloquear').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('tvoice_reivindicar').setLabel('Reivindicar').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('tvoice_transferir').setLabel('Transferir').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('tvoice_excluir').setLabel('Excluir').setStyle(ButtonStyle.Danger),
                        );

                        await salaCriada.send({
                            embeds: [embedPainel],
                            components: [row1, row2, row3]
                        });
                    } catch (err) {
                        console.error("Não foi possível enviar o painel no chat da call:", err);
                    }
                }, 1000);

            } catch (err) {
                console.error("❌ Erro ao criar canal de voz temporário:", err);
            }
        }

        // 2. Deleta APENAS se o canal constar na lista de temporárias e estiver vazio (Protegendo Cafeteria, Cinema, etc.)
        if (canalAntigo && canalAntigo.id !== CANAL_GATILHO_ID) {
            if (salasTemporarias.has(canalAntigo.id) && canalAntigo.members.size === 0) {
                salasTemporarias.delete(canalAntigo.id);
                await canalAntigo.delete().catch(() => {});
                console.log(`🗑️ Sala temporária vazia removida com segurança: ${canalAntigo.name}`);
            }
        }
    });

    // 3. Ouve o envio dos Modais de gerenciamento (Nome e Limite de Vagas)
    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isModalSubmit()) return;

        const channel = interaction.member.voice.channel;
        if (!channel) {
            return interaction.reply({ content: '❌ Você precisa estar em um canal de voz para alterar suas configurações.', flags: MessageFlags.Ephemeral });
        }

        if (interaction.customId === 'tvoice_modal_nomear') {
            const novoNome = interaction.fields.getTextInputValue('novo_nome');
            try {
                await channel.setName(novoNome);
                await interaction.reply({ content: `✅ Sala renomeada para **${novoNome}** com sucesso!`, flags: MessageFlags.Ephemeral });
            } catch (err) {
                await interaction.reply({ content: '❌ Erro ao renomear a sala. Verifique as permissões.', flags: MessageFlags.Ephemeral });
            }
        }

        if (interaction.customId === 'tvoice_modal_limitar') {
            const limiteTexto = interaction.fields.getTextInputValue('novo_limite');
            const novoLimite = parseInt(limiteTexto) || 0;
            try {
                await channel.setUserLimit(novoLimite);
                await interaction.reply({ content: `👥 Limite de vagas alterado para **${novoLimite === 0 ? 'Ilimitado' : novoLimite}** pessoas!`, flags: MessageFlags.Ephemeral });
            } catch (err) {
                await interaction.reply({ content: '❌ Erro ao alterar o limite da sala. Verifique as permissões.', flags: MessageFlags.Ephemeral });
            }
        }
    });
};