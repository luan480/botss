const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
const { isStaff } = require('../utils/staffPermissions.js');

const punicoesPath = path.join(__dirname, '..', 'liga', 'punicoes.json');
const ID_CANAL_SENTENCAS = '1428490457478070364';

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

        let descricaoVeredito;
        if (tipoAbsolucao === 'geral') {
            punicoes[alvo.id].mutes = 0;
            punicoes[alvo.id].castigos = 0;
            punicoes[alvo.id].ultimaPunicao = null;
            descricaoVeredito = '🕊️ **Anistia Concedida.** Todas as punições anteriores foram anuladas e a ficha foi resetada.';
        } else {
            descricaoVeredito = '🕊️ **Denúncia Improcedente.** O soldado foi considerado inocente nesta acusação.';
        }

        safeWriteJson(punicoesPath, punicoes);

        const membro = await interaction.guild.members.fetch(alvo.id).catch(() => null);
        if (membro && membro.communicationDisabledUntilTimestamp > Date.now()) {
            await membro.timeout(null, 'Absolvido pelo Tribunal Militar').catch(() => {});
        }

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
        if (!canal) return interaction.editReply('❌ Canal de Sentenças não encontrado!');
        await canal.send({ embeds: [embed] });
        await interaction.editReply(`✅ O soldado ${alvo} foi absolvido oficialmente e o boletim foi publicado em ${canal}!`);
    }
};
