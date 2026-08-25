/* ========================================================================
   ARQUIVO: commands/liga/utils/helpers.js
   DESCRIÇÃO: Funções globais, gestão de JSONs e validação central de Staff.
   ======================================================================== */

const fs = require('fs');

const ROLE_IDS = Object.freeze({
    STAFF: '970318757748670484',
    SUPORTE: '1076553146324750366',
    MOD: '849697636574560296',
    ADM: '865915891399786518'
});

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
        if (fs.existsSync(filePath)) fs.copyFileSync(filePath, `${filePath}.bkp`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`[ERRO] Falha ao gravar dados em ${filePath}:`, e.message);
    }
};

function hasRole(member, roleId) {
    return Boolean(member?.roles?.cache?.has(roleId));
}

// Validação oficial da equipe por ID. Não depende do nome do cargo nem de Administrator.
const isStaff = (member) => {
    if (!member) return false;
    return [ROLE_IDS.STAFF, ROLE_IDS.SUPORTE, ROLE_IDS.MOD, ROLE_IDS.ADM]
        .some(roleId => hasRole(member, roleId));
};

const isMod = (member) => {
    if (!member) return false;
    return [ROLE_IDS.MOD, ROLE_IDS.ADM].some(roleId => hasRole(member, roleId));
};

const isAdm = (member) => hasRole(member, ROLE_IDS.ADM);

const buscarCanal = (guild, identificador) => {
    if (!guild || !identificador) return null;
    let canal = guild.channels.cache.get(identificador);
    if (canal) return canal;
    canal = guild.channels.cache.find(c => c.name.toLowerCase().includes(identificador.toLowerCase()));
    return canal || null;
};

const capitalize = (s) => {
    if (typeof s !== 'string' || s.length === 0) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
};

module.exports = {
    ROLE_IDS,
    safeReadJson,
    safeWriteJson,
    hasRole,
    isStaff,
    isMod,
    isAdm,
    buscarCanal,
    capitalize
};
