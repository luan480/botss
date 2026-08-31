/* ========================================================================
   ARQUIVO: commands/liga/olimpiadas/olimpiadas-handler.js
   LOCAL: commands/liga/olimpiadas/

   FUNÇÃO:
   Controla TODOS os botões e menus das Olimpíadas de Duplas.

   FLUXOS:
   - Registrar dupla: selecionar 2 membros -> selecionar país.
   - Contabilizar: selecionar 🥇 -> 🥈 -> 🥉 -> enviar print no chat.
   - Ver duplas: lista paginada.
   - Guia: regras completas.

   OBSERVAÇÃO:
   O único passo que não pode ser feito por menu é o envio do PRINT,
   porque o Discord exige uma mensagem/anexo para receber a imagem.
   ======================================================================== */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const painel = require('./olimpiadas-painel.js');
const DATA_FILE = path.join(__dirname, 'olimpiadas.json');
const PAGE_SIZE = 20;
const pending = new Map();

// ISO 3166-1 alpha-2. O nome em português é obtido pelo Intl do Node.
const COUNTRY_CODES = `AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW`.split(' ');

function countryName(code) {
    try {
        return new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(code) || code;
    } catch { return code; }
}

const COUNTRIES = COUNTRY_CODES.map(code => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

function nowBR() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Fortaleza' }));
}

function isEvenSeptember() {
    const d = nowBR();
    return d.getFullYear() === 2026 && d.getMonth() === 8 && d.getDate() % 2 === 0;
}

function read() { return painel.readData(); }
function write(data) { painel.writeData(data); }

function staff(member) {
    return Boolean(member?.permissions?.has(PermissionFlagsBits.ManageGuild) || member?.permissions?.has(PermissionFlagsBits.Administrator));
}

function countryMenu(customId, selectedCodes = [], page = 0, onlyOccupied = false) {
    const data = read();
    const occupied = new Set(data.duplas.map(d => d.pais));
    const source = onlyOccupied ? COUNTRIES.filter(c => occupied.has(c.code)) : COUNTRIES;
    const pages = Math.max(1, Math.ceil(source.length / PAGE_SIZE));
    const safePage = Math.max(0, Math.min(Number(page) || 0, pages - 1));
    const items = source.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
    const menu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder('🌎 Selecione o país').setMinValues(1).setMaxValues(1).addOptions(items.map(c => ({ label: c.name.slice(0, 100), value: c.code, description: `Representar ${c.name}`.slice(0, 100), default: selectedCodes.includes(c.code) })));
    const rows = [new ActionRowBuilder().addComponents(menu)];
    if (pages > 1) rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${customId}_prev_${safePage}`).setLabel('Anterior').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(safePage <= 0),
        new ButtonBuilder().setCustomId(`${customId}_page_${safePage}`).setLabel(`${safePage + 1}/${pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`${customId}_next_${safePage}`).setLabel('Próxima').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(safePage >= pages - 1)
    ));
    return rows;
}

function pairByCountry(data, code) { return data.duplas.find(d => d.pais === code); }
function pairText(d) { return `**${d.nome}**\n🇺🇳 ${countryName(d.pais)}\n👤 <@${d.jogadores[0]}> + <@${d.jogadores[1]}>\n🏅 🥇 ${d.ouro} • 🥈 ${d.prata} • 🥉 ${d.bronze}`; }

async function registerStart(interaction) {
    pending.set(interaction.user.id, { type: 'register' });
    const users = new UserSelectMenuBuilder().setCustomId('olymp_reg_users').setPlaceholder('👥 Selecione os 2 integrantes da dupla').setMinValues(2).setMaxValues(2);
    return interaction.reply({ content: '📝 **REGISTRAR DUPLA**\nSelecione exatamente **2 membros**. Depois você escolherá o país por menu.', components: [new ActionRowBuilder().addComponents(users)], flags: MessageFlags.Ephemeral });
}

async function registerUsers(interaction) {
    const ids = interaction.values;
    if (ids.length !== 2 || ids[0] === ids[1]) return interaction.update({ content: '❌ Uma dupla precisa ter dois membros diferentes.', components: [] });
    const data = read();
    if (data.duplas.some(d => d.jogadores.some(id => ids.includes(id)))) return interaction.update({ content: '❌ Um dos membros selecionados já pertence a uma dupla registrada.', components: [] });
    pending.set(interaction.user.id, { type: 'register', jogadores: ids });
    return interaction.update({ content: '🌎 **Agora selecione o país que a dupla irá representar.**\n\n🚫 Países já ocupados não aparecem como opção.', components: countryMenu('olymp_reg_country') });
}

