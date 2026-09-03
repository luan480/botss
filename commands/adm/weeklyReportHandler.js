/* ========================================================================
   ARQUIVO: commands/adm/weeklyReportHandler.js
   ======================================================================== */

const { EmbedBuilder } = require('discord.js');
const path = require('path');

const { safeReadJson, safeWriteJson } = require('../liga/utils/helpers.js');
const periodosLiga = require('../liga/utils/periodosLiga.js');
const recordsLiga = require('../liga/utils/recordsLiga.js');

const CANAL_RELATORIO_ID = '1228294929546219530';
const INTERVALO_VERIFICACAO = 60 * 60 * 1000;

const CARGOS_LIGA = {
    CAMPEAO: '1429934221216186458',
    BI: '1159617895995801680',
    TRI: '1147960837215092817',
    LENDA: '1088105642327293962'
};

const CARGOS_SEMANAIS = {
    EUROPA: '1542543082325803098',
    ASIA: '1542543277906075818',
    AFRICA: '1542542996803821568',
    AMNORTE: '1542541962324738170',
    AMSUL: '1542543277906075818',
    OCEANIA: '1542542579445407754',
    ACOUGUEIRO: '1545125030705369138',
    IMA_BALA: '1545125303222014044',
    VETERANO: '1545125339511001128'
};

const paths = {
    progressao: path.join(__dirname, '../promocao/progressao.json'),
    economy: path.join(__dirname, '../economy/economy.json'),
    pontuacao: path.join(__dirname, '../liga/pontuacao.json'),
    partidas: path.join(__dirname, '../liga/partidas.json'),
    historico: path.join(__dirname, '../promocao/historico.json'),
    controle: path.join(__dirname, '../liga/controleRelatorios.json'),
    olimpiadas: path.join(__dirname, '../olimpiadas/olimpiadas.json')
};

function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
}

function dataBonita(data) {
    if (!data) return 'data desconhecida';
    const d = data instanceof Date ? data : new Date(data);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString('pt-BR') : 'data desconhecida';
}

function mencionar(jogador) {
    return jogador?.id ? `<@${jogador.id}>` : '*Nenhum registro.*';
}

function carregarControle() {
    const dados = safeReadJson(paths.controle);
    return dados && typeof dados === 'object' ? dados : {};
}

function salvarControle(dados) {
    safeWriteJson(paths.controle, dados);
}

function carregarHistorico() {
    const dados = safeReadJson(paths.historico);
    const historico = dados && typeof dados === 'object' ? dados : {};
    if (!Array.isArray(historico.liga)) historico.liga = [];
    if (!Array.isArray(historico.imperador)) historico.imperador = [];
    if (!Array.isArray(historico.eventos)) historico.eventos = [];
    if (!Array.isArray(historico.records)) historico.records = [];
    return historico;
}

function salvarHistorico(historico) {
    safeWriteJson(paths.historico, historico);
}

function calcularMesAnterior(data = new Date()) {
    const atual = data instanceof Date ? data : new Date(data);
    const inicio = new Date(atual.getFullYear(), atual.getMonth() - 1, 1);
    const fim = new Date(atual.getFullYear(), atual.getMonth(), 1);
    return periodosLiga.calcularPeriodo(inicio, fim);
}

function chavePeriodo(tipo, inicio, fim) {
    const i = inicio instanceof Date ? inicio : new Date(inicio);
    const f = fim instanceof Date ? fim : new Date(fim);
    return `${tipo}-${i.getFullYear()}-${i.getMonth() + 1}-${i.getDate()}-${f.getFullYear()}-${f.getMonth() + 1}-${f.getDate()}`;
}

function topPor(periodo, propriedade, limite = 3) {
    return Object.values(periodo?.jogadores || {})
        .filter(jogador => numero(jogador?.[propriedade]) > 0)
        .sort((a, b) =>
            numero(b?.[propriedade]) - numero(a?.[propriedade]) ||
            numero(b?.pontos) - numero(a?.pontos) ||
            String(a?.id || '').localeCompare(String(b?.id || ''))
        )
        .slice(0, limite);
}

function vencedorDe(periodo, propriedade) {
    return topPor(periodo, propriedade, 1)[0] || null;
}

