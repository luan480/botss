/* ========================================================================
   ARQUIVO: commands/adm/embedSystem.js
   DESCRIÇÃO: Sistema Supremo de Embeds via Dashboard Interativa e Modais
   MELHORIAS V2: Chunking Automático de Botões e Proteção Matemática de ActionRows
   ======================================================================== */

const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const templatesPath = path.join(__dirname, 'embeds_salvos.json');
const activeSessions = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('🎨 Gerenciador Supremo de Embeds via Painel Interativo e Modais.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub =>
            sub.setName('criar')
               .setDescription('Abre o Painel Interativo de Criação de Embeds.')
               .addChannelOption(opt => 
                   opt.setName('canal')
                      .setDescription('Canal onde o embed será publicado ao finalizar.')
                      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                      .setRequired(true)
               )
        )
        .addSubcommand(sub =>
            sub.setName('salvar')
               .setDescription('Salva o embed atual como um template reutilizável.')
               .addStringOption(opt => opt.setName('nome').setDescription('Nome do template (ex: regras, vip, liga)').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('carregar')
               .setDescription('Publica um template salvo em um canal.')
               .addStringOption(opt => opt.setName('nome').setDescription('Nome do template salvo').setRequired(true))
               .addChannelOption(opt => 
                   opt.setName('canal')
                      .setDescription('Canal de destino')
                      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                      .setRequired(true)
               )
        )
        .addSubcommand(sub =>
            sub.setName('listar')
               .setDescription('Lista todos os templates de embeds salvos.')
        )
        .addSubcommand(sub =>
            sub.setName('editar')
               .setDescription('Carrega um embed já enviado anteriormente para o painel de edição.')
               .addChannelOption(opt => 
                   opt.setName('canal')
                      .setDescription('Canal onde a mensagem está')
                      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                      .setRequired(true)
               )
               .addStringOption(opt => opt.setName('message_id').setDescription('ID da mensagem do embed').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const user = interaction.user;

        if (sub === 'listar') {
            const templates = safeReadJson(templatesPath);
            const chaves = Object.keys(templates);
            
            if (chaves.length === 0) {
                return interaction.reply({ content: '📭 Nenhum template de embed salvo até o momento.', flags: MessageFlags.Ephemeral });
            }
            
            let texto = chaves.map(k => `• \`${k}\``).join('\n');
            const embedList = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('📚 Templates de Embeds Salvos')
                .setDescription(texto)
                .setFooter({ text: 'Use /embed carregar [nome] [canal] para usar.' });
                
            return interaction.reply({ embeds: [embedList], flags: MessageFlags.Ephemeral });
        }

        if (sub === 'carregar') {
            const nome = interaction.options.getString('nome').toLowerCase();
            const canalDestino = interaction.options.getChannel('canal');
            const templates = safeReadJson(templatesPath);

            if (!templates[nome]) {
                return interaction.reply({ content: `❌ O template \`${nome}\` não foi encontrado. Use \`/embed listar\`.`, flags: MessageFlags.Ephemeral });
            }

            const dados = templates[nome];
            const finalEmbed = this.montarObjetoEmbed(dados);
            const payload = this.montarPayloadCompleto(dados, finalEmbed);

            await canalDestino.send(payload);
            return interaction.reply({ content: `✅ Template \`${nome}\` carregado e publicado com sucesso em ${canalDestino}!`, flags: MessageFlags.Ephemeral });
        }

        if (sub === 'salvar') {
            const nome = interaction.options.getString('nome').toLowerCase();
            const session = activeSessions.get(user.id);

            if (!session) {
                return interaction.reply({ content: '❌ Você não tem nenhuma sessão de embed ativa no momento. Use \`/embed criar\` primeiro.', flags: MessageFlags.Ephemeral });
            }

            const templates = safeReadJson(templatesPath);
            templates[nome] = session.data;
            safeWriteJson(templatesPath, templates);

            return interaction.reply({ content: `💾 **Template \`${nome}\` salvo com sucesso!**`, flags: MessageFlags.Ephemeral });
        }

        if (sub === 'editar') {
            const canalAlvo = interaction.options.getChannel('canal');
            const messageId = interaction.options.getString('message_id');

            await interaction.reply({ content: '🔍 Buscando mensagem antiga...', flags: MessageFlags.Ephemeral });
            const mensagemAntiga = await canalAlvo.messages.fetch(messageId).catch(() => null);

            if (!mensagemAntiga) {
                return interaction.editReply({ content: '❌ Mensagem não encontrada. Verifique o ID e o canal.' });
            }

            const embedAntigo = mensagemAntiga.embeds[0];
            const dadosSessao = {
                canalId: canalAlvo.id,
                editMessageId: messageId,
                autorNome: embedAntigo?.author?.name || '',
                autorIcone: embedAntigo?.author?.iconURL || '',
                titulo: embedAntigo?.title || '',
                url: embedAntigo?.url || '',
                descricao: embedAntigo?.description || '',
                cor: embedAntigo?.hexColor || '#2b2d31',
                thumbnail: embedAntigo?.thumbnail?.url || '',
                imagem: embedAntigo?.image?.url || '',
                rodapeTexto: embedAntigo?.footer?.text || '',
                rodapeIcone: embedAntigo?.footer?.iconURL || '',
                fields: embedAntigo?.fields || [],
                botoes: [],
                menus: [],
                enquete: null
            };

            activeSessions.set(user.id, { data: dadosSessao });
            return this.enviarPainelDashboard(interaction, dadosSessao, false, true);
        }

        if (sub === 'criar') {
            const canalDestino = interaction.options.getChannel('canal');
            const dadosSessao = {
                canalId: canalDestino.id,
                editMessageId: null,
                autorNome: 'Comando Central WorldWarBR',
                autorIcone: '',
                titulo: 'Novo Painel',
                url: '',
                descricao: 'Edite este texto usando os botões abaixo.',
                cor: '#3498db',
                thumbnail: '',
                imagem: '',
                rodapeTexto: 'WorldWarBR • Sistema Oficial',
                rodapeIcone: '',
                fields: [],
                botoes: [],
                menus: [],
                enquete: null
            };

            activeSessions.set(user.id, { data: dadosSessao });
            return interaction.reply({ 
                content: '🎛️ **PAINEL DE CRIAÇÃO INTELIGENTE DE EMBEDS**', 
                embeds: [this.montarObjetoEmbed(dadosSessao)], 
                components: this.obterComponentesPainel(), 
                flags: MessageFlags.Ephemeral 
            });
        }
    },

    obterComponentesPainel() {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('emb_modal_geral').setLabel('✏️ Textos / Geral').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('emb_modal_midia').setLabel('🖼️ Cores & Mídia').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('emb_modal_campo').setLabel('📊 Adicionar Campo').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('emb_modal_botao').setLabel('🔘 Adicionar Botão').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('emb_modal_menu').setLabel('📋 Adicionar Menu').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('emb_modal_enquete').setLabel('📊 Enquete Oficial').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('emb_desfazer').setLabel('⏪ Desfazer Último').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('emb_limpar').setLabel('🗑️ Limpar Tudo').setStyle(ButtonStyle.Danger)
        );

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('emb_publicar').setLabel('🚀 Publicar Definitivo').setStyle(ButtonStyle.Success)
        );

        return [row1, row2, row3];
    },

    async enviarPainelDashboard(interaction, data, isUpdate = false, isEditReply = false) {
        const embedPreview = this.montarObjetoEmbed(data);
        const components = this.obterComponentesPainel();
        
        // Calcula as ActionRows que estão sendo usadas pelo usuário
        const qtdMenus = data.menus ? data.menus.length : 0;
        const qtdBotoes = data.botoes ? data.botoes.length : 0;
        const rowsBotoes = Math.ceil(qtdBotoes / 5);
        const totalRows = qtdMenus + rowsBotoes;

        const contentMsg = `🎛️ **PAINEL DE CRIAÇÃO INTELIGENTE DE EMBEDS**\n*Modifique os elementos abaixo usando os botões.*\n📉 **Limites da API:** ${totalRows}/5 Fileiras usadas | ${data.fields?.length || 0}/25 Campos usados.`;

        try {
            if (isUpdate) {
                return await interaction.update({ content: contentMsg, embeds: [embedPreview], components });
            } else if (isEditReply) {
                return await interaction.editReply({ content: contentMsg, embeds: [embedPreview], components });
            } else {
                return await interaction.reply({ content: contentMsg, embeds: [embedPreview], components, flags: MessageFlags.Ephemeral });
            }
        } catch (err) {
            console.error("Erro ao atualizar o painel:", err);
        }
    },

    async handleInteraction(interaction) {
        const user = interaction.user;
        const session = activeSessions.get(user.id);

        if (!session && !interaction.customId.startsWith('emb_') && !interaction.customId.startsWith('mdl_')) return;
        if (!session) {
            if (interaction.customId.startsWith('emb_') || interaction.customId.startsWith('mdl_')) {
                return interaction.reply({ content: '❌ Sua sessão expirou. Crie um novo painel com `/embed criar`.', flags: MessageFlags.Ephemeral }).catch(()=>{});
            }
            return;
        }

        // Lógica de cálculo matemático do Discord
        const qtdMenusAtuais = session.data.menus ? session.data.menus.length : 0;
        const qtdBotoesAtuais = session.data.botoes ? session.data.botoes.length : 0;
        const espacoFileirasDisponiveis = 5 - (qtdMenusAtuais + Math.ceil(qtdBotoesAtuais / 5));

        if (interaction.isButton()) {
            const id = interaction.customId;

            if (id === 'emb_modal_geral') {
                const modal = new ModalBuilder().setCustomId('mdl_geral').setTitle('Editar Textos Principais');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('titulo').setLabel('Título').setStyle(TextInputStyle.Short).setValue(session.data.titulo || '').setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('descricao').setLabel('Descrição (Texto grande)').setStyle(TextInputStyle.Paragraph).setValue(session.data.descricao || '').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('autor').setLabel('Nome do Autor').setStyle(TextInputStyle.Short).setValue(session.data.autorNome || '').setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rodape').setLabel('Texto do Rodapé').setStyle(TextInputStyle.Short).setValue(session.data.rodapeTexto || '').setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('Link do Título (URL)').setStyle(TextInputStyle.Short).setValue(session.data.url || '').setRequired(false))
                );
                return interaction.showModal(modal);
            }

            if (id === 'emb_modal_midia') {
                const modal = new ModalBuilder().setCustomId('mdl_midia').setTitle('Cores e Imagens');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cor').setLabel('Cor (HEX ex: #FF0000 ou Random)').setStyle(TextInputStyle.Short).setValue(session.data.cor || '#3498db').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumbnail').setLabel('URL Thumbnail (Canto superior)').setStyle(TextInputStyle.Short).setValue(session.data.thumbnail || '').setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('imagem').setLabel('URL Imagem Grande / Banner').setStyle(TextInputStyle.Short).setValue(session.data.imagem || '').setRequired(false))
                );
                return interaction.showModal(modal);
            }

            if (id === 'emb_modal_campo') {
                if (session.data.fields.length >= 25) {
                    return interaction.reply({ content: '❌ O Discord permite no máximo 25 campos por embed!', flags: MessageFlags.Ephemeral });
                }
                const modal = new ModalBuilder().setCustomId('mdl_campo').setTitle('Adicionar Bloco de Campo');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nome').setLabel('Título do Campo').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('valor').setLabel('Conteúdo do Campo').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('inline').setLabel('Lado a lado? (sim ou nao)').setStyle(TextInputStyle.Short).setValue('nao').setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (id === 'emb_modal_botao') {
                // Se adicionar um botão exige abrir uma nova fileira, verifica se tem espaço
                if (qtdBotoesAtuais % 5 === 0 && espacoFileirasDisponiveis < 1) {
                    return interaction.reply({ content: '❌ Limite de componentes atingido! O Discord permite no máximo 5 fileiras totais.', flags: MessageFlags.Ephemeral });
                }
                const modal = new ModalBuilder().setCustomId('mdl_botao').setTitle('Adicionar Botão Interativo');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Texto do Botão').setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('estilo').setLabel('Estilo: verde, azul, vermelho, cinza ou link').setStyle(TextInputStyle.Short).setValue('verde').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('acao').setLabel('ID interno ou URL (se for link)').setStyle(TextInputStyle.Short).setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (id === 'emb_modal_menu') {
                if (espacoFileirasDisponiveis < 1) {
                    return interaction.reply({ content: '❌ Limite de componentes atingido! Um menu exige 1 fileira livre (Máx 5 permitidas).', flags: MessageFlags.Ephemeral });
                }
                const modal = new ModalBuilder().setCustomId('mdl_menu').setTitle('Adicionar Menu Suspenso');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('customId').setLabel('ID Interno do Menu').setStyle(TextInputStyle.Short).setValue('menu_opcoes').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('placeholder').setLabel('Texto de instrução cinza').setStyle(TextInputStyle.Short).setValue('Selecione...').setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('opcoes').setLabel('Opções: Nome|Desc|Valor | Nome2|Desc2|Val2').setStyle(TextInputStyle.Paragraph).setValue('Opção 1|Descrição|val_1').setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (id === 'emb_modal_enquete') {
                const modal = new ModalBuilder().setCustomId('mdl_enquete').setTitle('Criar Enquete Oficial');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pergunta').setLabel('Pergunta da Enquete').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('respostas').setLabel('Respostas separadas por |').setStyle(TextInputStyle.Paragraph).setValue('Sim | Não').setRequired(true))
                );
                return interaction.showModal(modal);
            }

            if (id === 'emb_desfazer') {
                let desfeito = false;
                if (session.data.enquete) { session.data.enquete = null; desfeito = true; }
                else if (session.data.menus.length > 0) { session.data.menus.pop(); desfeito = true; }
                else if (session.data.botoes.length > 0) { session.data.botoes.pop(); desfeito = true; }
                else if (session.data.fields.length > 0) { session.data.fields.pop(); desfeito = true; }
                
                if (!desfeito) {
                    return interaction.reply({ content: '⚠️ Não há componentes extras para desfazer.', flags: MessageFlags.Ephemeral });
                }
                return this.enviarPainelDashboard(interaction, session.data, true);
            }

            if (id === 'emb_limpar') {
                session.data.fields = [];
                session.data.botoes = [];
                session.data.menus = [];
                session.data.enquete = null;
                return this.enviarPainelDashboard(interaction, session.data, true);
            }

            if (id === 'emb_publicar') {
                const canalDestino = await interaction.guild.channels.fetch(session.data.canalId).catch(() => null);
                if (!canalDestino) return interaction.reply({ content: '❌ Canal de destino não encontrado.', flags: MessageFlags.Ephemeral });

                const finalEmbed = this.montarObjetoEmbed(session.data);
                const payload = this.montarPayloadCompleto(session.data, finalEmbed);

                try {
                    if (session.data.editMessageId) {
                        const msgAntiga = await canalDestino.messages.fetch(session.data.editMessageId).catch(() => null);
                        if (msgAntiga) await msgAntiga.edit(payload);
                        await interaction.update({ content: `✅ **Embed atualizado com sucesso em ${canalDestino}!**`, embeds: [], components: [] });
                    } else {
                        await canalDestino.send(payload);
                        await interaction.update({ content: `✅ **Embed publicado com sucesso em ${canalDestino}!** (Use \`/embed salvar [nome]\` para guardar o modelo).`, embeds: [], components: [] });
                    }
                } catch (err) {
                    console.error(err);
                    return interaction.reply({ content: `❌ Falha ao publicar. Pode haver um erro nos links ou na montagem: ${err.message}`, flags: MessageFlags.Ephemeral });
                }

                activeSessions.delete(user.id);
                return;
            }
        }

        if (interaction.isModalSubmit()) {
            const mId = interaction.customId;

            if (mId === 'mdl_geral') {
                session.data.titulo = interaction.fields.getTextInputValue('titulo');
                session.data.descricao = interaction.fields.getTextInputValue('descricao');
                session.data.autorNome = interaction.fields.getTextInputValue('autor');
                session.data.rodapeTexto = interaction.fields.getTextInputValue('rodape');
                session.data.url = interaction.fields.getTextInputValue('url');
            } else if (mId === 'mdl_midia') {
                session.data.cor = interaction.fields.getTextInputValue('cor');
                session.data.thumbnail = interaction.fields.getTextInputValue('thumbnail');
                session.data.imagem = interaction.fields.getTextInputValue('imagem');
            } else if (mId === 'mdl_campo') {
                if (!session.data.fields) session.data.fields = [];
                session.data.fields.push({
                    name: interaction.fields.getTextInputValue('nome') || '\u200B',
                    value: interaction.fields.getTextInputValue('valor') || '\u200B',
                    inline: interaction.fields.getTextInputValue('inline').toLowerCase() === 'sim'
                });
            } else if (mId === 'mdl_botao') {
                if (!session.data.botoes) session.data.botoes = [];
                const estiloStr = interaction.fields.getTextInputValue('estilo').toLowerCase();
                let style = ButtonStyle.Primary;
                if (estiloStr.includes('verde')) style = ButtonStyle.Success;
                else if (estiloStr.includes('vermelho')) style = ButtonStyle.Danger;
                else if (estiloStr.includes('cinza')) style = ButtonStyle.Secondary;
                else if (estiloStr.includes('link')) style = ButtonStyle.Link;

                session.data.botoes.push({
                    label: interaction.fields.getTextInputValue('label'),
                    style,
                    urlOrId: interaction.fields.getTextInputValue('acao')
                });
            } else if (mId === 'mdl_menu') {
                if (!session.data.menus) session.data.menus = [];
                const opcoesTxt = interaction.fields.getTextInputValue('opcoes');
                const partes = opcoesTxt.split('|');
                const options = [];
                
                for (let i = 0; i < partes.length; i += 3) {
                    if (partes[i] && partes[i+1] && partes[i+2]) {
                        options.push({ label: partes[i].trim(), description: partes[i+1].trim(), value: partes[i+2].trim() });
                    }
                }
                
                if (options.length > 0) {
                    session.data.menus.push({
                        type: 'string',
                        customId: interaction.fields.getTextInputValue('customId'),
                        placeholder: interaction.fields.getTextInputValue('placeholder'),
                        options,
                        minValues: 1,
                        maxValues: options.length
                    });
                }
            } else if (mId === 'mdl_enquete') {
                const pergunta = interaction.fields.getTextInputValue('pergunta');
                const respostasTxt = interaction.fields.getTextInputValue('respostas');
                const respostas = respostasTxt.split('|').map(r => r.trim()).filter(Boolean);

                if (respostas.length >= 2) {
                    session.data.enquete = {
                        question: { text: pergunta },
                        answers: respostas.slice(0, 10).map(text => ({ text })),
                        allowMultiselect: true,
                        duration: 168
                    };
                }
            }

            return this.enviarPainelDashboard(interaction, session.data, true);
        }
    },

    montarObjetoEmbed(data) {
        const embed = new EmbedBuilder().setTimestamp();
        
        try {
            if (data.autorNome) embed.setAuthor({ name: data.autorNome, iconURL: data.autorIcone || undefined });
            if (data.titulo) embed.setTitle(data.titulo);
            if (data.url && data.url.startsWith('http')) embed.setURL(data.url);
            if (data.descricao) embed.setDescription(data.descricao);
            
            if (data.cor) {
                let cor = data.cor.toUpperCase();
                if (cor === 'RANDOM') embed.setColor('Random');
                else embed.setColor(cor.startsWith('#') ? cor : '#' + cor);
            } else {
                embed.setColor('#2b2d31');
            }

            if (data.thumbnail && data.thumbnail.startsWith('http')) embed.setThumbnail(data.thumbnail);
            if (data.imagem && data.imagem.startsWith('http')) embed.setImage(data.imagem);
            if (data.rodapeTexto) embed.setFooter({ text: data.rodapeTexto, iconURL: data.rodapeIcone || undefined });
            if (data.fields && data.fields.length > 0) embed.addFields(data.fields);
            
        } catch (err) {
            console.error("Validação do Embed falhou: ", err);
        }
        
        return embed;
    },

    montarPayloadCompleto(data, embed) {
        const comps = [];
        
        // 1. Injeta os Menus (1 ActionRow cada)
        if (data.menus && data.menus.length > 0) {
            data.menus.forEach(m => {
                const menuComponent = new StringSelectMenuBuilder()
                    .setCustomId(m.customId)
                    .setPlaceholder(m.placeholder)
                    .setMinValues(m.minValues || 1)
                    .setMaxValues(m.maxValues || 1)
                    .addOptions(m.options);
                comps.push(new ActionRowBuilder().addComponents(menuComponent));
            });
        }

        // 2. Injeta os Botões (Quebrando em blocos de 5 por ActionRow)
        if (data.botoes && data.botoes.length > 0) {
            for (let i = 0; i < data.botoes.length; i += 5) {
                const chunk = data.botoes.slice(i, i + 5);
                const row = new ActionRowBuilder();
                
                chunk.forEach(b => {
                    const btn = new ButtonBuilder().setLabel(b.label).setStyle(b.style);
                    if (b.style === ButtonStyle.Link) {
                        btn.setURL(b.urlOrId.startsWith('http') ? b.urlOrId : 'https://discord.com');
                    } else {
                        btn.setCustomId(b.urlOrId);
                    }
                    row.addComponents(btn);
                });
                
                comps.push(row);
            }
        }

        const payload = {
            embeds: [embed],
            components: comps
        };

        if (data.enquete) {
            payload.poll = data.enquete;
        }

        return payload;
    }
};