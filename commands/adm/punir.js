/* ========================================================================
   ARQUIVO: commands/adm/punir.js
   DESCRIÇÃO: Tribunal Militar • Sanções, Perda de Pontos e Progressão de Warns
   ======================================================================== */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
const { isStaff, isMod } = require('../utils/staffPermissions.js');

const punicoesPath = path.join(__dirname, '..', 'liga', 'punicoes.json');
const pontuacaoPath = path.join(__dirname, '..', 'liga', 'pontuacao.json');
const ID_CANAL_SENTENCAS = '1428490457478070364';
const ID_CARGO_WARN_1 = '1536753214005846016';
const ID_CARGO_WARN_2 = '1536753377931698257';
const ID_CARGO_WARN_3 = '1536753460350029914';
const TEMPOS_PROGRESSIVOS = [60 * 60 * 1000, 2 * 60 * 60 * 1000, 4 * 60 * 60 * 1000, 8 * 60 * 60 * 1000];
const PONTOS_PROGRESSIVOS = [20, 40, 80, 160];
const TRES_MESES_MS = 90 * 24 * 60 * 60 * 1000;

function calcularSanacao(d) {
    if (d.ultimaPunicao && Date.now() - d.ultimaPunicao > TRES_MESES_MS) {
        d.mutes = 0;
        d.castigos = 0;
    }
    return d;
}