async function registerCountry(interaction, page = 0) {
    const state = pending.get(interaction.user.id);
    if (!state?.jogadores) return interaction.update({ content: '⏱️ Sua inscrição expirou. Clique em **Registrar Dupla** novamente.', components: [] });
    if (interaction.isButton()) return interaction.update({ content: '🌎 **Escolha o país da dupla:**', components: countryMenu('olymp_reg_country', [], page) });
    const code = interaction.values[0];
    const data = read();
    if (pairByCountry(data, code)) return interaction.update({ content: `❌ **${countryName(code)}** já está sendo representado por outra dupla.`, components: countryMenu('olymp_reg_country') });
    if (data.duplas.some(d => d.jogadores.some(id => state.jogadores.includes(id)))) return interaction.update({ content: '❌ Um dos jogadores já foi registrado em outra dupla.', components: [] });
    data.seq++;
    const nome = `Dupla ${data.seq}`;
    const duo = { id: `D${String(data.seq).padStart(4, '0')}`, nome, jogadores: state.jogadores, pais: code, ouro: 0, prata: 0, bronze: 0, criadoEm: new Date().toISOString() };
    data.duplas.push(duo); write(data); pending.delete(interaction.user.id);
    await painel.publish(interaction.guild).catch(e => console.error('[OLIMPIADAS] Atualizar painel:', e));
    return interaction.update({ content: `✅ **${nome} registrada!**\n🇺🇳 País: **${countryName(code)}**\n👥 <@${state.jogadores[0]}> + <@${state.jogadores[1]}>`, components: [] });
}

