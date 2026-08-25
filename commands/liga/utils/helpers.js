/* ========================================================================
   ARQUIVO: commands/liga/utils/helpers.js
   DESCRIÇÃO: Funções globais, gestão de JSONs e validação central de Staff.
   ======================================================================== */

const fs = require('fs');
const path = require('path');

const ROLE_IDS = Object.freeze({
    STAFF: '970318757748670484',
    SUPORTE: '1076553146324750366',
    MOD: '849697636574560296',
    ADM: '865915891399786518'
});

const PARTIDAS_PATH_PADRAO = path.join(
    __dirname,
    '..',
    'partidas.json'
);

function resolverJsonPath(filePath) {
    // O fluxo antigo da Liga chama safeReadJson/safeWriteJson com
    // partidasPath indefinido. Nesse caso, usamos a Caixa Preta oficial.
    if (filePath === undefined || filePath === null || filePath === '') {
        return PARTIDAS_PATH_PADRAO;
    }

    return filePath;
}

const safeReadJson = (filePath) => {
    const caminho = resolverJsonPath(filePath);

    if (!fs.existsSync(caminho)) {
        try {
            fs.writeFileSync(caminho, JSON.stringify({}, null, 2));
        } catch (e) {
            console.error(`[ERRO] Falha ao criar arquivo JSON em ${caminho}:`, e.message);
        }
        return {};
    }

    try {
        const data = fs.readFileSync(caminho, 'utf8');
        return JSON.parse(data.trim() === '' ? '{}' : data);
    } catch (e) {
        console.error(`[ERRO] Falha ao ler JSON em ${caminho}, tentando carregar o backup...`, e.message);

        if (fs.existsSync(`${caminho}.bkp`)) {
            try {
                const backupData = fs.readFileSync(`${caminho}.bkp`, 'utf8');
                return JSON.parse(backupData.trim() === '' ? '{}' : backupData);
            } catch (errBkp) {
                console.error(
                    `[ERRO CRÍTICO] O arquivo de backup de ${caminho} também está corrompido.`
                );
            }
        }

        return {};
    }
};

const safeWriteJson = (filePath, data) => {
    const caminho = resolverJsonPath(filePath);

    try {
        if (fs.existsSync(caminho)) {
            fs.copyFileSync(caminho, `${caminho}.bkp`);
        }

        fs.writeFileSync(
            caminho,
            JSON.stringify(data, null, 2)
        );
    } catch (e) {
        console.error(`[ERRO] Falha ao gravar dados em ${caminho}:`, e.message);
    }
};

function hasRole(member, roleId) {
    return Boolean(member?.roles?.cache?.has(roleId));
}

const isStaff = (member) => {
    if (!member) return false;

    return [
        ROLE_IDS.STAFF,
        ROLE_IDS.SUPORTE,
        ROLE_IDS.MOD,
        ROLE_IDS.ADM
    ].some(roleId => hasRole(member, roleId));
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

    canal = guild.channels.cache.find(c =>
        c.name.toLowerCase().includes(
            identificador.toLowerCase()
        )
    );

    return canal || null;
};

const capitalize = (s) => {
    if (typeof s !== 'string' || s.length === 0) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
};

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
