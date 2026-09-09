
/* ============================================================================
   WORLDWARBR — AUTO RESPOSTA V8
   Inteligência conversacional + Liga das Nações + Olimpíadas.

   PRINCIPAIS CORREÇÕES DA V8:

   1. Cooldown só é registrado quando o bot realmente responde.
   2. Chance de resposta não bloqueia o cooldown indevidamente.
   3. Snapshot do ranking não é sobrescrito a cada mensagem.
   4. Snapshot só é criado no primeiro uso ou atualizado após uma análise
      real do ranking.
   5. Detecção de ultrapassagens foi corrigida.
   6. Busca de jogadores agora prioriza correspondência exata antes de
      procurar nomes parcialmente.
   7. Regex dos gatilhos curtos ficou protegida contra caracteres especiais.
   8. O identificador interno passou de V7 para V8.
   9. Limpeza periódica de mensagens processadas foi mantida.
   10. Sistema de pensamentos continua funcionando a cada 10 minutos.
   11. Liga das Nações, Olimpíadas, humor e respostas tradicionais continuam.
   12. Canais continuam sendo resolvidos dinamicamente dentro da categoria.
   ============================================================================ */

const {
    Events,
    ChannelType
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const estatisticasLiga =
    require('../liga/utils/estatisticasLiga.js');


/* ============================================================================
   CAMINHOS DOS ARQUIVOS
   ============================================================================ */

const dbPath =
    path.join(
        __dirname,
        'auto_respostas.json'
    );

const inteligenciaPath =
    path.join(
        __dirname,
        'auto_inteligencia.json'
    );

const olympPath =
    path.join(
        __dirname,
        '..',
        'olimpiadas',
        'olimpiadas.json'
    );


/* ============================================================================
   CONFIGURAÇÕES
   ============================================================================ */

const CONFIG = {

    /*
       Categoria onde o sistema pode funcionar.
    */
    categoriaId:
        '849698902634004510',

    /*
       Tempo mínimo entre respostas reais no mesmo canal.
    */
    cooldownCanalMs:
        60 * 1000,

    /*
       Chance de o bot tentar responder.
    */
    respostaChance:
        0.90,

    /*
       Pensamento automático a cada 10 minutos.
    */
    pensamentoIntervaloMs:
        10 * 60 * 1000,

    /*
       Quantidade máxima de jogadores no ranking interno.
    */
    maxRanking:
        50
};


/* ============================================================================
   MEMÓRIA DO BOT
   ============================================================================ */

const cooldown =
    new Map();

const ultimoModelo =
    new Map();

const contexto =
    new Map();

const mensagensProcessadas =
    new Set();

let clienteAtual =
    null;

let timer =
    null;


/* ============================================================================
   HUMOR
   ============================================================================ */

const HUMOR = {

    riso: [
        'KKKKKK aí você me quebra 😂',
        'KKKK isso já virou reunião de crise. 💀',
        'Eu não devia rir disso... mas ri. 🤣',
        'O servidor perdeu a seriedade oficialmente. 😂'
    ],

    derrota: [
        'Calma, comandante. Uma derrota não apaga a campanha. 🫡',
        'O dado hoje acordou com vontade de causar. 🎲💀',
        'Respira. A Liga ainda não acabou. 😭',
        'Até os melhores têm dia de desastre estratégico. 😂'
    ],

    vitoria: [
        'Aí sim! Agora quero ver repetir. 👀🏆',
        'GG! Vitória registrada. A confiança subiu, agora não deixa ela subir mais que os pontos. 😂',
        'Boa! O mapa sofreu mais uma derrota estratégica. 🌍🔥',
        'Comemora, mas lembra: o ranking tem memória. 😏'
    ],

    provocacao: [
        'Opa... senti cheiro de rivalidade. 👀',
        'Isso já parece começo de guerra diplomática. 😂',
        'Anotado. Vou guardar essa para a próxima atualização do ranking. 📝',
        'Fala baixo que o rival pode estar lendo. 👁️'
    ],

    incentivo: [
        'Ainda dá para virar. Uma partida muda muita coisa. 🔥',
        'Cabeça fria, estratégia e dado na mão. Bora. 🎲',
        'Não entrega a campanha agora. 🫡',
        'O ranking não é sentença; é convite para revanche. 🏆'
    ]
};


/* ============================================================================
   PENSAMENTOS AUTOMÁTICOS
   ============================================================================ */

const PENSAMENTOS = [

    '💭 **O QUE EU TÔ PENSANDO**\nSe o ranking está quieto demais, alguém provavelmente está planejando uma ultrapassagem. 👀',

    '💭 **O QUE EU TÔ PENSANDO**\nTem jogador olhando o ranking agora e fingindo que não está preocupado. 😂',

    '💭 **O QUE EU TÔ PENSANDO**\nNo War, às vezes o maior inimigo não é o adversário... é a confiança demais no dado. 🎲💀',

    '💭 **O QUE EU TÔ PENSANDO**\nUma diferença pequena de pontos hoje pode virar uma guerra pelo primeiro lugar amanhã. 🏆',

    '💭 **O QUE EU TÔ PENSANDO**\nQuem está em primeiro precisa olhar para trás. Quem está em segundo precisa olhar para frente. 👑',

    '💭 **O QUE EU TÔ PENSANDO**\nA Liga não esquece uma vitória, uma derrota nem aquela jogada que parecia genial. 😏',

    '💭 **O QUE EU TÔ PENSANDO**\nSerá que o líder consegue manter a liderança quando o próximo resultado cair? 👀',

    '💭 **O QUE EU TÔ PENSANDO**\nO melhor momento para estudar o rival é antes da próxima partida. 🧠⚔️',

    '💭 **O QUE EU TÔ PENSANDO**\nTem muita gente forte na Liga. O problema é que só um termina no topo. 🏆',

    '💭 **O QUE EU TÔ PENSANDO**\nSe eu fosse jogador, começaria a prestar atenção em quem está subindo rápido. 🚀',

    '💭 **O QUE EU TÔ PENSANDO**\nO ranking muda, as rivalidades crescem e eu continuo aqui observando tudo. 👁️',

    '💭 **O QUE EU TÔ PENSANDO**\nNas Olimpíadas, uma medalha pode mudar completamente a disputa entre os países. 🥇🌍',

    '💭 **O QUE EU TÔ PENSANDO**\nDuplas fortes não precisam só de sorte: precisam de sintonia. 🤝🔥',

    '💭 **O QUE EU TÔ PENSANDO**\nTem partida que é ganha no mapa. Tem partida que é ganha na cabeça. 🧠🎲'
];


/* ============================================================================
   JSON — LEITURA
   ============================================================================ */

function lerJson(
    file,
    fallback = {}
) {

    try {

        if (!fs.existsSync(file)) {
            return fallback;
        }

        const raw =
            fs.readFileSync(
                file,
                'utf8'
            );

        if (!raw.trim()) {
            return fallback;
        }

        const data =
            JSON.parse(raw);

        return (
            data &&
            typeof data === 'object'
        )
            ? data
            : fallback;

    } catch (e) {

        console.error(
            '[Auto-Resposta] JSON:',
            e.message
        );

        return fallback;
    }
}


/* ============================================================================
   JSON — SALVAMENTO
   ============================================================================ */

function salvarJson(
    file,
    data
) {

    try {

        fs.writeFileSync(
            file,
            JSON.stringify(
                data,
                null,
                2
            ),
            'utf8'
        );

    } catch (e) {

        console.error(
            '[Auto-Resposta] salvar JSON:',
            e.message
        );
    }
}


/* ============================================================================
   NORMALIZAÇÃO
   ============================================================================ */

function norm(value) {

    return String(
        value ?? ''
    )
        .normalize('NFD')
        .replace(
            /[\u0300-\u036f]/g,
            ''
        )
        .toLowerCase()
        .replace(
            /\s+/g,
            ' '
        )
        .trim();
}


/* ============================================================================
   NÚMERO
   ============================================================================ */

function num(value) {

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : 0;
}


/* ============================================================================
   FORMATAÇÃO
   ============================================================================ */

function fmt(value) {

    return num(value)
        .toLocaleString(
            'pt-BR'
        );
}


/* ============================================================================
   MENÇÃO
   ============================================================================ */

function mention(id) {

    return id
        ? `<@${String(id)}>`
        : 'esse jogador';
}


/* ============================================================================
   VERIFICAÇÃO DA CATEGORIA
   ============================================================================ */

function categoria(channel) {

    return String(
        channel?.parentId || ''
    ) === CONFIG.categoriaId;
}


/* ============================================================================
   ESCAPE DE REGEX
   ============================================================================ */

function escapeRegex(value) {

    return String(value)
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );
}


