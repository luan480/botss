/* ========================================================================
   LIGA DAS NAÇÕES — ESTADO DA PONTUAÇÃO DA TEMPORADA

   Fonte de verdade:
   - partidas.json = histórico completo das partidas e estatísticas
   - pontuacao.json = saldo de pontos + perfil da temporada
   - temporada.json = período da temporada atual

   Este módulo também mantém compatibilidade com o motor legado, que usa
   o formato { "discordId": pontos } durante o processamento da partida.
   ======================================================================== */

const fs = require('fs');
const path = require('path');

const PONTUACAO_PADRAO = path.join(__dirname, '..', 'pontuacao.json');
const PARTIDAS_PADRAO = path.join(__dirname, '..', 'partidas.json');
const TEMPORADA_PADRAO = path.join(__dirname, '..', 'temporada.json');

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function idValido(id) {
    return /^\d{17,20}$/.test(String(id || ''));
}

function idDe(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'object') {
        return idDe(valor.id) || idDe(valor.userId) || idDe(valor.jogadorId) || idDe(valor.discordId);
    }
    const texto = String(valor);
    const mencao = texto.match(/^<@!?(\d+)>$/);
    const id = mencao ? mencao[1] : texto;
    return idValido(id) ? id : null;
}

function criarPerfil(id, nome = 'Desconhecido') {
    return {
        id: String(id),
        nome: String(nome || 'Desconhecido'),
        pontos: 0,
        pontosGanhos: 0,
        pontosPerdidos: 0,
        vitorias: 0,
        derrotas: 0,
        partidas: 0,
        kills: 0,
        mortes: 0,
        continentes: 0,
        continentesDetalhes: {
            asia: 0,
            europa: 0,
            africa: 0,
            amnorte: 0,
            amsul: 0,
            oceania: 0
        },
        terceiroLugar: 0,
        maisTropas: 0,
        warCoins: 0,
        winrate: 0
    };
}

function ehPerfil(valor) {
    return Boolean(
        valor &&
        typeof valor === 'object' &&
        !Array.isArray(valor) &&
        (
            Object.prototype.hasOwnProperty.call(valor, 'pontos') ||
            Object.prototype.hasOwnProperty.call(valor, 'vitorias') ||
            Object.prototype.hasOwnProperty.call(valor, 'partidas')
        )
    );
}

function carregar(caminho) {
    try {
        if (typeof caminho !== 'string' || !caminho.trim()) return {};
        if (!fs.existsSync(caminho)) return {};
        const bruto = fs.readFileSync(caminho, 'utf8');
        if (!bruto.trim()) return {};
        const dados = JSON.parse(bruto);
        return dados && typeof dados === 'object' ? dados : {};
    } catch (erro) {
        console.error('[LIGA] Erro ao ler JSON:', caminho, erro);
        return {};
    }
}

function salvar(caminho, dados) {
    try {
        if (typeof caminho !== 'string' || !caminho.trim()) {
            console.error('[LIGA] Caminho inválido para salvar JSON.');
            return false;
        }
        fs.mkdirSync(path.dirname(caminho), { recursive: true });
        fs.writeFileSync(caminho, JSON.stringify(dados, null, 2) + '\n', 'utf8');
        return true;
    } catch (erro) {
        console.error('[LIGA] Erro ao salvar JSON:', caminho, erro);
        return false;
    }
}

function estaEstruturado(dados) {
    return Object.values(dados || {}).some(ehPerfil);
}

function paraFormatoAntigo(dados) {
    const antigo = {};
    for (const [idOriginal, valor] of Object.entries(dados || {})) {
        const id = idDe(idOriginal) || String(idOriginal);
        if (!idValido(id)) continue;
        antigo[id] = ehPerfil(valor) ? numero(valor.pontos) : numero(valor);
    }
    return antigo;
}

function normalizarContinentes(perfil) {
    const origem = perfil?.continentesDetalhes || {};
    return {
        asia: numero(origem.asia),
        europa: numero(origem.europa),
        africa: numero(origem.africa),
        amnorte: numero(origem.amnorte),
        amsul: numero(origem.amsul),
        oceania: numero(origem.oceania)
    };
}

