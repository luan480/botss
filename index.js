/* ========================================================================
   ARQUIVO: index.js

   SISTEMA:
   WORLDWARBR — MASTER / GERENCIADOR PRINCIPAL DO BOT

   O QUE ESTE ARQUIVO FAZ:
   - Inicializa o Discord Client.
   - Carrega automaticamente os comandos da pasta commands/.
   - Sincroniza os Slash Commands no servidor autorizado.
   - Inicia os handlers automáticos do bot.
   - Roteia botões, menus e modais para seus respectivos sistemas.
   - Mantém o bot restrito ao servidor configurado.
   - Faz login usando config.json ou variável de ambiente.

   LOCALIZAÇÃO:
   /index.js

   IMPORTANTE:
   Este arquivo é o ponto de entrada do bot. Sistemas individuais devem ficar
   dentro de suas respectivas pastas em commands/.

   EXEMPLO:
   commands/olimpiadas/       -> Olimpíadas
   commands/liga/             -> Liga
   commands/promocao/         -> Promoções
   commands/adm/              -> Administração

   ======================================================================== */

const {
    Client,
    GatewayIntentBits,
    Collection,
    Events,
    MessageFlags,
    ActivityType
} = require('discord.js');

const fs = require('fs');
const path = require('path');


// ========================================================================
// CONFIGURAÇÃO PRINCIPAL
// ========================================================================
// O config.json deve ficar ao lado deste index.js.
// Ele não precisa ser publicado no GitHub.
// ========================================================================

let config = {};

try {

    config = require('./config.json');

} catch (erro) {

    console.error(
        '❌ config.json não encontrado ou inválido.'
    );

    process.exit(1);
}


// ========================================================================
// TOKEN DO BOT
// ========================================================================
// Ordem de procura:
// 1. config.token
// 2. config.DISCORD_TOKEN
// 3. config.botToken
// 4. DISCORD_TOKEN
// 5. BOT_TOKEN
// 6. TOKEN
// ========================================================================

const TOKEN =
    config.token ||
    config.DISCORD_TOKEN ||
    config.botToken ||
    process.env.DISCORD_TOKEN ||
    process.env.BOT_TOKEN ||
    process.env.TOKEN;


// ========================================================================
// SERVIDOR AUTORIZADO
// ========================================================================
// O bot permanece somente neste servidor.
// ID padrão atual: 849696655510863914
// ========================================================================

const ID_SERVIDOR_AUTORIZADO = String(
    config.guildId ||
    config.idServidor ||
    config.servidorId ||
    '849696655510863914'
);


// ========================================================================
// DEPENDÊNCIAS DA LIGA
// ========================================================================

const handleReverter = require(
    './commands/liga/handlers/handleReverter.js'
);

const pontuacaoPath = path.join(
    __dirname,
    'commands',
    'liga',
    'pontuacao.json'
);

const partidasPath = path.join(
    __dirname,
    'commands',
    'liga',
    'partidas.json'
);


// ========================================================================
// CLIENT DO DISCORD
// ========================================================================
// Intents necessários para os sistemas atuais do WorldWarBR.
// ========================================================================

const client = new Client({

    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates
    ]
});


// ========================================================================
// COLEÇÃO DE COMANDOS
// ========================================================================

client.commands = new Collection();

const commandsPath = path.join(
    __dirname,
    'commands'
);


// ========================================================================
// ARQUIVOS QUE NÃO SÃO SLASH COMMANDS
// ========================================================================
// Arquivos de teste, roteadores e índices não devem ser carregados como
// comandos.
// ========================================================================

const ARQUIVOS_IGNORADOS = new Set([
    'testePeriodosLiga.js',
    'testeEstatisticasLiga.js',
    'testeEstatisticasV2.js',
    'index.js',
    'buttons.js',
    'interactionPatch.js'
]);


// ========================================================================
// CARREGADOR AUTOMÁTICO DE COMANDOS
// ========================================================================
// Percorre commands/ e todas as subpastas.
// Um arquivo só entra na Collection se possuir:
// - data.toJSON()
// - execute()
// ========================================================================