/* ============================================================================
   RESOLUÇÃO DOS CANAIS WAR
   ============================================================================ */

function canaisWar(guild) {

    if (!guild) {

        return {
            texto: null,
            voz: null
        };
    }


    const canais =
        [
            ...guild.channels.cache.values()
        ]
            .filter(
                c =>
                    String(
                        c.parentId || ''
                    ) === CONFIG.categoriaId
            );


    function pontuar(
        channel,
        palavras
    ) {

        const nome =
            norm(channel?.name);


        return palavras.reduce(
            (
                score,
                palavra,
                index
            ) => {

                return (
                    score +
                    (
                        nome.includes(
                            norm(palavra)
                        )
                            ? palavras.length - index
                            : 0
                    )
                );

            },
            0
        );
    }


    const textos =
        canais.filter(
            c =>
                c.type === ChannelType.GuildText ||
                c.type === ChannelType.GuildAnnouncement
        );


    const vozes =
        canais.filter(
            c =>
                c.type === ChannelType.GuildVoice ||
                c.type === ChannelType.GuildStageVoice
        );


    const texto =
        [...textos]
            .sort(
                (a, b) =>
                    pontuar(
                        b,
                        [
                            'war',
                            '🌍',
                            'partida',
                            'jogo'
                        ]
                    )
                    -
                    pontuar(
                        a,
                        [
                            'war',
                            '🌍',
                            'partida',
                            'jogo'
                        ]
                    )
                    ||
                    norm(a.name)
                        .localeCompare(
                            norm(b.name)
                        )
            )[0]
            || null;


    const voz =
        [...vozes]
            .sort(
                (a, b) =>
                    pontuar(
                        b,
                        [
                            'war',
                            '🌍',
                            'call',
                            'jogo'
                        ]
                    )
                    -
                    pontuar(
                        a,
                        [
                            'war',
                            '🌍',
                            'call',
                            'jogo'
                        ]
                    )
                    ||
                    norm(a.name)
                        .localeCompare(
                            norm(b.name)
                        )
            )[0]
            || null;


    return {
        texto,
        voz
    };
}


/* ============================================================================
   SUBSTITUIÇÃO DOS CANAIS
   ============================================================================ */

function substituirCanais(
    guild,
    resposta
) {

    if (
        !guild ||
        typeof resposta !== 'string'
    ) {
        return resposta;
    }


    const {
        texto,
        voz
    } =
        canaisWar(guild);


    return resposta

        .replace(
            /\{CANAL_TEXTO_WAR\}/g,
            texto
                ? `<#${texto.id}>`
                : '#🌍 • WAR'
        )

        .replace(
            /\{CANAL_VOZ_WAR\}/g,
            voz
                ? `<#${voz.id}>`
                : 'um canal de voz'
        )

        .replace(
            new RegExp(
                `<#${escapeRegex(CONFIG.categoriaId)}>`,
                'g'
            ),
            texto
                ? `<#${texto.id}>`
                : '#🌍 • WAR'
        );
}


/* ============================================================================
   CANAL DE PENSAMENTOS
   ============================================================================ */

function canalPensamentos(guild) {

    if (!guild) {
        return null;
    }


    const canais =
        [
            ...guild.channels.cache.values()
        ]
            .filter(
                c => {

                    if (
                        !(
                            c.type === ChannelType.GuildText ||
                            c.type === ChannelType.GuildAnnouncement
                        )
                    ) {
                        return false;
                    }


                    const nome =
                        norm(c.name);


                    return (
                        nome.includes(
                            'o que vc ta pensando'
                        ) ||

                        nome.includes(
                            'o que voce ta pensando'
                        ) ||

                        nome.includes(
                            'o que estou pensando'
                        ) ||

                        nome.includes(
                            'pensando do bot'
                        ) ||

                        nome.includes(
                            'pensamento do bot'
                        )
                    );
                }
            );


    return (
        canais.find(
            c =>
                String(
                    c.parentId || ''
                ) === CONFIG.categoriaId
        )
        ||
        canais[0]
        ||
        null
    );
}


/* ============================================================================
   VERIFICAÇÃO DE TERMOS
   ============================================================================ */

function tem(
    texto,
    termos
) {

    const t =
        norm(texto);


    return termos.some(
        term => {

            const x =
                norm(term);


            if (!x) {
                return false;
            }


            /*
               Termos muito curtos precisam ser palavras completas.
            */
            if (x.length <= 2) {

                const regex =
                    new RegExp(
                        `(^|\\s)${escapeRegex(x)}(?=\\s|$)`,
                        'i'
                    );

                return regex.test(t);
            }


            /*
               Para termos maiores,
               continua aceitando correspondência dentro da frase.
            */
            return t.includes(x);
        }
    );
}


