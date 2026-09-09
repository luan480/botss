/* ============================================================================
   PAINEL PRINCIPAL DA LIGA DAS NAÇÕES
   ============================================================================

   O QUE ESTE ARQUIVO FAZ:

   1. Localiza o canal onde o painel da Liga será exibido.
   2. Verifica e repara dados antigos da Liga.
   3. Sincroniza a pontuação com o histórico de partidas.
   4. Detecta alterações feitas manualmente no pontuacao.json.
   5. Calcula o ranking atual da temporada.
   6. Exibe automaticamente o TOP 3.
   7. Exibe a premiação da temporada.
   8. Informa que a temporada começa no dia 1º e termina no último
      dia do mês.
   9. Cria o painel caso ele ainda não exista.
   10. Atualiza o painel existente caso já exista.
   11. Salva o ID da mensagem do painel em painel.json.
   12. Disponibiliza os botões:
       - Contabilizar
       - Ver Ranking
       - Estatísticas
       - Guia da Liga

   ============================================================================ */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} = require('discord.js');

const path = require('path');

const {
    safeReadJson,
    safeWriteJson
} = require('./utils/helpers.js');

const pontuacaoLiga = require('./utils/pontuacaoLiga.js');
const migracaoLiga = require('./utils/migracaoLiga.js');


/* ============================================================================
   CAMINHOS DOS ARQUIVOS
   ============================================================================ */

const base = __dirname;

const pontuacaoPath = path.join(
    base,
    'pontuacao.json'
);

const partidasPath = path.join(
    base,
    'partidas.json'
);

const temporadaPath = path.join(
    base,
    'temporada.json'
);

const painelPath = path.join(
    base,
    'painel.json'
);


/* ============================================================================
   CONFIGURAÇÕES
   ============================================================================ */

/*
   Canal onde o painel da Liga das Nações será enviado.

   Caso a função receba um canalId diferente, o canal recebido terá
   prioridade sobre este ID.
*/
const CANAL_PAINEL_LIGA = '1543636868682354748';


/*
   Marca utilizada para identificar que o sistema já fez a primeira
   sincronização da pontuação.

   Isso evita que alterações manuais sejam interpretadas incorretamente
   durante a inicialização.
*/
const META_EDICAO_DIRETA = 'manualEdicaoDiretaV1';


/* ============================================================================
   CONTROLE DE EXECUÇÃO
   ============================================================================ */

/*
   Evita executar a migração de integridade várias vezes durante o mesmo
   processo do bot.
*/
let integridadeExecutada = false;


/*
   Evita sincronizar o arquivo de pontuação várias vezes durante o mesmo
   processo.
*/
let pontuacaoSincronizada = false;


/* ============================================================================
   FUNÇÃO: numero
   ============================================================================

   Converte um valor para número de forma segura.

   Se o valor não for um número válido, retorna 0.

   Exemplos:

   numero(10)        -> 10
   numero("25")      -> 25
   numero(undefined) -> 0
   numero("abc")     -> 0
   ============================================================================ */

function numero(valor) {
    const n = Number(valor);

    return Number.isFinite(n)
        ? n
        : 0;
}


/* ============================================================================
   FUNÇÃO: idValido
   ============================================================================

   Verifica se determinado valor parece ser um ID válido do Discord.

   IDs do Discord normalmente possuem entre 17 e 20 dígitos.
   ============================================================================ */

function idValido(id) {
    return /^\d{17,20}$/.test(
        String(id || '')
    );
}


/* ============================================================================
   FUNÇÃO: capturarEdicoesManuaisDiretas
   ============================================================================

   Esta função verifica se algum administrador alterou diretamente o
   pontuacao.json.

   Exemplo:

   Histórico calcula:
       100 pontos

   Arquivo possui:
       130 pontos

   Diferença:
       +30

   O sistema entende que os +30 são um ajuste manual.

   Isso permite alterar a pontuação diretamente no arquivo sem perder
   o valor durante a sincronização automática.
   ============================================================================ */

