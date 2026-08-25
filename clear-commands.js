/* ========================================================================
   SCRIPT DE LIMPEZA DE COMANDOS DA GUILD
   Uso manual: node clear-commands.js
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
        console.log(`[INFO] Limpando comandos da guilda ${guildId}...`);
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log('✅ Comandos da guilda e comandos globais antigos foram removidos.');
        console.log('ℹ️ Agora reinicie o bot para o index.js registrar os comandos atuais.');
    } catch (error) {
        console.error('❌ ERRO AO LIMPAR COMANDOS:', error);
        process.exitCode = 1;
    }
})();
