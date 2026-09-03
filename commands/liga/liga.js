const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
    PermissionsBitField
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const painel = require('./painel.js');
const pontuacaoLiga = require('./utils/pontuacaoLiga.js');
const { isStaff } = require('./utils/helpers.js');

const CANAL_RESULTADOS_LIGA = '1071976981924687912';
const TITULO_RESULTADO = /LIGA\s+DAS\s+NAÇÕES\s*[—-]\s*RESULTADO\s+REGISTRADO/i;

function idDe(valor) {
    if (valor === null || valor === undefined) return null;
    const texto = String(valor);
    const mencao = texto.match(/<@!?(\d{17,20})>/);
    return mencao ? mencao[1] : null;
}

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function criarPerfil(id, nome = 'Desconhecido') {
    return {
        id: String(id),
        nome: String(nome || 'Desconhecido'),
        pontos: 0,
        pontosGanhos: 0,
        pontosPerdidos: 0,
        vitorias: 0,
        derrotas: 0,
        partidas: 0,
        kills: 0,
        mortes: 0,
        continentes: 0,
        continentesDetalhes: {
            asia: 0,
            europa: 0,
            africa: 0,
            amnorte: 0,
            amsul: 0,
            oceania: 0
        },
        primeiroLugar: 0,
        segundoLugar: 0,
        terceiroLugar: 0,
        maisTropas: 0,
        warCoins: 0,
        winrate: 0
    };
}

function textoDosEmbeds(message) {
    const partes = [];

    if (message.content) partes.push(message.content);

    for (const embed of message.embeds || []) {
        if (embed.title) partes.push(embed.title);
        if (embed.description) partes.push(embed.description);
        if (embed.author?.name) partes.push(embed.author.name);
        if (embed.footer?.text) partes.push(embed.footer.text);

        for (const field of embed.fields || []) {
            if (field.name) partes.push(field.name);
            if (field.value) partes.push(field.value);
        }
    }

    return partes.join('\n');
}

function acharField(message, regex) {
    for (const embed of message.embeds || []) {
        for (const field of embed.fields || []) {
            if (regex.test(String(field.name || ''))) return String(field.value || '');
        }
    }
    return '';
}

function acharResultadoPorNome(message, regex) {
    const valor = acharField(message, regex);
    return idDe(valor);
}

function extratoDoResultado(message) {
    for (const embed of message.embeds || []) {
        for (const field of embed.fields || []) {
            const nome = String(field.name || '');
            if (/EXTRATO\s+FINAL/i.test(nome)) return String(field.value || '');
        }
    }
    return '';
}

