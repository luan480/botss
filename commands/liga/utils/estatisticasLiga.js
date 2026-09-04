/* ========================================================================
   LIGA DAS NAÇÕES — API DE ESTATÍSTICAS

   Todas as estatísticas são derivadas do histórico válido da temporada.
   pontuacaoLiga é responsável pela normalização dos perfis; a leitura de
   partidas deste módulo aceita array, {partidas: []} e objeto indexado.
   ======================================================================== */

const fs = require('fs');
const path = require('path');
const pontuacaoLiga = require('./pontuacaoLiga.js');

const pontuacaoPath = path.join(__dirname, '..', 'pontuacao.json');
const partidasPath = path.join(__dirname, '..', 'partidas.json');
const temporadaPath = path.join(__dirname, '..', 'temporada.json');

function lerJson(caminho, fallback = {}) {
    try {
        if (!fs.existsSync(caminho)) return fallback;
        const bruto = fs.readFileSync(caminho, 'utf8');
        if (!bruto.trim()) return fallback;
        const dados = JSON.parse(bruto);
        return dados && typeof dados === 'object' ? dados : fallback;
    } catch (erro) {
        console.error('[LIGA/ESTATISTICAS] Erro ao ler JSON:', caminho, erro.message);
        return fallback;
    }
}

function carregarPartidas() {
    const dados = lerJson(partidasPath, {});
    if (Array.isArray(dados)) return dados.map((partida, i) => ({ id: String(i), partida }));
    if (Array.isArray(dados.partidas)) return dados.partidas.map((partida, i) => ({ id: String(i), partida }));
    return Object.entries(dados).map(([id, partida]) => ({ id: String(id), partida }));
}

function partidaAnulada(registro) {
    const p = registro?.partida || {};
    return Boolean(p.anulada || p.anulado || p.cancelada || p.cancelado);
}

function perfisBase() {
    return pontuacaoLiga.normalizarTodos(
        pontuacaoLiga.carregar(pontuacaoPath),
        partidasPath,
        temporadaPath
    );
}

function percentual(parte, total) {
    return total > 0 ? Number(((Number(parte) / Number(total)) * 100).toFixed(2)) : 0;
}

function enriquecerPerfil(perfil) {
    const partidas = Number(perfil.partidas) || 0;
    const vitorias = Number(perfil.vitorias) || 0;
    const primeiro = Number(perfil.primeiroLugar || vitorias) || 0;
    const segundo = Number(perfil.segundoLugar) || 0;
    const terceiro = Number(perfil.terceiroLugar) || 0;
    const kills = Number(perfil.kills) || 0;
    const mortes = Number(perfil.mortes) || 0;
    const pontos = Number(perfil.pontos) || 0;
    const ganhos = Number(perfil.pontosGanhos) || 0;
    const perdidos = Number(perfil.pontosPerdidos) || 0;
    const podios = primeiro + segundo + terceiro;
    const continentes = perfil.continentesDetalhes || {};
    const dominios = Object.entries(continentes)
        .map(([chave, valor]) => [chave, Number(valor) || 0])
        .sort((a, b) => b[1] - a[1]);

    const resultado = {
        ...perfil,
        primeiroLugar: primeiro,
        segundoLugar: segundo,
        terceiroLugar: terceiro,
        podios,
        taxaPodio: percentual(podios, partidas),
        taxaPrimeiro: percentual(primeiro, partidas),
        taxaSegundo: percentual(segundo, partidas),
        taxaTerceiro: percentual(terceiro, partidas),
        melhorColocacao: primeiro > 0 ? 1 : (segundo > 0 ? 2 : (terceiro > 0 ? 3 : null)),
        piorColocacaoConhecida: terceiro > 0 ? 3 : (segundo > 0 ? 2 : (primeiro > 0 ? 1 : null)),
        kd: mortes > 0 ? Number((kills / mortes).toFixed(2)) : (kills > 0 ? kills : 0),
        saldoCombate: kills - mortes,
        mediaKills: partidas > 0 ? Number((kills / partidas).toFixed(2)) : 0,
        mediaMortes: partidas > 0 ? Number((mortes / partidas).toFixed(2)) : 0,
        mediaPontos: partidas > 0 ? Number((pontos / partidas).toFixed(2)) : 0,
        mediaPontosGanhos: partidas > 0 ? Number((ganhos / partidas).toFixed(2)) : 0,
        mediaPontosPerdidos: partidas > 0 ? Number((perdidos / partidas).toFixed(2)) : 0,
        taxaVitoria: percentual(vitorias, partidas),
        continenteFavorito: dominios[0]?.[1] > 0 ? dominios[0][0] : null,
        taxaParticipacaoPodio: percentual(podios, partidas)
    };

    return resultado;
}

function perfis() {
    return Object.fromEntries(
        Object.entries(perfisBase()).map(([id, perfil]) => [id, enriquecerPerfil(perfil)])
    );
}

function limitar(lista, limite = 10) {
    const n = Math.max(0, Number(limite) || 10);
    return lista.slice(0, n);
}

function ordenar(campo, limite = 10, filtro = () => true) {
    return limitar(
        Object.values(perfis())
            .filter(filtro)
            .sort((a, b) =>
                Number(b[campo]) - Number(a[campo]) ||
                Number(b.pontos) - Number(a.pontos) ||
                String(a.id).localeCompare(String(b.id))
            ),
        limite
    );
}

