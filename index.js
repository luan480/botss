```js
/* ========================================================================
   WORLDWARBR — MASTER
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

/* ========================================================================
   CONFIGURAÇÃO
   ======================================================================== */

let config = {};

try {
    config = require('./config.json');
} catch (erro) {
    console.error('❌ config.json não encontrado ou inválido.');
    process.exit(1);
}

const TOKEN =
    config.token ||
    config.DISCORD_TOKEN ||
    config.botToken ||
    process.env.DISCORD_TOKEN ||
    process.env.BOT_TOKEN ||
    process.env.TOKEN;

const ID_SERVIDOR_AUTORIZADO = String(
    config.guildId ||
    config.idServidor ||
    config.servidorId ||
    '849696655510863914'
);

/* ========================================================================
   CAMINHOS
   ======================================================================== */

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

/* ========================================================================
   CLIENT
   ======================================================================== */

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

client.commands = new Collection();

/* ========================================================================
   COMANDOS
   ======================================================================== */

const commandsPath = path.join(__dirname, 'commands');

const ARQUIVOS_IGNORADOS = new Set([
    'testePeriodosLiga.js',
    'testeEstatisticasLiga.js',
    'testeEstatisticasV2.js',
    'index.js',
    'buttons.js',
    'interactionPatch.js'
]);

function readCommands(dir) {
    if (!fs.existsSync(dir)) {
        return;
    }

    for (const file of fs.readdirSync(dir)) {
        const filePath = path.join(dir, file);

        let stat;

        try {
            stat = fs.statSync(filePath);
        } catch {
            continue;
        }

        /* -------------------- PASTA -------------------- */

        if (stat.isDirectory()) {
            readCommands(filePath);
            continue;
        }

        /* -------------------- ARQUIVO -------------------- */

        if (!file.endsWith('.js')) {
            continue;
        }

        if (ARQUIVOS_IGNORADOS.has(file)) {
            continue;
        }

        try {
            delete require.cache[require.resolve(filePath)];

            const command = require(filePath);

            if (
                !command?.data ||
                typeof command.data.toJSON !== 'function' ||
                typeof command.execute !== 'function'
            ) {
                continue;
            }

            const nome = command.data.name;

            if (!nome) {
                continue;
            }

            if (client.commands.has(nome)) {
                console.warn(
                    `[CMD] Ignorado comando duplicado: ${nome}`
                );
                continue;
            }

            client.commands.set(nome, command);

            console.log(`[CMD] Carregado: ${nome}`);
        } catch (erro) {
            console.error(
                `[CMD] Erro ao carregar ${filePath}:`,
                erro
            );
        }
    }
}

readCommands(commandsPath);

/* ========================================================================
   READY
   ======================================================================== */

client.once(Events.ClientReady, async clientReady => {
    console.log(
        `🤖 ${clientReady.user.tag} está online!`
    );

    /* -------------------- PRESENÇA -------------------- */

    try {
        clientReady.user.setPresence({
            activities: [
                {
                    name: config.presence || 'WAR',
                    type: ActivityType.Playing
                }
            ],
            status: 'online'
        });
    } catch {}

    /* -------------------- SERVIDORES -------------------- */

    try {
        const guilds = await clientReady.guilds.fetch();

        for (const [, guildData] of guilds) {
            if (guildData.id === ID_SERVIDOR_AUTORIZADO) {
                continue;
            }

            const guild = clientReady.guilds.cache.get(
                guildData.id
            );

            if (guild) {
                await guild.leave().catch(() => {});
            }
        }
    } catch (erro) {
        console.error(
            '❌ Erro ao validar servidores:',
            erro
        );
    }

    /* -------------------- SINCRONIZAÇÃO -------------------- */

    try {
        const guild = clientReady.guilds.cache.get(
            ID_SERVIDOR_AUTORIZADO
        );

        if (!guild) {
            console.error(
                `❌ Servidor autorizado ${ID_SERVIDOR_AUTORIZADO} não encontrado.`
            );
        } else {
            await clientReady.application.commands.set([]);

            await guild.commands.set(
                client.commands.map(command =>
                    command.data.toJSON()
                )
            );

            console.log(
                `✅ ${client.commands.size} comandos sincronizados.`
            );
        }
    } catch (erro) {
        console.error(
            '❌ Erro ao sincronizar comandos:',
            erro
        );
    }

    /* -------------------- PROMOTION -------------------- */

    try {
        const promotion = require(
            './commands/promocao/promotionHandler.js'
        );

        if (typeof promotion === 'function') {
            promotion(clientReady);
        }
    } catch (erro) {
        console.error(
            '❌ Falha no PromotionHandler:',
            erro
        );
    }

    /* -------------------- VARREDURA PROMOÇÃO -------------------- */

    try {
        const sync = require(
            './commands/promocao/syncEngine.js'
        );

        if (
            typeof sync.executarVarreduraCanal === 'function'
        ) {
            await sync.executarVarreduraCanal(clientReady);
        }
    } catch (erro) {
        console.error(
            '❌ Falha na varredura automática:',
            erro
        );
    }

    /* -------------------- HANDLERS -------------------- */

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
                handler(clientReady);
            }
        } catch (erro) {
            console.error(
                `❌ Falha no ${nome}:`,
                erro
            );
        }
    }
});

/* ========================================================================
   PROTEÇÃO CONTRA OUTROS SERVIDORES
   ======================================================================== */

client.on(Events.GuildCreate, async guild => {
    if (guild.id !== ID_SERVIDOR_AUTORIZADO) {
        await guild.leave().catch(() => {});
    }
});

/* ========================================================================
   INTERAÇÕES
   ======================================================================== */

client.on(Events.InteractionCreate, async interaction => {

    /* ====================================================================
       SEGURANÇA — SERVIDOR AUTORIZADO
       ==================================================================== */

    if (
        interaction.guildId !==
        ID_SERVIDOR_AUTORIZADO
    ) {
        if (interaction.isRepliable()) {
            const resposta = {
                content:
                    '❌ Este bot é de uso exclusivo e restrito.',
                flags: MessageFlags.Ephemeral
            };

            if (
                interaction.replied ||
                interaction.deferred
            ) {
                return interaction
                    .followUp(resposta)
                    .catch(() => {});
            }

            return interaction
                .reply(resposta)
                .catch(() => {});
        }

        return;
    }

    const id = interaction.customId || '';

    /* ====================================================================
       AUTOCOMPLETE
       ==================================================================== */

    if (interaction.isAutocomplete()) {
        const command = client.commands.get(
            interaction.commandName
        );

        if (
            !command ||
            typeof command.autocomplete !== 'function'
        ) {
            return interaction.respond([]).catch(() => {});
        }

        try {
            await command.autocomplete(interaction);
        } catch (erro) {
            console.error(
                `[AUTOCOMPLETE] Erro em /${interaction.commandName}:`,
                erro
            );

            await interaction
                .respond([])
                .catch(() => {});
        }

        return;
    }

    /* ====================================================================
       SLASH COMMANDS
       ==================================================================== */

    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(
            interaction.commandName
        );

        if (!command) {
            return;
        }

        try {
            await command.execute(interaction);
        } catch (erro) {
            console.error(
                `[CMD] Erro em /${interaction.commandName}:`,
                erro
            );

            const resposta = {
                content:
                    '❌ Erro ao executar o comando.',
                flags: MessageFlags.Ephemeral
            };

            if (
                interaction.replied ||
                interaction.deferred
            ) {
                await interaction
                    .followUp(resposta)
                    .catch(() => {});
            } else {
                await interaction
                    .reply(resposta)
                    .catch(() => {});
            }
        }

        return;
    }

    /* ====================================================================
       OLIMPÍADAS — MODAIS
       
       IMPORTANTE:
       Este bloco precisa vir ANTES dos botões/selects.
       
       Corrige:
       "Algo deu errado" ao pesquisar país.
       ==================================================================== */

    if (
        interaction.isModalSubmit() &&
        id.startsWith('olymp_')
    ) {
        try {
            const olimp = require(
                './commands/olimpiadas/olimpiadas-handler.js'
            );

            if (typeof olimp.handle === 'function') {
                await olimp.handle(interaction);
            }
        } catch (erro) {
            console.error(
                '[OLIMPIADAS] Erro no modal:',
                erro
            );

            if (
                interaction.isRepliable() &&
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction
                    .reply({
                        content:
                            '❌ Erro ao processar a pesquisa do país.',
                        flags: MessageFlags.Ephemeral
                    })
                    .catch(() => {});
            }
        }

        return;
    }

    /* ====================================================================
       OLIMPÍADAS — BOTÕES E SELECT MENUS
       ==================================================================== */

    if (
        (
            interaction.isButton() ||
            interaction.isStringSelectMenu() ||
            interaction.isUserSelectMenu()
        ) &&
        id.startsWith('olymp_')
    ) {
        try {
            const olimp = require(
                './commands/olimpiadas/olimpiadas-handler.js'
            );

            if (typeof olimp.handle === 'function') {
                await olimp.handle(interaction);
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
                await interaction
                    .reply({
                        content:
                            '❌ Erro ao processar esta ação das Olimpíadas.',
                        flags: MessageFlags.Ephemeral
                    })
                    .catch(() => {});
            }
        }

        return;
    }

    /* ====================================================================
       MODAL DO HALL
       ==================================================================== */

    if (
        interaction.isModalSubmit() &&
        id.startsWith('hall_modal_')
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

    /* ====================================================================
       SELECT MENUS
       ==================================================================== */

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

    /* ====================================================================
       LIGA — ESTATÍSTICAS
       ==================================================================== */

    try {

        if (
            id === 'estatisticas_selecionar' ||
            id === 'estatisticas_usuario' ||
            id === 'estatisticas_voltar' ||
            id === 'liga_estatisticas' ||
            id.startsWith('liga_estatisticas_prev_') ||
            id.startsWith('liga_estatisticas_next_') ||
            id.startsWith('liga_estatisticas_pagina_')
        ) {
            return await require(
                './commands/liga/estatisticasSelecionar.js'
            )(interaction);
        }

        /* ================================================================
           FICHA
           ================================================================ */

        if (id.startsWith('ver_ficha_')) {
            const userId = id.slice(
                'ver_ficha_'.length
            );

            if (!/^\d{15,22}$/.test(userId)) {
                return interaction.reply({
                    content:
                        '❌ Usuário inválido.',
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

            const progressao =
                safeReadJson(
                    path.join(
                        __dirname,
                        'commands',
                        'promocao',
                        'progressao.json'
                    )
                );

            const carreiras =
                safeReadJson(
                    path.join(
                        __dirname,
                        'commands',
                        'promocao',
                        'carreiras.json'
                    )
                );

            const economy =
                safeReadJson(
                    path.join(
                        __dirname,
                        'commands',
                        'economy',
                        'economy.json'
                    )
                );

            const member =
                await interaction.guild.members
                    .fetch(userId)
                    .catch(() => null);

            if (!member) {
                return interaction.reply({
                    content:
                        '❌ Não foi possível encontrar esse membro.',
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
                    content:
                        '❌ A ficha desse usuário não está disponível.',
                    flags: MessageFlags.Ephemeral
                });
            }

            return interaction.reply({
                embeds: [ficha],
                flags: MessageFlags.Ephemeral
            });
        }

        /* ================================================================
           HISTÓRICO / HALL
           ================================================================ */

        if (
            id.startsWith('hist_') ||
            id.startsWith('hall_')
        ) {
            return await require(
                './commands/promocao/historicoHandler.js'
            )(
                interaction,
                client
            );
        }

        /* ================================================================
           REVERTER PARTIDA
           ================================================================ */

        if (id.startsWith('edit_match_')) {
            return await require(
                './commands/liga/handlers/handleReverter.js'
            )(
                client,
                interaction,
                pontuacaoPath,
                partidasPath
            );
        }

        /* ================================================================
           TICKETS
           ================================================================ */

        if (id.startsWith('ticket_')) {
            return await require(
                './commands/ticket/buttonRouter.js'
            )(
                interaction,
                client
            );
        }

        /* ================================================================
           STATUS
           ================================================================ */

        if (id.startsWith('stt_')) {
            return await require(
                './commands/promocao/statusHandler.js'
            )(
                interaction,
                client
            );
        }

        /* ================================================================
           RANKING
           ================================================================ */

        if (id.startsWith('rank_')) {
            return await require(
                './commands/promocao/rankingHandler.js'
            )(
                interaction,
                client
            );
        }

        /* ================================================================
           EMBEDS
           ================================================================ */

        if (
            id.startsWith('emb_') ||
            id.startsWith('mdl_') ||
            id.startsWith('eb_')
        ) {
            const embedSystem =
                require(
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

            if (
                typeof embedSystem === 'function'
            ) {
                return await embedSystem(
                    interaction,
                    client
                );
            }

            return;
        }

        /* ================================================================
           TEMP VOICE
           ================================================================ */

        if (id.startsWith('tvoice_')) {
            return await require(
                './commands/adm/tempVoiceButtonHandler.js'
            )(
                interaction,
                client
            );
        }

        /* ================================================================
           VOICE CALL
           ================================================================ */

        if (id.startsWith('vcall_select_')) {
            if (!interaction.values?.length) {
                return interaction.reply({
                    content:
                        '❌ Nenhum usuário selecionado.',
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

        /* ================================================================
           LIGA
           ================================================================ */

        if (
            id.startsWith('liga_') ||
            [
                'iniciar_contabilizacao',
                'ver_ranking',
                'ver_todos_competidores',
                'registrar',
                'add_abate',
                'fim_abates',
                'add_cont',
                'fim_cont'
            ].includes(id) ||
            id.startsWith('sel_') ||
            id.startsWith('reset_')
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
                content:
                    '❌ Erro ao processar esta ação.',
                flags: MessageFlags.Ephemeral
            };

            if (
                interaction.replied ||
                interaction.deferred
            ) {
                await interaction
                    .followUp(resposta)
                    .catch(() => {});
            } else {
                await interaction
                    .reply(resposta)
                    .catch(() => {});
            }
        }
    }
});

/* ========================================================================
   ERROS GLOBAIS
   ======================================================================== */

process.on(
    'unhandledRejection',
    erro => {
        console.error(
            '[PROCESS] Unhandled Rejection:',
            erro
        );
    }
);

process.on(
    'uncaughtException',
    erro => {
        console.error(
            '[PROCESS] Uncaught Exception:',
            erro
        );
    }
);

/* ========================================================================
   LOGIN
   ======================================================================== */

if (!TOKEN) {
    console.error(
        '❌ TOKEN NÃO ENCONTRADO.'
    );

    process.exit(1);
}

client.login(
    config.token || TOKEN
);
```
