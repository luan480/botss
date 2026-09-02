/* ========================================================================
   LIGA — REPARAÇÃO DEFINITIVA DA PONTUAÇÃO

   Uso no servidor:
     node commands/liga/utils/repararPontuacao.js

   O script:
   - faz backup de pontuacao.json e partidas.json;
   - recalcula os pontos das partidas estruturadas usando respostas +
     configPontos.js, ignorando pontos antigos possivelmente corrompidos;
   - grava os pontos corrigidos dentro de partidas.json;
   - reconstrói pontuacao.json a partir do histórico corrigido;
   - ignora partidas anuladas;
   - preserva somente ajustes manuais marcados com ajusteManual.

   REGRA IMPORTANTE:
   Quando uma partida possui respostas/jogadoresBrutos, eles são a fonte
   de verdade. O campo partida.pontos NÃO é usado para decidir a pontuação.
   Ele é apenas atualizado com o resultado recalculado.
   ======================================================================== */

const fs = require('fs');
const path = require('path');
const liga = require('./pontuacaoLiga.js');
const configPontos = require('./configPontos.js');

const PONTOS = path.join(__dirname, '..', 'pontuacao.json');
const PARTIDAS = path.join(__dirname, '..', 'partidas.json');
const TEMPORADA = path.join(__dirname, '..', 'temporada.json');

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

function jogadoresDaPartida(partida) {
    if (Array.isArray(partida?.jogadoresBrutos)) return partida.jogadoresBrutos;
    if (Array.isArray(partida?.jogadores)) return partida.jogadores;
    return [];
}

function respostasDaPartida(partida) {
    return partida?.respostas || partida?.resultado || {};
}

function partidaEstruturada(partida) {
    return (
        jogadoresDaPartida(partida).length > 0 &&
        Object.keys(respostasDaPartida(partida)).length > 0
    );
}

function calcularPontosCorretos(partida) {
    const respostas = respostasDaPartida(partida);
    const jogadores = jogadoresDaPartida(partida)
        .map(idDe)
        .filter(Boolean);

    const tabela = {};
    for (const id of jogadores) tabela[id] = 0;

    const vencedor = idDe(
        respostas.vencedor || respostas.winner || respostas.ganhador
    );
    const segundo = idDe(
        respostas.segundo || respostas.segundoLugar || respostas.runnerUp
    );
    const terceiro = idDe(
        respostas.terceiro || respostas.terceiroLugar
    );
    const maisTropas = idDe(
        respostas.maisTropas || respostas.maiorTropas || respostas.tropas
    );

    if (vencedor && tabela[vencedor] !== undefined) {
        tabela[vencedor] += respostas.modo === 'objetivo'
            ? numero(configPontos.vitoria.objetivo)
            : numero(configPontos.vitoria.territorios);
    }

    if (segundo && tabela[segundo] !== undefined) {
        tabela[segundo] += numero(configPontos.segundoLugar);
    }

    if (terceiro && tabela[terceiro] !== undefined) {
        tabela[terceiro] += numero(configPontos.terceiroLugar);
    }

    if (maisTropas && tabela[maisTropas] !== undefined) {
        tabela[maisTropas] += numero(configPontos.maisTropas);
    }

    const continentes = Array.isArray(respostas.continentes)
        ? respostas.continentes
        : (Array.isArray(respostas.territorios) ? respostas.territorios : []);

    for (const continente of continentes) {
        const dono = idDe(
            continente?.dono ||
            continente?.jogador ||
            continente?.jogadorId ||
            continente?.userId
        );

        const codigo = String(
            continente?.cont || continente?.continente || ''
        ).toLowerCase().trim();

        if (!dono || tabela[dono] === undefined) continue;

        const cfg = configPontos.continentes?.[codigo];
        if (cfg) tabela[dono] += numero(cfg.pontos);
    }

    const abates = Array.isArray(respostas.abates)
        ? respostas.abates
        : [];

    const mortos = new Set();

    for (const abate of abates) {
        const matador = idDe(
            abate?.matador || abate?.killer || abate?.atacante
        );
        const vitima = idDe(
            abate?.vitima || abate?.victim || abate?.morto
        );

        if (matador && tabela[matador] !== undefined) {
            tabela[matador] += numero(configPontos.combate.kill);
        }

        if (vitima && tabela[vitima] !== undefined) {
            tabela[vitima] += numero(configPontos.combate.morte);
            mortos.add(vitima);
        }
    }

    for (const id of jogadores) {
        if (!mortos.has(id)) {
            tabela[id] += numero(configPontos.sobrevivencia);
        }
    }

    return tabela;
}

