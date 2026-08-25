/* ========================================================================
   ARQUIVO: commands/liga/buttons.js

   TELAS:
   🏆 Ranking
   📊 Estatísticas
   📖 Guia da Liga

   GUIA:
   📜 Regras
   🤖 Como registrar
   ❓ Perguntas
   🧮 Pontuação

   RECURSOS:
   - Paginação do ranking
   - Paginação das estatísticas
   - Busca do nome real dos jogadores
   - Contabilização
   - Anulação de partida
   - Estorno de pontos
   - Estorno de WarCoins
   - Estorno de vitórias
   - Recalculo de patente
   - Pontuação carregada de configPontos.js
   - Regras completas divididas em vários Embeds
   - Voltar ao painel
   ======================================================================== */

const path = require('path');

const {
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const {
    safeReadJson,
    safeWriteJson
} = require('./utils/helpers.js');

const painelMod =
    require('./painel.js');

const handleIniciar =
    require('./handlers/handleIniciar.js');

const periodosLiga =
    require('./utils/periodosLiga.js');

const configPontos =
    require('./utils/configPontos.js');


// ========================================================================
// CAMINHOS
// ========================================================================

const economyPath =
    path.join(
        __dirname,
        '..',
        '..',
        'economy',
        'economy.json'
    );

const progressaoPath =
    path.join(
        __dirname,
        '..',
        '..',
        'promocao',
        'progressao.json'
    );

const carreirasPath =
    path.join(
        __dirname,
        '..',
        '..',
        'promocao',
        'carreiras.json'
    );

const pontuacaoPathDefault =
    path.join(
        __dirname,
        'pontuacao.json'
    );


// ========================================================================
// CONFIGURAÇÃO
// ========================================================================

const ITENS_POR_PAGINA =
    8;


// ========================================================================
// GARANTIR INTERAÇÃO
// ========================================================================

async function garantirInteracaoRespondida(
    interaction
) {

    if (
        interaction.replied ||
        interaction.deferred
    ) {

        return true;

    }

    try {

        await interaction.deferUpdate();

        return true;

    } catch (erro) {

        console.error(
            '[LIGA] Erro ao reconhecer interação:',
            erro
        );

        return false;

    }

}


// ========================================================================
// NOME REAL DO JOGADOR
// ========================================================================

async function obterNomeJogador(
    guild,
    id
) {

    const jogadorId =
        String(
            id
        );


    try {

        const membro =
            await guild.members
                .fetch(
                    jogadorId
                );


        if (
            membro
        ) {

            if (
                membro.displayName
            ) {

                return membro.displayName;

            }


            if (
                membro.user?.globalName
            ) {

                return membro.user.globalName;

            }


            if (
                membro.user?.username
            ) {

                return membro.user.username;

            }

        }

    } catch {

        // Usuário pode não estar mais no servidor.

    }


    return `Usuário ${jogadorId}`;

}


// ========================================================================
// ADICIONAR NOMES
// ========================================================================

async function adicionarNomes(
    guild,
    jogadores
) {

    const resultado =
        [];


    for (
        const jogador
        of jogadores
    ) {

        resultado.push({

            ...jogador,

            nome:
                await obterNomeJogador(
                    guild,
                    jogador.id
                )

        });

    }


    return resultado;

}


// ========================================================================
// PAGINAÇÃO
// ========================================================================

function calcularPagina(
    total,
    pagina
) {

    const totalPaginas =
        Math.max(

            1,

            Math.ceil(
                total /
                ITENS_POR_PAGINA
            )

        );


    const paginaNumerica =
        Number(
            pagina
        ) || 1;


    const paginaSegura =
        Math.max(

            1,

            Math.min(
                paginaNumerica,
                totalPaginas
            )

        );


    const inicio =
        (
            paginaSegura - 1
        ) *
        ITENS_POR_PAGINA;


    const fim =
        inicio +
        ITENS_POR_PAGINA;


    return {

        pagina:
            paginaSegura,

        totalPaginas,

        inicio,

        fim

    };

}


// ========================================================================
// PAGINAÇÃO
// ========================================================================

function criarBotoesPaginacao(
    tipo,
    pagina,
    totalPaginas
) {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()

                .setCustomId(
                    `liga_${tipo}_prev_${pagina}`
                )

                .setLabel(
                    'Anterior'
                )

                .setEmoji(
                    '⬅️'
                )

                .setStyle(
                    ButtonStyle.Secondary
                )

                .setDisabled(
                    pagina <= 1
                ),


            new ButtonBuilder()

                .setCustomId(
                    `liga_${tipo}_pagina_${pagina}`
                )

                .setLabel(
                    `${pagina}/${totalPaginas}`
                )

                .setStyle(
                    ButtonStyle.Secondary
                )

                .setDisabled(
                    true
                ),


            new ButtonBuilder()

                .setCustomId(
                    `liga_${tipo}_next_${pagina}`
                )

                .setLabel(
                    'Próxima'
                )

                .setEmoji(
                    '➡️'
                )

                .setStyle(
                    ButtonStyle.Secondary
                )

                .setDisabled(
                    pagina >= totalPaginas
                )

        );

}


// ========================================================================
// VOLTAR
// ========================================================================

function criarBotaoVoltar(
    tipo
) {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()

                .setCustomId(
                    `liga_${tipo}_voltar`
                )

                .setLabel(
                    'Voltar ao painel'
                )

                .setEmoji(
                    '🏠'
                )

                .setStyle(
                    ButtonStyle.Primary
                )

        );

}


