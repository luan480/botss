/* ========================================================================
   ARQUIVO: commands/promocao/syncNomesProgressao.js
   DESCRIÇÃO: Atualiza o progressao.json substituindo IDs por nomes ao iniciar
   ======================================================================== */

const fs = require('fs');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const progressaoPath = path.join(__dirname, 'progressao.json');

module.exports = async (client) => {
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        let progressao = safeReadJson(progressaoPath);
        if (!progressao || Object.keys(progressao).length === 0) return;

        let alterado = false;
        const novoObjeto = {};

        for (let [key, data] of Object.entries(progressao)) {
            // Se a chave ainda for um ID numérico (ex: "730550615251615824")
            if (/^\d+$/.test(key)) {
                try {
                    // Busca o membro no servidor para pegar o username atual
                    const member = await guild.members.fetch(key).catch(() => null);
                    if (member) {
                        const nomeUsuario = member.user.username;
                        novoObjeto[nomeUsuario] = data;
                        alterado = true;
                        continue;
                    }
                } catch (e) {
                    // Se falhar ao buscar, mantém o ID original para não perder o dado
                }
            }
            // Se já for nome ou não encontrou, mantém como está
            novoObjeto[key] = data;
        }

        // Se houve alguma tradução de ID para nome, salva o JSON atualizado
        if (alterado) {
            safeWriteJson(progressaoPath, novoObjeto);
            console.log("✅ [SyncNomes] progressao.json atualizado com os nomes dos usuários!");
        }
    } catch (err) {
        console.error("❌ Erro ao sincronizar nomes no progressao.json:", err);
    }
};