/* ============================================================================
   ESCOLHA DE RESPOSTA SEM REPETIR A ÚLTIMA
   ============================================================================ */

function escolher(
    items,
    key = 'global'
) {

    if (
        !Array.isArray(items) ||
        !items.length
    ) {
        return '';
    }


    const ultimo =
        ultimoModelo.get(key);


    const pool =
        items.length > 1
            ? items.filter(
                x => x !== ultimo
            )
            : items;


    const valor =
        pool[
            Math.floor(
                Math.random() *
                pool.length
            )
        ]
        ||
        items[0];


    ultimoModelo.set(
        key,
        valor
    );


    return valor;
}


/* ============================================================================
   COOLDOWN — APENAS CONSULTA
   ============================================================================ */

function podeResponder(
    channelId
) {

    const id =
        String(channelId);


    const agora =
        Date.now();


    const ultimo =
        cooldown.get(id) || 0;


    return (
        agora - ultimo
    ) >= CONFIG.cooldownCanalMs;
}


/* ============================================================================
   COOLDOWN — REGISTRA RESPOSTA REAL
   ============================================================================ */

function registrarCooldown(
    channelId
) {

    cooldown.set(
        String(channelId),
        Date.now()
    );
}


/* ============================================================================
   PERFIL DA LIGA
   ============================================================================ */

function perfil(id) {

    try {

        return estatisticasLiga
            .calcularPerfil(
                String(id)
            );

    } catch {

        return null;
    }
}


/* ============================================================================
   RANKING DA LIGA
   ============================================================================ */

function ranking() {

    try {

        return estatisticasLiga
            .rankingPorPontos(
                CONFIG.maxRanking
            )
            || [];

    } catch {

        return [];
    }
}


/* ============================================================================
   RESUMO DA LIGA
   ============================================================================ */

function resumo() {

    try {

        return estatisticasLiga
            .resumoLiga()
            || {};

    } catch {

        return {};
    }
}


/* ============================================================================
   WINRATE
   ============================================================================ */

function winrate(j) {

    const partidas =
        num(j?.partidas);


    if (!partidas) {
        return 0;
    }


    return (
        num(j?.winrate)
        ||
        (
            num(j?.vitorias) /
            partidas
        ) * 100
    );
}


/* ============================================================================
   SALDO DE PONTOS
   ============================================================================ */

function saldo(j) {

    return (
        num(j?.pontosGanhos)
        -
        num(j?.pontosPerdidos)
    );
}


/* ============================================================================
   TEXTO DE STREAK
   ============================================================================ */

function streakTexto(j) {

    const atual =
        num(j?.streakAtual);

    const maior =
        num(j?.maiorStreak);


    if (atual >= 5) {

        return (
            `está em uma sequência MONSTRA de **${fmt(atual)} vitórias** 🔥🔥`
        );
    }


    if (atual >= 3) {

        return (
            `vem de **${fmt(atual)} vitórias seguidas** e está embalado 🔥`
        );
    }


    if (atual === 2) {

        return (
            'venceu as **2 últimas partidas** e começou a embalar 👀'
        );
    }


    if (atual === 1) {

        return (
            'venceu a partida mais recente e pode iniciar uma sequência'
        );
    }


    if (maior >= 3) {

        return (
            `já chegou a **${fmt(maior)} vitórias seguidas** anteriormente`
        );
    }


    return (
        'não está em sequência de vitórias no momento'
    );
}


/* ============================================================================
   RESOLVER JOGADOR
   ============================================================================

   Ordem:

   1. ID / menção
   2. username exato
   3. displayName exato
   4. globalName exato
   5. username parcial
   6. displayName parcial
   7. globalName parcial
   ============================================================================ */

async function resolverJogador(
    guild,
    valor
) {

    if (
        !guild ||
        !valor
    ) {
        return null;
    }


    const bruto =
        String(valor).trim();


    /*
       Tenta ID ou menção primeiro.
    */
    const idMatch =
        bruto.match(
            /<@!?(\d{15,25})>/
        );


    const id =
        idMatch?.[1]
        ||
        (
            /^\d{15,25}$/.test(bruto)
                ? bruto
                : null
        );


    if (id) {

        try {

            return await guild.members.fetch(
                id
            );

        } catch {
            // Continua para as buscas por nome.
        }
    }


    const alvo =
        norm(
            bruto.replace(
                /^@/,
                ''
            )
        );


    if (!alvo) {
        return null;
    }


    try {

        const membros =
            [...guild.members.cache.values()];


        /*
           1. Username exato
        */
        const usernameExato =
            membros.find(
                m =>
                    norm(
                        m.user.username
                    ) === alvo
            );


        if (usernameExato) {
            return usernameExato;
        }


        /*
           2. Display name exato
        */
        const displayExato =
            membros.find(
                m =>
                    norm(
                        m.displayName
                    ) === alvo
            );


        if (displayExato) {
            return displayExato;
        }


        /*
           3. Global name exato
        */
        const globalExato =
            membros.find(
                m =>
                    norm(
                        m.user.globalName
                    ) === alvo
            );


        if (globalExato) {
            return globalExato;
        }


        /*
           4. Username parcial
        */
        const usernameParcial =
            membros.find(
                m =>
                    norm(
                        m.user.username
                    ).includes(alvo)
            );


        if (usernameParcial) {
            return usernameParcial;
        }


        /*
           5. Display name parcial
        */
        const displayParcial =
            membros.find(
                m =>
                    norm(
                        m.displayName
                    ).includes(alvo)
            );


        if (displayParcial) {
            return displayParcial;
        }


        /*
           6. Global name parcial
        */
        const globalParcial =
            membros.find(
                m =>
                    norm(
                        m.user.globalName
                    ).includes(alvo)
            );


        return globalParcial || null;

    } catch {

        return null;
    }
}


/* ============================================================================
   MENCIONAR JOGADOR
   ============================================================================ */

async function mentionarJogador(
    guild,
    id
) {

    if (!id) {
        return 'esse jogador';
    }


    const membro =
        await resolverJogador(
            guild,
            String(id)
        );


    return membro
        ? `<@${membro.id}>`
        : mention(id);
}


/* ============================================================================
   EXTRAIR MENÇÕES
   ============================================================================ */

function extrairMencoes(
    message
) {

    return [
        ...message.mentions.users.values()
    ]
        .map(
            u => String(u.id)
        );
}


/* ============================================================================
   SNAPSHOT ANTERIOR
   ============================================================================ */

