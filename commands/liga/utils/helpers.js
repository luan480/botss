/* ========================================================================
   ARQUIVO: commands/liga/utils/helpers.js
   DESCRIÇÃO: Funções globais, gestão segura de JSONs e validação central de Staff.
   ======================================================================== */

const fs = require('fs');
const path = require('path');

const ROLE_IDS = Object.freeze({
    STAFF: '970318757748670484',
    SUPORTE: '1076553146324750366',
    MOD: '849697636574560296',
    ADM: '865915891399786518'
});

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

function hasRole(member, roleId) {
    return Boolean(member?.roles?.cache?.has(roleId));
}

const isStaff = (member) => !!member && [ROLE_IDS.STAFF, ROLE_IDS.SUPORTE, ROLE_IDS.MOD, ROLE_IDS.ADM].some(id => hasRole(member, id));
const isMod = (member) => !!member && [ROLE_IDS.MOD, ROLE_IDS.ADM].some(id => hasRole(member, id));
const isAdm = (member) => hasRole(member, ROLE_IDS.ADM);

const buscarCanal = (guild, identificador) => {
    if (!guild || !identificador) return null;
    let canal = guild.channels.cache.get(identificador);
    if (canal) return canal;
    const termo = String(identificador).toLowerCase();
    return guild.channels.cache.find(c => String(c.name || '').toLowerCase().includes(termo)) || null;
};

const capitalize = (s) => typeof s === 'string' && s.length ? s.charAt(0).toUpperCase() + s.slice(1) : '';

module.exports = { ROLE_IDS, PARTIDAS_PATH_PADRAO, safeReadJson, safeWriteJson, hasRole, isStaff, isMod, isAdm, buscarCanal, capitalize };