async function showDuplas(interaction, page = 0) {
    const data = read();
    const pages = Math.max(1, Math.ceil(data.duplas.length / 6));
    const p = Math.max(0, Math.min(Number(page) || 0, pages - 1));
    const list = data.duplas.slice(p * 6, p * 6 + 6);
    const embed = new EmbedBuilder().setColor(0xD4AF37).setTitle('👥 DUPLAS — OLIMPÍADAS DE DUPLAS').setDescription(list.length ? list.map(pairText).join('\n\n') : '*Nenhuma dupla registrada.*').setFooter({ text: `Página ${p + 1}/${pages} • ${data.duplas.length} duplas` });
    const rows = [];
    if (pages > 1) rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`olymp_duplas_prev_${p}`).setLabel('Anterior').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId(`olymp_duplas_page_${p}`).setLabel(`${p + 1}/${pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`olymp_duplas_next_${p}`).setLabel('Próxima').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(p >= pages - 1)
    ));
    rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('olymp_back_panel').setLabel('Voltar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)));
    return interaction.reply({ embeds: [embed], components: rows, flags: MessageFlags.Ephemeral });
}

async function guide(interaction) {
    const embed = new EmbedBuilder().setColor(0xD4AF37).setTitle('📖 GUIA — OLIMPÍADAS DE DUPLAS').setDescription(
        '🟨 **Olimpíadas de Duplas**\n\n' +
        'Cada dupla escolhe um País para representar. As partidas podem ser contabilizadas **somente nos dias pares de setembro de 2026**.\n\n' +
        '🏅 **CLASSIFICAÇÃO**\n' +
        '🥇 Vitória é o resultado principal.\n' +
        '🥈 2º lugar serve apenas como desempate e tem **peso 3**.\n' +
        '🥉 3º lugar serve apenas como desempate e tem **peso 1**.\n\n' +
        '⚔️ **REGRAS**\n' +
        '1️⃣ Em caso de briga, é possível trocar de país mantendo as medalhas individuais.\n' +
        '2️⃣ Em caso de ausência, é possível substituir definitivamente um parceiro; as medalhas do país são mantidas.\n' +
        '3️⃣ Anti-jogo será tratado como qualquer outra partida do servidor.\n' +
        '4️⃣ Em caso de disputa por um país, será realizado sorteio.\n' +
        '⏱️ Partida: **1h30min**.\n' +
        '🏆 As Olimpíadas terão **apenas duas duplas vencedoras**.'
    );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function countStart(interaction) {
    if (!isEvenSeptember()) return interaction.reply({ content: '🚫 **CONTABILIZAÇÃO FECHADA.** O botão só pode ser usado nos dias pares de setembro de 2026.', flags: MessageFlags.Ephemeral });
    const data = read();
    if (data.duplas.length < 3) return interaction.reply({ content: '❌ É preciso ter pelo menos **3 duplas registradas** para contabilizar uma partida.', flags: MessageFlags.Ephemeral });
    pending.set(interaction.user.id, { type: 'count', pos: 'ouro' });
    return interaction.reply({ content: '🥇 **SELECIONE O PAÍS VENCEDOR**', components: countryMenu('olymp_count_gold', [], 0, true), flags: MessageFlags.Ephemeral });
}

async function countCountry(interaction, pos, page = 0) {
    const state = pending.get(interaction.user.id);
    if (!state || state.type !== 'count') return interaction.reply({ content: '⏱️ Contabilização expirada. Clique novamente no botão.', flags: MessageFlags.Ephemeral });
    if (!isEvenSeptember()) { pending.delete(interaction.user.id); return interaction.reply({ content: '🚫 A contabilização só pode ocorrer nos dias pares de setembro.', flags: MessageFlags.Ephemeral }); }
    if (interaction.isButton()) {
        const custom = pos === 'ouro' ? 'olymp_count_gold' : pos === 'prata' ? 'olymp_count_silver' : 'olymp_count_bronze';
        return interaction.update({ content: pos === 'ouro' ? '🥇 **SELECIONE O PAÍS VENCEDOR**' : pos === 'prata' ? '🥈 **SELECIONE O PAÍS EM 2º LUGAR**' : '🥉 **SELECIONE O PAÍS EM 3º LUGAR**', components: countryMenu(custom, [], page, true) });
    }
    const code = interaction.values[0];
    if (state.ouro === code || state.prata === code) return interaction.update({ content: '❌ O mesmo país não pode ocupar duas posições na mesma partida. Escolha outro.', components: countryMenu(`olymp_count_${pos === 'ouro' ? 'gold' : pos === 'prata' ? 'silver' : 'bronze'}`, [], page, true) });
    state[pos] = code;
    if (pos === 'ouro') { state.pos = 'prata'; return interaction.update({ content: '🥈 **SELECIONE O PAÍS EM 2º LUGAR**', components: countryMenu('olymp_count_silver', [state.ouro], 0, true) }); }
    if (pos === 'prata') { state.pos = 'bronze'; return interaction.update({ content: '🥉 **SELECIONE O PAÍS EM 3º LUGAR**', components: countryMenu('olymp_count_bronze', [state.ouro, state.prata], 0, true) }); }
    return askPrint(interaction, state);
}

async function askPrint(interaction, state) {
    const prompt = await interaction.update({ content: '📸 **ENVIE O PRINT DA PARTIDA NESTE CHAT.**\nEnvie uma mensagem com pelo menos uma imagem/anexo. Apenas você será aceito.\n⏱️ Você tem **2 minutos**.', components: [] });
    const channel = interaction.channel;
    const collected = await new Promise(resolve => {
        const collector = channel.createMessageCollector({ time: 120000, max: 1, filter: m => m.author.id === interaction.user.id && !m.author.bot });
        collector.on('collect', m => resolve(m));
        collector.on('end', c => { if (!c.size) resolve(null); });
    });
    if (!collected) { pending.delete(interaction.user.id); return channel.send(`⏱️ <@${interaction.user.id}> a contabilização foi cancelada por falta do print.`).catch(() => {}); }
    const attachment = collected.attachments.first();
    if (!attachment) { pending.delete(interaction.user.id); return channel.send(`❌ <@${interaction.user.id}> a mensagem não tinha imagem/anexo. A contabilização foi cancelada.`).catch(() => {}); }
    const data = read();
    const gold = pairByCountry(data, state.ouro), silver = pairByCountry(data, state.prata), bronze = pairByCountry(data, state.bronze);
    if (!gold || !silver || !bronze) { pending.delete(interaction.user.id); return channel.send('❌ Uma das duplas deixou de existir durante a contabilização.').catch(() => {}); }
    gold.ouro++; silver.prata++; bronze.bronze++;
    const id = `OLY-${Date.now()}`;
    data.resultados.push({ id, vencedor: state.ouro, segundo: state.prata, terceiro: state.bronze, print: attachment.url, autor: interaction.user.id, data: new Date().toISOString() });
    write(data); pending.delete(interaction.user.id);

    const resultChannel = await interaction.guild.channels.fetch(painel.constants.RESULTS_CHANNEL_ID).catch(() => null);
    if (resultChannel?.isTextBased()) {
        const e = new EmbedBuilder().setColor(0xD4AF37).setTitle('🏅 RESULTADO REGISTRADO — OLIMPÍADAS DE DUPLAS')
            .setDescription(`**${id}**\n📅 ${nowBR().toLocaleDateString('pt-BR')}\n👤 Registrado por <@${interaction.user.id}>`)
            .addFields(
                { name: '🥇 1º — VITÓRIA', value: `🇺🇳 **${countryName(state.ouro)}**\n${gold.nome}\n<@${gold.jogadores[0]}> + <@${gold.jogadores[1]}>`, inline: false },
                { name: '🥈 2º — DESEMPATE (PESO 3)', value: `🇺🇳 **${countryName(state.prata)}**\n${silver.nome}`, inline: true },
                { name: '🥉 3º — DESEMPATE (PESO 1)', value: `🇺🇳 **${countryName(state.bronze)}**\n${bronze.nome}`, inline: true }
            ).setImage(attachment.url).setFooter({ text: 'Apenas 🥇 conta como vitória. 🥈 e 🥉 são critérios de desempate.' });
        await resultChannel.send({ embeds: [e] }).catch(e2 => console.error('[OLIMPIADAS] Resultado:', e2));
    }
    await painel.publish(interaction.guild).catch(e => console.error('[OLIMPIADAS] Painel:', e));
    return channel.send(`✅ <@${interaction.user.id}> **resultado ${id} registrado!**\n🥇 ${countryName(state.ouro)} venceu.\n📋 Resultado enviado para <#${painel.constants.RESULTS_CHANNEL_ID}>.`).catch(() => {});
}

