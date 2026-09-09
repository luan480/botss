/* ============================================================================
   WORLDWARBR — AUTO RESPOSTA V10
   Sistema de respostas + inteligência de jogadores.
   ============================================================================ */

const { Events, ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const estatisticasLiga = require('../liga/utils/estatisticasLiga.js');

const dbPath = path.join(__dirname, 'auto_respostas.json');
const inteligenciaPath = path.join(__dirname, 'auto_inteligencia.json');
const olympPath = path.join(__dirname, '..', 'olimpiadas', 'olimpiadas.json');

const CONFIG = {
    categoriaId: process.env.AUTO_RESPOSTA_CATEGORIA_ID || '849698902634004510',
    cooldownCanalMs: 60 * 1000,
    cooldownAdminMs: 15 * 1000,
    cooldownMencaoMs: 25 * 1000,
    respostaChance: 0.90,
    mencaoChance: 1.00,
    pensamentoIntervaloMs: 10 * 60 * 1000,
    maxRanking: 50,
    maxSnapshot: 5000,
    contextoMs: 30 * 60 * 1000,
    limpezaMs: 5 * 60 * 1000,
    minimoPartidasAnalise: 2
};

const cooldown = new Map();
const ultimoModelo = new Map();
const contexto = new Map();
const mensagensProcessadas = new Map();
let clienteAtual = null;
let timerPensamentos = null;
let timerLimpeza = null;
let handlerRegistrado = false;

const HUMOR = {
    riso: ['KKKKKK aí você me quebra 😂', 'KKKK isso já virou reunião de crise. 💀', 'Eu não devia rir disso... mas ri. 🤣', 'O servidor perdeu a seriedade oficialmente. 😂'],
    derrota: ['Calma, comandante. Uma derrota não apaga a campanha. 🫡', 'O dado hoje acordou com vontade de causar. 🎲💀', 'Respira. A Liga ainda não acabou. 😭', 'Até os melhores têm dia de desastre estratégico. 😂'],
    vitoria: ['Aí sim! Agora quero ver repetir. 👀🏆', 'GG! Vitória registrada. Agora não deixa a confiança subir mais que os pontos. 😂', 'Boa! O mapa sofreu mais uma derrota estratégica. 🌍🔥', 'Comemora, mas lembra: o ranking tem memória. 😏'],
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
    '💭 **O QUE EU TÔ PENSANDO**\nO melhor momento para estudar o rival é antes da próxima partida. 🧠⚔️',
    '💭 **O QUE EU TÔ PENSANDO**\nTem muita gente forte na Liga. O problema é que só um termina no topo. 🏆'
];

function normalizar(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function normalizarGatilho(valor) { return normalizar(valor).slice(0, 100); }
function escapeRegex(valor) { return String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function num(valor) { const n = Number(valor); return Number.isFinite(n) ? n : 0; }
function fmt(valor) { return num(valor).toLocaleString('pt-BR'); }
function mention(id) { return id ? `<@${String(id)}>` : 'esse jogador'; }

function categoriaPermitida(channel) { return String(channel?.parentId || '') === String(CONFIG.categoriaId); }
function podeUsarCanal(channel, botMember) {
    if (!channel || !botMember) return false;
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return false;
    return channel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.SendMessages) === true;
}

function lerJsonSeguro(file, fallback = {}, nome = file) {
    try {
        if (!fs.existsSync(file)) return { ok: true, data: fallback, missing: true };
        const raw = fs.readFileSync(file, 'utf8');
        if (!raw.trim()) return { ok: true, data: fallback, empty: true };
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON raiz precisa ser um objeto.');
        return { ok: true, data };
    } catch (error) {
        console.error(`[Auto-Resposta] JSON inválido em ${nome}:`, error.message);
        return { ok: false, data: fallback, error };
    }
}
function salvarJsonAtomico(file, data) {
    const temporario = `${file}.${process.pid}.${Date.now()}.tmp`;
    try { fs.writeFileSync(temporario, JSON.stringify(data, null, 2), 'utf8'); fs.renameSync(temporario, file); return true; }
    catch (error) { try { if (fs.existsSync(temporario)) fs.unlinkSync(temporario); } catch {} console.error('[Auto-Resposta] Falha ao salvar JSON:', error.message); return false; }
}
function escolher(items, key = 'global') {
    const lista = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!lista.length) return '';
    const ultimo = ultimoModelo.get(String(key));
    const pool = lista.length > 1 ? lista.filter(x => x !== ultimo) : lista;
    const valor = pool[Math.floor(Math.random() * pool.length)] || lista[0];
    ultimoModelo.set(String(key), valor);
    return valor;
}
function chaveMemoria(guildId, channelId, tipo = 'geral') { return `${guildId}:${channelId}:${tipo}`; }
function podeResponder(channelId, guildId, tipo = 'geral') {
    const ultimo = cooldown.get(chaveMemoria(guildId, channelId, tipo)) || 0;
    const limite = tipo === 'admin' ? CONFIG.cooldownAdminMs : CONFIG.cooldownCanalMs;
    return Date.now() - ultimo >= limite;
}
function registrarCooldown(channelId, guildId, tipo = 'geral') { cooldown.set(chaveMemoria(guildId, channelId, tipo), Date.now()); }
function chaveMencao(guildId, channelId, jogadorId) { return `${guildId}:${channelId}:${jogadorId}:mencao`; }
function podeResponderMencao(guildId, channelId, jogadorId) { return Date.now() - (cooldown.get(chaveMencao(guildId, channelId, jogadorId)) || 0) >= CONFIG.cooldownMencaoMs; }
function registrarCooldownMencao(guildId, channelId, jogadorId) { cooldown.set(chaveMencao(guildId, channelId, jogadorId), Date.now()); }

function limparMemoria() {
    const agora = Date.now();
    for (const [key, when] of cooldown) if (agora - when > Math.max(CONFIG.contextoMs, CONFIG.cooldownCanalMs) * 2) cooldown.delete(key);
    for (const [key, when] of contexto) if (agora - when.timestamp > CONFIG.contextoMs) contexto.delete(key);
    for (const [key, when] of mensagensProcessadas) if (agora - when > CONFIG.contextoMs) mensagensProcessadas.delete(key);
}

function tem(texto, termos) {
    const t = normalizar(texto);
    return (Array.isArray(termos) ? termos : [termos]).some(termo => {
        const x = normalizar(termo); if (!x) return false;
        return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(x)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(t);
    });
}
function extrairMencoes(message) { return [...(message?.mentions?.users?.keys?.() || [])]; }
function salvarContexto(message, intent = null) {
    if (!message?.guildId || !message?.channelId) return;
    contexto.set(`${message.guildId}:${message.channelId}`, { autorId: message.author?.id || null, texto: String(message.content || '').slice(0, 300), intent, timestamp: Date.now() });
}
function obterContexto(message) {
    const item = contexto.get(`${message.guildId}:${message.channelId}`);
    return item && Date.now() - item.timestamp <= CONFIG.contextoMs ? item : null;
}

function perfil(id) { try { return estatisticasLiga.calcularPerfil(String(id)); } catch { return null; } }
function ranking(limite = CONFIG.maxRanking) { try { return estatisticasLiga.rankingPorPontos(limite) || []; } catch { return []; } }
function winrate(j) {
    const partidas = num(j?.partidas); if (!partidas) return 0;
    const informado = Number(j?.winrate); if (Number.isFinite(informado)) return informado;
    return Number(((num(j?.vitorias) / partidas) * 100).toFixed(2));
}
function streakNumero(j) { return Math.max(0, num(j?.streakAtual)); }
function kd(j) {
    const mortes = num(j?.mortes); return mortes > 0 ? num(j?.kills) / mortes : num(j?.kills) > 0 ? num(j.kills) : 0;
}
function saldoCombate(j) { return num(j?.kills) - num(j?.mortes); }
function streakTexto(j) {
    const atual = streakNumero(j), maior = num(j?.maiorStreak);
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
    const idMatch = bruto.match(/^<@!?(\d{15,25})>$/);
    const id = idMatch?.[1] || (/^\d{15,25}$/.test(bruto) ? bruto : null);
    if (id) { try { return await guild.members.fetch(id); } catch {} }
    const alvo = normalizar(bruto); if (!alvo) return null;
    const membros = [...guild.members.cache.values()].filter(m => !m.user?.bot);
    const campos = [m => normalizar(m.user?.username), m => normalizar(m.displayName), m => normalizar(m.user?.globalName)];
    for (const get of campos) { const exatos = membros.filter(m => get(m) === alvo); if (exatos.length === 1) return exatos[0]; if (exatos.length > 1) return null; }
    const parciais = new Set();
    for (const get of campos) for (const membro of membros) if (get(membro).includes(alvo)) parciais.add(membro.id);
    return parciais.size === 1 ? guild.members.cache.get([...parciais][0]) || null : null;
}
async function mentionarJogador(guild, id) { const membro = await resolverJogador(guild, id); return membro ? `<@${membro.id}>` : mention(id); }

function calcularContextoJogador(id) {
    const j = perfil(id); if (!j) return null;
    const r = ranking(CONFIG.maxSnapshot);
    const pos = r.findIndex(x => String(x.id) === String(id));
    const posicao = pos >= 0 ? pos + 1 : 0;
    const acima = pos > 0 ? r[pos - 1] : null;
    const abaixo = pos >= 0 && pos < r.length - 1 ? r[pos + 1] : null;
    const total = r.length;
    const pontos = num(j.pontos);
    const pontosAcima = acima ? Math.max(0, num(acima.pontos) - pontos) : 0;
    const pontosAbaixo = abaixo ? Math.max(0, pontos - num(abaixo.pontos)) : 0;
    const lider = r[0] || null;
    const distanciaLider = lider && String(lider.id) !== String(id) ? Math.max(0, num(lider.pontos) - pontos) : 0;
    const percentil = posicao && total ? Math.max(0, Math.min(100, ((total - posicao + 1) / total) * 100)) : 0;
    const taxa = winrate(j);
    const saldo = saldoCombate(j);
    const kdr = kd(j);
    const partidas = num(j.partidas);
    const vitorias = num(j.vitorias);
    const derrotas = Math.max(0, partidas - vitorias);
    return { j, r, posicao, total, acima, abaixo, lider, pontosAcima, pontosAbaixo, distanciaLider, percentil, taxa, saldo, kdr, partidas, vitorias, derrotas, streak: streakNumero(j) };
}

function categoriaStatus(a) {
    if (!a.posicao) return 'sem-ranking';
    if (a.posicao === 1) return 'lider';
    if (a.posicao <= 3) return 'podio';
    if (a.posicao <= 5) return 'top5';
    if (a.posicao <= 10) return 'top10';
    if (a.posicao > a.total * 0.75) return 'parte-baixa';
    return 'meio';
}

function opcoesInteligenciaJogador(a, nome) {
    const o = [];
    const { j } = a;
    if (a.posicao === 1) o.push(`👑 ${nome} é o **líder da Liga** com **${fmt(j.pontos)} pontos**. Por enquanto, todo mundo está olhando para ele.`);
    if (a.posicao > 1 && a.acima && a.pontosAcima <= 3) o.push(`🎯 ${nome} está em **${a.posicao}º** e tem só **${fmt(a.pontosAcima)} ponto${a.pontosAcima === 1 ? '' : 's'}** separando do próximo lugar. Está colado.`);
    if (a.posicao > 1 && a.acima && a.pontosAcima >= 4 && a.pontosAcima <= 10) o.push(`👀 ${nome} está em **${a.posicao}º** e precisa de **${fmt(a.pontosAcima)} pontos** para alcançar ${mention(a.acima.id)}.`);
    if (a.posicao > 1 && a.lider && a.distanciaLider <= 5) o.push(`🏆 ${nome} está em **${a.posicao}º**, mas só **${fmt(a.distanciaLider)} pontos** atrás do líder. A disputa pelo topo está apertada.`);
    if (a.posicao > 1 && a.lider && a.distanciaLider > 5 && a.distanciaLider <= 15) o.push(`🚀 ${nome} está em **${a.posicao}º** e ainda está a uma distância alcançável de **${fmt(a.distanciaLider)} pontos** do topo.`);
    if (a.posicao && a.total && a.percentil >= 90) o.push(`🏅 ${nome} está no **Top 10%** do ranking atual da Liga. É posição de respeito.`);
    if (a.posicao && a.posicao <= 5) o.push(`🔥 ${nome} está entre os **5 primeiros** da Liga, ocupando a **${a.posicao}ª posição** com **${fmt(j.pontos)} pontos**.`);
    if (a.posicao && a.posicao <= 10) o.push(`📊 ${nome} está no **Top 10**, em **${a.posicao}º lugar**, com **${fmt(j.pontos)} pontos**.`);

    if (a.partidas >= CONFIG.minimoPartidasAnalise && a.taxa >= 75) o.push(`📈 ${nome} tem **${fmt(a.taxa)}% de winrate** em ${fmt(a.partidas)} partidas. Aproveitamento muito forte.`);
    else if (a.partidas >= CONFIG.minimoPartidasAnalise && a.taxa >= 60) o.push(`📊 ${nome} está com **${fmt(a.taxa)}% de winrate** em ${fmt(a.partidas)} partidas. Está acima de um aproveitamento mediano.`);
    else if (a.partidas >= CONFIG.minimoPartidasAnalise && a.taxa < 40) o.push(`📉 ${nome} está com **${fmt(a.taxa)}% de winrate** em ${fmt(a.partidas)} partidas. Tem espaço claro para recuperação.`);

    if (a.partidas >= CONFIG.minimoPartidasAnalise && a.kdr >= 2) o.push(`⚔️ ${nome} está com K/D de **${a.kdr.toFixed(2)}** e saldo de combate **+${fmt(a.saldo)}**. No combate, está pesado.`);
    else if (a.partidas >= CONFIG.minimoPartidasAnalise && a.saldo >= 10) o.push(`💥 ${nome} tem saldo de combate **+${fmt(a.saldo)}**. Está causando bem mais do que sofrendo.`);
    else if (a.partidas >= CONFIG.minimoPartidasAnalise && a.saldo <= -10) o.push(`⚠️ ${nome} está com saldo de combate **${fmt(a.saldo)}**. Esse é um dos pontos que mais merece atenção.`);

    if (a.streak >= 3) o.push(`🔥 ${nome} ${streakTexto(j)}. Se mantiver o ritmo, o ranking pode sentir.`);
    if (a.streak === 0 && num(j.maiorStreak) >= 4) o.push(`👀 ${nome} não está em sequência agora, mas já chegou a **${fmt(j.maiorStreak)} vitórias seguidas**. Capacidade para embalar ele já mostrou.`);
    if (a.partidas >= 5 && a.taxa >= 70 && a.posicao > 10) o.push(`🧠 ${nome} tem **${fmt(a.taxa)}% de winrate**, mas está em **${a.posicao}º**. Parece haver potencial para subir bastante com mais resultados.`);
    if (a.partidas >= 5 && a.taxa < 45 && a.posicao <= 10) o.push(`🚨 ${nome} está no **Top 10**, mas com apenas **${fmt(a.taxa)}% de winrate**. A posição é boa; o momento merece atenção.`);
    if (a.acima && a.abaixo && a.pontosAcima <= 2 && a.pontosAbaixo <= 2) o.push(`⚔️ ${nome} está no meio de uma briga apertadíssima: tem pouca diferença de pontos tanto para quem está acima quanto para quem está abaixo.`);
    if (a.partidas >= 8) o.push(`🎮 ${nome} já tem **${fmt(a.partidas)} partidas** registradas. Já existe uma amostra boa para avaliar o desempenho na Liga.`);
    if (a.partidas > 0 && a.partidas < CONFIG.minimoPartidasAnalise) o.push(`🧪 ${nome} ainda tem poucas partidas registradas (**${fmt(a.partidas)}**). Dá para observar, mas ainda é cedo para tirar conclusões fortes.`);
    if (a.posicao > 10 && a.abaixo && a.pontosAbaixo <= 3) o.push(`🚀 ${nome} está em **${a.posicao}º** e tem ${fmt(a.pontosAbaixo)} ponto${a.pontosAbaixo === 1 ? '' : 's'} de vantagem sobre o próximo colocado. A tabela está apertada por baixo.`);
    if (!o.length && a.partidas > 0) o.push(`📊 ${nome} tem **${fmt(j.pontos)} pontos** em **${fmt(a.partidas)} partidas** e ocupa a **${a.posicao ? `${a.posicao}ª` : 'sem posição'}** na Liga.`);
    return o;
}

async function inteligenciaJogador(guild, id) {
    if (!id || id === guild.client.user?.id) return null;
    const a = calcularContextoJogador(id);
    const nome = await mentionarJogador(guild, id);
    if (!a) return `🤔 Ainda não tenho estatísticas suficientes para analisar ${nome} na Liga.`;
    const opcoes = opcoesInteligenciaJogador(a, nome);
    if (!opcoes.length) return `📊 ${nome} ainda não tem dados suficientes para uma análise confiável na Liga.`;
    return escolher(opcoes, `${guild.id}:jogador:${id}`);
}

async function raioX(guild, id) {
    const a = calcularContextoJogador(id); if (!a) return null;
    const nome = await mentionarJogador(guild, id), j = a.j;
    return [
        `📊 **RAIO-X DE ${nome}**`,
        `🏆 Posição: **${a.posicao ? `${a.posicao}º` : 'fora do ranking'}**`,
        `⭐ Pontos: **${fmt(j.pontos)}**`,
        `🎮 Partidas: **${fmt(j.partidas)}**`,
        `✅ Vitórias: **${fmt(j.vitorias)}** • ❌ Derrotas: **${fmt(a.derrotas)}**`,
        `📈 Winrate: **${fmt(a.taxa)}%**`,
        `💥 Kills: **${fmt(j.kills)}** • ☠️ Mortes: **${fmt(j.mortes)}** • K/D: **${a.kdr.toFixed(2)}**`,
        `⚔️ Saldo de combate: **${a.saldo >= 0 ? '+' : ''}${fmt(a.saldo)}**`,
        `🔥 Sequência: ${streakTexto(j)}`
    ].join('\n');
}

async function comparar(guild, aId, bId) {
    const a = calcularContextoJogador(aId), b = calcularContextoJogador(bId); if (!a || !b) return null;
    const aNome = await mentionarJogador(guild, aId), bNome = await mentionarJogador(guild, bId);
    const diferenca = a.j.pontos - b.j.pontos;
    const melhor = diferenca > 0 ? aNome : diferenca < 0 ? bNome : (a.taxa > b.taxa ? aNome : b.taxa > a.taxa ? bNome : 'empate técnico');
    return ['⚔️ **COMPARAÇÃO**', `${aNome}: **${fmt(a.j.pontos)} pts** • **${fmt(a.taxa)}% WR** • **${fmt(a.j.vitorias)} vitórias** • **${fmt(a.j.kills)} kills**`, `${bNome}: **${fmt(b.j.pontos)} pts** • **${fmt(b.taxa)}% WR** • **${fmt(b.j.vitorias)} vitórias** • **${fmt(b.j.kills)} kills**`, `🏆 Vantagem geral: **${melhor}**`].join('\n');
}

function dadosOlimpiadas() {
    const leitura = lerJsonSeguro(olympPath, {}, 'olimpiadas.json'), d = leitura.ok ? leitura.data : {};
    return { duplas: Array.isArray(d.duplas) ? d.duplas.filter(x => x && x.ativa !== false) : [], resultados: Array.isArray(d.resultados) ? d.resultados : [] };
}
function rankingOlimpiadas() {
    const d = dadosOlimpiadas(), porDupla = new Map(d.duplas.map(x => [String(x.id), x])), mapa = new Map();
    const garantir = pais => { if (!mapa.has(pais)) mapa.set(pais, { pais, ouro: 0, prata: 0, bronze: 0 }); return mapa.get(pais); };
    for (const resultado of d.resultados) for (const [medalha, chave] of [['ouro', 'ouro'], ['prata', 'prata'], ['bronze', 'bronze']]) { const dupla = porDupla.get(String(resultado[chave] || '')); if (dupla?.pais) garantir(dupla.pais)[medalha]++; }
    return [...mapa.values()].map(x => ({ ...x, pontos: x.ouro * 3 + x.prata * 2 + x.bronze })).sort((a,b) => b.pontos-a.pontos || b.ouro-a.ouro || b.prata-a.prata || b.bronze-a.bronze || normalizar(a.pais).localeCompare(normalizar(b.pais)));
}
async function olimp() {
    const d = dadosOlimpiadas(), r = rankingOlimpiadas(); if (!d.duplas.length && !d.resultados.length) return '🏅 As Olimpíadas ainda não têm dados registrados.';
    const linhas = r.slice(0,5).map((x,i) => `${i+1}. **${x.pais}** — ${fmt(x.pontos)} pts (${x.ouro}🥇 ${x.prata}🥈 ${x.bronze}🥉)`);
    return `🏅 **OLIMPÍADAS DE DUPLAS**\n${linhas.join('\n') || 'Sem medalhas registradas ainda.'}\n\nDuplas: **${fmt(d.duplas.length)}** • Resultados: **${fmt(d.resultados.length)}**`;
}

function snapshotAnterior() { const l = lerJsonSeguro(inteligenciaPath, {}, 'auto_inteligencia.json'); return l.ok && l.data.ultimaClassificacao && typeof l.data.ultimaClassificacao === 'object' ? l.data.ultimaClassificacao : {}; }
function snapshotAtual() { return ranking(CONFIG.maxSnapshot).reduce((a,j,i) => { if (j?.id) a[String(j.id)] = { posicao:i+1, pontos:num(j.pontos) }; return a; }, {}); }
function movimento() {
    const anterior = snapshotAnterior(), atualLista = ranking(CONFIG.maxSnapshot), atual = new Map(atualLista.map((j,i)=>[String(j.id), {...j,posicao:i+1}])), subindo=[], caindo=[];
    for (const [id,item] of atual) { const antigo=anterior[id]; if(!antigo) continue; const delta=num(antigo.posicao)-item.posicao; if(delta>=2) subindo.push({...item,delta}); if(delta<=-2) caindo.push({...item,delta:Math.abs(delta)}); }
    subindo.sort((a,b)=>b.delta-a.delta); caindo.sort((a,b)=>b.delta-a.delta);
    return { anterior, atual: atualLista, subindo, caindo };
}
function carregarInteligencia() { const l=lerJsonSeguro(inteligenciaPath,{},'auto_inteligencia.json'); return l.ok ? l.data : {}; }
function salvarSnapshot() { const base=carregarInteligencia(); base.ultimaClassificacao=snapshotAtual(); base.atualizadoEm=new Date().toISOString(); return salvarJsonAtomico(inteligenciaPath,base); }
function garantirSnapshotInicial() { return Object.keys(snapshotAnterior()).length ? false : salvarSnapshot(); }
function hashMovimento(tipo,item) { return item?.id ? `${tipo}:${item.id}:${item.posicao}:${item.delta}:${num(item.pontos)}` : ''; }
function marcarMovimentosAnunciados(lista) { const base=carregarInteligencia(), atuais=Array.isArray(base.movimentosAnunciados)?base.movimentosAnunciados:[], set=new Set(atuais); for(const x of lista) if(x) set.add(x); base.movimentosAnunciados=[...set].slice(-500); base.ultimaClassificacao=snapshotAtual(); base.atualizadoEm=new Date().toISOString(); return salvarJsonAtomico(inteligenciaPath,base); }
async function analiseRanking(guild) {
    const r=ranking(CONFIG.maxRanking); if(!r.length) return null; garantirSnapshotInicial(); const mov=movimento(), base=carregarInteligencia(), anunciados=new Set(Array.isArray(base.movimentosAnunciados)?base.movimentosAnunciados:[]), opcoes=[], novos=[];
    if(mov.subindo[0]) { const x=mov.subindo[0], h=hashMovimento('subiu',x); if(!anunciados.has(h)){novos.push(h);opcoes.push(`🚀 ${await mentionarJogador(guild,x.id)} subiu **${fmt(x.delta)} posições** e agora está em **${x.posicao}º**.`);} }
    if(mov.caindo[0]) { const x=mov.caindo[0], h=hashMovimento('caiu',x); if(!anunciados.has(h)){novos.push(h);opcoes.push(`📉 ${await mentionarJogador(guild,x.id)} caiu **${fmt(x.delta)} posições** e precisa reagir.`);} }
    const lider=r[0], segundo=r[1], topKills=[...r].sort((a,b)=>num(b.kills)-num(a.kills))[0], ativo=[...r].sort((a,b)=>num(b.partidas)-num(a.partidas))[0], win=[...r].filter(x=>num(x.partidas)>=3).sort((a,b)=>winrate(b)-winrate(a))[0];
    if(!opcoes.length&&lider&&segundo)opcoes.push(`👑 O líder é ${await mentionarJogador(guild,lider.id)} com **${fmt(lider.pontos)} pontos**. ${await mentionarJogador(guild,segundo.id)} vem logo atrás com **${fmt(segundo.pontos)}**.`);
    if(!opcoes.length&&topKills)opcoes.push(`💥 Quem mais elimina no ranking atual é ${await mentionarJogador(guild,topKills.id)} com **${fmt(topKills.kills)} kills**.`);
    if(!opcoes.length&&ativo)opcoes.push(`🎮 O mais ativo é ${await mentionarJogador(guild,ativo.id)} com **${fmt(ativo.partidas)} partidas**.`);
    if(!opcoes.length&&win)opcoes.push(`📊 Melhor winrate entre quem tem 3+ partidas: ${await mentionarJogador(guild,win.id)} com **${fmt(winrate(win))}%**.`);
    const resposta=escolher(opcoes,`${guild.id}:analise-liga`); if(resposta)marcarMovimentosAnunciados(novos); return resposta;
}

async function respostaInteligente(message) {
    const texto=String(message.content||''), t=normalizar(texto), guild=message.guild, mencoes=extrairMencoes(message), anterior=obterContexto(message);
    if(tem(t,['olimpiada','olimpiadas','medalha','ouro','prata','bronze'])){salvarContexto(message,'olimpiadas');return olimp();}
    if(mencoes.length>=2&&tem(t,['vs','versus','contra','comparar','duelo','quem e melhor','quem ganha','melhor que'])){salvarContexto(message,'comparacao');return comparar(guild,mencoes[0],mencoes[1]);}
    if(mencoes.length>=1&&tem(t,['pontuacao','estatistica','estatisticas','stats','raio x','desempenho'])){salvarContexto(message,'raiox');return raioX(guild,mencoes[0]);}
    if(mencoes.length>=1&&tem(t,['quem e','como esta','como ta','situacao','momento','desempenho de','fala sobre'])){salvarContexto(message,'jogador');return inteligenciaJogador(guild,mencoes[0]);}
    if(tem(t,['ranking','classificacao','liga','lider','primeiro lugar','top da liga'])){salvarContexto(message,'ranking');return analiseRanking(guild);}
    if(anterior&&tem(t,['e agora','entao','agora','e ai','e depois'])){salvarContexto(message,anterior.intent);if(anterior.intent==='ranking')return analiseRanking(guild);if(anterior.intent==='olimpiadas')return olimp();}
    return null;
}

function tradicional(texto,guild){
    const l=lerJsonSeguro(dbPath,{},'auto_respostas.json');if(!l.ok)return null;const t=normalizar(texto),c=[];
    for(const [gatilhoOriginal,respostas] of Object.entries(l.data)){const gatilho=normalizarGatilho(gatilhoOriginal);if(!gatilho||!tem(t,gatilho))continue;const lista=(Array.isArray(respostas)?respostas:[respostas]).filter(x=>typeof x==='string'&&x.trim()).map(x=>substituirCanais(guild,x.trim()));if(lista.length)c.push({gatilho,respostas:lista});}
    c.sort((a,b)=>b.gatilho.length-a.gatilho.length);if(!c.length)return null;const e=c[0];return {texto:escolher(e.respostas,`${guild.id}:tradicional:${e.gatilho}`),gatilho:e.gatilho};
}
function humor(texto){
    if(tem(texto,['kkkk','haha','rsrs','hahaha']))return{texto:escolher(HUMOR.riso,'humor:riso'),tipo:'humor'};
    if(tem(texto,['perdi','derrota','perdi feio','perdeu']))return{texto:escolher(HUMOR.derrota,'humor:derrota'),tipo:'humor'};
    if(tem(texto,['ganhei','venci','vitoria','gg']))return{texto:escolher(HUMOR.vitoria,'humor:vitoria'),tipo:'humor'};
    if(tem(texto,['traidor','traiu','provocacao','provocando']))return{texto:escolher(HUMOR.provocacao,'humor:provocacao'),tipo:'humor'};
    if(tem(texto,['desisti','desanimo','nao consigo','perdendo']))return{texto:escolher(HUMOR.incentivo,'humor:incentivo'),tipo:'humor'};
    return null;
}
function substituirCanais(guild,resposta){
    if(typeof resposta!=='string')return resposta;
    const canais=[...guild.channels.cache.values()].filter(c=>String(c.parentId||'')===String(CONFIG.categoriaId));
    const texto=canais.filter(c=>[ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(c.type)).sort((a,b)=>normalizar(b.name).includes('war')-normalizar(a.name).includes('war'))[0];
    const voz=canais.filter(c=>[ChannelType.GuildVoice,ChannelType.GuildStageVoice].includes(c.type)).sort((a,b)=>normalizar(b.name).includes('war')-normalizar(a.name).includes('war'))[0];
    return resposta.replace(/\{CANAL_TEXTO_WAR\}/g,texto?`<#${texto.id}>`:'o canal de WAR').replace(/\{CANAL_VOZ_WAR\}/g,voz?`<#${voz.id}>`:'um canal de voz');
}

async function processarMensagem(message){
    if(!message?.guild||message.author?.bot||!categoriaPermitida(message.channel)||!message.content?.trim())return;
    const chaveMensagem=`${message.guildId}:${message.id}`;if(mensagensProcessadas.has(chaveMensagem))return;mensagensProcessadas.set(chaveMensagem,Date.now());
    const botMember=message.guild.members.me||await message.guild.members.fetchMe().catch(()=>null);if(!podeUsarCanal(message.channel,botMember))return;
    const mencoes=extrairMencoes(message).filter(id=>id!==message.client.user?.id);
    const mencaoUnica=mencoes.length===1?mencoes[0]:null;

    // Menção simples tem prioridade sobre respostas genéricas: é o núcleo do sistema.
    // Consultas explícitas (stats/comparação) continuam tendo prioridade máxima.
    if(mencaoUnica){
        const texto=normalizar(message.content);
        const consultaExplicita=tem(texto,['pontuacao','estatistica','estatisticas','stats','raio x','desempenho','como esta','como ta','situacao','momento','fala sobre','quem e']);
        if(!consultaExplicita&&podeResponderMencao(message.guildId,message.channelId,mencaoUnica)){
            if(Math.random()<=CONFIG.mencaoChance){
                const resposta=await inteligenciaJogador(message.guild,mencaoUnica).catch(error=>{console.error('[Auto-Resposta] Inteligência de jogador:',error.message);return null;});
                if(resposta){
                    try{await message.channel.send({content:substituirCanais(message.guild,resposta).slice(0,2000),allowedMentions:{parse:['users']}});registrarCooldownMencao(message.guildId,message.channelId,mencaoUnica);salvarContexto(message,'jogador');return;}catch(error){console.error('[Auto-Resposta] Falha ao enviar análise do jogador:',error.message);}
                }
            }
        }
    }

    const tradicionalResposta=tradicional(message.content,message.guild);let candidato=null,tipo='geral';
    if(tradicionalResposta){candidato=tradicionalResposta.texto;tipo='admin';}
    else{const inteligente=await respostaInteligente(message).catch(error=>{console.error('[Auto-Resposta] Inteligência:',error.message);return null;});if(inteligente){candidato=inteligente;tipo='inteligente';}else{const h=humor(message.content);if(h){candidato=h.texto;tipo=h.tipo;}}}
    if(!candidato||typeof candidato!=='string'||!candidato.trim())return;
    if(!podeResponder(message.channelId,message.guildId,tipo==='admin'?'admin':'geral'))return;
    if(tipo!=='admin'&&Math.random()>CONFIG.respostaChance)return;
    try{await message.channel.send({content:substituirCanais(message.guild,candidato.trim()).slice(0,2000),allowedMentions:{parse:['users']}});registrarCooldown(message.channelId,message.guildId,tipo==='admin'?'admin':'geral');salvarContexto(message,tipo);}catch(error){console.error('[Auto-Resposta] Falha ao enviar:',error.message);}
}

function canalPensamentos(guild){
    const canais=[...guild.channels.cache.values()].filter(c=>{if(![ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(c.type))return false;const n=normalizar(c.name);return n.includes('o que vc ta pensando')||n.includes('o que voce ta pensando')||n.includes('o que estou pensando')||n.includes('pensando do bot')||n.includes('pensamento do bot');});
    return canais.find(c=>categoriaPermitida(c))||null;
}
async function enviarPensamento(){
    if(!clienteAtual)return;
    for(const guild of clienteAtual.guilds.cache.values()){
        const canal=canalPensamentos(guild);if(!canal)continue;const botMember=guild.members.me||await guild.members.fetchMe().catch(()=>null);if(!podeUsarCanal(canal,botMember))continue;if(!podeResponder(canal.id,guild.id,'geral'))continue;
        try{await canal.send({content:escolher(PENSAMENTOS,`${guild.id}:pensamentos`),allowedMentions:{parse:[]}});registrarCooldown(canal.id,guild.id,'geral');}catch(error){console.error('[Auto-Resposta] Falha no pensamento:',error.message);}
    }
}
function iniciarTimers(){if(timerPensamentos)clearInterval(timerPensamentos);if(timerLimpeza)clearInterval(timerLimpeza);timerPensamentos=setInterval(()=>enviarPensamento().catch(e=>console.error('[Auto-Resposta] Timer pensamento:',e.message)),CONFIG.pensamentoIntervaloMs);timerLimpeza=setInterval(limparMemoria,CONFIG.limpezaMs);timerPensamentos.unref?.();timerLimpeza.unref?.();}

module.exports=function iniciarAutoResposta(client){
    if(!client)return;clienteAtual=client;if(handlerRegistrado)return;handlerRegistrado=true;
    client.on(Events.MessageCreate,message=>{processarMensagem(message).catch(error=>console.error('[Auto-Resposta] Erro:',error));});
    const pronto=()=>{garantirSnapshotInicial();iniciarTimers();console.log('🤖 Auto Resposta V10 ativada — inteligência de jogadores, ranking, Olimpíadas e pensamentos.');};
    if(client.isReady?.())pronto();else client.once(Events.ClientReady,pronto);
};