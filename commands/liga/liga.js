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
const CAMPO_EXTRATO = /EXTRATO\s+FINAL/i;

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
        continentesDetalhes: { asia: 0, europa: 0, africa: 0, amnorte: 0, amsul: 0, oceania: 0 },
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

function extratoDoResultado(message) {
    return acharField(message, CAMPO_EXTRATO);
}

function ehResultadoDaLiga(message) {
    const titulo = (message.embeds || []).some(embed =>
        TITULO_RESULTADO.test(String(embed.title || ''))
    ) || TITULO_RESULTADO.test(String(message.content || ''));
    return titulo && Boolean(extratoDoResultado(message));
}

function ehAnulada(message) {
    return /\b(anulad[ao]|cancelad[ao])\b/i.test(textoDosEmbeds(message));
}

function obterNome(message, id, fallback) {
    const member = message.guild?.members?.cache?.get(id);
    return member?.user?.username || fallback || 'Desconhecido';
}

function limparNomeDaLinha(linha, idMatch) {
    return linha
        .replace(idMatch[0], '')
        .split(':')[0]
        .replace(/[|•🔹🔸🟢🟡🟠🔴⚪⚫]/g, ' ')
        .replace(/[*_`]/g, '')
        .trim();
}

function extrairPontosDoExtrato(message) {
    const extrato = extratoDoResultado(message);
    if (!extrato) return [];

    const resultados = [];
    for (const linha of extrato.split(/\r?\n/).map(v => v.trim()).filter(Boolean)) {
        const idMatch = linha.match(/<@!?(\d{17,20})>/);
        if (!idMatch) continue;

        const trecho = linha.slice(idMatch.index + idMatch[0].length);
        const ptsMatch = trecho.match(/:\s*\*{0,3}([+-]?\d+)\s*pts\*{0,3}/i)
            || trecho.match(/\b([+-]?\d+)\s*pts\b/i);
        if (!ptsMatch) continue;

        resultados.push({
            id: idMatch[1],
            pontos: numero(ptsMatch[1]),
            nome: limparNomeDaLinha(linha, idMatch),
            detalhamento: trecho.match(/\(([^)]*)\)/)?.[1] || ''
        });
    }
    return resultados;
}

function possuiMotivo(texto, regex) {
    return regex.test(String(texto || ''));
}

function contarMotivo(texto, regex) {
    const match = String(texto || '').match(regex);
    return match ? numero(match[1] || 1) : 0;
}

function aplicarContinente(perfil, detalhamento, regex, chave) {
    if (!possuiMotivo(detalhamento, regex)) return;
    perfil.continentes++;
    perfil.continentesDetalhes[chave]++;
}

function aplicarEstatisticasDoExtrato(perfil, item) {
    const d = item.detalhamento;

    if (possuiMotivo(d, /\bVit[oó]ria\b/i)) {
        perfil.vitorias++;
        perfil.primeiroLugar++;
    }
    if (possuiMotivo(d, /\b2º\s*Lugar\b/i)) perfil.segundoLugar++;
    if (possuiMotivo(d, /\b3º\s*Lugar\b/i)) perfil.terceiroLugar++;
    if (possuiMotivo(d, /\bMais\s+tropas\b/i)) perfil.maisTropas++;

    const abates = contarMotivo(d, /[+-](\d+)\s+Abate(?:s)?\b/i);
    if (abates > 0) perfil.kills += abates >= 10 && abates % 10 === 0 ? abates / 10 : 1;

    const mortes = contarMotivo(d, /-\s*(\d+)\s+Morte(?:s)?\b/i);
    if (mortes > 0) perfil.mortes += mortes >= 15 && mortes % 15 === 0 ? mortes / 15 : 1;

    aplicarContinente(perfil, d, /\b[ÁA]sia\b/i, 'asia');
    aplicarContinente(perfil, d, /\bEuropa\b/i, 'europa');
    aplicarContinente(perfil, d, /\b[ÁA]frica\b/i, 'africa');
    aplicarContinente(perfil, d, /\bAm[ée]rica\s+do\s+Norte\b/i, 'amnorte');
    aplicarContinente(perfil, d, /\bAm[ée]rica\s+do\s+Sul\b/i, 'amsul');
    aplicarContinente(perfil, d, /\bOceania\b/i, 'oceania');
}

function aplicarResultado(perfis, message, estatisticas) {
    if (!ehResultadoDaLiga(message)) return false;

    if (ehAnulada(message)) {
        estatisticas.anuladas++;
        return false;
    }

    const itens = extrairPontosDoExtrato(message);
    if (!itens.length) {
        estatisticas.erros++;
        estatisticas.errosDetalhes.push(`Mensagem ${message.id}: EXTRATO FINAL sem jogadores no formato esperado.`);
        return false;
    }

    const idsPartida = new Set();
    for (const item of itens) {
        idsPartida.add(item.id);
        const perfil = perfis[item.id] || (perfis[item.id] = criarPerfil(
            item.id,
            obterNome(message, item.id, item.nome)
        ));

        if (!perfil.nome || perfil.nome === 'Desconhecido') {
            perfil.nome = obterNome(message, item.id, item.nome);
        }

        // O total do EXTRATO FINAL é a fonte oficial dos pontos.
        perfil.pontos += item.pontos;
        if (item.pontos >= 0) perfil.pontosGanhos += item.pontos;
        else perfil.pontosPerdidos += Math.abs(item.pontos);
        perfil.partidas++;
        aplicarEstatisticasDoExtrato(perfil, item);
    }

    estatisticas.validas++;
    estatisticas.jogadoresIds.push(...idsPartida);
    estatisticas.mensagensValidas.push(message.id);
    estatisticas.pontos += itens.reduce((soma, item) => soma + item.pontos, 0);
    return true;
}

// Busca do mais novo para o mais antigo e PARA assim que chega antes do início do mês.
async function buscarMensagensDoMes(channel, inicioMesTimestamp, onProgress) {
    const mensagens = [];
    let before;

    while (true) {
        const opcoes = { limit: 100 };
        if (before) opcoes.before = before;

        const lote = await channel.messages.fetch(opcoes);
        if (!lote.size) break;

        mensagens.push(...lote.values());
        const menorTimestamp = Math.min(...lote.map(m => m.createdTimestamp));
        before = lote.last()?.id;

        if (onProgress) await onProgress(mensagens.length);

        // Como o histórico vem do mais novo para o mais antigo, não há motivo
        // para continuar lendo milhares de mensagens históricas.
        if (menorTimestamp < inicioMesTimestamp) break;
        if (lote.size < 100 || !before) break;
    }

    return mensagens.filter(m => m.createdTimestamp >= inicioMesTimestamp);
}

function obterPeriodoAtual() {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    const inicioProximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1, 0, 0, 0, 0);
    return { agora, inicioMes, inicioProximoMes };
}

function formatarData(data) {
    return data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
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
        if (ajuste >= 0) perfil.pontosGanhos += ajuste;
        else perfil.pontosPerdidos += Math.abs(ajuste);
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
            .setDescription('Reconstrói a pontuação usando somente os resultados da Liga do mês atual.')
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
                return interaction.reply({ content: '❌ Canal da Liga não informado.', flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
            if (typeof painel !== 'function') {
                return interaction.editReply({ content: '❌ O `painel.js` não está exportando uma função válida.' });
            }

            try {
                await painel(interaction.guild, canal.id);
                return interaction.editReply({ content: `✅ **Painel da Liga criado/atualizado com sucesso!**\n\n📍 Canal: ${canal}` });
            } catch (erro) {
                console.error('[LIGA] Erro ao criar painel:', erro);
                return interaction.editReply({ content: '❌ **Não foi possível criar o painel da Liga.**\nVerifique o console para o erro detalhado.' });
            }
        }

        if (subcommand !== 'recalcular') return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
        const pontuacaoPath = path.join(__dirname, 'pontuacao.json');

        try {
            const { inicioMes, inicioProximoMes } = obterPeriodoAtual();
            const inicioTimestamp = inicioMes.getTime();
            const fimTimestamp = inicioProximoMes.getTime();

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
                content:
                    '🔎 **Recalculando a Liga...**\n\n' +
                    `📅 Período considerado: **${formatarData(inicioMes)} até ${formatarData(new Date(fimTimestamp - 1))}**\n` +
                    '🏆 Somente resultados oficiais da **Liga das Nações** com **EXTRATO FINAL** serão contabilizados.'
            });

            const mensagens = await buscarMensagensDoMes(channel, inicioTimestamp, async total => {
                if (total % 500 === 0) {
                    await interaction.editReply({
                        content:
                            '🔎 **Lendo somente o mês atual...**\n\n' +
                            `📅 Período: **${formatarData(inicioMes)} até ${formatarData(new Date(fimTimestamp - 1))}**\n` +
                            `📨 Mensagens verificadas no período: **${total}**\n` +
                            '🚫 Histórico anterior ao mês atual não entra no recálculo.'
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
                mensagensValidas: [],
                pontos: 0
            };

            const vistos = new Set();
            let encontradas = 0;
            let duplicadas = 0;

            mensagens.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            for (const message of mensagens) {
                // Proteção dupla: mesmo que o fetch retorne algo fora da janela,
                // somente mensagens dentro do mês atual podem ser contabilizadas.
                if (message.createdTimestamp < inicioTimestamp || message.createdTimestamp >= fimTimestamp) continue;
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
                    `Nenhum resultado válido da Liga foi encontrado entre ${formatarData(inicioMes)} e ${formatarData(new Date(fimTimestamp - 1))}. ` +
                    `Foram verificadas ${mensagens.length} mensagens do mês atual.`
                );
            }

            preservarAjustesManuais(perfis, dadosAtuais);

            for (const perfil of Object.values(perfis)) {
                perfil.derrotas = Math.max(0, numero(perfil.partidas) - numero(perfil.vitorias));
                const partidas = numero(perfil.partidas);
                perfil.winrate = partidas > 0
                    ? Number(((numero(perfil.vitorias) / partidas) * 100).toFixed(2))
                    : 0;
            }

            if (fs.existsSync(pontuacaoPath)) {
                fs.copyFileSync(pontuacaoPath, path.join(__dirname, `pontuacao.backup-${Date.now()}.json`));
            }

            if (!pontuacaoLiga.salvar(pontuacaoPath, perfis)) {
                throw new Error('Não foi possível salvar o novo pontuacao.json.');
            }

            const jogadores = Object.values(perfis);
            const soma = campo => jogadores.reduce((total, jogador) => total + numero(jogador[campo]), 0);
            const manual = jogadores.filter(j => j.ajusteManual === true).length;

            return interaction.editReply({
                content:
                    '✅ **PONTUAÇÃO DA LIGA RECONSTRUÍDA!**\n\n' +
                    `📅 Mês analisado: **${formatarData(inicioMes)} até ${formatarData(new Date(fimTimestamp - 1))}**\n` +
                    `📺 Canal analisado: <#${CANAL_RESULTADOS_LIGA}>\n` +
                    `📨 Mensagens verificadas no mês: **${mensagens.length}**\n` +
                    `🏆 Resultados oficiais encontrados: **${encontradas}**\n` +
                    `⚔️ Resultados válidos contabilizados: **${estatisticas.validas}**\n` +
                    `🚫 Resultados anulados ignorados: **${estatisticas.anuladas}**\n` +
                    `⚠️ Resultados com erro: **${estatisticas.erros}**\n` +
                    `♻️ Duplicados ignorados: **${duplicadas}**\n` +
                    `👥 Jogadores no ranking: **${jogadores.length}**\n` +
                    `🏆 Vitórias: **${soma('vitorias')}**\n` +
                    `🥇 1º lugares: **${soma('primeiroLugar')}**\n` +
                    `🥈 2º lugares: **${soma('segundoLugar')}**\n` +
                    `🥉 3º lugares: **${soma('terceiroLugar')}**\n` +
                    `⚔️ Abates: **${soma('kills')}**\n` +
                    `💀 Mortes: **${soma('mortes')}**\n` +
                    `💠 Pontos líquidos: **${soma('pontos')}**\n` +
                    `📈 Pontos ganhos: **${soma('pontosGanhos')}**\n` +
                    `📉 Pontos perdidos: **${soma('pontosPerdidos')}**\n` +
                    `🔒 Ajustes manuais preservados: **${manual}**\n\n` +
                    '📌 **Fonte:** somente o `EXTRATO FINAL` dos resultados oficiais da Liga.\n' +
                    '🚫 `partidas.json` não participa deste recálculo.' +
                    (estatisticas.errosDetalhes.length ? `\n\n⚠️ Primeiro erro: ${estatisticas.errosDetalhes[0]}` : '')
            });
        } catch (erro) {
            console.error('[LIGA] Erro ao reconstruir pontuacao.json:', erro);
            return interaction.editReply({
                content: `❌ **Falha ao reconstruir a pontuação pelos resultados do mês atual.**\n\n${String(erro.message || erro).slice(0, 1800)}`
            }).catch(() => {});
        }
    }
};