// ========================================================================
// COMPONENTES
// ========================================================================

function componentesTela(
    tipo,
    pagina,
    totalPaginas
) {

    return [

        criarBotoesPaginacao(
            tipo,
            pagina,
            totalPaginas
        ),

        criarBotaoVoltar(
            tipo
        )

    ];

}


// ========================================================================
// RANKING
// ========================================================================

async function criarEmbedRanking(
    guild,
    pontuacoes,
    pagina
) {

    const ranking =
        Object.entries(
            pontuacoes || {}
        )

            .map(
                ([id, pontos]) => ({

                    id,

                    pontos:
                        Number(
                            pontos
                        ) || 0

                })
            )

            .sort(

                (a, b) =>
                    b.pontos -
                    a.pontos

            );


    const pg =
        calcularPagina(
            ranking.length,
            pagina
        );


    let itens =
        ranking.slice(
            pg.inicio,
            pg.fim
        );


    itens =
        await adicionarNomes(
            guild,
            itens
        );


    let texto =
        '';


    itens.forEach(
        (
            jogador,
            index
        ) => {

            const posicao =
                pg.inicio +
                index;


            let indicador;


            if (
                posicao === 0
            ) {

                indicador =
                    '🥇';

            } else if (
                posicao === 1
            ) {

                indicador =
                    '🥈';

            } else if (
                posicao === 2
            ) {

                indicador =
                    '🥉';

            } else {

                indicador =
                    `${posicao + 1}º`;

            }


            texto +=

                `${indicador} ` +
                `**${jogador.nome}** — ` +
                `**${jogador.pontos} pts**\n`;

        }
    );


    if (
        !texto
    ) {

        texto =
            '*Nenhuma pontuação registrada.*';

    }


    const embed =
        new EmbedBuilder()

            .setTitle(
                '🏆 RANKING — LIGA DAS NAÇÕES'
            )

            .setColor(
                '#F1C40F'
            )

            .setDescription(

                `📊 **${ranking.length} jogadores**\n` +

                `📄 **Página ${pg.pagina}/${pg.totalPaginas}**\n\n` +

                `🔥 **CLASSIFICAÇÃO POR PONTOS**`

            )

            .addFields({

                name:
                    '🏆 Ranking',

                value:
                    texto,

                inline:
                    false

            })

            .setFooter({

                text:
                    'Ranking baseado na pontuação atual da Liga.'

            });


    return {

        embed,

        pg

    };

}


// ========================================================================
// ORDENAR ESTATÍSTICAS
// ========================================================================

function ordenarEstatisticas(
    jogadores
) {

    return Object.values(
        jogadores || {}
    )

        .sort(

            (a, b) => {

                const pontosA =
                    Number(
                        a.pontos
                    ) || 0;


                const pontosB =
                    Number(
                        b.pontos
                    ) || 0;


                return (
                    pontosB -
                    pontosA
                );

            }

        );

}


// ========================================================================
// ESTATÍSTICAS
// ========================================================================

async function criarEmbedEstatisticas(
    guild,
    pagina
) {

    const temporada =
        periodosLiga
            .calcularTemporadaAtual();


    const jogadores =
        ordenarEstatisticas(
            temporada.jogadores
        );


    const resumo =
        periodosLiga
            .resumoPeriodo(
                temporada
            );


    const pg =
        calcularPagina(
            jogadores.length,
            pagina
        );


    let itens =
        jogadores.slice(
            pg.inicio,
            pg.fim
        );


    itens =
        await adicionarNomes(
            guild,
            itens
        );


    const embed =
        new EmbedBuilder()

            .setTitle(
                '📊 ESTATÍSTICAS COMPLETAS — LIGA'
            )

            .setColor(
                '#2ECC71'
            )

            .setDescription(

                `📅 **Temporada atual**\n\n` +

                `🏟️ Partidas: **${resumo.partidas}**\n` +

                `👥 Participantes: **${resumo.jogadores}**\n` +

                `✅ Vitórias registradas: **${resumo.vitorias}**\n` +

                `💀 Kills: **${resumo.kills}**\n` +

                `☠️ Mortes: **${resumo.mortes}**\n` +

                `🌍 Continentes: **${resumo.continentes}**\n\n` +

                `📄 **Página ${pg.pagina}/${pg.totalPaginas}**`

            );


    if (
        !itens.length
    ) {

        embed.addFields({

            name:
                '📊 Sem registros',

            value:
                '*Nenhum participante encontrado.*',

            inline:
                false

        });

    }


    for (
        const jogador
        of itens
    ) {

        const partidas =
            Number(
                jogador.partidas
            ) || 0;


        const vitorias =
            Number(
                jogador.vitorias
            ) || 0;


        const derrotas =
            Number(
                jogador.derrotas
            ) || 0;


        const kills =
            Number(
                jogador.kills
            ) || 0;


        const mortes =
            Number(
                jogador.mortes
            ) || 0;


        const pontos =
            Number(
                jogador.pontos
            ) || 0;


        const continentes =
            Number(
                jogador.continentes
            ) || 0;


        const winrate =
            partidas > 0

                ? (

                    (
                        vitorias /
                        partidas
                    ) *
                    100

                ).toFixed(1)

                : '0.0';


        const europa =
            Number(
                jogador.europa
            ) || 0;


        const asia =
            Number(
                jogador.asia
            ) || 0;


        const africa =
            Number(
                jogador.africa
            ) || 0;


        const amnorte =
            Number(
                jogador.amnorte
            ) || 0;


        const amsul =
            Number(
                jogador.amsul
            ) || 0;


        const oceania =
            Number(
                jogador.oceania
            ) || 0;


        embed.addFields({

            name:
                `👤 **${jogador.nome} — ${pontos} pts**`,

            value:

                `⚔️ Partidas: **${partidas}**\n` +

                `✅ Vitórias: **${vitorias}**\n` +

                `❌ Derrotas: **${derrotas}**\n` +

                `💀 Kills: **${kills}**\n` +

                `☠️ Mortes: **${mortes}**\n` +

                `🌍 Continentes: **${continentes}**\n` +

                `📈 Winrate: **${winrate}%**\n\n` +

                `🇪🇺 Europa: **${europa}** | ` +
                `🌏 Ásia: **${asia}**\n` +

                `🌍 África: **${africa}** | ` +
                `🌎 Am. Norte: **${amnorte}**\n` +

                `🌎 Am. Sul: **${amsul}** | ` +
                `🌊 Oceania: **${oceania}**`,

            inline:
                true

        });

    }


    embed.setFooter({

        text:
            'Use os botões para navegar pelas estatísticas.'

    });


    return {

        embed,

        pg

    };

}


