/* ========================================================================
   WORLDWARBR — LIGA DAS NAÇÕES
   ESTADO / NORMALIZAÇÃO DA PONTUAÇÃO

   REGRA PRINCIPAL:
   - partidas.json é a fonte de verdade para partidas, vitórias, kills,
     mortes, continentes e pontos de partidas.
   - Partidas anuladas NÃO entram no histórico.
   - pontuacao.json pode conter AJUSTES MANUAIS. Quando existirem, o valor
     manual é aplicado como diferença sobre o histórico, nunca como substituto
     do histórico.
   ======================================================================== */

const fs = require('fs');
const path = require('path');

const PONTUACAO_PADRAO = path.join(__dirname, '..', 'pontuacao.json');
const PARTIDAS_PADRAO = path.join(__dirname, '..', 'partidas.json');
const TEMPORADA_PADRAO = path.join(__dirname, '..', 'temporada.json');
const configPontos = require('./configPontos.js');

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
        if (!caminho || typeof caminho !== 'string') return {};
        if (!fs.existsSync(caminho)) return {};
        const bruto = fs.readFileSync(caminho, 'utf8');
        if (!bruto.trim()) return {};
        const dados = JSON.parse(bruto);
        return dados && typeof dados === 'object' ? dados : {};
    } catch (erro) {
        console.error('[LIGA] Erro ao ler JSON:', caminho, erro.message);
        return {};
    }
}

function salvar(caminho, dados) {
    try {
        if (!caminho || typeof caminho !== 'string') return false;
        fs.mkdirSync(path.dirname(caminho), { recursive: true });
        const tmp = `${caminho}.tmp`;
        fs.writeFileSync(tmp, `${JSON.stringify(dados, null, 2)}\n`, 'utf8');
        fs.renameSync(tmp, caminho);
        return true;
    } catch (erro) {
        console.error('[LIGA] Erro ao salvar JSON:', caminho, erro.message);
        return false;
    }
}

function estaEstruturado(dados) {
    return Object.values(dados || {}).some(ehPerfil);
}

