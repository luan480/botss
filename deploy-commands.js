/* ========================================================================
   ARQUIVO: deploy-commands.js
   DESCRIÇÃO: Registra os Slash Commands somente na guilda autorizada.
   ======================================================================== */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const token = config.token;
const clientId = config.clientId;
const guildId = config.guildId || '849696655510863914';

if (!token || !clientId || !guildId) {
    console.error('❌ ERRO CRÍTICO: "token", "clientId" ou "guildId" não encontrados no config.json!');
    process.exit(1);
}

const commands = [];
const commandNames = new Set();
const commandsPath = path.join(__dirname, 'commands');

function readCommands(dir) {
    if (!fs.existsSync(dir)) return;

    for (const file of fs.readdirSync(dir)) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            readCommands(filePath);
            continue;
        }

        if (!file.endsWith('.js')) continue;

        try {
            const command = require(filePath);

            if (!command?.data || typeof command.data.toJSON !== 'function' || typeof command.execute !== 'function') {
                continue;
            }

            const name = command.data.name;
            if (!name || commandNames.has(name)) {
                console.warn(`[IGNORADO] Comando inválido ou duplicado: ${name || file}`);
                continue;
            }

            commandNames.add(name);
            commands.push(command.data.toJSON());
            console.log(`[CARREGAR] ${name} ✅`);
        } catch (err) {
            console.error(`[ERRO] Não foi possível carregar ${filePath}:`, err.message);
        }
    }
}

console.log('📂 Lendo arquivos de comando...');
readCommands(commandsPath);

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`🚀 Sincronizando ${commands.length} comandos na guilda ${guildId}.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );

        // Remove qualquer comando global antigo para evitar duplicação/conflito.
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: [] }
        );

        console.log(`✅ SUCESSO! ${data.length} comandos registrados na guilda autorizada.`);
        console.log('✅ Comandos globais antigos removidos.');
    } catch (error) {
        console.error('❌ ERRO no deploy:', error);
        process.exitCode = 1;
    }
})();