function snapshotAnterior() {

    return lerJson(
        inteligenciaPath,
        {}
    )
        .ultimaClassificacao
        || {};
}


/* ============================================================================
   MOVIMENTO DO RANKING
   ============================================================================

   Agora a ultrapassagem só existe quando:

   - A estava atrás de B anteriormente;
   - A está na frente de B agora.

   Exemplo:

   Antes:
       A = #5
       B = #3

   Agora:
       A = #2
       B = #4

   A realmente ultrapassou B.
   ============================================================================ */

function movimento() {

    const atual =
        ranking();

    const anterior =
        snapshotAnterior();


    const subindo = [];
    const caindo = [];
    const ultrapassagens = [];


    /*
       Detecta quem subiu ou caiu.
    */
    atual.forEach(
        (jogador, index) => {

            const old =
                anterior[
                    String(jogador.id)
                ];


            if (!old) {
                return;
            }


            const posicaoAtual =
                index + 1;


            const posicaoAnterior =
                num(old.posicao);


            const delta =
                posicaoAnterior -
                posicaoAtual;


            if (delta > 0) {

                subindo.push({
                    ...jogador,
                    de: posicaoAnterior,
                    para: posicaoAtual,
                    delta
                });

            }


            if (delta < 0) {

                caindo.push({
                    ...jogador,
                    de: posicaoAnterior,
                    para: posicaoAtual,
                    delta:
                        Math.abs(delta)
                });
            }
        }
    );


    /*
       Detecta ultrapassagens reais.
    */
    for (
        let i = 0;
        i < atual.length;
        i++
    ) {

        for (
            let j = i + 1;
            j < atual.length;
            j++
        ) {

            const a =
                atual[i];

            const b =
                atual[j];


            const pa =
                num(
                    anterior[
                        String(a.id)
                    ]?.posicao
                );


            const pb =
                num(
                    anterior[
                        String(b.id)
                    ]?.posicao
                );


            /*
               Atualmente A está na frente de B,
               portanto i < j.

               Anteriormente A estava atrás de B,
               portanto pa > pb.
            */
            if (
                pa > pb &&
                pa > 0 &&
                pb > 0
            ) {

                ultrapassagens.push({
                    a,
                    b,
                    aAnterior: pa,
                    bAnterior: pb,
                    aAtual: i + 1,
                    bAtual: j + 1
                });
            }
        }
    }


    return {
        atual,
        subindo,
        caindo,
        ultrapassagens
    };
}


/* ============================================================================
   SALVAR SNAPSHOT
   ============================================================================ */

function salvarSnapshot() {

    const r =
        ranking();


    if (!r.length) {
        return;
    }


    const db =
        lerJson(
            inteligenciaPath,
            {}
        );


    db.ultimaClassificacao =
        {};


    r.forEach(
        (jogador, index) => {

            db.ultimaClassificacao[
                String(jogador.id)
            ] = {

                posicao:
                    index + 1,

                pontos:
                    num(jogador.pontos)
            };
        }
    );


    db.atualizadoEm =
        new Date().toISOString();


    salvarJson(
        inteligenciaPath,
        db
    );
}


/* ============================================================================
   GARANTIR SNAPSHOT INICIAL
   ============================================================================

   Diferente da V7, não substitui um snapshot existente toda vez que o bot
   reinicia.

   Se não existir snapshot, cria um.
   ============================================================================ */

function garantirSnapshotInicial() {

    const db =
        lerJson(
            inteligenciaPath,
            {}
        );


    if (
        !db.ultimaClassificacao ||
        typeof db.ultimaClassificacao !== 'object' ||
        !Object.keys(
            db.ultimaClassificacao
        ).length
    ) {

        salvarSnapshot();
    }
}


/* ============================================================================
   MAIOR VALOR
   ============================================================================ */

function maiorPor(
    r,
    campo
) {

    return [
        ...r
    ]
        .sort(
            (a, b) =>
                num(b?.[campo])
                -
                num(a?.[campo])
        )[0]
        || null;
}


/* ============================================================================
   ANÁLISE DO RANKING
   ============================================================================ */

async function analiseRanking(
    guild
) {

    const r =
        ranking();


    if (!r.length) {

        return (
            '🏆 A Liga ainda está juntando dados. ' +
            'Assim que sair partida, eu começo a fofoca estatística. 👀'
        );
    }


    const m =
        movimento();


    const lider =
        r[0];

    const segundo =
        r[1];


    const up =
        [
            ...m.subindo
        ]
            .sort(
                (a, b) =>
                    b.delta -
                    a.delta
            )[0];


    const down =
        [
            ...m.caindo
        ]
            .sort(
                (a, b) =>
                    b.delta -
                    a.delta
            )[0];


    const over =
        m.ultrapassagens[0];


    const matador =
        maiorPor(
            r,
            'kills'
        );


    const ativo =
        maiorPor(
            r,
            'partidas'
        );


    const melhorWin =
        [
            ...r
        ]
            .filter(
                j =>
                    num(j.partidas) >= 3
            )
            .sort(
                (a, b) =>
                    winrate(b) -
                    winrate(a)
            )[0];


    const opcoes = [];


    if (over) {

        opcoes.push(
            `⚔️ **ULTRAPASSAGEM DETECTADA**\n` +
            `${await mentionarJogador(guild, over.a.id)} ` +
            `passou na frente de ` +
            `${await mentionarJogador(guild, over.b.id)}. ` +
            `O ranking começou a ficar pessoal. 👀`
        );
    }


    if (up) {

        opcoes.push(
            `📈 **QUEM ESTÁ SUBINDO?**\n` +
            `${await mentionarJogador(guild, up.id)} ` +
            `saltou do **#${up.de} para o #${up.para}**. ` +
            `${
                up.delta >= 3
                    ? 'Isso não foi subida, foi invasão do ranking. 🚀'
                    : 'Alguém acordou para a Liga. 🔥'
            }`
        );
    }


    if (down) {

        opcoes.push(
            `📉 **QUEDA DETECTADA**\n` +
            `${await mentionarJogador(guild, down.id)} ` +
            `caiu do **#${down.de} para o #${down.para}**. ` +
            `O mapa cobra caro por vacilo. 😬`
        );
    }


    if (segundo) {

        const gap =
            Math.abs(
                num(lider.pontos) -
                num(segundo.pontos)
            );


        opcoes.push(
            `👑 **BRIGA PELO TOPO**\n` +
            `${await mentionarJogador(guild, lider.id)} ` +
            `lidera com **${fmt(lider.pontos)} pts** e ` +
            `${await mentionarJogador(guild, segundo.id)} ` +
            `está a apenas **${fmt(gap)} pts**. ` +
            `Uma partida pode virar o roteiro. 🎬`
        );
    }


    if (matador) {

        opcoes.push(
            `💀 **ARTILHEIRO DA LIGA**\n` +
            `${await mentionarJogador(guild, matador.id)} ` +
            `é quem mais acumulou kills entre os jogadores do ranking: ` +
            `**${fmt(matador.kills)}**. ` +
            `Tem gente que joga para ganhar e tem gente que joga para apagar o mapa. 😂`
        );
    }


    if (melhorWin) {

        opcoes.push(
            `📊 **EFICIÊNCIA**\n` +
            `Com pelo menos 3 partidas, ` +
            `${await mentionarJogador(guild, melhorWin.id)} ` +
            `tem o melhor winrate atual: ` +
            `**${winrate(melhorWin).toFixed(1)}%**. ` +
            `Aproveitamento bonito de olhar. 👀`
        );
    }


    if (ativo) {

        opcoes.push(
            `🎮 **MAIS ATIVO**\n` +
            `${await mentionarJogador(guild, ativo.id)} ` +
            `já soma **${fmt(ativo.partidas)} partidas**. ` +
            `Esse aí não está só participando da Liga, está praticamente pagando aluguel no mapa. 😂`
        );
    }


    let resposta;


    if (opcoes.length) {

        resposta =
            escolher(
                opcoes,
                'analise-liga'
            );

    } else {

        resposta =
            `👑 ${await mentionarJogador(guild, lider.id)} ` +
            `está no topo com **${fmt(lider.pontos)} pts**. ` +
            `A Liga está quieta... quieta demais. 👀`;
    }


    /*
       O snapshot é atualizado somente depois de a análise ter sido
       calculada e pronta para ser entregue.

       Assim a próxima análise compara com esta classificação.
    */
    salvarSnapshot();


    return resposta;
}


