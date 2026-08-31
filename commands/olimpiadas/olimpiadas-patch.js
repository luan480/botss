/* ========================================================================
   ARQUIVO: commands/olimpiadas/olimpiadas-patch.js

   FUNÇÃO:
   - Corrige o fluxo novo de registro das Olimpíadas.
   - Não pede nome da dupla.
   - A dupla é formada pelos dois jogadores selecionados.
   - Permite DIGITAR parte do nome do país.
   - Mostra os países encontrados em um menu.
   - País ocupado nunca pode ser escolhido novamente.
   - Mantém suporte a 100 países usando paginação de 25 opções.

   IMPORTANTE:
   Este arquivo usa IDs olymp2_ para não conflitar com o handler antigo.
   O comando /olimpiadas-painel publica o painel novo.
   ======================================================================== */

const fs = require('fs');
const path = require('path');

const {
    EmbedBuilder,
    ActionRowBuilder,
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require('discord.js');

const ARQUIVO = path.join(__dirname, 'olimpiadas.json');
const CONFIG = require(ARQUIVO);

// Pesquisas temporárias ficam na memória do processo.
const pesquisas = new Map();

function dados() {
    const atual = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
    atual.duplas ??= [];
    atual.resultados ??= [];
    return atual;
}

function salvar(atual) {
    fs.writeFileSync(ARQUIVO, JSON.stringify(atual, null, 2), 'utf8');
}

function normalizar(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function disponiveis(atual) {
    const ocupados = new Set(
        atual.duplas.map(dupla => normalizar(dupla.pais))
    );

    return (CONFIG.paises || []).filter(
        pais => !ocupados.has(normalizar(pais))
    );
}

function jogadoresJaRegistrados(atual, jogador1, jogador2) {
    return atual.duplas.find(dupla =>
        [dupla.jogador1, dupla.jogador2].includes(jogador1) ||
        [dupla.jogador1, dupla.jogador2].includes(jogador2)
    );
}

function menuPaises(token, pagina = 0) {
    const pesquisa = pesquisas.get(token);
    if (!pesquisa) return null;

    const inicio = pagina * 25;
    const lista = pesquisa.paises.slice(inicio, inicio + 25);
    const totalPaginas = Math.max(1, Math.ceil(pesquisa.paises.length / 25));

    if (!lista.length) return null;

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`olymp2_pais_${token}_${pagina}`)
        .setPlaceholder('🌎 Escolha o país que apareceu na pesquisa')
        .addOptions(lista.map(pais => ({
            label: pais.slice(0, 100),
            value: pais,
            emoji: '🌎'
        })));

    const componentes = [
        new ActionRowBuilder().addComponents(menu)
    ];

    if (totalPaginas > 1) {
        componentes.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`olymp2_pais_prev_${token}_${pagina}`)
                    .setLabel('Anterior')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pagina === 0),
                new ButtonBuilder()
                    .setCustomId(`olymp2_pais_page_${token}`)
                    .setLabel(`Página ${pagina + 1}/${totalPaginas}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`olymp2_pais_next_${token}_${pagina}`)
                    .setLabel('Próxima')
                    .setEmoji('➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pagina >= totalPaginas - 1)
            )
        );
    }

    return componentes;
}

async function iniciarRegistro(interaction) {
    return interaction.reply({
        content: '📝 **REGISTRO DE DUPLA**\n\nSelecione o primeiro integrante.',
        components: [
            new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId('olymp2_reg_p1')
                    .setPlaceholder('Selecione o jogador 1')
            )
        ],
        flags: MessageFlags.Ephemeral
    });
}

async function jogador1(interaction) {
    const id = interaction.values[0];

    return interaction.update({
        content: '📝 **JOGADOR 2**\n\nSelecione o segundo integrante.',
        components: [
            new ActionRowBuilder().addComponents(
                new UserSelectMenuBuilder()
                    .setCustomId(`olymp2_reg_p2_${id}`)
                    .setPlaceholder('Selecione o jogador 2')
            )
        ]
    });
}

async function jogador2(interaction) {
    const jogador1Id = interaction.customId.replace('olymp2_reg_p2_', '');
    const jogador2Id = interaction.values[0];
    const atual = dados();

    if (jogador1Id === jogador2Id) {
        return interaction.reply({
            content: '❌ Os dois integrantes precisam ser diferentes.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (jogadoresJaRegistrados(atual, jogador1Id, jogador2Id)) {
        return interaction.reply({
            content: '❌ Um dos jogadores já pertence a uma dupla registrada.',
            flags: MessageFlags.Ephemeral
        });
    }

    const modal = new ModalBuilder()
        .setCustomId(`olymp2_busca_pais_${jogador1Id}_${jogador2Id}`)
        .setTitle('Pesquisar país');

    const campo = new TextInputBuilder()
        .setCustomId('pais')
        .setLabel('Digite o país que deseja representar')
        .setPlaceholder('Ex.: Brasil, Japão, Alemanha...')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(50)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(campo)
    );

    return interaction.showModal(modal);
}

async function pesquisarPais(interaction) {
    const partes = interaction.customId.split('_');
    const jogador1Id = partes[3];
    const jogador2Id = partes[4];
    const termo = interaction.fields.getTextInputValue('pais').trim();
    const atual = dados();

    if (jogadoresJaRegistrados(atual, jogador1Id, jogador2Id)) {
        return interaction.reply({
            content: '❌ Um dos jogadores já está registrado em outra dupla.',
            flags: MessageFlags.Ephemeral
        });
    }

    const lista = disponiveis(atual).filter(pais =>
        !termo || normalizar(pais).includes(normalizar(termo))
    );

    if (!lista.length) {
        return interaction.reply({
            content: '❌ Nenhum país disponível foi encontrado para essa pesquisa.',
            flags: MessageFlags.Ephemeral
        });
    }

    const token = `${Date.now()}_${interaction.user.id}`;

    pesquisas.set(token, {
        jogador1: jogador1Id,
        jogador2: jogador2Id,
        paises: lista,
        criadoEm: Date.now()
    });

    // Limpeza automática depois de 5 minutos.
    setTimeout(() => pesquisas.delete(token), 5 * 60 * 1000).unref?.();

    return interaction.reply({
        content: [
            '🌎 **PAÍS DA DUPLA**',
            '',
            termo
                ? `🔎 Pesquisa: **${termo}**`
                : '🔎 Mostrando os países disponíveis.',
            `📋 **${lista.length} país(es) encontrado(s).**`,
            '',
            'Selecione o país abaixo. Países já ocupados não aparecem.'
        ].join('\n'),
        components: menuPaises(token, 0),
        flags: MessageFlags.Ephemeral
    });
}

async function selecionarPais(interaction) {
    const partes = interaction.customId.split('_');
    const token = partes[2];
    const pesquisa = pesquisas.get(token);

    if (!pesquisa) {
        return interaction.reply({
            content: '⌛ Essa pesquisa expirou. Comece o registro novamente.',
            flags: MessageFlags.Ephemeral
        });
    }

    const pais = interaction.values[0];
    const atual = dados();

    if (jogadoresJaRegistrados(atual, pesquisa.jogador1, pesquisa.jogador2)) {
        pesquisas.delete(token);
        return interaction.reply({
            content: '❌ Um dos jogadores já está registrado em outra dupla.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (paisOcupado(atual, pais)) {
        pesquisas.delete(token);
        return interaction.reply({
            content: '❌ Esse país acabou de ser escolhido por outra dupla.',
            flags: MessageFlags.Ephemeral
        });
    }

    const dupla = {
        id: `dupla_${Date.now()}_${pesquisa.jogador1}`,
        pais,
        jogador1: pesquisa.jogador1,
        jogador2: pesquisa.jogador2,
        criadoPor: interaction.user.id,
        criadoEm: new Date().toISOString(),
        ativa: true
    };

    atual.duplas.push(dupla);
    salvar(atual);
    pesquisas.delete(token);

    const canalTeg = await interaction.client.channels
        .fetch(CONFIG.canalTeg)
        .catch(() => null);

    if (canalTeg?.isTextBased()) {
        await canalTeg.send({
            content: CONFIG.cargoTeg ? `<@&${CONFIG.cargoTeg}>` : undefined,
            embeds: [
                new EmbedBuilder()
                    .setColor('#D4AF37')
                    .setTitle('📝 NOVA DUPLA REGISTRADA')
                    .setDescription([
                        `🌎 **País:** ${pais}`,
                        `👥 **Dupla:** <@${pesquisa.jogador1}> + <@${pesquisa.jogador2}>`
                    ].join('\n'))
                    .setTimestamp()
            ]
        });
    }

    return interaction.update({
        content: [
            '✅ **DUPLA REGISTRADA COM SUCESSO!**',
            '',
            `🌎 **País:** ${pais}`,
            `👥 **Integrantes:** <@${pesquisa.jogador1}> + <@${pesquisa.jogador2}>`
        ].join('\n'),
        components: []
    });
}

function paisOcupado(atual, pais) {
    return atual.duplas.some(
        dupla => normalizar(dupla.pais) === normalizar(pais)
    );
}

async function mudarPagina(interaction, direcao) {
    const partes = interaction.customId.split('_');
    const token = partes[3];
    const paginaAtual = Number(partes[4]);
    const pesquisa = pesquisas.get(token);

    if (!pesquisa) {
        return interaction.reply({
            content: '⌛ Essa pesquisa expirou. Comece novamente.',
            flags: MessageFlags.Ephemeral
        });
    }

    const total = Math.ceil(pesquisa.paises.length / 25);
    const novaPagina = Math.max(
        0,
        Math.min(total - 1, paginaAtual + direcao)
    );

    return interaction.update({
        content: `🌎 **PAÍSES ENCONTRADOS — PÁGINA ${novaPagina + 1}/${total}**`,
        components: menuPaises(token, novaPagina)
    });
}

function criarPainelNovo() {
    const cargo = CONFIG.cargoTeg
        ? `<@&${CONFIG.cargoTeg}>`
        : '@• Olímpico';

    const atual = dados();

    const embed = new EmbedBuilder()
        .setColor('#D4AF37')
        .setTitle('🟨 OLIMPÍADAS DE DUPLAS')
        .setDescription([
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
            `👥 Duplas: ${atual.duplas.length}`,
            `📊 Resultados: ${atual.resultados.length}`,
            '⏱️ Partida: 1h30min',
            '',
            '⚠️ **Apenas DOIS vencedores.**'
        ].join('\n'))
        .setImage(CONFIG.imagem)
        .setFooter({ text: 'WorldWarBR • Olimpíadas de Duplas' });

    const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('olymp_contabilizar')
            .setLabel('Contabilizar')
            .setEmoji('🏅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('olymp2_duplas')
            .setLabel('Ver duplas')
            .setEmoji('👥')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('olymp2_registrar')
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

    return { embeds: [embed], components: [botoes] };
}

async function publicarPainel(interaction) {
    if (!interaction.client.__olimpiadasPatch) {
        instalar(interaction.client);
    }

    const canal = await interaction.client.channels
        .fetch(CONFIG.canalPainel)
        .catch(() => null);

    if (!canal?.isTextBased()) {
        return interaction.reply({
            content: '❌ Canal do painel das Olimpíadas não encontrado.',
            flags: MessageFlags.Ephemeral
        });
    }

    await canal.send(criarPainelNovo());

    return interaction.reply({
        content: `✅ Painel atualizado em <#${CONFIG.canalPainel}>.`,
        flags: MessageFlags.Ephemeral
    });
}

