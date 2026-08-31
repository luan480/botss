/* ========================================================================
   ARQUIVO: commands/olimpiadas/olimpiadas-handler.js

   SISTEMA:
   - 🟨 Olimpíadas de Duplas
   - 📝 Registro de duplas
   - 🏅 Contabilização de resultados
   - 📸 Recebimento obrigatório de print anexado
   - 👥 Consulta de duplas
   - 🏆 Ranking de países, duplas e competidores
   - 📖 Guia oficial da competição

   LOCALIZAÇÃO:
   commands/olimpiadas/

   IMPORTANTE:
   Este sistema é INDEPENDENTE da Liga.

   REGRAS DE DATA:
   - Registro de duplas: qualquer dia.
   - Contabilização: somente dias pares de setembro de 2026.

   PRINT:
   - Somente arquivo de imagem anexado no Discord.
   - PNG, JPG, JPEG e WEBP.
   - Links não são aceitos.

   ======================================================================== */

const fs = require('fs');
const path = require('path');

const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require('discord.js');


// ========================================================================
// ARQUIVO DE DADOS
// ========================================================================
// Tudo que pertence às Olimpíadas é salvo neste JSON.
// Não utiliza partidas.json nem pontuacao.json da Liga.
// ========================================================================

const ARQUIVO_DADOS = path.join(
    __dirname,
    'olimpiadas.json'
);

const CONFIG = require(ARQUIVO_DADOS);


// ========================================================================
// LEITURA DOS DADOS
// ========================================================================
// Se o JSON estiver correto, retorna os dados atuais.
// Se houver algum problema, cria uma estrutura segura para evitar crash.
// ========================================================================

function carregarDados() {

    try {

        const dados = JSON.parse(
            fs.readFileSync(
                ARQUIVO_DADOS,
                'utf8'
            )
        );

        dados.duplas ??= [];
        dados.resultados ??= [];
        dados.ranking ??= {};

        return dados;

    } catch (erro) {

        console.error(
            '[OLIMPIADAS] Erro ao ler olimpiadas.json:',
            erro
        );

        return {
            ...CONFIG,
            duplas: [],
            resultados: [],
            ranking: {}
        };
    }
}


// ========================================================================
// SALVAR DADOS
// ========================================================================
// Grava o estado atual das Olimpíadas no JSON.
// ========================================================================

function salvarDados(dados) {

    fs.writeFileSync(
        ARQUIVO_DADOS,
        JSON.stringify(
            dados,
            null,
            2
        ),
        'utf8'
    );
}


// ========================================================================
// SEGURANÇA DE TEXTO
// ========================================================================
// Remove caracteres que poderiam quebrar a formatação dos embeds.
// ========================================================================

