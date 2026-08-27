/* ========================================================================
   ARQUIVO: commands/adm/escala.js
   DESCRIÇÃO: Planilha Automática de Férias (Blocos de 14 dias por Oficial)
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'escala_ferias.json');

if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ dataInicio: Date.now(), ordem: [] }, null, 4));
}

function salvar(db) {
    const temporario = `${dbPath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(db, null, 4), 'utf8');
    fs.renameSync(temporario, dbPath);
}

function lerDb() {
    try {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!Array.isArray(db.ordem) || !Number.isFinite(db.dataInicio)) throw new Error('Formato inválido');
        return db;
    } catch (error) {
        throw new Error(`Arquivo escala_ferias.json inválido: ${error.message}`);
    }
}

function dataValida(dia, mes, ano) {
    if (!Number.isInteger(dia) || !Number.isInteger(mes) || !Number.isInteger(ano)) return false;
    if (ano < 2020 || ano > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
    const data = new Date(ano, mes - 1, dia);
    return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('escala')
        .setDescription('[ADM] Gerencia a escala de férias (14 dias corridos) da Staff.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('ver').setDescription('Exibe a planilha com a fila e as datas de folga de cada oficial.'))
        .addSubcommand(sub => sub.setName('adicionar').setDescription('Adiciona um oficial ao final da fila de rotação.')
            .addUserOption(opt => opt.setName('oficial').setDescription('Oficial que entrará na fila').setRequired(true)))
        .addSubcommand(sub => sub.setName('remover').setDescription('Remove um oficial da fila.')
            .addUserOption(opt => opt.setName('oficial').setDescription('Oficial a ser removido').setRequired(true)))
        .addSubcommand(sub => sub.setName('iniciar').setDescription('Define a data exata em que o PRIMEIRO da fila começa seus 14 dias.')
            .addIntegerOption(opt => opt.setName('dia').setDescription('Dia (Ex: 15)').setRequired(true))
            .addIntegerOption(opt => opt.setName('mes').setDescription('Mês (Ex: 8)').setRequired(true))
            .addIntegerOption(opt => opt.setName('ano').setDescription('Ano (Ex: 2026)').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        let db;
        try {
            db = lerDb();
        } catch (error) {
            return interaction.reply({ content: '❌ A configuração da escala está inválida. Corrija `escala_ferias.json` antes de continuar.', ephemeral: true });
        }

        if (sub === 'ver') {
            if (db.ordem.length === 0) {
                return interaction.reply({ content: '⚠️ **A fila está vazia.** Adicione os oficiais usando `/escala adicionar`.', ephemeral: true });
            }

            let planilha = '## 🏖️ ESCALA DE FÉRIAS DA STAFF (ROTAÇÃO CONTÍNUA)\n';
            planilha += '> *Cada oficial recebe 14 dias de licença. Quando um volta, o próximo sai.*\n\n';
            planilha += '| 🏅 OFICIAL | 📅 INÍCIO | 📅 RETORNO | 📌 STATUS |\n| :--- | :--- | :--- | :--- |\n';

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            db.ordem.forEach((id, index) => {
                const dataInicio = new Date(db.dataInicio);
                dataInicio.setDate(dataInicio.getDate() + (index * 14));
                const dataFim = new Date(dataInicio.getTime());
                dataFim.setDate(dataFim.getDate() + 14);
                const formatData = d => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                let status = '⏳ Aguardando';
                if (hoje >= dataInicio && hoje < dataFim) status = '🏖️ **EM LICENÇA**';
                else if (hoje >= dataFim) status = '✅ Concluído';
                planilha += `| <@${id}> | ${formatData(dataInicio)} | ${formatData(dataFim)} | ${status} |\n`;
            });

            return interaction.reply({ content: planilha });
        }

        if (sub === 'adicionar') {
            const oficial = interaction.options.getUser('oficial');
            if (db.ordem.includes(oficial.id)) return interaction.reply({ content: `❌ <@${oficial.id}> já está na fila!`, ephemeral: true });
            db.ordem.push(oficial.id);
            salvar(db);
            return interaction.reply({ content: `✅ <@${oficial.id}> foi adicionado ao **final** da fila de férias!` });
        }

        if (sub === 'remover') {
            const oficial = interaction.options.getUser('oficial');
            if (!db.ordem.includes(oficial.id)) return interaction.reply({ content: `❌ <@${oficial.id}> não está na fila.`, ephemeral: true });
            db.ordem = db.ordem.filter(id => id !== oficial.id);
            salvar(db);
            return interaction.reply({ content: `🚨 <@${oficial.id}> foi removido da escala de rotação.` });
        }

        if (sub === 'iniciar') {
            const dia = interaction.options.getInteger('dia');
            const mes = interaction.options.getInteger('mes');
            const ano = interaction.options.getInteger('ano');

            if (!dataValida(dia, mes, ano)) {
                return interaction.reply({ content: '❌ Data inválida. Informe uma data real, por exemplo **15/08/2026**.', ephemeral: true });
            }

            const novaData = new Date(ano, mes - 1, dia, 0, 0, 0);
            db.dataInicio = novaData.getTime();
            salvar(db);
            return interaction.reply({ content: `⚙️ **Relógio Sincronizado!** O 1º Oficial da fila vai iniciar as férias no dia **${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}**. O bot calculará os próximos automaticamente.` });
        }
    }
};