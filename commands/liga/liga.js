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

// Um resultado só entra no recálculo quando possui este título e um EXTRATO FINAL válido.
const TITULO_RESULTADO = /LIGA\s+DAS\s+NAÇÕES\s*[—-]\s*RESULTADO\s+REGISTRADO/i;
const CAMPO_EXTRATO = /EXTRATO\s+FINAL/i;

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
            if (regex.test(String(field.name || ''))) {
                return String(field.value || '');
            }
        }
    }
    return '';
}

function extratoDoResultado(message) {
    return acharField(message, CAMPO_EXTRATO);
}

function ehResultadoDaLiga(message) {
    const temTitulo = (message.embeds || []).some(embed =>
        TITULO_RESULTADO.test(String(embed.title || ''))
    ) || TITULO_RESULTADO.test(String(message.content || ''));

    if (!temTitulo) return false;

    // O título sozinho não basta: precisa ser o embed real de resultado com EXTRATO FINAL.
    return Boolean(extratoDoResultado(message));
}

function ehAnulada(message) {
    const texto = textoDosEmbeds(message);
    return /\b(anulad[ao]|cancelad[ao])\b/i.test(texto);
}

function obterNome(message, id, fallback) {
    const member = message.guild?.members?.cache?.get(id);
    return member?.user?.username || fallback || 'Desconhecido';
}