/* ============================================================================
   RAIO-X DO JOGADOR
   ============================================================================ */

async function raioX(
    guild,
    id
) {

    const j =
        perfil(id);


    const tag =
        await mentionarJogador(
            guild,
            id
        );


    if (!j) {

        return (
            `🔎 Ainda não encontrei histórico suficiente de ${tag} na Liga.`
        );
    }


    const r =
        ranking();


    const pos =
        r.findIndex(
            x =>
                String(x.id) ===
                String(id)
        ) + 1;


    const m =
        movimento();


    const up =
        m.subindo.find(
            x =>
                String(x.id) ===
                String(id)
        );


    const down =
        m.caindo.find(
            x =>
                String(x.id) ===
                String(id)
        );


    const leitura =
        up
            ? `subindo **${fmt(up.delta)} posição(ões)**`
            : down
                ? `caindo **${fmt(down.delta)} posição(ões)**`
                : 'mantendo a posição observada';


    return [

        `🔎 **RAIO-X DA LIGA — ${tag}**`,

        `🏅 Posição: **#${pos || '—'}** • **${fmt(j.pontos)} pts**`,

        `🏆 **${fmt(j.vitorias)} vitórias** em **${fmt(j.partidas)} partidas** • Winrate **${winrate(j).toFixed(1)}%**`,

        `💀 **${fmt(j.kills)} kills** • **${fmt(j.mortes)} mortes**`,

        `📈 Momento: **${leitura}** • Saldo de pontos: **${fmt(saldo(j))}**`,

        `🔥 ${tag} ${streakTexto(j)}.`
    ].join('\n');
}


/* ============================================================================
   COMPARAÇÃO ENTRE DOIS JOGADORES
   ============================================================================ */

async function comparar(
    guild,
    a,
    b
) {

    const r =
        ranking();


    const ma =
        await mentionarJogador(
            guild,
            a.id
        );


    const mb =
        await mentionarJogador(
            guild,
            b.id
        );


    const pa =
        r.findIndex(
            x =>
                String(x.id) ===
                String(a.id)
        ) + 1;


    const pb =
        r.findIndex(
            x =>
                String(x.id) ===
                String(b.id)
        ) + 1;


    const diff =
        num(a.pontos) -
        num(b.pontos);


    const vr =
        winrate(a) -
        winrate(b);


    const lider =
        diff > 0
            ? ma
            : diff < 0
                ? mb
                : null;


    const leitura =
        diff === 0

            ? `estão empatados em **${fmt(a.pontos)} pts**`

            : `${lider} está na frente por **${fmt(Math.abs(diff))} pts**`;


    return (
        `⚔️ **DUELO DA LIGA**\n` +

        `${ma} **#${pa || '—'}** x ` +
        `${mb} **#${pb || '—'}**\n` +

        `${leitura}.\n` +

        `🏆 Vitórias: **${fmt(a.vitorias)} x ${fmt(b.vitorias)}**\n` +

        `💀 Kills: **${fmt(a.kills)} x ${fmt(b.kills)}**\n` +

        `📈 Winrate: **${winrate(a).toFixed(1)}% x ${winrate(b).toFixed(1)}%**\n` +

        `💡 ${
            vr === 0
                ? 'Nos números de aproveitamento, estão iguais.'
                : `${vr > 0 ? ma : mb} leva a melhor no aproveitamento.`
        }`
    );
}


/* ============================================================================
   OLIMPÍADAS — DADOS
   ============================================================================ */

function dadosOlimpiadas() {

    const d =
        lerJson(
            olympPath,
            {}
        );


    if (
        !Array.isArray(
            d.duplas
        )
    ) {
        d.duplas = [];
    }


    if (
        !Array.isArray(
            d.resultados
        )
    ) {
        d.resultados = [];
    }


    return d;
}


/* ============================================================================
   OLIMPÍADAS — RANKING
   ============================================================================ */

function rankingOlimpiadas() {

    const d =
        dadosOlimpiadas();


    const duplas =
        new Map(
            d.duplas.map(
                x =>
                    [
                        String(x.id),
                        x
                    ]
            )
        );


    const mapa =
        new Map();


    for (
        const resultado
        of d.resultados
    ) {

        for (
            const [
                id,
                medalha
            ]
            of [
                [
                    resultado?.ouro,
                    'ouro'
                ],
                [
                    resultado?.prata,
                    'prata'
                ],
                [
                    resultado?.bronze,
                    'bronze'
                ]
            ]
        ) {

            if (!id) {
                continue;
            }


            const dupla =
                duplas.get(
                    String(id)
                );


            if (!dupla?.pais) {
                continue;
            }


            const chave =
                norm(
                    dupla.pais
                );


            if (!mapa.has(chave)) {

                mapa.set(
                    chave,
                    {
                        pais:
                            dupla.pais,

                        vitorias:
                            0,

                        ouro:
                            0,

                        prata:
                            0,

                        bronze:
                            0
                    }
                );
            }


            const item =
                mapa.get(chave);


            item[medalha]++;


            if (
                medalha === 'ouro'
            ) {
                item.vitorias++;
            }
        }
    }


    return [
        ...mapa.values()
    ]
        .sort(
            (a, b) =>
                b.vitorias -
                a.vitorias
                ||
                b.ouro -
                a.ouro
                ||
                b.prata -
                a.prata
                ||
                b.bronze -
                a.bronze
        );
}


