const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const path = require('path');
const { safeReadJson } = require('../liga/utils/helpers.js');
const HISTORICO_PATH = path.join(__dirname, 'historico.json');
const STATS_POR_PAGINA = 6;
const CATEGORIAS = {
    liga: { titulo: 'HALL DA FAMA — LIGA', cor: '#3498DB', emoji: '🏆', subtitulo: 'Temporadas, campeões e estatísticas históricas' },
    imperador: { titulo: 'HALL DA FAMA — IMPERADORES', cor: '#F1C40F', emoji: '👑', subtitulo: 'Histórico dos Imperadores' },
    eventos: { titulo: 'HALL DA FAMA — EVENTOS', cor: '#95A5A6', emoji: '⚔️', subtitulo: 'Eventos e competições históricas' },
    records: { titulo: 'HALL DA FAMA — RECORDS', cor: '#E74C3C', emoji: '📊', subtitulo: 'Grandes marcas do servidor' }
};
function texto(v) { return String(v ?? '').trim(); }
function limitar(v, n = 1024) { const s = texto(v); return s.length <= n ? s : `${s.slice(0, n - 3)}...`; }
function idValido(v) { return /^\d{15,22}$/.test(texto(v)); }
function mencao(v) { const s = texto(v); return !s ? null : idValido(s) ? `<@${s}>` : s; }
function campo(name, value, inline = false) { return { name: limitar(name, 256), value: limitar(value || '*Não informado.*'), inline }; }
async function nomeDoJogador(interaction, jogador) {
    const salvo = texto(jogador?.nome || jogador?.displayName || jogador?.username);
    if (salvo && !idValido(salvo)) return salvo;
    const id = jogador?.id || jogador?.userId || jogador?.jogadorId || (idValido(salvo) ? salvo : null);
    if (!id) return salvo || 'Jogador';
    try { const membro = await interaction.guild?.members?.fetch(String(id)); if (membro) return membro.displayName || membro.user.globalName || membro.user.username; } catch {}
    try { const usuario = await interaction.client?.users?.fetch(String(id)); if (usuario) return usuario.globalName || usuario.username || `Jogador ${id}`; } catch {}
    return `Jogador ${id}`;
}
function carregarHistorico() {
    const d = safeReadJson(HISTORICO_PATH) || {};
    return { liga: Array.isArray(d.liga) ? d.liga : [], imperador: Array.isArray(d.imperador) ? d.imperador : [], eventos: Array.isArray(d.eventos) ? d.eventos : [], records: Array.isArray(d.records) ? d.records : [] };
}
function estatisticasDeRegistro(r) {
    if (!r || typeof r !== 'object') return [];
    const fonte = r.estatisticas ?? r.rankingCompleto ?? r.stats ?? r.top10 ?? r.ranking ?? [];
    if (Array.isArray(fonte)) return fonte.filter(Boolean);
    if (fonte && typeof fonte === 'object') return Object.entries(fonte).map(([id, d]) => ({ ...(d && typeof d === 'object' ? d : { pontos: d }), id: d?.id || id }));
    return [];
}
function normalizarRegistros(categoria, lista) {
    const saida = []; let atual = null; const fechar = () => { if (atual) saida.push(atual); atual = null; };
    for (const item of lista) {
        if (item && typeof item === 'object') { fechar(); saida.push(item); continue; }
        const linha = texto(item); if (!linha) continue;
        if (categoria === 'liga' || categoria === 'imperador') {
            const m = linha.match(/^\*\*📅\s*(\d{4})\*\*$/u);
            if (m) { fechar(); atual = { __legacy: true, tipo: 'ano', ano: m[1], nome: m[1], linhas: [] }; }
            else { if (!atual) atual = { __legacy: true, tipo: 'ano', ano: 'Histórico', nome: 'Histórico', linhas: [] }; atual.linhas.push(linha.replace(/\*\*/g, '').trim()); }
            continue;
        }
        if (categoria === 'eventos') {
            const m = linha.match(/^([^\s]+)\s+\*\*(.+)\*\*$/u);
            if (m) { fechar(); atual = { __legacy: true, tipo: 'evento', emoji: m[1], nome: m[2].trim(), linhas: [] }; }
            else { if (!atual) atual = { __legacy: true, tipo: 'evento', emoji: '⚔️', nome: 'Evento histórico', linhas: [] }; atual.linhas.push(linha.replace(/\*\*/g, '').trim()); }
            continue;
        }
        if (categoria === 'records') { if (!atual) atual = { __legacy: true, tipo: 'records', nome: 'Records históricos', linhas: [] }; atual.linhas.push(linha.replace(/\*\*/g, '').trim()); }
    }
    fechar(); return saida;
}
function ranking(r) { return estatisticasDeRegistro(r).filter(x => x && (x.id || x.userId || x.jogadorId || x.nome)).map(x => ({ ...x, id: x.id || x.userId || x.jogadorId })).sort((a, b) => (Number(b.pontos) || 0) - (Number(a.pontos) || 0)); }
function linhaTop10(lista) { if (!lista.length) return '*Nenhuma classificação arquivada.*'; return lista.slice(0, 10).map((j, i) => `${['🥇','🥈','🥉'][i] || `**${i + 1}º**`} ${j.nome && !idValido(j.nome) ? j.nome : mencao(j.id) || 'Jogador'} — **${Number(j.pontos) || 0} pts**`).join('\n'); }
function formatar(categoria, r) {
    if (r?.__legacy) {
        if (r.tipo === 'ano') return { titulo: `${categoria === 'liga' ? '🏆 Liga' : '👑 Imperador'} — ${r.ano}`, descricao: '📜 **Registro histórico consolidado**', campos: [campo('🗓️ CAMPEÕES / REGISTROS', r.linhas.join('\n'))], stats: [], liga: false };
        if (r.tipo === 'evento') return { titulo: `${r.emoji} ${r.nome}`, descricao: '🏅 **Registro histórico do evento**', campos: [campo('🏆 RESULTADO', r.linhas.join('\n'))], stats: [], liga: false };
        return { titulo: '📊 Records históricos', descricao: '📈 **Grandes marcas do WorldWarBR**', campos: [campo('🏅 RECORDS', r.linhas.join('\n'))], stats: [], liga: false };
    }
    const liga = categoria === 'liga' || r?.categoria === 'liga', stats = estatisticasDeRegistro(r), top = ranking(r), campos = [];
    if (r.ano) campos.push(campo('📅 TEMPORADA', r.ano, true));
    if (r.tipo && r.tipo !== 'temporada') campos.push(campo('🏷️ TIPO', r.tipo, true));
    if (r.data) campos.push(campo('📅 DATA', r.horario ? `${r.data} às ${r.horario}` : r.data, true));
    if (r.vencedor) campos.push(campo('🥇 CAMPEÃO', r.vencedor, true));
    if (r.segundo) campos.push(campo('🥈 2º LUGAR', r.segundo, true));
    if (r.terceiro) campos.push(campo('🥉 3º LUGAR', r.terceiro, true));
    if (Array.isArray(r.meses) && r.meses.length) campos.push(campo('🗓️ CAMPEÕES POR MÊS', r.meses.join('\n')));
    if (Array.isArray(r.linhas) && r.linhas.length) campos.push(campo('📜 REGISTRO', r.linhas.join('\n')));
    if (r.participantes) campos.push(campo('👥 PARTICIPANTES', r.participantes));
    if (r.totalCompetidores !== undefined) campos.push(campo('👥 PARTICIPANTES', r.totalCompetidores, true));
    if (r.premio) campos.push(campo('🎁 PRÊMIO', r.premio, true));
    if (r.valor !== null && r.valor !== undefined) campos.push(campo('📊 VALOR', r.valor, true));
    if (r.descricao) campos.push(campo('📝 DESCRIÇÃO', r.descricao));
    if (r.observacoes) campos.push(campo('📌 OBSERVAÇÕES', r.observacoes));
    if (liga && top.length) campos.push(campo('🏆 TOP 10 — CLASSIFICAÇÃO FINAL', linhaTop10(top)));
    return { titulo: r.nome || (liga ? 'Liga' : 'Registro histórico'), descricao: liga ? '🏆 **Temporada arquivada no Hall da Fama**' : (r.descricao || '📜 **Registro oficial**'), campos, imagem: r.imagem || null, stats, liga };
}
function pagina(total, atual) { const t = Math.max(1, Number(total) || 0); const p = Math.min(Math.max(1, Number(atual) || 1), t); return { p, t }; }
function nav(cat, p, t) { return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`hist_ephem_first_${cat}`).setLabel('Primeiro').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(p <= 1), new ButtonBuilder().setCustomId(`hist_ephem_prev_${cat}_${p}`).setLabel('Anterior').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(p <= 1), new ButtonBuilder().setCustomId(`hist_ephem_page_${cat}_${p}`).setLabel(`${p}/${t}`).setEmoji('📄').setStyle(ButtonStyle.Primary).setDisabled(true), new ButtonBuilder().setCustomId(`hist_ephem_next_${cat}_${p}`).setLabel('Próximo').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(p >= t), new ButtonBuilder().setCustomId('hist_ephem_fechar').setLabel('Fechar').setEmoji('✖️').setStyle(ButtonStyle.Danger)); }
function botoesEvento(cat, p, t, stats) { const rows = [nav(cat, p, t)]; if (cat === 'liga' && stats) rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`hist_liga_stats_${p}`).setLabel('Ver estatísticas completas').setEmoji('📊').setStyle(ButtonStyle.Primary))); return rows; }
function embedEvento(cat, r, p, t) { const c = CATEGORIAS[cat], f = formatar(cat, r), e = new EmbedBuilder().setColor(c.cor).setAuthor({ name: `${c.emoji} ${c.titulo}` }).setTitle(limitar(f.titulo, 256)).setDescription(`${c.subtitulo}\n\n${f.descricao}`); for (const x of f.campos) e.addFields(x); if (f.liga && f.stats.length) e.addFields(campo('📊 ESTATÍSTICAS COMPLETAS', 'Os dados desta temporada estão congelados no histórico. Use o botão abaixo para consultar todos os jogadores.')); if (f.imagem) { try { e.setImage(new URL(f.imagem).toString()); } catch {} } e.addFields(campo('━━━━━━━━━━━━━━━━━━━━', `📄 **Ficha ${p}/${t}** • Registro oficial`)); e.setFooter({ text: 'WorldWarBR • Hall da Fama • A história nunca é apagada.' }); return e; }
function embedStats(r, p, t, nomes = {}) {
    const stats = estatisticasDeRegistro(r), slice = stats.slice((p - 1) * STATS_POR_PAGINA, p * STATS_POR_PAGINA);
    const e = new EmbedBuilder().setColor('#2ECC71').setAuthor({ name: '📊 HALL DA FAMA — ESTATÍSTICAS DA TEMPORADA' }).setTitle(limitar(r?.nome || 'Temporada', 256)).setDescription(`🏆 **${r?.vencedor || 'Campeão não arquivado'}**\n\n📄 Página **${p}/${t}** • **${stats.length}** jogador(es)`);
    slice.forEach((j, i) => {
        const pos = (p - 1) * STATS_POR_PAGINA + i + 1, id = j.id || j.userId || j.jogadorId;
        const nome = nomes[String(id)] || (j.nome && !idValido(j.nome) ? j.nome : null) || (id ? `Jogador ${id}` : 'Jogador');
        const partidas = Number(j.partidas) || 0, vitorias = Number(j.vitorias) || 0;
        const wr = j.winrate !== undefined ? Number(j.winrate).toFixed(1) : (partidas ? ((vitorias / partidas) * 100).toFixed(1) : '0.0');
        e.addFields({ name: `${['🥇','🥈','🥉'][pos - 1] || `#${pos}`} ${limitar(nome, 180)} — ${Number(j.pontos) || 0} pts`, value: `⚔️ Partidas: **${partidas}** • 🏆 Vitórias: **${vitorias}**\n💀 Kills: **${Number(j.kills) || 0}** • ☠️ Mortes: **${Number(j.mortes) || 0}**\n🌍 Continentes: **${Number(j.continentes) || 0}** • 📈 Winrate: **${wr}%**\n💰 WarCoins: **${Number(j.warCoins) || 0}**` });
    });
    if (!slice.length) e.addFields(campo('📭 SEM DADOS', 'Nenhuma estatística foi arquivada nesta temporada.'));
    e.setFooter({ text: `WorldWarBR • ${r?.nome || 'Temporada'} • Estatísticas congeladas` }); return e;
}
function botoesStats(evento, p, t) { return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`hist_liga_stats_prev_${evento}_${p}`).setLabel('Anterior').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(p <= 1), new ButtonBuilder().setCustomId(`hist_liga_stats_page_${evento}_${p}`).setLabel(`${p}/${t}`).setEmoji('📄').setStyle(ButtonStyle.Primary).setDisabled(true), new ButtonBuilder().setCustomId(`hist_liga_stats_next_${evento}_${p}`).setLabel('Próximo').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(p >= t), new ButtonBuilder().setCustomId(`hist_liga_stats_back_${evento}`).setLabel('Voltar à temporada').setEmoji('🏆').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('hist_ephem_fechar').setLabel('Fechar').setEmoji('✖️').setStyle(ButtonStyle.Danger))]; }
async function mostrar(interaction, cat, p = 1) { const c = CATEGORIAS[cat], registros = normalizarRegistros(cat, carregarHistorico()[cat]); if (!c) return interaction.reply({ content: '❌ Categoria inválida.', flags: MessageFlags.Ephemeral }); if (!registros.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(c.cor).setTitle('📭 Nenhum registro').setDescription('Nenhuma ficha histórica foi encontrada.')], components: [nav(cat, 1, 1)], flags: MessageFlags.Ephemeral }); const pg = pagina(registros.length, p), r = registros[pg.p - 1], f = formatar(cat, r); return interaction.reply({ embeds: [embedEvento(cat, r, pg.p, pg.t)], components: botoesEvento(cat, pg.p, pg.t, f.liga && f.stats.length > 0), flags: MessageFlags.Ephemeral }); }
async function atualizar(interaction, cat, p) { const registros = normalizarRegistros(cat, carregarHistorico()[cat]); if (!registros.length) return interaction.update({ content: '📭 Nenhum registro encontrado.', embeds: [], components: [] }); const pg = pagina(registros.length, p), r = registros[pg.p - 1], f = formatar(cat, r); return interaction.update({ content: '', embeds: [embedEvento(cat, r, pg.p, pg.t)], components: botoesEvento(cat, pg.p, pg.t, f.liga && f.stats.length > 0) }); }
async function stats(interaction, evento, p) { const registros = normalizarRegistros('liga', carregarHistorico().liga); if (!registros.length) return interaction.update({ content: '📭 Nenhuma temporada arquivada.', embeds: [], components: [] }); const pe = pagina(registros.length, evento), r = registros[pe.p - 1], dados = estatisticasDeRegistro(r); if (!dados.length) return interaction.update({ content: '📭 Esta temporada não possui estatísticas arquivadas.', embeds: [], components: [] }); const ps = pagina(Math.ceil(dados.length / STATS_POR_PAGINA), p), ids = dados.map(j => j?.id || j?.userId || j?.jogadorId).filter(Boolean), nomes = {}; await Promise.all(ids.map(async id => { nomes[String(id)] = await nomeDoJogador(interaction, { id }); })); return interaction.update({ content: '', embeds: [embedStats(r, ps.p, ps.t, nomes)], components: botoesStats(pe.p, ps.p, ps.t) }); }
module.exports = async interaction => { const id = texto(interaction.customId); if (id === 'hist_liga' || id === 'hist_imperador' || id === 'hist_eventos' || id === 'hist_records') return mostrar(interaction, id.replace('hist_', ''), 1); if (id.startsWith('hist_ephem_first_')) return atualizar(interaction, id.split('_')[3], 1); if (id.startsWith('hist_ephem_prev_')) { const x = id.split('_'); return atualizar(interaction, x[3], Number(x[4]) - 1); } if (id.startsWith('hist_ephem_next_')) { const x = id.split('_'); return atualizar(interaction, x[3], Number(x[4]) + 1); } if (id.startsWith('hist_ephem_page_')) return; if (/^hist_liga_stats_\d+$/.test(id)) return stats(interaction, Number(id.split('_')[3]), 1); if (id.startsWith('hist_liga_stats_prev_')) { const x = id.split('_'); return stats(interaction, Number(x[4]), Number(x[5]) - 1); } if (id.startsWith('hist_liga_stats_next_')) { const x = id.split('_'); return stats(interaction, Number(x[4]), Number(x[5]) + 1); } if (id.startsWith('hist_liga_stats_page_')) return; if (id.startsWith('hist_liga_stats_back_')) return atualizar(interaction, 'liga', Number(id.split('_')[4])); if (id === 'hist_ephem_fechar') return interaction.update({ content: '✅ **Hall da Fama fechado.**', embeds: [], components: [] }); };