function limparNomeDaLinha(linha, idMatch) {
    const semMencao = linha.replace(idMatch[0], '');
    const antesDosDoisPontos = semMencao.split(':')[0];
    return antesDosDoisPontos
        .replace(/[|•🔹🔸🟢🟡🟠🔴⚪⚫]/g, ' ')
        .replace(/[*_`]/g, '')
        .trim();
}

function extrairPontosDoExtrato(message) {
    const extrato = extratoDoResultado(message);
    if (!extrato) return [];

    const resultados = [];
    const linhas = extrato
        .split(/\r?\n/)
        .map(linha => linha.trim())
        .filter(Boolean);

    for (const linha of linhas) {
        const idMatch = linha.match(/<@!?(\d{17,20})>/);
        if (!idMatch) continue;

        // Formato oficial:
        // <@ID>: +49 pts (+20 Vitória, +5 Mais tropas, +7 Ásia, ...)
        const trecho = linha.slice(idMatch.index + idMatch[0].length);
        const ptsMatch = trecho.match(/:\s*\*{0,3}([+-]?\d+)\s*pts\*{0,3}/i)
            || trecho.match(/\b([+-]?\d+)\s*pts\b/i);

        if (!ptsMatch) continue;

        const pontos = numero(ptsMatch[1]);
        const detalhamento = trecho.match(/\(([^)]*)\)/)?.[1] || '';

        resultados.push({
            id: idMatch[1],
            pontos,
            nome: limparNomeDaLinha(linha, idMatch),
            detalhamento,
            linha
        });
    }

    return resultados;
}

function possuiMotivo(texto, regex) {
    return regex.test(String(texto || ''));
}

function contarMotivo(texto, regex) {
    const match = String(texto || '').match(regex);
    if (!match) return 0;
    return numero(match[1] || 1);
}

function aplicarContinente(perfil, detalhamento, nome, regex, chave) {
    if (!possuiMotivo(detalhamento, regex)) return;
    perfil.continentes++;
    perfil.continentesDetalhes[chave]++;
}

function aplicarEstatisticasDoExtrato(perfil, item) {
    const d = item.detalhamento;

    // Colocação e vitória são lidas do próprio EXTRATO FINAL, que é a fonte oficial.
    if (possuiMotivo(d, /\bVit[oó]ria\b/i)) {
        perfil.vitorias++;
        perfil.primeiroLugar++;
    }

    if (possuiMotivo(d, /\b2º\s*Lugar\b/i)) {
        perfil.segundoLugar++;
    }

    if (possuiMotivo(d, /\b3º\s*Lugar\b/i)) {
        perfil.terceiroLugar++;
    }

    if (possuiMotivo(d, /\bMais\s+tropas\b/i)) {
        perfil.maisTropas++;
    }

    // Abate: o extrato normalmente usa +10 Abate por eliminação.
    const abates = contarMotivo(d, /[+-](\d+)\s+Abate(?:s)?\b/i);
    if (abates > 0) {
        // Se o valor for 10, 20, 30..., cada abate vale 10 pts.
        perfil.kills += abates >= 10 && abates % 10 === 0 ? abates / 10 : 1;
    }

    // Morte: o extrato usa o valor total perdido, normalmente -15 por morte.
    const morte = contarMotivo(d, /-\s*(\d+)\s+Morte(?:s)?\b/i);
    if (morte > 0) {
        perfil.mortes += morte >= 15 && morte % 15 === 0 ? morte / 15 : 1;
    }

    aplicarContinente(perfil, d, nome, /\b[ÁA]sia\b/i, 'asia');
    aplicarContinente(perfil, d, nome, /\bEuropa\b/i, 'europa');
    aplicarContinente(perfil, d, nome, /\b[ÁA]frica\b/i, 'africa');
    aplicarContinente(perfil, d, nome, /\bAm[ée]rica\s+do\s+Norte\b/i, 'amnorte');
    aplicarContinente(perfil, d, nome, /\bAm[ée]rica\s+do\s+Sul\b/i, 'amsul');
    aplicarContinente(perfil, d, nome, /\bOceania\b/i, 'oceania');
}

function aplicarResultado(perfis, message, estatisticas) {
    if (!ehResultadoDaLiga(message)) return false;

    if (ehAnulada(message)) {
        estatisticas.anuladas++;
        return false;
    }

    const itens = extrairPontosDoExtrato(message);
    if (itens.length === 0) {
        estatisticas.erros++;
        estatisticas.errosDetalhes.push(
            `Mensagem ${message.id}: EXTRATO FINAL sem jogadores no formato esperado.`
        );
        return false;
    }

    const idsPartida = new Set();

    for (const item of itens) {
        idsPartida.add(item.id);

        const perfil = perfis[item.id] || (perfis[item.id] = criarPerfil(
            item.id,
            obterNome(message, item.id, item.nome)
        ));

        if (perfil.nome === 'Desconhecido' || !perfil.nome) {
            perfil.nome = obterNome(message, item.id, item.nome);
        }

        // O número principal do EXTRATO FINAL é a única fonte de pontos.
        // Não recalculamos o total com configPontos e não usamos partidas.json.
        perfil.pontos += item.pontos;

        if (item.pontos >= 0) {
            perfil.pontosGanhos += item.pontos;
        } else {
            perfil.pontosPerdidos += Math.abs(item.pontos);
        }

        // Cada linha do EXTRATO representa uma participação naquela partida.
        perfil.partidas++;
        aplicarEstatisticasDoExtrato(perfil, item);
    }

    // Garante que jogadores presentes no extrato sempre sejam tratados como participantes.
    for (const id of idsPartida) {
        if (!perfis[id]) {
            perfis[id] = criarPerfil(id, obterNome(message, id));
        }
    }

    estatisticas.validas++;
    estatisticas.jogadoresIds.push(...idsPartida);
    estatisticas.mensagensValidas.push(message.id);
    estatisticas.pontos += itens.reduce((soma, item) => soma + item.pontos, 0);
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

        if (ajuste >= 0) {
            perfil.pontosGanhos += ajuste;
        } else {
            perfil.pontosPerdidos += Math.abs(ajuste);
        }
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
            .setDescription('Lê todos os resultados da Liga e reconstrói a pontuação pelos EXTRATOS FINAIS.')
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
                throw new Error(
                    `O canal ${CANAL_RESULTADOS_LIGA} não é um canal de texto compatível com histórico de mensagens.`
                );
            }

            const perms = channel.permissionsFor(interaction.guild.members.me);
            if (perms && !perms.has(PermissionsBitField.Flags.ViewChannel)) {
                throw new Error('O bot não possui a permissão **Ver Canal** no canal de resultados da Liga.');
            }
            if (perms && !perms.has(PermissionsBitField.Flags.ReadMessageHistory)) {
                throw new Error('O bot não possui a permissão **Ler Histórico de Mensagens** no canal de resultados da Liga.');
            }

            await interaction.editReply({
                content: '🔎 **Lendo todos os prints/resultados...**\n\nSó mensagens com o resultado oficial da **Liga das Nações** e **EXTRATO FINAL** serão contabilizadas.'
            });

            const mensagens = await buscarTodasMensagens(channel, async total => {
                if (total % 500 === 0) {
                    await interaction.editReply({
                        content: `🔎 **Lendo o histórico...**\n\n📨 Mensagens verificadas: **${total}**\n🏆 Só resultados oficiais da Liga serão contabilizados.`
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

            // Discord entrega o histórico do mais novo para o mais antigo.
            // Ordenamos para reconstruir cronologicamente.
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
                    `Foram analisadas ${mensagens.length} mensagens e ${encontradas} mensagens possuíam o título da Liga.`
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

            // Backup local antes de substituir o pontuacao.json.
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
            const totalPontosGanhos = jogadores.reduce((soma, jogador) => soma + numero(jogador.pontosGanhos), 0);
            const totalPontosPerdidos = jogadores.reduce((soma, jogador) => soma + numero(jogador.pontosPerdidos), 0);
            const totalVitorias = jogadores.reduce((soma, jogador) => soma + numero(jogador.vitorias), 0);
            const totalPrimeiros = jogadores.reduce((soma, jogador) => soma + numero(jogador.primeiroLugar), 0);
            const totalSegundos = jogadores.reduce((soma, jogador) => soma + numero(jogador.segundoLugar), 0);
            const totalTerceiros = jogadores.reduce((soma, jogador) => soma + numero(jogador.terceiroLugar), 0);
            const totalKills = jogadores.reduce((soma, jogador) => soma + numero(jogador.kills), 0);
            const totalMortes = jogadores.reduce((soma, jogador) => soma + numero(jogador.mortes), 0);
            const manual = jogadores.filter(j => j.ajusteManual === true).length;

            return interaction.editReply({
                content:
                    '✅ **PONTUAÇÃO DA LIGA RECONSTRUÍDA PELOS EXTRATOS!**\n\n' +
                    `📺 Canal analisado: <#${CANAL_RESULTADOS_LIGA}>\n` +
                    `📨 Mensagens lidas: **${mensagens.length}**\n` +
                    `🏆 Resultados oficiais encontrados: **${encontradas}**\n` +
                    `⚔️ Resultados válidos contabilizados: **${estatisticas.validas}**\n` +
                    `🚫 Resultados anulados ignorados: **${estatisticas.anuladas}**\n` +
                    `⚠️ Resultados com erro: **${estatisticas.erros}**\n` +
                    `♻️ Duplicados ignorados: **${duplicadas}**\n` +
                    `👥 Jogadores no ranking: **${jogadores.length}**\n` +
                    `🏆 Vitórias: **${totalVitorias}**\n` +
                    `🥇 1º lugares: **${totalPrimeiros}**\n` +
                    `🥈 2º lugares: **${totalSegundos}**\n` +
                    `🥉 3º lugares: **${totalTerceiros}**\n` +
                    `⚔️ Abates: **${totalKills}**\n` +
                    `💀 Mortes: **${totalMortes}**\n` +
                    `💠 Pontos líquidos: **${totalPontos}**\n` +
                    `📈 Pontos ganhos: **${totalPontosGanhos}**\n` +
                    `📉 Pontos perdidos: **${totalPontosPerdidos}**\n` +
                    `🔒 Ajustes manuais preservados: **${manual}**\n\n` +
                    '📌 **Fonte da pontuação:** somente o `EXTRATO FINAL` dos resultados oficiais da Liga.\n' +
                    '🚫 `partidas.json` não participa deste recálculo.' +
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
