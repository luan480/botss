const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');

const HISTORICO_PATH = path.join(__dirname, 'historico.json');
const CATS = ['liga', 'eventos', 'records', 'imperador'];

function load() {
  const d = safeReadJson(HISTORICO_PATH) || {};
  for (const c of CATS) if (!Array.isArray(d[c])) d[c] = [];
  return d;
}
function save(d) { safeWriteJson(HISTORICO_PATH, d); }
function findRecord(d, id) {
  for (const c of CATS) {
    const i = d[c].findIndex(r => r && typeof r === 'object' && String(r.id) === String(id));
    if (i >= 0) return { categoria: c, index: i, registro: d[c][i] };
  }
  return null;
}
function val(r, k) { return r?.[k] == null ? '' : String(r[k]); }
function modal(id, title, r) {
  const fields = [
    ['nome','Nome',TextInputStyle.Short,100], ['vencedor','Vencedor',TextInputStyle.Short,500],
    ['segundo','2º lugar',TextInputStyle.Short,500], ['terceiro','3º lugar',TextInputStyle.Short,500],
    ['descricao','Descrição',TextInputStyle.Paragraph,1000], ['observacoes','Observações',TextInputStyle.Paragraph,1000],
    ['premio','Prêmio',TextInputStyle.Short,300], ['valor','Valor',TextInputStyle.Short,20],
    ['imagem','URL da imagem',TextInputStyle.Short,1000], ['data','Data',TextInputStyle.Short,30]
  ];
  const m = new ModalBuilder().setCustomId(`hall_edit_modal_${id}`).setTitle(title.slice(0,45));
  m.addComponents(fields.map(([k,label,style,max]) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(k).setLabel(label).setStyle(style).setRequired(false).setMaxLength(max).setValue(val(r,k).slice(0,4000)))));
  return m;
}

module.exports = {
  data: new SlashCommandBuilder().setName('hall-admin').setDescription('🏛️ Gerencia registros do Hall da Fama.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const id = interaction.options.getString('id');
    if (!id) return interaction.editReply('❌ Informe o ID do registro.');
    const d = load(); const found = findRecord(d,id);
    if (!found) return interaction.editReply('❌ Registro não encontrado.');
    const r = found.registro;
    const e = new EmbedBuilder().setTitle('🏛️ Gerenciar Hall da Fama').setDescription(`**${r.nome || 'Registro'}**\nCategoria: **${found.categoria}**\nID: \`${r.id}\``);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`hall_admin_edit_${r.id}`).setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`hall_admin_delete_${r.id}`).setLabel('Remover').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );
    return interaction.editReply({ embeds:[e], components:[row] });
  }
};