function paraFormatoAntigo(dados) {
    const antigo = {};
    for (const [idOriginal, valor] of Object.entries(dados || {})) {
        const id = idDe(idOriginal);
        if (!id) continue;
        antigo[id] = ehPerfil(valor)
            ? numero(valor.pontos ?? valor.ptsLiga ?? valor.pontuacao)
            : numero(valor);
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
    const inicio = new Date(temporada.inicio || temporada.dataInicio || 0).getTime();
    return Number.isFinite(inicio) && inicio > 0 ? inicio : 0;
}

function temporadaIdAtual(temporadaPath = TEMPORADA_PADRAO) {
    const temporada = carregar(temporadaPath);
    return String(temporada.id || temporada.nome || temporada.codigo || temporada.inicio || 'temporada-atual');
}

function estaNaTemporada(registro, inicioMs) {
    if (!inicioMs) return true;
    const ts = dataDaPartida(registro);
    return ts !== null && ts >= inicioMs;
}

function anulada(partida) {
    return Boolean(partida?.anulada || partida?.anulado || partida?.cancelada || partida?.cancelado);
}

function nomeDosJogadores(registros) {
    const nomes = {};
    for (const { partida } of registros) {
        for (const jogador of partida?.jogadoresBrutos || partida?.jogadores || []) {
            const id = idDe(jogador);
            if (id && (jogador?.username || jogador?.nome)) nomes[id] = jogador.username || jogador.nome;
        }
    }
    return nomes;
}

function garantir(perfis, id, nome) {
    if (!idValido(id)) return null;
    if (!perfis[id]) perfis[id] = criarPerfil(id, nome);
    if (nome && perfis[id].nome === 'Desconhecido') perfis[id].nome = String(nome);
    return perfis[id];
}

function jogadoresDaPartida(partida) {
    if (Array.isArray(partida?.jogadoresBrutos)) return partida.jogadoresBrutos;
    if (Array.isArray(partida?.jogadores)) return partida.jogadores;
    return [];
}

function obterRespostas(partida) {
    return partida?.respostas || partida?.resultado || {};
}

function pontuacaoPersistida(partida, id) {
    const dados = partida?.pontos?.[id] ?? partida?.pontos?.[String(id)];
    if (dados === undefined) return null;
    if (dados && typeof dados === 'object') return numero(dados.ptsLiga ?? dados.pontos ?? dados.pontuacao);
    return numero(dados);
}

function calcularPontosDaPartida(partida) {
    const respostas = obterRespostas(partida);
    const jogadores = jogadoresDaPartida(partida).map(j => idDe(j)).filter(Boolean);
    const tabela = Object.fromEntries(jogadores.map(id => [id, 0]));

    const vencedor = idDe(respostas.vencedor || respostas.winner || respostas.ganhador);
    const segundo = idDe(respostas.segundo || respostas.segundoLugar || respostas.runnerUp);
    const terceiro = idDe(respostas.terceiro || respostas.terceiroLugar);
    const maisTropas = idDe(respostas.maisTropas || respostas.maiorTropas || respostas.tropas);

    if (vencedor && tabela[vencedor] !== undefined) {
        tabela[vencedor] += respostas.modo === 'objetivo'
            ? numero(configPontos.vitoria.objetivo)
            : numero(configPontos.vitoria.territorios);
    }
    if (segundo && tabela[segundo] !== undefined) tabela[segundo] += numero(configPontos.segundoLugar);
    if (terceiro && tabela[terceiro] !== undefined) tabela[terceiro] += numero(configPontos.terceiroLugar);
    if (maisTropas && tabela[maisTropas] !== undefined) tabela[maisTropas] += numero(configPontos.maisTropas);

    const continentes = Array.isArray(respostas.continentes)
        ? respostas.continentes
        : (Array.isArray(respostas.territorios) ? respostas.territorios : []);

    for (const continente of continentes) {
        const dono = idDe(continente?.dono || continente?.jogador || continente?.jogadorId || continente?.userId);
        const codigo = String(continente?.cont || continente?.continente || '').toLowerCase();
        if (!dono || tabela[dono] === undefined) continue;
        const cfg = configPontos.continentes?.[codigo];
        if (cfg) tabela[dono] += numero(cfg.pontos);
    }

    const abates = Array.isArray(respostas.abates) ? respostas.abates : [];
    const mortos = new Set();
    for (const abate of abates) {
        const matador = idDe(abate?.matador || abate?.killer || abate?.atacante);
        const vitima = idDe(abate?.vitima || abate?.victim || abate?.morto);
        if (matador && tabela[matador] !== undefined) tabela[matador] += numero(configPontos.combate.kill);
        if (vitima && tabela[vitima] !== undefined) {
            tabela[vitima] += numero(configPontos.combate.morte);
            mortos.add(vitima);
        }
    }

    for (const id of jogadores) {
        if (!mortos.has(id)) tabela[id] += numero(configPontos.sobrevivencia);
    }

    return tabela;
}

function pontosDaPartida(partida, id) {
    const persistido = pontuacaoPersistida(partida, id);
    if (persistido !== null) return persistido;
    return numero(calcularPontosDaPartida(partida)[id]);
}

function adicionarParticipantes(perfis, partida, nomes) {
    for (const jogador of jogadoresDaPartida(partida)) {
        const id = idDe(jogador);
        if (!id) continue;
        garantir(perfis, id, jogador.username || jogador.nome || nomes[id]);
        perfis[id].partidas++;
    }
}

function adicionarResultado(perfis, partida, nomes) {
    const respostas = obterRespostas(partida);
    const vencedor = idDe(respostas.vencedor || respostas.winner || respostas.ganhador);
    const terceiro = idDe(respostas.terceiro || respostas.terceiroLugar);
    const tropas = idDe(respostas.maisTropas || respostas.maiorTropas || respostas.tropas);

    if (vencedor) garantir(perfis, vencedor, nomes[vencedor]).vitorias++;
    if (terceiro) garantir(perfis, terceiro, nomes[terceiro]).terceiroLugar++;
    if (tropas) garantir(perfis, tropas, nomes[tropas]).maisTropas++;

    const abates = Array.isArray(respostas.abates) ? respostas.abates : [];
    for (const kill of abates) {
        const matador = idDe(kill?.matador || kill?.killer || kill?.atacante);
        const vitima = idDe(kill?.vitima || kill?.victim || kill?.morto);
        if (matador) garantir(perfis, matador, nomes[matador]).kills++;
        if (vitima) garantir(perfis, vitima, nomes[vitima]).mortes++;
    }

    const continentes = Array.isArray(respostas.continentes) ? respostas.continentes : [];
    for (const continente of continentes) {
        const id = idDe(continente?.dono || continente?.jogador || continente?.jogadorId || continente?.userId);
        if (!id) continue;
        const perfil = garantir(perfis, id, nomes[id]);
        perfil.continentes++;
        const codigo = String(continente?.cont || continente?.continente || '').toLowerCase().trim();
        if (codigo === 'europa' || codigo === 'europe') perfil.continentesDetalhes.europa++;
        else if (codigo === 'asia' || codigo === 'ásia') perfil.continentesDetalhes.asia++;
        else if (codigo === 'africa' || codigo === 'áfrica') perfil.continentesDetalhes.africa++;
        else if (['amnorte', 'am_norte', 'america_do_norte', 'américa_do_norte', 'america-norte'].includes(codigo)) perfil.continentesDetalhes.amnorte++;
        else if (['amsul', 'am_sul', 'america_do_sul', 'américa_do_sul', 'america-sul'].includes(codigo)) perfil.continentesDetalhes.amsul++;
        else if (codigo === 'oceania' || codigo === 'oceânia') perfil.continentesDetalhes.oceania++;
    }

    for (const jogador of jogadoresDaPartida(partida)) {
        const id = idDe(jogador);
        if (!id) continue;
        const perfil = garantir(perfis, id, nomes[id]);
        const pontos = pontosDaPartida(partida, id);
        perfil.pontos += pontos;
        if (pontos >= 0) perfil.pontosGanhos += pontos;
        else perfil.pontosPerdidos += Math.abs(pontos);

        const dadosPersistidos = partida?.pontos?.[id];
        if (dadosPersistidos && typeof dadosPersistidos === 'object') {
            perfil.warCoins += numero(dadosPersistidos.wcRecebido ?? dadosPersistidos.warCoins ?? dadosPersistidos.wc);
        } else if (pontos > 0) {
            perfil.warCoins += pontos * 100;
        }
    }
}

function calcularEstatisticasTemporada(partidasPath = PARTIDAS_PADRAO, temporadaPath = TEMPORADA_PADRAO) {
    const inicioMs = inicioTemporada(temporadaPath);
    const registros = lerPartidas(partidasPath)
        .filter(r => r.partida && !anulada(r.partida))
        .filter(r => estaNaTemporada(r, inicioMs));

    const nomes = nomeDosJogadores(registros);
    const perfis = {};

    for (const registro of registros) {
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

function pontosAtuais(dados, id) {
    const salvo = dados?.[id];
    if (salvo === undefined) return null;
    return ehPerfil(salvo) ? numero(salvo.pontos ?? salvo.ptsLiga ?? salvo.pontuacao) : numero(salvo);
}

function ajusteManual(dados, id, historicoPontos) {
    const salvo = dados?.[id];
    if (!salvo || typeof salvo !== 'object' || salvo.ajusteManual !== true) return 0;

    if (salvo.ajusteManualValor !== undefined) {
        return numero(salvo.ajusteManualValor);
    }

    const atual = pontosAtuais(dados, id);
    if (atual === null) return 0;

    // Compatibilidade com ajustes antigos que ainda não guardavam o delta.
    return atual - numero(historicoPontos);
}

function aplicarPontosHistoricos(resultado, dadosOriginais, historico) {
    for (const [id, perfil] of Object.entries(resultado)) {
        const h = historico[id];
        const base = h ? numero(h.pontos) : 0;
        const delta = ajusteManual(dadosOriginais, id, base);
        perfil.pontos = base + delta;

        // O extrato histórico continua representando apenas partidas.
        // Ajustes manuais ficam apenas no total final.
        if (dadosOriginais?.[id]?.ajusteManual === true) {
            perfil.ajusteManual = true;
            perfil.ajusteManualValor = delta;
            perfil.ajusteManualEm = dadosOriginais[id].ajusteManualEm;
            perfil.ajusteManualPor = dadosOriginais[id].ajusteManualPor;
        }
    }
}

function normalizarTodos(dados, partidasPath = PARTIDAS_PADRAO, temporadaPath = TEMPORADA_PADRAO) {
    const historico = calcularEstatisticasTemporada(partidasPath, temporadaPath);
    const resultado = {};

    for (const [idOriginal, valor] of Object.entries(dados || {})) {
        const id = idDe(idOriginal);
        if (!id) continue;
        const salvo = normalizarPerfil(id, valor, valor?.nome);
        const h = historico[id];

        resultado[id] = h
            ? { ...salvo, ...h, id, nome: h.nome || salvo.nome }
            : salvo;
    }

    for (const [id, h] of Object.entries(historico)) {
        if (!resultado[id]) resultado[id] = { ...h, id, pontos: h.pontos };
    }

    aplicarPontosHistoricos(resultado, dados, historico);
    return resultado;
}

function paraFormatoEstruturado(legacy, partidasPath = PARTIDAS_PADRAO, temporadaPath = TEMPORADA_PADRAO) {
    const historico = calcularEstatisticasTemporada(partidasPath, temporadaPath);
    const ids = new Set([
        ...Object.keys(historico),
        ...Object.keys(legacy || {}).map(id => idDe(id)).filter(Boolean)
    ]);

    const resultado = {};

    for (const id of ids) {
        const h = historico[id] || criarPerfil(id);
        const salvo = legacy?.[id];
        const perfil = {
            ...criarPerfil(id, h.nome),
            ...h,
            id,
            nome: h.nome || (ehPerfil(salvo) ? salvo.nome : 'Desconhecido'),
            pontos: h.pontos
        };

        const delta = ajusteManual(legacy, id, h.pontos);
        perfil.pontos = h.pontos + delta;

        if (salvo?.ajusteManual === true) {
            perfil.ajusteManual = true;
            perfil.ajusteManualValor = delta;
            perfil.ajusteManualEm = salvo.ajusteManualEm;
            perfil.ajusteManualPor = salvo.ajusteManualPor;
        }

        resultado[id] = perfil;
    }

    return resultado;
}

function prepararFormatoAntigo(pontuacaoPath = PONTUACAO_PADRAO) {
    return paraFormatoAntigo(carregar(pontuacaoPath));
}

function sincronizarArquivo(
    pontuacaoPath = PONTUACAO_PADRAO,
    partidasPath = PARTIDAS_PADRAO,
    temporadaPath = TEMPORADA_PADRAO
) {
    const atual = carregar(pontuacaoPath);
    const estruturado = paraFormatoEstruturado(atual, partidasPath, temporadaPath);
    if (!salvar(pontuacaoPath, estruturado)) {
        throw new Error('Não foi possível sincronizar pontuacao.json.');
    }
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
    calcularEstatisticasTemporada,
    calcularPontosDaPartida,
    pontosDaPartida,
    temporadaIdAtual,
    dataDaPartida
};
