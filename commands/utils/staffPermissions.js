/* ========================================================================
   ARQUIVO: commands/utils/staffPermissions.js
   DESCRIÇÃO: Controle centralizado de acesso por cargo da equipe.
   ======================================================================== */

const ROLE_IDS = Object.freeze({
    STAFF: '970318757748670484',
    SUPORTE: '1076553146324750366',
    MOD: '849697636574560296',
    ADM: '865915891399786518'
});

function hasRole(member, roleId) {
    return Boolean(member?.roles?.cache?.has(roleId));
}

function isStaff(member) {
    return [
        ROLE_IDS.STAFF,
        ROLE_IDS.SUPORTE,
        ROLE_IDS.MOD,
        ROLE_IDS.ADM
    ].some(roleId => hasRole(member, roleId));
}

function isMod(member) {
    return [
        ROLE_IDS.MOD,
        ROLE_IDS.ADM
    ].some(roleId => hasRole(member, roleId));
}

function isAdm(member) {
    return hasRole(member, ROLE_IDS.ADM);
}

module.exports = {
    ROLE_IDS,
    hasRole,
    isStaff,
    isMod,
    isAdm
};