// ========================================================================
// GUIA
// ========================================================================

function criarEmbedGuia() {

    return new EmbedBuilder()

        .setTitle(
            '📖 LIGA DAS NAÇÕES — GUIA OFICIAL'
        )

        .setColor(
            '#9B59B6'
        )

        .setDescription(

            'Escolha uma seção para consultar:\n\n' +

            '📜 **Regras**\n' +
            'Requisitos, registro e regras de anti-jogo.\n\n' +

            '🤖 **Como registrar**\n' +
            'Passo a passo para registrar uma partida.\n\n' +

            '❓ **Perguntas**\n' +
            'Dúvidas frequentes sobre a Liga.\n\n' +

            '🧮 **Pontuação**\n' +
            'Valores oficiais usados pelo sistema.'

        )

        .setFooter({

            text:
                'WorldWarBR • Guia Oficial da Liga'

        });

}


// ========================================================================
// BOTÕES DO GUIA
// ========================================================================

function criarBotoesGuia() {

    const linha1 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()

                    .setCustomId(
                        'liga_guia_regras'
                    )

                    .setLabel(
                        'Regras'
                    )

                    .setEmoji(
                        '📜'
                    )

                    .setStyle(
                        ButtonStyle.Secondary
                    ),


                new ButtonBuilder()

                    .setCustomId(
                        'liga_guia_registrar'
                    )

                    .setLabel(
                        'Como registrar'
                    )

                    .setEmoji(
                        '🤖'
                    )

                    .setStyle(
                        ButtonStyle.Primary
                    ),


                new ButtonBuilder()

                    .setCustomId(
                        'liga_guia_perguntas'
                    )

                    .setLabel(
                        'Perguntas'
                    )

                    .setEmoji(
                        '❓'
                    )

                    .setStyle(
                        ButtonStyle.Secondary
                    ),


                new ButtonBuilder()

                    .setCustomId(
                        'liga_guia_pontuacao'
                    )

                    .setLabel(
                        'Pontuação'
                    )

                    .setEmoji(
                        '🧮'
                    )

                    .setStyle(
                        ButtonStyle.Success
                    )

            );


    const linha2 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()

                    .setCustomId(
                        'liga_guia_voltar'
                    )

                    .setLabel(
                        'Voltar ao painel'
                    )

                    .setEmoji(
                        '🏠'
                    )

                    .setStyle(
                        ButtonStyle.Primary
                    )

            );


    return [

        linha1,

        linha2

    ];

}


// ========================================================================
// REGRAS — EMBED 1
// ========================================================================

function criarEmbedRegras1() {

    return new EmbedBuilder()

        .setTitle(
            '🛡️ REGRAS OFICIAIS — REQUISITOS E REGISTRO'
        )

        .setColor(
            '#E74C3C'
        )

        .setDescription(

            '🛡️ **REQUISITOS OBRIGATÓRIOS**\n\n' +

            'Para que uma partida seja aceita na disputa para a Liga, os seguintes requisitos devem ser cumpridos:\n\n' +

            '• A partida deve durar no máximo **1 hora**, terminando na rodada do último jogador.\n' +

            '• Ter no mínimo **6 participantes**.\n' +

            '• Todos os participantes devem ser membros do servidor.\n' +

            '• No máximo **80 partidas** serão consideradas para a disputa por jogador.\n\n' +

            '━━━━━━━━━━━━━━━━━━━━\n\n' +

            '📋 **COMO REGISTRAR UMA PARTIDA**\n\n' +

            '**1º** — Tire prints do mapa do jogo, da tela de jogadores e do objetivo, se tiver completado.\n\n' +

            '**2º** — Envie os prints no canal **📸・prints**.\n\n' +

            '**3º** — Escreva junto aos prints informações importantes da partida, como quem matou quem e como venceu, se por territórios ou por concluir o objetivo.\n\n' +

            '**4º** — Marque cada jogador ao dar informações sobre ele ou quando o nickname de um jogador no jogo for diferente do usado no Discord.\n\n' +

            '━━━━━━━━━━━━━━━━━━━━\n\n' +

            '🚨 **ANTI-JOGO — PROIBIÇÕES**\n\n' +

            '**🐞 Bugs/Cheats:**\n' +
            'Explorar falhas da plataforma ou utilizar hacks, scripts ou programas externos.\n\n' +

            '**👻 Ghosting:**\n' +
            'Fornecer informações estratégicas por call, live, mensagens ou qualquer meio externo para quem está jogando.\n\n' +

            '**🌾 Farming:**\n' +
            'Realizar uma sequência intencional e repetitiva de troca de territórios com o objetivo de gerar cartas entre os mesmos jogadores.\n\n' +

            '**🤝 Trégua Abusiva:**\n' +
            'Retirar defesas de uma fronteira por trégua com algum jogador para obter vantagem defensiva e de ataque em outro jogador.\n\n' +

            '**🎯 Perseguição:**\n' +
            'Focar um jogador por motivos pessoais ou externos à estratégia da partida atual.\n\n' +

            '**💥 Kamikaze:**\n' +
            'Sacrificar tropas sem justificativa estratégica, tendo como objetivo prejudicar outro jogador ou abandonar a partida.\n\n' +

            '**☠️ Entrega de Abate:**\n' +
            'Criar ou facilitar a eliminação de um jogador por um terceiro sem justificativa estratégica válida.\n\n' +

            '**🚪 Abandonar partida:**\n' +
            'Sair da partida sem justificativa ou aviso prévio.\n\n' +

            '⚠️ **ATENÇÃO:** além da perda de pontos na Liga, outras punições poderão ser aplicadas.\n\n' +

            '📩 Registre denúncias em **📩・abrir-ticket**.'

        );

}