function atualizarPontosDasPartidas(partidas) {
    let estruturadas = 0;
    let corrigidas = 0;
    let legadas = 0;

    for (const [idPartida, partida] of Object.entries(partidas || {})) {
        if (!partida || typeof partida !== 'object') continue;
        if (partida.anulada || partida.anulado || partida.cancelada || partida.cancelado) continue;

        if (!partidaEstruturada(partida)) {
            legadas++;
            continue;
        }

        estruturadas++;

        const calculados = calcularPontosCorretos(partida);
        const antigos = partida.pontos && typeof partida.pontos === 'object'
            ? partida.pontos
            : {};

        const novo = {};

        for (const jogador of jogadoresDaPartida(partida)) {
            const id = idDe(jogador);
            if (!id) continue;

            const antigo = antigos[id];
            const valor = antigo && typeof antigo === 'object'
                ? { ...antigo }
                : {};

            valor.ptsLiga = numero(calculados[id]);

            // Se a partida antiga não possuía registro de WarCoins, mantém a
            // regra padrão do sistema: somente pontos positivos geram moedas.
            if (valor.wcRecebido === undefined && valor.warCoins === undefined && valor.wc === undefined) {
                valor.wcRecebido = valor.ptsLiga > 0 ? valor.ptsLiga * 100 : 0;
            }

            novo[id] = valor;
        }

        const antes = JSON.stringify(antigos);
        const depois = JSON.stringify(novo);
        if (antes !== depois) corrigidas++;

        partida.pontos = novo;
        partidas[idPartida] = partida;
    }

    return { estruturadas, corrigidas, legadas };
}

function copiar(origem, destino) {
    fs.copyFileSync(origem, destino);
}

function salvarAtomico(caminho, dados) {
    const tmp = `${caminho}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(dados, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, caminho);
}

function carregarJson(caminho) {
    const bruto = fs.readFileSync(caminho, 'utf8');
    return JSON.parse(bruto);
}

function main() {
    if (!fs.existsSync(PONTOS)) throw new Error(`Arquivo não encontrado: ${PONTOS}`);
    if (!fs.existsSync(PARTIDAS)) throw new Error(`Arquivo não encontrado: ${PARTIDAS}`);

    const backupPontos = `${PONTOS}.backup-${Date.now()}`;
    const backupPartidas = `${PARTIDAS}.backup-${Date.now()}`;

    copiar(PONTOS, backupPontos);
    copiar(PARTIDAS, backupPartidas);

    try {
        const partidas = carregarJson(PARTIDAS);
        const resumo = atualizarPontosDasPartidas(partidas);

        salvarAtomico(PARTIDAS, partidas);

        const atual = liga.carregar(PONTOS);
        const reconstruido = liga.paraFormatoEstruturado(
            atual,
            PARTIDAS,
            TEMPORADA
        );

        if (!liga.salvar(PONTOS, reconstruido)) {
            throw new Error('Não foi possível gravar a pontuação reconstruída.');
        }

        const anuladas = Object.values(partidas || {})
            .filter(p => p && (p.anulada || p.anulado || p.cancelada || p.cancelado))
            .length;

        const ranking = Object.values(reconstruido)
            .sort((a, b) => Number(b.pontos || 0) - Number(a.pontos || 0));

        const inconsistencias = ranking.filter(j => {
            const base = numero(j.pontosGanhos) - numero(j.pontosPerdidos);
            const ajuste = j.ajusteManual === true
                ? numero(j.ajusteManualValor)
                : 0;
            return numero(j.pontos) !== base + ajuste;
        });

        console.log('==============================================');
        console.log('LIGA — PONTUAÇÃO RECONSTRUÍDA');
        console.log('==============================================');
        console.log(`Jogadores: ${ranking.length}`);
        console.log(`Partidas estruturadas: ${resumo.estruturadas}`);
        console.log(`Partidas corrigidas: ${resumo.corrigidas}`);
        console.log(`Partidas legadas preservadas: ${resumo.legadas}`);
        console.log(`Partidas anuladas ignoradas: ${anuladas}`);
        console.log(`Inconsistências finais: ${inconsistencias.length}`);
        console.log('');
        console.log('TOP 20:');

        ranking.slice(0, 20).forEach((j, i) => {
            console.log(
                `${String(i + 1).padStart(2, '0')}. ${j.nome || 'Desconhecido'} — ${j.pontos} pts ` +
                `(ganhos ${j.pontosGanhos || 0} / perdas ${j.pontosPerdidos || 0})`
            );
        });

        console.log('');
        console.log(`Backup pontuacao: ${backupPontos}`);
        console.log(`Backup partidas: ${backupPartidas}`);
        console.log('Reparação concluída com sucesso.');
    } catch (erro) {
        copiar(backupPontos, PONTOS);
        copiar(backupPartidas, PARTIDAS);
        console.error('❌ Falha na reparação. Os dois backups foram restaurados.');
        throw erro;
    }
}

try {
    main();
} catch (erro) {
    console.error('[LIGA] Erro:', erro.message);
    process.exitCode = 1;
}
