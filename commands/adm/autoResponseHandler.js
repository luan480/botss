/* ========================================================================
   WORLDWARBR — AUTO RESPOSTA V5
   Respostas conversacionais, inteligentes e contextuais.
   IMPORTANTE: jogadores/duplas são sempre apresentados por MENÇÃO Discord
   quando houver um ID válido. Nunca exibe IDs crus como nome.
   ======================================================================== */

const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
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
        'Calma, comandante. Uma derrota não apaga a campanha. 🫡',
        'O War decidiu testar sua estabilidade emocional hoje. 😂',
        'Respira. Não quebra o teclado. A Liga ainda tem revanche. 😭'
    ],
    vitoria: [
        'Aí sim! Pode comemorar, mas o ranking está olhando. 👀🏆',
        'Vitória registrada. Agora vem a parte difícil: repetir. 😏',
        'GG! O mapa perdeu mais uma vez para a estratégia. 🌍🔥',
        'Calma com a confiança... já vi líder virar espectador. 😂'
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
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }
    catch (e) { console.error('[Auto-Resposta] salvar JSON:', e.message); }
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
function mention(id) { return id ? `<@${String(id)}>` : 'esse jogador'; }
function categoria(channel) { return String(channel?.parentId || '') === CONFIG.categoriaId; }

function podeResponder(channelId) {
    const id = String(channelId);
    const agora = Date.now();
    if (agora - (cooldown.get(id) || 0) < CONFIG.cooldownCanalMs) return false;
    cooldown.set(id, agora);
    return true;
}

function escolher(items, key = 'global') {
    if (!Array.isArray(items) || !items.length) return '';
    const ultimo = ultimoModelo.get(key);
    const pool = items.length > 1 ? items.filter(x => x !== ultimo) : items;
    const valor = pool[Math.floor(Math.random() * pool.length)] || items[0];
    ultimoModelo.set(key, valor);
    return valor;
}

function tem(texto, termos) {
    const t = norm(texto);
    return termos.some(term => {
        const x = norm(term);
        if (!x) return false;
        if (x.length <= 2) return new RegExp(`(^|\\s)${x}(?=\\s|$)`, 'i').test(t);
        return t.includes(x);
    });
}

function perfil(id) {
    try { return estatisticasLiga.calcularPerfil(String(id)); }
    catch { return null; }
}

function ranking() {
    try { return estatisticasLiga.rankingPorPontos(CONFIG.maxRanking) || []; }
    catch { return []; }
}

function winrate(j) {
    const partidas = num(j?.partidas);
    if (!partidas) return 0;
    return num(j?.winrate) || (num(j?.vitorias) / partidas) * 100;
}

function streakTexto(j) {
    const atual = num(j?.streakAtual);
    const maior = num(j?.maiorStreak);
    if (atual >= 5) return `está em uma sequência MONSTRA de **${fmt(atual)} vitórias** 🔥🔥`;
    if (atual >= 3) return `vem de **${fmt(atual)} vitórias seguidas** e está embalado 🔥`;
    if (atual === 2) return 'venceu as **2 últimas partidas** e começou a embalar 👀';
    if (atual === 1) return 'venceu a partida mais recente e pode iniciar uma sequência';
    if (maior >= 3) return `já chegou a **${fmt(maior)} vitórias seguidas** anteriormente`;
    return 'não está em sequência de vitórias no momento';
}

/* Resolve qualquer nome/ID citado para um membro real do Discord. */
async function resolverJogador(guild, valor) {
    if (!guild || !valor) return null;
    const bruto = String(valor).trim();
    const id = bruto.match(/<@!?(\d{15,25})>/)?.[1] || (\d{15,25}/.test(bruto) ? bruto : null);
    if (id) {
        try { return await guild.members.fetch(id); } catch {}
    }

    const alvo = norm(bruto.replace(/^@/, ''));
    if (!alvo) return null;
    try {
        return guild.members.cache.find(m =>
            norm(m.user.username) === alvo ||
            norm(m.displayName) === alvo ||
            norm(m.user.globalName) === alvo ||
            norm(m.user.username).includes(alvo) ||
            norm(m.displayName).includes(alvo)
        ) || null;
    } catch { return null; }
}

async function mentionarJogador(guild, id) {
    if (!id) return 'esse jogador';
    const membro = await resolverJogador(guild, String(id));
    return membro ? `<@${membro.id}>` : mention(id);
}

