const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const e = require('./competitionEngine');
const ADMIN = PermissionFlagsBits.Administrator;
const TYPES = ['questions','stages','scoring','rewards','rules','fields'];
const LABEL = {questions:'❓ Perguntas',stages:'⚔️ Fases',scoring:'📊 Pontuação',rewards:'🏆 Prêmios',rules:'📜 Regras',fields:'🧩 Campos'};
const isAdmin=i=>Boolean(i.memberPermissions?.has(ADMIN));
const get=i=>e.get(i.options.getString('id'));
const getArray=(c,t)=>t==='questions'?c.registration.questions:c[t];
const parse=s=>{try{return JSON.parse(s||'{}')}catch{return null}};
module.exports={
 data:new SlashCommandBuilder().setName('competicao-configurar').setDescription('🧩 Configura perguntas, fases, pontos, prêmios, regras e campos.').setDefaultMemberPermissions(ADMIN)
 .addStringOption(o=>o.setName('acao').setDescription('Ação').setRequired(true).addChoices({name:'➕ Adicionar',value:'add'},{name:'✏️ Editar',value:'edit'},{name:'🗑️ Remover',value:'remove'},{name:'⬆️ Subir',value:'up'},{name:'⬇️ Descer',value:'down'},{name:'📋 Listar',value:'list'},{name:'💾 Snapshot',value:'snapshot'},{name:'🧪 Validar',value:'validate'}))
 .addStringOption(o=>o.setName('id').setDescription('Competição').setRequired(true).setAutocomplete(true))
 .addStringOption(o=>o.setName('tipo').setDescription('Seção').addChoices(...TYPES.map(x=>({name:LABEL[x],value:x}))))
 .addIntegerOption(o=>o.setName('indice').setDescription('Item (começa em 1)'))
 .addStringOption(o=>o.setName('dados').setDescription('JSON do item; na edição os campos enviados são mesclados')),
 async autocomplete(i){if(!isAdmin(i))return i.respond([]);const q=(i.options.getString('id')||'').toLowerCase();return i.respond(e.list().filter(c=>`${c.id} ${c.metadata?.name||''}`.toLowerCase().includes(q)).slice(0,25).map(c=>({name:`${c.metadata?.name||'Sem nome'} • ${c.id}`.slice(0,100),value:c.id})) )},
 async execute(i){
  if(!isAdmin(i))return i.reply({content:'❌ Apenas administradores.',flags:MessageFlags.Ephemeral});
  const c=get(i);if(!c)return i.reply({content:'❌ Competição não encontrada.',flags:MessageFlags.Ephemeral});
  const action=i.options.getString('acao'),type=i.options.getString('tipo'),idx=i.options.getInteger('indice');
  if(action==='snapshot'){e.snapshot(c,i.user.id,'manual');e.save(c,i.user.id,'snapshot');return i.reply({content:`💾 Snapshot criado. Versão atual: ${c.version}.`,flags:MessageFlags.Ephemeral})}
  if(action==='validate'){const v=e.validate(c);return i.reply({content:`${v.valid?'✅ CONFIGURAÇÃO VÁLIDA':'❌ CONFIGURAÇÃO COM ERROS'}\n${v.errors.map(x=>'• '+x).join('\n')||'Nenhum erro.'}\n${v.warnings.map(x=>'⚠️ '+x).join('\n')||'Sem avisos.'}`.slice(0,1900),flags:MessageFlags.Ephemeral})}
  if(!TYPES.includes(type))return i.reply({content:'❌ Escolha uma seção.',flags:MessageFlags.Ephemeral});
  const a=getArray(c,type);
  if(action==='list'){const emb=new EmbedBuilder().setColor(c.visual?.color||'#C9A227').setTitle(`${LABEL[type]} • ${c.metadata.name}`).setDescription(a.length?a.slice(0,25).map((x,n)=>`**${n+1}.** ${x.name||x.title||x.label||x.question||x.id||'Sem nome'}`).join('\n'):'Nenhum item.').setFooter({text:`${a.length} item(ns)`});return i.reply({embeds:[emb],flags:MessageFlags.Ephemeral})}
  if(action==='add'||action==='edit'){
   const obj=parse(i.options.getString('dados'));if(!obj)return i.reply({content:'❌ JSON inválido.',flags:MessageFlags.Ephemeral});
   if(action==='edit'){if(!idx||idx<1||idx>a.length)return i.reply({content:'❌ Índice inválido.',flags:MessageFlags.Ephemeral});a[idx-1]={...a[idx-1],...obj,id:a[idx-1].id||obj.id||e.id(type.slice(0,-1))}}else{obj.id=obj.id||e.id(type.slice(0,-1));a.push(obj)}
   e.save(c,i.user.id,action==='add'?'add_item':'edit_item');return i.reply({content:`✅ ${action==='add'?'Item adicionado':'Item editado'} em **${LABEL[type]}**.`,flags:MessageFlags.Ephemeral});
  }
  if(!idx||idx<1||idx>a.length)return i.reply({content:'❌ Informe um índice válido.',flags:MessageFlags.Ephemeral});
  if(action==='remove'){const[x]=a.splice(idx-1,1);e.save(c,i.user.id,'remove_item');return i.reply({content:`🗑️ Removido: **${x.name||x.title||x.id}**.`,flags:MessageFlags.Ephemeral})}
  if(action==='up'||action==='down'){const to=action==='up'?idx-2:idx;if(to<0||to>=a.length)return i.reply({content:'↩️ Item já está no limite.',flags:MessageFlags.Ephemeral});[a[idx-1],a[to]]=[a[to],a[idx-1]];e.save(c,i.user.id,action);return i.reply({content:'✅ Ordem atualizada.',flags:MessageFlags.Ephemeral})}
 }
};
