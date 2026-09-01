/* ========================================================================
   ARQUIVO: commands/liga/utils/configPontos.js
   DESCRIÇÃO: Central de Balanceamento e Pontuação da Liga
   ======================================================================== */

module.exports = {
    vitoria: {
        objetivo: 30,
        territorios: 20
    },
    segundoLugar: 10,
    terceiroLugar: 5,
    maisTropas: 5,
    sobrevivencia: 5,
    combate: {
        kill: 10,
        morte: -15
    },
    continentes: {
        asia: { nome: 'Ásia', pontos: 7 },
        amnorte: { nome: 'América do Norte', pontos: 5 },
        europa: { nome: 'Europa', pontos: 5 },
        africa: { nome: 'África', pontos: 3 },
        amsul: { nome: 'América do Sul', pontos: 2 },
        oceania: { nome: 'Oceania', pontos: 2 }
    }
};