async function backPanel(interaction) {
    const message = await painel.publish(interaction.guild).catch(() => null);
    if (!message) return interaction.reply({ content: '❌ Não foi possível carregar o painel.', flags: MessageFlags.Ephemeral });
    return interaction.reply({ content: '↩️ Painel atualizado em <#1543944529747382282>.', flags: MessageFlags.Ephemeral });
}

async function handle(interaction) {
    const id = interaction.customId || '';
    if (!id.startsWith('olymp_')) return false;
    if (id === 'olymp_registrar') return registerStart(interaction);
    if (id === 'olymp_reg_users') return registerUsers(interaction);
    if (id === 'olymp_reg_country') return registerCountry(interaction);
    if (id.startsWith('olymp_reg_country_prev_')) return registerCountry(interaction, Number(id.split('_').pop()) - 1);
    if (id.startsWith('olymp_reg_country_next_')) return registerCountry(interaction, Number(id.split('_').pop()) + 1);
    if (id === 'olymp_contabilizar') return countStart(interaction);
    if (id === 'olymp_count_gold') return countCountry(interaction, 'ouro');
    if (id === 'olymp_count_silver') return countCountry(interaction, 'prata');
    if (id === 'olymp_count_bronze') return countCountry(interaction, 'bronze');
    if (id.startsWith('olymp_count_gold_prev_')) return countCountry(interaction, 'ouro', Number(id.split('_').pop()) - 1);
    if (id.startsWith('olymp_count_gold_next_')) return countCountry(interaction, 'ouro', Number(id.split('_').pop()) + 1);
    if (id.startsWith('olymp_count_silver_prev_')) return countCountry(interaction, 'prata', Number(id.split('_').pop()) - 1);
    if (id.startsWith('olymp_count_silver_next_')) return countCountry(interaction, 'prata', Number(id.split('_').pop()) + 1);
    if (id.startsWith('olymp_count_bronze_prev_')) return countCountry(interaction, 'bronze', Number(id.split('_').pop()) - 1);
    if (id.startsWith('olymp_count_bronze_next_')) return countCountry(interaction, 'bronze', Number(id.split('_').pop()) + 1);
    if (id === 'olymp_duplas') return showDuplas(interaction, 0);
    if (id.startsWith('olymp_duplas_prev_')) return showDuplas(interaction, Number(id.split('_').pop()) - 1);
    if (id.startsWith('olymp_duplas_next_')) return showDuplas(interaction, Number(id.split('_').pop()) + 1);
    if (id === 'olymp_guia') return guide(interaction);
    if (id === 'olymp_back_panel') return backPanel(interaction);
    return false;
}

module.exports = { handle, isEvenSeptember, read, write, COUNTRIES };
