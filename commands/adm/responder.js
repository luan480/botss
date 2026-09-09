/* ========================================================================
   ARQUIVO: commands/adm/responder.js
   V9 — gerenciamento seguro das auto-respostas.
   ======================================================================== */

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'auto_respostas.json');
const auditPath = path.join(__dirname, 'auto_respostas_audit.json');
const MAX_GATILHO = 100;
const MAX_RESPOSTA = 2000;
let filaDb = Promise.resolve();

function normalizar(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function lerBanco() {
    try {
        if (!fs.existsSync(dbPath)) return {};
        const bruto = fs.readFileSync(dbPath, 'utf8');
        if (!bruto.trim()) return {};
        const dados = JSON.parse(bruto);
        if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
            throw new Error('A raiz do JSON precisa ser um objeto.');
        }
        return dados;
    } catch (erro) {
        console.error('[RESPONDER] Banco inválido:', erro.message);
        try {
            const backup = `${dbPath}.corrompido-${Date.now()}.bak`;
            if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, backup);
            console.error('[RESPONDER] Backup do arquivo inválido:', backup);
        } catch (backupError) {
            console.error('[RESPONDER] Não foi possível criar backup:', backupError.message);
        }
        throw new Error('O banco de auto-respostas está inválido. Corrija o arquivo antes de alterá-lo.');
    }
}

function salvarBancoAtomico(db) {
    const tmp = `${dbPath}.${process.pid}.${Date.now()}.tmp`;
    try {
        fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
        fs.renameSync(tmp, dbPath);
    } catch (erro) {
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
        throw new Error(`Falha ao salvar o banco: ${erro.message}`);
    }
}

function atualizarBanco(mutator) {
    const executar = filaDb.then(async () => {
        const db = lerBanco();
        const resultado = await mutator(db);
        salvarBancoAtomico(db);
        return resultado;
    });
    filaDb = executar.catch(() => {});
    return executar;
}

function lerBancoSerializado() {
    return filaDb.then(() => lerBanco());
}

function salvarArquivoAuditoria(registros) {
    const tmp = `${auditPath}.${process.pid}.${Date.now()}.tmp`;
    try {
        fs.writeFileSync(tmp, JSON.stringify(registros, null, 2), 'utf8');
        fs.renameSync(tmp, auditPath);
    } catch (erro) {
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
        throw erro;
    }
}

function registrarAuditoria(interaction, acao, dados = {}) {
    try {
        let registros = [];
        if (fs.existsSync(auditPath)) {
            const bruto = fs.readFileSync(auditPath, 'utf8');
            if (bruto.trim()) {
                const parsed = JSON.parse(bruto);
                if (Array.isArray(parsed)) registros = parsed;
            }
        }
        registros.push({
            em: new Date().toISOString(),
            guildId: interaction.guildId,
            usuarioId: interaction.user?.id || null,
            usuario: interaction.user?.tag || interaction.user?.username || null,
            acao,
            ...dados
        });
        salvarArquivoAuditoria(registros.slice(-1000));
    } catch (erro) {
        console.error('[RESPONDER] Falha no log de auditoria:', erro.message);
    }
}

