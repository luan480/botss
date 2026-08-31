/* ========================================================================
   WORLDWARBR — OLIMPÍADAS DE DUPLAS
   Localização: commands/olimpiadas/olimpiadas-handler.js
   Sistema independente da Liga.
   ======================================================================== */
const fs = require('fs');
const path = require('path');
const {
  EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder,
  UserSelectMenuBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags
} = require('discord.js');

const FILE = path.join(__dirname, 'olimpiadas.json');
const CONFIG = require(FILE);

function load(){ try{return JSON.parse(fs.readFileSync(FILE,'utf8'));}catch{return {...CONFIG,duplas:[],resultados:[],ranking:{}};} }
function save(d){fs.writeFileSync(FILE,JSON.stringify(d,null,2),'utf8');}
function permitidoRegistro(){const d=new Date();return d.getFullYear()===CONFIG.ano&&d.getMonth()===CONFIG.mes-1&&d.getDate()%2===0;}
function esc(v){return String(v??'').replace(/[`*_~|]/g,'');}
function dupla(data,id){return data.duplas.find(x=>x.id===id);}
function paisOcupado(data,pais){return data.duplas.some(x=>x.pais.toLowerCase()===pais.toLowerCase());}
function menuPaises(data,id,placeholder,exclude=[]){
  const paises=[...new Set(data.duplas.map(x=>x.pais))].filter(p=>!exclude.includes(p));
  const options=paises.slice(0,25).map(p=>({label:p.slice(0,100),value:p.slice(0,100)}));
  if(!options.length)return null;
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).addOptions(options));
}
function ranking(data){
  const r={};
  for(const jogo of data.resultados){
    for(const [id,tipo] of [[jogo.ouro,'ouro'],[jogo.prata,'prata'],[jogo.bronze,'bronze']]){
      const d=dupla(data,id);if(!d)continue;
      if(!r[id])r[id]={vitorias:0,segundo:0,terceiro:0,desempate:0};
      if(tipo==='ouro')r[id].vitorias++;
      if(tipo==='prata'){r[id].segundo++;r[id].desempate+=3;}
      if(tipo==='bronze'){r[id].terceiro++;r[id].desempate+=1;}
    }
  }
  return r;
}
function embedPainel(data){
  const vivos=data.duplas.length;
  return new EmbedBuilder().setColor('#D4AF37').setTitle('🟨 OLIMPÍADAS DE DUPLAS').setDescription([
    '**Vencedores:** <@&1543391902252933170>','',
    'Cada dupla escolherá um País para representar.','Todos os dias pares do mês de Setembro!','',
    '🏅 **Classificação**','🥇 Vitória = critério principal','🥈 2º lugar = peso 3 para desempate','🥉 3º lugar = peso 1 para desempate','',
    `👥 Duplas inscritas: **${vivos}**`,`📊 Resultados contabilizados: **${data.resultados.length}**`,'',
    '⏱️ Partida: **1h30min**','⚠️ As Olimpíadas terão apenas **DOIS vencedores**.'
  ].join('\n')).setImage(CONFIG.imagem).setFooter({text:'WorldWarBR • Olimpíadas de Duplas'});
}
function botoesPainel(){return new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('olymp_contabilizar').setLabel('Contabilizar').setEmoji('🏅').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('olymp_duplas').setLabel('Ver todas as duplas').setEmoji('👥').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('olymp_registrar').setLabel('Registrar dupla').setEmoji('📝').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('olymp_ranking').setLabel('Rankings').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('olymp_guia').setLabel('Guia').setEmoji('📖').setStyle(ButtonStyle.Secondary)
);}
async function painel(interaction){const data=load();return interaction.reply({embeds:[embedPainel(data)],components:[botoesPainel()]});}

async function registrarInicio(i){
  if(!permitidoRegistro())return i.reply({content:'🚫 O registro de duplas só pode ser acionado nos **dias pares de setembro de 2026**.',flags:MessageFlags.Ephemeral});
  return i.reply({content:'📝 **REGISTRO — JOGADOR 1**\nSelecione o primeiro integrante da dupla.',components:[new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('olymp_reg_p1').setPlaceholder('Selecione o jogador 1'))],flags:MessageFlags.Ephemeral});
}
async function registrarP1(i){const u=i.values[0];return i.update({content:'📝 **REGISTRO — JOGADOR 2**\nSelecione o segundo integrante.',components:[new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`olymp_reg_p2_${u}`).setPlaceholder('Selecione o jogador 2'))]});}
async function registrarP2(i){const p1=i.customId.slice('olymp_reg_p2_'.length),p2=i.values[0];if(p1===p2)return i.reply({content:'❌ Os dois integrantes precisam ser diferentes.',flags:MessageFlags.Ephemeral});const data=load();const usada=data.duplas.find(d=>d.jogador1===p1||d.jogador2===p1||d.jogador1===p2||d.jogador2===p2);if(usada)return i.reply({content:`❌ Um dos jogadores já está na dupla **${esc(usada.nome)}**.`,flags:MessageFlags.Ephemeral});const row=menuPaises(data,`olymp_reg_pais_${p1}_${p2}`,'Escolha o país que a dupla representará.');if(!row)return i.reply({content:'❌ Não há países disponíveis. Adicione países disponíveis no arquivo da competição antes do cadastro.',flags:MessageFlags.Ephemeral});return i.update({content:'🌎 **REGISTRO — PAÍS**\nEscolha o país que a dupla representará. Países já usados não aparecem.',components:[row]});}
async function registrarPais(i){const [, ,p1,p2]=i.customId.split('_');const pais=i.values[0];const data=load();if(paisOcupado(data,pais))return i.reply({content:'❌ Esse país já está sendo representado por outra dupla.',flags:MessageFlags.Ephemeral});const modal=new ModalBuilder().setCustomId(`olymp_reg_nome_${p1}_${p2}_${encodeURIComponent(pais)}`).setTitle('Nome da dupla');modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nome').setLabel('Nome da dupla').setPlaceholder('Ex.: Os Imperadores').setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(40).setRequired(true)));return i.showModal(modal);}
async function registrarNome(i){const [, , ,p1,p2,...paisParts]=i.customId.split('_');const pais=decodeURIComponent(paisParts.join('_'));const nome=i.fields.getTextInputValue('nome').trim();const data=load();if(!permitidoRegistro())return i.reply({content:'🚫 O registro só pode ser feito em dia par de setembro de 2026.',flags:MessageFlags.Ephemeral});if(paisOcupado(data,pais))return i.reply({content:'❌ Esse país acabou de ser escolhido por outra dupla.',flags:MessageFlags.Ephemeral});const id=`dupla_${Date.now()}_${p1}`;data.duplas.push({id,nome,pais,jogador1:p1,jogador2:p2,criadoPor:i.user.id,criadoEm:new Date().toISOString(),ativa:true});data.ranking=ranking(data);save(data);const canal=await i.client.channels.fetch(CONFIG.canalTeg).catch(()=>null);if(canal)await canal.send({embeds:[new EmbedBuilder().setColor('#D4AF37').setTitle('🟨 NOVA DUPLA REGISTRADA').setDescription(`**${esc(nome)}**\n🌎 País: **${esc(pais)}**\n👥 <@${p1}> + <@${p2}>`).setTimestamp()]});return i.reply({content:`✅ **${esc(nome)}** registrada!\n🌎 País: **${esc(pais)}**\n👥 <@${p1}> + <@${p2}>`,flags:MessageFlags.Ephemeral});}

async function contabilizar(i){const data=load();if(data.duplas.length<3)return i.reply({content:'❌ É necessário ter pelo menos 3 duplas cadastradas.',flags:MessageFlags.Ephemeral});const row=menuPaises(data,'olymp_result_ouro','🥇 Selecione o país vencedor');if(!row)return i.reply({content:'❌ Não existem países suficientes.',flags:MessageFlags.Ephemeral});return i.reply({content:'🏅 **CONTABILIZAÇÃO**\n\nA vitória é o resultado principal. Depois serão escolhidos 2º e 3º apenas para desempate.',components:[row],flags:MessageFlags.Ephemeral});}
async function resultadoOuro(i){const ouro=i.values[0];const data=load();const row=menuPaises(data,`olymp_result_prata_${encodeURIComponent(ouro)}`,'🥈 Selecione o país em 2º lugar',[ouro]);return i.update({content:'🥇 Ouro registrado.\n\nAgora escolha o **2º lugar** — peso 3 somente para desempate.',components:[row]});}
async function resultadoPrata(i){const [, , ,ouroEncoded]=i.customId.split('_');const ouro=decodeURIComponent(ouroEncoded);const prata=i.values[0];const data=load();const row=menuPaises(data,`olymp_result_bronze_${encodeURIComponent(ouro)}_${encodeURIComponent(prata)}`,'🥉 Selecione o país em 3º lugar',[ouro,prata]);return i.update({content:'🥈 Segundo lugar registrado.\n\nAgora escolha o **3º lugar** — peso 1 somente para desempate.',components:[row]});}
async function resultadoBronze(i){const parts=i.customId.split('_');const ouro=decodeURIComponent(parts[3]);const prata=decodeURIComponent(parts[4]);const bronze=i.values[0];if(new Set([ouro,prata,bronze]).size!==3)return i.reply({content:'❌ Os três países precisam ser diferentes.',flags:MessageFlags.Ephemeral});const modal=new ModalBuilder().setCustomId(`olymp_print_${encodeURIComponent(ouro)}_${encodeURIComponent(prata)}_${encodeURIComponent(bronze)}`).setTitle('Comprovante da vitória');modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('print').setLabel('Link do print da vitória').setPlaceholder('Cole aqui o link do print').setStyle(TextInputStyle.Paragraph).setRequired(true)));return i.showModal(modal);}
async function salvarResultado(i){const parts=i.customId.split('_');const ouro=decodeURIComponent(parts[2]),prata=decodeURIComponent(parts[3]),bronze=decodeURIComponent(parts[4]);const print=i.fields.getTextInputValue('print').trim();const data=load();const a=data.duplas.find(d=>d.pais===ouro),b=data.duplas.find(d=>d.pais===prata),c=data.duplas.find(d=>d.pais===bronze);if(!a||!b||!c)return i.reply({content:'❌ Não foi possível localizar uma das duplas.',flags:MessageFlags.Ephemeral});const resultado={id:`resultado_${Date.now()}`,data:new Date().toISOString(),ouro:a.id,prata:b.id,bronze:c.id,print,registradoPor:i.user.id};data.resultados.push(resultado);data.ranking=ranking(data);save(data);const canal=await i.client.channels.fetch(CONFIG.canalResultados).catch(()=>null);if(canal)await canal.send({embeds:[new EmbedBuilder().setColor('#D4AF37').setTitle('🏅 RESULTADO — OLIMPÍADAS DE DUPLAS').setDescription(`🥇 **${esc(a.pais)}** — ${esc(a.nome)}\n🥈 **${esc(b.pais)}** — ${esc(b.nome)}\n🥉 **${esc(c.pais)}** — ${esc(c.nome)}\n\n🥇 **Vitória:** critério principal\n🥈 **2º:** peso 3 no desempate\n🥉 **3º:** peso 1 no desempate\n\n📸 [Comprovante da vitória](${print})`).setTimestamp()]});return i.reply({content:'✅ Resultado contabilizado e enviado ao canal de resultados.',flags:MessageFlags.Ephemeral});}

async function verDuplas(i){const data=load();if(!data.duplas.length)return i.reply({content:'❌ Nenhuma dupla registrada.',flags:MessageFlags.Ephemeral});const paginas=[];for(let x=0;x<data.duplas.length;x+=10)paginas.push(data.duplas.slice(x,x+10));const texto=paginas[0].map((d,n)=>`**${n+1}. ${esc(d.nome)}**\n🌎 ${esc(d.pais)}\n👥 <@${d.jogador1}> + <@${d.jogador2}>`).join('\n\n');return i.reply({embeds:[new EmbedBuilder().setColor('#D4AF37').setTitle(`👥 DUPLAS — 1/${paginas.length}`).setDescription(texto)],flags:MessageFlags.Ephemeral});}
async function verRanking(i){const data=load();const r=ranking(data);const lista=Object.entries(r).map(([id,v])=>({d:dupla(data,id),...v})).filter(x=>x.d).sort((a,b)=>b.vitorias-a.vitorias||b.desempate-a.desempate||b.segundo-a.segundo||b.terceiro-a.terceiro);const texto=lista.length?lista.map((x,n)=>`**${n+1}. ${esc(x.d.pais)} — ${esc(x.d.nome)}**\n🥇 ${x.vitorias} vitória(s) • 🥈 ${x.segundo} • 🥉 ${x.terceiro} • ⚖️ ${x.desempate} desempate`).join('\n\n'):'Ainda não há resultados.';return i.reply({embeds:[new EmbedBuilder().setColor('#D4AF37').setTitle('🏆 RANKING DAS OLIMPÍADAS').setDescription(texto)],flags:MessageFlags.Ephemeral});}
async function guia(i){return i.reply({embeds:[new EmbedBuilder().setColor('#D4AF37').setTitle('📖 GUIA — OLIMPÍADAS DE DUPLAS').setDescription('🟨 **Olimpíadas de Duplas**\n\nCada dupla escolherá um País para representar.\nTodos os dias pares do mês de Setembro!\n\n🏅 **Classificação**\n🥇 Dupla vencedora: vitória é o critério principal.\n🥈 Dupla vice: peso 3, usado apenas para desempate.\n🥉 Dupla lanterna: peso 1, usado apenas para desempate.\n⏱️ 1h30min de partida.\n\n🚫 **Regras**\n1️⃣ Em caso de briga, é possível a troca entre países com as medalhas individuais mantidas.\n2️⃣ Em caso de ausência, é possível substituição definitiva de parceiro; as medalhas do país são mantidas.\n3️⃣ Anti-jogo será tratado como qualquer outra partida do servidor.\n4️⃣ Em caso de disputa por um país, será feito sorteio.\n\n⚠️ As Olimpíadas terão apenas **DOIS vencedores**.')],flags:MessageFlags.Ephemeral});}

async function handle(i){const id=i.customId||'';if(id==='olymp_contabilizar')return contabilizar(i);if(id==='olymp_duplas')return verDuplas(i);if(id==='olymp_registrar')return registrarInicio(i);if(id==='olymp_ranking')return verRanking(i);if(id==='olymp_guia')return guia(i);if(id==='olymp_reg_p1')return registrarP1(i);if(id.startsWith('olymp_reg_p2_'))return registrarP2(i);if(id.startsWith('olymp_reg_pais_'))return registrarPais(i);if(id.startsWith('olymp_result_ouro'))return resultadoOuro(i);if(id.startsWith('olymp_result_prata_'))return resultadoPrata(i);if(id.startsWith('olymp_result_bronze_'))return resultadoBronze(i);if(id.startsWith('olymp_reg_nome_'))return registrarNome(i);if(id.startsWith('olymp_print_'))return salvarResultado(i);}
module.exports={handle,painel};
