/* NLOBI · Fase A.2 — private visual editor drafts and publication UI.
   Loaded only in the authorized Studio team settings. Nothing publishes on input. */
export const TEAM_DESIGN_KEYS=["team_template","team_palette","team_pattern","team_pattern_intensity","team_font","team_cover_style","team_season","team_season_motion","team_season_density","team_season_mode","team_season_start","team_season_end","team_season_message","accent_color","background_color","background_image","background_intensity","theme","header_style","avatar_shape","tagline","short_description","welcome","about","founded","country","languages","genres","status","section_order","recruitment_message","featured_works","seo_description","pinned_posts","new_volume_label","new_chapter_label","credit_text","translator_note","member_credit_order","role_labels","website","discord","twitter","facebook","instagram","youtube","tiktok","github","kofi","patreon","custom_links","show_members","show_works","show_progress","show_followers","show_stats","show_founded","show_team_badge","show_team_logo","show_novel_logo","show_recruitment","show_featured"];
const DESIGN_SET=new Set(TEAM_DESIGN_KEYS);
export function pickTeamDesignSettings(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Configuración inválida');
 const result={};
 for(const [key,value] of Object.entries(input))if(DESIGN_SET.has(key)){
  if(value!==null&&!['boolean','string','number'].includes(typeof value))throw Error('Campo de diseño inválido');
  if(typeof value==='string'&&value.length>4000)throw Error('Un campo supera 4000 caracteres');
  result[key]=value;
 }
 if(new TextEncoder().encode(JSON.stringify(result)).length>28000)throw Error('El diseño excede 28 KB');
 return result;
}
function comparableValue(key,value){
 const base={team_template:'original',team_palette:'original',team_pattern:'none',
  team_pattern_intensity:'10',team_font:'default',team_cover_style:'portada',
  team_season:'none',team_season_motion:'static',team_season_density:'suave',
  team_season_mode:'manual',theme:'automatico',header_style:'banner',
  avatar_shape:'circular',status:'activo'};
 if(key.startsWith('show_'))return value===undefined||value===null||value===''?true:
   !(value===false||value==='false');
 if(key==='section_order'){
  const defaultOrder='presentacion,destacados,fijadas,estadisticas,traducciones,novedades,apoyo';
  return String(value||defaultOrder).trim().toLowerCase().replace(/\s*,\s*/g,',');
 }
 return String(value===undefined||value===null||value===''?(base[key]||''):value);
}
export function compareTeamDesigns(published={},candidate={}){
 const a=pickTeamDesignSettings(published),b=pickTeamDesignSettings(candidate);
 return TEAM_DESIGN_KEYS.filter(key=>comparableValue(key,a[key])!==comparableValue(key,b[key]))
  .map(key=>({key,before:a[key],after:b[key]}));
}
export async function saveTeamDesignDraft({request,groupId,settings,note=''}) {
 const design=pickTeamDesignSettings(settings);
 if(!/^[\da-f-]{36}$/i.test(String(groupId)))throw Error('Equipo inválido');
 const response=await request('/rest/v1/rpc/team_design_save_draft',{
  method:'POST',body:JSON.stringify({p_group_id:groupId,p_settings:design,p_note:String(note).slice(0,100)})
 });
 if(typeof response!=='string'||!/^[\da-f-]{36}$/i.test(response))throw Error('No se confirmó el guardado del borrador');
 return response;
}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n}
function notify(target,message){if(target)target.textContent=message}
export function renderTeamDesignDiff(target,current,revision){
 if(!target)return;
 target.replaceChildren();
 if(!revision){target.append(el('p','Selecciona una versión para comparar con la apariencia pública.','muted'));return}
 const changes=compareTeamDesigns(current,revision.settings);
 const h=el('h4',changes.length?changes.length+' campos diferentes frente a la versión pública':'Sin cambios respecto al diseño público');
 target.append(h);
 if(!changes.length)return;
 const list=el('dl',undefined,'teamDesignDiffList');
 for(const c of changes.slice(0,28)){
  const row=el('div',undefined,'teamDesignDiffRow');
  const title=el('dt',c.key.replaceAll('_',' '));
  const value=v=>typeof v==='boolean'?(v?'Sí':'No'):v===undefined||v===null||v===''?'(vacío)':String(v).slice(0,110);
  const detail=el('dd',value(c.before)+' → '+value(c.after));
  row.append(title,detail);list.append(row);
 }
 target.append(list);
 if(changes.length>28)target.append(el('p','Se muestran los primeros 28 cambios.','muted'));
}
export function bindTeamDesignEditor({groupId,request,readPublic,refreshGroup,notifyUser}){
 const root=document.getElementById('teamDesignRevisions');
 if(!root||!/^[\da-f-]{36}$/i.test(String(groupId)))return;
 const list=document.getElementById('teamDesignRevisionList'),
  message=document.getElementById('teamDesignStatus'),
  diff=document.getElementById('teamDesignDifference'),
  button=document.getElementById('saveTeamCustom');
 let versions=[],loaded=false,inFlight=false;
 function draw(){
  if(!list?.isConnected)return;
  list.replaceChildren();
  if(!versions.length){list.append(el('p','Todavía no hay borradores ni versiones publicadas.','muted'));return}
  for(const item of versions){
   const card=el('article',undefined,'teamDesignRevisionCard');
   const head=el('div',undefined,'teamDesignRevisionHeading');
   head.append(el('strong',item.kind==='draft'?'Borrador':'Versión publicada'),
    el('time',new Date(item.created_at).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})));
   card.append(head);
   if(item.note)card.append(el('p',item.note,'muted'));
   const actions=el('div',undefined,'row');
   for(const [action,label] of [['compare','Comparar'],['publish',item.kind==='draft'?'Publicar esta versión':'Restaurar y publicar']]){
    const b=el('button',label,'btn'+(action==='publish'?' primary':''));b.type='button';
    b.dataset.designAction=action;b.dataset.designId=item.id;
    actions.append(b);
   }
   card.append(actions);list.append(card);
  }
 }
 async function load(){
  if(!root.isConnected||inFlight)return;
  inFlight=true;notify(message,'Consultando historial privado…');
  try{
   const items=await request('/rest/v1/team_design_revisions?group_id=eq.'+encodeURIComponent(groupId)+
    '&select=id,group_id,kind,note,settings,created_at,created_by&order=created_at.desc&limit=40');
   if(!root.isConnected)return;
   versions=Array.isArray(items)?items.filter(v=>v.group_id===groupId&&['draft','published'].includes(v.kind)):[];
   loaded=true;notify(message,'Historial privado. Solo administradores del equipo pueden verlo o publicar.');
   draw();
  }catch(error){
   if(root.isConnected)notify(message,'No se pudo consultar el historial de diseños. Comprueba que se haya aplicado la migración de A.2.');
  }finally{inFlight=false}
 }
 root.addEventListener('click',async event=>{
  const action=event.target.closest('[data-design-action]');if(!action||inFlight)return;
  const item=versions.find(v=>v.id===action.dataset.designId);if(!item)return;
  if(action.dataset.designAction==='compare'){
   renderTeamDesignDiff(diff,readPublic(),item);
   return;
  }
  const label=item.kind==='draft'?'Publicar este borrador':'Restaurar la versión seleccionada';
  if(!confirm(label+' en el perfil público del equipo?'))return;
  inFlight=true;action.disabled=true;notify(message,'Publicando la versión seleccionada…');
  try{
   await request('/rest/v1/rpc/team_design_publish',{method:'POST',
    body:JSON.stringify({p_group_id:groupId,p_revision_id:item.id})});
   notifyUser('Diseño publicado. El perfil público ya usa esta versión.','ok');
   await refreshGroup();
   inFlight=false;await load();
  }catch(error){
   notify(message,'No fue posible publicar. '+String(error?.message||error).slice(0,170));
   notifyUser('No se pudo publicar. Revisa si el diseño público cambió o faltan permisos.','bad');
  }finally{inFlight=false;action.disabled=false}
 });
 document.addEventListener('team-design-draft-saved',event=>{
  if(event.detail?.groupId!==groupId||!root.isConnected)return;
  notify(message,'Borrador guardado de forma privada. Publica una versión cuando esté listo.');
  void load();
 });
 // Avoid reads until the private tab is first opened.
 if(root.closest('[data-team-settings-panel]')?.hidden===false)void load();
 else document.getElementById('teamTab-custom')?.addEventListener('click',()=>{if(!loaded)void load()},{once:true});
 if(button)button.textContent='Guardar borrador privado';
}
