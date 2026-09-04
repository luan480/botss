/* ========================================================================
   WORLDWARBR — AUTO RESPOSTA V7
   Inteligência conversacional + Liga das Nações + Olimpíadas.
   Canais de texto/voz resolvidos dinamicamente dentro da categoria.
   Pensamentos automáticos publicados a cada 10 minutos.
   ======================================================================== */

const { Events, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const estatisticasLiga = require('../liga/utils/estatisticasLiga.js');

const dbPath = path.join(__dirname, 'auto_respostas.json');
const inteligenciaPath = path.join(__dirname, 'auto_inteligencia.json');
const olympPath = path.join(__dirname, '..', 'olimpiadas', 'olimpiadas.json');

const CONFIG = {
    categoriaId: '849698902634004510',
    cooldownCanalMs: 60 * 1000,
    respostaChance: 0.90,
    pensamentoIntervaloMs: 10 * 60 * 1000,
    maxRanking: 50
};

const cooldown = new Map();
const ultimoModelo = new Map();
const contexto = new Map();
const mensagensProcessadas = new Set();
let clienteAtual = null;
let timer = null;

const HUMOR = {
    riso: ['KKKKKK aí você me quebra 😂', 'KKKK isso já virou reunião de crise. 💀', 'Eu não devia rir disso... mas ri. 🤣', 'O servidor perdeu a seriedade oficialmente. 😂'],
    derrota: ['Calma, comandante. Uma derrota não apaga a campanha. 🫡', 'O dado hoje acordou com vontade de causar. 🎲💀', 'Respira. A Liga ainda não acabou. 😭', 'Até os melhores têm dia de desastre estratégico. 😂'],
    vitoria: ['Aí sim! Agora quero ver repetir. 👀🏆', 'GG! Vitória registrada. A confiança subiu, agora não deixa ela subir mais que os pontos. 😂', 'Boa! O mapa sofreu mais uma derrota estratégica. 🌍🔥', 'Comemora, mas lembra: o ranking tem memória. 😏'],
    provocacao: ['Opa... senti cheiro de rivalidade. 👀', 'Isso já parece começo de guerra diplomática. 😂', 'Anotado. Vou guardar essa para a próxima atualização do ranking. 📝', 'Fala baixo que o rival pode estar lendo. 👁️'],
    incentivo: ['Ainda dá para virar. Uma partida muda muita coisa. 🔥', 'Cabeça fria, estratégia e dado na mão. Bora. 🎲', 'Não entrega a campanha agora. 🫡', 'O ranking não é sentença; é convite para revanche. 🏆']
};

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

function norm(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function fmt(value) { return num(value).toLocaleString('pt-BR'); }
function mention(id) { return id ? `<@${String(id)}>` : 'esse jogador'; }
function categoria(channel) { return String(channel?.parentId || '') === CONFIG.categoriaId; }

function canaisWar(guild) {
    if (!guild) return { texto: null, voz: null };
    const canais = [...guild.channels.cache.values()].filter(c => String(c.parentId || '') === CONFIG.categoriaId);
    const pontuar = (channel, palavras) => {
        const nome = norm(channel?.name);
        return palavras.reduce((score, palavra, index) => score + (nome.includes(norm(palavra)) ? (palavras.length - index) : 0), 0);
    };
    const textos = canais.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement);
    const vozes = canais.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice);
    const texto = [...textos].sort((a, b) => pontuar(b, ['war', '🌍', 'partida', 'jogo']) - pontuar(a, ['war', '🌍', 'partida', 'jogo']) || norm(a.name).localeCompare(norm(b.name)))[0] || null;
    const voz = [...vozes].sort((a, b) => pontuar(b, ['war', '🌍', 'call', 'jogo']) - pontuar(a, ['war', '🌍', 'call', 'jogo']) || norm(a.name).localeCompare(norm(b.name)))[0] || null;
    return { texto, voz };
}

