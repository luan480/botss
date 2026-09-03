/* ========================================================================
   WORLDWARBR — AUTO RESPOSTA V4
   Conversacional, bem-humorada e integrada à Liga/Olimpíadas.
   Mantém compatibilidade com commands/adm/auto_respostas.json.
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
    cooldownCanalMs: 75 * 1000,
    respostaChance: 0.88,
    espontaneaMinMs: 12 * 60 * 1000,
    espontaneaMaxMs: 28 * 60 * 1000,
    maxRanking: 50
};

const cooldown = new Map();
const ultimoModelo = new Map();
const contexto = new Map();
let clienteAtual = null;
let timer = null;

const HUMOR = {
    riso: [
        'KKKKKKKK aí você me quebra 😂',
        'KKKK isso escalou rápido demais. 😂',
        'Eu não devia rir disso... mas ri. 🤣',
        'O servidor perdeu a seriedade oficialmente. 💀'
    ],
    derrota: [
        'Faz parte. Até General já olhou pro dado e pensou: “não é possível”. 🎲💀',
        'Calma, comandante. Uma derrota não apaga a campanha. A próxima pode ser sua. 🫡',
        'O War decidiu testar sua estabilidade emocional hoje. 😂',
        'Respira. Não quebra o teclado. A Liga ainda tem revanche. 😭'
    ],
    vitoria: [
        'Aí sim! Pode comemorar, mas não esquece que o ranking está olhando. 👀🏆',
        'Vitória registrada. Agora vem a parte difícil: repetir. 😏',
        'GG! O mapa perdeu mais uma vez para a estratégia. 🌍🔥',
        'Calma com a confiança... já vi líder virar espectador em uma partida. 😂'
    ],
    provocacao: [
        'Opa... senti cheiro de rivalidade no ar. 👀',
        'Isso aí já parece início de guerra diplomática. 😂',
        'Anotado. Vou guardar essa frase para quando o ranking mudar. 📝',
        'Fala baixo que o rival pode estar lendo. 👁️'
    ],
    incentivo: [
        'Vai na fé. A Liga não se ganha olhando o ranking, se ganha jogando. 🫡',
        'Ainda dá para virar. Uma boa partida muda muita coisa por aqui. 🔥',
        'Cabeça fria, objetivo claro e dado na mão. Bora. 🎲',
        'Não desiste agora. A campanha ainda pode contar outra história. 🏆'
    ]
};

function lerJson(file, fallback = {}) {
    try {
        if (!fs.existsSync(file)) return fallback;
        const raw = fs.readFileSync(file, 'utf8');
        if (!raw.trim()) return fallback;
        const data = JSON.parse(raw);
        return data && typeof data === 'object' ? data : fallback;
    } catch (e) {
        console.error('[Auto-Resposta] JSON:', e.message);
        return fallback;
    }
}

function salvarJson(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('[Auto-Resposta] salvar JSON:', e.message);
    }
}

function norm(value) {
    return String(value ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/\s+/g, ' ').trim();
}

function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function fmt(value) { return num(value).toLocaleString('pt-BR'); }
function mention(id) { return id ? `<@${id}>` : 'esse jogador'; }
function categoria(channel) { return String(channel?.parentId || '') === CONFIG.categoriaId; }

function podeResponder(channelId) {
    const id = String(channelId);
    const now = Date.now();
    if (now - (cooldown.get(id) || 0) < CONFIG.cooldownCanalMs) return false;
    cooldown.set(id, now);
    return true;
}

function escolher(items, key = 'global') {
    if (!Array.isArray(items) || !items.length) return '';
    const last = ultimoModelo.get(key);
    const pool = items.length > 1 ? items.filter(x => x !== last) : items;
    const value = pool[Math.floor(Math.random() * pool.length)] || items[0];
    ultimoModelo.set(key, value);
    return value;
}

function tem(text, terms) {
    const t = norm(text);
    return terms.some(term => {
        const x = norm(term);
        if (!x) return false;
        if (x.length <= 2) return new RegExp(`(^|\\s)${x}(?=\\s|$)`, 'i').test(t);
        return t.includes(x);
    });
}

function perfil(id) {
    try { return estatisticasLiga.calcularPerfil(String(id)); } catch { return null; }
}

function ranking() {
    try { return estatisticasLiga.rankingPorPontos(CONFIG.maxRanking) || []; } catch { return []; }
}

function winrate(j) {
    const p = num(j?.partidas);
    if (!p) return 0;
    return num(j?.winrate) || (num(j.vitorias) / p) * 100;
}

function streak(j) {
    const atual = num(j?.streakAtual);
    const maior = num(j?.maiorStreak);
    if (atual >= 5) return `está em uma sequência MONSTRA de **${fmt(atual)} vitórias** 🔥🔥`;
    if (atual >= 3) return `vem de **${fmt(atual)} vitórias seguidas** e está embalado 🔥`;
    if (atual === 2) return 'venceu as **2 últimas partidas** e começou a embalar 👀';
    if (atual === 1) return 'venceu a partida mais recente e pode iniciar uma sequência';
    if (maior >= 3) return `está sem sequência ativa, mas já chegou a **${fmt(maior)} vitórias seguidas**`;
    return 'não está em sequência de vitórias no momento';
}

function resumo() {
    try { return estatisticasLiga.resumoLiga() || {}; } catch { return {}; }
}

function movimento() {
    const atual = ranking();
    const db = lerJson(inteligenciaPath, {});
    const anterior = db.ultimaClassificacao || {};
    const subindo = [], caindo = [];

    atual.forEach((j, i) => {
        const old = anterior[String(j.id)];
        if (!old) return;
        const pos = i + 1;
        const delta = num(old.posicao) - pos;
        if (delta > 0) subindo.push({ ...j, de: old.posicao, para: pos, delta });
        if (delta < 0) caindo.push({ ...j, de: old.posicao, para: pos, delta: Math.abs(delta) });
    });

    const ultrapassagens = [];
    for (let i = 0; i < atual.length; i++) {
        for (let j = i + 1; j < atual.length; j++) {
            const a = atual[i], b = atual[j];
            const pa = anterior[String(a.id)]?.posicao;
            const pb = anterior[String(b.id)]?.posicao;
            if (pa && pb && pa > pb) ultrapassagens.push({ a, b });
        }
    }
    return { atual, subindo, caindo, ultrapassagens };
}

function salvarSnapshot() {
    const r = ranking();
    if (!r.length) return;
    const db = lerJson(inteligenciaPath, {});
    db.ultimaClassificacao = {};
    r.forEach((j, i) => {
        db.ultimaClassificacao[String(j.id)] = { posicao: i + 1, pontos: num(j.pontos) };
    });
    db.atualizadoEm = new Date().toISOString();
    salvarJson(inteligenciaPath, db);
}

function analiseRanking() {
    const r = ranking();
    if (!r.length) return '🏆 A Liga ainda está juntando dados. Assim que houver partidas, eu começo a fofoca estatística. 👀';
    const m = movimento();
    const up = [...m.subindo].sort((a, b) => b.delta - a.delta)[0];
    const down = [...m.caindo].sort((a, b) => b.delta - a.delta)[0];
    const over = m.ultrapassagens[0];
    const leader = r[0], second = r[1];

    const opcoes = [];
    if (over) opcoes.push(`⚔️ **ULTRAPASSAGEM DETECTADA**\n${mention(over.a.id)} passou na frente de ${mention(over.b.id)}. O ranking está começando a ficar pessoal. 👀`);
    if (up) opcoes.push(`📈 **QUEM ESTÁ SUBINDO?**\n${mention(up.id)} ganhou **${fmt(up.delta)} posição(ões)** e foi do #${up.de} para o #${up.para}. Alguém acordou para a Liga. 🔥`);
    if (down) opcoes.push(`📉 **ALGUÉM PRECISA REAGIR**\n${mention(down.id)} caiu do #${down.de} para o #${down.para}. O ranking não perdoa vacilo. 😬`);
    if (second) opcoes.push(`👑 **BRIGA PELO TRONO**\n${mention(leader.id)} lidera com **${fmt(leader.pontos)} pts**. ${mention(second.id)} está só **${fmt(Math.abs(num(leader.pontos) - num(second.pontos)))} pts** atrás. Uma partida e o roteiro muda. 🎬`);
    if (opcoes.length) return escolher(opcoes, 'movimento-ranking');
    return `👑 ${mention(leader.id)} está no topo com **${fmt(leader.pontos)} pts**. Ainda não detectei uma grande virada recente, mas isso pode mudar na próxima partida. 👀`;
}

function raioX(id) {
    const j = perfil(id);
    if (!j) return `🔎 Ainda não encontrei histórico suficiente de ${mention(id)} na Liga.`;
    const r = ranking();
    const pos = r.findIndex(x => String(x.id) === String(id)) + 1;
    const m = movimento();
    const up = m.subindo.find(x => String(x.id) === String(id));
    const down = m.caindo.find(x => String(x.id) === String(id));
    let leitura = 'mantendo a posição observada';
    if (up) leitura = `subindo **${fmt(up.delta)} posição(ões)**`;
    if (down) leitura = `caindo **${fmt(down.delta)} posição(ões)**`;

    return [
        `🔎 **RAIO-X DA LIGA — ${mention(id)}**`,
        `🏅 Posição: **#${pos || '—'}** • **${fmt(j.pontos)} pts**`,
        `🏆 **${fmt(j.vitorias)} vitórias** em **${fmt(j.partidas)} partidas** • Winrate **${winrate(j).toFixed(1)}%**`,
        `💀 **${fmt(j.kills)} kills** • **${fmt(j.mortes)} mortes**`,
        `🔥 ${mention(id)} ${streak(j)}.`,
        `📈 Momento do ranking: **${leitura}**.`
    ].join('\n');
}

function comparar(a, b) {
    if (!a || !b) return null;
    const r = ranking();
    const pa = r.findIndex(x => String(x.id) === String(a.id)) + 1;
    const pb = r.findIndex(x => String(x.id) === String(b.id)) + 1;
    const diff = num(a.pontos) - num(b.pontos);
    const vr = winrate(a) - winrate(b);
    const vencedor = diff > 0 ? a : diff < 0 ? b : null;
    const texto = diff === 0
        ? `estão empatados em **${fmt(a.pontos)} pts**`
        : `${mention(vencedor.id)} está na frente por **${fmt(Math.abs(diff))} pts**`;
    return `⚔️ **DUELO DA LIGA**\n${mention(a.id)} #${pa || '—'} x ${mention(b.id)} #${pb || '—'}\n${texto}.\n🏆 Vitórias: **${fmt(a.vitorias)} x ${fmt(b.vitorias)}**\n💀 Kills: **${fmt(a.kills)} x ${fmt(b.kills)}**\n📈 Winrate: **${winrate(a).toFixed(1)}% x ${winrate(b).toFixed(1)}%**\n💡 ${vr === 0 ? 'Nos números de aproveitamento, os dois estão iguais.' : `${mention(vr > 0 ? a.id : b.id)} leva a melhor no aproveitamento.`}`;
}

function dadosOlimpiadas() {
    const d = lerJson(olympPath, {});
    if (!Array.isArray(d.duplas)) d.duplas = [];
    if (!Array.isArray(d.resultados)) d.resultados = [];
    if (!d.ranking || typeof d.ranking !== 'object') d.ranking = {};
    return d;
}

function olimp() {
    const d = dadosOlimpiadas();
    const r = Object.entries(d.ranking)
        .map(([pais, x]) => ({ pais, ...(x && typeof x === 'object' ? x : { pontos: num(x) }) }))
        .sort((a, b) => num(b.pontos) - num(a.pontos));
    if (!r.length) return `🥇 **OLIMPÍADAS DE DUPLAS**\nAinda não tem resultado suficiente para eu começar a provocar os países. 😂`;
    const l = r[0], s = r[1];
    return escolher([
        `🥇 **OLIMPÍADAS DE DUPLAS**\n${l.pais} está na frente com **${fmt(l.pontos)} pts**. ${s ? `${s.pais} vem logo atrás.` : 'Ainda não apareceu um perseguidor forte.'} 👀`,
        `🏅 O quadro olímpico está começando a esquentar. **${l.pais}** lidera com **${fmt(l.pontos)} pts** e já está fazendo pressão. 🔥`,
        `🌍 **PLACAR DAS DUPLAS**\n${l.pais}: **${fmt(l.pontos)} pts**\nDuplas registradas: **${fmt(d.duplas.length)}**\nResultados: **${fmt(d.resultados.length)}**\nA disputa está oficialmente aberta. 🏆`
    ], 'olimpiadas');
}

function contextoResposta(message, base) {
    const id = String(message.channelId);
    const anterior = contexto.get(id);
    contexto.set(id, { texto: message.content, autor: String(message.author.id), em: Date.now() });
    if (!anterior || Date.now() - anterior.em > 10 * 60 * 1000) return base;
    const atual = norm(message.content);
    if (tem(atual, ['e agora', 'e ai', 'e aí', 'entao', 'então', 'agora'])) {
        return `${base}\n\n👀 E sim, eu sei que você quer saber o próximo capítulo. Agora é jogar e deixar o ranking responder.`;
    }
    return base;
}

function respostaInteligente(message) {
    const t = message.content || '';
    const ids = [...message.mentions.users.keys()].slice(0, 2);

    if (ids.length === 2 && tem(t, ['comparar', 'compare', 'versus', 'vs', 'contra', 'duelo', 'melhor'])) {
        return comparar(perfil(ids[0]), perfil(ids[1]));
    }
    if (ids.length === 1 && tem(t, ['pontos', 'pontuacao', 'pontuação', 'ranking', 'estatistica', 'estatística', 'desempenho', 'como estou', 'como to', 'como tô'])) {
        return raioX(ids[0]);
    }
    if (tem(t, ['quem subiu', 'quem caiu', 'quem esta subindo', 'quem está subindo', 'quem esta caindo', 'quem está caindo', 'ultrapassagem', 'ultrapassou', 'movimentacao', 'movimentação'])) return analiseRanking();
    if (tem(t, ['sequencia', 'sequência', 'streak', 'vitorias seguidas', 'vitórias seguidas', 'embalado'])) {
        const r = ranking();
        const j = [...r].sort((a, b) => num(b.streakAtual) - num(a.streakAtual))[0];
        return j && num(j.streakAtual) > 0 ? `🔥 **STREAK DA LIGA**\n${mention(j.id)} ${streak(j)}.` : '🔥 Ainda não apareceu uma sequência ativa digna de cinema. Quero ver quem vai começar.';
    }
    if (tem(t, ['olimpiada', 'olimpíada', 'olimpiadas', 'olimpíadas', 'duplas', 'medalha', 'ouro', 'prata', 'bronze'])) return olimp();
    if (tem(t, ['liga', 'ranking', 'lider', 'líder', 'primeiro lugar', 'quem lidera', 'quem esta ganhando', 'quem está ganhando', 'campeao', 'campeão'])) return analiseRanking();
    return null;
}

function tradicional(texto) {
    try {
        const db = safeReadJson(dbPath, {});
        if (!db || typeof db !== 'object') return null;
        const t = norm(texto);
        const candidatos = [];
        for (const [gatilho, respostas] of Object.entries(db)) {
            if (!Array.isArray(respostas)) continue;
            const g = norm(gatilho);
            if (!g) continue;
            let pontos = 0;
            if (g.length <= 2) pontos = new RegExp(`(^|\\s)${g}(?=\\s|$)`, 'i').test(t) ? 10 : 0;
            else if (t.includes(g)) pontos = g.length + 10;
            if (pontos) candidatos.push({ gatilho, respostas, pontos });
        }
        candidatos.sort((a, b) => b.pontos - a.pontos);
        if (!candidatos.length) return null;
        const melhor = candidatos[0];
        return escolher(melhor.respostas, `tradicional:${melhor.gatilho}`);
    } catch (e) {
        console.error('[Auto-Resposta] tradicional:', e.message);
        return null;
    }
}

function humano(texto) {
    if (tem(texto, ['kkkk', 'kkk', 'haha', 'hahaha', 'rsrs', '😂', '🤣'])) return escolher(HUMOR.riso, 'humor-riso');
    if (tem(texto, ['perdi', 'perdemos', 'derrota', 'perdeu', 'morreu', 'morte'])) return escolher(HUMOR.derrota, 'humor-derrota');
    if (tem(texto, ['ganhei', 'ganhamos', 'ganhou', 'vitoria', 'vitória', 'gg'])) return escolher(HUMOR.vitoria, 'humor-vitoria');
    if (tem(texto, ['ruim', 'lixo', 'noob', 'fraco', 'humilhar', 'chora'])) return escolher(HUMOR.provocacao, 'humor-provocacao');
    if (tem(texto, ['desisti', 'desistir', 'nao consigo', 'não consigo', 'to ruim', 'tô ruim'])) return escolher(HUMOR.incentivo, 'humor-incentivo');
    return null;
}

function canais() {
    if (!clienteAtual?.channels?.cache) return [];
    return [...clienteAtual.channels.cache.values()].filter(c => categoria(c) && typeof c.send === 'function' && c.isTextBased?.());
}

function agendar() {
    if (timer) clearTimeout(timer);
    const atraso = CONFIG.espontaneaMinMs + Math.random() * (CONFIG.espontaneaMaxMs - CONFIG.espontaneaMinMs);
    timer = setTimeout(async () => {
        try {
            const lista = canais();
            if (!lista.length) return;
            const canal = lista[Math.floor(Math.random() * lista.length)];
            if (!podeResponder(canal.id)) return;
            const texto = Math.random() < 0.72 ? analiseRanking() : olimp();
            if (texto) await canal.send(texto);
        } catch (e) {
            console.error('[Auto-Resposta] espontânea:', e.message);
        } finally { agendar(); }
    }, atraso);
}

module.exports = client => {
    clienteAtual = client;
    client.on(Events.MessageCreate, async message => {
        try {
            if (message.author?.bot || !message.content || !categoria(message.channel)) return;
            const inteligente = respostaInteligente(message);
            if (inteligente && Math.random() <= CONFIG.respostaChance && podeResponder(message.channelId)) {
                await message.reply(contextoResposta(message, inteligente));
                salvarSnapshot();
                return;
            }
            const engraçada = humano(message.content);
            if (engraçada && Math.random() < 0.72 && podeResponder(message.channelId)) {
                await message.reply(engraçada);
                return;
            }
            const antiga = tradicional(message.content);
            if (antiga && podeResponder(message.channelId)) await message.reply(String(antiga));
        } catch (e) {
            console.error('[Auto-Resposta] MessageCreate:', e.message);
        }
    });
    client.once(Events.ClientReady, () => {
        console.log('🤖 Auto-Resposta V4 ativado — humor + contexto + Liga + Olimpíadas.');
        console.log(`📁 Categoria monitorada: ${CONFIG.categoriaId}`);
        console.log('🧠 Inteligência: ranking, ultrapassagens, streaks, duelos e respostas contextuais.');
        agendar();
    });
};