function extrairPontosDoExtrato(message) {
    const extrato = extratoDoResultado(message);
    if (!extrato) return [];

    const resultados = [];
    const linhas = extrato.split(/\r?\n/).map(linha => linha.trim()).filter(Boolean);

    for (const linha of linhas) {
        const idMatch = linha.match(/<@!?(\d{17,20})>/);
        if (!idMatch) continue;

        const trecho = linha.slice(idMatch.index + idMatch[0].length);
        const ptsMatch = trecho.match(/:\s*\*{0,2}([+-]?\d+)\s*pts\*{0,2}/i)
            || linha.match(/([+-]?\d+)\s*pts/i);

        if (!ptsMatch) continue;

        const id = idMatch[1];
        const pontos = numero(ptsMatch[1]);
        const nome = linha
            .replace(idMatch[0], '')
            .replace(/^[^A-Za-zÀ-ÿ0-9_]+/, '')
            .split(':')[0]
            .replace(/[*_`]/g, '')
            .trim();

        resultados.push({ id, pontos, nome: nome || 'Desconhecido' });
    }

    return resultados;
}

function acharParticipantesDoExtrato(message) {
    return extrairPontosDoExtrato(message).map(item => item.id);
}

function ehResultadoDaLiga(message) {
    const titulos = (message.embeds || [])
        .map(embed => String(embed.title || ''))
        .join('\n');

    return TITULO_RESULTADO.test(titulos) || TITULO_RESULTADO.test(message.content || '');
}

function ehAnulada(message) {
    const texto = textoDosEmbeds(message);
    return /\b(anulad[ao]|cancelad[ao])\b/i.test(texto);
}

function obterNome(message, id, fallback) {
    const member = message.guild?.members?.cache?.get(id);
    return member?.user?.username || fallback || 'Desconhecido';
}

function aplicarResultado(perfis, message, estatisticas) {
    if (!ehResultadoDaLiga(message)) return false;
    if (ehAnulada(message)) {
        estatisticas.anuladas++;
        return false;
    }

    const pontos = extrairPontosDoExtrato(message);
    if (pontos.length === 0) {
        estatisticas.erros++;
        estatisticas.errosDetalhes.push(`Mensagem ${message.id}: EXTRATO FINAL não encontrado ou sem jogadores.`);
        return false;
    }

    const vencedor = acharResultadoPorNome(message, /vencedor/i);
    const segundo = acharResultadoPorNome(message, /2º\s*Lugar|segundo\s*Lugar|runner/i);
    const terceiro = acharResultadoPorNome(message, /3º\s*Lugar|terceiro\s*Lugar/i);
    const maisTropas = acharResultadoPorNome(message, /mais\s*Tropas|maior\s*Tropas/i);

    const idsPartida = new Set(acharParticipantesDoExtrato(message));

    for (const item of pontos) {
        const perfil = perfis[item.id] || (perfis[item.id] = criarPerfil(
            item.id,
            obterNome(message, item.id, item.nome)
        ));

        if (perfil.nome === 'Desconhecido' || !perfil.nome) {
            perfil.nome = obterNome(message, item.id, item.nome);
        }

        perfil.pontos += item.pontos;
        perfil.pontosGanhos += item.pontos;
        perfil.partidas++;
    }

    if (vencedor && perfis[vencedor]) {
        perfis[vencedor].vitorias++;
        perfis[vencedor].primeiroLugar++;
    }

    if (segundo && perfis[segundo]) perfis[segundo].segundoLugar++;
    if (terceiro && perfis[terceiro]) perfis[terceiro].terceiroLugar++;
    if (maisTropas && perfis[maisTropas]) perfis[maisTropas].maisTropas++;

    // Guarda os participantes mesmo se algum deles não apareceu no extrato.
    for (const id of idsPartida) {
        if (!perfis[id]) perfis[id] = criarPerfil(id, obterNome(message, id));
    }

    estatisticas.validas++;
    estatisticas.jogadoresIds.push(...idsPartida);
    estatisticas.mensagensValidas.push(message.id);
    return true;
}

async function buscarTodasMensagens(channel, onProgress) {
    const mensagens = [];
    let before;

    while (true) {
        const opcoes = { limit: 100 };
        if (before) opcoes.before = before;

        const lote = await channel.messages.fetch(opcoes);
        if (!lote.size) break;

        mensagens.push(...lote.values());

        const ultima = lote.last();
        before = ultima?.id;

        if (onProgress) await onProgress(mensagens.length);
        if (lote.size < 100 || !before) break;
    }

    return mensagens;
}

function preservarAjustesManuais(perfisNovos, dadosAntigos) {
    for (const [id, antigo] of Object.entries(dadosAntigos || {})) {
        if (!antigo || typeof antigo !== 'object') continue;
        if (!Object.prototype.hasOwnProperty.call(antigo, 'ajusteManualValor')) continue;

        const perfil = perfisNovos[id] || (perfisNovos[id] = criarPerfil(id, antigo.nome));
        const ajuste = numero(antigo.ajusteManualValor);

        perfil.ajusteManual = true;
        perfil.ajusteManualValor = ajuste;
        perfil.ajusteManualEm = antigo.ajusteManualEm || null;
        perfil.ajusteManualPor = antigo.ajusteManualPor || null;
        perfil.pontos += ajuste;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liga')
        .setDescription('Comandos de gerenciamento da Liga.')
        .addSubcommand(subcommand => subcommand
            .setName('painel')
            .setDescription('Cria ou atualiza o painel de controle da Liga.')
            .addChannelOption(option => option
                .setName('canal')
                .setDescription('O canal onde o painel será criado.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName('recalcular')
            .setDescription('Lê todos os resultados do canal da Liga e reconstrói a pontuação.')
        ),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({
                content: '❌ Você não possui cargo autorizado para gerenciar a Liga.',
                flags: MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'painel') {
            const canal = interaction.options.getChannel('canal');
            if (!canal) {
                return interaction.reply({
                    content: '❌ Canal da Liga não informado.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

            if (typeof painel !== 'function') {
                console.error('[LIGA] painel.js não exportou uma função válida.');
                return interaction.editReply({
                    content: '❌ O `painel.js` não está exportando uma função válida.'
                });
            }

            try {
                await painel(interaction.guild, canal.id);
                return interaction.editReply({
                    content: `✅ **Painel da Liga criado/atualizado com sucesso!**\n\n📍 Canal: ${canal}`
                });
            } catch (erro) {
                console.error('[LIGA] Erro ao criar painel:', erro);
                return interaction.editReply({
                    content: '❌ **Não foi possível criar o painel da Liga.**\nVerifique o console para o erro detalhado.'
                });
            }
        }

        if (subcommand !== 'recalcular') return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

        const pontuacaoPath = path.join(__dirname, 'pontuacao.json');

        try {
            const channel = await interaction.guild.channels.fetch(CANAL_RESULTADOS_LIGA);

            if (!channel || !channel.isTextBased() || !channel.messages?.fetch) {
                throw new Error(`O canal ${CANAL_RESULTADOS_LIGA} não é um canal de texto compatível com histórico de mensagens.`);
            }

            const perms = channel.permissionsFor(interaction.guild.members.me);
            if (perms && !perms.has(PermissionsBitField.Flags.ViewChannel)) {
                throw new Error('O bot não possui a permissão **Ver Canal** no canal de resultados da Liga.');
            }
            if (perms && !perms.has(PermissionsBitField.Flags.ReadMessageHistory)) {
                throw new Error('O bot não possui a permissão **Ler Histórico de Mensagens** no canal de resultados da Liga.');
            }

            await interaction.editReply({
                content: '🔎 **Lendo todos os prints/resultados da Liga...**\n\nIsso pode demorar se o canal tiver muitas mensagens.'
            });

            const mensagens = await buscarTodasMensagens(channel, async total => {
                if (total % 500 === 0) {
                    await interaction.editReply({
                        content: `🔎 **Lendo o histórico da Liga...**\n\n📨 Mensagens verificadas: **${total}**`
                    }).catch(() => {});
                }
            });

            const dadosAtuais = pontuacaoLiga.carregar(pontuacaoPath);
            const perfis = {};
            const estatisticas = {
                validas: 0,
                anuladas: 0,
                erros: 0,
                errosDetalhes: [],
                jogadoresIds: [],
                mensagensValidas: []
            };

            const vistos = new Set();
            let encontradas = 0;
            let duplicadas = 0;

            // As mensagens são processadas do mais antigo para o mais novo.
            mensagens.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            for (const message of mensagens) {
                if (!ehResultadoDaLiga(message)) continue;
                encontradas++;

                if (vistos.has(message.id)) {
                    duplicadas++;
                    continue;
                }
                vistos.add(message.id);

                aplicarResultado(perfis, message, estatisticas);
            }

            if (estatisticas.validas === 0) {
                throw new Error(
                    `Nenhum resultado válido foi encontrado no canal <#${CANAL_RESULTADOS_LIGA}>. ` +
                    `Foram analisadas ${mensagens.length} mensagens e ${encontradas} pareciam ser resultados da Liga.`
                );
            }

            preservarAjustesManuais(perfis, dadosAtuais);

            for (const perfil of Object.values(perfis)) {
                const partidas = numero(perfil.partidas);
                perfil.winrate = partidas > 0
                    ? Number(((numero(perfil.vitorias) / partidas) * 100).toFixed(2))
                    : 0;
            }

            // Backup local antes da substituição.
            if (fs.existsSync(pontuacaoPath)) {
                const backupPath = path.join(
                    __dirname,
                    `pontuacao.backup-${Date.now()}.json`
                );
                fs.copyFileSync(pontuacaoPath, backupPath);
            }

            if (!pontuacaoLiga.salvar(pontuacaoPath, perfis)) {
                throw new Error('Não foi possível salvar o novo pontuacao.json.');
            }

            const jogadores = Object.values(perfis);
            const totalPontos = jogadores.reduce((soma, jogador) => soma + numero(jogador.pontos), 0);
            const totalVitorias = jogadores.reduce((soma, jogador) => soma + numero(jogador.vitorias), 0);
            const totalPrimeiros = jogadores.reduce((soma, jogador) => soma + numero(jogador.primeiroLugar), 0);
            const totalSegundos = jogadores.reduce((soma, jogador) => soma + numero(jogador.segundoLugar), 0);
            const totalTerceiros = jogadores.reduce((soma, jogador) => soma + numero(jogador.terceiroLugar), 0);
            const manual = jogadores.filter(j => j.ajusteManual === true).length;

            return interaction.editReply({
                content:
                    '✅ **PONTUAÇÃO DA LIGA RECONSTRUÍDA PELOS PRINTS!**\n\n' +
                    `📺 Canal analisado: <#${CANAL_RESULTADOS_LIGA}>\n` +
                    `📨 Mensagens lidas: **${mensagens.length}**\n` +
                    `🏆 Resultados encontrados: **${encontradas}**\n` +
                    `⚔️ Resultados válidos contabilizados: **${estatisticas.validas}**\n` +
                    `🚫 Resultados anulados ignorados: **${estatisticas.anuladas}**\n` +
                    `⚠️ Resultados com erro: **${estatisticas.erros}**\n` +
                    `👥 Jogadores no ranking: **${jogadores.length}**\n` +
                    `🏆 Vitórias: **${totalVitorias}**\n` +
                    `🥇 1º lugares: **${totalPrimeiros}**\n` +
                    `🥈 2º lugares: **${totalSegundos}**\n` +
                    `🥉 3º lugares: **${totalTerceiros}**\n` +
                    `💠 Pontos recalculados: **${totalPontos}**\n` +
                    `🔒 Ajustes manuais preservados: **${manual}**\n\n` +
                    '📌 **Fonte usada:** histórico real de mensagens do canal de resultados. O `partidas.json` não é usado para decidir a pontuação desta reconstrução.' +
                    (estatisticas.errosDetalhes.length
                        ? `\n\n⚠️ Primeiro erro: ${estatisticas.errosDetalhes[0]}`
                        : '')
            });
        } catch (erro) {
            console.error('[LIGA] Erro ao reconstruir pontuacao.json pelo canal:', erro);
            return interaction.editReply({
                content: `❌ **Falha ao reconstruir a pontuação pelos prints.**\n\n${String(erro.message || erro).slice(0, 1800)}`
            }).catch(() => {});
        }
    }
};