function capturarEdicoesManuaisDiretas() {

    const dados = safeReadJson(
        pontuacaoPath
    ) || {};


    /*
       Só executa se o arquivo já tiver sido inicializado pelo sistema.
    */
    if (
        dados?._ligaMeta?.[META_EDICAO_DIRETA] !== true
    ) {
        return;
    }


    /*
       Calcula novamente as estatísticas diretamente do histórico.
    */
    const historico =
        pontuacaoLiga.calcularEstatisticasTemporada(
            partidasPath,
            temporadaPath
        );


    let alterou = false;


    /*
       Percorre todos os jogadores existentes no pontuacao.json.
    */
    for (
        const [id, perfil]
        of Object.entries(dados)
    ) {

        /*
           Ignora propriedades internas e IDs inválidos.
        */
        if (
            !idValido(id) ||
            !perfil ||
            typeof perfil !== 'object'
        ) {
            continue;
        }


        /*
           Pontuação que deveria existir apenas pelo histórico.
        */
        const baseHistorica =
            numero(
                historico[id]?.pontos
            );


        /*
           Pontuação atualmente armazenada.
        */
        const pontosAtuais =
            numero(
                perfil.pontos ??
                perfil.ptsLiga ??
                perfil.pontuacao
            );


        /*
           Diferença entre a pontuação atual e o histórico.
        */
        const ajusteAtual =
            pontosAtuais -
            baseHistorica;


        /*
           Recupera o ajuste manual salvo anteriormente.
        */
        const ajusteSalvo =
            perfil.ajusteManual === true
                ? numero(
                    perfil.ajusteManualValor
                )
                : 0;


        /*
           Se o ajuste mudou ou ainda não foi registrado,
           transforma a diferença em ajuste manual.
        */
        if (
            perfil.ajusteManual !== true ||
            ajusteSalvo !== ajusteAtual
        ) {

            perfil.ajusteManual = true;

            perfil.ajusteManualValor =
                ajusteAtual;

            perfil.ajusteManualEm =
                new Date().toISOString();

            perfil.ajusteManualPor =
                'edicao direta em pontuacao.json';

            alterou = true;
        }
    }


    /*
       Salva somente se alguma alteração foi encontrada.
    */
    if (alterou) {

        safeWriteJson(
            pontuacaoPath,
            dados
        );
    }
}


/* ============================================================================
   FUNÇÃO: prepararEstadoUmaVez
   ============================================================================

   Responsável por preparar os dados da Liga antes de gerar o ranking.

   Faz:

   1. Migração/reparo de dados.
   2. Primeira sincronização.
   3. Captura de edições manuais.
   4. Sincronização posterior.
   ============================================================================ */

function prepararEstadoUmaVez() {


    /* ------------------------------------------------------------------------
       1. MIGRAÇÃO E INTEGRIDADE
       ------------------------------------------------------------------------ */

    if (!integridadeExecutada) {

        try {

            const reparados =
                migracaoLiga.executar();


            if (reparados > 0) {

                console.log(
                    `[LIGA] ${reparados} registros com pontos ausentes foram reparados.`
                );
            }


            integridadeExecutada = true;

        } catch (erro) {

            console.error(
                '[LIGA] Migração automática de integridade falhou:',
                erro
            );

            throw erro;
        }
    }


    /* ------------------------------------------------------------------------
       2. SINCRONIZAÇÃO DA PONTUAÇÃO
       ------------------------------------------------------------------------ */

    if (!pontuacaoSincronizada) {

        try {

            const dados =
                safeReadJson(
                    pontuacaoPath
                ) || {};


            /*
               Verifica se o arquivo já passou pela primeira inicialização.
            */
            const inicializado =
                dados?._ligaMeta?.[META_EDICAO_DIRETA] === true;


            /* ----------------------------------------------------------------
               PRIMEIRA INICIALIZAÇÃO
               ---------------------------------------------------------------- */

            if (!inicializado) {

                /*
                   Limpa pontuações antigas/stale e calcula novamente
                   a pontuação correta com base no histórico.
                */
                pontuacaoLiga.sincronizarArquivo(
                    pontuacaoPath,
                    partidasPath,
                    temporadaPath
                );


                /*
                   Marca o arquivo como inicializado.
                */
                const atualizado =
                    safeReadJson(
                        pontuacaoPath
                    ) || {};


                atualizado._ligaMeta = {
                    ...(atualizado._ligaMeta || {}),
                    [META_EDICAO_DIRETA]: true
                };


                safeWriteJson(
                    pontuacaoPath,
                    atualizado
                );

            }


            /* ----------------------------------------------------------------
               SISTEMA JÁ INICIALIZADO
               ---------------------------------------------------------------- */

            else {

                /*
                   Primeiro detecta possíveis alterações manuais.
                */
                capturarEdicoesManuaisDiretas();


                /*
                   Depois sincroniza novamente os dados.
                */
                pontuacaoLiga.sincronizarArquivo(
                    pontuacaoPath,
                    partidasPath,
                    temporadaPath
                );
            }


            pontuacaoSincronizada = true;

        } catch (erro) {

            console.error(
                '[LIGA] Sincronização automática da pontuação falhou:',
                erro
            );

            throw erro;
        }
    }


    /*
       Mesmo depois da primeira sincronização,
       verifica novamente se alguém editou o arquivo manualmente.
    */
    capturarEdicoesManuaisDiretas();
}