function normalizarPerfil(id, perfil, nomeFallback) {
    const base = criarPerfil(id, nomeFallback);
    if (!ehPerfil(perfil)) {
        base.pontos = numero(perfil);
        return base;
    }

    base.nome = String(perfil.nome || nomeFallback || 'Desconhecido');
    base.pontos = numero(perfil.pontos ?? perfil.ptsLiga ?? perfil.pontuacao);
    base.pontosGanhos = numero(perfil.pontosGanhos);
    base.pontosPerdidos = numero(perfil.pontosPerdidos);
    base.vitorias = numero(perfil.vitorias);
    base.derrotas = numero(perfil.derrotas);
    base.partidas = numero(perfil.partidas);
    base.kills = numero(perfil.kills);
    base.mortes = numero(perfil.mortes);
    base.continentes = numero(perfil.continentes);
    base.continentesDetalhes = normalizarContinentes(perfil);
    base.terceiroLugar = numero(perfil.terceiroLugar);
    base.maisTropas = numero(perfil.maisTropas);
    base.warCoins = numero(perfil.warCoins);
    base.winrate = numero(perfil.winrate);
    return base;
}

function lerPartidas(partidasPath = PARTIDAS_PADRAO) {
    const dados = carregar(partidasPath);
    if (Array.isArray(dados)) return dados.map((partida, i) => ({ id: String(i), partida }));
    if (Array.isArray(dados?.partidas)) return dados.partidas.map((partida, i) => ({ id: String(i), partida }));
    return Object.entries(dados || {}).map(([id, partida]) => ({ id: String(id), partida }));
}

function timestampSnowflake(id) {
    const texto = String(id || '');
    if (!idValido(texto)) return null;
    try {
        return Number((BigInt(texto) >> 22n) + 1420070400000n);
    } catch {
        return null;
    }
}

function dataDaPartida(registro) {
    const partida = registro?.partida || {};
    const candidatos = [
        partida.meta?.registradaEm,
        partida.meta?.createdAt,
        partida.data,
        partida.dataPartida,
        partida.createdAt,
        partida.timestamp,
        partida.date,
        registro.id
    ];

    for (const valor of candidatos) {
        const snowflake = timestampSnowflake(valor);
        if (snowflake !== null) return snowflake;
        const ms = new Date(valor || '').getTime();
        if (Number.isFinite(ms) && ms > 0) return ms;
    }
    return null;
}

