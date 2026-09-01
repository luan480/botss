/* ========================================================================
   ARQUIVO: commands/liga/utils/menusLiga.js
   DESCRIÇÃO: Menus da Liga das Nações
   ======================================================================== */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');

module.exports = {
    // ==========================================
    // ⚡ FASE 1: MODO + VENCEDOR + 2º LUGAR
    // ==========================================
    criarPainelFase1: (jogadoresInfo, respostas) => {
        const rowModo = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('sel_modo')
                .setPlaceholder('⚙️ 1. Selecione o Modo de Jogo...')
                .addOptions([
                    {
                        label: 'Objetivo',
                        value: 'objetivo',
                        description: 'Vitória por carta de objetivo',
                        emoji: '🎯',
                        default: respostas.modo === 'objetivo'
                    },
                    {
                        label: 'Territórios',
                        value: 'territorios',
                        description: 'Vitória por dominação global',
                        emoji: '🌎',
                        default: respostas.modo === 'territorios'
                    }
                ])
        );

        const rowVencedor = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('sel_venc')
                .setPlaceholder('🥇 2. Selecione o Vencedor...')
                .addOptions(
                    jogadoresInfo.map(j => ({
                        label: j.label,
                        value: j.id,
                        default: respostas.vencedor === j.id
                    }))
                )
        );

        const opcoesSegundo = [
            {
                label: 'Nenhum / Não houve',
                value: '0',
                default: respostas.segundo === '0'
            }
        ];

        jogadoresInfo.forEach(j => {
            if (j.id !== respostas.vencedor) {
                opcoesSegundo.push({
                    label: j.label,
                    value: j.id,
                    default: respostas.segundo === j.id
                });
            }
        });

        const rowSegundo = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('sel_seg')
                .setPlaceholder('🥈 3. Selecione o 2º Lugar...')
                .addOptions(opcoesSegundo)
        );

        const rowBotoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_confirmar_p1')
                .setLabel('Continuar ➔')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('reset_p1')
                .setLabel('Limpar')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary)
        );

        return [rowModo, rowVencedor, rowSegundo, rowBotoes];
    },

    // ==========================================
    // 🏅 FASE 1B: 3º LUGAR + MAIS TROPAS
    // ==========================================
    criarPainelFase1Extras: (jogadoresInfo, respostas) => {
        const opcoesTerceiro = jogadoresInfo
            .filter(j => j.id !== respostas.vencedor && j.id !== respostas.segundo)
            .map(j => ({
                label: j.label,
                value: j.id,
                default: respostas.terceiro === j.id
            }));

        const rowTerceiro = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('sel_terceiro')
                .setPlaceholder('🥉 4. Quem ficou em 3º lugar?')
                .addOptions(opcoesTerceiro)
        );

        const rowTropas = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('sel_tropas')
                .setPlaceholder('⚔️ 5. Quem terminou com mais tropas?')
                .addOptions(
                    jogadoresInfo.map(j => ({
                        label: j.label,
                        value: j.id,
                        default: respostas.maisTropas === j.id
                    }))
                )
        );

        const rowBotoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_confirmar_extras')
                .setLabel('Continuar para Abates ➔')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('reset_extras')
                .setLabel('Limpar')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary)
        );

        return [rowTerceiro, rowTropas, rowBotoes];
    },

    // ==========================================
    // ⚔️ FASE 2: MENUS DE ABATES
    // ==========================================
    criarBotoesAbate: () => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('add_abate_lote')
                .setLabel('Registrar Matador')
                .setEmoji('🔪')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('reset_abates')
                .setLabel('Desfazer Abates')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('fim_abates')
                .setLabel('Avançar')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
        );
    },

    criarMenuMatador: jogadoresInfo => {
        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('sel_matador_lote')
                .setPlaceholder('🔫 Selecione QUEM MATOU...')
                .addOptions(
                    jogadoresInfo.map(j => ({
                        label: j.label,
                        value: j.id
                    }))
                )
        );
    },

    criarMenuMultiplasVitimas: (jogadoresValidosInfo, matadorId) => {
        const opcoes = jogadoresValidosInfo
            .filter(j => j.id !== matadorId)
            .map(j => ({
                label: j.label,
                value: j.id,
                description: 'Marcar como eliminado na partida'
            }));

        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('sel_vitimas_lote')
                .setPlaceholder('💀 Selecione AS VÍTIMAS...')
                .setMinValues(1)
                .setMaxValues(opcoes.length > 0 ? opcoes.length : 1)
                .addOptions(
                    opcoes.length > 0
                        ? opcoes
                        : [{ label: 'Nenhuma vítima válida', value: '0' }]
                )
        );
    },

    // ==========================================
    // 🗺️ FASE 3: MENUS DE CONTINENTES
    // ==========================================
    criarBotoesContinente: () => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('add_cont_lote')
                .setLabel('Registrar Domínio')
                .setEmoji('🗺️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('reset_conts')
                .setLabel('Desfazer Continentes')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('fim_cont')
                .setLabel('Finalizar Partida')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success)
        );
    },

    criarMenuDonoContinente: jogadoresVivosInfo => {
        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('sel_dono_cont_lote')
                .setPlaceholder('🚩 Selecione quem dominou...')
                .addOptions(
                    jogadoresVivosInfo.map(j => ({
                        label: j.label,
                        value: j.id,
                        description: 'Apenas jogadores vivos aparecem aqui'
                    }))
                )
        );
    },

    criarMenuMultiplosContinentes: continentesDisp => {
        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('sel_conts_lote')
                .setPlaceholder('🌍 Selecione os continentes...')
                .setMinValues(1)
                .setMaxValues(continentesDisp.length)
                .addOptions(continentesDisp)
        );
    }
};