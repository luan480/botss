/* ========================================================================
   ARQUIVO: deploy-commands.js (VERSÃO INTELIGENTE)
   DESCRIÇÃO: Registra comandos automaticamente sem precisar de lista negra.
   ======================================================================== */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const token = config.token;
const clientId = config.clientId;

if (!token || !clientId) {
    console.error('❌ ERRO CRÍTICO: "token" ou "clientId" não encontrados no config.json!');
    process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

// Função recursiva para ler pastas de forma inteligente
function readCommands(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            readCommands(filePath); // Entra na subpasta
        } else if (file.endsWith('.js')) {
            try {
                const command = require(filePath);
                // O pulo do gato: Só registra se for um comando de verdade (tem data e execute)
                if (command.data && command.data.toJSON && command.execute) {
                    commands.push(command.data.toJSON());
                    console.log(`[CARREGAR] ${command.data.name} ✅`);
                }
            } catch (err) {
                // Arquivos de sistema/botoes dão erro ao tentar ler como comando, e o bot ignora em silêncio
            }
        }
    }
}

console.log('📂 Lendo arquivos de comando...');
readCommands(commandsPath);

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`🚀 Iniciando atualização de ${commands.length} comandos globais.`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`✅ SUCESSO! ${data.length} comandos foram registrados.`);
        console.log('⏳ Pode levar alguns minutos para atualizar no Discord.');
        
    } catch (error) {
        console.error('❌ ERRO no deploy:', error);
    }
})();