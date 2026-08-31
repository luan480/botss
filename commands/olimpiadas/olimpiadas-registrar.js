/* ========================================================================
   ARQUIVO: commands/olimpiadas/olimpiadas-registrar.js

   SISTEMA:
   🟨 OLIMPÍADAS DE DUPLAS

   O QUE ESTE ARQUIVO FAZ:
   - Cria o comando /olimpiadas-registrar.
   - Permite escolher os dois jogadores.
   - O país usa AUTOCOMPLETE REAL DO DISCORD.
   - Enquanto o usuário digita, os países vão aparecendo.
   - Aceita pesquisa sem acento: "colombia" encontra "Colômbia".
   - Mostra somente países ainda disponíveis.
   - Impede país repetido.
   - Impede jogador em duas duplas.
   - Não existe campo de nome da dupla.
   - Salva a dupla diretamente em olimpiadas.json.
   - Publica o registro no canal TEG configurado.

   IMPORTANTE:
   O Discord NÃO oferece autocomplete digitável dentro de um botão,
   String Select ou Modal TextInput. O autocomplete nativo funciona
   em opções de Slash Command. Por isso este comando é a forma correta
   de ter a lista aparecendo enquanto a pessoa digita.

   EXEMPLO:
   /olimpiadas-registrar jogador1:@Luan jogador2:@Joao pais:colo

   Ao digitar "colo", o Discord poderá mostrar:
   🇨🇴 Colômbia
   ======================================================================== */

const fs = require('fs');
const path = require('path');

const {
    SlashCommandBuilder,
    MessageFlags
} = require('discord.js');


// ========================================================================
// ARQUIVO DE DADOS
// ========================================================================

const ARQUIVO_DADOS = path.join(
    __dirname,
    'olimpiadas.json'
);


// ========================================================================
// FUNÇÕES DE DADOS
// ========================================================================

function carregarDados() {

    const dados = JSON.parse(
        fs.readFileSync(
            ARQUIVO_DADOS,
            'utf8'
        )
    );

    dados.paises = Array.isArray(dados.paises)
        ? dados.paises
        : [];

    dados.duplas = Array.isArray(dados.duplas)
        ? dados.duplas
        : [];

    dados.resultados = Array.isArray(dados.resultados)
        ? dados.resultados
        : [];

    dados.ranking = dados.ranking && typeof dados.ranking === 'object'
        ? dados.ranking
        : {};

    return dados;
}


function salvarDados(dados) {

    fs.writeFileSync(
        ARQUIVO_DADOS,
        JSON.stringify(
            dados,
            null,
            2
        ),
        'utf8'
    );
}


// ========================================================================
// NORMALIZAÇÃO
// ========================================================================
// Remove acentos e transforma tudo em minúsculo.
// Exemplo:
// Colômbia -> colombia
// COLOMBIA -> colombia
// ========================================================================

function normalizar(valor) {

    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}


// ========================================================================
// PAÍSES DISPONÍVEIS
// ========================================================================

function paisJaUsado(dados, pais) {

    return dados.duplas.some(
        dupla =>
            normalizar(dupla.pais) === normalizar(pais)
    );
}


function jogadorJaUsado(dados, jogadorId) {

    return dados.duplas.some(
        dupla =>
            String(dupla.jogador1) === String(jogadorId) ||
            String(dupla.jogador2) === String(jogadorId)
    );
}


function obterPaisesDisponiveis(dados) {

    return dados.paises.filter(
        pais => !paisJaUsado(dados, pais)
    );
}


// ========================================================================
// CONFIGURAÇÃO DO COMANDO
// ========================================================================

