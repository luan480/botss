/* ========================================================================
   ARQUIVO: commands/liga/utils/helpers.js (VERSÃO BLINDADA E INTELIGENTE)
   DESCRIÇÃO: Funções Globais, Gestão de JSONs e Buscas Dinâmicas
   ======================================================================== */

const fs = require('fs');
const { PermissionFlagsBits } = require('discord.js');

const safeReadJson = (filePath) => {
    if (!fs.existsSync(filePath)) {
        try {
            fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
        } catch (e) {
            console.error(`[ERRO] Falha ao criar arquivo JSON em ${filePath}:`, e.message);
        }
        return {}; 
    }
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data.trim() === '' ? '{}' : data);
    } catch (e) {
        console.error(`[ERRO] Falha ao ler JSON em ${filePath}, tentando carregar o backup...`, e.message);
        if (fs.existsSync(`${filePath}.bkp`)) {
            try {
                const backupData = fs.readFileSync(`${filePath}.bkp`, 'utf8');
                return JSON.parse(backupData.trim() === '' ? '{}' : backupData);
            } catch (errBkp) {
                console.error(`[ERRO CRÍTICO] O arquivo de backup de ${filePath} também está corrompido.`);
            }
        }
        return {};
    }
};

const safeWriteJson = (filePath, data) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.copyFileSync(filePath, `${filePath}.bkp`);
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`[ERRO] Falha ao gravar dados em ${filePath}:`, e.message);
    }
};

// 🛡️ VALIDADOR GLOBAL DE STAFF (MOD, ADM, GM)
const isStaff = (member) => {
    if (!member) return false;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

    return member.roles.cache.some(role => {
        const n = role.name.toLowerCase();
        return n.includes('mod') || 
               n.includes('adm') || 
               n.includes('gm') || 
               n.includes('moderador') || 
               n.includes('game master');
    });
};

// 🔍 BUSCA INTELIGENTE DE CANAL (Evita erros se o ID mudar ou o canal for recriado)
const buscarCanal = (guild, identificador) => {
    if (!guild || !identificador) return null;
    let canal = guild.channels.cache.get(identificador);
    if (canal) return canal;

    // Procura por nome caso o ID estático falhe
    canal = guild.channels.cache.find(c => 
        c.name.toLowerCase().includes(identificador.toLowerCase())
    );
    return canal || null;
};

const capitalize = (s) => {
    if (typeof s !== 'string' || s.length === 0) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
};

module.exports = { 
    safeReadJson, 
    safeWriteJson, 
    isStaff, 
    buscarCanal, 
    capitalize 
};