function substituirCanais(guild, resposta) {
    if (!guild || typeof resposta !== 'string') return resposta;
    const { texto, voz } = canaisWar(guild);
    return resposta
        .replace(/\{CANAL_TEXTO_WAR\}/g, texto ? `<#${texto.id}>` : '#🌍 • WAR')
        .replace(/\{CANAL_VOZ_WAR\}/g, voz ? `<#${voz.id}>` : 'um canal de voz')
        .replace(/<#849698902634004510>/g, texto ? `<#${texto.id}>` : '#🌍 • WAR');
}

function canalPensamentos(guild) {
    if (!guild) return null;
    const canais = [...guild.channels.cache.values()].filter(c => {
        if (!(c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)) return false;
        const nome = norm(c.name);
        return nome.includes('o que vc ta pensando') || nome.includes('o que voce ta pensando') || nome.includes('o que estou pensando') || nome.includes('pensando do bot') || nome.includes('pensamento do bot');
    });
    return canais.find(c => String(c.parentId || '') === CONFIG.categoriaId) || canais[0] || null;
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

function escolher(items, key = 'global') {
    if (!Array.isArray(items) || !items.length) return '';
    const ultimo = ultimoModelo.get(key);
    const pool = items.length > 1 ? items.filter(x => x !== ultimo) : items;
    const valor = pool[Math.floor(Math.random() * pool.length)] || items[0];
    ultimoModelo.set(key, valor);
    return valor;
}

function podeResponder(channelId) {
    const id = String(channelId);
    const agora = Date.now();
    if (agora - (cooldown.get(id) || 0) < CONFIG.cooldownCanalMs) return false;
    cooldown.set(id, agora);
    return true;
}

function perfil(id) { try { return estatisticasLiga.calcularPerfil(String(id)); } catch { return null; } }
function ranking() { try { return estatisticasLiga.rankingPorPontos(CONFIG.maxRanking) || []; } catch { return []; } }
function resumo() { try { return estatisticasLiga.resumoLiga() || {}; } catch { return {}; } }
function winrate(j) { const partidas = num(j?.partidas); if (!partidas) return 0; return num(j?.winrate) || (num(j?.vitorias) / partidas) * 100; }
function saldo(j) { return num(j?.pontosGanhos) - num(j?.pontosPerdidos); }

function streakTexto(j) {
    const atual = num(j?.streakAtual), maior = num(j?.maiorStreak);
    if (atual >= 5) return `está em uma sequência MONSTRA de **${fmt(atual)} vitórias** 🔥🔥`;
    if (atual >= 3) return `vem de **${fmt(atual)} vitórias seguidas** e está embalado 🔥`;
    if (atual === 2) return 'venceu as **2 últimas partidas** e começou a embalar 👀';
    if (atual === 1) return 'venceu a partida mais recente e pode iniciar uma sequência';
    if (maior >= 3) return `já chegou a **${fmt(maior)} vitórias seguidas** anteriormente`;
    return 'não está em sequência de vitórias no momento';
}

async function resolverJogador(guild, valor) {
    if (!guild || !valor) return null;
    const bruto = String(valor).trim();
    const idMatch = bruto.match(/<@!?(\d{15,25})>/);
    const id = idMatch?.[1] || (/^\d{15,25}$/.test(bruto) ? bruto : null);
    if (id) { try { return await guild.members.fetch(id); } catch {} }
    const alvo = norm(bruto.replace(/^@/, ''));
    if (!alvo) return null;
    try {
        return guild.members.cache.find(m => norm(m.user.username) === alvo || norm(m.displayName) === alvo || norm(m.user.globalName) === alvo || norm(m.user.username).includes(alvo) || norm(m.displayName).includes(alvo)) || null;
    } catch { return null; }
}

async function mentionarJogador(guild, id) {
    if (!id) return 'esse jogador';
    const membro = await resolverJogador(guild, String(id));
    return membro ? `<@${membro.id}>` : mention(id);
}
function extrairMencoes(message) { return [...message.mentions.users.values()].map(u => String(u.id)); }

function snapshotAnterior() { return lerJson(inteligenciaPath, {}).ultimaClassificacao || {}; }
function movimento() {
    const r = ranking(), anterior = snapshotAnterior(), subindo = [], caindo = [], ultrapassagens = [];
    r.forEach((j, i) => {
        const old = anterior[String(j.id)]; if (!old) return;
        const pos = i + 1, delta = num(old.posicao) - pos;
        if (delta > 0) subindo.push({ ...j, de: old.posicao, para: pos, delta });
        if (delta < 0) caindo.push({ ...j, de: old.posicao, para: pos, delta: Math.abs(delta) });
    });
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
        const a = r[i], b = r[j], pa = anterior[String(a.id)]?.posicao, pb = anterior[String(b.id)]?.posicao;
        if (pa && pb && pa > pb) ultrapassagens.push({ a, b });
    }
    return { atual: r, subindo, caindo, ultrapassagens };
}

function salvarSnapshot() {
    const r = ranking(); if (!r.length) return;
    const db = lerJson(inteligenciaPath, {}); db.ultimaClassificacao = {};
    r.forEach((j, i) => { db.ultimaClassificacao[String(j.id)] = { posicao: i + 1, pontos: num(j.pontos) }; });
    db.atualizadoEm = new Date().toISOString(); salvarJson(inteligenciaPath, db);
}
function maiorPor(r, campo) { return [...r].sort((a, b) => num(b?.[campo]) - num(a?.[campo]))[0] || null; }

async function analiseRanking(guild) {
    const r = ranking();
    if (!r.length) return '🏆 A Liga ainda está juntando dados. Assim que sair partida, eu começo a fofoca estatística. 👀';
    const m = movimento(), lider = r[0], segundo = r[1];
    const up = [...m.subindo].sort((a, b) => b.delta - a.delta)[0], down = [...m.caindo].sort((a, b) => b.delta - a.delta)[0], over = m.ultrapassagens[0];
    const matador = maiorPor(r, 'kills'), ativo = maiorPor(r, 'partidas');
    const melhorWin = [...r].filter(j => num(j.partidas) >= 3).sort((a, b) => winrate(b) - winrate(a))[0];
    const opcoes = [];
    if (over) opcoes.push(`⚔️ **ULTRAPASSAGEM DETECTADA**\n${await mentionarJogador(guild, over.a.id)} passou na frente de ${await mentionarJogador(guild, over.b.id)}. O ranking começou a ficar pessoal. 👀`);
    if (up) opcoes.push(`📈 **QUEM ESTÁ SUBINDO?**\n${await mentionarJogador(guild, up.id)} saltou do **#${up.de} para o #${up.para}**. ${up.delta >= 3 ? 'Isso não foi subida, foi invasão do ranking. 🚀' : 'Alguém acordou para a Liga. 🔥'}`);
    if (down) opcoes.push(`📉 **QUEDA DETECTADA**\n${await mentionarJogador(guild, down.id)} caiu do **#${down.de} para o #${down.para}**. O mapa cobra caro por vacilo. 😬`);
    if (segundo) { const gap = Math.abs(num(lider.pontos) - num(segundo.pontos)); opcoes.push(`👑 **BRIGA PELO TOPO**\n${await mentionarJogador(guild, lider.id)} lidera com **${fmt(lider.pontos)} pts** e ${await mentionarJogador(guild, segundo.id)} está a apenas **${fmt(gap)} pts**. Uma partida pode virar o roteiro. 🎬`); }
    if (matador) opcoes.push(`💀 **ARTILHEIRO DA LIGA**\n${await mentionarJogador(guild, matador.id)} é quem mais acumulou kills entre os jogadores do ranking: **${fmt(matador.kills)}**. Tem gente que joga para ganhar e tem gente que joga para apagar o mapa. 😂`);
    if (melhorWin) opcoes.push(`📊 **EFICIÊNCIA**\nCom pelo menos 3 partidas, ${await mentionarJogador(guild, melhorWin.id)} tem o melhor winrate atual: **${winrate(melhorWin).toFixed(1)}%**. Aproveitamento bonito de olhar. 👀`);
    if (ativo) opcoes.push(`🎮 **MAIS ATIVO**\n${await mentionarJogador(guild, ativo.id)} já soma **${fmt(ativo.partidas)} partidas**. Esse aí não está só participando da Liga, está praticamente pagando aluguel no mapa. 😂`);
    if (opcoes.length) return escolher(opcoes, 'analise-liga');
    return `👑 ${await mentionarJogador(guild, lider.id)} está no topo com **${fmt(lider.pontos)} pts**. A Liga está quieta... quieta demais. 👀`;
}

async function raioX(guild, id) {
    const j = perfil(id), tag = await mentionarJogador(guild, id);
    if (!j) return `🔎 Ainda não encontrei histórico suficiente de ${tag} na Liga.`;
    const r = ranking(), pos = r.findIndex(x => String(x.id) === String(id)) + 1, m = movimento();
    const up = m.subindo.find(x => String(x.id) === String(id)), down = m.caindo.find(x => String(x.id) === String(id));
    const leitura = up ? `subindo **${fmt(up.delta)} posição(ões)**` : down ? `caindo **${fmt(down.delta)} posição(ões)**` : 'mantendo a posição observada';
    return [`🔎 **RAIO-X DA LIGA — ${tag}**`,`🏅 Posição: **#${pos || '—'}** • **${fmt(j.pontos)} pts**`,`🏆 **${fmt(j.vitorias)} vitórias** em **${fmt(j.partidas)} partidas** • Winrate **${winrate(j).toFixed(1)}%**`,`💀 **${fmt(j.kills)} kills** • **${fmt(j.mortes)} mortes**`,`📈 Momento: **${leitura}** • Saldo de pontos: **${fmt(saldo(j))}**`,`🔥 ${tag} ${streakTexto(j)}.`].join('\n');
}

async function comparar(guild, a, b) {
    const r = ranking(), ma = await mentionarJogador(guild, a.id), mb = await mentionarJogador(guild, b.id);
    const pa = r.findIndex(x => String(x.id) === String(a.id)) + 1, pb = r.findIndex(x => String(x.id) === String(b.id)) + 1;
    const diff = num(a.pontos) - num(b.pontos), vr = winrate(a) - winrate(b), lider = diff > 0 ? ma : diff < 0 ? mb : null;
    const leitura = diff === 0 ? `estão empatados em **${fmt(a.pontos)} pts**` : `${lider} está na frente por **${fmt(Math.abs(diff))} pts**`;
    return `⚔️ **DUELO DA LIGA**\n${ma} **#${pa || '—'}** x ${mb} **#${pb || '—'}**\n${leitura}.\n🏆 Vitórias: **${fmt(a.vitorias)} x ${fmt(b.vitorias)}**\n💀 Kills: **${fmt(a.kills)} x ${fmt(b.kills)}**\n📈 Winrate: **${winrate(a).toFixed(1)}% x ${winrate(b).toFixed(1)}%**\n💡 ${vr === 0 ? 'Nos números de aproveitamento, estão iguais.' : `${vr > 0 ? ma : mb} leva a melhor no aproveitamento.`}`;
}

function dadosOlimpiadas() {
    const d = lerJson(olympPath, {}); if (!Array.isArray(d.duplas)) d.duplas = []; if (!Array.isArray(d.resultados)) d.resultados = []; return d;
}
function rankingOlimpiadas() {
    const d = dadosOlimpiadas(), duplas = new Map(d.duplas.map(x => [String(x.id), x])), mapa = new Map();
    for (const resultado of d.resultados) for (const [id, medalha] of [[resultado?.ouro, 'ouro'], [resultado?.prata, 'prata'], [resultado?.bronze, 'bronze']]) {
        if (!id) continue; const dupla = duplas.get(String(id)); if (!dupla?.pais) continue; const chave = norm(dupla.pais);
        if (!mapa.has(chave)) mapa.set(chave, { pais: dupla.pais, vitorias: 0, ouro: 0, prata: 0, bronze: 0 });
        const item = mapa.get(chave); item[medalha]++; if (medalha === 'ouro') item.vitorias++;
    }
    return [...mapa.values()].sort((a, b) => b.vitorias - a.vitorias || b.ouro - a.ouro || b.prata - a.prata || b.bronze - a.bronze);
}
function pontosOlimpicos(x) { return num(x?.ouro) * 3 + num(x?.prata) * 2 + num(x?.bronze); }
async function formatarDupla(guild, dupla) { return dupla ? `${await mentionarJogador(guild, dupla.jogador1)} + ${await mentionarJogador(guild, dupla.jogador2)}` : ''; }

async function olimp(guild) {
    const d = dadosOlimpiadas(), r = rankingOlimpiadas();
    if (!r.length) return '🥇 **OLIMPÍADAS DE DUPLAS**\nAinda não tem resultado suficiente para eu começar a provocar os países. 😂';
    const l = r[0], s = r[1], pts = pontosOlimpicos(l), dupla = d.duplas.find(x => norm(x.pais) === norm(l.pais)), duplaTexto = await formatarDupla(guild, dupla);
    return escolher([`🥇 **OLIMPÍADAS DE DUPLAS**\n${l.pais} lidera com **${pts} pts olímpicos** — 🥇 ${l.ouro} • 🥈 ${l.prata} • 🥉 ${l.bronze}. ${s ? `${s.pais} está na perseguição.` : 'Ainda não apareceu um perseguidor forte.'} 👀`,`🏅 **DISPUTA OLÍMPICA**\n${l.pais} está na frente. ${duplaTexto ? `A dupla responsável: ${duplaTexto}.` : ''} Agora quero ver quem vai tirar essa liderança. 🔥`,`🌍 **PLACAR DAS DUPLAS**\n${l.pais}: **${pts} pts** • 🥇 ${l.ouro} • 🥈 ${l.prata} • 🥉 ${l.bronze}\nDuplas registradas: **${fmt(d.duplas.length)}** • Resultados: **${fmt(d.resultados.length)}** 🏆`], 'olimpiadas');
}

function salvarContexto(message) { contexto.set(String(message.channelId), { autorId: String(message.author?.id || ''), texto: String(message.content || '').slice(0, 180), quando: Date.now() }); }
function temFollowUp(texto) { return tem(texto, ['e agora', 'entao', 'então', 'e ai', 'e aí', 'agora', 'e depois']); }

async function respostaInteligente(message) {
    const texto = String(message.content || ''), t = norm(texto), guild = message.guild, mencoes = extrairMencoes(message), r = ranking();
    if (mencoes.length >= 2 && tem(t, ['vs', 'versus', 'contra', 'comparar', 'duelo', 'quem e melhor', 'quem ganha', 'melhor que'])) { const a = perfil(mencoes[0]), b = perfil(mencoes[1]); if (a && b) return comparar(guild, a, b); }
    if (mencoes.length >= 1 && tem(t, ['pontos', 'pontuacao', 'pontuação', 'estatistica', 'estatísticas', 'stats', 'raio x', 'desempenho'])) return raioX(guild, mencoes[0]);
    if (tem(t, ['sequencia', 'sequência', 'vitórias seguidas', 'streak', 'embalado'])) { const alvo = mencoes[0] || String(message.author?.id || ''), j = perfil(alvo); if (j) return `🔥 ${await mentionarJogador(guild, alvo)} ${streakTexto(j)}.`; }
    if (tem(t, ['quem esta subindo', 'quem está subindo', 'subindo no ranking', 'quem subiu', 'quem caiu', 'caindo', 'ultrapassagem', 'ultrapassou', 'ranking', 'lider', 'líder'])) return analiseRanking(guild);
    if (tem(t, ['olimpiada', 'olimpíada', 'olimpiadas', 'olimpíadas', 'duplas', 'medalha', 'ouro', 'prata', 'bronze'])) return olimp(guild);
    if (tem(t, ['liga', 'liga das nacoes', 'liga das nações', 'pontuacao da liga', 'pontuação da liga', 'classificacao', 'classificação', 'temporada'])) {
        if (r.length) { const s = resumo(), l = r[0], segundo = r[1], lt = await mentionarJogador(guild, l.id), st = segundo ? await mentionarJogador(guild, segundo.id) : null, gap = segundo ? Math.abs(num(l.pontos) - num(segundo.pontos)) : 0;
            return escolher([`🏆 **LIGA DAS NAÇÕES**\n${lt} lidera com **${fmt(l.pontos)} pts**.${st ? ` ${st} está a **${fmt(gap)} pts**.` : ''}\n📊 ${s.partidas ? `A temporada já tem **${fmt(s.partidas)} partidas**.` : 'A temporada ainda está começando.'} 👀`,`📊 Dei uma olhada na Liga. ${lt} está no topo, ${st ? `${st} está na cola e a diferença é de só **${fmt(gap)} pts**.` : 'mas ainda falta alguém apertar a liderança.'} O ranking pode virar a qualquer momento. 😂`,`🔥 **TERMÔMETRO DA LIGA**\nTopo: ${lt} • **${fmt(l.pontos)} pts**\n${st ? `Perseguidor: ${st} • **${fmt(segundo.pontos)} pts**` : 'Perseguidor: ainda indefinido'}\nAgora é ver quem aguenta a pressão.`], 'liga-geral');
        }
    }
    if (tem(t, ['quem e o melhor', 'quem é o melhor', 'melhor jogador', 'melhor da liga', 'quem esta bem', 'quem está bem'])) {
        if (r.length) { const melhor = [...r].filter(j => num(j.partidas) >= 3).sort((a, b) => num(b.pontos) - num(a.pontos) || winrate(b) - winrate(a))[0] || r[0]; return `👑 Pelos números atuais da Liga, ${await mentionarJogador(guild, melhor.id)} está entre os nomes mais fortes: **${fmt(melhor.pontos)} pts**, **${fmt(melhor.vitorias)} vitórias** e **${winrate(melhor).toFixed(1)}% de winrate**. Mas melhor mesmo? Isso a próxima partida decide. 😏`; }
    }
    if (temFollowUp(texto)) { const ctx = contexto.get(String(message.channelId)); if (ctx && Date.now() - ctx.quando < 5 * 60 * 1000) { const p = perfil(ctx.autorId); if (p) return `👀 E agora? ${await mentionarJogador(guild, ctx.autorId)} continua com **${fmt(p.pontos)} pts** na Liga. O próximo capítulo depende do dado. 🎲`; } }
    return null;
}

async function tradicional(texto, guild) {
    const db = lerJson(dbPath, {}); if (!db || typeof db !== 'object') return null;
    const candidatas = [], t = norm(texto);
    for (const [chave, respostas] of Object.entries(db)) {
        const gatilhos = [chave];
        if (Array.isArray(respostas)) for (const item of respostas) { if (item && typeof item === 'object') { if (Array.isArray(item.gatilhos)) gatilhos.push(...item.gatilhos); if (Array.isArray(item.palavras)) gatilhos.push(...item.palavras); } }
        const encontrados = gatilhos.filter(g => tem(t, [g]));
        if (encontrados.length) candidatas.push({ chave, respostas, peso: encontrados.reduce((n, g) => n + norm(g).length, 0) });
    }
    candidatas.sort((a, b) => b.peso - a.peso); const melhor = candidatas[0]; if (!melhor) return null;
    let resposta = null;
    if (Array.isArray(melhor.respostas)) resposta = escolher(melhor.respostas.map(x => typeof x === 'string' ? x : x?.resposta).filter(Boolean), `tradicional-${melhor.chave}`);
    else if (typeof melhor.respostas === 'string') resposta = melhor.respostas;
    return substituirCanais(guild, resposta);
}

function humor(texto) {
    if (tem(texto, ['kkkk', 'kkk', 'haha', 'hahaha', 'rsrs', '🤣', '😂'])) return escolher(HUMOR.riso, 'humor-riso');
    if (tem(texto, ['perdi', 'perdeu', 'derrota', 'perder', 'fui derrotado', 'morreu'])) return escolher(HUMOR.derrota, 'humor-derrota');
    if (tem(texto, ['ganhei', 'ganhou', 'venci', 'venceu', 'vitória', 'vitoria', 'win'])) return escolher(HUMOR.vitoria, 'humor-vitoria');
    if (tem(texto, ['traidor', 'traiu', 'rival', 'inimigo', 'vou pegar', 'vou atacar'])) return escolher(HUMOR.provocacao, 'humor-provocacao');
    if (tem(texto, ['desistir', 'desisti', 'não consigo', 'nao consigo', 'triste', 'azar'])) return escolher(HUMOR.incentivo, 'humor-incentivo');
    return null;
}

async function enviarPensamento() {
    if (!clienteAtual) return;
    try {
        for (const guild of clienteAtual.guilds.cache.values()) {
            const canal = canalPensamentos(guild);
            if (!canal || !canal.isTextBased?.()) continue;
            const rankingAtual = ranking();
            let pensamento = escolher(PENSAMENTOS, `pensamento-${guild.id}`);
            if (rankingAtual.length) {
                const lider = rankingAtual[0], segundo = rankingAtual[1];
                const extras = [
                    `💭 **O QUE EU TÔ PENSANDO**\n${await mentionarJogador(guild, lider.id)} está no topo com **${fmt(lider.pontos)} pts**. Será que aguenta mais uma rodada? 👀`,
                    `💭 **O QUE EU TÔ PENSANDO**\nA diferença entre ${await mentionarJogador(guild, lider.id)} e ${segundo ? await mentionarJogador(guild, segundo.id) : 'o próximo colocado'} pode virar em uma única partida. 🏆`,
                    `💭 **O QUE EU TÔ PENSANDO**\nTem alguém subindo no ranking e provavelmente o resto ainda não percebeu. 🚀👀`
                ];
                pensamento = escolher([...PENSAMENTOS, ...extras], `pensamento-${guild.id}`);
            }
            await canal.send(substituirCanais(guild, pensamento));
        }
    } catch (e) { console.error('[Auto-Resposta] pensamento:', e.message); }
}

function agendarPensamento() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => { await enviarPensamento(); agendarPensamento(); }, CONFIG.pensamentoIntervaloMs);
}

