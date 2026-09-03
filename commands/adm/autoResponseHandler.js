/* ========================================================================
   WORLDWARBR — AUTO RESPOSTA INTELIGENTE

   Integração com:
   - Liga das Nações
   - Olimpíadas de Duplas

   A automação só funciona em canais pertencentes à categoria configurada.
   Além das respostas tradicionais do auto_respostas.json, este módulo:
   - entende palavras-chave e intenções;
   - consulta os dados atuais da Liga/Olimpíadas;
   - gera comentários dinâmicos sobre ranking, pontos, vitórias e medalhas;
   - publica mensagens espontâneas em intervalos aleatórios;
   - evita spam e repetição imediata.
   ======================================================================== */

const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');
const estatisticasLiga = require('../liga/utils/estatisticasLiga.js');

const dbPath = path.join(__dirname, 'auto_respostas.json');
const olympPath = path.join(__dirname, '..', 'olimpiadas', 'olimpiadas.json');

const CONFIG = {
    categoriaId: '849698902634004510',
    // Intervalo espontâneo: 10 a 30 minutos.
    intervaloMinMs: 10 * 60 * 1000,
    intervaloMaxMs: 30 * 60 * 1000,
    // Evita responder repetidamente no mesmo canal.
    cooldownCanalMs: 90 * 1000,
    // Chance de uma mensagem espontânea ser Liga/Olimpíadas.
    chanceOlimpiadas: 0.45,
    // Chance de uma palavra-chave gerar resposta inteligente.
    chanceRespostaInteligente: 0.72
};

const cooldownCanais = new Map();
const ultimaEspontanea = new Map();
const ultimoModelo = new Map();
let timerEspontaneo = null;
let clienteAtual = null;

function lerJson(caminho, fallback = {}) {
    try {
        if (!fs.existsSync(caminho)) return fallback;
        const bruto = fs.readFileSync(caminho, 'utf8');
        if (!bruto.trim()) return fallback;
        const dados = JSON.parse(bruto);
        return dados && typeof dados === 'object' ? dados : fallback;
    } catch (erro) {
        console.error('[Auto-Resposta] Erro lendo JSON:', caminho, erro.message);
        return fallback;
    }
}