function extrairMencoes(message) {
    return [...message.mentions.users.values()].map(u => String(u.id));
}

function resumo() {
    try { return estatisticasLiga.resumoLiga() || {}; }
    catch { return {}; }
}

function movimento() {
    const atual = ranking();
    const db = lerJson(inteligenciaPath, {});
    const anterior = db.ultimaClassificacao || {};
    const subindo = [], caindo = [], ultrapassagens = [];

    atual.forEach((j, i) => {
        const old = anterior[String(j.id)];
        if (!old) return;
        const pos = i + 1;
        const delta = num(old.posicao) - pos;
        if (delta > 0) subindo.push({ ...j, de: old.posicao, para: pos, delta });
        if (delta < 0) caindo.push({ ...j, de: old.posicao, para: pos, delta: Math.abs(delta) });
    });

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

async function analiseRanking(guild) {
    const r = ranking();
    if (!r.length) return '🏆 A Liga ainda está juntando dados. Assim que houver partidas, começa a fofoca estatística. 👀';

    const m = movimento();
    const up = [...m.subindo].sort((a, b) => b.delta - a.delta)[0];
    const down = [...m.caindo].sort((a, b) => b.delta - a.delta)[0];
    const over = m.ultrapassagens[0];
    const leader = r[0];
    const second = r[1];

    const opcoes = [];
    if (over) {
        opcoes.push(`⚔️ **ULTRAPASSAGEM DETECTADA**\n${await mentionarJogador(guild, over.a.id)} passou na frente de ${await mentionarJogador(guild, over.b.id)}. O ranking está começando a ficar pessoal. 👀`);
    }
    if (up) {
        opcoes.push(`📈 **QUEM ESTÁ SUBINDO?**\n${await mentionarJogador(guild, up.id)} ganhou **${fmt(up.delta)} posição(ões)** e foi do #${up.de} para o #${up.para}. Alguém acordou para a Liga. 🔥`);
    }
    if (down) {
        opcoes.push(`📉 **ALGUÉM PRECISA REAGIR**\n${await mentionarJogador(guild, down.id)} caiu do #${down.de} para o #${down.para}. O ranking não perdoa vacilo. 😬`);
    }
    if (second) {
        const gap = Math.abs(num(leader.pontos) - num(second.pontos));
        opcoes.push(`👑 **BRIGA PELO TRONO**\n${await mentionarJogador(guild, leader.id)} lidera com **${fmt(leader.pontos)} pts**. ${await mentionarJogador(guild, second.id)} está só **${fmt(gap)} pts** atrás. Uma partida e o roteiro muda. 🎬`);
    }
    if (opcoes.length) return escolher(opcoes, 'movimento-ranking');

    return `👑 ${await mentionarJogador(guild, leader.id)} está no topo com **${fmt(leader.pontos)} pts**. Ainda não detectei uma grande virada recente. 👀`;
}

async function raioX(guild, id) {
    const j = perfil(id);
    const tag = await mentionarJogador(guild, id);
    if (!j) return `🔎 Ainda não encontrei histórico suficiente de ${tag} na Liga.`;

    const r = ranking();
    const pos = r.findIndex(x => String(x.id) === String(id)) + 1;
    const m = movimento();
    const up = m.subindo.find(x => String(x.id) === String(id));
    const down = m.caindo.find(x => String(x.id) === String(id));
    let leitura = 'mantendo a posição observada';
    if (up) leitura = `subindo **${fmt(up.delta)} posição(ões)**`;
    if (down) leitura = `caindo **${fmt(down.delta)} posição(ões)**`;

    return [
        `🔎 **RAIO-X DA LIGA — ${tag}**`,
        `🏅 Posição: **#${pos || '—'}** • **${fmt(j.pontos)} pts**`,
        `🏆 **${fmt(j.vitorias)} vitórias** em **${fmt(j.partidas)} partidas** • Winrate **${winrate(j).toFixed(1)}%**`,
        `💀 **${fmt(j.kills)} kills** • **${fmt(j.mortes)} mortes**`,
        `🔥 ${tag} ${streakTexto(j)}.`,
        `📈 Momento do ranking: **${leitura}**.`
    ].join('\n');
}

async function comparar(guild, a, b) {
    if (!a || !b) return null;
    const r = ranking();
    const pa = r.findIndex(x => String(x.id) === String(a.id)) + 1;
    const pb = r.findIndex(x => String(x.id) === String(b.id)) + 1;
    const diff = num(a.pontos) - num(b.pontos);
    const vr = winrate(a) - winrate(b);
    const ma = await mentionarJogador(guild, a.id);
    const mb = await mentionarJogador(guild, b.id);
    const vencedor = diff > 0 ? ma : diff < 0 ? mb : null;
    const texto = diff === 0 ? `estão empatados em **${fmt(a.pontos)} pts**` : `${vencedor} está na frente por **${fmt(Math.abs(diff))} pts**`;

    return `⚔️ **DUELO DA LIGA**\n${ma} #${pa || '—'} x ${mb} #${pb || '—'}\n${texto}.\n🏆 Vitórias: **${fmt(a.vitorias)} x ${fmt(b.vitorias)}**\n💀 Kills: **${fmt(a.kills)} x ${fmt(b.kills)}**\n📈 Winrate: **${winrate(a).toFixed(1)}% x ${winrate(b).toFixed(1)}%**\n💡 ${vr === 0 ? 'Nos números de aproveitamento, os dois estão iguais.' : `${vr > 0 ? ma : mb} leva a melhor no aproveitamento.`}`;
}

/* ======================== OLIMPÍADAS ======================== */
function dadosOlimpiadas() {
    const d = lerJson(olympPath, {});
    if (!Array.isArray(d.duplas)) d.duplas = [];
    if (!Array.isArray(d.resultados)) d.resultados = [];
    return d;
}

function rankingOlimpiadas() {
    const d = dadosOlimpiadas();
    const duplas = new Map(d.duplas.map(x => [String(x.id), x]));
    const mapa = new Map();

    for (const resultado of d.resultados) {
        const medalhas = [
            [resultado?.ouro, 'ouro', 1],
            [resultado?.prata, 'prata', 0],
            [resultado?.bronze, 'bronze', 0]
        ];
        for (const [id, medalha, vitoria] of medalhas) {
            if (!id) continue;
            const dupla = duplas.get(String(id));
            if (!dupla?.pais) continue;
            const chave = norm(dupla.pais);
            if (!mapa.has(chave)) mapa.set(chave, { pais: dupla.pais, vitorias: 0, ouro: 0, prata: 0, bronze: 0, desempate: 0 });
            const item = mapa.get(chave);
            item[medalha]++;
            if (vitoria) item.vitorias++;
            if (medalha === 'prata') item.desempate += 3;
            if (medalha === 'bronze') item.desempate += 1;
        }
    }

    return [...mapa.values()].sort((a, b) =>
        b.vitorias - a.vitorias || b.ouro - a.ouro || b.prata - a.prata || b.bronze - a.bronze || b.desempate - a.desempate
    );
}

function pontuacaoOlimpica(item) {
    return num(item?.ouro) * 3 + num(item?.prata) * 2 + num(item?.bronze);
}

async function formatarDupla(guild, dupla) {
    if (!dupla) return 'dupla não identificada';
    const p1 = await mentionarJogador(guild, dupla.jogador1);
    const p2 = await mentionarJogador(guild, dupla.jogador2);
    return `${p1} + ${p2}`;
}

async function olimp(guild) {
    const d = dadosOlimpiadas();
    const rankingPais = rankingOlimpiadas();
    if (!rankingPais.length) return `🥇 **OLIMPÍADAS DE DUPLAS**\nAinda não tem resultado suficiente para eu começar a provocar os países. 😂`;

    const l = rankingPais[0];
    const s = rankingPais[1];
    const duplasPais = d.duplas.filter(x => norm(x.pais) === norm(l.pais));
    const dupla = duplasPais[0];
    const pontos = pontuacaoOlimpica(l);
    const duplaTexto = dupla ? await formatarDupla(guild, dupla) : '';

    return escolher([
        `🥇 **OLIMPÍADAS DE DUPLAS**\n${l.pais} está na frente com **${pontos} pts olímpicos** — 🥇 ${l.ouro} • 🥈 ${l.prata} • 🥉 ${l.bronze}. ${s ? `${s.pais} vem logo atrás.` : 'Ainda não apareceu um perseguidor forte.'} 👀`,
        `🏅 O quadro olímpico está esquentando. **${l.pais}** lidera com **${pontos} pts**. ${duplaTexto ? `A dupla registrada do país: ${duplaTexto}.` : ''} 🔥`,
        `🌍 **PLACAR DAS DUPLAS**\n${l.pais}: **${pontos} pts** • 🥇 ${l.ouro} • 🥈 ${l.prata} • 🥉 ${l.bronze}\nDuplas registradas: **${fmt(d.duplas.length)}**\nResultados: **${fmt(d.resultados.length)}** 🏆`
    ], 'olimpiadas');
}

/* ======================== CONTEXTO ======================== */
function salvarContexto(message) {
    const id = String(message.channelId);
    contexto.set(id, {
        autorId: String(message.author?.id || ''),
        texto: String(message.content || '').slice(0, 180),
        quando: Date.now()
    });
}

function temFollowUp(texto) {
    return tem(texto, ['e agora', 'então', 'entao', 'e ai', 'e aí', 'agora']);
}

/* ======================== RESPOSTAS INTELIGENTES ======================== */
async function respostaInteligente(message) {
    const texto = String(message.content || '');
    const t = norm(texto);
    const guild = message.guild;
    const mencoes = extrairMencoes(message);
    const r = ranking();

    if (mencoes.length >= 2 && tem(t, ['vs', 'versus', 'contra', 'comparar', 'duelo', 'quem é melhor', 'quem ganha'])) {
        const a = perfil(mencoes[0]);
        const b = perfil(mencoes[1]);
        if (a && b) return comparar(guild, a, b);
    }

    if (mencoes.length >= 1 && tem(t, ['pontos', 'pontuacao', 'pontuação', 'estatistica', 'estatísticas', 'stats', 'raio x', 'desempenho', 'ranking'])) {
        return raioX(guild, mencoes[0]);
    }

    if (tem(t, ['sequencia', 'sequência', 'vitórias seguidas', 'streak', 'embalado'])) {
        const alvo = mencoes[0] || String(message.author?.id || '');
        const j = perfil(alvo);
        if (j) return `🔥 ${await mentionarJogador(guild, alvo)} ${streakTexto(j)}.`;
    }

    if (tem(t, ['quem esta subindo', 'quem está subindo', 'subindo no ranking', 'quem subiu', 'quem caiu', 'caindo', 'ultrapassagem', 'ultrapassou', 'ranking']) && r.length) {
        return analiseRanking(guild);
    }

    if (tem(t, ['olimpiada', 'olimpíada', 'olimpiadas', 'olimpíadas', 'duplas', 'medalha', 'ouro', 'prata', 'bronze'])) {
        return olimp(guild);
    }

    if (tem(t, ['liga', 'liga das nacoes', 'liga das nações', 'pontuacao da liga', 'pontuação da liga', 'classificacao', 'classificação'])) {
        const s = resumo();
        if (r.length) {
            const lider = r[0];
            const segundo = r[1];
            const gap = segundo ? Math.abs(num(lider.pontos) - num(segundo.pontos)) : 0;
            const liderTag = await mentionarJogador(guild, lider.id);
            const segundoTag = segundo ? await mentionarJogador(guild, segundo.id) : null;
            return escolher([
                `🏆 **LIGA DAS NAÇÕES**\n${liderTag} está no topo com **${fmt(lider.pontos)} pts**.${segundoTag ? ` ${segundoTag} está ${fmt(gap)} pts atrás.` : ''}\n${s.partidas ? `📊 Já temos **${fmt(s.partidas)} partidas** registradas.` : '📊 A temporada ainda está começando.'} 👀`,
                `📊 Dei uma olhada na Liga: ${liderTag} lidera. ${segundoTag ? `Mas ${segundoTag} está na cola.` : 'Ainda falta alguém apertar a liderança.'} Uma partida pode bagunçar tudo. 😂`
            ], 'liga-geral');
        }
    }

    if (temFollowUp(texto)) {
        const ctx = contexto.get(String(message.channelId));
        if (ctx && Date.now() - ctx.quando < 5 * 60 * 1000) {
            const p = perfil(ctx.autorId);
            if (p) return `👀 E agora? ${await mentionarJogador(guild, ctx.autorId)} continua com **${fmt(p.pontos)} pts** na Liga. O próximo capítulo depende do dado. 🎲`;
        }
    }

    return null;
}

/* ======================== AUTO RESPOSTA TRADICIONAL ======================== */
function tradicional(texto) {
    const db = lerJson(dbPath, {});
    if (!db || typeof db !== 'object') return null;

    const entradas = Object.entries(db);
    const candidatas = [];
    const t = norm(texto);

    for (const [chave, respostas] of entradas) {
        const gatilhos = [chave];
        if (Array.isArray(respostas)) {
            for (const item of respostas) {
                if (item && typeof item === 'object') {
                    if (Array.isArray(item.gatilhos)) gatilhos.push(...item.gatilhos);
                    if (Array.isArray(item.palavras)) gatilhos.push(...item.palavras);
                }
            }
        }
        const encontrados = gatilhos.filter(g => tem(t, [g]));
        if (encontrados.length) candidatas.push({ chave, respostas, peso: encontrados.reduce((n, g) => n + norm(g).length, 0) });
    }

    candidatas.sort((a, b) => b.peso - a.peso);
    const melhor = candidatas[0];
    if (!melhor) return null;

    if (Array.isArray(melhor.respostas)) {
        const validas = melhor.respostas.map(x => typeof x === 'string' ? x : x?.resposta).filter(Boolean);
        return escolher(validas, `tradicional-${melhor.chave}`);
    }
    if (typeof melhor.respostas === 'string') return melhor.respostas;
    return null;
}

function humor(texto) {
    if (tem(texto, ['kkkk', 'kkk', 'haha', 'hahaha', 'rsrs', '🤣', '😂'])) return escolher(HUMOR.riso, 'humor-riso');
    if (tem(texto, ['perdi', 'perdeu', 'derrota', 'perder', 'fui derrotado', 'morreu'])) return escolher(HUMOR.derrota, 'humor-derrota');
    if (tem(texto, ['ganhei', 'ganhou', 'venci', 'venceu', 'vitória', 'vitoria', 'win'])) return escolher(HUMOR.vitoria, 'humor-vitoria');
    if (tem(texto, ['traidor', 'traiu', 'rival', 'inimigo', 'vou pegar', 'vou atacar'])) return escolher(HUMOR.provocacao, 'humor-provocacao');
    if (tem(texto, ['desistir', 'desisti', 'não consigo', 'nao consigo', 'triste', 'azar'])) return escolher(HUMOR.incentivo, 'humor-incentivo');
    return null;
}

/* ======================== ESPONTÂNEA ======================== */
async function enviarEspontanea() {
    if (!clienteAtual) return;
    try {
        const guilds = [...clienteAtual.guilds.cache.values()];
        for (const guild of guilds) {
            const canais = [...guild.channels.cache.values()].filter(c => categoria(c) && c.isTextBased?.());
            if (!canais.length) continue;
            const canal = canais[Math.floor(Math.random() * canais.length)];
            if (!canal || !podeResponder(canal.id)) continue;

            const opcoes = [
                await analiseRanking(guild),
                await olimp(guild),
                '👀 A Liga está quieta demais... isso nunca é um bom sinal.',
                '🎲 Estou começando a desconfiar que o dado tem favoritos.',
                '🏆 Tem gente olhando o ranking em silêncio e fingindo que não está preocupado. 😂'
            ];
            await canal.send(escolher(opcoes, `espontanea-${canal.id}`));
            break;
        }
    } catch (e) {
        console.error('[Auto-Resposta] espontânea:', e.message);
    }
}

function agendar() {
    if (timer) clearTimeout(timer);
    const intervalo = CONFIG.espontaneaMinMs + Math.floor(Math.random() * (CONFIG.espontaneaMaxMs - CONFIG.espontaneaMinMs));
    timer = setTimeout(async () => {
        await enviarEspontanea();
        agendar();
    }, intervalo);
}

module.exports = function iniciarAutoResposta(client) {
    if (!client) return;
    clienteAtual = client;

    client.on(Events.MessageCreate, async message => {
        try {
            if (!message.guild || message.author?.bot) return;
            if (!categoria(message.channel)) return;

            salvarContexto(message);

            if (Math.random() > CONFIG.respostaChance) return;
            if (!podeResponder(message.channelId)) return;

            const inteligente = await respostaInteligente(message);
            if (inteligente) {
                await message.reply(inteligente);
                salvarSnapshot();
                return;
            }

            const engraçada = humor(message.content);
            if (engraçada) {
                await message.reply(engraçada);
                return;
            }

            const antiga = tradicional(message.content);
            if (antiga) await message.reply(String(antiga));
        } catch (e) {
            console.error('[Auto-Resposta] MessageCreate:', e.message);
        }
    });

    client.once(Events.ClientReady, () => {
        console.log('🤖 Auto Resposta V5 ativada — Liga/Olimpíadas + mentions inteligentes.');
        salvarSnapshot();
        agendar();
    });
};
