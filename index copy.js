/* ========================================================================
   ARQUIVO index.js (FINAL - COMPLETO, UNIFICADO E BLINDADO)
   ======================================================================== */

const { Client, GatewayIntentBits, Collection, Events, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,       // Obrigatório para ler comandos por texto
        GatewayIntentBits.GuildMembers,         // Necessário para rastrear membros e cargos
        GatewayIntentBits.GuildMessageReactions,// Necessário para auditoria de reações (estornos e invalidação)
        GatewayIntentBits.GuildModeration,      // Necessário para capturar banimentos e moderação
        GatewayIntentBits.GuildVoiceStates      // Necessário para rastrear calls e controle de voz
    ],
});

// --- Carregador de Comandos ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

function readCommands(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            readCommands(filePath);
        } else if (file.endsWith('.js')) {
            try {
                if (file.endsWith('Handler.js') || file.endsWith('Router.js') || file.endsWith('Engine.js') || file === 'embedSystem.js' || file === 'buttons.js' || file === 'logger.js') {
                    continue; 
                }

                const command = require(filePath);
                if (command.data && command.data.toJSON && command.execute) {
                    client.commands.set(command.data.name, command);
                    console.log(`[CMD] Carregado: ${command.data.name}`);
                }
            } catch (err) { console.error(`[AVISO] Erro em ${file}: ${err.message}`); }
        }
    }
}
readCommands(commandsPath);

// --- Bot Pronto ---
client.once(Events.ClientReady, async c => {
    console.log(`🤖 ${c.user.tag} está online!`);
    
    // 1. Varredura e recuperação automática ao ligar/reiniciar para garantir sincronia pós-queda
    try { 
        const { executarVarreduraCanal } = require('./commands/promocao/syncEngine.js');
        await executarVarreduraCanal(client);
        console.log("✅ Varredura e recuperação automática de prints concluída.");
    } catch(e) { console.error("❌ Falha na varredura automática ao iniciar:", e); }

    // 2. Sistema de Promoções e Progressão
    try { 
        require('./commands/promocao/promotionHandler.js')(client); 
        console.log("✅ Sistema de Promoção ativado.");
    } catch(e) { console.error("❌ Falha ao carregar promotionHandler:", e); }

    // 3. Respostas Automáticas da Administração
    try { 
        require('./commands/adm/autoResponseHandler.js')(client); 
        console.log("✅ Sistema de Respostas Automáticas ativado.");
    } catch(e) { console.error("❌ Falha ao carregar autoResponseHandler:", e); }

    // 4. Invalidação e Estorno Instantâneo por Reação de X Vermelho (❌) [Substituiu o antigo audit]
    try { 
        require('./commands/promocao/reactionInvalidateHandler.js')(client); 
        console.log("✅ Sistema de Invalidação por Reação (❌) ativado.");
    } catch(e) { console.error("❌ Falha ao carregar reactionInvalidateHandler:", e); }

    // 5. Sistema de Economia via Texto (%)
    try { 
        require('./commands/economy/economyTextHandler.js')(client); 
        console.log("✅ Sistema de Economia via Texto (%) ativado.");
    } catch(e) { console.error("❌ Falha ao carregar economyTextHandler:", e); }

    // 6. Sistema Completo de Logs Administrativos e Auditoria Global
    try { 
        require('./commands/adm/adminLogHandler.js')(client); 
        console.log("✅ Sistema Completo de Logs Administrativos ativado.");
    } catch(e) { console.error("❌ Falha ao carregar adminLogHandler:", e); }

    // 7. Manipulador de Votação e Controle Democrático de Calls
    try { 
        require('./commands/voz/voiceControlHandler.js')(client); 
        console.log("✅ Sistema de Controle de Calls por Votação ativado.");
    } catch(e) { console.error("❌ Falha ao carregar voiceControlHandler:", e); }
});

// --- Interações (Slash Commands e Botões/Menus/Modais) ---
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try { await command.execute(interaction); } 
        catch (err) { 
            console.error(err);
            const msg = { content: '❌ Erro ao executar o comando.', flags: MessageFlags.Ephemeral };
            if(interaction.replied) await interaction.followUp(msg); else await interaction.reply(msg);
        }
    }
    else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu()) {
        const id = interaction.customId;
        try {
            if (id.startsWith('ticket_')) await require('./commands/ticket/buttonRouter.js')(interaction, client);
            else if (id.startsWith('stt_')) await require('./commands/promocao/statusHandler.js')(interaction, client);
            else if (id.startsWith('rank_')) await require('./commands/promocao/rankingHandler.js')(interaction, client);
            else if (id.startsWith('hist_')) await require('./commands/promocao/historicoHandler.js')(interaction, client);
            else if (id.startsWith('emb_') || id.startsWith('mdl_')) await require('./commands/adm/embedSystem.js')(interaction, client);
            else if (id.startsWith('vcall_select_')) {
                const targetUserId = interaction.values[0];
                interaction.customId = `vcall_k_${targetUserId}`;
            }
            else if (interaction.isButton()) await require('./commands/liga/buttons')(client, interaction);
        } catch (err) { console.error("Erro no roteador de interações:", err); }
    }
});

client.login(config.token);