/* ============================================================================
   PONTOS OLÍMPICOS
   ============================================================================ */

function pontosOlimpicos(x) {

    return (
        num(x?.ouro) * 3
        +
        num(x?.prata) * 2
        +
        num(x?.bronze)
    );
}


/* ============================================================================
   FORMATAR DUPLA
   ============================================================================ */

async function formatarDupla(
    guild,
    dupla
) {

    if (!dupla) {
        return '';
    }


    return (
        `${await mentionarJogador(guild, dupla.jogador1)} + ` +
        `${await mentionarJogador(guild, dupla.jogador2)}`
    );
}


/* ============================================================================
   OLIMPÍADAS — RESPOSTA
   ============================================================================ */

async function olimp(
    guild
) {

    const d =
        dadosOlimpiadas();


    const r =
        rankingOlimpiadas();


    if (!r.length) {

        return (
            '🥇 **OLIMPÍADAS DE DUPLAS**\n' +
            'Ainda não tem resultado suficiente para eu começar a provocar os países. 😂'
        );
    }


    const l =
        r[0];


    const s =
        r[1];


    const pts =
        pontosOlimpicos(l);


    const dupla =
        d.duplas.find(
            x =>
                norm(x.pais) ===
                norm(l.pais)
        );


    const duplaTexto =
        await formatarDupla(
            guild,
            dupla
        );


    return escolher(

        [

            `🥇 **OLIMPÍADAS DE DUPLAS**\n` +
            `${l.pais} lidera com **${pts} pts olímpicos** — ` +
            `🥇 ${l.ouro} • 🥈 ${l.prata} • 🥉 ${l.bronze}. ` +
            `${
                s
                    ? `${s.pais} está na perseguição.`
                    : 'Ainda não apareceu um perseguidor forte.'
            } 👀`,

            `🏅 **DISPUTA OLÍMPICA**\n` +
            `${l.pais} está na frente. ` +
            `${
                duplaTexto
                    ? `A dupla responsável: ${duplaTexto}.`
                    : ''
            } ` +
            `Agora quero ver quem vai tirar essa liderança. 🔥`,

            `🌍 **PLACAR DAS DUPLAS**\n` +
            `${l.pais}: **${pts} pts** • ` +
            `🥇 ${l.ouro} • 🥈 ${l.prata} • 🥉 ${l.bronze}\n` +
            `Duplas registradas: **${fmt(d.duplas.length)}** • ` +
            `Resultados: **${fmt(d.resultados.length)}** 🏆`

        ],

        'olimpiadas'
    );
}


/* ============================================================================
   CONTEXTO DA CONVERSA
   ============================================================================ */

function salvarContexto(
    message
) {

    contexto.set(
        String(message.channelId),
        {

            autorId:
                String(
                    message.author?.id || ''
                ),

            texto:
                String(
                    message.content || ''
                ).slice(
                    0,
                    180
                ),

            quando:
                Date.now()
        }
    );
}


/* ============================================================================
   FOLLOW-UP
   ============================================================================ */

function temFollowUp(
    texto
) {

    return tem(
        texto,
        [
            'e agora',
            'entao',
            'então',
            'e ai',
            'e aí',
            'agora',
            'e depois'
        ]
    );
}


/* ============================================================================
   RESPOSTA INTELIGENTE
   ============================================================================ */