function normalizar(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function escaparRegExp(valor) {
    return String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function contemPalavra(texto, palavra) {
    const termo = normalizar(palavra);
    if (!termo) return false;
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaparRegExp(termo)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(normalizar(texto));
}

function estaNaCategoria(channel) {
    return String(channel?.parentId || '') === CONFIG.categoriaId;
}

function podeResponderNoCanal(channelId) {
    const agora = Date.now();
    const ultimo = cooldownCanais.get(String(channelId)) || 0;
    if (agora - ultimo < CONFIG.cooldownCanalMs) return false;
    cooldownCanais.set(String(channelId), agora);
    return true;
}

function escolher(lista, chave = 'global') {
    if (!Array.isArray(lista) || !lista.length) return null;

    const anterior = ultimoModelo.get(chave);
    let candidatos = lista;
    if (lista.length > 1 && anterior) {
        candidatos = lista.filter(item => item !== anterior);
        if (!candidatos.length) candidatos = lista;
    }

    const item = candidatos[Math.floor(Math.random() * candidatos.length)];
    ultimoModelo.set(chave, item);
    return item;
}

function limparNome(nome) {
    return String(nome || '').replace(/[<>`]/g, '').trim() || 'jogador';
}

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function formatarPontos(valor) {
    return numero(valor).toLocaleString('pt-BR');
}

function diferenca(a, b) {
    return Math.abs(numero(a) - numero(b));
}

function perfilLiga(id) {
    try {
        return estatisticasLiga.calcularPerfil(String(id));
    } catch {
        return null;
    }
}

function rankingLiga() {
    try {
        return estatisticasLiga.rankingPorPontos(50) || [];
    } catch (erro) {
        console.error('[Auto-Resposta] Erro no ranking da Liga:', erro.message);
        return [];
    }
}

function dadosOlimpiadas() {
    const dados = lerJson(olympPath, {});
    if (!Array.isArray(dados.duplas)) dados.duplas = [];
    if (!Array.isArray(dados.resultados)) dados.resultados = [];
    if (!dados.ranking || typeof dados.ranking !== 'object') dados.ranking = {};
    return dados;
}

function estatisticasOlimpiadas() {
    const dados = dadosOlimpiadas();
    const ranking = dados.ranking || {};
    const entradas = Object.entries(ranking).map(([pais, item]) => ({
        pais,
        ...(item && typeof item === 'object' ? item : { pontos: numero(item) })
    }));

    const medalhas = dados.resultados.reduce((acc, resultado) => {
        const colocacoes = [
            ['ouro', resultado.ouro || resultado.vencedor || resultado.primeiro],
            ['prata', resultado.prata || resultado.segundo],
            ['bronze', resultado.bronze || resultado.terceiro]
        ];
        for (const [tipo, pais] of colocacoes) {
            if (pais) {
                const chave = String(pais);
                if (!acc[chave]) acc[chave] = { ouro: 0, prata: 0, bronze: 0 };
                acc[chave][tipo]++;
            }
        }
    }, {});

    // Se o ranking já possuir medalhas, elas têm prioridade.
    for (const entrada of entradas) {
        const atual = medalhas[entrada.pais] || { ouro: 0, prata: 0, bronze: 0 };
        atual.ouro = numero(entrada.ouro ?? entrada.ouros ?? atual.ouro);
        atual.prata = numero(entrada.prata ?? entradas.pratas ?? atual.prata);
        atual.bronze = numero(entrada.bronze ?? entrada.bronzes ?? atual.bronze);
        medalhas[entrada.pais] = atual;
    }

    return { dados, ranking: entradas, medalhas };
}

function mencionarJogador(id) {
    return id ? `<@${String(id)}>` : 'um competidor';
}

/* ========================================================================
   20 RESPOSTAS INTELIGENTES — LIGA
   ======================================================================== */

const LIGA_MODELOS = [
    '👑 **DISPUTA PELO TOPO**\n{lider} está liderando a Liga com **{pontos} pts**. O segundo colocado está a apenas **{dif} pontos**. A liderança ainda está em jogo. ⚔️',
    '🔥 **RANKING DA LIGA**\nO topo está nas mãos de {lider} com **{pontos} pts**. Logo atrás vem {segundo} com **{pontos2} pts**. Essa diferença de **{dif}** pode desaparecer em uma boa partida.',
    '📈 **QUEM ESTÁ SUBINDO?**\n{melhor} já acumula **{pontos} pts**, com **{vitorias} vitórias** e **{kills} kills**. É um nome que merece atenção no próximo confronto.',
    '⚔️ **CAÇADA AO LÍDER**\n{segundo} precisa de apenas **{dif} pontos** para alcançar {lider}. Uma vitória pode mudar completamente a ordem do ranking.',
    '💀 **PODER DE FOGO**\n{kill} está liderando em kills com **{kills} eliminações**. Pontuação não é só vitória: combate também pesa na Liga.',
    '🏆 **CONSISTÊNCIA**\n{vencedor} já soma **{vitorias} vitórias**. Quem consegue manter esse ritmo começa a construir uma campanha difícil de alcançar.',
    '📊 **OLHA ESSE NÚMERO**\nA Liga já registra **{partidas} partidas**, **{jogadores} jogadores** e **{killsTotal} kills**. A temporada está ficando cada vez mais disputada.',
    '🧠 **ESTRATÉGIA IMPORTA**\nCom a pontuação atual, {lider} tem **{pontos} pts**. O próximo jogador precisa de **{dif} pts** para assumir a liderança.',
    '⚡ **MOMENTO DA LIGA**\n{lider} está no topo, mas {terceiro} ainda está na briga. Os três primeiros estão separados por apenas **{topDif} pontos**.',
    '🎯 **EFICIÊNCIA**\n{eficiente} tem **{vitorias} vitórias** em **{partidasJogador} partidas**. Uma campanha assim chama atenção no ranking.',
    '🌎 **DOMÍNIO TERRITORIAL**\n{continente} aparece como um dos focos fortes da Liga, com **{valorContinente} conquistas** registradas pelos competidores.',
    '📉 **NINGUÉM ESTÁ SEGURO**\nMesmo quem está no topo precisa continuar pontuando. A diferença atual para o segundo colocado é de **{dif} pontos**.',
    '🔥 **OLHO NO TOP 3**\n{lider} lidera com **{pontos}**, {segundo} vem com **{pontos2}** e {terceiro} aparece com **{pontos3}**. O pódio está formado, mas não está garantido.',
    '⚔️ **UMA PARTIDA MUDA TUDO**\nCom apenas **{dif} pontos** separando os dois primeiros, qualquer resultado relevante pode reorganizar a classificação.',
    '🏅 **DESTAQUE DA RODADA**\n{melhor} aparece com **{pontos} pts**, **{vitorias} vitórias** e **{kills} kills**. A campanha está falando por si.',
    '📚 **RAIO-X DA LIGA**\nLíder: {lider} (**{pontos} pts**) • Vice: {segundo} (**{pontos2} pts**) • Terceiro: {terceiro} (**{pontos3} pts**).',
    '💥 **COMBATE PESADO**\n{kill} tem **{kills} kills** registradas. Quem joga para vencer também precisa saber sobreviver aos confrontos.',
    '👀 **NOME PARA OBSERVAR**\n{melhor} está entre os destaques atuais com **{pontos} pts**. Dependendo da próxima partida, pode ganhar várias posições.',
    '🏆 **A COROA TEM DONO... POR ENQUANTO**\n{lider} ocupa o primeiro lugar com **{pontos} pts**. Mas a diferença de **{dif}** para {segundo} não permite relaxar.',
    '📊 **A LIGA ESTÁ VIVA**\nJá são **{partidas} partidas** contabilizadas. Cada vitória, kill e conquista territorial pode pesar quando o ranking fechar.'
];

function gerarMensagemLiga() {
    const ranking = rankingLiga();
    const resumo = (() => { try { return estatisticasLiga.resumoLiga(); } catch { return {}; } })();
    if (!ranking.length) return '🏆 **LIGA DAS NAÇÕES**\nAinda não há dados suficientes para fazer uma análise do ranking. A próxima partida pode mudar isso. 👀';

    const lider = ranking[0];
    const segundo = ranking[1] || lider;
    const terceiro = ranking[2] || segundo;
    const porKills = [...ranking].sort((a, b) => numero(b.kills) - numero(a.kills));
    const porWin = [...ranking].sort((a, b) => numero(b.vitorias) - numero(a.vitorias));
    const continenteValores = ['europa', 'asia', 'africa', 'amnorte', 'amsul', 'oceania']
        .map(chave => ({ chave, valor: numero(resumo[chave]) }))
        .sort((a, b) => b.valor - a.valor);
    const modelo = escolher(LIGA_MODELOS, 'liga-espontanea');

    const vencedor = porWin[0] || lider;
    const eficiente = ranking.find(j => numero(j.partidas) > 0) || lider;
    const partidasJogador = Math.max(1, numero(eficiente.partidas));
    const topDif = numero(lider.pontos) - numero(terceiro.pontos);

    return modelo
        .replaceAll('{lider}', mencionarJogador(lider.id))
        .replaceAll('{pontos}', formatarPontos(lider.pontos))
        .replaceAll('{segundo}', mencionarJogador(segundo.id))
        .replaceAll('{pontos2}', formatarPontos(segundo.pontos))
        .replaceAll('{terceiro}', mencionarJogador(terceiro.id))
        .replaceAll('{pontos3}', formatarPontos(terceiro.pontos))
        .replaceAll('{dif}', formatarPontos(diferenca(lider.pontos, segundo.pontos)))
        .replaceAll('{topDif}', formatarPontos(topDif))
        .replaceAll('{melhor}', mencionarJogador(ranking[0].id))
        .replaceAll('{vencedor}', mencionarJogador(vencedor.id))
        .replaceAll('{vitorias}', formatarPontos(numero(vencedor.vitorias || lider.vitorias)))
        .replaceAll('{kills}', formatarPontos(numero(porKills[0]?.kills || lider.kills)))
        .replaceAll('{kill}', mencionarJogador(porKills[0]?.id || lider.id))
        .replaceAll('{partidas}', formatarPontos(resumo.partidasRegistradas))
        .replaceAll('{jogadores}', formatarPontos(resumo.jogadores))
        .replaceAll('{killsTotal}', formatarPontos(resumo.kills))
        .replaceAll('{partidasJogador}', formatarPontos(partidasJogador))
        .replaceAll('{eficiente}', mencionarJogador(eficiente.id))
        .replaceAll('{continente}', continenteValores[0]?.chave?.toUpperCase() || 'territórios')
        .replaceAll('{valorContinente}', formatarPontos(continenteValores[0]?.valor || 0));
}

/* ========================================================================
   20 RESPOSTAS INTELIGENTES — OLIMPÍADAS
   ======================================================================== */

const OLIMPIADAS_MODELOS = [
    '🥇 **CORRIDA PELO OURO**\n{liderPais} lidera o quadro com **{ouro} ouro(s)**. Será que alguém consegue tirar essa liderança? 👀',
    '🏅 **PÓDIO ATUAL**\n🥇 {ouroPais} • 🥈 {prataPais} • 🥉 {bronzePais}\nAs Olimpíadas estão começando a ganhar seus protagonistas.',
    '🔥 **DISPUTA INTERNACIONAL**\n{liderPais} tem **{vitorias} vitória(s)** registradas. {segundoPais} vem logo atrás com **{vitorias2}**. A diferença é de apenas **{dif}**.',
    '🌎 **MAPA DAS DUPLAS**\nJá existem **{duplas} duplas** representando **{paises} países**. A competição está ficando global de verdade.',
    '🥇 **QUEM DOMINA?**\n{liderPais} está na frente com **{ouro} ouro(s), {prata} prata(s) e {bronze} bronze(s)**. Campanha forte.',
    '⚔️ **AMEAÇA AO LÍDER**\n{segundoPais} está a apenas **{dif}** resultado(s) de alcançar {liderPais}. O próximo confronto pode ser decisivo.',
    '🏆 **DUPLA EM DESTAQUE**\nA representação de {liderPais} vem chamando atenção. Quando uma dupla começa a acumular resultados, todo mundo passa a mirar nela.',
    '📊 **RAIO-X DAS OLIMPÍADAS**\nDuplas: **{duplas}** • Países: **{paises}** • Resultados: **{resultados}**. A competição está ganhando forma.',
    '🔥 **PÓDIO NÃO É GARANTIDO**\n{bronzePais} ocupa o bronze, mas uma nova vitória pode reorganizar completamente as posições.',
    '👀 **OLHO NESSA REPRESENTAÇÃO**\n{liderPais} está entre os países que mais aparecem no topo. A pressão agora é manter o desempenho.',
    '🥈 **CAÇANDO A PRATA**\n{prataPais} está na segunda posição. Falta pouco para transformar uma campanha boa em uma campanha histórica.',
    '🥉 **BRIGA PELO BRONZE**\n{bronzePais} está segurando o terceiro lugar. Qualquer tropeço pode abrir espaço para outro país.',
    '🎯 **CONSISTÊNCIA OLÍMPICA**\n{liderPais} tem resultados suficientes para se manter entre os destaques. Consistência vale ouro nesta competição.',
    '🌍 **MUITOS PAÍSES, UM PÓDIO**\nCom **{paises} países** registrados, nem todo mundo vai conseguir chegar ao pódio. A disputa promete.',
    '🏅 **MEDALHAS EM JOGO**\nO quadro atual tem {ouroPais} na frente. Mas ainda existe muita competição pela frente.',
    '⚡ **MOMENTO OLÍMPICO**\nJá foram registrados **{resultados} resultados**. Cada novo confronto pode mexer no equilíbrio entre os países.',
    '👑 **CANDIDATO AO TOPO**\n{liderPais} está construindo uma campanha de respeito. Se continuar assim, o ouro pode ficar cada vez mais próximo.',
    '⚔️ **GUERRA PELO PÓDIO**\n🥇 {ouroPais} • 🥈 {prataPais} • 🥉 {bronzePais}. Três posições, dezenas de olhos tentando tomar o lugar deles.',
    '📈 **COMPETIÇÃO CRESCENDO**\nAs Olimpíadas já contam com **{duplas} duplas** e **{resultados} resultados**. Quanto mais partidas, mais difícil fica prever o campeão.',
    '🏆 **MOMENTO DE PRESTAR ATENÇÃO**\n{liderPais} aparece na liderança das estatísticas atuais. Quem pretende disputar o ouro vai precisar responder dentro do tabuleiro.'
];

function resumoPais(item) {
    const v = item?.vitorias ?? item?.wins ?? item?.pontos ?? item?.score ?? 0;
    return numero(v);
}

function gerarMensagemOlimpiadas() {
    const { dados, ranking, medalhas } = estatisticasOlimpiadas();
    const porValor = [...ranking].sort((a, b) => resumoPais(b) - resumoPais(a));
    const paisesMedalha = Object.entries(medalhas)
        .map(([pais, m]) => ({ pais, ...m }))
        .sort((a, b) => b.ouro - a.ouro || b.prata - a.prata || b.bronze - a.bronze);

    const lider = paisesMedalha[0] || porValor[0] || { pais: 'nenhum país', ouro: 0, prata: 0, bronze: 0 };
    const segundo = paisesMedalha[1] || porValor[1] || lider;
    const terceiro = paisesMedalha[2] || porValor[2] || segundo;
    const modelo = escolher(OLIMPIADAS_MODELOS, 'olimpiadas-espontanea');

    const v1 = resumoPais(porValor[0] || {});
    const v2 = resumoPais(porValor[1] || {});

    return modelo
        .replaceAll('{liderPais}', String(lider.pais))
        .replaceAll('{ouroPais}', String(lider.pais))
        .replaceAll('{prataPais}', String(segundo.pais))
        .replaceAll('{bronzePais}', String(terceiro.pais))
        .replaceAll('{ouro}', formatarPontos(lider.ouro))
        .replaceAll('{prata}', formatarPontos(lider.prata))
        .replaceAll('{bronze}', formatarPontos(lider.bronze))
        .replaceAll('{vitorias}', formatarPontos(v1))
        .replaceAll('{vitorias2}', formatarPontos(v2))
        .replaceAll('{dif}', formatarPontos(diferenca(v1, v2)))
        .replaceAll('{duplas}', formatarPontos(dados.duplas.length))
        .replaceAll('{paises}', formatarPontos(new Set(dados.duplas.map(d => normalizar(d.pais)).filter(Boolean)).size))
        .replaceAll('{resultados}', formatarPontos(dados.resultados.length));
}

/* ========================================================================
   PALAVRAS-CHAVE / INTENÇÕES
   ======================================================================== */

const INTENCOES = [
    { tipo: 'liga', palavras: ['liga', 'ranking da liga', 'pontuacao da liga', 'pontuação da liga', 'partida da liga', 'quem esta em primeiro', 'quem está em primeiro', 'lider da liga', 'líder da liga', 'pontos da liga'] },
    { tipo: 'liga-pontos', palavras: ['meus pontos', 'minha pontuacao', 'minha pontuação', 'quanto tenho', 'quantos pontos tenho', 'meu ranking'] },
    { tipo: 'olimpiadas', palavras: ['olimpiadas', 'olimpíadas', 'olimpiada', 'olimpíada', 'duplas', 'medalhas', 'ouro', 'prata', 'bronze', 'pais lider', 'país líder', 'ranking das olimpiadas', 'ranking das olimpíadas'] },
    { tipo: 'competicao', palavras: ['campeao', 'campeão', 'quem esta ganhando', 'quem está ganhando', 'quem lidera', 'quem liderando'] }
];

function detectarIntencao(conteudo) {
    const texto = normalizar(conteudo);
    let melhor = null;
    let maior = 0;

    for (const intencao of INTENCOES) {
        let pontos = 0;
        for (const palavra of intencao.palavras) {
            if (contemPalavra(texto, palavra)) pontos += palavra.includes(' ') ? 2 : 1;
        }
        if (pontos > maior) {
            maior = pontos;
            melhor = intencao.tipo;
        }
    }
    return maior ? melhor : null;
}

function gerarRespostaInteligente(interaction) {
    const tipo = detectarIntencao(interaction.content || '');
    if (!tipo) return null;

    if (tipo === 'olimpiadas') return gerarMensagemOlimpiadas();
    if (tipo === 'liga-pontos') {
        const perfil = perfilLiga(interaction.author.id);
        if (!perfil) return '📊 Ainda não encontrei uma pontuação registrada para você na Liga. Participe de uma partida e volte aqui. 👀';
        return `📊 **SEU RAIO-X NA LIGA**\n${mencionarJogador(interaction.author.id)} está com **${formatarPontos(perfil.pontos)} pts**, **${formatarPontos(perfil.vitorias)} vitória(s)**, **${formatarPontos(perfil.kills)} kill(s)** e **${formatarPontos(perfil.mortes)} morte(s)**.\n🏆 Posição atual: **${Math.max(1, rankingLiga().findIndex(j => String(j.id) === String(interaction.author.id)) + 1)}º lugar**.`;
    }
    return gerarMensagemLiga();
}

/* ========================================================================
   AUTO-RESPOSTAS TRADICIONAIS
   ======================================================================== */

function gerarRespostaTradicional(conteudo) {
    const db = safeReadJson(dbPath);
    for (const [gatilho, respostas] of Object.entries(db || {})) {
        if (!contemPalavra(conteudo, gatilho)) continue;
        return Array.isArray(respostas) ? escolher(respostas, `tradicional:${gatilho}`) : respostas;
    }
    return null;
}

/* ========================================================================
   MENSAGEM ESPONTÂNEA
   ======================================================================== */

async function enviarEspontanea() {
    if (!clienteAtual?.channels?.cache) return;

    const canais = [...clienteAtual.channels.cache.values()].filter(channel =>
        channel?.isTextBased?.() &&
        estaNaCategoria(channel) &&
        channel.guild &&
        typeof channel.send === 'function'
    );

    if (!canais.length) return;

    const canal = canais[Math.floor(Math.random() * canais.length)];
    const agora = Date.now();
    const ultima = ultimaEspontanea.get(canal.id) || 0;
    if (agora - ultima < CONFIG.cooldownCanalMs) return;
    ultimaEspontanea.set(canal.id, agora);

    const mensagem = Math.random() < CONFIG.chanceOlimpiadas
        ? gerarMensagemOlimpiadas()
        : gerarMensagemLiga();

    try {
        await canal.send({ content: mensagem, allowedMentions: { parse: [] } });
        console.log(`[Auto-Resposta] Mensagem espontânea enviada em #${canal.name}.`);
    } catch (erro) {
        console.error('[Auto-Resposta] Erro na mensagem espontânea:', erro.message);
    }
}

function agendarProximaEspontanea() {
    if (timerEspontaneo) clearTimeout(timerEspontaneo);
    const intervalo = Math.floor(
        CONFIG.intervaloMinMs + Math.random() * (CONFIG.intervaloMaxMs - CONFIG.intervaloMinMs)
    );

    timerEspontaneo = setTimeout(async () => {
        await enviarEspontanea();
        agendarProximaEspontanea();
    }, intervalo);
}

/* ========================================================================
   HANDLER
   ======================================================================== */

module.exports = (client) => {
    clienteAtual = client;

    client.on(Events.MessageCreate, async message => {
        if (message.author.bot || !message.content) return;
        if (!estaNaCategoria(message.channel)) return;

        // Primeiro tenta entender Liga/Olimpíadas pelo contexto.
        const inteligente = gerarRespostaInteligente(message);
        if (inteligente && Math.random() <= CONFIG.chanceRespostaInteligente && podeResponderNoCanal(message.channelId)) {
            try {
                await message.reply({
                    content: inteligente,
                    allowedMentions: { repliedUser: false, parse: [] }
                });
                console.log(`[Auto-Resposta] Inteligente acionada por ${message.author.tag}.`);
            } catch (erro) {
                console.error('[Auto-Resposta] Erro na resposta inteligente:', erro.message);
            }
            return;
        }

        // Mantém o sistema antigo funcionando, mas agora restrito à categoria.
        const tradicional = gerarRespostaTradicional(message.content);
        if (tradicional && podeResponderNoCanal(message.channelId)) {
            try {
                await message.reply({
                    content: tradicional,
                    allowedMentions: { repliedUser: false, parse: [] }
                });
                console.log(`[Auto-Resposta] Gatilho tradicional acionado por ${message.author.tag}.`);
            } catch (erro) {
                console.error('[Auto-Resposta] Erro ao enviar auto-resposta:', erro.message);
            }
        }
    });

    client.once(Events.ClientReady, () => {
        agendarProximaEspontanea();
        console.log(`[Auto-Resposta] Inteligente ativada na categoria ${CONFIG.categoriaId}.`);
        console.log('[Auto-Resposta] Liga + Olimpíadas + palavras-chave + mensagens espontâneas habilitadas.');
    });
};