/* ============================================================================
   FUNÇÃO: rankingAtual
   ============================================================================

   Gera o ranking atual da Liga das Nações.

   Critérios de desempate:

   1. Mais pontos
   2. Mais vitórias
   3. Mais partidas
   4. ID do jogador
   ============================================================================ */

function rankingAtual() {

    /*
       Garante que os dados estejam preparados.
    */
    prepararEstadoUmaVez();


    /*
       Lê o arquivo atual de pontuação.
    */
    const dados =
        safeReadJson(
            pontuacaoPath
        ) || {};


    /*
       Normaliza todos os jogadores.
    */
    const perfis =
        pontuacaoLiga.normalizarTodos(
            dados,
            partidasPath,
            temporadaPath
        );


    /*
       Converte os dados em uma lista e ordena.
    */
    return Object.values(perfis)

        .map(j => ({

            ...j,

            id: String(j.id),

            pontos:
                Number(j.pontos) || 0,

            vitorias:
                Number(j.vitorias) || 0,

            partidas:
                Number(j.partidas) || 0
        }))


        /*
           Remove jogadores sem qualquer atividade.
        */
        .filter(j =>
            j.partidas > 0 ||
            j.pontos !== 0 ||
            j.vitorias > 0
        )


        /*
           Ordenação oficial.
        */
        .sort((a, b) =>

            b.pontos - a.pontos ||

            b.vitorias - a.vitorias ||

            b.partidas - a.partidas ||

            String(a.id).localeCompare(
                String(b.id)
            )
        );
}


/* ============================================================================
   FUNÇÃO: formatarPeriodoTemporada
   ============================================================================

   Gera automaticamente o período da temporada atual.

   Exemplo:

   Setembro:
       1º a 30 de setembro

   Outubro:
       1º a 31 de outubro

   Fevereiro:
       1º a 28/29 de fevereiro

   Assim não é necessário editar manualmente o texto todo mês.
   ============================================================================ */

function formatarPeriodoTemporada() {

    const agora = new Date();


    const inicio =
        new Date(
            agora.getFullYear(),
            agora.getMonth(),
            1
        );


    const fim =
        new Date(
            agora.getFullYear(),
            agora.getMonth() + 1,
            0
        );


    const opcoes = {
        day: 'numeric',
        month: 'long'
    };


    const inicioFormatado =
        inicio.toLocaleDateString(
            'pt-BR',
            opcoes
        );


    const fimFormatado =
        fim.toLocaleDateString(
            'pt-BR',
            opcoes
        );


    return `${inicioFormatado} até ${fimFormatado}`;
}


