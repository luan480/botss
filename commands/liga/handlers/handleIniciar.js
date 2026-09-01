/* ========================================================================
   WORLDWARBR — LIGA DAS NAÇÕES
   ARQUIVO: commands/liga/handlers/handleIniciar.js

   FLUXO:
   1. Print obrigatório
   2. Exatamente 6 jogadores
   3. Modo + vencedor + 2º lugar
   4. 3º lugar + jogador com mais tropas
   5. Abates
   6. Continentes
   7. Cálculo de pontos / WarCoins / progressão / histórico

   NOVAS REGRAS:
   - 3º lugar recebe +5 pontos na Liga.
   - Jogador com mais tropas recebe +5 pontos na Liga.
   - Se o mesmo jogador tiver mais tropas e ficar em 3º, recebe os dois
     bônus (+10 no total).

   REGRA EXISTENTE:
   - Até a 80ª partida: pontos entram no ranking da Liga.
   - A partir da 81ª: pontos da Liga ficam bloqueados, mas vitória, kills,
     mortes, continentes, progressão e histórico continuam sendo registrados.
   ======================================================================== */

const path = require('path');
const fs = require('fs');

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags
} = require('discord.js');

const {
    safeReadJson,
    safeWriteJson
} = require('../utils/helpers.js');

const menus = require('../utils/menusLiga.js');
const configPontos = require('../utils/configPontos.js');
const painelMod = require('../painel.js');

const MAX_PARTIDAS_LIGA = 80;

const economyPath = path.join(
    __dirname,
    '..',
    '..',
    'economy',
    'economy.json'
);

const progressaoPath = path.join(
    __dirname,
    '..',
    '..',
    'promocao',
    'progressao.json'
);

const punicoesPath = path.join(
    __dirname,
    '..',
    'punicoes.json'
);

const carreirasPath = path.join(
    __dirname,
    '..',
    '..',
    'promocao',
    'carreiras.json'
);

const tempPrintsDir = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'temp_prints'
);

function contarPartidasRegistradasDoJogador(partidas, jogadorId) {
    let total = 0;

    for (const partida of Object.values(partidas || {})) {
        if (!partida) continue;

        const jogadores = Array.isArray(partida.jogadoresBrutos)
            ? partida.jogadoresBrutos
            : [];

        if (jogadores.some(jogador => String(jogador?.id) === String(jogadorId))) {
            total++;
        }
    }

    return total;
}

function gerarPainelAoVivo(
    respostas,
    fase,
    anexoPrintPrincipal,
    etapaExtras = false
) {
    let desc =
        'Preencha os dados usando os menus abaixo. **Este quadro atualiza em tempo real!**';

    if (fase === 1 && !etapaExtras) {
        desc =
            '📍 **FASE 1:** Defina o modo, vencedor e 2º lugar.\n\n' +
            desc;
    }

    if (fase === 1 && etapaExtras) {
        desc =
            '📍 **FASE 1B:** Informe o 3º lugar e quem terminou com mais tropas.\n\n' +
            desc;
    }

    if (fase === 2) {
        desc =
            '📍 **FASE 2:** Registre quem eliminou quem.\n\n' +
            desc;
    }

    if (fase === 3) {
        desc =
            '📍 **FASE 3:** Registre as dominações de continente.\n\n' +
            desc;
    }

    if (fase === 4) {
        desc =
            '✅ **DADOS CONFIRMADOS!** Gerando quadro final e calculando resultados...';
    }

    const emb = new EmbedBuilder()
        .setColor(fase === 4 ? '#2ECC71' : '#F1C40F')
        .setTitle('📡 LIGA DAS NAÇÕES — PAINEL AO VIVO')
        .setDescription(desc);

    if (anexoPrintPrincipal) {
        emb.setThumbnail(anexoPrintPrincipal);
    }

    emb.addFields(
        {
            name: '⚙️ Modo',
            value: respostas.modo ? respostas.modo.toUpperCase() : '⏳ Pendente',
            inline: true
        },
        {
            name: '🥇 Vencedor',
            value: respostas.vencedor ? `<@${respostas.vencedor}>` : '⏳ Pendente',
            inline: true
        },
        {
            name: '🥈 2º Lugar',
            value: respostas.segundo
                ? (respostas.segundo === '0' ? 'Nenhum' : `<@${respostas.segundo}>`)
                : '⏳ Pendente',
            inline: true
        },
        {
            name: '🥉 3º Lugar',
            value: respostas.terceiro ? `<@${respostas.terceiro}>` : '⏳ Pendente',
            inline: true
        },
        {
            name: '⚔️ Mais Tropas',
            value: respostas.maisTropas ? `<@${respostas.maisTropas}>` : '⏳ Pendente',
            inline: true
        }
    );

    if (fase >= 2 && respostas.abates.length > 0) {
        const agrupados = {};

        respostas.abates.forEach(abate => {
            if (!agrupados[abate.matador]) agrupados[abate.matador] = [];
            agrupados[abate.matador].push(`<@${abate.vitima}>`);
        });

        const texto = Object.entries(agrupados)
            .map(([matador, vitimas]) => `⚔️ <@${matador}> eliminou: ${vitimas.join(', ')}`)
            .join('\n');

        emb.addFields({
            name: '💀 Histórico de Abates',
            value: texto,
            inline: false
        });
    } else if (fase >= 2) {
        emb.addFields({
            name: '💀 Histórico de Abates',
            value: '*Nenhuma baixa registrada ainda.*',
            inline: false
        });
    }

    if (fase >= 3 && respostas.continentes.length > 0) {
        const agrupados = {};

        respostas.continentes.forEach(continente => {
            if (!agrupados[continente.dono]) agrupados[continente.dono] = [];

            const info = configPontos.continentes[continente.cont];
            agrupados[continente.dono].push(`**${info?.nome || continente.cont}**`);
        });

        const texto = Object.entries(agrupados)
            .map(([dono, conts]) => `🌍 <@${dono}> dominou: ${conts.join(', ')}`)
            .join('\n');

        emb.addFields({
            name: '🗺️ Mapa Global',
            value: texto,
            inline: false
        });
    } else if (fase >= 3) {
        emb.addFields({
            name: '🗺️ Mapa Global',
            value: '*Nenhum continente dominado.*',
            inline: false
        });
    }

    return emb;
}