// ========================================================================
// REGRAS — EMBED 2
// ========================================================================

function criarEmbedRegras2() {

    return new EmbedBuilder()

        .setTitle(
            '☠️ ENTREGA DE ABATE — REGRA DETALHADA'
        )

        .setColor(
            '#C0392B'
        )

        .setDescription(

            '☠️ **ENTREGA DE ABATE**\n\n' +

            'É criar ou facilitar a eliminação de outro jogador por um terceiro.\n\n' +

            '🚫 **É proibido quando:**\n\n' +

            '• Realiza a ação sem justificativa estratégica própria.\n\n' +

            '• Beneficiar com um abate um jogador para patrociná-lo na disputa contra outro, quando o eliminado poderia continuar vivo e atuar no equilíbrio da partida.\n\n' +

            '• Entregar o abate de um jogador que queira te prejudicar, mas que pela tua defesa ou quantidade de tropas ganhas na troca ele não possa de fato ser uma ameaça, ainda que seja uma dificuldade para se lidar no jogo.\n\n' +

            '✅ **É permitido quando:**\n\n' +

            '• Disputa por território ou continente com outro jogador que, caso permaneça, poderá prejudicar diretamente sua estratégia, relativamente ao objetivo.\n\n' +

            '• Realizar a ação para impedir que determinado jogador te elimine, ataque ou obtenha uma vantagem que ameace diretamente sua posição no jogo, relativo ao seu objetivo.\n\n' +

            '• Interferir em uma eliminação de um jogador que já está condenado e a decisão consiste apenas em determinar quem ficará com o abate.\n\n' +

            '🎴 **EXCEÇÃO — COMPETIDOR COM 3 CARTAS**\n\n' +

            '• A entrega do abate também é permitida quando o competidor já possui **3 cartas**, desde que a ação esteja dentro da situação estratégica válida da partida e não seja utilizada para manipular artificialmente a disputa.\n\n' +

            '📌 **OBJETIVO DA REGRA**\n\n' +

            'O objetivo desta regra não é impedir jogadas estratégicas que resultem em uma eliminação, mas impedir que jogadores decidam arbitrariamente quem deve ser eliminado, quando não existe necessidade estratégica para isso.'

        );

}


// ========================================================================
// REGRAS — EMBED 3
// ========================================================================

function criarEmbedRegras3() {

    return new EmbedBuilder()

        .setTitle(
            '🌾 FARMING — REGRA DETALHADA'
        )

        .setColor(
            '#D68910'
        )

        .setDescription(

            '🌾 **FARMING**\n\n' +

            'É realizar uma sequência intencional e repetitiva de entregas de territórios com o objetivo de gerar ou circular cartas entre os mesmos jogadores.\n\n' +

            '🚫 **É Farming:**\n\n' +

            '• Deixar propositalmente um território desprotegido ou com poucas tropas para que outro jogador o conquiste e obtenha uma carta.\n\n' +

            '• Após a conquista, o território ser novamente deixado propositalmente vulnerável para que o jogador original, ou outro jogador, o retome.\n\n' +

            '• Repetir esse processo continuamente ou de forma combinada, criando um ciclo de geração de cartas.\n\n' +

            '• Se aproveitar de alguém com poucas tropas para gerar cartas para si, quando ele não pode deixar de pegá-las e nem defender o território para que não seja novamente conquistado.\n\n' +

            '✅ **Não é Farming:**\n\n' +

            '• Gerar uma carta para que outro jogador continue vivo na partida.\n\n' +

            '• Ajudar um jogador a escapar de uma possível eliminação.\n\n' +

            '• Realizar uma jogada estratégica, mesmo que ela resulte na obtenção de uma carta, quando relativa ao objetivo.\n\n' +

            '📌 **DIFERENÇA FUNDAMENTAL**\n\n' +

            'A diferença fundamental é a **repetição intencional da troca de territórios com o objetivo de gerar ou devolver cartas**, e não a simples concessão de um território.\n\n' +

            '━━━━━━━━━━━━━━━━━━━━\n\n' +

            '⚖️ **PUNIÇÕES**\n\n' +

            'Violações das regras poderão resultar em perda de pontos, anulação de partida e outras punições administrativas conforme a gravidade da situação.\n\n' +

            '📩 Em caso de denúncia, utilize **📩・abrir-ticket**.'

        );

}