async function respostaInteligente(
    message
) {

    const texto =
        String(
            message.content || ''
        );


    const t =
        norm(texto);


    const guild =
        message.guild;


    const mencoes =
        extrairMencoes(
            message
        );


    const r =
        ranking();


    /*
       Comparação entre dois jogadores.
    */
    if (
        mencoes.length >= 2
        &&
        tem(
            t,
            [
                'vs',
                'versus',
                'contra',
                'comparar',
                'duelo',
                'quem e melhor',
                'quem ganha',
                'melhor que'
            ]
        )
    ) {

        const a =
            perfil(
                mencoes[0]
            );


        const b =
            perfil(
                mencoes[1]
            );


        if (a && b) {

            return comparar(
                guild,
                a,
                b
            );
        }
    }


    /*
       Estatísticas de jogador.
    */
    if (
        mencoes.length >= 1
        &&
        tem(
            t,
            [
                'pontos',
                'pontuacao',
                'pontuação',
                'estatistica',
                'estatísticas',
                'stats',
                'raio x',
                'desempenho'
            ]
        )
    ) {

        return raioX(
            guild,
            mencoes[0]
        );
    }


    /*
       Sequência de vitórias.
    */
    if (
        tem(
            t,
            [
                'sequencia',
                'sequência',
                'vitórias seguidas',
                'streak',
                'embalado'
            ]
        )
    ) {

        const alvo =
            mencoes[0]
            ||
            String(
                message.author?.id || ''
            );


        const j =
            perfil(alvo);


        if (j) {

            return (
                `🔥 ${await mentionarJogador(guild, alvo)} ` +
                `${streakTexto(j)}.`
            );
        }
    }


    /*
       Ranking.
    */
    if (
        tem(
            t,
            [
                'quem esta subindo',
                'quem está subindo',
                'subindo no ranking',
                'quem subiu',
                'quem caiu',
                'caindo',
                'ultrapassagem',
                'ultrapassou',
                'ranking',
                'lider',
                'líder'
            ]
        )
    ) {

        return analiseRanking(
            guild
        );
    }


    /*
       Olimpíadas.
    */
    if (
        tem(
            t,
            [
                'olimpiada',
                'olimpíada',
                'olimpiadas',
                'olimpíadas',
                'duplas',
                'medalha',
                'ouro',
                'prata',
                'bronze'
            ]
        )
    ) {

        return olimp(
            guild
        );
    }


    /*
       Liga das Nações.
    */
    if (
        tem(
            t,
            [
                'liga',
                'liga das nacoes',
                'liga das nações',
                'pontuacao da liga',
                'pontuação da liga',
                'classificacao',
                'classificação',
                'temporada'
            ]
        )
    ) {

        if (r.length) {

            const s =
                resumo();


            const l =
                r[0];


            const segundo =
                r[1];


            const lt =
                await mentionarJogador(
                    guild,
                    l.id
                );


            const st =
                segundo
                    ? await mentionarJogador(
                        guild,
                        segundo.id
                    )
                    : null;


            const gap =
                segundo
                    ? Math.abs(
                        num(l.pontos) -
                        num(segundo.pontos)
                    )
                    : 0;


            return escolher(

                [

                    `🏆 **LIGA DAS NAÇÕES**\n` +
                    `${lt} lidera com **${fmt(l.pontos)} pts**.` +
                    `${
                        st
                            ? ` ${st} está a **${fmt(gap)} pts**.`
                            : ''
                    }\n` +
                    `📊 ${
                        s.partidas
                            ? `A temporada já tem **${fmt(s.partidas)} partidas**.`
                            : 'A temporada ainda está começando.'
                    } 👀`,

                    `📊 Dei uma olhada na Liga. ` +
                    `${lt} está no topo, ` +
                    `${
                        st
                            ? `${st} está na cola e a diferença é de só **${fmt(gap)} pts**.`
                            : 'mas ainda falta alguém apertar a liderança.'
                    } ` +
                    `O ranking pode virar a qualquer momento. 😂`,

                    `🔥 **TERMÔMETRO DA LIGA**\n` +
                    `Topo: ${lt} • **${fmt(l.pontos)} pts**\n` +
                    `${
                        st
                            ? `Perseguidor: ${st} • **${fmt(segundo.pontos)} pts**`
                            : 'Perseguidor: ainda indefinido'
                    }\n` +
                    `Agora é ver quem aguenta a pressão.`

                ],

                'liga-geral'
            );
        }
    }


    /*
       Melhor jogador.
    */
    if (
        tem(
            t,
            [
                'quem e o melhor',
                'quem é o melhor',
                'melhor jogador',
                'melhor da liga',
                'quem esta bem',
                'quem está bem'
            ]
        )
    ) {

        if (r.length) {

            const melhor =
                [
                    ...r
                ]
                    .filter(
                        j =>
                            num(j.partidas) >= 3
                    )
                    .sort(
                        (a, b) =>
                            num(b.pontos) -
                            num(a.pontos)
                            ||
                            winrate(b) -
                            winrate(a)
                    )[0]
                    ||
                    r[0];


            return (
                `👑 Pelos números atuais da Liga, ` +
                `${await mentionarJogador(guild, melhor.id)} ` +
                `está entre os nomes mais fortes: ` +
                `**${fmt(melhor.pontos)} pts**, ` +
                `**${fmt(melhor.vitorias)} vitórias** e ` +
                `**${winrate(melhor).toFixed(1)}% de winrate**. ` +
                `Mas melhor mesmo? Isso a próxima partida decide. 😏`
            );
        }
    }


    /*
       Follow-up da conversa.
    */
    if (
        temFollowUp(texto)
    ) {

        const ctx =
            contexto.get(
                String(
                    message.channelId
                )
            );


        if (
            ctx
            &&
            Date.now() -
            ctx.quando
            <
            5 * 60 * 1000
        ) {

            const p =
                perfil(
                    ctx.autorId
                );


            if (p) {

                return (
                    `👀 E agora? ` +
                    `${await mentionarJogador(guild, ctx.autorId)} ` +
                    `continua com **${fmt(p.pontos)} pts** na Liga. ` +
                    `O próximo capítulo depende do dado. 🎲`
                );
            }
        }
    }


    return null;
}


/* ============================================================================
   RESPOSTA TRADICIONAL
   ============================================================================ */

async function tradicional(
    texto,
    guild
) {

    const db =
        lerJson(
            dbPath,
            {}
        );


    if (
        !db ||
        typeof db !== 'object'
    ) {

        return null;
    }


    const candidatas = [];


    const t =
        norm(texto);


    for (
        const [
            chave,
            respostas
        ]
        of Object.entries(db)
    ) {

        const gatilhos =
            [
                chave
            ];


        if (
            Array.isArray(
                respostas
            )
        ) {

            for (
                const item
                of respostas
            ) {

                if (
                    item &&
                    typeof item === 'object'
                ) {

                    if (
                        Array.isArray(
                            item.gatilhos
                        )
                    ) {

                        gatilhos.push(
                            ...item.gatilhos
                        );
                    }


                    if (
                        Array.isArray(
                            item.palavras
                        )
                    ) {

                        gatilhos.push(
                            ...item.palavras
                        );
                    }
                }
            }
        }


        const encontrados =
            gatilhos.filter(
                g =>
                    tem(
                        t,
                        [g]
                    )
            );


        if (
            encontrados.length
        ) {

            candidatas.push({

                chave,

                respostas,

                peso:
                    encontrados.reduce(
                        (
                            n,
                            g
                        ) =>
                            n +
                            norm(g).length,
                        0
                    )
            });
        }
    }


    candidatas.sort(
        (a, b) =>
            b.peso -
            a.peso
    );


    const melhor =
        candidatas[0];


    if (!melhor) {
        return null;
    }


    let resposta =
        null;


    if (
        Array.isArray(
            melhor.respostas
        )
    ) {

        resposta =
            escolher(

                melhor.respostas

                    .map(
                        x =>
                            typeof x === 'string'
                                ? x
                                : x?.resposta
                    )

                    .filter(Boolean),

                `tradicional-${melhor.chave}`
            );

    } else if (
        typeof melhor.respostas === 'string'
    ) {

        resposta =
            melhor.respostas;
    }


    return substituirCanais(
        guild,
        resposta
    );
}


/* ============================================================================
   HUMOR
   ============================================================================ */

function humor(texto) {

    if (
        tem(
            texto,
            [
                'kkkk',
                'kkk',
                'haha',
                'hahaha',
                'rsrs',
                '🤣',
                '😂'
            ]
        )
    ) {

        return escolher(
            HUMOR.riso,
            'humor-riso'
        );
    }


    if (
        tem(
            texto,
            [
                'perdi',
                'perdeu',
                'derrota',
                'perder',
                'fui derrotado',
                'morreu'
            ]
        )
    ) {

        return escolher(
            HUMOR.derrota,
            'humor-derrota'
        );
    }


    if (
        tem(
            texto,
            [
                'ganhei',
                'ganhou',
                'venci',
                'venceu',
                'vitória',
                'vitoria',
                'win'
            ]
        )
    ) {

        return escolher(
            HUMOR.vitoria,
            'humor-vitoria'
        );
    }


    if (
        tem(
            texto,
            [
                'traidor',
                'traiu',
                'rival',
                'inimigo',
                'vou pegar',
                'vou atacar'
            ]
        )
    ) {

        return escolher(
            HUMOR.provocacao,
            'humor-provocacao'
        );
    }


    if (
        tem(
            texto,
            [
                'desistir',
                'desisti',
                'não consigo',
                'nao consigo',
                'triste',
                'azar'
            ]
        )
    ) {

        return escolher(
            HUMOR.incentivo,
            'humor-incentivo'
        );
    }


    return null;
}


