/* ========================================================================
   ARQUIVO: commands/liga/painel.js

   PAINEL PRINCIPAL DA LIGA

   BOTÕES:
   ▶️ Contabilizar
   🏆 Ver Ranking
   📊 Estatísticas
   📖 Guia da Liga
   ======================================================================== */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} = require('discord.js');

const fs =
    require('fs');

const path =
    require('path');

const {
    safeReadJson
} =
    require('./utils/helpers.js');


const pontuacaoPath =
    path.join(
        __dirname,
        'pontuacao.json'
    );


const painelPath =
    path.join(
        __dirname,
        'painel.json'
    );


module.exports =
    async function criarPainelDashboard(
        guild,
        canalId
    ) {

        if (
            !guild
        ) {

            throw new Error(
                'Guild não informada.'
            );

        }


        if (
            !canalId
        ) {

            throw new Error(
                'Canal não informado.'
            );

        }


        const canal =
            await guild.channels
                .fetch(
                    canalId
                )
                .catch(
                    () => null
                );


        if (
            !canal
        ) {

            throw new Error(
                `Canal ${canalId} não encontrado.`
            );

        }


        if (
            !canal.isTextBased()
        ) {

            throw new Error(
                'O canal informado não é de texto.'
            );

        }


        const pontuacoes =
            safeReadJson(
                pontuacaoPath
            ) || {};


        const ranking =
            Object.entries(
                pontuacoes
            )

                .map(
                    ([id, pontos]) => ({

                        id,

                        pontos:
                            Number(
                                pontos
                            ) || 0

                    })
                )

                .sort(
                    (a, b) =>
                        b.pontos -
                        a.pontos
                );


        const top1 =
            ranking[0]

                ? `<@${ranking[0].id}> — **${ranking[0].pontos} pts**`

                : '⏳ *Vago*';


        const top2 =
            ranking[1]

                ? `<@${ranking[1].id}> — **${ranking[1].pontos} pts**`

                : '⏳ *Vago*';


        const top3 =
            ranking[2]

                ? `<@${ranking[2].id}> — **${ranking[2].pontos} pts**`

                : '⏳ *Vago*';


        const containerPainel =
            new ContainerBuilder()

                .setAccentColor(
                    0x9B59B6
                )

                .addTextDisplayComponents(

                    new TextDisplayBuilder()
                        .setContent(

                            `### 🏆 LIGA DAS NAÇÕES 🏆\n` +
                            `🔥 **A Liga War Grow está ativa!**`

                        )

                )

                .addSeparatorComponents(

                    new SeparatorBuilder()
                        .setDivider(
                            true
                        )
                        .setSpacing(
                            SeparatorSpacingSize.Small
                        )

                )

                .addTextDisplayComponents(

                    new TextDisplayBuilder()
                        .setContent(

                            `📆 **Início:** 01/08 — **Fim:** 31/08\n` +
                            `⚔️ **Só os fortes sobrevivem!**\n\n` +
                            `__**PREMIAÇÃO:**__\n` +
                            `🥇 **1º Lugar:** R$ 30,00 + <@&1429934221216186458>\n` +
                            `🥈 **2º Lugar:** R$ 20,00 + <@&938174095470772305>\n` +
                            `🥉 **3º Lugar:** <@&938174095470772305>`

                        )

                )

                .addSeparatorComponents(

                    new SeparatorBuilder()
                        .setDivider(
                            true
                        )
                        .setSpacing(
                            SeparatorSpacingSize.Small
                        )

                )

                .addTextDisplayComponents(

                    new TextDisplayBuilder()
                        .setContent(

                            `📈 **TOP 3 ATUAL — TEMPO REAL**\n\n` +
                            `🥇 ${top1}\n` +
                            `🥈 ${top2}\n` +
                            `🥉 ${top3}`

                        )

                )

                .addSeparatorComponents(

                    new SeparatorBuilder()
                        .setDivider(
                            true
                        )
                        .setSpacing(
                            SeparatorSpacingSize.Small
                        )

                )

                .addMediaGalleryComponents(

                    new MediaGalleryBuilder()
                        .addItems(

                            new MediaGalleryItemBuilder()
                                .setURL(
                                    'https://cdn.discordapp.com/attachments/1082774011676729365/1283426407313182803/WAR.gif'
                                )

                        )

                )

                .addTextDisplayComponents(

                    new TextDisplayBuilder()
                        .setContent(
                            `📖 **GUIA DA LIGA:** ` +
                            `regras, como registrar partidas, perguntas frequentes e pontuação.`
                        )

                );


        const row =
            new ActionRowBuilder()
                .addComponents(

                    new ButtonBuilder()
                        .setCustomId('iniciar_contabilizacao')
                        .setLabel('Contabilizar')
                        .setEmoji('▶️')
                        .setStyle(ButtonStyle.Primary),

                    new ButtonBuilder()
                        .setCustomId('ver_ranking')
                        .setLabel('Ver Ranking')
                        .setEmoji('🏆')
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId('estatisticas_selecionar')
                        .setLabel('Estatísticas')
                        .setEmoji('📊')
                        .setStyle(ButtonStyle.Primary),

                    new ButtonBuilder()
                        .setCustomId('liga_guia')
                        .setLabel('Guia da Liga')
                        .setEmoji('📖')
                        .setStyle(ButtonStyle.Secondary)

                );


        const painelData =
            safeReadJson(
                painelPath
            );


        let painelMsg =
            null;


        if (
            painelData?.messageId
        ) {

            painelMsg =
                await canal.messages
                    .fetch(
                        painelData.messageId
                    )
                    .catch(
                        () => null
                    );

        }


        if (
            painelMsg
        ) {

            await painelMsg.edit({
                flags: MessageFlags.IsComponentsV2,
                components: [
                    containerPainel,
                    row
                ]
            });

            console.log(
                '[Painel] Painel da Liga atualizado.'
            );

            return painelMsg;

        }


        const novaMensagem =
            await canal.send({
                flags: MessageFlags.IsComponentsV2,
                components: [
                    containerPainel,
                    row
                ]
            });


        fs.writeFileSync(
            painelPath,
            JSON.stringify(
                {
                    messageId:
                        novaMensagem.id
                },
                null,
                2
            )
        );


        console.log(
            '[Painel] Novo painel da Liga criado.'
        );


        return novaMensagem;

    };