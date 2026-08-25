/* ========================================================================
   ARQUIVO: commands/adm/punir.js
   DESCRIÇÃO: Tribunal Militar • Sanções, Perda de Pontos e Progressão de Warns
   ======================================================================== */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const punicoesPath = path.join(__dirname, '..', 'liga', 'punicoes.json');
const pontuacaoPath = path.join(__dirname, '..', 'liga', 'pontuacao.json');

const ID_TAG_STAFF = '970318757748670484';
const ID_CANAL_SENTENCAS = '1428490457478070364'; 

// IDs dos Cargos de War Warning
const ID_CARGO_WARN_1 = '1536753214005846016';
const ID_CARGO_WARN_2 = '1536753377931698257';
const ID_CARGO_WARN_3 = '1536753460350029914';

// Tabela de tempo progressivo (1h, 2h, 4h, 8h)
const TEMPOS_PROGRESSIVOS = [
    60 * 60 * 1000,          // 1ª vez: 1 Hora
    2 * 60 * 60 * 1000,      // 2ª vez: 2 Horas
    4 * 60 * 60 * 1000,      // 3ª vez: 4 Horas
    8 * 60 * 60 * 1000       // 4ª vez em diante: 8 Horas (Teto)
];

// Tabela de perda de pontos na Liga (20, 40, 80, 160)
const PONTOS_PROGRESSIVOS = [20, 40, 80, 160];
const TRES_MESES_MS = 90 * 24 * 60 * 60 * 1000; // 90 Dias

function calcularSanacao(dadosSoldado) {
    const agora = Date.now();
    if (dadosSoldado.ultimaPunicao && (agora - dadosSoldado.ultimaPunicao > TRES_MESES_MS)) {
        dadosSoldado.mutes = 0;
        dadosSoldado.castigos = 0;
    }
    return dadosSoldado;
}

