/* ========================================================================
   WORLDWARBR — AUTO RESPOSTA INTELIGENTE V2

   Integração:
   - Liga das Nações
   - Olimpíadas de Duplas

   Recursos:
   - somente na categoria configurada;
   - respostas tradicionais do auto_respostas.json;
   - análise dinâmica do ranking;
   - jogadores subindo/caindo;
   - ultrapassagens detectadas entre snapshots;
   - sequência atual e maior sequência de vitórias;
   - comparação direta entre dois jogadores mencionados;
   - comentários sobre diferença de pontos, vitórias, kills e winrate;
   - mensagens espontâneas com variação humana;
   - anti-spam e anti-repetição.
   ======================================================================== */

const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');
const estatisticasLiga = require('../liga/utils/estatisticasLiga.js');

const dbPath = path.join(__dirname, 'auto_respostas.json');
const inteligenciaPath = path.join(__dirname, 'auto_inteligencia.json');
const olympPath = path.join(__dirname, '..', 'olimpiadas', 'olimpiadas.json');

const CONFIG = {
    categoriaId: '849698902634004510',
    intervaloMinMs: 10 * 60 * 1000,
    intervaloMaxMs: 30 * 60 * 1000,
    cooldownCanalMs: 90 * 1000,
    chanceOlimpiadas: 0.45,
    chanceRespostaInteligente: 0.82,
    maxRankingSnapshot: 50
};

const cooldownCanais = new Map();
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

function salvarJson(caminho, dados) {
    try {
        fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), 'utf8');
        return true;
    } catch (erro) {
        console.error('[Auto-Resposta] Erro salvando JSON:', caminho, erro.message);
        return false;
    }
}