// ========================================================================
// COMO REGISTRAR
// ========================================================================

function criarEmbedRegistrar() {

    return new EmbedBuilder()

        .setTitle(
            '🤖 COMO REGISTRAR UMA PARTIDA'
        )

        .setColor(
            '#3498DB'
        )

        .setDescription(

            '### Passo a passo\n\n' +

            '**1️⃣ Abra o painel da Liga**\n' +

            'Abra o painel oficial da Liga.\n\n' +

            '**2️⃣ Clique em ▶️ Contabilizar**\n' +

            'O bot iniciará o processo de registro.\n\n' +

            '**3️⃣ Informe os participantes**\n' +

            'Selecione corretamente todos os jogadores participantes.\n\n' +

            '**4️⃣ Registre os abates**\n' +

            'Informe quem matou quem quando solicitado.\n\n' +

            '**5️⃣ Registre os continentes**\n' +

            'Informe os continentes conquistados por cada participante.\n\n' +

            '**6️⃣ Informe como a partida terminou**\n' +

            'Informe se a vitória foi por objetivo ou por territórios quando aplicável.\n\n' +

            '**7️⃣ Finalize o registro**\n' +

            'O sistema calcula os pontos e recompensas.\n\n' +

            '**8️⃣ Confira os dados**\n' +

            'Use 🏆 **Ver Ranking** ou 📊 **Estatísticas** para verificar os resultados.\n\n' +

            '📸 **IMPORTANTE:** os prints oficiais devem ser enviados no canal **📸・prints** junto com as informações da partida.\n\n' +

            '👤 **IMPORTANTE:** marque os jogadores quando o nickname utilizado no jogo for diferente do nome usado no Discord.'

        );

}


// ========================================================================
// PERGUNTAS
// ========================================================================

function criarEmbedPerguntas() {

    return new EmbedBuilder()

        .setTitle(
            '❓ PERGUNTAS FREQUENTES'
        )

        .setColor(
            '#F39C12'
        )

        .setDescription(

            '**❓ Onde vejo minha posição?**\n' +
            'Use 🏆 **Ver Ranking**.\n\n' +

            '**❓ Onde vejo minhas estatísticas?**\n' +
            'Use 📊 **Estatísticas**.\n\n' +

            '**❓ Quem pegou mais Europa?**\n' +
            'Compare as conquistas de Europa nas estatísticas.\n\n' +

            '**❓ Quem tem mais kills?**\n' +
            'As kills aparecem nas estatísticas.\n\n' +

            '**❓ Como funciona o winrate?**\n' +
            'É calculado com base nas vitórias e partidas registradas.\n\n' +

            '**❓ O que acontece quando uma partida é anulada?**\n' +
            'Os pontos, WarCoins e vitórias gerados pela partida são estornados.\n\n' +

            '**❓ Vitória influencia a progressão?**\n' +
            'Sim. Vitórias válidas podem alimentar o sistema de progressão.\n\n' +

            '**❓ Posso entregar um abate?**\n' +
            'Depende da situação estratégica. Consulte 📜 **Regras**.\n\n' +

            '**❓ E se o competidor já tiver 3 cartas?**\n' +
            'A regra da Liga permite a entrega do abate nessa situação, desde que a jogada esteja dentro das condições válidas da partida.\n\n' +

            '**❓ Posso fazer Farming?**\n' +
            'Não quando houver repetição intencional para gerar ou circular cartas.'

        );

}


// ========================================================================
// PONTUAÇÃO
// ========================================================================

function criarEmbedPontuacao() {

    const vitoriaObjetivo =
        Number(
            configPontos?.vitoria?.objetivo
        ) || 0;


    const vitoriaTerritorios =
        Number(
            configPontos?.vitoria?.territorios
        ) || 0;


    const segundoLugar =
        Number(
            configPontos?.segundoLugar
        ) || 0;


    const sobrevivencia =
        Number(
            configPontos?.sobrevivencia
        ) || 0;


    const kill =
        Number(
            configPontos?.combate?.kill
        ) || 0;


    const morte =
        Number(
            configPontos?.combate?.morte
        ) || 0;


    const continentes =
        configPontos?.continentes ||
        {};


    const asia =
        Number(
            continentes?.asia?.pontos
        ) || 0;


    const europa =
        Number(
            continentes?.europa?.pontos
        ) || 0;


    const africa =
        Number(
            continentes?.africa?.pontos
        ) || 0;


    const amnorte =
        Number(
            continentes?.amnorte?.pontos
        ) || 0;


    const amsul =
        Number(
            continentes?.amsul?.pontos
        ) || 0;


    const oceania =
        Number(
            continentes?.oceania?.pontos
        ) || 0;


    return new EmbedBuilder()

        .setTitle(
            '🧮 SISTEMA DE PONTUAÇÃO DA LIGA'
        )

        .setColor(
            '#2ECC71'
        )

        .setDescription(

            '### 🏆 Vitória\n\n' +

            `🎯 **Objetivo:** +${vitoriaObjetivo} pontos\n` +

            `🌍 **Territórios:** +${vitoriaTerritorios} pontos\n\n` +

            '### 🥈 Classificação\n\n' +

            `🥈 **Segundo lugar:** +${segundoLugar} pontos\n\n` +

            '### 🛡️ Sobrevivência\n\n' +

            `❤️ **Sobrevivência:** +${sobrevivencia} pontos\n\n` +

            '### ⚔️ Combate\n\n' +

            `💀 **Kill:** +${kill} pontos\n` +

            `☠️ **Morte:** ${morte} pontos\n\n` +

            '### 🌍 Continentes\n\n' +

            `🌏 **Ásia:** +${asia}\n` +

            `🇪🇺 **Europa:** +${europa}\n` +

            `🌍 **África:** +${africa}\n` +

            `🌎 **América do Norte:** +${amnorte}\n` +

            `🌎 **América do Sul:** +${amsul}\n` +

            `🌊 **Oceania:** +${oceania}`

        )

        .setFooter({

            text:
                'Valores carregados automaticamente de configPontos.js.'

        });

}