module.exports = function iniciarAutoResposta(client) {
    if (!client) return;
    if (client.__worldwarAutoResponseV7) return;
    client.__worldwarAutoResponseV7 = true;
    clienteAtual = client;
    client.on(Events.MessageCreate, async message => {
        try {
            if (!message.guild || message.author?.bot || !categoria(message.channel)) return;
            if (mensagensProcessadas.has(message.id)) return;
            mensagensProcessadas.add(message.id);
            setTimeout(() => mensagensProcessadas.delete(message.id), 2 * 60 * 1000);
            salvarContexto(message);
            if (Math.random() > CONFIG.respostaChance || !podeResponder(message.channelId)) return;
            const inteligente = await respostaInteligente(message);
            if (inteligente) { await message.reply(substituirCanais(message.guild, inteligente)); salvarSnapshot(); return; }
            const engraçada = humor(message.content);
            if (engraçada) { await message.reply(substituirCanais(message.guild, engraçada)); return; }
            const antiga = await tradicional(message.content, message.guild);
            if (antiga) await message.reply(String(antiga));
        } catch (e) { console.error('[Auto-Resposta] MessageCreate:', e.message); }
    });
    client.once(Events.ClientReady, () => {
        console.log('🤖 Auto Resposta V7 ativada — Liga + Olimpíadas + canais dinâmicos + pensamentos a cada 10 minutos.');
        salvarSnapshot();
        agendarPensamento();
    });
};