function formatarTop(lista, propriedade, unidade) {
    if (!lista?.length) return '*Sem registros.*';
    const medalhas = ['🥇', '🥈', '🥉'];
    return lista.map((jogador, index) =>
        `${medalhas[index] || '•'} ${mencionar(jogador)} — **${numero(jogador?.[propriedade])} ${unidade}**`
    ).join('\n');
}

function formatarImperadorContinente(periodo, propriedade, nome, tituloTag) {
    const vencedor = vencedorDe(periodo, propriedade);
    if (!vencedor) return `${nome}: *Sem disputa registrada.*`;
    return `${nome}: ${mencionar(vencedor)} — **${tituloTag}** (${numero(vencedor[propriedade])} domínios)`;
}

function normalizarTexto(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function obterLiderOlimpiadas() {
    const dados = safeReadJson(paths.olimpiadas);
    if (!dados || typeof dados !== 'object') return null;

    const duplas = Array.isArray(dados.duplas) ? dados.duplas : [];
    const resultados = Array.isArray(dados.resultados) ? dados.resultados : [];
    const porDupla = new Map(duplas.map(dupla => [String(dupla.id), dupla]));
    const ranking = new Map();

    for (const resultado of resultados) {
        for (const [id, medalha] of [
            [resultado?.ouro, 'ouro'],
            [resultado?.prata, 'prata'],
            [resultado?.bronze, 'bronze']
        ]) {
            if (!id) continue;
            const dupla = porDupla.get(String(id));
            if (!dupla?.pais) continue;

            const chave = normalizarTexto(dupla.pais);
            if (!ranking.has(chave)) {
                ranking.set(chave, { pais: dupla.pais, vitorias: 0, ouro: 0, prata: 0, bronze: 0, desempate: 0 });
            }

            const item = ranking.get(chave);
            item[medalha]++;
            if (medalha === 'ouro') item.vitorias++;
            else if (medalha === 'prata') item.desempate += 3;
            else if (medalha === 'bronze') item.desempate += 1;
        }
    }

    return [...ranking.values()].sort((a, b) =>
        b.vitorias - a.vitorias || b.ouro - a.ouro || b.prata - a.prata ||
        b.bronze - a.bronze || b.desempate - a.desempate ||
        normalizarTexto(a.pais).localeCompare(normalizarTexto(b.pais))
    )[0] || null;
}

function formatarLiderOlimpiadas() {
    const lider = obterLiderOlimpiadas();
    if (!lider) return '🌎 **Ainda não há resultados nas Olimpíadas.**';
    return [
        `🌎 **${lider.pais}** está na liderança!`,
        `🏆 **${lider.vitorias} vitória${lider.vitorias === 1 ? '' : 's'}** • 🥇 ${lider.ouro} • 🥈 ${lider.prata} • 🥉 ${lider.bronze}`
    ].join('\n');
}

async function rotacionarCargo(guild, roleId, vencedorId) {
    if (!roleId) return { configurado: false, alterado: false };
    try {
        const role = await guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
            console.error(`[BOLETIM] Cargo não encontrado: ${roleId}`);
            return { configurado: true, alterado: false };
        }
        for (const [memberId, member] of role.members) {
            if (memberId !== vencedorId) await member.roles.remove(roleId).catch(() => {});
        }
        if (vencedorId) {
            const membro = await guild.members.fetch(vencedorId).catch(() => null);
            if (membro) await membro.roles.add(roleId).catch(() => {});
        }
        return { configurado: true, alterado: Boolean(vencedorId) };
    } catch (erro) {
        console.error('[BOLETIM] Erro no rodízio:', erro);
        return { configurado: true, alterado: false };
    }
}

function registrarHistoricoSemanal(semana, destaques) {
    const historico = carregarHistorico();
    const chave = chavePeriodo('semanal', semana.inicio, semana.fim);
    if (!historico.imperador.some(item => item?.chave === chave)) {
        historico.imperador.push({
            chave, inicio: semana.inicio, fim: semana.fim,
            imperadores: {
                europa: destaques.europa?.id || null, asia: destaques.asia?.id || null,
                africa: destaques.africa?.id || null, amnorte: destaques.amnorte?.id || null,
                amsul: destaques.amsul?.id || null, oceania: destaques.oceania?.id || null
            },
            olimpíadas: destaques.olimpiadas?.pais || null,
            kills: destaques.kills?.[0]?.id || null,
            mortes: destaques.mortes?.[0]?.id || null,
            partidas: destaques.partidas?.[0]?.id || null,
            streak: destaques.maiorStreak?.id || null,
            evolucao: destaques.maiorEvolucao?.id || null
        });
        salvarHistorico(historico);
    }
}

