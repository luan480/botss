/* ========================================================================
   ARQUIVO: index.js

   WORLDWARBR — MASTER

   FUNÇÕES:
   - Inicialização do bot
   - Carregamento de comandos
   - Proteção por ID de servidor
   - Sincronização dos Slash Commands
   - Liga
   - Promoção
   - Hall da Fama
   - Ranking
   - Tickets
   - Voz
   - Economia
   - Anti-Nuke
   - Onboarding
   - Relatórios

   IMPORTANTE:
   - O bot NÃO é restrito somente a administradores.
   - Qualquer membro do servidor autorizado pode interagir.
   - A permissão de cada comando é definida no próprio arquivo do comando.
   - NÃO executa testes da Liga no startup.
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
// CONFIG
// ========================================================================

const config = require('./config.json');


// ========================================================================
// SERVIDOR AUTORIZADO
// ========================================================================

const ID_SERVIDOR_AUTORIZADO =
    '849696655510863914';


// ========================================================================
// LIGA
// ========================================================================

const handleReverter =
    require(
        './commands/liga/handlers/handleReverter.js'
    );

const pontuacaoPath =
    path.join(
        __dirname,
        'commands',
        'liga',
        'pontuacao.json'
    );

const partidasPath =
    path.join(
        __dirname,
        'commands',
        'liga',
        'partidas.json'
    );


// ========================================================================
// CLIENT
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
// COLLECTION
// ========================================================================

client.commands =
    new Collection();


// ========================================================================
// CAMINHO DOS COMANDOS
// ========================================================================

const commandsPath =
    path.join(
        __dirname,
        'commands'
    );


// ========================================================================
// ARQUIVOS QUE NÃO DEVEM SER TRATADOS COMO COMANDO
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
// CARREGAR COMANDOS
// ========================================================================

function readCommands(dir) {

    if (
        !fs.existsSync(dir)
    ) {

        console.error(
            `[CMD] Diretório não encontrado: ${dir}`
        );

        return;

    }


    let files;

    try {

        files =
            fs.readdirSync(dir);

    } catch (erro) {

        console.error(
            `[CMD] Erro ao ler diretório ${dir}:`,
            erro
        );

        return;

    }


    for (
        const file
        of files
    ) {

        const filePath =
            path.join(
                dir,
                file
            );


        let stat;

        try {

            stat =
                fs.statSync(
                    filePath
                );

        } catch {

            continue;

        }


        // ================================================================
        // SUBPASTA
        // ================================================================

        if (
            stat.isDirectory()
        ) {

            readCommands(
                filePath
            );

            continue;

        }


        // ================================================================
        // SOMENTE JS
        // ================================================================

        if (
            !file.endsWith('.js')
        ) {

            continue;

        }


        // ================================================================
        // IGNORAR
        // ================================================================

        if (
            ARQUIVOS_IGNORADOS.has(file)
        ) {

            continue;

        }


        // ================================================================
        // CARREGAR
        // ================================================================

        try {

            delete require.cache[
                require.resolve(
                    filePath
                )
            ];


            const command =
                require(
                    filePath
                );


            if (
                !command ||
                !command.data ||
                typeof command.data.toJSON !== 'function' ||
                typeof command.execute !== 'function'
            ) {

                continue;

            }


            const nome =
                command.data.name;


            if (
                !nome
            ) {

                console.warn(
                    `[CMD] Comando sem nome ignorado: ${filePath}`
                );

                continue;

            }


            if (
                client.commands.has(nome)
            ) {

                console.warn(
                    `[CMD] Comando duplicado ignorado: ${nome}`
                );

                continue;

            }


            client.commands.set(
                nome,
                command
            );


            console.log(
                `[CMD] Carregado: ${nome}`
            );

        } catch (erro) {

            console.error(
                `[CMD] Erro ao carregar ${filePath}:`,
                erro
            );

        }

    }

}


// ========================================================================
// CARREGAR TODOS OS COMANDOS
// ========================================================================

readCommands(
    commandsPath
);


// ========================================================================
// READY
// ========================================================================

client.once(
    Events.ClientReady,
    async c => {

        console.log('');
        console.log(
            '=============================================='
        );

        console.log(
            `🤖 ${c.user.tag} está online!`
        );

        try {

            c.user.setPresence({

                activities: [

                    {

                        name:
                            'WAR',

                        type:
                            ActivityType.Playing,

                        state:
                            'WorldWarBR',

                        url:
                            'https://discord.gg/F9DwHfZWfH'

                    }

                ],

                status:
                    'online'

            });

        } catch (erro) {

            console.error(
                '❌ Falha ao definir status:',
                erro
            );

        }

        try {

            const guilds =
                await c.guilds.fetch();

            console.log(
                `🌐 Total de servidores na API: ${guilds.size}`
            );

            for (
                const [, guildData]
                of guilds
            ) {

                if (
                    guildData.id !==
                    ID_SERVIDOR_AUTORIZADO
                ) {

                    console.log(
                        `🚨 Servidor não autorizado detectado: ${guildData.name} (${guildData.id})`
                    );

                    const guild =
                        c.guilds.cache.get(
                            guildData.id
                        );

                    if (
                        guild
                    ) {

                        await guild
                            .leave()
                            .catch(
                                () => {}
                            );

                    }

                }

            }

        } catch (erro) {

            console.error(
                '❌ Erro ao validar servidores:',
                erro
            );

        }

        try {

            const guild =
                c.guilds.cache.get(
                    ID_SERVIDOR_AUTORIZADO
                );

            if (
                !guild
            ) {

                console.error(
                    '❌ Guilda autorizada não encontrada.'
                );

            } else {

                const comandosArray =
                    client.commands.map(
                        command =>
                            command.data.toJSON()
                    );

                await c.application.commands.set([]);

                await guild.commands.set(
                    comandosArray
                );

                console.log(
                    `✅ ${comandosArray.length} comandos de barra sincronizados exclusivamente na guilda: ${guild.name}`
                );

            }

        } catch (erro) {

            console.error(
                '❌ Erro ao sincronizar comandos:',
                erro
            );

        }

        try {

            const handler =
                require(
                    './commands/promocao/promotionHandler.js'
                );

            if (
                typeof handler === 'function'
            ) {

                handler(
                    client
                );

                console.log(
                    '✅ Sistema de Atribuição de Cargos por ID (PromotionHandler) ativado.'
                );

            }

        } catch (erro) {

            console.error(
                '❌ Falha ao ligar PromotionHandler:',
                erro
            );

        }

        try {

            const syncEngine =
                require(
                    './commands/promocao/syncEngine.js'
                );

            if (
                typeof syncEngine.executarVarreduraCanal === 'function'
            ) {

                await syncEngine.executarVarreduraCanal(
                    client
                );

                console.log(
                    '🤖 Sistema de Auto-Aprovação de Prints blindado contra civis ativado.'
                );

            }

        } catch (erro) {

            console.error(
                '❌ Falha no Auto-Aprovação:',
                erro
            );

        }

        try {

            const handler =
                require(
                    './commands/promocao/reactionAddHandler.js'
                );

            if (
                typeof handler === 'function'
            ) {

                handler(
                    client
                );

            }

        } catch (erro) {

            console.error(
                '❌ Falha no Reaction Handler:',
                erro
            );

        }

        try {

            const handler =
                require(
                    './commands/adm/adminLogHandler.js'
                );

            if (
                typeof handler === 'function'
            ) {

                handler(
                    client
                );

            }

        } catch (erro) {

            console.error(
                '❌ Falha no Admin Log:',
                erro
            );

        }

        try {

            const handler =
                require(
                    './commands/voz/voiceControlHandler.js'
                );

            if (
                typeof handler === 'function'
            ) {

                handler(
                    client
                );

            }

        } catch (erro) {

            console.error(
                '❌ Falha no Voice Control:',
                erro
            );

        }

        try {

            const handler =
                require(
                    './commands/adm/temporaryVoiceHandler.js'
                );

            if (
                typeof handler === 'function'
            ) {

                handler(
                    client
                );

            }

        } catch (erro) {

            console.error(
                '❌ Falha no Temporary Voice:',
                erro
            );

        }

        try {

            const handler =
                require(
                    './commands/adm/weeklyReportHandler.js'
                );

            if (
                typeof handler === 'function'
            ) {

                handler(
                    client
                );

                console.log(
                    '✅ Sistema de Relatórios Inteligentes ativado.'
                );

            }

        } catch (erro) {

            console.error(
                '❌ Falha no sistema de relatórios:',
                erro
            );

        }

        try {

            const handler =
                require(
                    './commands/economy/economyTextHandler.js'
                );

            if (
                typeof handler === 'function'
            ) {

                handler(
                    client
                );

            }

        } catch (erro) {

            console.error(
                '❌ Falha no Economy Handler:',
                erro
            );

        }

        try {

            const handler =
                require(
                    './commands/adm/autoResponseHandler.js'
                );

            if (
                typeof handler === 'function'
            ) {

                handler(
                    client
                );

            }

        } catch (erro) {

            console.error(
                '❌ Falha no Auto Response:',
                erro
            );

        }

        try {

            const handler =
                require(
                    './commands/adm/antiNukeHandler.js'
                );

            if (
                typeof handler === 'function'
            ) {

                handler(
                    client
                );

                console.log(
                    '🛡️ Sistema Anti-Nuke Profissional Blindado e Ativo.'
                );

            }

        } catch (erro) {

            console.error(
                '❌ Falha no Anti-Nuke:',
                erro
            );

        }

        try {

            const handler =
                require(
                    './commands/adm/onboardingSyncHandler.js'
                );

            if (
                typeof handler === 'function'
            ) {

                handler(
                    client
                );

                console.log(
                    '👁️ Radar de Onboarding ativado!'
                );

            }

        } catch (erro) {

            console.error(
                '❌ Falha no Radar de Onboarding:',
                erro
            );

        }

        console.log('');
        console.log(
            '=============================================='
        );
        console.log(
            '✅ WORLDWARBR INICIALIZADO'
        );
        console.log(
            '✅ Nenhum teste da Liga executado no startup.'
        );
        console.log(
            '=============================================='
        );

    }
);


// ========================================================================
// BLOQUEAR SERVIDORES NÃO AUTORIZADOS
// ========================================================================

client.on(
    Events.GuildCreate,
    async guild => {

        if (
            guild.id ===
            ID_SERVIDOR_AUTORIZADO
        ) {

            console.log(
                `✅ Bot entrou na guilda autorizada: ${guild.name}`
            );

            return;

        }

        console.log(
            `🚨 Tentativa de invasão bloqueada! ${guild.name} (${guild.id})`
        );

        await guild
            .leave()
            .catch(
                () => {}
            );

    }
);


// ========================================================================
// INTERAÇÕES
// ========================================================================

client.on(
    Events.InteractionCreate,
    async interaction => {

        if (
            interaction.guildId !==
            ID_SERVIDOR_AUTORIZADO
        ) {

            if (
                interaction.isRepliable()
            ) {

                const resposta = {
                    content:
                        '❌ Este bot é de uso exclusivo e restrito.',
                    flags:
                        MessageFlags.Ephemeral
                };

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    return interaction
                        .followUp(
                            resposta
                        )
                        .catch(
                            () => {}
                        );

                }

                return interaction
                    .reply(
                        resposta
                    )
                    .catch(
                        () => {}
                    );

            }

            return;

        }

        const customId =
            interaction.customId || '';

        if (
            interaction.isChatInputCommand()
        ) {

            const command =
                client.commands.get(
                    interaction.commandName
                );

            if (
                !command
            ) {

                console.warn(
                    `[CMD] Comando não encontrado: ${interaction.commandName}`
                );

                return;

            }

            try {

                await command.execute(
                    interaction
                );

            } catch (erro) {

                console.error(
                    `[CMD] Erro em /${interaction.commandName}:`,
                    erro
                );

                const resposta = {
                    content:
                        '❌ Erro ao executar o comando.',
                    flags:
                        MessageFlags.Ephemeral
                };

                try {

                    if (
                        interaction.replied ||
                        interaction.deferred
                    ) {

                        await interaction
                            .followUp(
                                resposta
                            )
                            .catch(
                                () => {}
                            );

                    } else {

                        await interaction
                            .reply(
                                resposta
                            )
                            .catch(
                                () => {}
                            );

                    }

                } catch {}

            }

            return;

        }

        if (
            interaction.isModalSubmit()
        ) {

            if (
                customId.startsWith(
                    'hall_modal_'
                )
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

                    if (
                        !interaction.replied &&
                        !interaction.deferred
                    ) {

                        await interaction
                            .reply({
                                content:
                                    '❌ Erro ao editar o evento.',
                                flags:
                                    MessageFlags.Ephemeral
                            })
                            .catch(
                                () => {}
                            );

                    }

                }

                return;

            }

        }

        if (
            interaction.isButton() ||
            interaction.isStringSelectMenu() ||
            interaction.isUserSelectMenu() ||
            interaction.isRoleSelectMenu() ||
            interaction.isChannelSelectMenu() ||
            interaction.isMentionableSelectMenu()
        ) {

            if (
                customId.startsWith('hist_') ||
                customId.startsWith('hall_')
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
                        '[HALL] Erro no handler:',
                        erro
                    );

                    if (
                        !interaction.replied &&
                        !interaction.deferred
                    ) {

                        await interaction
                            .reply({
                                content:
                                    '❌ Erro ao processar o Hall da Fama.',
                                flags:
                                    MessageFlags.Ephemeral
                            })
                            .catch(
                                () => {}
                            );

                    }

                }

                return;

            }

            if (
                customId.startsWith(
                    'edit_match_'
                )
            ) {

                try {

                    await handleReverter(
                        client,
                        interaction,
                        pontuacaoPath,
                        partidasPath
                    );

                } catch (erro) {

                    console.error(
                        '[LIGA] Erro ao reverter:',
                        erro
                    );

                    if (
                        !interaction.replied &&
                        !interaction.deferred
                    ) {

                        await interaction
                            .reply({
                                content:
                                    '❌ Erro ao anular a partida.',
                                flags:
                                    MessageFlags.Ephemeral
                            })
                            .catch(
                                () => {}
                            );

                    }

                }

                return;

            }

            if (
                customId.startsWith(
                    'ticket_'
                )
            ) {

                try {

                    const handler =
                        require(
                            './commands/ticket/buttonRouter.js'
                        );

                    await handler(
                        interaction,
                        client
                    );

                } catch (erro) {

                    console.error(
                        '[TICKET] Erro:',
                        erro
                    );

                }

                return;

            }

            if (
                customId.startsWith(
                    'stt_'
                )
            ) {

                try {

                    const handler =
                        require(
                            './commands/promocao/statusHandler.js'
                        );

                    await handler(
                        interaction,
                        client
                    );

                } catch (erro) {

                    console.error(
                        '[PROMOÇÃO] Erro:',
                        erro
                    );

                }

                return;

            }

            if (
                customId.startsWith(
                    'rank_'
                )
            ) {

                try {

                    const handler =
                        require(
                            './commands/promocao/rankingHandler.js'
                        );

                    await handler(
                        interaction,
                        client
                    );

                } catch (erro) {

                    console.error(
                        '[RANKING] Erro:',
                        erro
                    );

                }

                return;

            }

            if (
                customId.startsWith('emb_') ||
                customId.startsWith('mdl_') ||
                customId.startsWith('eb_')
            ) {

                try {

                    const embedSystem =
                        require(
                            './commands/adm/embedSystem.js'
                        );

                    if (
                        typeof embedSystem.handleInteraction ===
                        'function'
                    ) {

                        await embedSystem
                            .handleInteraction(
                                interaction
                            );

                    }

                } catch (erro) {

                    console.error(
                        '[EMBED] Erro:',
                        erro
                    );

                }

                return;

            }

            if (
                customId.startsWith(
                    'tvoice_'
                )
            ) {

                try {

                    const handler =
                        require(
                            './commands/adm/tempVoiceButtonHandler.js'
                        );

                    await handler(
                        interaction,
                        client
                    );

                } catch (erro) {

                    console.error(
                        '[TEMP VOICE] Erro:',
                        erro
                    );

                }

                return;

            }

            if (
                customId.startsWith(
                    'vcall_select_'
                )
            ) {

                try {

                    if (
                        !interaction.values ||
                        !interaction.values.length
                    ) {

                        return interaction.reply({
                            content:
                                '❌ Nenhum usuário selecionado.',
                            flags:
                                MessageFlags.Ephemeral
                        });

                    }

                    const targetUserId =
                        interaction.values[0];

                    interaction.customId =
                        `vcall_k_${targetUserId}`;

                    const handler =
                        require(
                            './commands/voz/voiceControlHandler.js'
                        );

                    if (
                        typeof handler === 'function'
                    ) {

                        await handler(
                            interaction,
                            client
                        );

                    }

                } catch (erro) {

                    console.error(
                        '[VCALL] Erro:',
                        erro
                    );

                }

                return;

            }

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

                try {

                    const handler =
                        require(
                            './commands/liga/buttons.js'
                        );

                    await handler(
                        client,
                        interaction,
                        pontuacaoPath,
                        partidasPath
                    );

                } catch (erro) {

                    console.error(
                        '[LIGA] Erro:',
                        erro
                    );

                    const resposta = {
                        content:
                            '❌ Erro ao processar esta ação da Liga.',
                        flags:
                            MessageFlags.Ephemeral
                    };

                    try {

                        if (
                            interaction.replied ||
                            interaction.deferred
                        ) {

                            await interaction
                                .followUp(
                                    resposta
                                )
                                .catch(
                                    () => {}
                                );

                        } else {

                            await interaction
                                .reply(
                                    resposta
                                )
                                .catch(
                                    () => {}
                                );

                        }

                    } catch {}

                }

                return;

            }

        }

    }
);


// ========================================================================
// ERROS DO PROCESSO
// ========================================================================

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


// ========================================================================
// LOGIN
// ========================================================================

if (
    !config.token
) {

    console.error(
        '❌ TOKEN NÃO ENCONTRADO NO config.json'
    );

    process.exit(
        1
    );

}

client.login(
    config.token
);