function inicioTemporada(temporadaPath = TEMPORADA_PADRAO) {
    const temporada = carregar(temporadaPath);
    const ms = new Date(temporada.inicio || 0).getTime();
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

function estaNaTemporada(registro, inicioMs) {
    if (!inicioMs) return true;
    const ts = dataDaPartida(registro);
    return ts === null || ts >= inicioMs;
}

function nomeDosJogadores(registros) {
    const nomes = {};
    for (const { partida } of registros) {
        for (const jogador of partida?.jogadoresBrutos || []) {
            const id = idDe(jogador);
            if (id && jogador?.username) nomes[id] = jogador.username;
        }
    }
    return nomes;
}

function perfilTemporada(id, nome) {
    return criarPerfil(id, nome);
}

function garantir(perfis, id, nome) {
    if (!idValido(id)) return null;
    if (!perfis[id]) perfis[id] = perfilTemporada(id, nome);
    if (nome && perfis[id].nome === 'Desconhecido') perfis[id].nome = String(nome);
    return perfis[id];
}

function adicionarParticipantes(perfis, partida, nomes) {
    for (const jogador of partida?.jogadoresBrutos || []) {
        const id = idDe(jogador);
        if (!id) continue;
        const perfil = garantir(perfis, id, jogador.username || nomes[id]);
        if (perfil) perfil.partidas++;
    }
}

function adicionarResultado(perfis, partida, nomes) {
    const respostas = partida?.respostas || {};
    const vencedor = idDe(respostas.vencedor || respostas.winner || respostas.ganhador);
    const segundo = idDe(respostas.segundo || respostas.segundoLugar || respostas.runnerUp);
    const terceiro = idDe(respostas.terceiro || respostas.terceiroLugar);
    const tropas = idDe(respostas.maisTropas || respostas.maiorTropas || respostas.tropas);

    if (vencedor) garantir(perfis, vencedor, nomes[vencedor]).vitorias++;
    if (terceiro) garantir(perfis, terceiro, nomes[terceiro]).terceiroLugar++;
    if (tropas) garantir(perfis, tropas, nomes[tropas]).maisTropas++;

    const abates = Array.isArray(respostas.abates)
        ? respostas.abates
        : (Array.isArray(respostas.kills) ? respostas.kills : []);

    for (const kill of abates) {
        const matador = idDe(kill?.matador || kill?.killer || kill?.atacante || kill?.quemMatou);
        const vitima = idDe(kill?.vitima || kill?.victim || kill?.morto || kill?.quemMorreu);
        if (matador) garantir(perfis, matador, nomes[matador]).kills++;
        if (vitima) garantir(perfis, vitima, nomes[vitima]).mortes++;
    }

    const continentes = Array.isArray(respostas.continentes)
        ? respostas.continentes
        : (Array.isArray(respostas.territorios) ? respostas.territorios : []);

    for (const continente of continentes) {
        const id = idDe(continente?.dono || continente?.jogador || continente?.jogadorId || continente?.userId || continente?.conquistador);
        if (!id) continue;
        const perfil = garantir(perfis, id, nomes[id]);
        perfil.continentes++;
        const codigo = String(continente?.cont || continente?.continente || continente?.territorio || '').toLowerCase().trim();
        if (codigo === 'europa' || codigo === 'europe') perfil.continentesDetalhes.europa++;
        else if (codigo === 'asia' || codigo === 'ásia') perfil.continentesDetalhes.asia++;
        else if (codigo === 'africa' || codigo === 'áfrica') perfil.continentesDetalhes.africa++;
        else if (['amnorte', 'am_norte', 'america_do_norte', 'américa_do_norte', 'america-norte'].includes(codigo)) perfil.continentesDetalhes.amnorte++;
        else if (['amsul', 'am_sul', 'america_do_sul', 'américa_do_sul', 'america-sul'].includes(codigo)) perfil.continentesDetalhes.amsul++;
        else if (codigo === 'oceania' || codigo === 'oceânia') perfil.continentesDetalhes.oceania++;
    }

    for (const [idOriginal, dados] of Object.entries(partida?.pontos || {})) {
        const id = idDe(idOriginal);
        if (!id) continue;
        const perfil = garantir(perfis, id, nomes[id]);
        const pontos = dados && typeof dados === 'object' && !Array.isArray(dados)
            ? numero(dados.ptsLiga ?? dados.pontos ?? dados.pontuacao)
            : numero(dados);
        const wc = dados && typeof dados === 'object' && !Array.isArray(dados)
            ? numero(dados.wcRecebido ?? dados.warCoins ?? dados.wc)
            : 0;
        perfil.pontosGanhos += Math.max(0, pontos);
        perfil.pontosPerdidos += Math.max(0, -pontos);
        perfil.warCoins += wc;
    }
}

function calcularEstatisticasTemporada(partidasPath = PARTIDAS_PADRAO, temporadaPath = TEMPORADA_PADRAO) {
    const registros = lerPartidas(partidasPath)
        .filter(r => !r.partida?.anulada && !r.partida?.anulado && !r.partida?.cancelada && !r.partida?.cancelado);
    const inicioMs = inicioTemporada(temporadaPath);
    const atuais = registros.filter(r => estaNaTemporada(r, inicioMs));
    const nomes = nomeDosJogadores(atuais);
    const perfis = {};

    for (const registro of atuais) {
        adicionarParticipantes(perfis, registro.partida, nomes);
        adicionarResultado(perfis, registro.partida, nomes);
    }

    for (const perfil of Object.values(perfis)) {
        perfil.derrotas = Math.max(0, perfil.partidas - perfil.vitorias);
        perfil.winrate = perfil.partidas > 0
            ? Number(((perfil.vitorias / perfil.partidas) * 100).toFixed(2))
            : 0;
    }

    return perfis;
}

/*
 * Normaliza perfis e, quando existe o histórico, reconstrói as estatísticas
 * da temporada. Assim um pontuacao.json antigo/stale não consegue esconder
 * partidas, kills, mortes, continentes ou WarCoins no painel.
 */
function normalizarTodos(dados, partidasPath = PARTIDAS_PADRAO, temporadaPath = TEMPORADA_PADRAO) {
    const atuais = calcularEstatisticasTemporada(partidasPath, temporadaPath);
    const resultado = {};

    for (const [idOriginal, valor] of Object.entries(dados || {})) {
        const id = idDe(idOriginal);
        if (!id) continue;
        const perfilSalvo = normalizarPerfil(id, valor, valor?.nome);
        const historico = atuais[id];

        if (historico) {
            resultado[id] = {
                ...perfilSalvo,
                nome: historico.nome !== 'Desconhecido' ? historico.nome : perfilSalvo.nome,
                vitorias: historico.vitorias,
                derrotas: historico.derrotas,
                partidas: historico.partidas,
                kills: historico.kills,
                mortes: historico.mortes,
                continentes: historico.continentes,
                continentesDetalhes: historico.continentesDetalhes,
                terceiroLugar: historico.terceiroLugar,
                maisTropas: historico.maisTropas,
                warCoins: historico.warCoins,
                pontosGanhos: historico.pontosGanhos,
                pontosPerdidos: historico.pontosPerdidos,
                winrate: historico.winrate
            };
        } else {
            resultado[id] = perfilSalvo;
        }
    }

    // Inclui jogadores que aparecem no histórico mesmo que o perfil antigo
    // tenha sido apagado/zerado.
    for (const [id, historico] of Object.entries(atuais)) {
        if (!resultado[id]) {
            resultado[id] = {
                ...historico,
                pontos: 0
            };
        }
    }

    return resultado;
}

function paraFormatoEstruturado(legacy, partidasPath = PARTIDAS_PADRAO, temporadaPath = TEMPORADA_PADRAO) {
    const perfis = calcularEstatisticasTemporada(partidasPath, temporadaPath);

    for (const [idOriginal, valor] of Object.entries(legacy || {})) {
        const id = idDe(idOriginal);
        if (!id) continue;
        const perfil = perfis[id] ||= criarPerfil(id);
        perfil.pontos = numero(valor);
    }

    return Object.fromEntries(Object.entries(perfis).map(([id, perfil]) => [id, {
        id,
        nome: perfil.nome || 'Desconhecido',
        pontos: numero(perfil.pontos),
        pontosGanhos: numero(perfil.pontosGanhos),
        pontosPerdidos: numero(perfil.pontosPerdidos),
        vitorias: numero(perfil.vitorias),
        derrotas: numero(perfil.derrotas),
        partidas: numero(perfil.partidas),
        kills: numero(perfil.kills),
        mortes: numero(perfil.mortes),
        continentes: numero(perfil.continentes),
        continentesDetalhes: normalizarContinentes(perfil),
        terceiroLugar: numero(perfil.terceiroLugar),
        maisTropas: numero(perfil.maisTropas),
        warCoins: numero(perfil.warCoins),
        winrate: numero(perfil.winrate)
    }]));
}

function prepararFormatoAntigo(pontuacaoPath = PONTUACAO_PADRAO) {
    const dados = carregar(pontuacaoPath);
    if (!estaEstruturado(dados)) return dados;
    const antigo = paraFormatoAntigo(dados);
    salvar(pontuacaoPath, antigo);
    return antigo;
}

function sincronizarArquivo(
    pontuacaoPath = PONTUACAO_PADRAO,
    partidasPath = PARTIDAS_PADRAO,
    temporadaPath = TEMPORADA_PADRAO
) {
    const atual = carregar(pontuacaoPath);
    const legacy = estaEstruturado(atual) ? paraFormatoAntigo(atual) : atual;
    const estruturado = paraFormatoEstruturado(legacy, partidasPath, temporadaPath);
    salvar(pontuacaoPath, estruturado);
    return estruturado;
}

module.exports = {
    numero,
    idDe,
    idValido,
    criarPerfil,
    ehPerfil,
    estaEstruturado,
    carregar,
    salvar,
    paraFormatoAntigo,
    prepararFormatoAntigo,
    normalizarPerfil,
    normalizarTodos,
    paraFormatoEstruturado,
    sincronizarArquivo,
    calcularEstatisticasTemporada
};
