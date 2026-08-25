/* ========================================================================
   ARQUIVO: commands/promocao/rankingHandler.js (V-BLINDADA)
   DESCRIÇÃO: Top 10 com proteção contra erros e timeouts.
   ======================================================================== */

const { EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js'); 

const progressaoPath = path.join(__dirname, 'progressao.json');
const carreirasPath = path.join(__dirname, 'carreiras.json');

// Função auxiliar para achar o ID da facção pelo nome
function buscarIdFaccao(termo, carreiras) {
    const termoLower = termo.toLowerCase();
    for (const [id, dados] of Object.entries(carreiras.faccoes)) {
        if (dados.nome.toLowerCase().includes(termoLower)) {
            return { id, nome: dados.nome, cor: dados.cor || '#FFFFFF' };
        }
    }
    return null;
}

module.exports = async (interaction, client) => {
    const id = interaction.customId;
    
    // Verifica se é um botão de ranking
    if (!id.startsWith('rank_')) return;

    try {
        // 1. AVISA O DISCORD IMEDIATAMENTE (Para evitar "A interação falhou")
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const progressao = safeReadJson(progressaoPath);
        const carreiras = safeReadJson(carreirasPath);

        // --- CONFIGURAÇÃO DO FILTRO ---
        let filtroId = null;
        let tituloRanking = "GLOBAL";
        let corRanking = "#FFD700"; 
        let emojiRanking = "🏆";

        if (id === 'rank_marinha') {
            const dados = buscarIdFaccao('marinha', carreiras);
            if (dados) { filtroId = dados.id; tituloRanking = dados.nome.toUpperCase(); corRanking = '#3498db'; emojiRanking = '⚓'; }
        } 
        else if (id === 'rank_exercito') {
            const dados = buscarIdFaccao('exército', carreiras) || buscarIdFaccao('exercito', carreiras);
            if (dados) { filtroId = dados.id; tituloRanking = dados.nome.toUpperCase(); corRanking = '#2ecc71'; emojiRanking = '🪖'; }
        }
        else if (id === 'rank_aeronautica') {
            const dados = buscarIdFaccao('aeronáutica', carreiras) || buscarIdFaccao('aeronautica', carreiras);
            if (dados) { filtroId = dados.id; tituloRanking = dados.nome.toUpperCase(); corRanking = '#95a5a6'; emojiRanking = '✈️'; }
        }
        else if (id === 'rank_mercenarios') {
            const dados = buscarIdFaccao('mercenário', carreiras) || buscarIdFaccao('mercenario', carreiras);
            if (dados) { filtroId = dados.id; tituloRanking = dados.nome.toUpperCase(); corRanking = '#e74c3c'; emojiRanking = '💰'; }
        }

        // --- PROCESSAMENTO ---
        let listaFiltrada = [];
        
        for (const [userId, data] of Object.entries(progressao)) {
            if (!data.totalWins || data.totalWins <= 0) continue;
            if (filtroId && data.factionId !== filtroId) continue;

            listaFiltrada.push({
                id: userId,
                wins: data.totalWins,
                rankId: data.currentRankId,
                factionId: data.factionId,
                memberObj: null
            });
        }

        // Ordena
        listaFiltrada.sort((a, b) => b.wins - a.wins);

        // --- FILTRO DE MEMBROS ONLINE ---
        const top10 = [];
        // Limite de segurança: Tenta achar até encontrar 10 ou analisar 50 pessoas (pra não travar)
        let analisados = 0;

        for (const player of listaFiltrada) {
            if (top10.length >= 10 || analisados > 50) break;
            analisados++;

            try {
                // Tenta buscar o membro no cache ou na API
                // force: false economiza tempo pegando do cache se possível
                const member = await interaction.guild.members.fetch({ user: player.id, force: false });
                player.memberObj = member;
                top10.push(player);
            } catch (e) { continue; }
        }

        if (top10.length === 0) {
            return interaction.editReply(`❌ Ninguém pontuou nesta categoria ainda (ou os membros saíram).`);
        }

        // --- VISUAL ---
        let descricao = "";
        const medalhas = ['🥇', '🥈', '🥉'];

        for (let i = 0; i < top10.length; i++) {
            const p = top10[i];
            const posicao = i < 3 ? medalhas[i] : `\`${i + 1}º\``;
            
            let patenteInfo = "Recruta";
            let faccaoTag = "";

            if (p.factionId && carreiras.faccoes[p.factionId]) {
                const f = carreiras.faccoes[p.factionId];
                const r = f.caminho.find(x => x.id === p.rankId);
                if (r) patenteInfo = r.nome;
                if (!filtroId) faccaoTag = ` [${f.nome.split(' ')[0]}]`; 
            }

            // Usa displayName para mostrar o nome corretamente
            descricao += `${posicao} **${p.memberObj.displayName}**${faccaoTag}\n` +
                         `╰ 🎖️ ${patenteInfo} • 🏆 **${p.wins}** Vitórias\n\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${emojiRanking} TOP 10 - ${tituloRanking}`)
            .setDescription(descricao)
            .setColor(corRanking)
            .setThumbnail(top10[0].memberObj.user.displayAvatarURL()) 
            .setFooter({ text: `Ranking atualizado • ${listaFiltrada.length} competidores`, iconURL: interaction.guild.iconURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (erroCritico) {
        console.error("ERRO NO RANKING:", erroCritico);
        // Se falhar, avisa o usuário em vez de dar "Interação Falhou"
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: `❌ Ocorreu um erro interno: ${erroCritico.message}` });
        } else {
            await interaction.reply({ content: `❌ Ocorreu um erro interno: ${erroCritico.message}`, flags: MessageFlags.Ephemeral });
        }
    }
};