/* ========================================================================
   SCRIPT DE LIMPEZA DE COMANDOS DE SERVIDOR (GUILD)
   ======================================================================== */

const { REST, Routes } = require('discord.js');
const config = require('./config.json');

const { clientId, token, guildId } = config;

if (!clientId || !token || !guildId) {
    console.error('❌ ERRO: Falta "clientId", "token" ou "guildId" no config.json!');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`[INFO] Limpando comandos vinculados ao servidor (Guild ID: ${guildId})...`);
        
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [] },
        );

        console.log('✅ SUCESSO! Os comandos fantasmas do servidor foram apagados.');
        console.log('Reinicie o seu Discord (Ctrl + R) para sumirem da barra de digitação.');
    } catch (error) {
        console.error('❌ ERRO AO LIMPAR COMANDOS DO SERVIDOR:', error);
    }
})();