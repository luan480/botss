/* ============================================================================
   WORLDWARBR — AUTO RESPOSTA V9
   ============================================================================
   V9 mantém Liga das Nações, Olimpíadas, humor, respostas tradicionais,
   pensamentos e análise de ranking, mas corrige:
   - matching por palavra/frase em vez de includes cego;
   - normalização compartilhada com /responder;
   - prioridade e cooldown por tipo;
   - estado por servidor/canal;
   - snapshot completo para análise e detecção de ultrapassagens;
   - resolução ambígua de jogadores;
   - permissões antes de pensamentos automáticos;
   - escrita segura e tratamento explícito de JSON inválido;
   - limpeza de memória sem crescimento indefinido;
   - movimentos de ranking anunciados apenas uma vez por mudança.
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
    respostaChance: 0.90,
    pensamentoIntervaloMs: 10 * 60 * 1000,
    maxRanking: 50,
    maxSnapshot: 5000,
    contextoMs: 30 * 60 * 1000,
    limpezaMs: 5 * 60 * 1000
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

function normalizar(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizarGatilho(valor) {
    return normalizar(valor).slice(0, 100);
}

function escapeRegex(valor) {
    return String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function num(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function fmt(valor) {
    return num(valor).toLocaleString('pt-BR');
}

function mention(id) {
    return id ? `<@${String(id)}>` : 'esse jogador';
}

function categoriaPermitida(channel) {
    return String(channel?.parentId || '') === String(CONFIG.categoriaId);
}

function podeUsarCanal(channel, botMember) {
    if (!channel || !botMember) return false;
    if (!(channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) return false;
    return channel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.SendMessages) === true;
}

function lerJsonSeguro(file, fallback = {}, nome = file) {
    try {
        if (!fs.existsSync(file)) return { ok: true, data: fallback, missing: true };
        const raw = fs.readFileSync(file, 'utf8');
        if (!raw.trim()) return { ok: true, data: fallback, empty: true };
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('JSON raiz precisa ser um objeto.');
        }
        return { ok: true, data };
    } catch (error) {
        console.error(`[Auto-Resposta] JSON inválido em ${nome}:`, error.message);
        return { ok: false, data: fallback, error };
    }
}

function salvarJsonAtomico(file, data) {
    const temporario = `${file}.${process.pid}.${Date.now()}.tmp`;
    try {
        fs.writeFileSync(temporario, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(temporario, file);
        return true;
    } catch (error) {
        try { if (fs.existsSync(temporario)) fs.unlinkSync(temporario); } catch {}
        console.error('[Auto-Resposta] Falha ao salvar JSON:', error.message);
        return false;
    }
}

function escolher(items, key = 'global') {
    const lista = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!lista.length) return '';
    const chave = String(key);
    const ultimo = ultimoModelo.get(chave);
    const pool = lista.length > 1 ? lista.filter(item => item !== ultimo) : lista;
    const valor = pool[Math.floor(Math.random() * pool.length)] || lista[0];
    ultimoModelo.set(chave, valor);
    return valor;
}

function chaveMemoria(guildId, channelId, tipo = 'geral') {
    return `${guildId}:${channelId}:${tipo}`;
}

function podeResponder(channelId, guildId, tipo = 'geral') {
    const chave = chaveMemoria(guildId, channelId, tipo);
    const ultimo = cooldown.get(chave) || 0;
    const limite = tipo === 'admin' ? CONFIG.cooldownAdminMs : CONFIG.cooldownCanalMs;
    return Date.now() - ultimo >= limite;
}

function registrarCooldown(channelId, guildId, tipo = 'geral') {
    cooldown.set(chaveMemoria(guildId, channelId, tipo), Date.now());
}

function limparMemoria() {
    const agora = Date.now();
    for (const [key, when] of cooldown) {
        if (agora - when > Math.max(CONFIG.contextoMs, CONFIG.cooldownCanalMs) * 2) cooldown.delete(key);
    }
    for (const [key, when] of contexto) {
        if (agora - when.timestamp > CONFIG.contextoMs) contexto.delete(key);
    }
    for (const [key, when] of mensagensProcessadas) {
        if (agora - when > CONFIG.contextoMs) mensagensProcessadas.delete(key);
    }
}

function tem(texto, termos) {
    const t = normalizar(texto);
    return (Array.isArray(termos) ? termos : [termos]).some(termo => {
        const x = normalizar(termo);
        if (!x) return false;
        const regex = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(x)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
        return regex.test(t);
    });
}

function extrairMencoes(message) {
    return [...(message?.mentions?.users?.keys?.() || [])];
}

function salvarContexto(message, intent = null) {
    if (!message?.guildId || !message?.channelId) return;
    contexto.set(`${message.guildId}:${message.channelId}`, {
        autorId: message.author?.id || null,
        texto: String(message.content || '').slice(0, 300),
        intent,
        timestamp: Date.now()
    });
}

function obterContexto(message) {
    const item = contexto.get(`${message.guildId}:${message.channelId}`);
    if (!item || Date.now() - item.timestamp > CONFIG.contextoMs) return null;
    return item;
}

function canaisWar(guild) {
    const canais = [...guild.channels.cache.values()].filter(c => String(c.parentId || '') === String(CONFIG.categoriaId));
    const textos = canais.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement);
    const vozes = canais.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice);
    const pontuar = (c, palavras) => palavras.reduce((score, p, i) => score + (normalizar(c.name).includes(normalizar(p)) ? palavras.length - i : 0), 0);
    const escolherCanal = (lista, palavras) => [...lista].sort((a, b) => pontuar(b, palavras) - pontuar(a, palavras) || normalizar(a.name).localeCompare(normalizar(b.name)))[0] || null;
    return {
        texto: escolherCanal(textos, ['war', '🌍', 'partida', 'jogo']),
        voz: escolherCanal(vozes, ['war', '🌍', 'call', 'jogo'])
    };
}

function substituirCanais(guild, resposta) {
    if (typeof resposta !== 'string') return resposta;
    const { texto, voz } = canaisWar(guild);
    return resposta
        .replace(/\{CANAL_TEXTO_WAR\}/g, texto ? `<#${texto.id}>` : 'o canal de WAR')
        .replace(/\{CANAL_VOZ_WAR\}/g, voz ? `<#${voz.id}>` : 'um canal de voz');
}

function perfil(id) {
    try { return estatisticasLiga.calcularPerfil(String(id)); } catch { return null; }
}

function ranking(limite = CONFIG.maxRanking) {
    try { return estatisticasLiga.rankingPorPontos(limite) || []; } catch { return []; }
}

function winrate(j) {
    const partidas = num(j?.partidas);
    if (!partidas) return 0;
    const informado = Number(j?.winrate);
    if (Number.isFinite(informado)) return informado;
    const vitorias = num(j?.vitorias);
    return Number(((vitorias / partidas) * 100).toFixed(2));
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

async function resolverJogador(guild, valor) {
    if (!guild || !valor) return null;
    const bruto = String(valor).trim();
    const idMatch = bruto.match(/^<@!?(\d{15,25})>$/);
    const id = idMatch?.[1] || (/^\d{15,25}$/.test(bruto) ? bruto : null);
    if (id) {
        try { return await guild.members.fetch(id); } catch {}
    }

    const alvo = normalizar(bruto);
    if (!alvo) return null;
    const membros = [...guild.members.cache.values()].filter(m => !m.user?.bot);
    const campos = [m => normalizar(m.user?.username), m => normalizar(m.displayName), m => normalizar(m.user?.globalName)];

    for (const get of campos) {
        const exatos = membros.filter(m => get(m) === alvo);
        if (exatos.length === 1) return exatos[0];
        if (exatos.length > 1) return null;
    }

    const parciais = new Set();
    for (const get of campos) {
        for (const membro of membros) if (get(membro).includes(alvo)) parciais.add(membro.id);
    }
    if (parciais.size !== 1) return null;
    return guild.members.cache.get([...parciais][0]) || null;
}

async function mentionarJogador(guild, id) {
    const membro = await resolverJogador(guild, id);
    return membro ? `<@${membro.id}>` : mention(id);
}

function snapshotAnterior() {
    const leitura = lerJsonSeguro(inteligenciaPath, {}, 'auto_inteligencia.json');
    if (!leitura.ok) return {};
    return leitura.data.ultimaClassificacao && typeof leitura.data.ultimaClassificacao === 'object'
        ? leitura.data.ultimaClassificacao
        : {};
}

function snapshotAtual() {
    return ranking(CONFIG.maxSnapshot).reduce((acc, jogador, index) => {
        if (!jogador?.id) return acc;
        acc[String(jogador.id)] = { posicao: index + 1, pontos: num(jogador.pontos) };
        return acc;
    }, {});
}

function movimento() {
    const anterior = snapshotAnterior();
    const atualLista = ranking(CONFIG.maxSnapshot);
    const atual = new Map(atualLista.map((j, i) => [String(j.id), { ...j, posicao: i + 1 }]));
    const subindo = [];
    const caindo = [];
    for (const [id, item] of atual) {
        const antigo = anterior[id];
        if (!antigo) continue;
        const delta = num(antigo.posicao) - item.posicao;
        if (delta >= 2) subindo.push({ ...item, delta });
        if (delta <= -2) caindo.push({ ...item, delta: Math.abs(delta) });
    }
    subindo.sort((a, b) => b.delta - a.delta);
    caindo.sort((a, b) => b.delta - a.delta);

    const ultrapassagens = [];
    let maiorPosicaoAnterior = -Infinity;
    let maiorJogadorAnterior = null;
    for (const jogador of atualLista) {
        const antigo = anterior[String(jogador.id)];
        if (!antigo) continue;
        if (maiorJogadorAnterior && num(antigo.posicao) > maiorPosicaoAnterior) {
            ultrapassagens.push({ acima: jogador, abaixo: maiorJogadorAnterior });
        }
        if (num(antigo.posicao) > maiorPosicaoAnterior) {
            maiorPosicaoAnterior = num(antigo.posicao);
            maiorJogadorAnterior = jogador;
        }
    }
    return { anterior, atual: atualLista, subindo, caindo, ultrapassagens };
}

function salvarSnapshot() {
    const leitura = lerJsonSeguro(inteligenciaPath, {}, 'auto_inteligencia.json');
    const base = leitura.ok ? leitura.data : {};
    base.ultimaClassificacao = snapshotAtual();
    base.atualizadoEm = new Date().toISOString();
    return salvarJsonAtomico(inteligenciaPath, base);
}

function garantirSnapshotInicial() {
    const anterior = snapshotAnterior();
    if (Object.keys(anterior).length) return false;
    return salvarSnapshot();
}

function carregarInteligencia() {
    const leitura = lerJsonSeguro(inteligenciaPath, {}, 'auto_inteligencia.json');
    return leitura.ok ? leitura.data : {};
}

function hashMovimento(tipo, item) {
    if (!item?.id) return '';
    return `${tipo}:${item.id}:${item.posicao}:${item.delta}:${num(item.pontos)}`;
}

function marcarMovimentosAnunciados(movimentos) {
    const base = carregarInteligencia();
    const atuais = Array.isArray(base.movimentosAnunciados) ? base.movimentosAnunciados : [];
    const set = new Set(atuais);
    for (const item of movimentos) if (item) set.add(item);
    base.movimentosAnunciados = [...set].slice(-500);
    base.ultimaClassificacao = snapshotAtual();
    base.atualizadoEm = new Date().toISOString();
    return salvarJsonAtomico(inteligenciaPath, base);
}

async function analiseRanking(guild) {
    const r = ranking(CONFIG.maxRanking);
    if (!r.length) return null;
    garantirSnapshotInicial();
    const mov = movimento();
    const inteligencia = carregarInteligencia();
    const anunciados = new Set(Array.isArray(inteligencia.movimentosAnunciados) ? inteligencia.movimentosAnunciados : []);
    const lider = r[0];
    const segundo = r[1];
    const topKills = [...r].sort((a, b) => num(b.kills) - num(a.kills))[0];
    const ativo = [...r].sort((a, b) => num(b.partidas) - num(a.partidas))[0];
    const win = [...r].filter(j => num(j.partidas) >= 3).sort((a, b) => winrate(b) - winrate(a))[0];
    const opcoes = [];
    const novosHashes = [];

    if (mov.subindo[0]) {
        const hash = hashMovimento('subiu', mov.subindo[0]);
        if (!anunciados.has(hash)) {
            novosHashes.push(hash);
            opcoes.push(`🚀 ${await mentionarJogador(guild, mov.subindo[0].id)} subiu **${fmt(mov.subindo[0].delta)} posições** e agora está em **${mov.subindo[0].posicao}º**.`);
        }
    }
    if (mov.caindo[0]) {
        const hash = hashMovimento('caiu', mov.caindo[0]);
        if (!anunciados.has(hash)) {
            novosHashes.push(hash);
            opcoes.push(`📉 ${await mentionarJogador(guild, mov.caindo[0].id)} caiu **${fmt(mov.caindo[0].delta)} posições** e precisa reagir.`);
        }
    }
    if (mov.ultrapassagens[0]) {
        const item = mov.ultrapassagens[0];
        const hash = `ultrapassagem:${item.acima.id}:${item.abaixo.id}:${num(item.acima.pontos)}`;
        if (!anunciados.has(hash)) {
            novosHashes.push(hash);
            opcoes.push(`⚔️ ${await mentionarJogador(guild, item.acima.id)} ultrapassou ${await mentionarJogador(guild, item.abaixo.id)} no ranking.`);
        }
    }

    if (!opcoes.length && lider && segundo) opcoes.push(`👑 O líder é ${await mentionarJogador(guild, lider.id)} com **${fmt(lider.pontos)} pontos**. ${await mentionarJogador(guild, segundo.id)} vem logo atrás com **${fmt(segundo.pontos)}**.`);
    if (!opcoes.length && topKills) opcoes.push(`💥 Quem mais elimina no ranking atual é ${await mentionarJogador(guild, topKills.id)} com **${fmt(topKills.kills)} kills**.`);
    if (!opcoes.length && ativo) opcoes.push(`🎮 O mais ativo é ${await mentionarJogador(guild, ativo.id)} com **${fmt(ativo.partidas)} partidas**.`);
    if (!opcoes.length && win) opcoes.push(`📊 Melhor winrate entre quem tem 3+ partidas: ${await mentionarJogador(guild, win.id)} com **${fmt(winrate(win))}%**.`);

    const resposta = escolher(opcoes, `${guild.id}:analise-liga`);
    if (resposta) marcarMovimentosAnunciados(novosHashes);
    return resposta;
}

async function raioX(guild, id) {
    const j = perfil(id);
    if (!j) return null;
    const r = ranking(CONFIG.maxSnapshot);
    const posicao = r.findIndex(x => String(x.id) === String(id)) + 1;
    const texto = await mentionarJogador(guild, id);
    return [
        `📊 **RAIO-X DE ${texto}**`,
        `🏆 Posição: **${posicao > 0 ? `${posicao}º` : 'fora do ranking'}**`,
        `⭐ Pontos: **${fmt(j.pontos)}**`,
        `🎮 Partidas: **${fmt(j.partidas)}**`,
        `✅ Vitórias: **${fmt(j.vitorias)}**`,
        `📈 Winrate: **${fmt(winrate(j))}%**`,
        `💥 Kills: **${fmt(j.kills)}** • ☠️ Mortes: **${fmt(j.mortes)}**`,
        `⚔️ Saldo de pontos: **${fmt(num(j.pontosGanhos) - num(j.pontosPerdidos))}**`,
        `🔥 Sequência: ${streakTexto(j)}`
    ].join('\n');
}

async function comparar(guild, a, b) {
    const ja = perfil(a);
    const jb = perfil(b);
    if (!ja || !jb) return null;
    const nomeA = await mentionarJogador(guild, a);
    const nomeB = await mentionarJogador(guild, b);
    const vencedor = (num(ja.pontos) - num(jb.pontos)) || (winrate(ja) - winrate(jb)) || (num(ja.vitorias) - num(jb.vitorias)) || (num(ja.kills) - num(jb.kills));
    const melhor = vencedor > 0 ? nomeA : vencedor < 0 ? nomeB : 'empate técnico';
    return [
        '⚔️ **COMPARAÇÃO**',
        `${nomeA}: **${fmt(ja.pontos)} pts** • **${fmt(winrate(ja))}% WR** • **${fmt(ja.vitorias)} vitórias** • **${fmt(ja.kills)} kills**`,
        `${nomeB}: **${fmt(jb.pontos)} pts** • **${fmt(winrate(jb))}% WR** • **${fmt(jb.vitorias)} vitórias** • **${fmt(jb.kills)} kills**`,
        `🏆 Vantagem geral: **${melhor}**`
    ].join('\n');
}

function dadosOlimpiadas() {
    const leitura = lerJsonSeguro(olympPath, {}, 'olimpiadas.json');
    const d = leitura.ok ? leitura.data : {};
    return {
        duplas: Array.isArray(d.duplas) ? d.duplas.filter(x => x && x.ativa !== false) : [],
        resultados: Array.isArray(d.resultados) ? d.resultados : []
    };
}

function rankingOlimpiadas() {
    const d = dadosOlimpiadas();
    const porDupla = new Map(d.duplas.map(x => [String(x.id), x]));
    const mapa = new Map();
    const garantir = pais => {
        if (!mapa.has(pais)) mapa.set(pais, { pais, ouro: 0, prata: 0, bronze: 0 });
        return mapa.get(pais);
    };
    for (const resultado of d.resultados) {
        for (const [medalha, chave] of [['ouro', 'ouro'], ['prata', 'prata'], ['bronze', 'bronze']]) {
            const dupla = porDupla.get(String(resultado[chave] || ''));
            if (dupla?.pais) garantir(dupla.pais)[medalha]++;
        }
    }
    return [...mapa.values()]
        .map(x => ({ ...x, pontos: x.ouro * 3 + x.prata * 2 + x.bronze }))
        .sort((a, b) => b.pontos - a.pontos || b.ouro - a.ouro || b.prata - a.prata || b.bronze - a.bronze || normalizar(a.pais).localeCompare(normalizar(b.pais)));
}

async function olimp(guild) {
    const d = dadosOlimpiadas();
    const r = rankingOlimpiadas();
    if (!d.duplas.length && !d.resultados.length) return '🏅 As Olimpíadas ainda não têm dados registrados.';
    const linhas = r.slice(0, 5).map((x, i) => `${i + 1}. **${x.pais}** — ${fmt(x.pontos)} pts (${x.ouro}🥇 ${x.prata}🥈 ${x.bronze}🥉)`);
    return `🏅 **OLIMPÍADAS DE DUPLAS**\n${linhas.join('\n') || 'Sem medalhas registradas ainda.'}\n\nDuplas: **${fmt(d.duplas.length)}** • Resultados: **${fmt(d.resultados.length)}**`;
}

async function respostaInteligente(message) {
    const texto = String(message.content || '');
    const t = normalizar(texto);
    const guild = message.guild;
    const mencoes = extrairMencoes(message);
    const contextoAnterior = obterContexto(message);

    if (tem(t, ['olimpiada', 'olimpiadas', 'duplas', 'medalha', 'ouro', 'prata', 'bronze'])) {
        salvarContexto(message, 'olimpiadas');
        return olimp(guild);
    }

    if (mencoes.length >= 2 && tem(t, ['vs', 'versus', 'contra', 'comparar', 'duelo', 'quem e melhor', 'quem ganha', 'melhor que'])) {
        salvarContexto(message, 'comparacao');
        return comparar(guild, mencoes[0], mencoes[1]);
    }

    if (mencoes.length >= 1 && tem(t, ['pontuacao', 'estatistica', 'estatisticas', 'stats', 'raio x', 'desempenho'])) {
        salvarContexto(message, 'raiox');
        return raioX(guild, mencoes[0]);
    }

    if (tem(t, ['ranking', 'classificacao', 'liga', 'lider', 'primeiro lugar', 'top da liga'])) {
        salvarContexto(message, 'ranking');
        return analiseRanking(guild);
    }

    if (contextoAnterior && tem(t, ['e agora', 'entao', 'agora', 'e ai', 'e depois'])) {
        salvarContexto(message, contextoAnterior.intent);
        if (contextoAnterior.intent === 'ranking') return analiseRanking(guild);
        if (contextoAnterior.intent === 'olimpiadas') return olimp(guild);
    }

    return null;
}

function tradicional(texto, guild) {
    const leitura = lerJsonSeguro(dbPath, {}, 'auto_respostas.json');
    if (!leitura.ok) return null;
    const db = leitura.data;
    const t = normalizar(texto);
    const candidatos = [];
    for (const [gatilhoOriginal, respostas] of Object.entries(db)) {
        const gatilho = normalizarGatilho(gatilhoOriginal);
        if (!gatilho || !tem(t, [gatilho])) continue;
        const lista = Array.isArray(respostas) ? respostas : [respostas];
        const validas = lista.filter(x => typeof x === 'string' && x.trim()).map(x => substituirCanais(guild, x.trim()));
        if (validas.length) candidatos.push({ gatilho, respostas: validas });
    }
    candidatos.sort((a, b) => b.gatilho.length - a.gatilho.length);
    if (!candidatos.length) return null;
    const escolhido = candidatos[0];
    return { texto: escolher(escolhido.respostas, `${guild.id}:tradicional:${escolhido.gatilho}`), gatilho: escolhido.gatilho };
}

function humor(texto) {
    if (tem(texto, ['kkkk', 'haha', 'rsrs', 'hahaha'])) return { texto: escolher(HUMOR.riso, 'humor:riso'), tipo: 'humor' };
    if (tem(texto, ['perdi', 'derrota', 'perdi feio', 'perdeu'])) return { texto: escolher(HUMOR.derrota, 'humor:derrota'), tipo: 'humor' };
    if (tem(texto, ['ganhei', 'venci', 'vitoria', 'gg'])) return { texto: escolher(HUMOR.vitoria, 'humor:vitoria'), tipo: 'humor' };
    if (tem(texto, ['traidor', 'traiu', 'provocacao', 'provocando'])) return { texto: escolher(HUMOR.provocacao, 'humor:provocacao'), tipo: 'humor' };
    if (tem(texto, ['desisti', 'desanimo', 'nao consigo', 'perdendo'])) return { texto: escolher(HUMOR.incentivo, 'humor:incentivo'), tipo: 'humor' };
    return null;
}

async function processarMensagem(message) {
    if (!message?.guild || message.author?.bot) return;
    if (!categoriaPermitida(message.channel)) return;
    if (!message.content?.trim()) return;

    const chaveMensagem = `${message.guildId}:${message.id}`;
    if (mensagensProcessadas.has(chaveMensagem)) return;
    mensagensProcessadas.set(chaveMensagem, Date.now());

    const botMember = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
    if (!podeUsarCanal(message.channel, botMember)) return;

    const tradicionalResposta = tradicional(message.content, message.guild);
    let candidato = null;
    let tipo = 'geral';

    if (tradicionalResposta) {
        candidato = tradicionalResposta.texto;
        tipo = 'admin';
    } else {
        const inteligente = await respostaInteligente(message).catch(error => {
            console.error('[Auto-Resposta] Inteligência:', error.message);
            return null;
        });
        if (inteligente) {
            candidato = inteligente;
            tipo = 'inteligente';
        } else {
            const h = humor(message.content);
            if (h) {
                candidato = h.texto;
                tipo = h.tipo;
            }
        }
    }

    if (!candidato || typeof candidato !== 'string' || !candidato.trim()) return;
    if (!podeResponder(message.channelId, message.guildId, tipo === 'admin' ? 'admin' : 'geral')) return;
    if (tipo !== 'admin' && Math.random() > CONFIG.respostaChance) return;

    const resposta = substituirCanais(message.guild, candidato.trim()).slice(0, 2000);
    try {
        await message.channel.send({ content: resposta, allowedMentions: { parse: ['users'] } });
        registrarCooldown(message.channelId, message.guildId, tipo === 'admin' ? 'admin' : 'geral');
        salvarContexto(message, tipo);
    } catch (error) {
        console.error('[Auto-Resposta] Falha ao enviar:', error.message);
    }
}

function canalPensamentos(guild) {
    const canais = [...guild.channels.cache.values()].filter(c => {
        if (!(c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)) return false;
        const nome = normalizar(c.name);
        return nome.includes('o que vc ta pensando') || nome.includes('o que voce ta pensando') || nome.includes('o que estou pensando') || nome.includes('pensando do bot') || nome.includes('pensamento do bot');
    });
    return canais.find(c => categoriaPermitida(c)) || null;
}

async function enviarPensamento() {
    if (!clienteAtual) return;
    for (const guild of clienteAtual.guilds.cache.values()) {
        const canal = canalPensamentos(guild);
        if (!canal) continue;
        const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
        if (!podeUsarCanal(canal, botMember)) {
            console.warn(`[Auto-Resposta] Sem permissão para enviar pensamentos em ${guild.id}.`);
            continue;
        }
        if (!podeResponder(canal.id, guild.id, 'geral')) continue;
        const texto = escolher(PENSAMENTOS, `${guild.id}:pensamentos`);
        try {
            await canal.send({ content: texto, allowedMentions: { parse: [] } });
            registrarCooldown(canal.id, guild.id, 'geral');
        } catch (error) {
            console.error('[Auto-Resposta] Falha no pensamento:', error.message);
        }
    }
}

function iniciarTimers() {
    if (timerPensamentos) clearInterval(timerPensamentos);
    if (timerLimpeza) clearInterval(timerLimpeza);
    timerPensamentos = setInterval(() => enviarPensamento().catch(error => console.error('[Auto-Resposta] Timer pensamento:', error.message)), CONFIG.pensamentoIntervaloMs);
    timerLimpeza = setInterval(limparMemoria, CONFIG.limpezaMs);
    timerPensamentos.unref?.();
    timerLimpeza.unref?.();
}

module.exports = function iniciarAutoResposta(client) {
    if (!client) return;
    clienteAtual = client;
    if (handlerRegistrado) return;
    handlerRegistrado = true;

    client.on(Events.MessageCreate, message => {
        processarMensagem(message).catch(error => console.error('[Auto-Resposta] Erro:', error));
    });

    const pronto = () => {
        garantirSnapshotInicial();
        iniciarTimers();
        console.log('🤖 Auto Resposta V9 ativada — matching seguro, ranking, Olimpíadas e pensamentos.');
    };

    if (client.isReady?.()) pronto();
    else client.once(Events.ClientReady, pronto);
};