const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
const { isStaff } = require('../utils/staffPermissions.js');

const punicoesPath = path.join(__dirname, '..', 'liga', 'punicoes.json');
const ID_CANAL_SENTENCAS = '1428490457478070364';
const ID_CARGO_WARN_1 = '1536753214005846016';
const ID_CARGO_WARN_2 = '1536753377931698257';
const ID_CARGO_WARN_3 = '1536753460350029914';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('absolver')
        .setDescription('🕊️ [STAFF] Declara denúncia improcedente ou limpa a ficha do réu.')
        .addUserOption(opt => opt.setName('alvo').setDescription('O soldado envolvido').setRequired(true))
        .addStringOption(opt => opt.setName('tipo_absoluicao').setDescription('Escolha o tipo').setRequired(true).addChoices(
            { name: 'Inocente nesta denúncia', value: 'pontual' },
            { name: 'Limpeza Total de Ficha', value: 'geral' }
        ))
        .addStringOption(opt => opt.setName('parecer').setDescription('Justifique a absolvição').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (!isStaff(interaction.member)) {
            return interaction.editReply('❌ Apenas Staff, Suporte, Mod ou ADM podem emitir termos de absolvição.');
        }

        const alvo = interaction.options.getUser('alvo');
        const tipoAbsolucao = interaction.options.getString('tipo_absoluicao');
        const parecer = interaction.options.getString('parecer');
        const punicoes = safeReadJson(punicoesPath);
        if (!punicoes[alvo.id]) punicoes[alvo.id] = { mutes: 0, castigos: 0, ultimaPunicao: null };

        const membro = await interaction.guild.members.fetch(alvo.id).catch(() => null);
        if (!membro) return interaction.editReply('❌ Soldado não encontrado neste servidor.');
        if (membro.id === interaction.member.id) return interaction.editReply('❌ Você não pode absolver a si mesmo.');
        if (membro.id === interaction.guild.ownerId) return interaction.editReply('❌ O dono do servidor não pode ser alterado por este comando.');
        if (membro.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.editReply('❌ Você não pode alterar a ficha de alguém com cargo igual ou superior ao seu.');
        }
        if (membro.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.editReply('❌ Meu cargo precisa estar acima do cargo do alvo para remover o timeout/cargos.');
        }

        try {
            if (tipoAbsolucao === 'geral') {
                punicoes[alvo.id].mutes = 0;
                punicoes[alvo.id].castigos = 0;
                punicoes[alvo.id].ultimaPunicao = null;
                await membro.roles.remove([ID_CARGO_WARN_1, ID_CARGO_WARN_2, ID_CARGO_WARN_3]);
            }

            if (membro.communicationDisabledUntilTimestamp > Date.now()) {
                await membro.timeout(null, 'Absolvido pelo Tribunal Militar');
            }

            safeWriteJson(punicoesPath, punicoes);
        } catch (error) {
            console.error('[ABSOLVER] Falha ao concluir absolvição:', error);
            return interaction.editReply(`❌ Não foi possível concluir a absolvição. Verifique a hierarquia/permissões do bot.\n\`${error.message?.slice(0, 300) || 'erro desconhecido'}\``);
        }

        const descricaoVeredito = tipoAbsolucao === 'geral'
            ? '🕊️ **Anistia Concedida.** Todas as punições anteriores foram anuladas, a ficha foi resetada e os cargos de Warn foram removidos.'
            : '🕊️ **Denúncia Improcedente.** O soldado foi considerado inocente nesta acusação.';

        const embed = new EmbedBuilder()
            .setTitle('🕊️ TRIBUNAL MILITAR • BOLETIM DE ABSOLVIÇÃO')
            .setColor('#2ECC71')
            .setThumbnail(alvo.displayAvatarURL())
            .addFields(
                { name: '🛡️ Envolvido', value: `${alvo} (\`${alvo.username}\`)`, inline: true },
                { name: '👮 Relator', value: `${interaction.user}`, inline: true },
                { name: '📋 Parecer', value: `> ${parecer}`, inline: false },
                { name: '⚖️ Veredito', value: descricaoVeredito, inline: false }
            )
            .setFooter({ text: 'WorldWarBR • A justiça militar zela pela verdade.' })
            .setTimestamp();

        try {
            await alvo.send({ embeds: [new EmbedBuilder().setTitle('🕊️ VOCÊ FOI ABSOLVIDO').setColor('#2ECC71').setDescription(`O Tribunal Militar analisou seu caso em **${interaction.guild.name}**.\n\n**Parecer:**\n> ${parecer}\n\n${descricaoVeredito}`).setTimestamp()] });
        } catch {}

        const canal = await interaction.guild.channels.fetch(ID_CANAL_SENTENCAS).catch(() => null);
        if (!canal) return interaction.editReply('⚠️ Absolvição concluída, mas o Canal de Sentenças não foi encontrado para publicar o boletim.');

        try {
            await canal.send({ embeds: [embed] });
        } catch (error) {
            console.error('[ABSOLVER] Falha ao publicar boletim:', error);
        }

        await interaction.editReply(`✅ O soldado ${alvo} foi absolvido oficialmente e a ficha foi atualizada.`);
    }
};
