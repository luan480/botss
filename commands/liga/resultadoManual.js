const {
    SlashCommandBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const path = require('path');
const fs = require('fs');

const pontuacaoLiga = require('./utils/pontuacaoLiga.js');
const configPontos = require('./utils/configPontos.js');
const { safeReadJson, safeWriteJson, isStaff } = require('./utils/helpers.js');

const PARTIDAS_PATH = path.join(__dirname, 'partidas.json');
const PONTUACAO_PATH = path.join(__dirname, 'pontuacao.json');
const TEMPORADA_PATH = path.join(__dirname, 'temporada.json');
const ECONOMY_PATH = path.join(__dirname, '..', 'economy', 'economy.json');
const PROGRESSAO_PATH = path.join(__dirname, '..', 'promocao', 'progressao.json');
const MAX_PARTIDAS_LIGA = 80;

function numero(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function idDaMenção(valor) {
    const m = String(valor || '').match(/<@!?(\d{17,20})>/);
    return m ? m[1] : null;
}

function parseAbates(valor, jogadores) {
    const permitidos = new Set(jogadores);
    const abates = [];
    for (const bloco of String(valor || '').split(/[,;\n]+/).map(v => v.trim()).filter(Boolean)) {
        const partes = bloco.split(/\s*(?:>|->|→|:)\s*/);
        if (partes.length !== 2) throw new Error(`Abate inválido: "${bloco}". Use @matador>@vítima.`);
        const matador = idDaMenção(partes[0]) || (partes[0].match(/^\d{17,20}$/)?.[0] || null);
        const vitima = idDaMenção(partes[1]) || (partes[1].match(/^\d{17,20}$/)?.[0] || null);
        if (!matador || !vitima || !permitidos.has(matador) || !permitidos.has(vitima) || matador === vitima) {
            throw new Error(`Abate inválido: "${bloco}". Os dois jogadores precisam estar entre os 6 participantes.`);
        }
        abates.push({ matador, vitima });
    }
    return abates;
}

function parseContinentes(valor, jogadores) {
    const permitidos = new Set(jogadores);
    const validos = new Set(Object.keys(configPontos.continentes));
    const continentes = [];
    const usados = new Set();

    for (const bloco of String(valor || '').split(/[,;\n]+/).map(v => v.trim()).filter(Boolean)) {
        const partes = bloco.split(/\s*:\s*/);
        if (partes.length !== 2) throw new Error(`Continente inválido: "${bloco}". Use continente:@jogador.`);
        const cont = partes[0].trim().toLowerCase();
        const dono = idDaMenção(partes[1]) || (partes[1].match(/^\d{17,20}$/)?.[0] || null);
        if (!validos.has(cont) || !dono || !permitidos.has(dono)) {
            throw new Error(`Continente inválido: "${bloco}".`);
        }
        if (usados.has(cont)) throw new Error(`O continente ${cont} foi informado mais de uma vez.`);
        usados.add(cont);
        continentes.push({ cont, dono });
    }
    return continentes;
}

function contarPartidasValidas(partidas) {
    return Object.values(partidas || {}).filter(p =>
        p && !p.anulada && !p.anulado && !p.cancelada && !p.cancelado &&
        Array.isArray(p.jogadoresBrutos) && p.jogadoresBrutos.length
    ).length;
}

function calcularTabela(jogadores, respostas, numeroPartida) {
    const tabela = {};
    for (const id of jogadores) tabela[id] = { pts: 0, vitoria: 0, wc: 0, detalhes: [], entraNaLiga: false, numeroPartida };

    const garantir = id => {
        if (!tabela[id]) tabela[id] = { pts: 0, vitoria: 0, wc: 0, detalhes: [], entraNaLiga: false, numeroPartida };
    };

    const vitoria = respostas.modo === 'objetivo' ? configPontos.vitoria.objetivo : configPontos.vitoria.territorios;
    garantir(respostas.vencedor);
    tabela[respostas.vencedor].pts += vitoria;
    tabela[respostas.vencedor].vitoria = 1;
    tabela[respostas.vencedor].detalhes.push(`+${vitoria} Vitória`);

    if (respostas.segundo) {
        garantir(respostas.segundo);
        tabela[respostas.segundo].pts += configPontos.segundoLugar;
        tabela[respostas.segundo].detalhes.push(`+${configPontos.segundoLugar} 2º Lugar`);
    }
    if (respostas.terceiro) {
        garantir(respostas.terceiro);
        tabela[respostas.terceiro].pts += numero(configPontos.terceiroLugar) || 5;
        tabela[respostas.terceiro].detalhes.push(`+${numero(configPontos.terceiroLugar) || 5} 3º Lugar`);
    }
    if (respostas.maisTropas) {
        garantir(respostas.maisTropas);
        tabela[respostas.maisTropas].pts += numero(configPontos.maisTropas) || 5;
        tabela[respostas.maisTropas].detalhes.push(`+${numero(configPontos.maisTropas) || 5} Mais tropas`);
    }

    for (const abate of respostas.abates) {
        garantir(abate.matador);
        garantir(abate.vitima);
        tabela[abate.matador].pts += numero(configPontos.combate.kill) || 10;
        tabela[abate.matador].detalhes.push(`+${numero(configPontos.combate.kill) || 10} Abate`);
        tabela[abate.vitima].pts += numero(configPontos.combate.morte) || -15;
        tabela[abate.vitima].detalhes.push(`${numero(configPontos.combate.morte) || -15} Morte`);
    }

    for (const c of respostas.continentes) {
        garantir(c.dono);
        const pts = numero(configPontos.continentes[c.cont]?.pontos);
        tabela[c.dono].pts += pts;
        tabela[c.dono].detalhes.push(`+${pts} ${configPontos.continentes[c.cont]?.nome || c.cont}`);
    }

    const mortos = new Set(respostas.abates.map(a => a.vitima));
    for (const id of jogadores) {
        if (!mortos.has(id)) {
            const pts = numero(configPontos.sobrevivencia);
            tabela[id].pts += pts;
            tabela[id].detalhes.push(`+${pts} Sobrevivência`);
        }
    }

    for (const id of Object.keys(tabela)) {
        tabela[id].entraNaLiga = numeroPartida <= MAX_PARTIDAS_LIGA;
        tabela[id].numeroPartida = numeroPartida;
        tabela[id].wc = tabela[id].pts > 0 ? tabela[id].pts * 100 : 0;
    }

    return tabela;
}

function criarEmbedResultado(guild, respostas, jogadores, tabela, partidaId) {
    const linhas = jogadores.map(id => {
        const d = tabela[id];
        const detalhes = d.detalhes.length ? ` (${d.detalhes.join(', ')})` : '';
        return `<@${id}>: **${d.pts >= 0 ? '+' : ''}${d.pts} pts**${detalhes}`;
    });

    return {
        title: '🏆 LIGA DAS NAÇÕES — RESULTADO REGISTRADO',
        description: `Partida **${partidaId}** registrada manualmente por <@${respostas.adminId}>.`,
        fields: [
            { name: '⚙️ Modo', value: respostas.modo.toUpperCase(), inline: true },
            { name: '🥇 1º LUGAR', value: `<@${respostas.vencedor}>`, inline: true },
            { name: '🥈 2º LUGAR', value: `<@${respostas.segundo}>`, inline: true },
            { name: '🥉 3º LUGAR', value: `<@${respostas.terceiro}>`, inline: true },
            { name: '⚔️ MAIS TROPAS', value: `<@${respostas.maisTropas}>`, inline: true },
            { name: '📊 EXTRATO FINAL', value: linhas.join('\n').slice(0, 1024), inline: false }
        ],
        footer: { text: 'Resultado manual • Fonte oficial: partidas.json' }
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liga-manual')
        .setDescription('Registra manualmente uma partida completa da Liga.')
        .addUserOption(o => o.setName('jogador1').setDescription('Participante 1').setRequired(true))
        .addUserOption(o => o.setName('jogador2').setDescription('Participante 2').setRequired(true))
        .addUserOption(o => o.setName('jogador3').setDescription('Participante 3').setRequired(true))
        .addUserOption(o => o.setName('jogador4').setDescription('Participante 4').setRequired(true))
        .addUserOption(o => o.setName('jogador5').setDescription('Participante 5').setRequired(true))
        .addUserOption(o => o.setName('jogador6').setDescription('Participante 6').setRequired(true))
        .addUserOption(o => o.setName('vencedor').setDescription('Vencedor').setRequired(true))
        .addUserOption(o => o.setName('segundo').setDescription('2º lugar').setRequired(true))
        .addUserOption(o => o.setName('terceiro').setDescription('3º lugar').setRequired(true))
        .addUserOption(o => o.setName('mais_tropas').setDescription('Jogador com mais tropas').setRequired(true))
        .addStringOption(o => o.setName('modo').setDescription('Modo da partida').setRequired(true).addChoices(
            { name: 'Objetivo', value: 'objetivo' },
            { name: 'Territórios', value: 'territorios' }
        ))
        .addStringOption(o => o.setName('abates').setDescription('Opcional: @matador>@vitima, @matador>@vitima').setRequired(false))
        .addStringOption(o => o.setName('continentes').setDescription('Opcional: asia:@jogador, europa:@jogador').setRequired(false)),

    async execute(interaction) {
        if (!isStaff(interaction.member)) {
            return interaction.reply({ content: '❌ Você não possui cargo autorizado para registrar resultados da Liga.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const jogadores = ['jogador1','jogador2','jogador3','jogador4','jogador5','jogador6']
            .map(n => interaction.options.getUser(n)?.id)
            .filter(Boolean);

        if (new Set(jogadores).size !== 6) {
            return interaction.editReply('❌ Os 6 participantes precisam ser jogadores diferentes.');
        }

        const respostas = {
            adminId: interaction.user.id,
            modo: interaction.options.getString('modo'),
            vencedor: interaction.options.getUser('vencedor').id,
            segundo: interaction.options.getUser('segundo').id,
            terceiro: interaction.options.getUser('terceiro').id,
            maisTropas: interaction.options.getUser('mais_tropas').id,
            abates: [],
            continentes: []
        };

        const idsObrigatorios = [respostas.vencedor, respostas.segundo, respostas.terceiro, respostas.maisTropas];
        if (idsObrigatorios.some(id => !jogadores.includes(id))) {
            return interaction.editReply('❌ Vencedor, 2º, 3º e Mais Tropas precisam estar entre os 6 participantes.');
        }
        if (new Set([respostas.vencedor, respostas.segundo, respostas.terceiro]).size !== 3) {
            return interaction.editReply('❌ 1º, 2º e 3º lugar precisam ser jogadores diferentes.');
        }

        try {
            respostas.abates = parseAbates(interaction.options.getString('abates'), jogadores);
            respostas.continentes = parseContinentes(interaction.options.getString('continentes'), jogadores);

            const partidas = safeReadJson(PARTIDAS_PATH) || {};
            const numeroPartida = contarPartidasValidas(partidas) + 1;
            const tabela = calcularTabela(jogadores, respostas, numeroPartida);

            const canalResultados = await interaction.guild.channels.fetch('1071976981924687912').catch(() => null);
            if (!canalResultados?.isTextBased?.()) {
                throw new Error('Canal de resultados da Liga não encontrado ou não é de texto.');
            }

            const mensagemResultado = await canalResultados.send({
                embeds: [criarEmbedResultado(interaction.guild, respostas, jogadores, tabela, 'pendente')]
            });
            const partidaId = mensagemResultado.id;

            const partida = {
                adminId: interaction.user.id,
                manual: true,
                origem: 'registro_manual',
                respostas,
                jogadoresBrutos: jogadores.map(id => ({
                    id,
                    username: interaction.guild.members.cache.get(id)?.user?.username || 'Desconhecido'
                })),
                pontos: Object.fromEntries(Object.entries(tabela).map(([id, d]) => [id, {
                    ptsLiga: d.pts,
                    entraNaLiga: d.entraNaLiga,
                    numeroPartida: d.numeroPartida,
                    wcRecebido: d.wc,
                    vitoria: d.vitoria
                }])),
                meta: {
                    limiteLiga: MAX_PARTIDAS_LIGA,
                    registradaEm: Date.now(),
                    tipoRegistro: 'manual'
                }
            };

            const partidasAntes = JSON.stringify(partidas);
            const pontuacaoAntes = fs.existsSync(PONTUACAO_PATH) ? fs.readFileSync(PONTUACAO_PATH, 'utf8') : null;
            const economyAntes = fs.existsSync(ECONOMY_PATH) ? fs.readFileSync(ECONOMY_PATH, 'utf8') : null;
            const progressaoAntes = fs.existsSync(PROGRESSAO_PATH) ? fs.readFileSync(PROGRESSAO_PATH, 'utf8') : null;

            try {
                partidas[partidaId] = partida;
                safeWriteJson(PARTIDAS_PATH, partidas);

                pontuacaoLiga.sincronizarArquivo(PONTUACAO_PATH, PARTIDAS_PATH, TEMPORADA_PATH);

                await mensagemResultado.edit({
                    embeds: [criarEmbedResultado(interaction.guild, respostas, jogadores, tabela, partidaId)],
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`edit_match_${partidaId}`)
                            .setLabel('Editar / Anular')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('⏪')
                    )]
                });

                const economy = safeReadJson(ECONOMY_PATH) || {};
                const progressao = safeReadJson(PROGRESSAO_PATH) || {};
                for (const id of jogadores) {
                    const d = tabela[id];
                    if (d.wc > 0) economy[id] = numero(economy[id]) + d.wc;

                    const p = progressao[id] || {
                        totalWins: 0,
                        nome: interaction.guild.members.cache.get(id)?.user?.username || 'Desconhecido'
                    };
                    p.partidasSemanais = numero(p.partidasSemanais) + 1;
                    p.partidasLigaTotal = numero(p.partidasLigaTotal) + 1;
                    p.partidasConsideradasLiga = Math.min(MAX_PARTIDAS_LIGA, numero(p.partidasConsideradasLiga) + 1);
                    if (d.vitoria === 1) {
                        p.totalWins = numero(p.totalWins) + 1;
                        p.vitoriasSemanais = numero(p.vitoriasSemanais) + 1;
                        p.vitoriasMensais = numero(p.vitoriasMensais) + 1;
                    }
                    for (const abate of respostas.abates) {
                        if (abate.matador === id) p.killsSemanais = numero(p.killsSemanais) + 1;
                        if (abate.vitima === id) p.mortesSemanais = numero(p.mortesSemanais) + 1;
                    }
                    progressao[id] = p;
                }
                safeWriteJson(ECONOMY_PATH, economy);
                safeWriteJson(PROGRESSAO_PATH, progressao);
            } catch (erro) {
                safeWriteJson(PARTIDAS_PATH, JSON.parse(partidasAntes));
                await mensagemResultado.delete().catch(() => {});
                if (pontuacaoAntes !== null) fs.writeFileSync(PONTUACAO_PATH, pontuacaoAntes);
                if (economyAntes !== null) fs.writeFileSync(ECONOMY_PATH, economyAntes);
                if (progressaoAntes !== null) fs.writeFileSync(PROGRESSAO_PATH, progressaoAntes);
                throw erro;
            }

            return interaction.editReply(
                `✅ **Resultado manual registrado!**\n\n` +
                `🆔 Partida: \`${partidaId}\`\n` +
                `📊 Partida nº **${numeroPartida}**\n` +
                `🏆 Pontuação e estatísticas foram sincronizadas.\n` +
                `↩️ A partida também pode ser anulada pelo fluxo de reversão.`
            );
        } catch (erro) {
            console.error('[LIGA-MANUAL] Erro:', erro);
            return interaction.editReply(`❌ Não foi possível registrar a partida manual.\n\`${erro.message || erro}\``);
        }
    }
};