/* ============================================================================
   FUNÇÃO PRINCIPAL: criarPainelDashboard
   ============================================================================

   Esta é a função exportada para o restante do bot.

   Ela:

   1. Recebe a guild.
   2. Localiza o canal.
   3. Calcula o ranking.
   4. Monta o painel.
   5. Cria ou edita a mensagem.
   6. Salva o ID da mensagem.
   ============================================================================ */

module.exports = async function criarPainelDashboard(
    guild,
    canalId
) {


    /* ------------------------------------------------------------------------
       VALIDAÇÃO DA GUILD
       ------------------------------------------------------------------------ */

    if (!guild) {

        throw new Error(
            'Guild não informada.'
        );
    }


    /* ------------------------------------------------------------------------
       LOCALIZAÇÃO DO CANAL
       ------------------------------------------------------------------------ */

    const canalFinal =
        String(
            canalId ||
            CANAL_PAINEL_LIGA
        );


    const canal =
        await guild.channels
            .fetch(canalFinal)
            .catch(() => null);


    if (!canal) {

        throw new Error(
            `Canal ${canalFinal} não encontrado.`
        );
    }


    if (!canal.isTextBased()) {

        throw new Error(
            'O canal informado não é de texto.'
        );
    }


    /* ------------------------------------------------------------------------
       CALCULA O RANKING
       ------------------------------------------------------------------------ */

    const ranking =
        rankingAtual();


    /* ------------------------------------------------------------------------
       FUNÇÃO PARA MONTAR CADA LINHA DO TOP 3
       ------------------------------------------------------------------------ */

    const linha = (
        jogador,
        emoji,
        posicao
    ) => {

        if (jogador) {

            return (
                `${emoji} **${posicao}º** ` +
                `<@${jogador.id}> — ` +
                `**${jogador.pontos} pts**`
            );
        }


        return (
            `${emoji} **${posicao}º** ` +
            `⏳ *Vago*`
        );
    };


    /* ------------------------------------------------------------------------
       PERÍODO DA TEMPORADA
       ------------------------------------------------------------------------ */

    const periodoTemporada =
        formatarPeriodoTemporada();


    /* =========================================================================
       CONSTRUÇÃO DO PAINEL
       ========================================================================= */

    const containerPainel =
        new ContainerBuilder()


            /* -----------------------------------------------------------------
               COR PRINCIPAL DO PAINEL
               ----------------------------------------------------------------- */

            .setAccentColor(
                0x9B59B6
            )


            /* -----------------------------------------------------------------
               CABEÇALHO
               ----------------------------------------------------------------- */

            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        '### 🏆 LIGA DAS NAÇÕES 🏆\n' +
                        '⚔️ **A batalha pelo domínio começou!**'
                    )
            )


            /* -----------------------------------------------------------------
               SEPARADOR
               ----------------------------------------------------------------- */

            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(
                        SeparatorSpacingSize.Small
                    )
            )


            /* -----------------------------------------------------------------
               INFORMAÇÕES DA TEMPORADA
               ----------------------------------------------------------------- */

            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(

                        `📆 **TEMPORADA ATUAL**\n` +
                        `⚔️ **${periodoTemporada}**\n\n` +

                        `🌎 **AS NAÇÕES ENTRARAM EM CAMPO!**\n` +
                        `🔥 Cada confronto válido conta para o destino da sua nação.\n` +
                        `🏆 Apenas os mais fortes chegarão ao topo e terão seu nome marcado na história da **Liga das Nações**.\n\n` +

                        `__**💰 PREMIAÇÃO DA TEMPORADA**__\n` +
                        `🥇 **1º Lugar:** R$ 100,00\n` +
                        `🥈 **2º Lugar:** R$ 70,00\n` +
                        `🥉 **3º Lugar:** R$ 30,00`
                    )
            )


            /* -----------------------------------------------------------------
               SEPARADOR
               ----------------------------------------------------------------- */

            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(
                        SeparatorSpacingSize.Small
                    )
            )


            /* -----------------------------------------------------------------
               TOP 3
               ----------------------------------------------------------------- */

            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(

                        `📈 **TOP 3 ATUAL — TEMPO REAL**\n\n` +

                        `${linha(
                            ranking[0],
                            '🥇',
                            1
                        )}\n` +

                        `${linha(
                            ranking[1],
                            '🥈',
                            2
                        )}\n` +

                        `${linha(
                            ranking[2],
                            '🥉',
                            3
                        )}`
                    )
            )


            /* -----------------------------------------------------------------
               SEPARADOR
               ----------------------------------------------------------------- */

            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(
                        SeparatorSpacingSize.Small
                    )
            )


            /* -----------------------------------------------------------------
               GIF / IMAGEM DO PAINEL
               ----------------------------------------------------------------- */

            .addMediaGalleryComponents(
                new MediaGalleryBuilder()
                    .addItems(

                        new MediaGalleryItemBuilder()
                            .setURL(
                                'https://cdn.discordapp.com/attachments/1082774011676729365/1283426407313182803/WAR.gif'
                            )
                    )
            )


            /* -----------------------------------------------------------------
               GUIA
               ----------------------------------------------------------------- */

            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        '📖 **GUIA DA LIGA:** regras, registro de partidas e pontuação.'
                    )
            );


    /* =========================================================================
       BOTÕES DO PAINEL
       =========================================================================

       Cada botão possui um customId.

       O tratamento desses IDs deve existir no seu sistema de interações.

       IDs utilizados:

       iniciar_contabilizacao
       ver_ranking
       estatisticas_selecionar
       liga_guia
       ========================================================================= */

    const row =
        new ActionRowBuilder()
            .addComponents(

                /*
                   Botão para iniciar a contabilização.
                */
                new ButtonBuilder()
                    .setCustomId(
                        'iniciar_contabilizacao'
                    )
                    .setLabel(
                        'Contabilizar'
                    )
                    .setEmoji(
                        '▶️'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),


                /*
                   Abre o ranking completo.
                */
                new ButtonBuilder()
                    .setCustomId(
                        'ver_ranking'
                    )
                    .setLabel(
                        'Ver Ranking'
                    )
                    .setEmoji(
                        '🏆'
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),


                /*
                   Abre o menu de estatísticas.
                */
                new ButtonBuilder()
                    .setCustomId(
                        'estatisticas_selecionar'
                    )
                    .setLabel(
                        'Estatísticas'
                    )
                    .setEmoji(
                        '📊'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),


                /*
                   Abre o guia da Liga.
                */
                new ButtonBuilder()
                    .setCustomId(
                        'liga_guia'
                    )
                    .setLabel(
                        'Guia da Liga'
                    )
                    .setEmoji(
                        '📖'
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );


    /* =========================================================================
       RECUPERAÇÃO DA MENSAGEM EXISTENTE
       ========================================================================= */

    const painelData =
        safeReadJson(
            painelPath
        ) || {};


    let painelMsg = null;


    /*
       Se já existe um messageId salvo,
       tenta encontrar essa mensagem no Discord.
    */
    if (painelData.messageId) {

        painelMsg =
            await canal.messages
                .fetch(
                    painelData.messageId
                )
                .catch(() => null);
    }


    /* =========================================================================
       PAYLOAD FINAL
       ========================================================================= */

    const payload = {

        /*
           Components V2 do Discord.
        */
        flags:
            MessageFlags.IsComponentsV2,

        /*
           Container principal + botões.
        */
        components: [
            containerPainel,
            row
        ]
    };


    /* =========================================================================
       ATUALIZA PAINEL EXISTENTE
       ========================================================================= */

    if (painelMsg) {

        await painelMsg.edit(
            payload
        );

        return painelMsg;
    }


    /* =========================================================================
       CRIA NOVO PAINEL
       ========================================================================= */

    const novaMensagem =
        await canal.send(
            payload
        );


    /* =========================================================================
       SALVA O ID DA NOVA MENSAGEM
       ========================================================================= */

    safeWriteJson(
        painelPath,
        {
            messageId:
                novaMensagem.id
        }
    );


    /* =========================================================================
       RETORNO
       ========================================================================= */

    return novaMensagem;
}