function registrarHistoricoMensal(mes, destaques) {
    const historico = carregarHistorico();
    const chave = chavePeriodo('mensal', mes.inicio, mes.fim);
    if (!historico.liga.some(item => item?.chave === chave)) {
        historico.liga.push({
            chave, inicio: mes.inicio, fim: mes.fim,
            temporada: `${mes.inicio.getFullYear()}-${String(mes.inicio.getMonth() + 1).padStart(2, '0')}`,
            vencedor: destaques.reiLiga?.id || null,
            campeao: destaques.reiLiga?.id || null,
            rankingCompleto: Object.values(mes.jogadores || {}).sort((a, b) =>
                numero(b?.pontos) - numero(a?.pontos) || numero(b?.vitorias) - numero(a?.vitorias) || numero(b?.kills) - numero(a?.kills)
            ),
            resumo: destaques.resumo
        });
        salvarHistorico(historico);
    }
    try { recordsLiga.obterRecords(); }
    catch (erro) { console.error('[BOLETIM] Erro ao recalcular records:', erro); }
}

async function emitirBoletimSemanal(client) {
    const canal = await client.channels.fetch(CANAL_RELATORIO_ID).catch(() => null);
    if (!canal) {
        console.error('[BOLETIM] Canal semanal não encontrado.');
        return false;
    }

    const guild = canal.guild;
    const semana = periodosLiga.calcularSemanaAtual();
    const vitorias = topPor(semana, 'vitorias', 3);
    const kills = topPor(semana, 'kills', 3);
    const partidas = topPor(semana, 'partidas', 3);
    const mortes = topPor(semana, 'mortes', 3);
    const europa = vencedorDe(semana, 'europa');
    const asia = vencedorDe(semana, 'asia');
    const africa = vencedorDe(semana, 'africa');
    const amnorte = vencedorDe(semana, 'amnorte');
    const amsul = vencedorDe(semana, 'amsul');
    const oceania = vencedorDe(semana, 'oceania');
    const liderOlimpiadas = obterLiderOlimpiadas();
    const streaks = periodosLiga.rankingStreak(semana, 3);
    const maiorStreak = streaks[0] || null;
    const evolucao = periodosLiga.calcularEvolucaoSemanal();
    const maiorEvolucao = evolucao.find(item => numero(item?.variacao) > 0) || null;
    const resumo = periodosLiga.resumoPeriodo(semana);

    await rotacionarCargo(guild, CARGOS_SEMANAIS.EUROPA, europa?.id);
    await rotacionarCargo(guild, CARGOS_SEMANAIS.ASIA, asia?.id);
    await rotacionarCargo(guild, CARGOS_SEMANAIS.AFRICA, africa?.id);
    await rotacionarCargo(guild, CARGOS_SEMANAIS.AMNORTE, amnorte?.id);
    await rotacionarCargo(guild, CARGOS_SEMANAIS.AMSUL, amsul?.id);
    await rotacionarCargo(guild, CARGOS_SEMANAIS.OCEANIA, oceania?.id);
    await rotacionarCargo(guild, CARGOS_SEMANAIS.ACOUGUEIRO, kills[0]?.id);
    await rotacionarCargo(guild, CARGOS_SEMANAIS.IMA_BALA, mortes[0]?.id);
    await rotacionarCargo(guild, CARGOS_SEMANAIS.VETERANO, partidas[0]?.id);

    const embed = new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle('👑 EVENTO ESPECIAL — IMPERADOR MUNDIAL 🌍')
        .setDescription([
            '📡 **RESULTADOS DO DOMÍNIO GLOBAL**', '',
            `📅 ${dataBonita(semana.inicio)} → ${dataBonita(semana.fim)}`, '',
            `🏟️ **${resumo.partidas} partidas de guerra jogadas**`,
            `👥 **${resumo.jogadores} combatentes ativos**`,
            `💀 **${resumo.kills} kills** • ☠️ **${resumo.mortes} mortes**`
        ].join('\n'))
        .addFields(
            {
                name: '👑 IMPERADORES MUNDIAIS (DOMINGO)',
                value: [
                    formatarImperadorContinente(semana, 'amnorte', '❄️ Norte', 'Imperador do Norte'),
                    formatarImperadorContinente(semana, 'africa', '🌍 África', 'Imperador Africano'),
                    formatarImperadorContinente(semana, 'europa', '🏰 Europa', 'Imperador Europeu'),
                    formatarImperadorContinente(semana, 'amsul', '🌎 América do Sul', 'Imperador Sul-Americano'),
                    formatarImperadorContinente(semana, 'asia', '⛩️ Ásia', 'Imperador Asiático'),
                    formatarImperadorContinente(semana, 'oceania', '🦘 Oceania', 'Imperador da Oceania')
                ].join('\n'), inline: false
            },
            {
                name: '🏅 OLIMPÍADAS DE DUPLAS',
                value: formatarLiderOlimpiadas(), inline: false
            },
            {
                name: '🏆 DESTAQUES DA LIGA',
                value: ['✅ **TOP 3 — VITÓRIAS**', formatarTop(vitorias, 'vitorias', 'vitórias')].join('\n'), inline: false
            },
            {
                name: '⚔️ DESTAQUES DE COMBATE',
                value: [
                    '💀 **Açougueiro**', formatarTop(kills.slice(0, 1), 'kills', 'kills'), '',
                    '☠️ **Ímã de Bala**', formatarTop(mortes.slice(0, 1), 'mortes', 'mortes'), '',
                    '⚔️ **Veterano de Guerra**', formatarTop(partidas.slice(0, 1), 'partidas', 'partidas')
                ].join('\n'), inline: false
            },
            {
                name: '🔥 STREAK',
                value: maiorStreak ? `<@${maiorStreak.id}> — **${numero(maiorStreak.maiorStreak)} vitórias consecutivas**` : '*Nenhum streak registrado.*', inline: true
            },
            {
                name: '📈 ASCENSÃO DA SEMANA',
                value: maiorEvolucao ? `<@${maiorEvolucao.id}> — **+${numero(maiorEvolucao.variacao)} pts**` : '*Nenhuma evolução positiva.*', inline: true
            }
        )
        .setFooter({ text: 'WorldWarBR • Evento Especial Imperador Mundial concluído.', iconURL: guild.iconURL() })
        .setTimestamp();

    await canal.send({
        content: '@everyone 👑 **RESULTADO DO EVENTO: IMPERADOR MUNDIAL!** Os tronos foram reclamados!',
        embeds: [embed]
    });

    registrarHistoricoSemanal(semana, {
        europa, asia, africa, amnorte, amsul, oceania,
        olimpiadas: liderOlimpiadas, kills, mortes, partidas, maiorStreak, maiorEvolucao
    });

    console.log('[BOLETIM] Boletim do Evento Especial publicado com sucesso.');
    return true;
}

