/* ========================================================================
   LIGA — REPARAÇÃO ÚNICA DA PONTUAÇÃO

   Uso no servidor:
     node commands/liga/utils/repararPontuacao.js

   O script:
   - faz backup de pontuacao.json;
   - usa partidas.json + temporada.json como fonte de verdade;
   - ignora partidas anuladas;
   - recalcula pontos e estatísticas;
   - preserva somente ajustes manuais marcados com ajusteManual.
   ======================================================================== */

const fs = require('fs');
const path = require('path');
const liga = require('./pontuacaoLiga.js');

const PONTOS = path.join(__dirname, '..', 'pontuacao.json');
const PARTIDAS = path.join(__dirname, '..', 'partidas.json');
const TEMPORADA = path.join(__dirname, '..', 'temporada.json');

function copiar(origem, destino) {
    fs.copyFileSync(origem, destino);
}

function main() {
    if (!fs.existsSync(PONTOS)) throw new Error(`Arquivo não encontrado: ${PONTOS}`);
    if (!fs.existsSync(PARTIDAS)) throw new Error(`Arquivo não encontrado: ${PARTIDAS}`);

    const backup = `${PONTOS}.backup-${Date.now()}`;
    copiar(PONTOS, backup);

    try {
        const atual = liga.carregar(PONTOS);
        const historico = liga.calcularEstatisticasTemporada(PARTIDAS, TEMPORADA);
        const reconstruido = liga.paraFormatoEstruturado(atual, PARTIDAS, TEMPORADA);

        if (!liga.salvar(PONTOS, reconstruido)) {
            throw new Error('Não foi possível gravar a pontuação reconstruída.');
        }

        const anuladas = Object.values(liga.carregar(PARTIDAS))
            .filter(p => p && (p.anulada || p.anulado || p.cancelada || p.cancelado))
            .length;

        const ranking = Object.values(reconstruido)
            .sort((a, b) => Number(b.pontos || 0) - Number(a.pontos || 0));

        console.log('==============================================');
        console.log('LIGA — PONTUAÇÃO RECONSTRUÍDA');
        console.log('==============================================');
        console.log(`Jogadores: ${Object.keys(historico).length}`);
        console.log(`Partidas anuladas ignoradas: ${anuladas}`);
        console.log('');
        console.log('TOP 20:');

        ranking.slice(0, 20).forEach((j, i) => {
            console.log(`${String(i + 1).padStart(2, '0')}. ${j.nome || 'Desconhecido'} — ${j.pontos} pts`);
        });

        console.log('');
        console.log(`Backup criado em: ${backup}`);
        console.log('Reparação concluída com sucesso.');
    } catch (erro) {
        copiar(backup, PONTOS);
        console.error('❌ Falha na reparação. O backup foi restaurado.');
        throw erro;
    }
}

try {
    main();
} catch (erro) {
    console.error('[LIGA] Erro:', erro.message);
    process.exitCode = 1;
}