function calcularEstatisticas() { return perfis(); }
function calcularPerfil(jogadorId) { return perfis()[String(jogadorId)] || null; }
function carregarPontuacao() { return pontuacaoLiga.carregar(pontuacaoPath); }
function criarPerfil(id) { return pontuacaoLiga.criarPerfil(String(id)); }
function rankingPorPontos(limite = 10) { return ordenar('pontos', limite); }
function rankingPorVitorias(limite = 10) { return ordenar('vitorias', limite); }
function rankingPorKills(limite = 10) { return ordenar('kills', limite); }
function rankingPorMortes(limite = 10) { return ordenar('mortes', limite); }
function rankingPorContinentes(limite = 10) { return ordenar('continentes', limite); }

function rankingPorPodios(limite = 10) { return ordenar('podios', limite); }
function rankingPorSegundoLugar(limite = 10) { return ordenar('segundoLugar', limite); }
function rankingPorTerceiroLugar(limite = 10) { return ordenar('terceiroLugar', limite); }
function rankingPorKD(limite = 10, partidasMinimas = 3) {
    return ordenar('kd', limite, j => Number(j.partidas) >= Number(partidasMinimas));
}

function rankingPorEuropa(limite = 10) {
    return Object.values(perfis()).map(j => ({ ...j, europa: Number(j.continentesDetalhes?.europa) || 0 }))
        .sort((a, b) => b.europa - a.europa || b.pontos - a.pontos).slice(0, Math.max(0, Number(limite) || 10));
}
function rankingPorAsia(limite = 10) {
    return Object.values(perfis()).sort((a, b) => (Number(b.continentesDetalhes?.asia) || 0) - (Number(a.continentesDetalhes?.asia) || 0) || b.pontos - a.pontos)
        .slice(0, Math.max(0, Number(limite) || 10));
}
function rankingPorAfrica(limite = 10) {
    return Object.values(perfis()).sort((a, b) => (Number(b.continentesDetalhes?.africa) || 0) - (Number(a.continentesDetalhes?.africa) || 0) || b.pontos - a.pontos)
        .slice(0, Math.max(0, Number(limite) || 10));
}
function rankingPorAmericaDoNorte(limite = 10) {
    return Object.values(perfis()).sort((a, b) => (Number(b.continentesDetalhes?.amnorte) || 0) - (Number(a.continentesDetalhes?.amnorte) || 0) || b.pontos - a.pontos)
        .slice(0, Math.max(0, Number(limite) || 10));
}
function rankingPorAmericaDoSul(limite = 10) {
    return Object.values(perfis()).sort((a, b) => (Number(b.continentesDetalhes?.amsul) || 0) - (Number(a.continentesDetalhes?.amsul) || 0) || b.pontos - a.pontos)
        .slice(0, Math.max(0, Number(limite) || 10));
}
function rankingPorOceania(limite = 10) {
    return Object.values(perfis()).sort((a, b) => (Number(b.continentesDetalhes?.oceania) || 0) - (Number(a.continentesDetalhes?.oceania) || 0) || b.pontos - a.pontos)
        .slice(0, Math.max(0, Number(limite) || 10));
}
function rankingPorWinrate(limite = 10, partidasMinimas = 3) {
    return ordenar('winrate', limite, j => Number(j.partidas) >= Number(partidasMinimas));
}
function rankingPorWarCoins(limite = 10) { return ordenar('warCoins', limite); }

function resumoLiga() {
    const jogadores = Object.values(perfis());
    const partidasValidas = carregarPartidas().filter(r => !partidaAnulada(r));
    return {
        jogadores: jogadores.length,
        partidasRegistradas: partidasValidas.length,
        participacoes: jogadores.reduce((s, j) => s + Number(j.partidas || 0), 0),
        vitorias: jogadores.reduce((s, j) => s + Number(j.vitorias || 0), 0),
        primeiroLugar: jogadores.reduce((s, j) => s + Number(j.primeiroLugar || 0), 0),
        segundoLugar: jogadores.reduce((s, j) => s + Number(j.segundoLugar || 0), 0),
        terceiroLugar: jogadores.reduce((s, j) => s + Number(j.terceiroLugar || 0), 0),
        podios: jogadores.reduce((s, j) => s + Number(j.podios || 0), 0),
        kills: jogadores.reduce((s, j) => s + Number(j.kills || 0), 0),
        mortes: jogadores.reduce((s, j) => s + Number(j.mortes || 0), 0),
        continentes: jogadores.reduce((s, j) => s + Number(j.continentes || 0), 0),
        warCoins: jogadores.reduce((s, j) => s + Number(j.warCoins || 0), 0),
        europa: jogadores.reduce((s, j) => s + Number(j.continentesDetalhes?.europa || 0), 0),
        asia: jogadores.reduce((s, j) => s + Number(j.continentesDetalhes?.asia || 0), 0),
        africa: jogadores.reduce((s, j) => s + Number(j.continentesDetalhes?.africa || 0), 0),
        amnorte: jogadores.reduce((s, j) => s + Number(j.continentesDetalhes?.amnorte || 0), 0),
        amsul: jogadores.reduce((s, j) => s + Number(j.continentesDetalhes?.amsul || 0), 0),
        oceania: jogadores.reduce((s, j) => s + Number(j.continentesDetalhes?.oceania || 0), 0)
    };
}

module.exports = {
    carregarPartidas,
    carregarPontuacao,
    criarPerfil,
    calcularEstatisticas,
    calcularPerfil,
    rankingPorPontos,
    rankingPorVitorias,
    rankingPorKills,
    rankingPorMortes,
    rankingPorContinentes,
    rankingPorPodios,
    rankingPorSegundoLugar,
    rankingPorTerceiroLugar,
    rankingPorKD,
    rankingPorEuropa,
    rankingPorAsia,
    rankingPorAfrica,
    rankingPorAmericaDoNorte,
    rankingPorAmericaDoSul,
    rankingPorOceania,
    rankingPorWinrate,
    rankingPorWarCoins,
    resumoLiga
};