async function emitirRelatorioMensal(client) {
    const canal = await client.channels.fetch(CANAL_RELATORIO_ID).catch(() => null);
    if (!canal) {
        console.error('[BOLETIM] Canal mensal não encontrado.');
        return false;
    }

    const guild = canal.guild;
    const mes = calcularMesAnterior();
    const reiLiga = vencedorDe(mes, 'pontos');
    const vitorias = topPor(mes, 'vitorias', 3);
    const kills = topPor(mes, 'kills', 3);
    const partidas = topPor(mes, 'partidas', 3);
    const mortes = topPor(mes, 'mortes', 3);
    const continentes = topPor(mes, 'continentes', 3);
    const resumo = periodosLiga.resumoPeriodo(mes);
    const evolucao = periodosLiga.calcularEvolucaoMensal(new Date(mes.fim.getTime() - 1));
    const maiorEvolucao = evolucao.find(item => numero(item?.variacao) > 0) || null;
    const mesNome = mes.inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('🏆 FECHAMENTO MENSAL — WORLDWARBR')
        .setDescription([
            '📊 **TEMPORADA MENSAL ENCERRADA**', '',
            `📅 **${mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}**`,
            `🗓️ ${dataBonita(mes.inicio)} → ${dataBonita(new Date(mes.fim.getTime() - 1))}`, '',
            `🏟️ **${resumo.partidas} partidas**`, `👥 **${resumo.jogadores} jogadores ativos**`,
            `💀 **${resumo.kills} kills** • ☠️ **${resumo.mortes} mortes**`,
            `🌍 **${resumo.continentes} conquistas de continente**`
        ].join('\n'))
        .addFields(
            {
                name: '👑 CAMPEÃO DO MÊS',
                value: reiLiga ? `${mencionar(reiLiga)} — **${numero(reiLiga.pontos)} pts**\n🏆 ${numero(reiLiga.vitorias)} vitórias • 💀 ${numero(reiLiga.kills)} kills • ⚔️ ${numero(reiLiga.partidas)} partidas` : '*Nenhum jogador com pontuação registrada.*',
                inline: false
            },
            { name: '🥇 TOP 3 — VITÓRIAS', value: formatarTop(vitorias, 'vitorias', 'vitórias'), inline: true },
            { name: '💀 TOP 3 — KILLS', value: formatarTop(kills, 'kills', 'kills'), inline: true },
            { name: '⚔️ TOP 3 — PARTIDAS', value: formatarTop(partidas, 'partidas', 'partidas'), inline: true },
            { name: '🌍 TOP 3 — CONTINENTES', value: formatarTop(continentes, 'continentes', 'conquistas'), inline: true },
            { name: '☠️ TOP 3 — MORTES', value: formatarTop(mortes, 'mortes', 'mortes'), inline: true },
            { name: '📈 EVOLUÇÃO', value: maiorEvolucao ? `<@${maiorEvolucao.id}> — **+${numero(maiorEvolucao.variacao)} pts** em relação ao mês anterior` : '*Nenhuma evolução positiva registrada.*', inline: true },
            { name: '📊 RECORDS HISTÓRICOS', value: (() => { try { return recordsLiga.gerarTextoRecords(); } catch { return '*Records ainda não disponíveis.*'; } })(), inline: false }
        )
        .setFooter({ text: 'WorldWarBR • Fechamento mensal registrado no histórico.', iconURL: guild.iconURL() })
        .setTimestamp();

    await canal.send({
        content: '@everyone 🏆 **FECHAMENTO MENSAL DA LIGA!** O mês foi encerrado e os destaques foram registrados.',
        embeds: [embed]
    });

    registrarHistoricoMensal(mes, { reiLiga, resumo });
    console.log('[BOLETIM] Fechamento mensal publicado com sucesso.');
    return true;
}