function formatarLista(chaves, db) {
    return chaves.map(key => {
        const respostas = Array.isArray(db[key]) ? db[key] : [db[key]];
        return `• **\"${key}\"**: ${respostas.length} resposta(s)`;
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('responder')
        .setDescription('Gerencia o sistema de auto-resposta do bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('adicionar')
            .setDescription('Ensina uma nova resposta ao bot.')
            .addStringOption(op => op
                .setName('gatilho')
                .setDescription('A palavra/frase que ativa o bot')
                .setRequired(true)
                .setMaxLength(MAX_GATILHO))
            .addStringOption(op => op
                .setName('resposta')
                .setDescription('O que o bot deve responder')
                .setRequired(true)
                .setMaxLength(MAX_RESPOSTA)))
        .addSubcommand(sub => sub
            .setName('remover')
            .setDescription('Apaga uma resposta existente.')
            .addStringOption(op => op
                .setName('gatilho')
                .setDescription('O gatilho para remover')
                .setRequired(true)
                .setMaxLength(MAX_GATILHO))
            .addIntegerOption(op => op
                .setName('indice')
                .setDescription('Número da resposta; sem índice remove todas')
                .setRequired(false)
                .setMinValue(1)))
        .addSubcommand(sub => sub
            .setName('listar')
            .setDescription('Mostra todas as respostas configuradas.')),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: '❌ Este comando só pode ser usado dentro do servidor.',
                ephemeral: true
            });
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Apenas administradores podem gerenciar as auto-respostas.',
                ephemeral: true
            });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'adicionar') {
            const gatilho = normalizar(interaction.options.getString('gatilho'));
            const resposta = String(interaction.options.getString('resposta') || '').trim();

            if (!gatilho) {
                return interaction.reply({ content: '❌ O gatilho não pode ficar vazio.', ephemeral: true });
            }
            if (gatilho.length > MAX_GATILHO) {
                return interaction.reply({ content: `❌ O gatilho pode ter no máximo ${MAX_GATILHO} caracteres.`, ephemeral: true });
            }
            if (!resposta) {
                return interaction.reply({ content: '❌ A resposta não pode ficar vazia.', ephemeral: true });
            }
            if (resposta.length > MAX_RESPOSTA) {
                return interaction.reply({ content: `❌ A resposta pode ter no máximo ${MAX_RESPOSTA} caracteres.`, ephemeral: true });
            }

            const resultado = await atualizarBanco(db => {
                const existentes = Array.isArray(db[gatilho])
                    ? db[gatilho].filter(x => typeof x === 'string' && x.trim())
                    : db[gatilho] ? [String(db[gatilho])] : [];

                const duplicada = existentes.some(x => x.trim() === resposta);
                if (duplicada) return { duplicada: true, quantidade: existentes.length };

                db[gatilho] = [...existentes, resposta];
                return { duplicada: false, quantidade: db[gatilho].length };
            });

            if (resultado.duplicada) {
                return interaction.reply({
                    content: `⚠️ Essa resposta já existe para **\"${gatilho}\"**. Nada foi duplicado.`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Resposta adicionada')
                .setDescription(`Gatilho: **\"${gatilho}\"**\n\n> ${resposta}`)
                .setFooter({ text: `${resultado.quantidade} resposta(s) cadastrada(s)` });

            registrarAuditoria(interaction, 'adicionar', { gatilho, resposta, quantidade: resultado.quantidade });
            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'remover') {
            const gatilho = normalizar(interaction.options.getString('gatilho'));
            const indice = interaction.options.getInteger('indice');

            const resultado = await atualizarBanco(db => {
                if (!Object.prototype.hasOwnProperty.call(db, gatilho)) {
                    return { encontrado: false };
                }

                const existentes = Array.isArray(db[gatilho])
                    ? db[gatilho].filter(x => typeof x === 'string')
                    : [String(db[gatilho])];

                if (indice === null) {
                    delete db[gatilho];
                    return { encontrado: true, removeuTudo: true, quantidade: existentes.length };
                }

                if (indice > existentes.length) {
                    return { encontrado: true, invalido: true, quantidade: existentes.length };
                }

                const removida = existentes.splice(indice - 1, 1)[0];
                if (existentes.length) db[gatilho] = existentes;
                else delete db[gatilho];

                return { encontrado: true, removeuTudo: false, removida, quantidade: existentes.length };
            });

            if (!resultado.encontrado) {
                return interaction.reply({ content: `❌ Não encontrei o gatilho **\"${gatilho}\"**.`, ephemeral: true });
            }
            if (resultado.invalido) {
                return interaction.reply({ content: `❌ Esse gatilho possui ${resultado.quantidade} resposta(s).`, ephemeral: true });
            }
            if (!resultado.removeuTudo) {
                registrarAuditoria(interaction, 'remover_resposta', { gatilho, indice, resposta: resultado.removida });
                return interaction.reply({ content: `🗑️ Resposta removida de **\"${gatilho}\"**:\n> ${resultado.removida}`, ephemeral: true });
            }
            registrarAuditoria(interaction, 'remover_gatilho', { gatilho, quantidade: resultado.quantidade });
            return interaction.reply({ content: `🗑️ Todas as ${resultado.quantidade} resposta(s) de **\"${gatilho}\"** foram removidas.`, ephemeral: true });
        }

        if (sub === 'listar') {
            const db = await lerBancoSerializado();
            const chaves = Object.keys(db).sort((a, b) => a.localeCompare(b, 'pt-BR'));
            if (!chaves.length) {
                return interaction.reply({ content: '📭 O banco de dados de respostas está vazio.', ephemeral: true });
            }

            const linhas = formatarLista(chaves, db);
            const paginas = [];
            let atual = '';
            for (const linha of linhas) {
                if ((atual + linha + '\n').length > 3900) {
                    if (atual) paginas.push(atual);
                    atual = '';
                }
                atual += `${linha}\n`;
            }
            if (atual) paginas.push(atual);

            const embeds = paginas.slice(0, 10).map((texto, i) => new EmbedBuilder()
                .setColor('Blue')
                .setTitle(`🧠 Cérebro do Bot — ${i + 1}/${paginas.length}`)
                .setDescription(texto)
                .setFooter({ text: `Total de gatilhos: ${chaves.length}` }));

            await interaction.reply({ embeds: [embeds[0]], ephemeral: true });
            for (let i = 1; i < embeds.length; i++) {
                await interaction.followUp({ embeds: [embeds[i]], ephemeral: true });
            }
            if (paginas.length > 10) {
                await interaction.followUp({ content: `⚠️ Existem mais ${paginas.length - 10} página(s) de respostas.`, ephemeral: true });
            }
        }
    }
};