function carregarComandos(diretorio) {

    if (!fs.existsSync(diretorio)) {
        return;
    }

    for (const arquivo of fs.readdirSync(diretorio)) {

        const caminho = path.join(
            diretorio,
            arquivo
        );

        let stat;

        try {

            stat = fs.statSync(caminho);

        } catch {
            continue;
        }

        if (stat.isDirectory()) {

            carregarComandos(caminho);
            continue;
        }

        if (
            !arquivo.endsWith('.js') ||
            ARQUIVOS_IGNORADOS.has(arquivo)
        ) {
            continue;
        }

        try {

            delete require.cache[
                require.resolve(caminho)
            ];

            const comando = require(caminho);

            if (
                !comando?.data ||
                typeof comando.data.toJSON !== 'function' ||
                typeof comando.execute !== 'function'
            ) {
                continue;
            }

            const nome = comando.data.name;

            if (!nome) {
                continue;
            }

            if (client.commands.has(nome)) {

                console.warn(
                    `[CMD] Comando duplicado ignorado: ${nome}`
                );

                continue;
            }

            client.commands.set(
                nome,
                comando
            );

            console.log(
                `[CMD] Carregado: ${nome}`
            );

        } catch (erro) {

            console.error(
                `[CMD] Erro ao carregar ${caminho}:`,
                erro
            );
        }
    }
}


carregarComandos(commandsPath);


// ========================================================================
// BOT ONLINE
// ========================================================================

client.once(
    Events.ClientReady,
    async clientPronto => {

        console.log(
            `🤖 ${clientPronto.user.tag} está online!`
        );


        // ================================================================
        // PRESENÇA
        // ================================================================

        try {

            clientPronto.user.setPresence({

                activities: [
                    {
                        name: config.presence || 'WAR',
                        type: ActivityType.Playing
                    }
                ],

                status: 'online'
            });

        } catch {}


        // ================================================================
        // VALIDAR SERVIDORES
        // ================================================================
        // Qualquer servidor diferente do autorizado é abandonado.
        // ================================================================

        try {

            const guilds =
                await clientPronto.guilds.fetch();

            for (const [, guildData] of guilds) {

                if (
                    guildData.id !==
                    ID_SERVIDOR_AUTORIZADO
                ) {

                    const guild =
                        clientPronto.guilds.cache.get(
                            guildData.id
                        );

                    if (guild) {

                        await guild.leave()
                            .catch(() => {});
                    }
                }
            }

        } catch (erro) {

            console.error(
                '❌ Erro ao validar servidores:',
                erro
            );
        }


        // ================================================================
        // SINCRONIZAR SLASH COMMANDS
        // ================================================================
        // Limpa comandos globais e registra os comandos no servidor correto.
        // Isso faz novos /comandos aparecerem no servidor.
        // ================================================================

        try {

            const guild =
                clientPronto.guilds.cache.get(
                    ID_SERVIDOR_AUTORIZADO
                );

            if (guild) {

                await clientPronto.application.commands.set([]);

                await guild.commands.set(
                    client.commands.map(
                        comando => comando.data.toJSON()
                    )
                );

                console.log(
                    `✅ ${client.commands.size} comandos sincronizados.`
                );

            } else {

                console.error(
                    `❌ Servidor autorizado ${ID_SERVIDOR_AUTORIZADO} não encontrado.`
                );
            }

        } catch (erro) {

            console.error(
                '❌ Erro ao sincronizar comandos:',
                erro
            );
        }


        // ================================================================
        // PROMOÇÃO
        // ================================================================

        try {

            const promotion = require(
                './commands/promocao/promotionHandler.js'
            );

            if (typeof promotion === 'function') {
                promotion(clientPronto);
            }

        } catch (erro) {

            console.error(
                '❌ Falha no PromotionHandler:',
                erro
            );
        }


        // ================================================================
        // SINCRONIZAÇÃO DOS PRINTS
        // ================================================================

        try {

            const syncEngine = require(
                './commands/promocao/syncEngine.js'
            );

            if (
                typeof syncEngine.executarVarreduraCanal ===
                'function'
            ) {

                await syncEngine.executarVarreduraCanal(
                    clientPronto
                );

                console.log(
                    '✅ Varredura e recuperação automática de prints concluída.'
                );
            }

        } catch (erro) {

            console.error(
                '❌ Falha na varredura automática:',
                erro
            );
        }


        // ================================================================
        // HANDLERS AUTOMÁTICOS
        // ================================================================

        const handlers = [

            [
                './commands/promocao/reactionAddHandler.js',
                'Reaction Handler'
            ],

            [
                './commands/adm/adminLogHandler.js',
                'Admin Log'
            ],

            [
                './commands/voz/voiceControlHandler.js',
                'Voice Control'
            ],

            [
                './commands/adm/temporaryVoiceHandler.js',
                'Temporary Voice'
            ],

            [
                './commands/adm/temporaryMuteHandler.js',
                'Temporary Mute'
            ],

            [
                './commands/adm/weeklyReportHandler.js',
                'Relatórios'
            ],

            [
                './commands/economy/economyTextHandler.js',
                'Economy'
            ],

            [
                './commands/adm/autoResponseHandler.js',
                'Auto Response'
            ],

            [
                './commands/adm/antiNukeHandler.js',
                'Anti-Nuke'
            ],

            [
                './commands/adm/onboardingSyncHandler.js',
                'Onboarding'
            ]
        ];


        for (const [arquivo, nome] of handlers) {

            try {

                const handler = require(arquivo);

                if (typeof handler === 'function') {
                    handler(clientPronto);
                }

            } catch (erro) {

                console.error(
                    `❌ Falha no ${nome}:`,
                    erro
                );
            }
        }
    }
);