function iniciarMuralGuerra(client) {
    console.log('✅ Sistema de Relatórios do Imperador Mundial ativado.');
    let executando = false;

    const verificar = async () => {
        if (executando) return;
        executando = true;
        try {
            const agora = new Date();
            const diaSemana = agora.getDay();
            const diaMes = agora.getDate();
            const hora = agora.getHours();
            const controle = carregarControle();

            if (diaSemana === 0 && hora === 20) {
                const semana = periodosLiga.calcularSemanaAtual(agora);
                const chave = chavePeriodo('semanal', semana.inicio, semana.fim);
                if (controle.ultimoSemanal !== chave) {
                    const sucesso = await emitirBoletimSemanal(client);
                    if (sucesso) { controle.ultimoSemanal = chave; salvarControle(controle); }
                }
            }

            if (diaMes === 1 && hora === 0) {
                const mesAnterior = calcularMesAnterior(agora);
                const chave = chavePeriodo('mensal', mesAnterior.inicio, mesAnterior.fim);
                if (controle.ultimoMensal !== chave) {
                    const sucesso = await emitirRelatorioMensal(client);
                    if (sucesso) { controle.ultimoMensal = chave; salvarControle(controle); }
                }
            }
        } catch (erro) {
            console.error('[BOLETIM] Erro no agendador:', erro);
        } finally {
            executando = false;
        }
    };

    verificar().catch(erro => console.error('[BOLETIM] Erro na verificação inicial:', erro));
    setInterval(verificar, INTERVALO_VERIFICACAO);
}

iniciarMuralGuerra.emitirBoletimSemanal = emitirBoletimSemanal;
iniciarMuralGuerra.emitirRelatorioMensal = emitirRelatorioMensal;
iniciarMuralGuerra.calcularMesAnterior = calcularMesAnterior;
iniciarMuralGuerra.CARGOS_LIGA = CARGOS_LIGA;
iniciarMuralGuerra.CARGOS_SEMANAIS = CARGOS_SEMANAIS;

module.exports = iniciarMuralGuerra;