// ========================================================================
// BOTÕES DAS SUBGUIAS
// ========================================================================

function criarBotoesSubGuia() {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()

                .setCustomId(
                    'liga_guia'
                )

                .setLabel(
                    'Voltar ao Guia'
                )

                .setEmoji(
                    '📖'
                )

                .setStyle(
                    ButtonStyle.Secondary
                ),


            new ButtonBuilder()

                .setCustomId(
                    'liga_guia_voltar'
                )

                .setLabel(
                    'Painel'
                )

                .setEmoji(
                    '🏠'
                )

                .setStyle(
                    ButtonStyle.Primary
                )

        );

}


// ========================================================================
// BOTÕES DAS REGRAS
// ========================================================================

function criarBotoesRegras() {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()

                .setCustomId(
                    'liga_guia'
                )

                .setLabel(
                    'Voltar ao Guia'
                )

                .setEmoji(
                    '📖'
                )

                .setStyle(
                    ButtonStyle.Secondary
                ),


            new ButtonBuilder()

                .setCustomId(
                    'liga_guia_voltar'
                )

                .setLabel(
                    'Painel'
                )

                .setEmoji(
                    '🏠'
                )

                .setStyle(
                    ButtonStyle.Primary
                )

        );

}


// ========================================================================
// MOSTRAR RANKING
// ========================================================================

async function mostrarRanking(
    interaction,
    pontuacaoPath,
    pagina
) {

    const ok =
        await garantirInteracaoRespondida(
            interaction
        );


    if (
        !ok
    ) {

        return;

    }


    const pontuacoes =
        safeReadJson(
            pontuacaoPath
        ) || {};


    const resultado =
        await criarEmbedRanking(

            interaction.guild,

            pontuacoes,

            pagina

        );


    return interaction.editReply({

        content:
            '',

        embeds: [

            resultado.embed

        ],

        components:

            componentesTela(

                'ranking',

                resultado.pg.pagina,

                resultado.pg.totalPaginas

            )

    });

}


// ========================================================================
// MOSTRAR ESTATÍSTICAS
// ========================================================================

async function mostrarEstatisticas(
    interaction,
    pagina
) {

    const ok =
        await garantirInteracaoRespondida(
            interaction
        );


    if (
        !ok
    ) {

        return;

    }


    const resultado =
        await criarEmbedEstatisticas(

            interaction.guild,

            pagina

        );


    return interaction.editReply({

        content:
            '',

        embeds: [

            resultado.embed

        ],

        components:

            componentesTela(

                'estatisticas',

                resultado.pg.pagina,

                resultado.pg.totalPaginas

            )

    });

}


// ========================================================================
// GUIA
// ========================================================================

async function mostrarGuia(
    interaction
) {

    const ok =
        await garantirInteracaoRespondida(
            interaction
        );


    if (
        !ok
    ) {

        return;

    }


    return interaction.editReply({

        content:
            '',

        embeds: [

            criarEmbedGuia()

        ],

        components:
            criarBotoesGuia()

    });

}


// ========================================================================
// SUBGUIA
// ========================================================================

async function mostrarSubGuia(
    interaction,
    embed
) {

    const ok =
        await garantirInteracaoRespondida(
            interaction
        );


    if (
        !ok
    ) {

        return;

    }


    return interaction.editReply({

        content:
            '',

        embeds: [

            embed

        ],

        components: [

            criarBotoesSubGuia()

        ]

    });

}


// ========================================================================
// REGRAS COMPLETAS
// ========================================================================

async function mostrarRegras(
    interaction
) {

    const ok =
        await garantirInteracaoRespondida(
            interaction
        );


    if (
        !ok
    ) {

        return;

    }


    return interaction.editReply({

        content:
            '',

        embeds: [

            criarEmbedRegras1(),

            criarEmbedRegras2(),

            criarEmbedRegras3()

        ],

        components: [

            criarBotoesRegras()

        ]

    });

}


// ========================================================================
// VOLTAR AO PAINEL
// ========================================================================

async function voltarAoPainel(
    interaction
) {

    const ok =
        await garantirInteracaoRespondida(
            interaction
        );


    if (
        !ok
    ) {

        return;

    }


    try {

        await painelMod(

            interaction.guild,

            '1429504377395351854'

        );


        return;

    } catch (erro) {

        console.error(
            '[LIGA] Erro ao voltar ao painel:',
            erro
        );


        return interaction.editReply({

            content:
                '❌ Não foi possível restaurar o painel da Liga.',

            embeds:
                [],

            components:
                []

        });

    }

}


// ========================================================================
// PRINCIPAL
// ========================================================================