function normalizar(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function fmt(valor) {
    return numero(valor).toLocaleString('pt-BR');
}

function mencionar(id) {
    return id ? `<@${String(id)}>` : 'esse competidor';
}

function escolher(lista, chave) {
    if (!Array.isArray(lista) || !lista.length) return '';
    const anterior = ultimoModelo.get(chave);
    const candidatos = lista.length > 1 ? lista.filter(x => x !== anterior) : lista;
    const item = candidatos[Math.floor(Math.random() * candidatos.length)] || lista[0];
    ultimoModelo.set(chave, item);
    return item;
}

function estaNaCategoria(channel) {
    return String(channel?.parentId || '') === CONFIG.categoriaId;
}

function podeResponder(channelId) {
    const agora = Date.now();
    const ultimo = cooldownCanais.get(String(channelId)) || 0;
    if (agora - ultimo < CONFIG.cooldownCanalMs) return false;
    cooldownCanais.set(String(channelId), agora);
    return true;
}

function rankingLiga() {
    try {
        return estatisticasLiga.rankingPorPontos(CONFIG.maxRankingSnapshot) || [];
    } catch (erro) {
        console.error('[Auto-Resposta] Ranking:', erro.message);
        return [];
    }
}

function perfilLiga(id) {
    try {
        return estatisticasLiga.calcularPerfil(String(id));
    } catch {
        return null;
    }
}

function resumoLiga() {
    try {
        return estatisticasLiga.resumoLiga() || {};
    } catch {
        return {};
    }
}

function carregarInteligencia() {
    const dados = lerJson(inteligenciaPath, {});
    if (!dados.ultimaClassificacao || typeof dados.ultimaClassificacao !== 'object') {
        dados.ultimaClassificacao = {};
    }
    return dados;
}

function salvarSnapshot(ranking) {
    if (!ranking.length) return;
    const dados = carregarInteligencia();
    const classificacao = {};
    ranking.forEach((j, index) => {
        classificacao[String(j.id)] = {
            posicao: index + 1,
            pontos: numero(j.pontos)
        };
    });
    dados.ultimaClassificacao = classificacao;
    dados.atualizadoEm = new Date().toISOString();
    salvarJson(inteligenciaPath, dados);
}

function analisarMovimento(ranking) {
    const anterior = carregarInteligencia().ultimaClassificacao || {};
    const atual = {};
    const subindo = [];
    const caindo = [];
    const ultrapassagens = [];

    ranking.forEach((j, index) => {
        const id = String(j.id);
        const posicao = index + 1;
        atual[id] = posicao;
        const antigo = anterior[id];
        if (!antigo) return;

        const delta = numero(antigo.posicao) - posicao;
        if (delta >= 1) subindo.push({ ...j, de: antigo.posicao, para: posicao, delta });
        if (delta <= -1) caindo.push({ ...j, de: antigo.posicao, para: posicao, delta: Math.abs(delta) });
    });

    for (let i = 0; i < ranking.length; i++) {
        for (let j = i + 1; j < ranking.length; j++) {
            const a = ranking[i];
            const b = ranking[j];
            const pa = anterior[String(a.id)]?.posicao;
            const pb = anterior[String(b.id)]?.posicao;
            if (!pa || !pb) continue;
            if (pa > pb && i < j) {
                ultrapassagens.push({ ultrapassou: a, ultrapassado: b });
            }
            if (pb > pa && j < i) {
                ultrapassagens.push({ ultrapassou: b, ultrapassado: a });
            }
        }
    }

    return { subindo, caindo, ultrapassagens, atual };
}

function melhorMovimento(movimento, tipo) {
    const lista = tipo === 'subindo' ? movimento.subindo : movimento.caindo;
    return [...lista].sort((a, b) => b.delta - a.delta)[0] || null;
}

function streakTexto(jogador) {
    const atual = numero(jogador?.streakAtual);
    const maior = numero(jogador?.maiorStreak);
    if (atual >= 5) return `está em uma sequência absurda de **${fmt(atual)} vitórias seguidas** (melhor marca: **${fmt(maior)}**) 🔥🔥`;
    if (atual >= 3) return `vem de **${fmt(atual)} vitórias seguidas** e já tem uma sequência de respeito (máxima: **${fmt(maior)}**) 🔥`;
    if (atual === 2) return `venceu as **2 últimas partidas** e começou a embalar 👀`;
    if (atual === 1) return `venceu a partida mais recente e pode começar uma sequência`;
    if (maior >= 3) return `está sem sequência ativa agora, mas já chegou a **${fmt(maior)} vitórias seguidas**`;
    return 'ainda não tem uma sequência de vitórias relevante registrada';
}

function taxa(j) {
    if (numero(j?.partidas) <= 0) return 0;
    return numero(j?.winrate) || (numero(j.vitorias) / numero(j.partidas)) * 100;
}

function compararJogadores(a, b) {
    if (!a || !b) return null;
    const pontos = numero(a.pontos) - numero(b.pontos);
    const vitorias = numero(a.vitorias) - numero(b.vitorias);
    const kills = numero(a.kills) - numero(b.kills);
    const winrate = taxa(a) - taxa(b);
    const ranking = rankingLiga();
    const posA = ranking.findIndex(j => String(j.id) === String(a.id)) + 1;
    const posB = ranking.findIndex(j => String(j.id) === String(b.id)) + 1;

    const vencedor = pontos > 0 ? a : pontos < 0 ? b : vitorias > 0 ? a : vitorias < 0 ? b : null;
    const nomeA = mencionar(a.id);
    const nomeB = mencionar(b.id);

    let abertura;
    if (pontos === 0) abertura = `${nomeA} e ${nomeB} estão empatados em **${fmt(a.pontos)} pts**.`;
    else if (vencedor?.id === a.id) abertura = `${nomeA} está na frente de ${nomeB} por **${fmt(Math.abs(pontos))} pts**.`;
    else abertura = `${nomeB} está na frente de ${nomeA} por **${fmt(Math.abs(pontos))} pts**.`;

    return [
        `⚔️ **COMPARAÇÃO DIRETA**`,
        abertura,
        `📊 **Ranking:** ${nomeA} #${posA || '—'} • ${nomeB} #${posB || '—'}`,
        `🏆 **Vitórias:** ${fmt(a.vitorias)} x ${fmt(b.vitorias)} • **Kills:** ${fmt(a.kills)} x ${fmt(b.kills)}`,
        `📈 **Winrate:** ${taxa(a).toFixed(1)}% x ${taxa(b).toFixed(1)}%`,
        pontos !== 0
            ? `💡 Hoje, a vantagem é de ${vencedor?.id === a.id ? nomeA : nomeB}. Mas uma boa partida pode virar esse duelo.`
            : vitorias !== 0
                ? `💡 Em vitórias, ${vitorias > 0 ? nomeA : nomeB} leva vantagem.`
                : kills !== 0
                    ? `💡 Em poder de fogo, ${kills > 0 ? nomeA : nomeB} está na frente.`
                    : winrate !== 0
                        ? `💡 Em aproveitamento, ${winrate > 0 ? nomeA : nomeB} está melhor.`
                        : '💡 Os dois estão praticamente lado a lado nos números.'
    ].join('\n');
}

function extrairMencoes(message) {
    return [...message.mentions.users.keys()].slice(0, 2);
}

function tem(texto, termos) {
    const n = normalizar(texto);
    return termos.some(t => n.includes(normalizar(t)));
}

const MODELOS_MOVIMENTO = [
    m => `📈 **TEM GENTE SUBINDO**\n${m.jogador ? mencionar(m.jogador.id) : 'Um competidor'} ganhou **${fmt(m.delta)} posição(ões)** e foi do #${m.de} para o #${m.para}. Isso sim é evolução. 🔥`,
    m => `👀 **OLHA QUEM APARECEU**\n${m.jogador ? mencionar(m.jogador.id) : 'Um jogador'} está avançando no ranking. Saiu do #${m.de} e agora está no #${m.para}. A próxima partida pode colocar ainda mais pressão no topo.`,
    m => `📉 **ATENÇÃO NO RANKING**\n${m.jogador ? mencionar(m.jogador.id) : 'Um competidor'} perdeu **${fmt(m.delta)} posição(ões)**. Caiu do #${m.de} para o #${m.para}. Agora é hora de reagir.`,
    m => `⚔️ **ULTRAPASSAGEM!**\n${m.ultrapassou ? mencionar(m.ultrapassou.id) : 'Um jogador'} passou na frente de ${m.ultrapassado ? mencionar(m.ultrapassado.id) : 'outro competidor'}. O ranking acabou de ganhar mais uma reviravolta.`,
    m => `🔥 **A BRIGA ESTÁ PEGANDO**\n${m.ultrapassou ? mencionar(m.ultrapassou.id) : 'Um competidor'} ultrapassou ${m.ultrapassado ? mencionar(m.ultrapassado.id) : 'um adversário'}. É exatamente esse tipo de mudança que deixa a Liga viva.`
];

function gerarAnaliseMovimento(ranking) {
    if (!ranking.length) return null;
    const movimento = analisarMovimento(ranking);
    const subida = melhorMovimento(movimento, 'subindo');
    const queda = melhorMovimento(movimento, 'caindo');
    const ultrapassagem = movimento.ultrapassagens[0];

    if (!subida && !queda && !ultrapassagem) return null;

    let tipo;
    if (ultrapassagem && Math.random() < 0.45) tipo = { ultrapassou: ultrapassagem.ultrapassou, ultrapassado: ultrapassagem.ultrapassado };
    else if (subida && (!queda || Math.random() < 0.65)) tipo = { jogador: subida, de: subida.de, para: subida.para, delta: subida.delta };
    else tipo = { jogador: queda, de: queda.de, para: queda.para, delta: queda.delta };

    let mensagem = escolher(MODELOS_MOVIMENTO, 'movimento');
    // Corrige o tom do modelo 3 quando o escolhido for queda.
    if (mensagem.includes('TEM GENTE SUBINDO') && tipo.jogador && tipo.jogador.delta < 0) {
        mensagem = MODELOS_MOVIMENTO[2];
    }
    return mensagem(tipo);
}

const MODELOS_LIGA = [
    r => `👑 **A COROA TEM DONO... POR ENQUANTO**\n${mencionar(r.lider.id)} lidera com **${fmt(r.lider.pontos)} pts**. ${mencionar(r.segundo.id)} está a **${fmt(Math.abs(numero(r.lider.pontos) - numero(r.segundo.pontos)))} pontos**.`,
    r => `⚔️ **CAÇADA AO TOPO**\n${mencionar(r.segundo.id)} está perseguindo ${mencionar(r.lider.id)}. Faltam **${fmt(Math.abs(numero(r.lider.pontos) - numero(r.segundo.pontos)))} pts** para encostar.`,
    r => `🔥 **SEQUÊNCIA DE VITÓRIAS**\n${mencionar(r.destaque.id)} ${streakTexto(r.destaque)}. Se continuar assim, o ranking vai sentir.`,
    r => `💀 **PODER DE FOGO**\n${mencionar(r.kills.id)} lidera em kills com **${fmt(r.kills.kills)} eliminações**. Não é só pontuação: combate também está pesando.`,
    r => `📈 **MOMENTO**\n${mencionar(r.destaque.id)} está com **${fmt(r.destaque.pontos)} pts**, **${fmt(r.destaque.vitorias)} vitórias** e **${fmt(r.destaque.kills)} kills**. É um nome para ficar de olho.`,
    r => `📊 **TOP 3**\n🥇 ${mencionar(r.lider.id)} — ${fmt(r.lider.pontos)} pts\n🥈 ${mencionar(r.segundo.id)} — ${fmt(r.segundo.pontos)} pts\n🥉 ${mencionar(r.terceiro.id)} — ${fmt(r.terceiro.pontos)} pts`,
    r => `🧠 **NÚMEROS NÃO MENTEM**\n${mencionar(r.winrate.id)} tem **${taxa(r.winrate).toFixed(1)}% de aproveitamento**. Em ${fmt(r.winrate.partidas)} partidas, isso chama atenção.`,
    r => `🏆 **CONSISTÊNCIA**\n${mencionar(r.vitorias.id)} já soma **${fmt(r.vitorias.vitorias)} vitórias**. Quem mantém esse ritmo começa a construir uma campanha difícil de alcançar.`,
    r => `⚡ **A DISTÂNCIA É PEQUENA**\nOs dois primeiros estão separados por **${fmt(Math.abs(numero(r.lider.pontos) - numero(r.segundo.pontos)))} pts**. Uma única partida pode mudar o cenário.`,
    r => `🌎 **A LIGA ESTÁ VIVA**\nJá são **${fmt(r.resumo.partidasRegistradas)} partidas**, **${fmt(r.resumo.jogadores)} jogadores** e **${fmt(r.resumo.kills)} kills** contabilizadas. Cada resultado pesa.`,
    r => `🎯 **QUEM ESTÁ MAIS PERTO?**\n${mencionar(r.segundo.id)} precisa superar **${fmt(Math.abs(numero(r.lider.pontos) - numero(r.segundo.pontos)))} pts** de diferença para assumir a liderança.`,
    r => `🔥 **OLHO NESSE JOGADOR**\n${mencionar(r.destaque.id)} tem **${fmt(r.destaque.pontos)} pts** e ${streakTexto(r.destaque)}. A próxima partida pode mudar bastante a leitura desse ranking.`
];

function gerarMensagemLiga() {
    const ranking = rankingLiga();
    if (!ranking.length) return '🏆 **LIGA DAS NAÇÕES**\nAinda não tenho dados suficientes para fazer uma análise. Assim que houver partidas, eu começo a acompanhar a disputa. 👀';

    const lider = ranking[0];
    const segundo = ranking[1] || lider;
    const terceiro = ranking[2] || segundo;
    const resumo = resumoLiga();
    const kills = [...ranking].sort((a, b) => numero(b.kills) - numero(a.kills))[0] || lider;
    const vitorias = [...ranking].sort((a, b) => numero(b.vitorias) - numero(a.vitorias))[0] || lider;
    const winrate = [...ranking].filter(j => numero(j.partidas) > 0).sort((a, b) => taxa(b) - taxa(a))[0] || lider;
    const destaque = [...ranking].sort((a, b) => {
        const sa = numero(a.streakAtual) * 4 + numero(a.vitorias) + numero(a.kills) * 0.2;
        const sb = numero(b.streakAtual) * 4 + numero(b.vitorias) + numero(b.kills) * 0.2;
        return sb - sa;
    })[0] || lider;

    const mensagemMovimento = gerarAnaliseMovimento(ranking);
    salvarSnapshot(ranking);
    if (mensagemMovimento && Math.random() < 0.60) return mensagemMovimento;

    return escolher(MODELOS_LIGA, 'liga').({
        lider, segundo, terceiro, kills, vitorias, winrate, destaque, resumo
    });
}

function analisarJogador(id) {
    const ranking = rankingLiga();
    const jogador = perfilLiga(id);
    if (!jogador) return `🔎 Não encontrei dados de ${mencionar(id)} na Liga ainda.`;
    const posicao = ranking.findIndex(j => String(j.id) === String(id)) + 1;
    const movimento = analisarMovimento(ranking);
    const subiu = movimento.subindo.find(j => String(j.id) === String(id));
    const caiu = movimento.caindo.find(j => String(j.id) === String(id));

    let leitura = 'está mantendo a posição atual';
    if (subiu) leitura = `subiu **${fmt(subiu.delta)} posição(ões)**, indo do #${subiu.de} para o #${subiu.para}`;
    if (caiu) leitura = `caiu **${fmt(caiu.delta)} posição(ões)**, indo do #${caiu.de} para o #${caiu.para}`;

    return [
        `📋 **RAIO-X DE ${mencionar(id)}**`,
        `🏅 Posição: **#${posicao || '—'}** • Pontos: **${fmt(jogador.pontos)}**`,
        `🏆 Vitórias: **${fmt(jogador.vitorias)}** • Partidas: **${fmt(jogador.partidas)}** • Winrate: **${taxa(jogador).toFixed(1)}%**`,
        `💀 Kills: **${fmt(jogador.kills)}** • Mortes: **${fmt(jogador.mortes)}**`,
        `🔥 ${mencionar(id)} ${streakTexto(jogador)}.`,
        `📈 No movimento mais recente que eu consegui observar, ${leitura}.`
    ].join('\n');
}

function gerarRespostaInteligente(message) {
    const texto = message.content || '';
    const mencoes = extrairMencoes(message);

    if (mencoes.length === 2 && tem(texto, ['comparar', 'compare', 'versus', 'vs', 'contra', 'duelo'])) {
        const a = perfilLiga(mencoes[0]);
        const b = perfilLiga(mencoes[1]);
        return compararJogadores(a, b);
    }

    if (mencoes.length === 1 && tem(texto, ['meus pontos', 'minha pontuacao', 'minha pontuação', 'meu ranking', 'meus numeros', 'meus números', 'como estou', 'como to', 'como tô'])) {
        return analisarJogador(mencoes[0]);
    }

    if (tem(texto, ['quem subiu', 'quem esta subindo', 'quem está subindo', 'quem caiu', 'quem esta caindo', 'quem está caindo', 'ultrapassou', 'ultrapassagem', 'mudou no ranking', 'movimentacao', 'movimentação'])) {
        const ranking = rankingLiga();
        const analise = gerarAnaliseMovimento(ranking);
        return analise || '📊 Ainda não detectei uma mudança de posição desde a última leitura do ranking. A próxima partida pode mudar isso. 👀';
    }

    if (tem(texto, ['sequencia', 'sequência', 'vitorias seguidas', 'vitórias seguidas', 'streak', 'embalado', 'embalada'])) {
        const ranking = rankingLiga();
        const jogador = [...ranking].sort((a, b) => numero(b.streakAtual) - numero(a.streakAtual))[0];
        if (!jogador || numero(jogador.streakAtual) <= 0) return '🔥 Ainda não há uma sequência ativa forte registrada. Quero ver quem vai começar a embalar.';
        return `🔥 **SEQUÊNCIA ATIVA**\n${mencionar(jogador.id)} ${streakTexto(jogador)}.`;
    }

    if (mencoes.length === 1 && tem(texto, ['pontos', 'pontuacao', 'pontuação', 'ranking', 'estatistica', 'estatística', 'desempenho'])) {
        return analisarJogador(mencoes[0]);
    }

    if (tem(texto, ['liga', 'ranking da liga', 'lider', 'líder', 'primeiro', 'quem esta ganhando', 'quem está ganhando', 'quem lidera', 'campeao', 'campeão'])) {
        return gerarMensagemLiga();
    }

    if (tem(texto, ['olimpiada', 'olimpíada', 'olimpiadas', 'olimpíadas', 'duplas', 'medalhas', 'ouro', 'prata', 'bronze'])) {
        return gerarMensagemOlimpiadas();
    }

    return null;
}

function dadosOlimpiadas() {
    const dados = lerJson(olympPath, {});
    if (!Array.isArray(dados.duplas)) dados.duplas = [];
    if (!Array.isArray(dados.resultados)) dados.resultados = [];
    if (!dados.ranking || typeof dados.ranking !== 'object') dados.ranking = {};
    return dados;
}

function gerarMensagemOlimpiadas() {
    const dados = dadosOlimpiadas();
    const ranking = Object.entries(dados.ranking)
        .map(([pais, item]) => ({ pais, ...(item && typeof item === 'object' ? item : { pontos: numero(item) }) }))
        .sort((a, b) => numero(b.pontos) - numero(a.pontos));

    if (!ranking.length && !dados.duplas.length && !dados.resultados.length) {
        return '🥇 **OLIMPÍADAS DE DUPLAS**\nAinda estou esperando os primeiros resultados para começar a narrar essa disputa. 👀';
    }

    const lider = ranking[0];
    const duplas = dados.duplas.length;
    const resultados = dados.resultados.length;
    if (!lider) return `🏅 **OLIMPÍADAS DE DUPLAS**\nJá existem **${fmt(duplas)} duplas** e **${fmt(resultados)} resultados** registrados. A disputa está começando!`;

    return escolher([
        `🥇 **CORRIDA PELO TOPO**\n${lider.pais} está liderando as Olimpíadas com **${fmt(lider.pontos)} pts**. Mas ainda tem muita disputa pela frente.`,
        `🏅 **OLIMPÍADAS DE DUPLAS**\nO país que aparece na frente agora é **${lider.pais}**, com **${fmt(lider.pontos)} pts**. Já são **${fmt(duplas)} duplas** registradas.`,
        `👀 **OLHO NO QUADRO**\n${lider.pais} tomou a dianteira com **${fmt(lider.pontos)} pts**. Se o segundo colocado encostar, o cenário muda rapidinho.`,
        `🔥 **A DISPUTA ESTÁ VIVA**\n**${fmt(resultados)} resultados** já foram registrados e **${fmt(duplas)} duplas** estão no sistema. ${lider.pais} aparece na frente neste momento.`
    ], 'olimpiadas');
}

function gerarRespostaTradicional(texto) {
    try {
        const db = safeReadJson(dbPath, {});
        if (!db || typeof db !== 'object') return null;

        const respostas = Array.isArray(db) ? db : (db.respostas || db);
        if (Array.isArray(respostas)) {
            for (const item of respostas) {
                const gatilhos = item.gatilhos || item.palavras || item.keywords || [];
                const lista = Array.isArray(gatilhos) ? gatilhos : [gatilhos];
                if (lista.some(g => normalizar(texto).includes(normalizar(g)))) {
                    const opcoes = item.respostas || item.mensagens || item.resposta;
                    return Array.isArray(opcoes) ? escolher(opcoes, 'tradicional') : opcoes;
                }
            }
        }

        return null;
    } catch (erro) {
        console.error('[Auto-Resposta] Sistema tradicional:', erro.message);
        return null;
    }
}

function canaisDaCategoria() {
    if (!clienteAtual?.channels?.cache) return [];
    return [...clienteAtual.channels.cache.values()].filter(c => {
        return estaNaCategoria(c) && typeof c.send === 'function' && c.isTextBased?.();
    });
}

function agendarProximaEspontanea() {
    if (timerEspontaneo) clearTimeout(timerEspontaneo);
    const atraso = CONFIG.intervaloMinMs + Math.random() * (CONFIG.intervaloMaxMs - CONFIG.intervaloMinMs);
    timerEspontaneo = setTimeout(async () => {
        try {
            const canais = canaisDaCategoria();
            if (canais.length) {
                const canal = canais[Math.floor(Math.random() * canais.length)];
                if (podeResponder(canal.id)) {
                    const texto = Math.random() < CONFIG.chanceOlimpiadas
                        ? gerarMensagemOlimpiadas()
                        : gerarMensagemLiga();
                    if (texto) await canal.send(texto);
                }
            }
        } catch (erro) {
            console.error('[Auto-Resposta] Espontânea:', erro.message);
        } finally {
            agendarProximaEspontanea();
        }
    }, atraso);
}

module.exports = client => {
    clienteAtual = client;

    client.on(Events.MessageCreate, async message => {
        try {
            if (message.author?.bot || !message.content) return;
            if (!estaNaCategoria(message.channel)) return;

            const inteligente = gerarRespostaInteligente(message);
            if (inteligente && Math.random() <= CONFIG.chanceRespostaInteligente && podeResponder(message.channelId)) {
                await message.reply(inteligente);
                return;
            }

            const tradicional = gerarRespostaTradicional(message.content);
            if (tradicional && podeResponder(message.channelId)) {
                await message.reply(String(tradicional));
            }
        } catch (erro) {
            console.error('[Auto-Resposta] MessageCreate:', erro.message);
        }
    });

    client.once(Events.ClientReady, () => {
        console.log('🤖 Auto-Resposta Inteligente V2 ativado.');
        console.log(`📁 Categoria monitorada: ${CONFIG.categoriaId}`);
        console.log('📈 Análise ativa: subidas, quedas, ultrapassagens, streaks e comparações.');
        agendarProximaEspontanea();
    });
};
