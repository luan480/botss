/* ========================================================================
   ARQUIVO: commands/adm/escala.js
   DESCRIÇÃO: Planilha Automática de Férias (Blocos de 14 dias por Oficial)
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'escala_ferias.json');

// Cria o cofre do sistema de Férias se não existir
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ dataInicio: Date.now(), ordem: [] }, null, 4));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('escala')
        .setDescription('[ADM] Gerencia a escala de férias (14 dias corridos) da Staff.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        .addSubcommand(sub =>
            sub.setName('ver')
            .setDescription('Exibe a planilha com a fila e as datas de folga de cada oficial.')
        )
        .addSubcommand(sub =>
            sub.setName('adicionar')
            .setDescription('Adiciona um oficial ao final da fila de rotação.')
            .addUserOption(opt => opt.setName('oficial').setDescription('Oficial que entrará na fila').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('remover')
            .setDescription('Remove um oficial da fila.')
            .addUserOption(opt => opt.setName('oficial').setDescription('Oficial a ser removido').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('iniciar')
            .setDescription('Define a data exata em que o PRIMEIRO da fila começa seus 14 dias.')
            .addIntegerOption(opt => opt.setName('dia').setDescription('Dia (Ex: 15)').setRequired(true))
            .addIntegerOption(opt => opt.setName('mes').setDescription('Mês (Ex: 8)').setRequired(true))
            .addIntegerOption(opt => opt.setName('ano').setDescription('Ano (Ex: 2026)').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        // ==========================================
        // 👁️ VER A PLANILHA (Cálculo Automático)
        // ==========================================
        if (sub === 'ver') {
            if (db.ordem.length === 0) {
                return interaction.reply({ content: "⚠️ **A fila está vazia.** Adicione os oficiais usando `/escala adicionar`.", ephemeral: true });
            }

            let planilha = "## 🏖️ ESCALA DE FÉRIAS DA STAFF (ROTAÇÃO CONTÍNUA)\n";
            planilha += "> *Cada oficial recebe 14 dias de licença. Quando um volta, o próximo sai.*\n\n";
            
            // Cabeçalho da Tabela
            planilha += "| 🏅 OFICIAL | 📅 INÍCIO | 📅 RETORNO | 📌 STATUS |\n";
            planilha += "| :--- | :--- | :--- | :--- |\n";

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0); // Zera a hora para não bugar o dia atual

            db.ordem.forEach((id, index) => {
                // Matemática Tática: Adiciona 14 dias para cada posição na fila
                let dataInicio = new Date(db.dataInicio);
                dataInicio.setDate(dataInicio.getDate() + (index * 14));

                let dataFim = new Date(dataInicio.getTime());
                dataFim.setDate(dataFim.getDate() + 14);

                // Formatação BR (DD/MM/YYYY)
                let formatData = (d) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                let strInicio = formatData(dataInicio);
                let strFim = formatData(dataFim);

                // Radar de Status (O bot sabe quem está de folga hoje!)
                let status = "⏳ Aguardando";
                if (hoje >= dataInicio && hoje < dataFim) {
                    status = "🏖️ **EM LICENÇA**";
                } else if (hoje >= dataFim) {
                    status = "✅ Concluído";
                }

                planilha += `| <@${id}> | ${strInicio} | ${strFim} | ${status} |\n`;
            });

            return interaction.reply({ content: planilha });
        }

        // ==========================================
        // ➕ ADICIONAR NA FILA
        // ==========================================
        if (sub === 'adicionar') {
            const oficial = interaction.options.getUser('oficial');
            if (db.ordem.includes(oficial.id)) {
                return interaction.reply({ content: `❌ <@${oficial.id}> já está na fila!`, ephemeral: true });
            }
            db.ordem.push(oficial.id);
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
            return interaction.reply({ content: `✅ <@${oficial.id}> foi adicionado ao **final** da fila de férias!` });
        }

        // ==========================================
        // ➖ REMOVER DA FILA
        // ==========================================
        if (sub === 'remover') {
            const oficial = interaction.options.getUser('oficial');
            if (!db.ordem.includes(oficial.id)) {
                return interaction.reply({ content: `❌ <@${oficial.id}> não está na fila.`, ephemeral: true });
            }
            db.ordem = db.ordem.filter(id => id !== oficial.id);
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
            return interaction.reply({ content: `🚨 <@${oficial.id}> foi removido da escala de rotação.` });
        }

        // ==========================================
        // ⚙️ DEFINIR O PONTO DE PARTIDA (INICIAR)
        // ==========================================
        if (sub === 'iniciar') {
            const dia = interaction.options.getInteger('dia');
            const mes = interaction.options.getInteger('mes');
            const ano = interaction.options.getInteger('ano');

            // Crava a data no servidor (Meia-noite)
            const novaData = new Date(ano, mes - 1, dia, 0, 0, 0);
            db.dataInicio = novaData.getTime();
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));

            return interaction.reply({ content: `⚙️ **Relógio Sincronizado!** O 1º Oficial da fila vai iniciar as férias no dia **${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}**. O bot calculará os próximos automaticamente.` });
        }
    }
};