// ========================================================================
// SERVIDORES NOVOS
// ========================================================================
// Se o bot for convidado para outro servidor, ele sai automaticamente.
// ========================================================================

client.on(
    Events.GuildCreate,
    async guild => {

        if (
            guild.id !==
            ID_SERVIDOR_AUTORIZADO
        ) {

            await guild.leave()
                .catch(() => {});
        }
    }
);


// ========================================================================
// INTERAÇÕES
// ========================================================================
// Aqui passam:
// - Slash Commands
// - Botões
// - Select Menus
// - User Selects
// - Modais
// ========================================================================

client.on(
    Events.InteractionCreate,
    async interaction => {

        // ================================================================
        // SERVIDOR NÃO AUTORIZADO
        // ================================================================

        if (
            interaction.guildId !==
            ID_SERVIDOR_AUTORIZADO
        ) {

            if (interaction.isRepliable()) {

                const resposta = {
                    content: '❌ Este bot é de uso exclusivo e restrito.',
                    flags: MessageFlags.Ephemeral
                };

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    return interaction.followUp(
                        resposta
                    ).catch(() => {});
                }

                return interaction.reply(
                    resposta
                ).catch(() => {});
            }

            return;
        }


        const customId =
            interaction.customId || '';


        // ================================================================
        // AUTOCOMPLETE
        // ================================================================

        if (interaction.isAutocomplete()) {

            const comando = client.commands.get(
                interaction.commandName
            );

            if (
                !comando ||
                typeof comando.autocomplete !== 'function'
            ) {

                return interaction.respond([])
                    .catch(() => {});
            }

            try {

                await comando.autocomplete(
                    interaction
                );

            } catch (erro) {

                console.error(
                    `[AUTOCOMPLETE] Erro em /${interaction.commandName}:`,
                    erro
                );

                await interaction.respond([])
                    .catch(() => {});
            }

            return;
        }


        // ================================================================
        // SLASH COMMAND
        // ================================================================

        if (interaction.isChatInputCommand()) {

            const comando = client.commands.get(
                interaction.commandName
            );

            if (!comando) {
                return;
            }

            try {

                await comando.execute(
                    interaction
                );

            } catch (erro) {

                console.error(
                    `[CMD] Erro em /${interaction.commandName}:`,
                    erro
                );

                const resposta = {
                    content: '❌ Erro ao executar o comando.',
                    flags: MessageFlags.Ephemeral
                };

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    await interaction.followUp(
                        resposta
                    ).catch(() => {});

                } else {

                    await interaction.reply(
                        resposta
                    ).catch(() => {});
                }
            }

            return;
        }


        // ================================================================
        // OLIMPÍADAS DE DUPLAS
        // ================================================================
        // Sistema totalmente separado da Liga.
        // Inclui botões, selects e o modal de nome da dupla.
        // ================================================================

        const eOlimpiadas =
            (
                interaction.isButton() ||
                interaction.isStringSelectMenu() ||
                interaction.isUserSelectMenu() ||
                interaction.isModalSubmit()
            ) &&
            customId.startsWith('olymp_');

        if (eOlimpiadas) {

            try {

                const olymp = require(
                    './commands/olimpiadas/olimpiadas-handler.js'
                );

                if (typeof olymp.handle === 'function') {

                    await olymp.handle(
                        interaction
                    );
                }

            } catch (erro) {

                console.error(
                    '[OLIMPIADAS] Erro:',
                    erro
                );

                if (
                    interaction.isRepliable() &&
                    !interaction.replied &&
                    !interaction.deferred
                ) {

                    await interaction.reply({
                        content: '❌ Erro ao processar esta ação das Olimpíadas.',
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }
            }

            return;
        }


        // ================================================================
        // MODAL DO HALL DA FAMA
        // ================================================================

        if (
            interaction.isModalSubmit() &&
            customId.startsWith('hall_modal_')
        ) {

            try {

                await require(
                    './commands/promocao/historicoHandler.js'
                )(
                    interaction,
                    client
                );

            } catch (erro) {

                console.error(
                    '[HALL] Erro no modal:',
                    erro
                );
            }

            return;
        }


        // ================================================================
        // SELECT MENUS GENÉRICOS
        // ================================================================

        const isSelect =
            interaction.isStringSelectMenu?.() ||
            interaction.isUserSelectMenu?.() ||
            interaction.isRoleSelectMenu?.() ||
            interaction.isChannelSelectMenu?.() ||
            interaction.isMentionableSelectMenu?.();

        if (
            !interaction.isButton() &&
            !isSelect
        ) {
            return;
        }


        try {

            // ============================================================
            // ESTATÍSTICAS DA LIGA
            // ============================================================

            if (
                customId === 'estatisticas_selecionar' ||
                customId === 'estatisticas_usuario' ||
                customId === 'estatisticas_voltar' ||
                customId === 'liga_estatisticas' ||
                customId.startsWith('liga_estatisticas_prev_') ||
                customId.startsWith('liga_estatisticas_next_') ||
                customId.startsWith('liga_estatisticas_pagina_') ||
                customId === 'liga_estatisticas_voltar'
            ) {

                return await require(
                    './commands/liga/estatisticasSelecionar.js'
                )(interaction);
            }


            // ============================================================
            // FICHA DO JOGADOR
            // ============================================================

            if (
                customId.startsWith('ver_ficha_')
            ) {

                const userId = customId.slice(
                    'ver_ficha_'.length
                );

                if (!/^\d{15,22}$/.test(userId)) {

                    return interaction.reply({
                        content: '❌ Usuário inválido.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const {
                    safeReadJson
                } = require(
                    './commands/liga/utils/helpers.js'
                );

                const {
                    criarFicha
                } = require(
                    './commands/promocao/fichaBuilder.js'
                );

                const progressao = safeReadJson(
                    path.join(
                        __dirname,
                        'commands',
                        'promocao',
                        'progressao.json'
                    )
                );

                const carreiras = safeReadJson(
                    path.join(
                        __dirname,
                        'commands',
                        'promocao',
                        'carreiras.json'
                    )
                );

                const economy = safeReadJson(
                    path.join(
                        __dirname,
                        'commands',
                        'economy',
                        'economy.json'
                    )
                );

                const member = await interaction.guild.members
                    .fetch(userId)
                    .catch(() => null);

                if (!member) {

                    return interaction.reply({
                        content: '❌ Não foi possível encontrar esse membro.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const ficha = criarFicha({
                    progressao,
                    carreiras,
                    economy,
                    userId,
                    member,
                    modo: 'carreira'
                });

                if (!ficha) {

                    return interaction.reply({
                        content: '❌ A ficha desse usuário não está disponível.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                return interaction.reply({
                    embeds: [ficha],
                    flags: MessageFlags.Ephemeral
                });
            }


            // ============================================================
            // HISTÓRICO / HALL
            // ============================================================

            if (
                customId.startsWith('hist_') ||
                customId.startsWith('hall_')
            ) {

                return await require(
                    './commands/promocao/historicoHandler.js'
                )(
                    interaction,
                    client
                );
            }


            // ============================================================
            // ANULAÇÃO / ESTORNO DE PARTIDA
            // ============================================================

            if (
                customId.startsWith('edit_match_')
            ) {

                return await handleReverter(
                    client,
                    interaction,
                    pontuacaoPath,
                    partidasPath
                );
            }


            // ============================================================
            // TICKETS
            // ============================================================

            if (
                customId.startsWith('ticket_')
            ) {

                return await require(
                    './commands/ticket/buttonRouter.js'
                )(
                    interaction,
                    client
                );
            }


            // ============================================================
            // STATUS PROMOÇÃO
            // ============================================================

            if (
                customId.startsWith('stt_')
            ) {

                return await require(
                    './commands/promocao/statusHandler.js'
                )(
                    interaction,
                    client
                );
            }


            // ============================================================
            // RANKING PROMOÇÃO
            // ============================================================

            if (
                customId.startsWith('rank_')
            ) {

                return await require(
                    './commands/promocao/rankingHandler.js'
                )(
                    interaction,
                    client
                );
            }


            // ============================================================
            // SISTEMA DE EMBEDS
            // ============================================================

            if (
                customId.startsWith('emb_') ||
                customId.startsWith('mdl_') ||
                customId.startsWith('eb_')
            ) {

                const embedSystem = require(
                    './commands/adm/embedSystem.js'
                );

                if (
                    typeof embedSystem.handleInteraction ===
                    'function'
                ) {

                    return await embedSystem.handleInteraction(
                        interaction
                    );
                }

                if (typeof embedSystem === 'function') {

                    return await embedSystem(
                        interaction,
                        client
                    );
                }

                return;
            }


            // ============================================================
            // VOZ TEMPORÁRIA
            // ============================================================

            if (
                customId.startsWith('tvoice_')
            ) {

                return await require(
                    './commands/adm/tempVoiceButtonHandler.js'
                )(
                    interaction,
                    client
                );
            }


            // ============================================================
            // VOTAÇÃO DE CALL
            // ============================================================

            if (
                customId.startsWith('vcall_select_')
            ) {

                if (!interaction.values?.length) {

                    return interaction.reply({
                        content: '❌ Nenhum usuário selecionado.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                interaction.customId =
                    `vcall_k_${interaction.values[0]}`;

                return await require(
                    './commands/voz/voiceControlHandler.js'
                )(
                    interaction,
                    client
                );
            }


            // ============================================================
            // LIGA
            // ============================================================

            if (
                customId.startsWith('liga_') ||
                [
                    'iniciar_contabilizacao',
                    'ver_ranking',
                    'ver_todos_competidores',
                    'registrar',
                    'add_abate',
                    'fim_abates',
                    'add_cont',
                    'fim_cont'
                ].includes(customId) ||
                customId.startsWith('sel_') ||
                customId.startsWith('reset_')
            ) {

                return await require(
                    './commands/liga/buttons.js'
                )(
                    client,
                    interaction
                );
            }

        } catch (erro) {

            console.error(
                '[INTERACTION] Erro:',
                erro
            );

            if (interaction.isRepliable()) {

                const resposta = {
                    content: '❌ Erro ao processar esta ação.',
                    flags: MessageFlags.Ephemeral
                };

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    await interaction.followUp(
                        resposta
                    ).catch(() => {});

                } else {

                    await interaction.reply(
                        resposta
                    ).catch(() => {});
                }
            }
        }
    }
);


// ========================================================================
// ERROS DO PROCESSO
// ========================================================================

process.on(
    'unhandledRejection',
    erro =>
        console.error(
            '[PROCESS] Unhandled Rejection:',
            erro
        )
);


process.on(
    'uncaughtException',
    erro =>
        console.error(
            '[PROCESS] Uncaught Exception:',
            erro
        )
);


// ========================================================================
// VALIDAR TOKEN E LOGIN
// ========================================================================

if (!TOKEN) {

    console.error(
        '❌ TOKEN NÃO ENCONTRADO. Configure token no config.json ou DISCORD_TOKEN/BOT_TOKEN/TOKEN no ambiente.'
    );

    process.exit(1);
}


client.login(
    TOKEN
);