function instalar(client) {
    if (client.__olimpiadasPatch) return;
    client.__olimpiadasPatch = true;

    client.on('interactionCreate', async interaction => {
        const id = interaction.customId || '';
        if (!id.startsWith('olymp2_')) return;

        try {
            if (id === 'olymp2_registrar') return iniciarRegistro(interaction);
            if (id === 'olymp2_reg_p1') return jogador1(interaction);
            if (id.startsWith('olymp2_reg_p2_')) return jogador2(interaction);
            if (id.startsWith('olymp2_busca_pais_')) return pesquisarPais(interaction);
            if (id.startsWith('olymp2_pais_prev_')) return mudarPagina(interaction, -1);
            if (id.startsWith('olymp2_pais_next_')) return mudarPagina(interaction, 1);
            if (id.startsWith('olymp2_pais_')) return selecionarPais(interaction);

            if (id === 'olymp2_duplas') {
                const atual = dados();
                const texto = atual.duplas.length
                    ? atual.duplas.map((d, i) =>
                        `**${i + 1}. 🌎 ${d.pais}**\n👥 <@${d.jogador1}> + <@${d.jogador2}>`
                    ).join('\n\n').slice(0, 4000)
                    : 'Nenhuma dupla registrada ainda.';

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#D4AF37')
                            .setTitle('👥 DUPLAS DAS OLIMPÍADAS')
                            .setDescription(texto)
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (erro) {
            console.error('[OLIMPIADAS V2] Erro:', erro);
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Erro ao processar esta ação.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    });
}

module.exports = {
    instalar,
    publicarPainel,
    criarPainelNovo
};
