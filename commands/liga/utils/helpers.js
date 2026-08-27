/* ========================================================================
   ARQUIVO: commands/liga/utils/helpers.js
   DESCRIÇÃO: Funções globais, gestão segura de JSONs e validação central de Staff.
   ======================================================================== */

const fs = require('fs');
const path = require('path');
const staffPermissions = require('../../utils/staffPermissions.js');

// Mantém compatibilidade com módulos antigos que importam ROLE_IDS/helpers daqui.
const { ROLE_IDS, hasRole, isStaff, isMod, isAdm } = staffPermissions;

const PARTIDAS_PATH_PADRAO = path.join(__dirname, '..', 'partidas.json');

function resolverJsonPath(filePath) {
    if (filePath === undefined || filePath === null || filePath === '') return PARTIDAS_PATH_PADRAO;
    return filePath;
}

function parseJsonArquivo(caminho) {
    const data = fs.readFileSync(caminho, 'utf8');
    return JSON.parse(data.trim() === '' ? '{}' : data);
}

const safeReadJson = (filePath) => {
    const caminho = resolverJsonPath(filePath);
    if (!fs.existsSync(caminho)) {
        try {
            fs.mkdirSync(path.dirname(caminho), { recursive: true });
            fs.writeFileSync(caminho, '{}\n', 'utf8');
        } catch (e) {
            console.error(`[ERRO] Falha ao criar arquivo JSON em ${caminho}:`, e.message);
        }
        return {};
    }
    try {
        return parseJsonArquivo(caminho);
    } catch (e) {
        console.error(`[ERRO] Falha ao ler JSON em ${caminho}, tentando carregar o backup...`, e.message);
        const backup = `${caminho}.bkp`;
        if (fs.existsSync(backup)) {
            try { return parseJsonArquivo(backup); }
            catch (errBkp) { console.error(`[ERRO CRÍTICO] O backup de ${caminho} também está corrompido:`, errBkp.message); }
        }
        return {};
    }
};

const safeWriteJson = (filePath, data) => {
    const caminho = resolverJsonPath(filePath);
    const temporario = `${caminho}.tmp`;
    const backup = `${caminho}.bkp`;
    try {
        const conteudo = `${JSON.stringify(data, null, 2)}\n`;
        fs.mkdirSync(path.dirname(caminho), { recursive: true });
        fs.writeFileSync(temporario, conteudo, 'utf8');
        if (fs.existsSync(caminho)) fs.copyFileSync(caminho, backup);
        fs.renameSync(temporario, caminho);
        return true;
    } catch (e) {
        try { if (fs.existsSync(temporario)) fs.unlinkSync(temporario); } catch (_) {}
        console.error(`[ERRO] Falha ao gravar dados em ${caminho}:`, e.message);
        return false;
    }
};

const buscarCanal = (guild, identificador) => {
    if (!guild || !identificador) return null;
    let canal = guild.channels.cache.get(identificador);
    if (canal) return canal;
    const termo = String(identificador).toLowerCase();
    return guild.channels.cache.find(c => String(c.name || '').toLowerCase().includes(termo)) || null;
};

const capitalize = (s) => typeof s === 'string' && s.length ? s.charAt(0).toUpperCase() + s.slice(1) : '';

module.exports = {
    ROLE_IDS,
    PARTIDAS_PATH_PADRAO,
    safeReadJson,
    safeWriteJson,
    hasRole,
    isStaff,
    isMod,
    isAdm,
    buscarCanal,
    capitalize
};
