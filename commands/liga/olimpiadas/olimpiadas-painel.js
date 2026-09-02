/* ========================================================================
   WORLDWARBR — OLIMPÍADAS DE DUPLAS
   ARQUIVO: commands/liga/olimpiadas/olimpiadas-painel.js

   MÓDULO DE SUPORTE DO OLIMPIADAS-HANDLER
   - Leitura segura de olimpiadas.json
   - Escrita atômica de olimpiadas.json
   - Publicação/atualização do painel através do handler principal

   IMPORTANTE:
   Este arquivo NÃO é um comando Slash. O index.js ignora módulos que não
   possuem data/execute, mas o olimpiadas-handler.js pode usá-lo normalmente.
   O require do handler em publish() é tardio para evitar dependência circular.
   ======================================================================== */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'olimpiadas.json');

function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return { seq: 0, duplas: [] };
        }

        const bruto = fs.readFileSync(DATA_FILE, 'utf8');
        if (!bruto.trim()) return { seq: 0, duplas: [] };

        const data = JSON.parse(bruto);
        if (!data || typeof data !== 'object') {
            return { seq: 0, duplas: [] };
        }

        if (!Array.isArray(data.duplas)) data.duplas = [];
        if (!Number.isFinite(Number(data.seq))) {
            data.seq = data.duplas.length;
        } else {
            data.seq = Number(data.seq);
        }

        return data;
    } catch (error) {
        console.error('[OLIMPIADAS] Erro ao ler olimpiadas.json:', error.message);
        return { seq: 0, duplas: [] };
    }
}

function writeData(data) {
    try {
        const normalizado = data && typeof data === 'object' ? data : {};
        if (!Array.isArray(normalizado.duplas)) normalizado.duplas = [];
        if (!Number.isFinite(Number(normalizado.seq))) {
            normalizado.seq = normalizado.duplas.length;
        } else {
            normalizado.seq = Number(normalizado.seq);
        }

        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

        const temporario = `${DATA_FILE}.tmp`;
        fs.writeFileSync(
            temporario,
            `${JSON.stringify(normalizado, null, 2)}\n`,
            'utf8'
        );
        fs.renameSync(temporario, DATA_FILE);

        return true;
    } catch (error) {
        console.error('[OLIMPIADAS] Erro ao salvar olimpiadas.json:', error.message);
        return false;
    }
}

async function publish(guild) {
    if (!guild) return null;

    try {
        // Require tardio: evita o ciclo
        // handler -> painel -> handler durante o carregamento do bot.
        const handler = require('./olimpiadas-handler.js');

        if (typeof handler.painel !== 'function') {
            console.error('[OLIMPIADAS] handler.painel não está disponível.');
            return null;
        }

        // O método painel() original trabalha com Interaction.
        // Aqui fornecemos somente a parte necessária para atualizar/publicar
        // o painel e absorvemos a resposta administrativa.
        const interactionCompat = {
            guild,
            reply: async () => null,
            editReply: async () => null,
            deferReply: async () => null,
            isRepliable: () => true
        };

        return await handler.painel(interactionCompat);
    } catch (error) {
        console.error('[OLIMPIADAS] Erro ao publicar painel:', error);
        return null;
    }
}

module.exports = {
    readData,
    writeData,
    publish
};