module.exports = {

    data: new SlashCommandBuilder()

        .setName('olimpiadas-registrar')

        .setDescription(
            '📝 Registra uma dupla nas Olimpíadas escolhendo o país.'
        )

        .addUserOption(
            option => option
                .setName('jogador1')
                .setDescription('Primeiro integrante da dupla.')
                .setRequired(true)
        )

        .addUserOption(
            option => option
                .setName('jogador2')
                .setDescription('Segundo integrante da dupla.')
                .setRequired(true)
        )

        .addStringOption(
            option => option
                .setName('pais')
                .setDescription(
                    'Digite o nome ou parte do nome do país.'
                )
                .setRequired(true)
                .setAutocomplete(true)
        ),


    // ====================================================================
    // AUTOCOMPLETE
    // ====================================================================
    // Esta função é chamada pelo Discord enquanto a pessoa digita.
    // O Discord permite no máximo 25 sugestões por resposta.
    // ====================================================================

    async autocomplete(interaction) {

        try {

            const dados = carregarDados();
            const disponiveis = obterPaisesDisponiveis(dados);
            const termo = normalizar(
                interaction.options.getString('pais') || ''
            );

            const encontrados = disponiveis
                .filter(
                    pais => normalizar(pais).includes(termo)
                )
                .slice(0, 25);

            return interaction.respond(
                encontrados.map(
                    pais => ({
                        name: `🌎 ${pais}`.slice(0, 100),
                        value: pais
                    })
                )
            );

        } catch (erro) {

            console.error(
                '[OLIMPIADAS] Erro no autocomplete de país:',
                erro
            );

            return interaction.respond([]).catch(() => {});
        }
    },


    // ====================================================================
    // EXECUÇÃO DO COMANDO
    // ====================================================================

    async execute(interaction) {

        try {

            const dados = carregarDados();

            const jogador1 = interaction.options.getUser(
                'jogador1',
                true
            );

            const jogador2 = interaction.options.getUser(
                'jogador2',
                true
            );

            const pais = interaction.options.getString(
                'pais',
                true
            );

            // ------------------------------------------------------------
            // VALIDAÇÃO DOS JOGADORES
            // ------------------------------------------------------------

            if (jogador1.id === jogador2.id) {

                return interaction.reply({
                    content:
                        '❌ Os dois integrantes precisam ser jogadores diferentes.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (jogadorJaUsado(dados, jogador1.id)) {

                return interaction.reply({
                    content:
                        `❌ ${jogador1} já pertence a uma dupla nas Olimpíadas.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            if (jogadorJaUsado(dados, jogador2.id)) {

                return interaction.reply({
                    content:
                        `❌ ${jogador2} já pertence a uma dupla nas Olimpíadas.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // ------------------------------------------------------------
            // VALIDAÇÃO DO PAÍS
            // ------------------------------------------------------------

            const paisOficial = dados.paises.find(
                item => normalizar(item) === normalizar(pais)
            );

            if (!paisOficial) {

                return interaction.reply({
                    content:
                        '❌ Esse país não existe na lista das Olimpíadas.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (paisJaUsado(dados, paisOficial)) {

                return interaction.reply({
                    content:
                        `❌ O país **${paisOficial}** já está sendo representado por outra dupla.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // ------------------------------------------------------------
            // CRIAÇÃO DA DUPLA
            // ------------------------------------------------------------

            const dupla = {
                id:
                    `dupla-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

                jogador1:
                    jogador1.id,

                jogador2:
                    jogador2.id,

                pais:
                    paisOficial,

                criadoEm:
                    new Date().toISOString()
            };

            dados.duplas.push(dupla);

            salvarDados(dados);

            // ------------------------------------------------------------
            // CANAL TEG
            // ------------------------------------------------------------

            const canalTeg = await interaction.client.channels
                .fetch(dados.canalTeg)
                .catch(() => null);

            if (canalTeg?.isTextBased()) {

                await canalTeg.send({
                    embeds: [
                        {
                            color: 0xD4AF37,
                            title: '🟨 NOVA DUPLA REGISTRADA',
                            description: [
                                `🌎 **País:** ${paisOficial}`,
                                '',
                                `👤 **Jogador 1:** ${jogador1}`,
                                `👤 **Jogador 2:** ${jogador2}`
                            ].join('\n'),
                            footer: {
                                text: 'WorldWarBR • Olimpíadas de Duplas'
                            },
                            timestamp: new Date().toISOString()
                        }
                    ]
                }).catch(
                    erro => console.error(
                        '[OLIMPIADAS] Erro ao enviar registro para o TEG:',
                        erro
                    )
                );
            }

            // ------------------------------------------------------------
            // CONFIRMAÇÃO PRIVADA
            // ------------------------------------------------------------

            return interaction.reply({
                content: [
                    '✅ **DUPLA REGISTRADA!**',
                    '',
                    `👤 ${jogador1}`,
                    `👤 ${jogador2}`,
                    `🌎 **${paisOficial}**`,
                    '',
                    '📌 O registro foi salvo nas Olimpíadas.'
                ].join('\n'),
                flags: MessageFlags.Ephemeral
            });

        } catch (erro) {

            console.error(
                '[OLIMPIADAS] Erro ao registrar dupla:',
                erro
            );

            if (!interaction.replied && !interaction.deferred) {

                return interaction.reply({
                    content:
                        '❌ Não foi possível registrar a dupla. Veja o console do bot para o erro.',
                    flags: MessageFlags.Ephemeral
                });
            }

            return interaction.editReply({
                content:
                    '❌ Não foi possível registrar a dupla.'
            }).catch(() => {});
        }
    }
};