/* ============================================================================
   ENVIAR PENSAMENTO
   ============================================================================ */

async function enviarPensamento() {

    if (!clienteAtual) {
        return;
    }


    try {

        for (
            const guild
            of clienteAtual.guilds.cache.values()
        ) {

            const canal =
                canalPensamentos(
                    guild
                );


            if (
                !canal ||
                !canal.isTextBased?.()
            ) {
                continue;
            }


            const rankingAtual =
                ranking();


            let pensamento =
                escolher(
                    PENSAMENTOS,
                    `pensamento-${guild.id}`
                );


            if (
                rankingAtual.length
            ) {

                const lider =
                    rankingAtual[0];


                const segundo =
                    rankingAtual[1];


                const extras = [

                    `💭 **O QUE EU TÔ PENSANDO**\n` +
                    `${await mentionarJogador(guild, lider.id)} ` +
                    `está no topo com **${fmt(lider.pontos)} pts**. ` +
                    `Será que aguenta mais uma rodada? 👀`,

                    `💭 **O QUE EU TÔ PENSANDO**\n` +
                    `A diferença entre ` +
                    `${await mentionarJogador(guild, lider.id)} ` +
                    `e ` +
                    `${
                        segundo
                            ? await mentionarJogador(guild, segundo.id)
                            : 'o próximo colocado'
                    } ` +
                    `pode virar em uma única partida. 🏆`,

                    `💭 **O QUE EU TÔ PENSANDO**\n` +
                    `Tem alguém subindo no ranking e provavelmente ` +
                    `o resto ainda não percebeu. 🚀👀`
                ];


                pensamento =
                    escolher(
                        [
                            ...PENSAMENTOS,
                            ...extras
                        ],
                        `pensamento-${guild.id}`
                    );
            }


            await canal.send(
                substituirCanais(
                    guild,
                    pensamento
                )
            );
        }

    } catch (e) {

        console.error(
            '[Auto-Resposta] pensamento:',
            e.message
        );
    }
}


/* ============================================================================
   AGENDAMENTO DOS PENSAMENTOS
   ============================================================================ */

function agendarPensamento() {

    if (timer) {

        clearTimeout(
            timer
        );
    }


    timer =
        setTimeout(
            async () => {

                await enviarPensamento();

                agendarPensamento();

            },
            CONFIG.pensamentoIntervaloMs
        );
}


/* ============================================================================
   INICIALIZAÇÃO PRINCIPAL
   ============================================================================ */

module.exports =
    function iniciarAutoResposta(
        client
    ) {

        if (!client) {
            return;
        }


        /*
           V8 impede que o módulo seja registrado duas vezes.
        */
        if (
            client.__worldwarAutoResponseV8
        ) {
            return;
        }


        client.__worldwarAutoResponseV8 =
            true;


        clienteAtual =
            client;


        /* =====================================================================
           EVENTO: NOVA MENSAGEM
           ===================================================================== */

        client.on(
            Events.MessageCreate,
            async message => {

                try {

                    /*
                       Ignora:

                       - mensagens fora de guild;
                       - mensagens de bots;
                       - mensagens fora da categoria.
                    */
                    if (
                        !message.guild ||
                        message.author?.bot ||
                        !categoria(
                            message.channel
                        )
                    ) {

                        return;
                    }


                    /*
                       Evita processamento duplicado.
                    */
                    if (
                        mensagensProcessadas.has(
                            message.id
                        )
                    ) {

                        return;
                    }


                    mensagensProcessadas.add(
                        message.id
                    );


                    /*
                       Remove a mensagem da memória depois de 2 minutos.
                    */
                    setTimeout(
                        () =>
                            mensagensProcessadas.delete(
                                message.id
                            ),
                        2 * 60 * 1000
                    );


                    /*
                       Guarda contexto para possíveis follow-ups.
                    */
                    salvarContexto(
                        message
                    );


                    /*
                       Chance de resposta.

                       IMPORTANTE:
                       não registra cooldown aqui.
                    */
                    if (
                        Math.random() >
                        CONFIG.respostaChance
                    ) {

                        return;
                    }


                    /*
                       Se o canal ainda estiver em cooldown,
                       não responde.
                    */
                    if (
                        !podeResponder(
                            message.channelId
                        )
                    ) {

                        return;
                    }


                    /* =========================================================
                       PRIORIDADE 1 — INTELIGÊNCIA
                       ========================================================= */

                    const inteligente =
                        await respostaInteligente(
                            message
                        );


                    if (inteligente) {

                        await message.reply(
                            substituirCanais(
                                message.guild,
                                inteligente
                            )
                        );


                        /*
                           Só agora o cooldown é registrado,
                           porque houve resposta real.
                        */
                        registrarCooldown(
                            message.channelId
                        );


                        return;
                    }


                    /* =========================================================
                       PRIORIDADE 2 — HUMOR
                       ========================================================= */

                    const engraçada =
                        humor(
                            message.content
                        );


                    if (engraçada) {

                        await message.reply(
                            substituirCanais(
                                message.guild,
                                engraçada
                            )
                        );


                        registrarCooldown(
                            message.channelId
                        );


                        return;
                    }


                    /* =========================================================
                       PRIORIDADE 3 — RESPOSTAS TRADICIONAIS
                       ========================================================= */

                    const antiga =
                        await tradicional(
                            message.content,
                            message.guild
                        );


                    if (antiga) {

                        await message.reply(
                            String(antiga)
                        );


                        registrarCooldown(
                            message.channelId
                        );


                        return;
                    }

                } catch (e) {

                    console.error(
                        '[Auto-Resposta] MessageCreate:',
                        e.message
                    );
                }
            }
        );


        /* =====================================================================
           EVENTO: BOT PRONTO
           ===================================================================== */

        client.once(
            Events.ClientReady,
            () => {

                console.log(
                    '🤖 Auto Resposta V8 ativada — Liga das Nações + Olimpíadas + canais dinâmicos + pensamentos a cada 10 minutos.'
                );


                /*
                   Cria snapshot apenas se ainda não existir.
                   Não sobrescreve o histórico toda vez que o bot reinicia.
                */
                garantirSnapshotInicial();


                /*
                   Inicia os pensamentos automáticos.
                */
                agendarPensamento();
            }
        );
    }
