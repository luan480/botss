/* ========================================================================
   LIGA DAS NAÇÕES — ESTADO DA PONTUAÇÃO DA TEMPORADA

   Este utilitário centraliza a transição entre o formato antigo
   { "id": pontos } e o novo perfil organizado da temporada.

   IMPORTANTE:
   - pontuacao.json = somente temporada atual.
   - partidas.json = histórico das partidas.
   - progressao.json/careerHistory = histórico permanente.
   ======================================================================== */

const fs = require('fs');
const path = require('path');

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function criarPerfil(id, nome = 'Desconhecido') {
    return {
        id: String(id),
        nome: String(nome || 'Desconhecido'),
        pontos: 0,
        vitorias: 0,
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
        warCoins: 0
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
        const diretorio = path.dirname(caminho);
        fs.mkdirSync(diretorio, { recursive: true });
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
    for (const [id, valor] of Object.entries(dados || {})) {
        antigo[String(id)] = ehPerfil(valor) ? numero(valor.pontos) : numero(valor);
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
    base.vitorias = numero(perfil.vitorias);
    base.partidas = numero(perfil.partidas);
    base.kills = numero(perfil.kills);
    base.mortes = numero(perfil.mortes);
    base.continentes = numero(perfil.continentes);
    base.continentesDetalhes = normalizarContinentes(perfil);
    base.terceiroLugar = numero(perfil.terceiroLugar);
    base.maisTropas = numero(perfil.maisTropas);
    base.warCoins = numero(perfil.warCoins);

    return base;
}

function normalizarTodos(dados) {
    const resultado = {};
    for (const [id, valor] of Object.entries(dados || {})) {
        resultado[String(id)] = normalizarPerfil(id, valor, valor?.nome);
    }
    return resultado;
}

function idDe(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'object') {
        return idDe(valor.id) || idDe(valor.userId) || idDe(valor.jogadorId) || idDe(valor.discordId);
    }
    const texto = String(valor);
    const mencao = texto.match(/^<@!?(\d+)>$/);
    return mencao ? mencao[1] : (/^\d+$/.test(texto) ? texto : null);
}

function lerPartidas(partidasPath) {
    const dados = carregar(partidasPath);
    if (Array.isArray(dados)) {
        return dados.map((partida, i) => ({ id: String(i), partida }));
    }
    if (Array.isArray(dados?.partidas)) {
        return dados.partidas.map((partida, i) => ({ id: String(i), partida }));
    }
    return Object.entries(dados || {}).map(([id, partida]) => ({ id: String(id), partida }));
}

function timestampSnowflake(id) {
    const texto = String(id || '');
    if (!/^\d{17,20}$/.test(texto)) return null;
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

function inicioTemporada(temporadaPath) {
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

function adicionarParticipantes(perfis, partida, nomes) {
    for (const jogador of partida?.jogadoresBrutos || []) {
        const id = idDe(jogador);
        if (!id) continue;
        const perfil = perfis[id] ||= perfilTemporada(id, jogador.username || nomes[id]);
        perfil.nome = jogador.username || perfil.nome;
        perfil.partidas++;
    }
}

function adicionarResultado(perfis, partida, nomes) {
    const respostas = partida?.respostas || {};
    const vencedor = idDe(respostas.vencedor);
    const segundo = idDe(respostas.segundo || respostas.segundoLugar || respostas.runnerUp);
    const terceiro = idDe(respostas.terceiro || respostas.terceiroLugar);
    const tropas = idDe(respostas.maisTropas || respostas.maiorTropas || respostas.tropas);

    if (vencedor) (perfis[vencedor] ||= perfilTemporada(vencedor, nomes[vencedor])).vitorias++;
    if (terceiro) (perfis[terceiro] ||= perfilTemporada(terceiro, nomes[terceiro])).terceiroLugar++;
    if (tropas) (perfis[tropas] ||= perfilTemporada(tropas, nomes[tropas])).maisTropas++;

    for (const kill of respostas.abates || []) {
        const matador = idDe(kill?.matador || kill?.killer || kill?.atacante || kill?.quemMatou);
        const vitima = idDe(kill?.vitima || kill?.victim || kill?.morto || kill?.quemMorreu);
        if (matador) (perfis[matador] ||= perfilTemporada(matador, nomes[matador])).kills++;
        if (vitima) (perfis[vitima] ||= perfilTemporada(vitima, nomes[vitima])).mortes++;
    }

    for (const continente of respostas.continentes || []) {
        const id = idDe(continente?.dono || continente?.jogador || continente?.jogadorId || continente?.userId || continente?.conquistador);
        if (!id) continue;
        const perfil = perfis[id] ||= perfilTemporada(id, nomes[id]);
        perfil.continentes++;
        const codigo = String(continente?.cont || continente?.continente || continente?.territorio || '').toLowerCase().trim();
        const chave = codigo === 'europe' ? 'europa' : codigo === 'ásia' ? 'asia' : codigo === 'áfrica' ? 'africa' : codigo;
        if (Object.prototype.hasOwnProperty.call(perfil.continentesDetalhes, chave)) {
            perfil.continentesDetalhes[chave]++;
        }
    }

    for (const [idOriginal, dados] of Object.entries(partida?.pontos || {})) {
        const id = idDe(idOriginal);
        if (!id) continue;
        const perfil = perfis[id] ||= perfilTemporada(id, nomes[id]);
        if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
            perfil.warCoins += numero(dados.wcRecebido ?? dados.warCoins ?? dados.wc);
        }
    }
}

function calcularEstatisticasTemporada(partidasPath, temporadaPath) {
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
    }

    return perfis;
}

function prepararFormatoAntigo(pontuacaoPath) {
    const dados = carregar(pontuacaoPath);
    if (!estaEstruturado(dados)) return dados;
    const antigo = paraFormatoAntigo(dados);
    salvar(pontuacaoPath, antigo);
    return antigo;
}

function paraFormatoEstruturado(legacy, partidasPath, temporadaPath) {
    const perfis = calcularEstatisticasTemporada(partidasPath, temporadaPath);
    const nomes = {};

    for (const [id, perfil] of Object.entries(perfis)) {
        nomes[id] = perfil.nome;
    }

    for (const [id, valor] of Object.entries(legacy || {})) {
        const numeroAtual = numero(valor);
        const perfil = perfis[id] ||= criarPerfil(id, nomes[id]);
        perfil.pontos = numeroAtual;
        perfil.nome = perfil.nome || nomes[id] || 'Desconhecido';
    }

    const resultado = {};
    for (const [id, perfil] of Object.entries(perfis)) {
        resultado[id] = {
            id: String(id),
            nome: perfil.nome || nomes[id] || 'Desconhecido',
            pontos: numero(perfil.pontos),
            vitorias: numero(perfil.vitorias),
            partidas: numero(perfil.partidas),
            kills: numero(perfil.kills),
            mortes: numero(perfil.mortes),
            continentes: numero(perfil.continentes),
            continentesDetalhes: {
                asia: numero(perfil.continentesDetalhes.asia),
                europa: numero(perfil.continentesDetalhes.europa),
                africa: numero(perfil.continentesDetalhes.africa),
                amnorte: numero(perfil.continentesDetalhes.amnorte),
                amsul: numero(perfil.continentesDetalhes.amsul),
                oceania: numero(perfil.continentesDetalhes.oceania)
            },
            terceiroLugar: numero(perfil.terceiroLugar),
            maisTropas: numero(perfil.maisTropas),
            warCoins: numero(perfil.warCoins)
        };
    }

    return resultado;
}

function sincronizarArquivo(pontuacaoPath, partidasPath, temporadaPath) {
    const atual = carregar(pontuacaoPath);
    const legacy = estaEstruturado(atual) ? paraFormatoAntigo(atual) : atual;
    const estruturado = paraFormatoEstruturado(legacy, partidasPath, temporadaPath);
    salvar(pontuacaoPath, estruturado);
    return estruturado;
}

module.exports = {
    numero,
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
