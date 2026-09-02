const {
    calcularEstatisticas,
    resumoLiga,
    rankingPorPontos,
    rankingPorVitorias,
    rankingPorKills,
    rankingPorContinentes,
    rankingPorWinrate
} = require('./estatisticasLiga');

// Este arquivo é um teste manual e não deve executar quando o index.js
// percorre a pasta commands e faz require() dos módulos.
if (require.main !== module) {
    module.exports = {};
} else {

    // ============================================================
    // CABEÇALHO
    // ============================================================

    console.log('');
    console.log('==============================================');
    console.log('        TESTE — ESTATÍSTICAS DA LIGA V2');
    console.log('==============================================');


    // ============================================================
    // DADOS
    // ============================================================

    const estatisticas = calcularEstatisticas();
    const resumo = resumoLiga();


    // ============================================================
    // RESUMO
    // ============================================================

    console.log('');
    console.log('📊 RESUMO');

    console.log(`👥 Jogadores: ${resumo.jogadores}`);
    console.log(`🏟️ Partidas registradas: ${resumo.partidasRegistradas}`);
    console.log(`👤 Participações: ${resumo.participacoes}`);
    console.log(`✅ Vitórias: ${resumo.vitorias}`);
    console.log(`💀 Kills: ${resumo.kills}`);
    console.log(`☠️ Mortes: ${resumo.mortes}`);
    console.log(`🌍 Continentes: ${resumo.continentes}`);
    console.log(`💰 WarCoins: ${resumo.warCoins}`);


    // ============================================================
    // FUNÇÃO PARA MOSTRAR RANKING
    // ============================================================

    function mostrarRanking(titulo, ranking, campo, unidade = '') {

        console.log('');
        console.log(titulo);

        ranking.forEach((jogador, index) => {

            console.log(
                `${index + 1}º | ` +
                `${jogador.id} | ` +
                `${jogador[campo]}${unidade}`
            );

        });
    }


    // ============================================================
    // RANKING DE PONTOS
    // ============================================================

    mostrarRanking(
        '🏆 TOP 5 — PONTOS',
        rankingPorPontos(5),
        'pontos',
        ' pts'
    );


    // ============================================================
    // RANKING DE VITÓRIAS
    // ============================================================

    mostrarRanking(
        '🥇 TOP 5 — VITÓRIAS',
        rankingPorVitorias(5),
        'vitorias'
    );


    // ============================================================
    // RANKING DE KILLS
    // ============================================================

    mostrarRanking(
        '💀 TOP 5 — KILLS',
        rankingPorKills(5),
        'kills'
    );


    // ============================================================
    // RANKING DE CONTINENTES
    // ============================================================

    mostrarRanking(
        '🌍 TOP 5 — CONTINENTES',
        rankingPorContinentes(5),
        'continentes'
    );


    // ============================================================
    // RANKING DE WINRATE
    // ============================================================

    mostrarRanking(
        '📈 TOP 5 — WINRATE',
        rankingPorWinrate(5),
        'winrate',
        '%'
    );


    // ============================================================
    // EXEMPLO DE PERFIL
    // ============================================================

    const jogadores = Object.values(estatisticas);

    if (jogadores.length > 0) {

        const jogador = jogadores
            .sort((a, b) => b.pontos - a.pontos)[0];

        console.log('');
        console.log('👤 PERFIL DO LÍDER');

        console.log(`ID: ${jogador.id}`);
        console.log(`🏆 Pontos: ${jogador.pontos}`);
        console.log(`⚔️ Partidas: ${jogador.partidas}`);
        console.log(`✅ Vitórias: ${jogador.vitorias}`);
        console.log(`❌ Derrotas: ${jogador.derrotas}`);
        console.log(`💀 Kills: ${jogador.kills}`);
        console.log(`☠️ Mortes: ${jogador.mortes}`);
        console.log(`🌍 Continentes: ${jogador.continentes}`);
        console.log(`💰 WarCoins: ${jogador.warCoins}`);
        console.log(`📈 Winrate: ${jogador.winrate}%`);
    }


    // ============================================================
    // FIM
    // ============================================================

    console.log('');
    console.log('==============================================');
    console.log('           TESTE V2 FINALIZADO');
    console.log('==============================================');
    console.log('');
}
