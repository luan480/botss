/* ========================================================================
   ARQUIVO: commands/adm/absolver.js
   DESCRIÇÃO: Tribunal Militar • Absolvição Pontual (Denúncia Improcedente) ou Limpeza de Ficha
   ======================================================================== */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const punicoesPath = path.join(__dirname, '..', 'liga', 'punicoes.json');
const ID_TAG_STAFF = '970318757748670484';
const ID_CANAL_SENTENCAS = '1428490457478070364'; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('absolver')
        .setDescription('🕊️ [STAFF] Declara denúncia improcedente para a acusação atual ou limpa a ficha do réu.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('alvo').setDescription('O soldado envolvido').setRequired(true))
        .addStringOption(opt => 
            opt.setName('tipo_absoluicao')
                .setDescription('Escolha o tipo de absolvição')
                .setRequired(true)
                .addChoices(
                    { name: 'Inocente nesta denúncia (Não afeta o histórico anterior)', value: 'pontual' },
                    { name: 'Limpeza Total de Ficha (Zera todas as punições e progressões)', value: 'geral' }
                )
        )
        .addStringOption(opt => opt.setName('parecer').setDescription('Justifique por que a denúncia não procedeu ou o motivo da absolvição').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true }); 

        if (!interaction.member.roles.cache.has(ID_TAG_STAFF) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply('❌ Apenas membros com a Tag de Staff podem emitir termos de absolvição!');
        }

        const alvo = interaction.options.getUser('alvo');
        const tipoAbsolucao = interaction.options.getString('tipo_absoluicao');
        const parecer = interaction.options.getString('parecer');

        const punicoes = safeReadJson(punicoesPath);
        if (!punicoes[alvo.id]) {
            punicoes[alvo.id] = { mutes: 0, castigos: 0, ultimaPunicao: null };
        }

        let descricaoVeredito = '';

        if (tipoAbsolucao === 'geral') {
            // Limpa tudo
            punicoes[alvo.id].mutes = 0;
            punicoes[alvo.id].castigos = 0;
            punicoes[alvo.id].ultimaPunicao = null;
            descricaoVeredito = '🕊️ **Anistia Concedida (Limpeza Total de Ficha).** Todas as punições anteriores foram anuladas e a ficha disciplinar do soldado foi totalmente resetada.';
        } else {
            // Absolvição pontual: o soldado é inocentado desta denúncia específica, mantendo o histórico intacto (se houver reincidência válida)
            descricaoVeredito = '🕊️ **Denúncia Improcedente.** A Corregedoria avaliou que o soldado **não teve culpa nesta acusação específica**. O processo foi arquivado sem penalidades.';
        }

        safeWriteJson(punicoesPath, punicoes);

        // Remove eventual mute ativo no Discord caso ele estivesse preso aguardando apuração
        const membro = await interaction.guild.members.fetch(alvo.id).catch(() => null);
        if (membro && membro.communicationDisabledUntilTimestamp > Date.now()) {
            await membro.timeout(null, 'Absolvido pelo Tribunal Militar').catch(() => {});
        }

        const embedAbsolvido = new EmbedBuilder()
            .setTitle('🕊️ TRIBUNAL MILITAR • BOLETIM DE ABSOLVIÇÃO')
            .setColor('#2ECC71')
            .setThumbnail(alvo.displayAvatarURL())
            .addFields(
                { name: '🛡️ Envolvido (Soldado)', value: `${alvo} (\`${alvo.username}\`)`, inline: true },
                { name: '👮 Relator (Staff)', value: `${interaction.user}`, inline: true },
                { name: '📋 Parecer da Corregedoria', value: `> ${parecer}`, inline: false },
                { name: '⚖️ Veredito Oficial', value: descricaoVeredito, inline: false }
            )
            .setFooter({ text: 'WorldWarBR • A justiça militar zela pela verdade.' })
            .setTimestamp();

        try {
            const embedDm = new EmbedBuilder()
                .setTitle('🕊️ VOCÊ FOI ABSOLVIDO')
                .setColor('#2ECC71')
                .setDescription(`O Tribunal Militar analisou o seu caso no servidor **${interaction.guild.name}**.\n\n**Parecer:**\n> ${parecer}\n\n*Resultado: ${descricaoVeredito}*`)
                .setTimestamp();
            await alvo.send({ embeds: [embedDm] });
        } catch (err) {}

        const canalSentencas = await interaction.guild.channels.fetch(ID_CANAL_SENTENCAS).catch(() => null);
        if (!canalSentencas) return interaction.editReply('❌ Canal de Sentenças não encontrado!');

        await canalSentencas.send({ embeds: [embedAbsolvido] });
        await interaction.editReply(`✅ O soldado ${alvo} foi absolvido oficialmente e o boletim foi publicado em ${canalSentencas}!`);
    }
};