function formatarTempoMs(ms) {
    return `${ms / (60 * 60 * 1000)} Hora(s)`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('punir')
        .setDescription('⚖️ [STAFF] Aplica sanções com progressão de tempo, pontos e Cargos de Warn.')
        .addUserOption(opt => opt.setName('alvo').setDescription('O soldado envolvido').setRequired(true))
        .addStringOption(opt => opt.setName('tipo').setDescription('Tipo de sanção disciplinar').setRequired(true).addChoices(
            { name: 'Silenciar (Mute progressivo + Warn 1 ou progressão)', value: 'silenciar' },
            { name: 'Castigo (Timeout progressivo + Warn 2/3)', value: 'castigo' },
            { name: 'Exílio Absoluto (Banimento - Apenas Mod/Adm)', value: 'ban' }
        ))
        .addStringOption(opt => opt.setName('motivo').setDescription('Justificativa militar detalhada da punição').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (!isStaff(interaction.member)) {
            return interaction.editReply('❌ Apenas membros da equipe (Staff, Suporte, Mod ou ADM) podem operar o Tribunal Militar.');
        }

        const alvo = interaction.options.getUser('alvo');
        const tipo = interaction.options.getString('tipo');
        const justificativa = interaction.options.getString('motivo');
        const membro = await interaction.guild.members.fetch(alvo.id).catch(() => null);

        if (!membro) return interaction.editReply('❌ Soldado não encontrado neste servidor.');
        if (membro.id === interaction.member.id) return interaction.editReply('❌ Você não pode aplicar uma sanção em si mesmo.');
        if (membro.id === interaction.guild.ownerId) return interaction.editReply('❌ O dono do servidor não pode ser punido por este comando.');
        if (membro.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.editReply('❌ Você não pode punir alguém com cargo igual ou superior ao seu.');
        }
        if (membro.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.editReply('❌ Meu cargo precisa estar acima do cargo do alvo para aplicar esta punição.');
        }

        if (tipo === 'ban' && !isMod(interaction.member)) {
            return interaction.editReply('❌ **Acesso Negado:** apenas Moderadores e Administradores podem executar Exílio Absoluto.');
        }

        const punicoes = safeReadJson(punicoesPath);
        if (!punicoes[alvo.id]) punicoes[alvo.id] = { mutes: 0, castigos: 0, ultimaPunicao: null };
        calcularSanacao(punicoes[alvo.id]);

        let corEmbed = '#3498DB';
        let tituloSentenca = '';
        let descricaoPena = '';
        let duracaoTexto = 'N/A';
        let pontosPerdidos = 0;
        let cargoAtribuidoTexto = 'Nenhum';
        const pontuacao = safeReadJson(pontuacaoPath) || {};
        const removerCargosWarn = async () => {
            await membro.roles.remove([ID_CARGO_WARN_1, ID_CARGO_WARN_2, ID_CARGO_WARN_3]);
        };

        try {
            if (tipo === 'silenciar') {
                const i = Math.min(punicoes[alvo.id].mutes, TEMPOS_PROGRESSIVOS.length - 1);
                const ms = TEMPOS_PROGRESSIVOS[i];
                duracaoTexto = formatarTempoMs(ms);
                pontosPerdidos = PONTOS_PROGRESSIVOS[i];
                punicoes[alvo.id].mutes++;
                punicoes[alvo.id].ultimaPunicao = Date.now();
                corEmbed = '#F1C40F';
                tituloSentenca = '🔇 TRIBUNAL MILITAR • SENTENÇA DE SILENCIAMENTO';
                await membro.timeout(ms, `Silenciado: ${justificativa}`);
                await removerCargosWarn();
                let cargo = ID_CARGO_WARN_1;
                cargoAtribuidoTexto = `<@&${ID_CARGO_WARN_1}>`;
                if (punicoes[alvo.id].mutes >= 3) { cargo = ID_CARGO_WARN_3; cargoAtribuidoTexto = `<@&${ID_CARGO_WARN_3}> (Nível Crítico)`; }
                else if (punicoes[alvo.id].mutes === 2) { cargo = ID_CARGO_WARN_2; cargoAtribuidoTexto = `<@&${ID_CARGO_WARN_2}>`; }
                await membro.roles.add(cargo);
                descricaoPena = `⚠️ **Sanção Aplicada (Silenciamento).**\n• Duração: **${duracaoTexto}** (Infração #${punicoes[alvo.id].mutes})\n• Penalidade: Perda de **${pontosPerdidos} pontos** na Liga.\n• Condecoração/Warn: ${cargoAtribuidoTexto}`;
            } else if (tipo === 'castigo') {
                const i = Math.min(punicoes[alvo.id].castigos, TEMPOS_PROGRESSIVOS.length - 1);
                const ms = TEMPOS_PROGRESSIVOS[i];
                duracaoTexto = formatarTempoMs(ms);
                pontosPerdidos = PONTOS_PROGRESSIVOS[i];
                punicoes[alvo.id].castigos++;
                punicoes[alvo.id].ultimaPunicao = Date.now();
                corEmbed = '#E67E22';
                tituloSentenca = '⏳ TRIBUNAL MILITAR • SENTENÇA DE CASTIGO';
                await membro.timeout(ms, `Castigo: ${justificativa}`);
                await removerCargosWarn();
                let cargo = ID_CARGO_WARN_2;
                cargoAtribuidoTexto = `<@&${ID_CARGO_WARN_2}>`;
                if (punicoes[alvo.id].castigos >= 2 || i >= 2) { cargo = ID_CARGO_WARN_3; cargoAtribuidoTexto = `<@&${ID_CARGO_WARN_3}> (⚠️ Alerta Máximo para Exílio)`; }
                await membro.roles.add(cargo);
                descricaoPena = `⏳ **Sanção Aplicada (Castigo).**\n• Duração: **${duracaoTexto}** (Castigo #${punicoes[alvo.id].castigos})\n• Penalidade: Perda de **${pontosPerdidos} pontos** na Liga.\n• Condecoração/Warn: ${cargoAtribuidoTexto}`;
            } else if (tipo === 'ban') {
                corEmbed = '#000000';
                tituloSentenca = '💀 TRIBUNAL MILITAR • EXÍLIO ABSOLUTO';
                duracaoTexto = 'Permanente';
                pontosPerdidos = 160;
                await membro.ban({ reason: justificativa });
                descricaoPena = '💀 **Exílio Executado.** O soldado foi desonrado e banido permanentemente do quartel por quebra grave da lei militar.';
            } else return interaction.editReply('❌ Tipo de punição inválido.');

            if (pontosPerdidos > 0) {
                const atuais = Number(pontuacao[alvo.id]) || 0;
                // Penalidade pode deixar o jogador negativo: o ranking deve refletir a punição.
                pontuacao[alvo.id] = atuais - pontosPerdidos;
                if (!safeWriteJson(pontuacaoPath, pontuacao)) throw new Error('Não foi possível salvar a pontuação da Liga.');
            }
            if (!safeWriteJson(punicoesPath, punicoes)) throw new Error('Não foi possível salvar o registro da punição.');
        } catch (error) {
            console.error('[PUNIR] Falha ao aplicar sanção:', error);
            return interaction.editReply(`❌ Não foi possível concluir a punição. Verifique as permissões do bot e a hierarquia dos cargos.\n\`${error.message?.slice(0, 300) || 'erro desconhecido'}\``);
        }

        const embed = new EmbedBuilder()
            .setTitle(tituloSentenca).setColor(corEmbed).setThumbnail(alvo.displayAvatarURL())
            .addFields(
                { name: '🛡️ Réu (Soldado)', value: `${alvo} (\`${alvo.username}\`)`, inline: true },
                { name: '👮 Relator (Staff)', value: `${interaction.user}`, inline: true },
                { name: '⌛ Prazo / Duração', value: `\`${duracaoTexto}\``, inline: true },
                { name: '📋 Justificativa Oficial', value: `> ${justificativa}`, inline: false },
                { name: '⚖️ Veredito Corregedoria', value: descricaoPena, inline: false }
            ).setFooter({ text: 'WorldWarBR • Corregedoria Geral (Warns Automáticos)' }).setTimestamp();

        try {
            const dm = new EmbedBuilder().setTitle(tituloSentenca).setColor(corEmbed)
                .setDescription(`Você recebeu uma sanção oficial no servidor **${interaction.guild.name}**.\n\n**Detalhes:**`)
                .addFields({ name: '📋 Justificativa', value: `> ${justificativa}`, inline: false }, { name: '⚖️ Veredito', value: descricaoPena, inline: false }).setTimestamp();
            await alvo.send({ embeds: [dm] });
        } catch {}

        const canal = await interaction.guild.channels.fetch(ID_CANAL_SENTENCAS).catch(() => null);
        if (canal) await canal.send({ embeds: [embed] }).catch(error => console.error('[PUNIR] Falha ao publicar boletim:', error));
        await interaction.editReply(`✅ Punição aplicada, **${pontosPerdidos} pontos** descontados e cargos de warn atualizados.`);
    }
};