function limparTexto(valor) {

    return String(
        valor ?? ''
    ).replace(
        /[\\`*_~|]/g,
        ''
    );
}


// ========================================================================
// BUSCAR DUPLA
// ========================================================================
// Exemplo:
// buscarDupla(dados, 'dupla_123')
// ========================================================================

function buscarDupla(dados, id) {

    return dados.duplas.find(
        dupla => dupla.id === id
    );
}


// ========================================================================
// VERIFICAR PAÍS OCUPADO
// ========================================================================
// Cada país só pode pertencer a uma dupla.
// ========================================================================

function paisOcupado(dados, pais) {

    return dados.duplas.some(
        dupla =>
            dupla.pais.toLowerCase() ===
            pais.toLowerCase()
    );
}


// ========================================================================
// VERIFICAR DIA DA CONTABILIZAÇÃO
// ========================================================================
// Registro não depende desta função.
// Ela é usada SOMENTE quando alguém tenta contabilizar uma partida.
// ========================================================================

function podeContabilizar() {

    const agora = new Date();

    return (
        agora.getFullYear() === Number(CONFIG.ano) &&
        agora.getMonth() + 1 === Number(CONFIG.mes) &&
        agora.getDate() % 2 === 0
    );
}


// ========================================================================
// MONTAR RANKING
// ========================================================================
// 🥇 vitória = critério principal.
// 🥈 segundo = +3 somente no desempate.
// 🥉 terceiro = +1 somente no desempate.
// ========================================================================

function calcularRanking(dados) {

    const ranking = {};

    for (const resultado of dados.resultados) {

        const colocacoes = [
            [resultado.ouro, 'ouro'],
            [resultado.prata, 'prata'],
            [resultado.bronze, 'bronze']
        ];

        for (const [duplaId, colocacao] of colocacoes) {

            if (!ranking[duplaId]) {

                ranking[duplaId] = {
                    vitorias: 0,
                    prata: 0,
                    bronze: 0,
                    desempate: 0
                };
            }

            if (colocacao === 'ouro') {
                ranking[duplaId].vitorias++;
            }

            if (colocacao === 'prata') {
                ranking[duplaId].prata++;
                ranking[duplaId].desempate += 3;
            }

            if (colocacao === 'bronze') {
                ranking[duplaId].bronze++;
                ranking[duplaId].desempate += 1;
            }
        }
    }

    return ranking;
}


// ========================================================================
// RANKING DE PAÍSES
// ========================================================================
// Conta as medalhas conquistadas por cada país.
// ========================================================================

function rankingPaises(dados) {

    const ranking = {};

    for (const resultado of dados.resultados) {

        const colocacoes = [
            [resultado.ouro, '🥇'],
            [resultado.prata, '🥈'],
            [resultado.bronze, '🥉']
        ];

        for (const [duplaId, medalha] of colocacoes) {

            const dupla = buscarDupla(
                dados,
                duplaId
            );

            if (!dupla) continue;

            ranking[dupla.pais] ??= {
                ouro: 0,
                prata: 0,
                bronze: 0,
                total: 0
            };

            if (medalha === '🥇') ranking[dupla.pais].ouro++;
            if (medalha === '🥈') ranking[dupla.pais].prata++;
            if (medalha === '🥉') ranking[dupla.pais].bronze++;

            ranking[dupla.pais].total++;
        }
    }

    return Object.entries(ranking)
        .map(([pais, dadosPais]) => ({
            pais,
            ...dadosPais
        }))
        .sort(
            (a, b) =>
                b.ouro - a.ouro ||
                b.prata - a.prata ||
                b.bronze - a.bronze
        );
}


// ========================================================================
// RANKING DE COMPETIDORES
// ========================================================================
// Cada integrante recebe as medalhas conquistadas pela sua dupla.
// ========================================================================

function rankingCompetidores(dados) {

    const ranking = {};

    for (const resultado of dados.resultados) {

        const colocacoes = [
            [resultado.ouro, 'ouro'],
            [resultado.prata, 'prata'],
            [resultado.bronze, 'bronze']
        ];

        for (const [duplaId, colocacao] of colocacoes) {

            const dupla = buscarDupla(
                dados,
                duplaId
            );

            if (!dupla) continue;

            for (const jogadorId of [
                dupla.jogador1,
                dupla.jogador2
            ]) {

                ranking[jogadorId] ??= {
                    ouro: 0,
                    prata: 0,
                    bronze: 0,
                    total: 0
                };

                ranking[jogadorId][colocacao]++;
                ranking[jogadorId].total++;
            }
        }
    }

    return Object.entries(ranking)
        .map(([id, dadosJogador]) => ({
            id,
            ...dadosJogador
        }))
        .sort(
            (a, b) =>
                b.ouro - a.ouro ||
                b.prata - a.prata ||
                b.bronze - a.bronze
        );
}


// ========================================================================
// MENU DE PAÍSES
// ========================================================================
// Mostra apenas países disponíveis.
// País ocupado nunca aparece para outra dupla.
// Discord aceita no máximo 25 opções por select menu.
// ========================================================================

function criarMenuPais(
    dados,
    customId,
    placeholder,
    excluir = []
) {

    const ocupados = new Set(
        dados.duplas.map(
            dupla => dupla.pais.toLowerCase()
        )
    );

    const paises = (
        CONFIG.paises || []
    ).filter(pais => {

        if (ocupados.has(pais.toLowerCase())) {
            return false;
        }

        return !excluir.some(
            item =>
                item.toLowerCase() ===
                pais.toLowerCase()
        );
    });

    if (!paises.length) return null;

    return new ActionRowBuilder().addComponents(

        new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .addOptions(
                paises.slice(0, 25).map(pais => ({
                    label: pais,
                    value: pais
                }))
            )
    );
}


// ========================================================================
// PAINEL PRINCIPAL
// ========================================================================
// Monta somente o Embed do evento.
// A mensagem do comando continua privada para quem executou.
// ========================================================================

function criarPainel(dados) {

    const cargo = CONFIG.cargoTeg
        ? `<@&${CONFIG.cargoTeg}>`
        : '*Cargo não configurado.*';

    return new EmbedBuilder()

        .setColor('#D4AF37')

        .setTitle(
            '🟨 OLIMPÍADAS DE DUPLAS'
        )

        .setDescription(
            [
                `**Vencedores: ${cargo}**`,
                '',
                '**Cada dupla escolherá um País para representar.**',
                '',
                '📅 **Contabilização somente nos dias pares de setembro.**',
                '',
                '🥇 Vitória = critério principal',
                '🥈 2º = peso 3 somente no desempate',
                '🥉 3º = peso 1 somente no desempate',
                '',
                `👥 Duplas: ${dados.duplas.length}`,
                `📊 Resultados: ${dados.resultados.length}`,
                '⏱️ Partida: 1h30min',
                '',
                '⚠️ **Apenas DOIS vencedores.**'
            ].join('\n')
        )

        .setImage(CONFIG.imagem)

        .setFooter({
            text: 'WorldWarBR • Olimpíadas de Duplas'
        })

        .setTimestamp();
}


// ========================================================================
// BOTÕES DO PAINEL
// ========================================================================
// Cada botão chama uma etapa específica do sistema.
// ========================================================================

function criarBotoes() {

    return new ActionRowBuilder().addComponents(

        new ButtonBuilder()
            .setCustomId('olymp_contabilizar')
            .setLabel('Contabilizar')
            .setEmoji('🏅')
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId('olymp_duplas')
            .setLabel('Ver duplas')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId('olymp_registrar')
            .setLabel('Registrar dupla')
            .setEmoji('📝')
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId('olymp_ranking')
            .setLabel('Ranking')
            .setEmoji('🏆')
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId('olymp_guia')
            .setLabel('Guia')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Secondary)
    );
}


// ========================================================================
// PUBLICAR PAINEL
// ========================================================================
// Publica o painel no canal configurado.
// A confirmação do comando é EPHEMERAL e não polui o canal.
// ========================================================================

async function painel(interaction) {

    const canal = await interaction.client.channels
        .fetch(CONFIG.canalPainel)
        .catch(() => null);

    if (!canal?.isTextBased()) {

        return interaction.reply({
            content: '❌ Canal do painel das Olimpíadas não encontrado.',
            flags: MessageFlags.Ephemeral
        });
    }

    await canal.send({
        embeds: [criarPainel(carregarDados())],
        components: [criarBotoes()]
    });

    return interaction.reply({
        content: `✅ Painel publicado em <#${CONFIG.canalPainel}>.`,
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// REGISTRAR — ETAPA 1
// ========================================================================
// Registro é permitido em qualquer dia.
// Primeiro escolhemos o integrante 1.
// ========================================================================

async function registrar(interaction) {

    return interaction.reply({
        content: '📝 **REGISTRO DE DUPLA**\n\nSelecione o primeiro integrante.',
        components: [
            new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId('olymp_reg_p1')
                    .setPlaceholder('Selecione o jogador 1')
            )
        ],
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// REGISTRAR — ETAPA 2
// ========================================================================
// Depois escolhemos o integrante 2.
// Não permite que a mesma pessoa forme dupla consigo mesma.
// ========================================================================

async function registrarJogador1(interaction) {

    const jogador1 = interaction.values[0];

    return interaction.update({
        content: '📝 **JOGADOR 2**\n\nSelecione o segundo integrante.',
        components: [
            new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId(`olymp_reg_p2_${jogador1}`)
                    .setPlaceholder('Selecione o jogador 2')
            )
        ]
    });
}


// ========================================================================
// REGISTRAR — ETAPA 3
// ========================================================================
// Verifica jogadores e mostra somente países livres.
// ========================================================================

async function registrarJogador2(interaction) {

    const jogador1 = interaction.customId.replace(
        'olymp_reg_p2_',
        ''
    );

    const jogador2 = interaction.values[0];
    const dados = carregarDados();

    if (jogador1 === jogador2) {

        return interaction.reply({
            content: '❌ Os dois integrantes precisam ser pessoas diferentes.',
            flags: MessageFlags.Ephemeral
        });
    }

    const duplaExistente = dados.duplas.find(
        dupla =>
            [dupla.jogador1, dupla.jogador2]
                .includes(jogador1) ||
            [dupla.jogador1, dupla.jogador2]
                .includes(jogador2)
    );

    if (duplaExistente) {

        return interaction.reply({
            content: `❌ Um dos jogadores já pertence à dupla **${limparTexto(duplaExistente.nome)}**.`,
            flags: MessageFlags.Ephemeral
        });
    }

    const menu = criarMenuPais(
        dados,
        `olymp_reg_pais_${jogador1}_${jogador2}`,
        'Escolha o país que a dupla representará'
    );

    if (!menu) {

        return interaction.reply({
            content: '❌ Todos os países disponíveis já foram escolhidos.',
            flags: MessageFlags.Ephemeral
        });
    }

    return interaction.update({
        content: '🌎 **PAÍS DA DUPLA**\n\nPaíses ocupados não aparecem no menu.',
        components: [menu]
    });
}


// ========================================================================
// REGISTRAR — ETAPA 4
// ========================================================================
// Depois de escolher o país, pedimos o nome da dupla.
// ========================================================================

async function registrarPais(interaction) {

    const partes = interaction.customId.split('_');

    const jogador1 = partes[3];
    const jogador2 = partes[4];
    const pais = interaction.values[0];

    const modal = new ModalBuilder()
        .setCustomId(
            `olymp_reg_nome_${jogador1}_${jogador2}_${encodeURIComponent(pais)}`
        )
        .setTitle('Nome da dupla');

    const nome = new TextInputBuilder()
        .setCustomId('nome')
        .setLabel('Nome da dupla')
        .setPlaceholder('Ex.: Os Imperadores')
        .setStyle(TextInputStyle.Short)
        .setMinLength(2)
        .setMaxLength(40)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(nome)
    );

    return interaction.showModal(modal);
}


// ========================================================================
// REGISTRAR — FINAL
// ========================================================================
// Salva a dupla e publica a inscrição na TEG.
// ========================================================================

async function finalizarRegistro(interaction) {

    const partes = interaction.customId.split('_');

    const jogador1 = partes[3];
    const jogador2 = partes[4];
    const pais = decodeURIComponent(
        partes.slice(5).join('_')
    );

    const nome = interaction.fields
        .getTextInputValue('nome')
        .trim();

    const dados = carregarDados();

    if (paisOcupado(dados, pais)) {

        return interaction.reply({
            content: '❌ Esse país já foi escolhido por outra dupla.',
            flags: MessageFlags.Ephemeral
        });
    }

    const jogadorOcupado = dados.duplas.find(
        dupla =>
            [dupla.jogador1, dupla.jogador2]
                .includes(jogador1) ||
            [dupla.jogador1, dupla.jogador2]
                .includes(jogador2)
    );

    if (jogadorOcupado) {

        return interaction.reply({
            content: '❌ Um dos jogadores já está registrado em outra dupla.',
            flags: MessageFlags.Ephemeral
        });
    }

    const dupla = {
        id: `dupla_${Date.now()}_${jogador1}`,
        nome,
        pais,
        jogador1,
        jogador2,
        criadoPor: interaction.user.id,
        criadoEm: new Date().toISOString(),
        ativa: true
    };

    dados.duplas.push(dupla);
    dados.ranking = calcularRanking(dados);

    salvarDados(dados);

    const canalTeg = await interaction.client.channels
        .fetch(CONFIG.canalTeg)
        .catch(() => null);

    if (canalTeg?.isTextBased()) {

        await canalTeg.send({

            content: CONFIG.cargoTeg
                ? `<@&${CONFIG.cargoTeg}>`
                : undefined,

            embeds: [
                new EmbedBuilder()
                    .setColor('#D4AF37')
                    .setTitle('📝 NOVA DUPLA REGISTRADA')
                    .setDescription(
                        [
                            `**${limparTexto(nome)}**`,
                            '',
                            `🌎 **País:** ${limparTexto(pais)}`,
                            `👥 **Dupla:** <@${jogador1}> + <@${jogador2}>`
                        ].join('\n')
                    )
                    .setTimestamp()
            ]
        });
    }

    return interaction.reply({
        content: `✅ Dupla **${limparTexto(nome)}** registrada!\n🌎 País: **${limparTexto(pais)}**`,
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// CONTABILIZAR — INÍCIO
// ========================================================================
// Aqui está a regra de data:
// SOMENTE dias pares de setembro de 2026.
// O registro continua liberado normalmente.
// ========================================================================

async function contabilizar(interaction) {

    if (!podeContabilizar()) {

        return interaction.reply({
            content:
                '🚫 **A contabilização só pode ser feita nos dias pares de setembro de 2026.**\n\n📝 O registro de duplas continua disponível normalmente.',
            flags: MessageFlags.Ephemeral
        });
    }

    const dados = carregarDados();

    if (dados.duplas.length < 3) {

        return interaction.reply({
            content: '❌ É necessário ter pelo menos 3 duplas registradas.',
            flags: MessageFlags.Ephemeral
        });
    }

    const menu = criarMenuPais(
        dados,
        'olymp_result_ouro',
        '🥇 Selecione o país vencedor'
    );

    return interaction.reply({
        content:
            '🏅 **CONTABILIZAÇÃO DE PARTIDA**\n\n' +
            'Escolha os países em ordem: 🥇 vencedor, 🥈 segundo e 🥉 terceiro.\n\n' +
            '📸 **No final será obrigatório ANEXAR o print da vitória.**\n' +
            '🚫 Links não são aceitos.',
        components: [menu],
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// CONTABILIZAR — OURO
// ========================================================================

async function escolherOuro(interaction) {

    const ouro = interaction.values[0];
    const dados = carregarDados();

    const menu = criarMenuPais(
        dados,
        `olymp_result_prata_${encodeURIComponent(ouro)}`,
        '🥈 Selecione o país em 2º lugar',
        [ouro]
    );

    return interaction.update({
        content:
            `🥇 **${limparTexto(ouro)}**\n\nSelecione agora o 🥈 segundo lugar.`,
        components: [menu]
    });
}


// ========================================================================
// CONTABILIZAR — PRATA
// ========================================================================

async function escolherPrata(interaction) {

    const partes = interaction.customId
        .replace('olymp_result_prata_', '')
        .split('_');

    const ouro = decodeURIComponent(
        partes.join('_')
    );

    const prata = interaction.values[0];
    const dados = carregarDados();

    const menu = criarMenuPais(
        dados,
        `olymp_result_bronze_${encodeURIComponent(ouro)}_${encodeURIComponent(prata)}`,
        '🥉 Selecione o país em 3º lugar',
        [ouro, prata]
    );

    return interaction.update({
        content:
            `🥇 **${limparTexto(ouro)}**\n` +
            `🥈 **${limparTexto(prata)}**\n\n` +
            'Selecione agora o 🥉 terceiro lugar.',
        components: [menu]
    });
}


// ========================================================================
// CONTABILIZAR — BRONZE + PEDIDO DO PRINT
// ========================================================================
// Discord não permite anexar arquivo dentro de Modal.
// Por isso, depois de escolher o bronze, o bot pede uma mensagem com anexo.
// O coletor aceita somente imagens.
// ========================================================================

async function escolherBronze(interaction) {

    if (!podeContabilizar()) {

        return interaction.reply({
            content: '🚫 A contabilização só pode ser feita nos dias pares de setembro de 2026.',
            flags: MessageFlags.Ephemeral
        });
    }

    const partes = interaction.customId
        .replace('olymp_result_bronze_', '')
        .split('_');

    const ouro = decodeURIComponent(partes[0]);
    const prata = decodeURIComponent(partes[1]);
    const bronze = interaction.values[0];

    await interaction.reply({
        content:
            '📸 **ANEXE AGORA O PRINT DA VITÓRIA**\n\n' +
            `🥇 ${limparTexto(ouro)}\n` +
            `🥈 ${limparTexto(prata)}\n` +
            `🥉 ${limparTexto(bronze)}\n\n` +
            '⚠️ **Somente PNG, JPG, JPEG ou WEBP.**\n' +
            '🚫 Links não são aceitos.\n' +
            '⏳ Você tem 2 minutos.',
        flags: MessageFlags.Ephemeral
    });

    const coletor = interaction.channel.createMessageCollector({

        filter: mensagem =>
            mensagem.author.id === interaction.user.id &&
            mensagem.attachments.size > 0,

        time: 120000
    });

    coletor.on('collect', async mensagem => {

        const anexo = mensagem.attachments.find(
            arquivo =>
                (arquivo.contentType || '')
                    .toLowerCase()
                    .startsWith('image/') ||
                /\.(png|jpe?g|webp)$/i.test(
                    arquivo.name || ''
                )
        );

        if (!anexo) {

            await mensagem.reply(
                '❌ Esse arquivo não é uma imagem válida. Envie PNG, JPG, JPEG ou WEBP.'
            ).catch(() => {});

            return;
        }

        coletor.stop('imagem_recebida');

        await finalizarContabilizacao(
            interaction,
            ouro,
            prata,
            bronze,
            anexo
        );
    });

    coletor.on('end', (_, motivo) => {

        if (motivo === 'time') {

            interaction.followUp({
                content: '⌛ Tempo esgotado. A contabilização foi cancelada.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    });
}


// ========================================================================
// FINALIZAR CONTABILIZAÇÃO
// ========================================================================
// Salva o resultado e publica o print junto do resultado oficial.
// ========================================================================

async function finalizarContabilizacao(
    interaction,
    ouro,
    prata,
    bronze,
    anexo
) {

    const dados = carregarDados();

    const duplaOuro = dados.duplas.find(
        dupla => dupla.pais === ouro
    );

    const duplaPrata = dados.duplas.find(
        dupla => dupla.pais === prata
    );

    const duplaBronze = dados.duplas.find(
        dupla => dupla.pais === bronze
    );

    if (!duplaOuro || !duplaPrata || !duplaBronze) {

        return interaction.followUp({
            content: '❌ Não foi possível encontrar uma das duplas selecionadas.',
            flags: MessageFlags.Ephemeral
        });
    }

    const resultado = {
        id: `resultado_${Date.now()}`,
        data: new Date().toISOString(),
        ouro: duplaOuro.id,
        prata: duplaPrata.id,
        bronze: duplaBronze.id,
        print: anexo.url,
        printNome: anexo.name,
        printTipo: anexo.contentType,
        registradoPor: interaction.user.id
    };

    dados.resultados.push(resultado);
    dados.ranking = calcularRanking(dados);

    salvarDados(dados);

    const canal = await interaction.client.channels
        .fetch(CONFIG.canalResultados)
        .catch(() => null);

    if (canal?.isTextBased()) {

        await canal.send({

            embeds: [
                new EmbedBuilder()
                    .setColor('#D4AF37')
                    .setTitle('🏅 RESULTADO — OLIMPÍADAS DE DUPLAS')
                    .setDescription(
                        [
                            `🥇 **${limparTexto(duplaOuro.pais)}** — ${limparTexto(duplaOuro.nome)}`,
                            `🥈 **${limparTexto(duplaPrata.pais)}** — ${limparTexto(duplaPrata.nome)}`,
                            `🥉 **${limparTexto(duplaBronze.pais)}** — ${limparTexto(duplaBronze.nome)}`,
                            '',
                            '🥇 Vitória = critério principal',
                            '🥈 Prata = peso 3 no desempate',
                            '🥉 Bronze = peso 1 no desempate'
                        ].join('\n')
                    )
                    .setImage(anexo.url)
                    .setFooter({
                        text: `Registrado por ${interaction.user.tag}`
                    })
                    .setTimestamp()
            ]
        });
    }

    return interaction.followUp({
        content:
            '✅ **Resultado contabilizado com sucesso!**\n' +
            '📸 Print anexado e publicado.\n' +
            '💾 Ranking atualizado.',
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// VER DUPLAS
// ========================================================================

async function verDuplas(interaction) {

    const dados = carregarDados();

    const texto = dados.duplas
        .map(
            (dupla, indice) =>
                `**${indice + 1}. ${limparTexto(dupla.nome)}** — 🌎 ${limparTexto(dupla.pais)}\n` +
                `👥 <@${dupla.jogador1}> + <@${dupla.jogador2}>`
        )
        .join('\n\n') ||
        'Nenhuma dupla registrada ainda.';

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('👥 DUPLAS DAS OLIMPÍADAS')
                .setDescription(texto.slice(0, 4000))
        ],
        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// RANKING
// ========================================================================
// Mostra:
// 1. Ranking das duplas.
// 2. Ranking dos países.
// 3. Ranking dos competidores.
// ========================================================================

async function verRanking(interaction) {

    const dados = carregarDados();
    const ranking = calcularRanking(dados);
    const paises = rankingPaises(dados);
    const competidores = rankingCompetidores(dados);

    const duplasTexto = Object.entries(ranking)
        .map(([id, posicao]) => ({
            dupla: buscarDupla(dados, id),
            ...posicao
        }))
        .filter(item => item.dupla)
        .sort(
            (a, b) =>
                b.vitorias - a.vitorias ||
                b.desempate - a.desempate
        )
        .map(
            (item, indice) =>
                `**${indice + 1}. ${limparTexto(item.dupla.nome)}** — ${limparTexto(item.dupla.pais)}\n` +
                `🥇 ${item.vitorias} • 🥈 ${item.prata} • 🥉 ${item.bronze}`
        )
        .join('\n\n') ||
        'Ainda não existem resultados.';

    const paisesTexto = paises
        .slice(0, 10)
        .map(
            (item, indice) =>
                `**${indice + 1}. ${limparTexto(item.pais)}** — 🥇 ${item.ouro} • 🥈 ${item.prata} • 🥉 ${item.bronze}`
        )
        .join('\n') ||
        'Sem medalhas registradas.';

    const competidoresTexto = competidores
        .slice(0, 10)
        .map(
            (item, indice) =>
                `**${indice + 1}. <@${item.id}>** — 🥇 ${item.ouro} • 🥈 ${item.prata} • 🥉 ${item.bronze}`
        )
        .join('\n') ||
        'Sem medalhas registradas.';

    return interaction.reply({

        embeds: [
            new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('🏆 RANKING — OLIMPÍADAS DE DUPLAS')
                .addFields(
                    {
                        name: '👥 DUPLAS',
                        value: duplasTexto.slice(0, 1024),
                        inline: false
                    },
                    {
                        name: '🌎 PAÍSES POR MEDALHAS',
                        value: paisesTexto.slice(0, 1024),
                        inline: false
                    },
                    {
                        name: '👤 COMPETIDORES POR MEDALHAS',
                        value: competidoresTexto.slice(0, 1024),
                        inline: false
                    }
                )
        ],

        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// GUIA OFICIAL
// ========================================================================
// Texto mantido conforme as regras fornecidas pelo organizador.
// ========================================================================

async function guia(interaction) {

    const cargo = CONFIG.cargoTeg
        ? `<@&${CONFIG.cargoTeg}>`
        : '@• Olímpico';

    const texto =
        `**🟨 Olimpíadas de Duplas:**\n\n` +
        `**Vencedores: ${cargo}**\n` +
        `**Cada dupla escolherá um País para representar**\n` +
        `**Todos os dias pares do Mês de Setembro!**\n\n` +
        `#️⃣ **Ranking de países por quantidade de medalhas**\n` +
        `#️⃣ **Ranking de competidores por quantidade de medalhas**\n` +
        `**Dupla vencedora:** 🥇\n` +
        `**Critérios de desempate (apenas para os vivos):**\n` +
        `**Dupla vice:** 🥈 **(peso: 3)**\n` +
        `**Dupla lanterna:** 🥉 **(peso: 1)**\n\n` +
        `***1h30min de partida***\n` +
        `**🚫 Regras:**\n\n` +
        `**1️⃣ Em caso de Briga, é possível a troca entre países com as medalhas individuais mantidas.**\n\n` +
        `**2️⃣ Em caso de Ausência, é possível a substituição DEFINITIVA de um parceiro para outro. As medalhas do País serão mantidas intactas.**\n\n` +
        `**3️⃣ Em caso de Anti-jogo, será tratado como qualquer outra partida do servidor.**\n\n` +
        `**4️⃣ Em caso de disputa por um país, será feito um sorteio.**\n\n` +
        `**⚠️ As Olímpiadas terão apenas DOIS vencedores!**`;

    return interaction.reply({

        embeds: [
            new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('📖 GUIA — OLIMPÍADAS DE DUPLAS')
                .setDescription(texto)
        ],

        flags: MessageFlags.Ephemeral
    });
}


// ========================================================================
// ROTEADOR DAS OLIMPÍADAS
// ========================================================================
// O index.js chama esta função quando recebe um botão, menu ou modal.
// ========================================================================

async function handle(interaction) {

    const customId = interaction.customId || '';

    // ------------------------------------------------------------
    // BOTÕES PRINCIPAIS
    // ------------------------------------------------------------

    if (customId === 'olymp_contabilizar') {
        return contabilizar(interaction);
    }

    if (customId === 'olymp_duplas') {
        return verDuplas(interaction);
    }

    if (customId === 'olymp_registrar') {
        return registrar(interaction);
    }

    if (customId === 'olymp_ranking') {
        return verRanking(interaction);
    }

    if (customId === 'olymp_guia') {
        return guia(interaction);
    }

    // ------------------------------------------------------------
    // REGISTRO
    // ------------------------------------------------------------

    if (customId === 'olymp_reg_p1') {
        return registrarJogador1(interaction);
    }

    if (customId.startsWith('olymp_reg_p2_')) {
        return registrarJogador2(interaction);
    }

    if (customId.startsWith('olymp_reg_pais_')) {
        return registrarPais(interaction);
    }

    if (customId.startsWith('olymp_reg_nome_')) {
        return finalizarRegistro(interaction);
    }

    // ------------------------------------------------------------
    // CONTABILIZAÇÃO
    // ------------------------------------------------------------

    if (customId === 'olymp_result_ouro') {
        return escolherOuro(interaction);
    }

    if (customId.startsWith('olymp_result_prata_')) {
        return escolherPrata(interaction);
    }

    if (customId.startsWith('olymp_result_bronze_')) {
        return escolherBronze(interaction);
    }

    return false;
}


// ========================================================================
// EXPORTAÇÕES
// ========================================================================

module.exports = {
    handle,
    painel,
    criarPainel,
    criarBotoes,
    calcularRanking,
    rankingPaises,
    rankingCompetidores,
    podeContabilizar
};
