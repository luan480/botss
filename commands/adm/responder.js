/* ========================================================================
   ARQUIVO: commands/adm/responder.js
   DESCRIÇÃO: Comando para adicionar/remover auto-respostas pelo Discord.
   ======================================================================== */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const dbPath = path.join(__dirname, 'auto_respostas.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('responder')
        .setDescription('Gerencia o sistema de auto-respostas do bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('adicionar')
                .setDescription('Ensina uma nova resposta ao bot.')
                .addStringOption(op => op.setName('gatilho').setDescription('A palavra/frase que ativa o bot').setRequired(true))
                .addStringOption(op => op.setName('resposta').setDescription('O que o bot deve responder').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('remover')
                .setDescription('Apaga uma resposta existente.')
                .addStringOption(op => op.setName('gatilho').setDescription('O gatilho para remover').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('listar')
                .setDescription('Mostra todas as respostas configuradas.')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const db = safeReadJson(dbPath);

        // --- ADICIONAR ---
        if (sub === 'adicionar') {
            const gatilho = interaction.options.getString('gatilho').toLowerCase();
            const resposta = interaction.options.getString('resposta');

            // Se já existe, transforma em array (lista) para suportar múltiplas respostas
            if (db[gatilho]) {
                if (Array.isArray(db[gatilho])) {
                    db[gatilho].push(resposta);
                } else {
                    db[gatilho] = [db[gatilho], resposta]; // Converte string antiga em lista
                }
            } else {
                db[gatilho] = [resposta]; // Cria nova lista
            }

            safeWriteJson(dbPath, db);
            
            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Resposta Adicionada!')
                .setDescription(`Sempre que alguém disser **"${gatilho}"**, eu posso responder:\n\n> ${resposta}`);
            
            await interaction.reply({ embeds: [embed] });
        }

        // --- REMOVER ---
        if (sub === 'remover') {
            const gatilho = interaction.options.getString('gatilho').toLowerCase();

            if (!db[gatilho]) {
                return interaction.reply({ content: `❌ Não encontrei nenhuma resposta para o gatilho **"${gatilho}"**.`, ephemeral: true });
            }

            delete db[gatilho];
            safeWriteJson(dbPath, db);

            await interaction.reply({ content: `🗑️ Todas as respostas para **"${gatilho}"** foram removidas.` });
        }

        // --- LISTAR ---
        if (sub === 'listar') {
            const chaves = Object.keys(db);
            if (chaves.length === 0) {
                return interaction.reply({ content: '📭 O banco de dados de respostas está vazio.', ephemeral: true });
            }

            let texto = "";
            chaves.forEach(key => {
                const resps = db[key];
                const qtd = Array.isArray(resps) ? resps.length : 1;
                texto += `• **"${key}"**: ${qtd} resposta(s)\n`;
            });

            // Se o texto for muito grande, corta (limite do Discord)
            if (texto.length > 4000) texto = texto.substring(0, 4000) + "... (lista muito longa)";

            const embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle('🧠 Cérebro do Bot (Auto-Respostas)')
                .setDescription(texto)
                .setFooter({ text: `Total de Gatilhos: ${chaves.length}` });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};