module.exports = async (
    client,
    interaction,
    pontuacaoPath,
    partidasPath
) => {
    try {
        const member = interaction.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.editReply({
                content: '❌ Entre em uma call primeiro!'
            });
        }

        const jogadoresNaCall = voiceChannel.members.filter(
            jogador => !jogador.user.bot
        );

        const topico = await interaction.channel.threads.create({
            name: `registro-${interaction.user.username}-${Date.now().toString().slice(-4)}`,
            autoArchiveDuration: 60,
            type: ChannelType.PrivateThread
        });

        await topico.members.add(interaction.user.id);

        await interaction.editReply({
            content: `✅ **Operação Iniciada!** Vá para o tópico para preencher os dados: ${topico}`
        });

        await topico.send(
            '📸 **PASSO 1:** Envie **TODOS OS PRINTS** de comprovação ' +
            '(se for mais de um, mande todos na mesma mensagem).'
        );

        const filterMsg = mensagem =>
            jogadoresNaCall.has(mensagem.author.id) ||
            mensagem.author.id === interaction.user.id;

        const collectedMsg = await topico.awaitMessages({
            filter: filterMsg,
            max: 1,
            time: 120000
        }).catch(() => null);

        const mensagemPrint = collectedMsg?.first();

        if (!mensagemPrint || mensagemPrint.attachments.size === 0) {
            await topico.send(
                '❌ Tempo esgotado ou mensagem sem imagens. Tópico será deletado.'
            );

            setTimeout(async () => {
                await topico.delete().catch(() => {});
            }, 3000);

            return;
        }

        const anexosUrls = Array.from(mensagemPrint.attachments.values())
            .map(attachment => attachment.url);

        const anexoPrintPrincipal = anexosUrls[0];

        // ============================================================
        // PARTICIPANTES — EXATAMENTE 6
        // ============================================================
        let jogadoresBrutos = [];

        while (true) {
            await topico.send(
                '👥 **PASSO 2:** Mencione (`@`) os **exatos 6 jogadores** na mesma mensagem.'
            );

            const msgJogadores = await topico.awaitMessages({
                filter: filterMsg,
                max: 1,
                time: 120000
            }).catch(() => null);

            if (!msgJogadores) {
                setTimeout(async () => {
                    await topico.delete().catch(() => {});
                }, 3000);
                return;
            }

            const mentions = msgJogadores
                .first()
                .mentions
                .users
                .filter(usuario => !usuario.bot);

            if (mentions.size === 6) {
                jogadoresBrutos = Array.from(mentions.values());
                break;
            }

            await topico.send(
                `❌ A partida precisa ter **exatamente 6 jogadores**. Você mencionou **${mentions.size}**.`
            );
        }

        const progressaoData = safeReadJson(progressaoPath);

        const jogadoresInfo = jogadoresBrutos.map(jogador => {
            const vit = progressaoData[jogador.id]
                ? (progressaoData[jogador.id].totalWins || 0)
                : 0;

            return {
                id: jogador.id,
                username: jogador.username,
                label: `${jogador.username} 🏆 ${vit} vit`
            };
        });

        const respostas = {
            vencedor: null,
            segundo: null,
            terceiro: null,
            maisTropas: null,
            modo: null,
            abates: [],
            continentes: []
        };

        let fase = 1;
        let etapaExtras = false;
        let jogadoresMortos = [];

        const continentesDispTotal = Object.entries(configPontos.continentes)
            .map(([id, info]) => ({
                label: `${info.nome} (+${info.pontos} pts)`,
                value: id
            }));

        let continentesDisp = [...continentesDispTotal];

        let painelMsg = await topico.send({
            embeds: [
                gerarPainelAoVivo(
                    respostas,
                    fase,
                    anexoPrintPrincipal,
                    etapaExtras
                )
            ],
            components: menus.criarPainelFase1(
                jogadoresInfo,
                respostas
            )
        });

        while (fase < 4) {
            const int = await painelMsg.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 180000
            }).catch(() => null);

            if (!int) {
                await topico.send('❌ Tempo esgotado. Tópico deletado.');

                setTimeout(async () => {
                    await topico.delete().catch(() => {});
                }, 3000);

                return;
            }

            // ============================================================
            // FASE 1 — MODO / VENCEDOR / 2º
            // ============================================================
            if (fase === 1 && !etapaExtras) {
                if (int.customId === 'sel_modo') {
                    respostas.modo = int.values[0];
                }

                if (int.customId === 'sel_venc') {
                    respostas.vencedor = int.values[0];

                    if (respostas.segundo === respostas.vencedor) {
                        respostas.segundo = null;
                    }

                    if (respostas.terceiro === respostas.vencedor) {
                        respostas.terceiro = null;
                    }
                }

                if (int.customId === 'sel_seg') {
                    respostas.segundo = int.values[0];

                    if (respostas.terceiro === respostas.segundo) {
                        respostas.terceiro = null;
                    }
                }

                if (int.customId === 'reset_p1') {
                    respostas.vencedor = null;
                    respostas.segundo = null;
                    respostas.terceiro = null;
                    respostas.maisTropas = null;
                    respostas.modo = null;
                }

                if (int.customId === 'btn_confirmar_p1') {
                    if (!respostas.vencedor || !respostas.segundo || !respostas.modo) {
                        await int.reply({
                            content: '❌ Preencha **Modo, Vencedor e 2º Lugar** antes de avançar!',
                            flags: MessageFlags.Ephemeral
                        });
                        continue;
                    }

                    if (respostas.segundo === respostas.vencedor) {
                        await int.reply({
                            content: '❌ Vencedor e 2º lugar precisam ser jogadores diferentes.',
                            flags: MessageFlags.Ephemeral
                        });
                        continue;
                    }

                    etapaExtras = true;

                    await int.update({
                        embeds: [
                            gerarPainelAoVivo(
                                respostas,
                                fase,
                                anexoPrintPrincipal,
                                etapaExtras
                            )
                        ],
                        components: menus.criarPainelFase1Extras(
                            jogadoresInfo,
                            respostas
                        )
                    });

                    continue;
                }

                await int.update({
                    embeds: [
                        gerarPainelAoVivo(
                            respostas,
                            fase,
                            anexoPrintPrincipal,
                            etapaExtras
                        )
                    ],
                    components: menus.criarPainelFase1(
                        jogadoresInfo,
                        respostas
                    )
                });

                continue;
            }

            // ============================================================
            // FASE 1B — 3º LUGAR / MAIS TROPAS
            // ============================================================
            if (fase === 1 && etapaExtras) {
                if (int.customId === 'sel_terceiro') {
                    respostas.terceiro = int.values[0];
                }

                if (int.customId === 'sel_tropas') {
                    respostas.maisTropas = int.values[0];
                }

                if (int.customId === 'reset_extras') {
                    respostas.terceiro = null;
                    respostas.maisTropas = null;
                }

                if (int.customId === 'btn_confirmar_extras') {
                    if (!respostas.terceiro || !respostas.maisTropas) {
                        await int.reply({
                            content: '❌ Preencha **3º Lugar e Mais Tropas** antes de avançar!',
                            flags: MessageFlags.Ephemeral
                        });
                        continue;
                    }

                    if (
                        respostas.terceiro === respostas.vencedor ||
                        respostas.terceiro === respostas.segundo
                    ) {
                        await int.reply({
                            content: '❌ O 3º lugar precisa ser diferente do vencedor e do 2º lugar.',
                            flags: MessageFlags.Ephemeral
                        });
                        continue;
                    }

                    fase = 2;
                    etapaExtras = false;

                    await int.update({
                        embeds: [
                            gerarPainelAoVivo(
                                respostas,
                                fase,
                                anexoPrintPrincipal,
                                etapaExtras
                            )
                        ],
                        components: [menus.criarBotoesAbate()]
                    });

                    continue;
                }

                await int.update({
                    embeds: [
                        gerarPainelAoVivo(
                            respostas,
                            fase,
                            anexoPrintPrincipal,
                            etapaExtras
                        )
                    ],
                    components: menus.criarPainelFase1Extras(
                        jogadoresInfo,
                        respostas
                    )
                });

                continue;
            }

            // ============================================================
            // FASE 2 — ABATES
            // ============================================================
            if (fase === 2) {
                if (int.customId === 'reset_abates') {
                    respostas.abates = [];
                    jogadoresMortos = [];

                    await int.update({
                        embeds: [
                            gerarPainelAoVivo(
                                respostas,
                                fase,
                                anexoPrintPrincipal
                            )
                        ],
                        components: [menus.criarBotoesAbate()]
                    });

                    continue;
                }

                if (int.customId === 'fim_abates') {
                    fase = 3;

                    await int.update({
                        embeds: [
                            gerarPainelAoVivo(
                                respostas,
                                fase,
                                anexoPrintPrincipal
                            )
                        ],
                        components: [menus.criarBotoesContinente()]
                    });

                    continue;
                }

                if (int.customId === 'add_abate_lote') {
                    await int.update({
                        components: [menus.criarMenuMatador(jogadoresInfo)]
                    });

                    const intMatador = await painelMsg.awaitMessageComponent({
                        filter: i => i.user.id === interaction.user.id,
                        time: 60000
                    }).catch(() => null);

                    if (!intMatador) {
                        await painelMsg.edit({
                            components: [menus.criarBotoesAbate()]
                        });
                        continue;
                    }

                    const matadorId = intMatador.values[0];

                    const assassinosDoMatador = respostas.abates
                        .filter(a => a.vitima === matadorId)
                        .map(a => a.matador);

                    const vitimasValidasInfo = jogadoresInfo.filter(
                        jogador =>
                            jogador.id !== respostas.vencedor &&
                            jogador.id !== respostas.segundo &&
                            jogador.id !== respostas.terceiro &&
                            !jogadoresMortos.includes(jogador.id) &&
                            !assassinosDoMatador.includes(jogador.id) &&
                            jogador.id !== matadorId
                    );

                    if (vitimasValidasInfo.length === 0) {
                        await intMatador.reply({
                            content: '❌ Não há vítimas válidas para este jogador.',
                            flags: MessageFlags.Ephemeral
                        });

                        await painelMsg.edit({
                            components: [menus.criarBotoesAbate()]
                        });

                        continue;
                    }

                    await intMatador.update({
                        components: [
                            menus.criarMenuMultiplasVitimas(
                                vitimasValidasInfo,
                                matadorId
                            )
                        ]
                    });

                    const intVitimas = await painelMsg.awaitMessageComponent({
                        filter: i => i.user.id === interaction.user.id,
                        time: 60000
                    }).catch(() => null);

                    if (!intVitimas) {
                        await painelMsg.edit({
                            components: [menus.criarBotoesAbate()]
                        });
                        continue;
                    }

                    intVitimas.values.forEach(vitimaId => {
                        if (
                            matadorId !== vitimaId &&
                            !jogadoresMortos.includes(vitimaId) &&
                            vitimaId !== respostas.vencedor &&
                            vitimaId !== respostas.segundo &&
                            vitimaId !== respostas.terceiro
                        ) {
                            respostas.abates.push({
                                matador: matadorId,
                                vitima: vitimaId
                            });

                            jogadoresMortos.push(vitimaId);
                        }
                    });

                    await intVitimas.update({
                        embeds: [
                            gerarPainelAoVivo(
                                respostas,
                                fase,
                                anexoPrintPrincipal
                            )
                        ],
                        components: [menus.criarBotoesAbate()]
                    });
                }

                continue;
            }

            // ============================================================
            // FASE 3 — CONTINENTES
            // ============================================================
            if (fase === 3) {
                if (int.customId === 'reset_conts') {
                    respostas.continentes = [];
                    continentesDisp = [...continentesDispTotal];

                    await int.update({
                        embeds: [
                            gerarPainelAoVivo(
                                respostas,
                                fase,
                                anexoPrintPrincipal
                            )
                        ],
                        components: [menus.criarBotoesContinente()]
                    });

                    continue;
                }

                if (int.customId === 'fim_cont') {
                    fase = 4;

                    await int.update({
                        embeds: [
                            gerarPainelAoVivo(
                                respostas,
                                4,
                                anexoPrintPrincipal
                            )
                        ],
                        components: []
                    });

                    break;
                }

                if (int.customId === 'add_cont_lote') {
                    const jogadoresVivosInfo = jogadoresInfo.filter(
                        jogador => !jogadoresMortos.includes(jogador.id)
                    );

                    if (continentesDisp.length === 0) {
                        await int.reply({
                            content: '❌ Todos os continentes já foram registrados!',
                            flags: MessageFlags.Ephemeral
                        });
                        continue;
                    }

                    if (jogadoresVivosInfo.length === 0) {
                        await int.reply({
                            content: '❌ Não há sobreviventes!',
                            flags: MessageFlags.Ephemeral
                        });
                        continue;
                    }

                    await int.update({
                        components: [
                            menus.criarMenuDonoContinente(jogadoresVivosInfo)
                        ]
                    });

                    const intDono = await painelMsg.awaitMessageComponent({
                        filter: i => i.user.id === interaction.user.id,
                        time: 60000
                    }).catch(() => null);

                    if (!intDono) {
                        await painelMsg.edit({
                            components: [menus.criarBotoesContinente()]
                        });
                        continue;
                    }

                    const donoId = intDono.values[0];

                    await intDono.update({
                        components: [
                            menus.criarMenuMultiplosContinentes(
                                continentesDisp
                            )
                        ]
                    });

                    const intConts = await painelMsg.awaitMessageComponent({
                        filter: i => i.user.id === interaction.user.id,
                        time: 60000
                    }).catch(() => null);

                    if (!intConts) {
                        await painelMsg.edit({
                            components: [menus.criarBotoesContinente()]
                        });
                        continue;
                    }

                    intConts.values.forEach(contVal => {
                        if (!respostas.continentes.some(c => c.cont === contVal)) {
                            respostas.continentes.push({
                                cont: contVal,
                                dono: donoId
                            });
                        }
                    });

                    continentesDisp = continentesDisp.filter(
                        continente => !intConts.values.includes(continente.value)
                    );

                    await intConts.update({
                        embeds: [
                            gerarPainelAoVivo(
                                respostas,
                                fase,
                                anexoPrintPrincipal
                            )
                        ],
                        components: [menus.criarBotoesContinente()]
                    });
                }
            }
        }

        // ============================================================
        // TABELA DA PARTIDA
        // ============================================================
        const tabela = {};

        jogadoresBrutos.forEach(jogador => {
            tabela[jogador.id] = {
                pts: 0,
                vitoria: 0,
                wc: 0,
                detalhes: []
            };
        });

        const garantirJogador = id => {
            if (!id) return;

            if (!tabela[id]) {
                tabela[id] = {
                    pts: 0,
                    vitoria: 0,
                    wc: 0,
                    detalhes: []
                };
            }
        };

        // ============================================================
        // VENCEDOR
        // ============================================================
        garantirJogador(respostas.vencedor);

        const ptsVitoria = respostas.modo === 'objetivo'
            ? configPontos.vitoria.objetivo
            : configPontos.vitoria.territorios;

        tabela[respostas.vencedor].pts += ptsVitoria;
        tabela[respostas.vencedor].vitoria = 1;
        tabela[respostas.vencedor].detalhes.push(
            `+${ptsVitoria} Vitória`
        );

        // ============================================================
        // SEGUNDO LUGAR
        // ============================================================
        if (respostas.segundo && respostas.segundo !== '0') {
            garantirJogador(respostas.segundo);

            tabela[respostas.segundo].pts += configPontos.segundoLugar;
            tabela[respostas.segundo].detalhes.push(
                `+${configPontos.segundoLugar} 2º Lugar`
            );
        }

        // ============================================================
        // TERCEIRO LUGAR — NOVO +5
        // ============================================================
        if (respostas.terceiro) {
            garantirJogador(respostas.terceiro);

            const ptsTerceiro = Number(configPontos.terceiroLugar) || 5;

            tabela[respostas.terceiro].pts += ptsTerceiro;
            tabela[respostas.terceiro].detalhes.push(
                `+${ptsTerceiro} 3º Lugar`
            );
        }

        // ============================================================
        // MAIS TROPAS — NOVO +5
        // ============================================================
        if (respostas.maisTropas) {
            garantirJogador(respostas.maisTropas);

            const ptsMaisTropas = Number(configPontos.maisTropas) || 5;

            tabela[respostas.maisTropas].pts += ptsMaisTropas;
            tabela[respostas.maisTropas].detalhes.push(
                `+${ptsMaisTropas} Mais tropas`
            );
        }

        // ============================================================
        // CONTINENTES
        // ============================================================
        respostas.continentes.forEach(continente => {
            garantirJogador(continente.dono);

            const configContinente = configPontos.continentes[continente.cont];
            if (!configContinente) return;

            const ptsCont = Number(configContinente.pontos) || 0;

            tabela[continente.dono].pts += ptsCont;
            tabela[continente.dono].detalhes.push(
                `+${ptsCont} ${configContinente.nome}`
            );
        });

        // ============================================================
        // ABATES
        // ============================================================
        const vitimasIds = [];

        respostas.abates.forEach(abate => {
            garantirJogador(abate.matador);
            garantirJogador(abate.vitima);

            tabela[abate.matador].pts += configPontos.combate.kill;
            tabela[abate.matador].detalhes.push(
                `+${configPontos.combate.kill} Abate`
            );

            tabela[abate.vitima].pts += configPontos.combate.morte;
            tabela[abate.vitima].detalhes.push(
                `${configPontos.combate.morte} Morte`
            );

            if (!vitimasIds.includes(abate.vitima)) {
                vitimasIds.push(abate.vitima);
            }
        });

        // ============================================================
        // SOBREVIVÊNCIA
        // ============================================================
        let logSobreviventes = '';
        const sobreviventesArr = [];

        jogadoresBrutos.forEach(jogador => {
            if (!vitimasIds.includes(jogador.id)) {
                tabela[jogador.id].pts += configPontos.sobrevivencia;
                tabela[jogador.id].detalhes.push(
                    `+${configPontos.sobrevivencia} Sobrevivência`
                );

                sobreviventesArr.push(`<@${jogador.id}>`);
            }
        });

        if (sobreviventesArr.length > 0) {
            logSobreviventes =
                `🛡️ ${sobreviventesArr.join(', ')} (+${configPontos.sobrevivencia} pts)`;
        }

        // ============================================================
        // CARREGAR DADOS
        // ============================================================
        const pontuacao = safeReadJson(pontuacaoPath);
        const economy = safeReadJson(economyPath);
        const partidas = safeReadJson(partidasPath);
        const punicoes = safeReadJson(punicoesPath);
        const carreirasConfig = safeReadJson(carreirasPath);

        const partidasAntesDaAtual = {};

        for (const jogador of jogadoresBrutos) {
            partidasAntesDaAtual[jogador.id] =
                contarPartidasRegistradasDoJogador(
                    partidas,
                    jogador.id
                );
        }

        let resumo = '';
        let avisoDesertorLog = '';
        let avisoForaDaLigaLog = '';

        // ============================================================
        // PROCESSAR JOGADORES
        // ============================================================
        for (const [uid, d] of Object.entries(tabela)) {
            const partidasAntes = Number(partidasAntesDaAtual[uid]) || 0;
            const numeroPartida = partidasAntes + 1;
            const entraNaLiga = numeroPartida <= MAX_PARTIDAS_LIGA;

            d.numeroPartida = numeroPartida;
            d.partidasAntes = partidasAntes;
            d.entraNaLiga = entraNaLiga;

            const punicaoAtiva = punicoes[uid];

            if (punicaoAtiva && punicaoAtiva.nivel === 'desertor') {
                if (Date.now() < punicaoAtiva.expiraEm) {
                    d.pts = 0;
                    d.wc = 0;
                    d.vitoria = 0;

                    avisoDesertorLog += `🏴‍☠️ <@${uid}>\n`;
                    resumo += `🔹 <@${uid}>: **0 pts** *(Punição por Deserção)*\n`;
                    continue;
                }

                delete punicoes[uid];
                safeWriteJson(punicoesPath, punicoes);
            }

            if (!entraNaLiga) {
                const pontosBloqueados = d.pts;
                d.pts = 0;
                d.wc = 0;

                avisoForaDaLigaLog +=
                    `📌 <@${uid}> — **${numeroPartida}ª partida** (fora da pontuação da Liga)\n`;

                if (pontosBloqueados !== 0) {
                    d.detalhes.push(
                        `🚫 ${pontosBloqueados > 0 ? '+' : ''}${pontosBloqueados} pts fora da Liga`
                    );
                }
            }

            if (entraNaLiga) {
                pontuacao[uid] = (Number(pontuacao[uid]) || 0) + d.pts;
            }

            if (d.pts > 0) {
                d.wc = d.pts * 100;
                economy[uid] = (Number(economy[uid]) || 0) + d.wc;
            }

            if (!progressaoData[uid]) {
                const membroBusca = jogadoresBrutos.find(
                    jogador => jogador.id === uid
                );

                progressaoData[uid] = {
                    totalWins: 0,
                    nome: membroBusca ? membroBusca.username : 'Desconhecido'
                };
            }

            if (d.vitoria === 1) {
                progressaoData[uid].totalWins =
                    (Number(progressaoData[uid].totalWins) || 0) + 1;

                progressaoData[uid].vitoriasSemanais =
                    (Number(progressaoData[uid].vitoriasSemanais) || 0) + 1;

                progressaoData[uid].vitoriasMensais =
                    (Number(progressaoData[uid].vitoriasMensais) || 0) + 1;

                if (
                    progressaoData[uid].factionId &&
                    carreirasConfig.faccoes &&
                    carreirasConfig.faccoes[progressaoData[uid].factionId]
                ) {
                    const faccao =
                        carreirasConfig.faccoes[
                            progressaoData[uid].factionId
                        ];

                    let rankCorretoObj = null;

                    for (const rank of faccao.caminho || []) {
                        if (
                            progressaoData[uid].totalWins >=
                            Number(rank.custo)
                        ) {
                            rankCorretoObj = rank;
                        }
                    }

                    if (
                        rankCorretoObj &&
                        progressaoData[uid].currentRankId !== rankCorretoObj.id
                    ) {
                        progressaoData[uid].currentRankId = rankCorretoObj.id;

                        try {
                            const memberDiscord = await interaction.guild.members
                                .fetch(uid)
                                .catch(() => null);

                            if (memberDiscord) {
                                const cargoAlvo = memberDiscord.guild.roles.cache.get(
                                    rankCorretoObj.id
                                );

                                if (cargoAlvo) {
                                    if (
                                        memberDiscord.roles.highest.position <
                                        cargoAlvo.position
                                    ) {
                                        console.warn(
                                            `[LIGA] Não foi possível promover ${uid}: cargo do jogador está acima/igual ao cargo de destino.`
                                        );
                                    } else {
                                        await memberDiscord.roles
                                            .add(rankCorretoObj.id)
                                            .catch(erro =>
                                                console.error(
                                                    '[LIGA] Erro ao adicionar patente:',
                                                    erro
                                                )
                                            );
                                    }
                                } else {
                                    console.warn(
                                        `[LIGA] Cargo de patente não encontrado: ${rankCorretoObj.id}`
                                    );
                                }

                                for (const r of faccao.caminho || []) {
                                    if (
                                        r.id !== rankCorretoObj.id &&
                                        memberDiscord.roles.cache.has(r.id)
                                    ) {
                                        await memberDiscord.roles
                                            .remove(r.id)
                                            .catch(erro =>
                                                console.error(
                                                    '[LIGA] Erro ao remover patente anterior:',
                                                    erro
                                                )
                                            );
                                    }
                                }
                            }
                        } catch (erro) {
                            console.error(
                                '[LIGA] Erro ao atualizar patente:',
                                erro
                            );
                        }
                    }
                }
            }

            const textoDetalhes = d.detalhes.length > 0
                ? ` *(${d.detalhes.join(', ')})*`
                : '';

            if (!entraNaLiga) {
                resumo +=
                    `🔹 <@${uid}>: **0 pts Liga** ` +
                    `*(partida ${numeroPartida} fora da disputa)*` +
                    `${textoDetalhes}\n`;
            } else {
                resumo +=
                    `🔹 <@${uid}>: **${d.pts > 0 ? '+' : ''}${d.pts} pts**` +
                    `${textoDetalhes}\n`;
            }
        }

        // ============================================================
        // PARTIDAS SEMANAIS / HISTÓRICO
        // ============================================================
        jogadoresBrutos.forEach(jogador => {
            if (!progressaoData[jogador.id]) {
                progressaoData[jogador.id] = {
                    totalWins: 0,
                    nome: jogador.username
                };
            }

            progressaoData[jogador.id].partidasSemanais =
                (Number(progressaoData[jogador.id].partidasSemanais) || 0) + 1;

            progressaoData[jogador.id].partidasLigaTotal =
                (Number(progressaoData[jogador.id].partidasLigaTotal) || 0) + 1;

            const contadorAnterior =
                Number(progressaoData[jogador.id].partidasConsideradasLiga) || 0;

            if (contadorAnterior < MAX_PARTIDAS_LIGA) {
                progressaoData[jogador.id].partidasConsideradasLiga =
                    Math.min(MAX_PARTIDAS_LIGA, contadorAnterior + 1);
            }
        });

        // KILLS / MORTES
        respostas.abates.forEach(abate => {
            if (progressaoData[abate.matador]) {
                progressaoData[abate.matador].killsSemanais =
                    (Number(progressaoData[abate.matador].killsSemanais) || 0) + 1;
            }

            if (progressaoData[abate.vitima]) {
                progressaoData[abate.vitima].mortesSemanais =
                    (Number(progressaoData[abate.vitima].mortesSemanais) || 0) + 1;
            }
        });

        // CONTINENTES
        respostas.continentes.forEach(continente => {
            if (progressaoData[continente.dono]) {
                const chave = `${continente.cont}Semanal`;

                progressaoData[continente.dono][chave] =
                    (Number(progressaoData[continente.dono][chave]) || 0) + 1;
            }
        });

        // SALVAR DADOS PRINCIPAIS
        safeWriteJson(punicoesPath, punicoes);
        safeWriteJson(pontuacaoPath, pontuacao);
        safeWriteJson(economyPath, economy);
        safeWriteJson(progressaoPath, progressaoData);

        // ============================================================
        // LOG DE ABATES
        // ============================================================
        let logAbates = '';

        if (respostas.abates.length > 0) {
            const agrupados = {};

            respostas.abates.forEach(abate => {
                if (!agrupados[abate.matador]) agrupados[abate.matador] = [];
                agrupados[abate.matador].push(`<@${abate.vitima}>`);
            });

            logAbates = Object.entries(agrupados)
                .map(
                    ([matador, vitimas]) =>
                        `⚔️ <@${matador}> eliminou: ${vitimas.join(', ')}`
                )
                .join('\n');
        }

        // ============================================================
        // LOG DE CONTINENTES
        // ============================================================
        let logContinentes = '';

        if (respostas.continentes.length > 0) {
            const agrupados = {};

            respostas.continentes.forEach(continente => {
                if (!agrupados[continente.dono]) agrupados[continente.dono] = [];

                const infoContinente =
                    configPontos.continentes[continente.cont];

                agrupados[continente.dono].push(
                    `**${infoContinente?.nome || continente.cont}**`
                );
            });

            logContinentes = Object.entries(agrupados)
                .map(
                    ([dono, conts]) =>
                        `🌍 <@${dono}> dominou: ${conts.join(', ')}`
                )
                .join('\n');
        }

        if (avisoForaDaLigaLog) {
            resumo +=
                `\n📌 **FORA DA DISPUTA DA LIGA — LIMITE DE ${MAX_PARTIDAS_LIGA} PARTIDAS**\n` +
                avisoForaDaLigaLog;
        }

        // ============================================================
        // DOWNLOAD DOS PRINTS
        // ============================================================
        if (!fs.existsSync(tempPrintsDir)) {
            fs.mkdirSync(tempPrintsDir, { recursive: true });
        }

        const arquivosLocais = [];
        let indexArquivo = 0;

        for (const urlImg of anexosUrls) {
            const nomeArquivoLocal =
                `print_${Date.now()}_${indexArquivo}.png`;

            const caminhoLocal =
                path.join(tempPrintsDir, nomeArquivoLocal);

            try {
                const response = await fetch(urlImg);
                const buffer = await response.arrayBuffer();

                fs.writeFileSync(
                    caminhoLocal,
                    Buffer.from(buffer)
                );

                arquivosLocais.push({
                    attachment: caminhoLocal,
                    name: nomeArquivoLocal
                });
            } catch (erro) {
                console.error(
                    'Erro ao baixar anexo:',
                    erro
                );
            }

            indexArquivo++;
        }

        // ============================================================
        // EMBED FINAL
        // ============================================================
        const embedFinal = new EmbedBuilder()
            .setTitle('🏆 LIGA DAS NAÇÕES — RESULTADO REGISTRADO')
            .setColor('#0a4d5c')
            .setDescription(
                `Partida contabilizada por ${interaction.user}.`
            );

        if (arquivosLocais.length > 0) {
            embedFinal.setImage(
                `attachment://${arquivosLocais[0].name}`
            );
        }

        const modoIcone = respostas.modo === 'objetivo'
            ? '🎯 Objetivo'
            : '🌎 Territórios';

        embedFinal.addFields(
            {
                name: '🥇 VENCEDOR',
                value:
                    `<@${respostas.vencedor}> — **[ ${modoIcone} ]**`,
                inline: false
            },
            {
                name: '🥈 2º LUGAR',
                value:
                    respostas.segundo !== '0'
                        ? `<@${respostas.segundo}>`
                        : 'Nenhum',
                inline: false
            },
            {
                name: '🥉 3º LUGAR',
                value: `<@${respostas.terceiro}> — **+${Number(configPontos.terceiroLugar) || 5} pts**`,
                inline: true
            },
            {
                name: '⚔️ MAIS TROPAS',
                value: `<@${respostas.maisTropas}> — **+${Number(configPontos.maisTropas) || 5} pts**`,
                inline: true
            }
        );

        if (logContinentes) {
            embedFinal.addFields({
                name: '🗺️ DOMÍNIOS',
                value: logContinentes,
                inline: false
            });
        }

        if (logAbates) {
            embedFinal.addFields({
                name: '⚔️ COMBATES',
                value: logAbates,
                inline: false
            });
        }

        if (logSobreviventes) {
            embedFinal.addFields({
                name: '🛡️ SOBREVIVENTES',
                value: logSobreviventes,
                inline: false
            });
        }

        if (avisoDesertorLog) {
            embedFinal.addFields({
                name: '🏴‍☠️ PUNIÇÕES ATIVAS',
                value: avisoDesertorLog,
                inline: false
            });
        }

        if (avisoForaDaLigaLog) {
            embedFinal.addFields({
                name: '📌 PARTIDAS FORA DA DISPUTA',
                value: avisoForaDaLigaLog,
                inline: false
            });
        }

        embedFinal.addFields({
            name: '📊 EXTRATO FINAL',
            value: resumo,
            inline: false
        });

        const canalRes = await interaction.guild.channels
            .fetch('1071976981924687912')
            .catch(() => interaction.channel);

        const msgRes = await canalRes.send({
            embeds: [embedFinal],
            files: arquivosLocais
        });

        setTimeout(() => {
            arquivosLocais.forEach(arquivo => {
                if (fs.existsSync(arquivo.attachment)) {
                    fs.unlinkSync(arquivo.attachment);
                }
            });
        }, 5000);

        const btnReverter = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`edit_match_${msgRes.id}`)
                .setLabel('Editar / Anular')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⏪')
        );

        await msgRes.edit({
            components: [btnReverter]
        });

        // ============================================================
        // SALVAR PARTIDA
        // ============================================================
        partidas[msgRes.id] = {
            adminId: interaction.user.id,
            respostas,
            jogadoresBrutos: jogadoresBrutos.map(jogador => ({
                id: jogador.id,
                username: jogador.username
            })),
            pontos: Object.fromEntries(
                Object.entries(tabela).map(
                    ([idJogador, valor]) => ({
                        [idJogador]: {
                            ptsLiga: valor.pts,
                            entraNaLiga: valor.entraNaLiga,
                            numeroPartida: valor.numeroPartida,
                            wcRecebido: valor.wc,
                            vitoria: valor.vitoria
                        }
                    })
                )
            ),
            meta: {
                limiteLiga: MAX_PARTIDAS_LIGA,
                registradaEm: Date.now()
            }
        };

        safeWriteJson(partidasPath, partidas);

        try {
            await painelMod(
                interaction.guild,
                '1429504377395351854'
            );
        } catch (erro) {
            console.error(
                'Erro ao atualizar o painel principal:',
                erro
            );
        }

        await topico.send(
            '✅ **Pronto!** A partida foi salva no ' +
            '<#1071976981924687912> e o painel foi atualizado. ' +
            'Este tópico se **autodestruirá** em 5 segundos.'
        );

        setTimeout(async () => {
            await topico.delete().catch(() => {});
        }, 5000);
    } catch (erro) {
        console.error(
            '[LIGA] Erro no registro da partida:',
            erro
        );
    }
};