function formatarTempoMs(ms) {
    return `${ms / (60 * 60 * 1000)} Hora(s)`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('punir')
        .setDescription('⚖️ [STAFF] Aplica sanções com progressão de tempo, pontos e Cargos de Warn.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('alvo').setDescription('O soldado envolvido').setRequired(true))
        .addStringOption(opt => 
            opt.setName('tipo')
                .setDescription('Tipo de sanção disciplinar')
                .setRequired(true)
                .addChoices(
                    { name: 'Silenciar (Mute progressivo + Warn 1 ou progressão)', value: 'silenciar' },
                    { name: 'Castigo (Timeout progressivo + Warn 2/3)', value: 'castigo' },
                    { name: 'Exílio Absoluto (Banimento - Apenas Mod/Adm)', value: 'ban' }
                )
        )
        .addStringOption(opt => opt.setName('motivo').setDescription('Justificativa militar detalhada da punição').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true }); 

        if (!interaction.member.roles.cache.has(ID_TAG_STAFF) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply('❌ Apenas membros com a Tag de Staff podem operar o Tribunal Militar!');
        }

        const alvo = interaction.options.getUser('alvo');
        const tipo = interaction.options.getString('tipo');
        const justificativa = interaction.options.getString('motivo');
        const membro = await interaction.guild.members.fetch(alvo.id).catch(() => null);

        if (!membro) {
            return interaction.editReply('❌ Soldado não encontrado neste servidor.');
        }

        const punicoes = safeReadJson(punicoesPath);
        if (!punicoes[alvo.id]) {
            punicoes[alvo.id] = { mutes: 0, castigos: 0, ultimaPunicao: null };
        }

        calcularSanacao(punicoes[alvo.id]);

        let corEmbed = '#3498DB';
        let tituloSentenca = '';
        let descricaoPena = '';
        let duracaoTexto = 'N/A';
        let pontosPerdidos = 0;
        let cargoAtribuidoTexto = 'Nenhum';

        const pontuacao = safeReadJson(pontuacaoPath);

        // Remove os 3 cargos de warn primeiro para alternar corretamente
        const removerCargosWarn = async () => {
            await membro.roles.remove([ID_CARGO_WARN_1, ID_CARGO_WARN_2, ID_CARGO_WARN_3]).catch(() => {});
        };

        if (tipo === 'silenciar') {
            const indiceMute = Math.min(punicoes[alvo.id].mutes, TEMPOS_PROGRESSIVOS.length - 1);
            const msMute = TEMPOS_PROGRESSIVOS[indiceMute];
            duracaoTexto = formatarTempoMs(msMute);
            pontosPerdidos = PONTOS_PROGRESSIVOS[indiceMute];
            
            punicoes[alvo.id].mutes++;
            punicoes[alvo.id].ultimaPunicao = Date.now();

            corEmbed = '#F1C40F';
            tituloSentenca = '🔇 TRIBUNAL MILITAR • SENTENÇA DE SILENCIAMENTO';
            await membro.timeout(msMute, `Silenciado: ${justificativa}`).catch(() => {});

            // Gerenciamento de Cargos para Silenciamento (Geralmente recebe o Warn 1 se for início, ou sobe)
            await removerCargosWarn();
            let cargoAlvo = ID_CARGO_WARN_1;
            cargoAtribuidoTexto = `<@&${ID_CARGO_WARN_1}>`;
            
            if (punicoes[alvo.id].mutes >= 3) {
                cargoAlvo = ID_CARGO_WARN_3;
                cargoAtribuidoTexto = `<@&${ID_CARGO_WARN_3}> (Nível Crítico)`;
            } else if (punicoes[alvo.id].mutes === 2) {
                cargoAlvo = ID_CARGO_WARN_2;
                cargoAtribuidoTexto = `<@&${ID_CARGO_WARN_2}>`;
            }
            
            await membro.roles.add(cargoAlvo).catch(() => {});
            
            descricaoPena = `⚠️ **Sanção Aplicada (Silenciamento).**\n• Duração: **${duracaoTexto}** (Infracção #${punicoes[alvo.id].mutes})\n• Penalidade: Perda de **${pontosPerdidos} pontos** na Liga.\n• Condecoração/Warn: ${cargoAtribuidoTexto}`;
        }
        else if (tipo === 'castigo') {
            const indiceCastigo = Math.min(punicoes[alvo.id].castigos, TEMPOS_PROGRESSIVOS.length - 1);
            const msCastigo = TEMPOS_PROGRESSIVOS[indiceCastigo];
            duracaoTexto = formatarTempoMs(msCastigo);
            pontosPerdidos = PONTOS_PROGRESSIVOS[indiceCastigo];
            
            punicoes[alvo.id].castigos++;
            punicoes[alvo.id].ultimaPunicao = Date.now();

            corEmbed = '#E67E22';
            tituloSentenca = '⏳ TRIBUNAL MILITAR • SENTENÇA DE CASTIGO';
            await membro.timeout(msCastigo, `Castigo: ${justificativa}`).catch(() => {});

            // Gerenciamento de Cargos para Castigo (Evolui para Warn 2 ou Warn 3 se for severo)
            await removerCargosWarn();
            let cargoAlvo = ID_CARGO_WARN_2;
            cargoAtribuidoTexto = `<@&${ID_CARGO_WARN_2}>`;

            if (punicoes[alvo.id].castigos >= 2 || indiceCastigo >= 2) {
                cargoAlvo = ID_CARGO_WARN_3;
                cargoAtribuidoTexto = `<@&${ID_CARGO_WARN_3}> (⚠️ Alerta Máximo para Exílio)`;
            }

            await membro.roles.add(cargoAlvo).catch(() => {});

            descricaoPena = `⏳ **Sanção Aplicada (Castigo).**\n• Duração: **${duracaoTexto}** (Castigo #${punicoes[alvo.id].castigos})\n• Penalidade: Perda de **${pontosPerdidos} pontos** na Liga.\n• Condecoração/Warn: ${cargoAtribuidoTexto}`;
        }
        else if (tipo === 'ban') {
            const eModOuAdm = interaction.member.permissions.has(PermissionFlagsBits.BanMembers) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!eModOuAdm) {
                return interaction.editReply('❌ **Acesso Negado:** Apenas Moderadores e Administradores possuem patente para assinar ordens de Exílio Absoluto!');
            }

            corEmbed = '#000000';
            tituloSentenca = '💀 TRIBUNAL MILITAR • EXÍLIO ABSOLUTO';
            duracaoTexto = 'Permanente';
            pontosPerdidos = 160;

            try {
                await membro.ban({ reason: justificativa });
            } catch (e) {
                return interaction.editReply('❌ Erro ao banir. Verifique se o meu cargo está acima do cargo do infrator.');
            }

            descricaoPena = `💀 **Exílio Executado.** O soldado foi desonrado e banido permanentemente do quartel por quebra grave da lei militar.`;
        }

        // Desconta os pontos da liga
        if (pontosPerdidos > 0) {
            const pontosAtuais = pontuacao[alvo.id] || 0;
            pontuacao[alvo.id] = Math.max(0, pontosAtuais - pontosPerdidos);
            safeWriteJson(pontuacaoPath, pontuacao);
        }

        safeWriteJson(punicoesPath, punicoes);

        const embedSentenca = new EmbedBuilder()
            .setTitle(tituloSentenca)
            .setColor(corEmbed)
            .setThumbnail(alvo.displayAvatarURL())
            .addFields(
                { name: '🛡️ Réu (Soldado)', value: `${alvo} (\`${alvo.username}\`)`, inline: true },
                { name: '👮 Relator (Staff)', value: `${interaction.user}`, inline: true },
                { name: '⌛ Prazo / Duração', value: `\`${duracaoTexto}\``, inline: true },
                { name: '📋 Justificativa Oficial', value: `> ${justificativa}`, inline: false },
                { name: '⚖️ Veredito Corregedoria', value: descricaoPena, inline: false }
            )
            .setFooter({ text: 'WorldWarBR • Corregedoria Geral (Warns Automáticos)' })
            .setTimestamp();

        try {
            const embedDm = new EmbedBuilder()
                .setTitle(tituloSentenca)
                .setColor(corEmbed)
                .setDescription(`Você recebeu uma sanção oficial no servidor **${interaction.guild.name}**.\n\n**Detalhes:**`)
                .addFields(
                    { name: '📋 Justificativa', value: `> ${justificativa}`, inline: false },
                    { name: '⚖️ Veredito', value: descricaoPena, inline: false }
                )
                .setTimestamp();
            await alvo.send({ embeds: [embedDm] });
        } catch (err) {}

        const canalSentencas = await interaction.guild.channels.fetch(ID_CANAL_SENTENCAS).catch(() => null);
        if (!canalSentencas) return interaction.editReply('❌ Canal de Sentenças não encontrado!');

        await canalSentencas.send({ embeds: [embedSentenca] });
        await interaction.editReply(`✅ Punição aplicada, pontos descontados, cargos de warn atualizados e boletim publicado em ${canalSentencas}!`);
    }
};