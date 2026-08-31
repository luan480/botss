/* ========================================================================
   WORLDWARBR — OLIMPÍADAS DE DUPLAS
   Localização: commands/olimpiadas/olimpiadas-handler.js
   Função: motor dos botões/menus das Olimpíadas.
   Regras: registro somente em dias pares de setembro/2026.
   Pontuação: 🥇 vitória; 🥈 desempate peso 3; 🥉 desempate peso 1.
   ======================================================================== */
const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const FILE = path.join(__dirname, 'olimpiadas.json');
const CONFIG = require(FILE);
const ADMIN = require('../../liga/utils/helpers.js');

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { ...CONFIG, duplas: [], resultados: [], ranking: {} }; } }
function save(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8'); }
function permitido() { const d = new Date(); return d.getFullYear() === 2026 && d.getMonth() === 8 && d.getDate() % 2 === 0; }
function esc(s) { return String(s ?? '').replace(/`/g, 'ˋ'); }
function findDupla(data, id) { return data.duplas.find(d => d.id === id); }
function paisOcupado(data, pais, ignoreId = null) { return data.duplas.some(d => d.pais.toLowerCase() === pais.toLowerCase() && d.id !== ignoreId); }
function ranking(data) {
  const map = {};
  for (const r of data.resultados) {
    for (const [pos, key] of [['ouro','ouro'],['prata','prata'],['bronze','bronze']]) {
      const d = findDupla(data, r[key]); if (!d) continue;
      if (!map[d.id]) map[d.id] = { vitorias: 0, segundo: 0, terceiro: 0 };
      if (pos === 'ouro') map[d.id].vitorias++;
      if (pos === 'prata') map[d.id].segundo++;
      if (pos === 'bronze') map[d.id].terceiro++;
    }
  }
  return map;
}
function selectPaises(data, customId, placeholder, usados = []) {
  const paises = [...new Set(data.duplas.map(d => d.pais))].filter(p => !usados.includes(p));
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(paises.slice(0,25).map(p => ({ label: p.slice(0,100), value: p }))));
}

async function painel(interaction) {
  const e = new EmbedBuilder().setColor('#D4AF37').setTitle('🟨 OLIMPÍADAS DE DUPLAS').setDescription('Cada dupla representa um país.\n\n🥇 **Vitória** = critério principal\n🥈 **2º lugar** = desempate ×3\n🥉 **3º lugar** = desempate ×1\n\n📅 Registros: **somente dias pares de setembro/2026**').setImage(CONFIG.imagem).setFooter({ text: 'WorldWarBR • Olimpíadas de Duplas' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('olymp_contabilizar').setLabel('Contabilizar').setEmoji('🏅').setStyle(ButtonStyle.Success).setDisabled(!permitido()),
    new ButtonBuilder().setCustomId('olymp_duplas').setLabel('Ver Duplas').setEmoji('👥').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('olymp_registrar').setLabel('Registrar Dupla').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('olymp_guia').setLabel('Guia da Liga').setEmoji('📖').setStyle(ButtonStyle.Secondary)
  );
  return interaction.reply({ embeds: [e], components: [row], flags: MessageFlags.Ephemeral });
}

async function contabilizar(interaction) {
  if (!permitido()) return interaction.reply({ content: '🚫 A contabilização só pode ser realizada nos dias pares de setembro de 2026.', flags: MessageFlags.Ephemeral });
  const data = load();
  if (data.duplas.length < 3) return interaction.reply({ content: '❌ É necessário ter pelo menos 3 duplas cadastradas.', flags: MessageFlags.Ephemeral });
  return interaction.reply({ content: '🥇 **Selecione o país vencedor:**', components: [selectPaises(data, 'olymp_ouro', 'Escolha o país em 1º lugar')], flags: MessageFlags.Ephemeral });
}

async function registrarResultado(interaction, data, ouro, prata, bronze) {
  if ([ouro, prata, bronze].some((p, i, a) => a.indexOf(p) !== i)) return interaction.reply({ content: '❌ O mesmo país não pode ocupar duas posições.', flags: MessageFlags.Ephemeral });
  const a = data.duplas.find(d => d.pais === ouro), b = data.duplas.find(d => d.pais === prata), c = data.duplas.find(d => d.pais === bronze);
  if (!a || !b || !c) return interaction.reply({ content: '❌ País inválido.', flags: MessageFlags.Ephemeral });
  data.resultados.push({ id: `olymp_${Date.now()}`, data: new Date().toISOString(), ouro: a.id, prata: b.id, bronze: c.id });
  data.ranking = ranking(data); save(data);
  const canal = await interaction.client.channels.fetch(CONFIG.canalResultados).catch(() => null);
  if (canal) await canal.send({ embeds: [new EmbedBuilder().setColor('#D4AF37').setTitle('🏅 RESULTADO — OLIMPÍADAS DE DUPLAS').setDescription(`🥇 **${esc(a.pais)}** — <@${a.jogador1}> + <@${a.jogador2}>\n🥈 **${esc(b.pais)}** — <@${b.jogador1}> + <@${b.jogador2}>\n🥉 **${esc(c.pais)}** — <@${c.jogador1}> + <@${c.jogador2}>`).setTimestamp()] });
  return interaction.reply({ content: '✅ Resultado registrado e enviado para o canal de resultados.', flags: MessageFlags.Ephemeral });
}

async function handle(interaction) {
  const id = interaction.customId;
  if (id === 'olymp_painel') return painel(interaction);
  if (id === 'olymp_contabilizar') return contabilizar(interaction);
  if (id === 'olymp_guia') return interaction.reply({ content: '📖 **GUIA — OLIMPÍADAS DE DUPLAS**\n\nCada dupla escolhe um país.\n\n🥇 Vitória é o critério principal.\n🥈 2º lugar possui peso 3 para desempate.\n🥉 3º lugar possui peso 1 para desempate.\n⏱️ Partida: 1h30.\n📅 Contabilização: somente dias pares de setembro.\n\n1️⃣ Em caso de briga, pode haver troca de país mantendo medalhas individuais.\n2️⃣ Em caso de ausência, pode haver substituição definitiva mantendo as medalhas do país.\n3️⃣ Anti-jogo segue as regras do servidor.\n4️⃣ Disputa por país será resolvida por sorteio.\n⚠️ As Olimpíadas terão apenas duas duplas vencedoras.', flags: MessageFlags.Ephemeral });
  const data = load();
  if (id === 'olymp_duplas') return interaction.reply({ content: data.duplas.length ? data.duplas.map((d,i)=>`**${i+1}. ${esc(d.nome)}** — 🌎 ${esc(d.pais)}\n👥 <@${d.jogador1}> + <@${d.jogador2}>`).join('\n\n') : '❌ Nenhuma dupla cadastrada.', flags: MessageFlags.Ephemeral });
  if (id === 'olymp_ouro') return interaction.reply({ content: '🥈 **Agora selecione o país que ficou em 2º lugar:**', components: [selectPaises(data, 'olymp_prata', 'Escolha o país em 2º', [interaction.values[0]])], flags: MessageFlags.Ephemeral });
  if (id === 'olymp_prata') return interaction.reply({ content: '🥉 **Agora selecione o país que ficou em 3º lugar:**', components: [selectPaises(data, 'olymp_bronze', 'Escolha o país em 3º', [interaction.values[0]])], flags: MessageFlags.Ephemeral });
  if (id === 'olymp_bronze') return registrarResultado(interaction, data, interaction.message?.components?.[0]?.components?.[0]?.options?.[0]?.value || '', interaction.values[0], interaction.values[0]);
  if (id === 'olymp_registrar') return interaction.reply({ content: '📝 O cadastro de dupla será feito pelo construtor de menus. Selecione os dois jogadores e depois o país.', flags: MessageFlags.Ephemeral });
}
module.exports = { handle, painel };