module.exports = async (

    client,
    interaction,
    pontuacaoPathCustom,
    partidasPath

) => {

    const pontuacaoPath =
        pontuacaoPathCustom ||
        pontuacaoPathDefault;


    const id =
        interaction.customId;


    // ====================================================================
    // CONTABILIZAR
    // ====================================================================

    if (
        id ===
        'iniciar_contabilizacao'
    ) {

        await interaction
            .deferReply({

                flags:
                    MessageFlags.Ephemeral

            })
            .catch(
                () => {}
            );


        return await handleIniciar(

            client,

            interaction,

            pontuacaoPath,

            partidasPath

        );

    }


    // ====================================================================
    // GUIA
    // ====================================================================

    if (
        id ===
        'liga_guia'
    ) {

        await interaction
            .deferReply({

                flags:
                    MessageFlags.Ephemeral

            })
            .catch(
                () => {}
            );


        return mostrarGuia(
            interaction
        );

    }


    // ====================================================================
    // REGRAS
    // ====================================================================

    if (
        id ===
        'liga_guia_regras'
    ) {

        return mostrarRegras(
            interaction
        );

    }


    // ====================================================================
    // COMO REGISTRAR
    // ====================================================================

    if (
        id ===
        'liga_guia_registrar'
    ) {

        return mostrarSubGuia(

            interaction,

            criarEmbedRegistrar()

        );

    }


    // ====================================================================
    // PERGUNTAS
    // ====================================================================

    if (
        id ===
        'liga_guia_perguntas'
    ) {

        return mostrarSubGuia(

            interaction,

            criarEmbedPerguntas()

        );

    }


    // ====================================================================
    // PONTUAÇÃO
    // ====================================================================

    if (
        id ===
        'liga_guia_pontuacao'
    ) {

        return mostrarSubGuia(

            interaction,

            criarEmbedPontuacao()

        );

    }


    // ====================================================================
    // VOLTAR AO PAINEL
    // ====================================================================

    if (
        id ===
        'liga_guia_voltar'
    ) {

        return voltarAoPainel(
            interaction
        );

    }


    // ====================================================================
    // RANKING
    // ====================================================================

    if (
        id ===
        'ver_ranking'
    ) {

        await interaction
            .deferReply({

                flags:
                    MessageFlags.Ephemeral

            })
            .catch(
                () => {}
            );


        return mostrarRanking(

            interaction,

            pontuacaoPath,

            1

        );

    }


    // ====================================================================
    // ESTATÍSTICAS
    // ====================================================================

    if (
        id ===
        'liga_estatisticas'
    ) {

        await interaction
            .deferReply({

                flags:
                    MessageFlags.Ephemeral

            })
            .catch(
                () => {}
            );


        return mostrarEstatisticas(

            interaction,

            1

        );

    }


    // ====================================================================
    // RANKING — ANTERIOR
    // ====================================================================

    if (
        id.startsWith(
            'liga_ranking_prev_'
        )
    ) {

        const pagina =
            Number(
                id
                    .split('_')
                    .pop()
            ) || 1;


        return mostrarRanking(

            interaction,

            pontuacaoPath,

            pagina - 1

        );

    }


    // ====================================================================
    // RANKING — PRÓXIMA
    // ====================================================================

    if (
        id.startsWith(
            'liga_ranking_next_'
        )
    ) {

        const pagina =
            Number(
                id
                    .split('_')
                    .pop()
            ) || 1;


        return mostrarRanking(

            interaction,

            pontuacaoPath,

            pagina + 1

        );

    }


    // ====================================================================
    // RANKING — PÁGINA
    // ====================================================================

    if (
        id.startsWith(
            'liga_ranking_pagina_'
        )
    ) {

        return;

    }


    // ====================================================================
    // RANKING — VOLTAR
    // ====================================================================

    if (
        id ===
        'liga_ranking_voltar'
    ) {

        return voltarAoPainel(
            interaction
        );

    }


    // ====================================================================
    // ESTATÍSTICAS — ANTERIOR
    // ====================================================================

    if (
        id.startsWith(
            'liga_estatisticas_prev_'
        )
    ) {

        const pagina =
            Number(
                id
                    .split('_')
                    .pop()
            ) || 1;


        return mostrarEstatisticas(

            interaction,

            pagina - 1

        );

    }


    // ====================================================================
    // ESTATÍSTICAS — PRÓXIMA
    // ====================================================================

    if (
        id.startsWith(
            'liga_estatisticas_next_'
        )
    ) {

        const pagina =
            Number(
                id
                    .split('_')
                    .pop()
            ) || 1;


        return mostrarEstatisticas(

            interaction,

            pagina + 1

        );

    }


    // ====================================================================
    // ESTATÍSTICAS — PÁGINA
    // ====================================================================

    if (
        id.startsWith(
            'liga_estatisticas_pagina_'
        )
    ) {

        return;

    }


    // ====================================================================
    // ESTATÍSTICAS — VOLTAR
    // ====================================================================

    if (
        id ===
        'liga_estatisticas_voltar'
    ) {

        return voltarAoPainel(
            interaction
        );

    }


    // ====================================================================
    // ANULAÇÃO DE PARTIDA
    // ====================================================================

    if (
        !id.startsWith(
            'edit_match_'
        )
    ) {

        return;

    }


    await interaction
        .deferReply({

            flags:
                MessageFlags.Ephemeral

        })
        .catch(
            () => {}
        );


    const matchId =
        id.replace(
            'edit_match_',
            ''
        );


    const partidas =
        safeReadJson(
            partidasPath
        ) || {};


    if (
        !partidas[matchId]
    ) {

        return interaction.editReply({

            content:
                '❌ Os dados desta partida não foram encontrados.'

        });

    }


    const dadosPartida =
        partidas[matchId];


    const isAdministrador =
        interaction.member
            .permissions
            .has(
                PermissionFlagsBits.Administrator
            );


    const isDonoDoRegistro =
        interaction.user.id ===
        dadosPartida.adminId;


    if (
        !isAdministrador &&
        !isDonoDoRegistro
    ) {

        return interaction.editReply({

            content:
                '❌ **ACESSO NEGADO!** Apenas Oficiais do Alto Comando ou o jogador que registrou esta partida podem anulá-la.'

        });

    }


    const pontuacao =
        safeReadJson(
            pontuacaoPath
        ) || {};


    const economy =
        safeReadJson(
            economyPath
        ) || {};


    const progressaoData =
        safeReadJson(
            progressaoPath
        ) || {};


    const carreirasConfig =
        safeReadJson(
            carreirasPath
        ) || {};


    // ====================================================================
    // ESTORNO
    // ====================================================================

    for (
        const [
            uid,
            pData
        ]
        of Object.entries(
            dadosPartida.pontos ||
            {}
        )
    ) {

        // ---------------------------------------------------------------
        // PONTOS
        // ---------------------------------------------------------------

        if (
            pontuacao[uid] !== undefined
        ) {

            pontuacao[uid] =
                Math.max(

                    0,

                    Number(
                        pontuacao[uid]
                    ) -

                    Number(
                        pData.ptsLiga
                    )

                );

        }


        // ---------------------------------------------------------------
        // WARCOINS
        // ---------------------------------------------------------------

        if (
            economy[uid] !== undefined
        ) {

            economy[uid] =
                Math.max(

                    0,

                    Number(
                        economy[uid]
                    ) -

                    Number(
                        pData.wcRecebido
                    )

                );

        }


        // ---------------------------------------------------------------
        // VITÓRIA
        // ---------------------------------------------------------------

        if (

            pData.vitoria === 1 &&

            progressaoData[uid]

        ) {

            progressaoData[uid].totalWins =
                Math.max(

                    0,

                    Number(
                        progressaoData[uid].totalWins || 0
                    ) - 1

                );


            progressaoData[uid].vitoriasSemanais =
                Math.max(

                    0,

                    Number(
                        progressaoData[uid].vitoriasSemanais || 0
                    ) - 1

                );


            progressaoData[uid].vitoriasMensais =
                Math.max(

                    0,

                    Number(
                        progressaoData[uid].vitoriasMensais || 0
                    ) - 1

                );


            const factionId =
                progressaoData[uid].factionId;


            if (

                factionId &&

                carreirasConfig.faccoes &&

                carreirasConfig.faccoes[factionId]

            ) {

                const faccao =
                    carreirasConfig.faccoes[
                        factionId
                    ];


                let rankCorreto =
                    null;


                for (
                    const rank
                    of faccao.caminho || []
                ) {

                    if (

                        Number(
                            progressaoData[uid].totalWins
                        ) >=

                        Number(
                            rank.custo
                        )

                    ) {

                        rankCorreto =
                            rank;

                    }

                }


                const targetRankId =
                    rankCorreto
                        ? rankCorreto.id
                        : null;


                progressaoData[uid].currentRankId =
                    targetRankId;


                try {

                    const membro =
                        await interaction.guild.members
                            .fetch(
                                uid
                            )
                            .catch(
                                () => null
                            );


                    if (
                        membro
                    ) {

                        if (
                            targetRankId
                        ) {

                            await membro.roles
                                .add(
                                    targetRankId
                                )
                                .catch(
                                    () => {}
                                );

                        }


                        for (
                            const rank
                            of faccao.caminho || []
                        ) {

                            if (

                                rank.id !==
                                targetRankId &&

                                membro.roles.cache.has(
                                    rank.id
                                )

                            ) {

                                await membro.roles
                                    .remove(
                                        rank.id
                                    )
                                    .catch(
                                        () => {}
                                    );

                            }

                        }

                    }

                } catch (erro) {

                    console.error(
                        '[LIGA] Erro ao atualizar patente:',
                        erro
                    );

                }

            }

        }

    }


    // ====================================================================
    // REMOVER PARTIDA
    // ====================================================================

    delete partidas[
        matchId
    ];


    // ====================================================================
    // SALVAR
    // ====================================================================

    safeWriteJson(
        partidasPath,
        partidas
    );


    safeWriteJson(
        pontuacaoPath,
        pontuacao
    );


    safeWriteJson(
        economyPath,
        economy
    );


    safeWriteJson(
        progressaoPath,
        progressaoData
    );


    // ====================================================================
    // RESTAURAR PAINEL
    // ====================================================================

    try {

        await painelMod(

            interaction.guild,

            '1429504377395351854'

        );

    } catch (erro) {

        console.error(
            '[LIGA] Erro ao restaurar painel:',
            erro
        );

    }


    // ====================================================================
    // APAGAR MENSAGEM DA PARTIDA
    // ====================================================================

    try {

        const mensagem =
            await interaction.channel
                .messages
                .fetch(
                    matchId
                )
                .catch(
                    () => null
                );


        if (
            mensagem
        ) {

            await mensagem
                .delete()
                .catch(
                    () => {}
                );

        }

    } catch {}


    // ====================================================================
    // CONFIRMAÇÃO
    // ====================================================================

    return interaction.editReply({

        content:
            '✅ Partida anulada com sucesso! Pontos, WarCoins, vitórias e patentes foram estornados e o painel foi restaurado.'

    });

};