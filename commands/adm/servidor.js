/* ========================================================================
   COMANDO /servidor info (VERSÃO 3.0 - SALVA E ATUALIZA)
   
   - [NOVO] Importa o 'safeWriteJson' da sua pasta de utils.
   - [NOVO] Salva os dados no arquivo 'server_data.json'
     antes de enviar a resposta.
   ======================================================================== */

const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    AttachmentBuilder, 
    ChannelType
} = require('discord.js');

// [NOVO] Precisamos do 'path' para definir onde salvar o arquivo
const path = require('path');

// [NOVO] Importamos a função de salvar o JSON
// O caminho é: sai da pasta 'adm' (..), entra na 'liga', entra na 'utils', pega o 'helpers.js'
const { safeWriteJson } = require('../liga/utils/helpers.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('servidor')
        .setDescription('Comandos de utilidade e gerenciamento do servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                // [NOVO] Descrição atualizada
                .setDescription('Salva e atualiza as informações de cargos e canais do servidor.')
        ),
    
    async execute(interaction) {
        
        if (interaction.options.getSubcommand() === 'info') {
            
            await interaction.deferReply({ ephemeral: true });
            const guild = interaction.guild;

            try {
                // --- A. Coletando Informações dos Cargos ---
                const cargos = guild.roles.cache
                    .map(role => ({
                        id: role.id,
                        nome: role.name,
                        cor: role.hexColor,
                        posicao: role.position
                    }))
                    .sort((a, b) => b.posicao - a.posicao);

                // --- B. Coletando Informações dos Canais ---
                const canais = guild.channels.cache
                    .map(channel => ({
                        id: channel.id,
                        nome: channel.name,
                        tipo: ChannelType[channel.type] || 'Desconhecido', 
                        posicao: channel.rawPosition,
                        categoriaId: channel.parentId
                    }))
                    .sort((a, b) => a.posicao - b.posicao);

                // --- C. Coletando Informações Gerais do Servidor ---
                const infoServidor = {
                    id: guild.id,
                    nome: guild.name,
                    donoId: guild.ownerId,
                    totalMembros: guild.memberCount,
                    criadoEm: guild.createdAt.toISOString()
                };

                // --- D. Compilando o JSON Final ---
                const dadosCompletos = {
                    servidor: infoServidor,
                    totalCargos: cargos.length,
                    cargos: cargos,
                    totalCanais: canais.length,
                    canais: canais
                };

                /* ==================================================================
                   [NOVO] SALVANDO O ARQUIVO DENTRO DO BOT
                   ================================================================== */
                
                // Define o caminho: dentro da pasta 'adm' (onde este comando está)
                // crie/atualize o arquivo 'server_data.json'
                const serverDataPath = path.join(__dirname, 'server_data.json');
                
                // Usa a função 'safeWriteJson' para salvar os dados
                safeWriteJson(serverDataPath, dadosCompletos);
                
                console.log(`[INFO] /servidor info: Dados do servidor atualizados e salvos em 'server_data.json'`);

                /* ==================================================================
                   FIM DA PARTE NOVA
                   ================================================================== */

                // --- E. Criando e Enviando o Arquivo (Opcional, mas bom para confirmar) ---
                const jsonString = JSON.stringify(dadosCompletos, null, 2); 
                const buffer = Buffer.from(jsonString, 'utf-8');

                const attachment = new AttachmentBuilder(buffer, {
                    name: `info_${guild.id}.json`
                });

                // [NOVO] Mensagem de resposta atualizada
                await interaction.editReply({
                    content: `✅ **Informações do servidor atualizadas!**\nOs dados de cargos e canais foram salvos no bot. Aqui está uma cópia para você.`,
                    files: [attachment]
                });

            } catch (err) {
                console.error("Erro ao gerar/salvar info do servidor:", err);
                await interaction.editReply({ content: '❌ Ocorreu um erro ao tentar salvar as informações.' });
            }
        }
    }
};