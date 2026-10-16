/* El Obi del Lector — Fase B. Biblioteca local de temas y organización del perfil.
 * Este módulo se importa únicamente desde la configuración de equipos.
 * Nunca ejecuta consultas a Supabase ni publica cambios por su cuenta.
 */
export const APPEARANCE_KEYS=['team_template','team_palette','team_pattern','team_pattern_intensity','team_font','team_cover_style','team_season','team_season_motion','team_season_density','team_season_mode','team_season_start','team_season_end','team_season_message','accent_color','background_color','theme','header_style','avatar_shape'];
const OPTIONS={
 team_template:['original','revista','clasica','editorial'],
 team_palette:['original','tinta','sakura','biblioteca','washi','neon','noche'],
 team_pattern:['none','seigaiha','asanoha','sakura','washi'],
 team_font:['default','literaria','clasica','moderna','japonesa'],
 team_cover_style:['portada','bolsillo','obi'],
 team_season:['none','sakura','nieve','momiji','matsuri'],
 team_season_motion:['static','animated'],
 team_season_density:['suave','normal'],
 team_season_mode:['manual','scheduled'],
 theme:['automatico','claro','oscuro'],
 header_style:['banner','minimalista','degradado','centrado'],
 avatar_shape:['circular','redondeado']
};
const SECTION_LABELS={presentacion:'Presentación',destacados:'Obras destacadas',fijadas:'Publicaciones fijadas',estadisticas:'Estadísticas',traducciones:'Traducciones',novedades:'Novedades',apoyo:'Apoyo'};
export function normalizeTeamSectionOrder(text){
 const parts=String(text||'').split(',').map(x=>x.trim().toLowerCase());
 const selected=[...new Set(parts.filter(k=>Object.prototype.hasOwnProperty.call(SECTION_LABELS,k)))];
 return [...selected,...Object.keys(SECTION_LABELS).filter(k=>!selected.includes(k))];
}
export function sanitizeTeamAppearance(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('El tema debe ser un objeto válido');
 const clean={};
 for(const key of APPEARANCE_KEYS){
  if(!Object.prototype.hasOwnProperty.call(raw,key))continue;
  const value=raw[key];
  if(key==='accent_color'||key==='background_color'){
   if(typeof value!=='string'||(value!==''&&!/^#[0-9a-f]{6}$/i.test(value)))throw Error('Color hexadecimal inválido');
   clean[key]=value;continue;
  }
  if(key==='team_pattern_intensity'){
   if(typeof value!=='string'&&typeof value!=='number')throw Error('Intensidad inválida');
   const n=Number(value);if(!Number.isFinite(n)||n<0||n>24)throw Error('Intensidad fuera de rango');
   clean[key]=String(n);continue;
  }
  if(key==='team_season_start'||key==='team_season_end'){
   if(typeof value!=='string'||(value!==''&&!/^(20\d{2})-(\d{2})-(\d{2})$/.test(value)))throw Error('Fecha de temporada inválida');
   if(value){
    const day=Date.parse(value+'T00:00:00.000Z');
    if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==value)throw Error('Fecha de temporada inválida');
   }
   clean[key]=value;continue;
  }
  if(key==='team_season_message'){
   if(typeof value!=='string'||value.length>160||/[\u0000-\u0008\u000e-\u001f]/.test(value))throw Error('Mensaje de temporada inválido');
   clean[key]=value;continue;
  }
  if(typeof value!=='string'||!OPTIONS[key].includes(value))throw Error('Opción de tema inválida: '+key);
  clean[key]=value;
 }
 if(clean.team_season_mode==='scheduled'){
  if(clean.team_season==='none')throw Error('Una programación necesita una temporada');
  if(!clean.team_season_start||!clean.team_season_end||clean.team_season_start>clean.team_season_end)throw Error('Rango de temporada inválido');
  const length=(Date.parse(clean.team_season_end+'T00:00:00.000Z')-Date.parse(clean.team_season_start+'T00:00:00.000Z'))/86400000;
  if(length>366)throw Error('La programación excede el máximo permitido');
 }
 return clean;
}
export function exportTeamAppearance(raw,name){
 const appearance=sanitizeTeamAppearance(raw);
 const label=String(name||'Mi tema').trim().slice(0,40)||'Mi tema';
 return JSON.stringify({obi_team_theme:1,name:label,appearance},null,2);
}
export function importTeamAppearance(input){
 if(typeof input!=='string'||input.length>8000)throw Error('JSON demasiado grande (máximo 8000 caracteres)');
 const parsed=JSON.parse(input);
 if(!parsed||parsed.obi_team_theme!==1||!parsed.appearance||typeof parsed.appearance!=='object')throw Error('El archivo no tiene un formato de tema compatible');
 return {name:String(parsed.name||'Tema importado').slice(0,40),appearance:sanitizeTeamAppearance(parsed.appearance)};
}
function readStore(key){
 try{const data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)?data.slice(0,8).filter(x=>x&&typeof x.name==='string'&&x.name.length<=40&&x.appearance&&typeof x.appearance==='object'):[]}
 catch{return []}
}
export function bindTeamAppearanceB({userId,readSettings,refreshPreview}){
 const panel=document.getElementById('teamPanel-custom');
 if(!panel)return;
 const byId=id=>document.getElementById(id);
 const storeKey='nlobi:team-appearances:v1:'+String(userId||'guest');
 const message=text=>{const el=byId('teamBMessage');if(el)el.textContent=text};
 const getField=key=>panel.querySelector('[data-team-setting="'+key+'"]');
 const orderField=getField('section_order');
 const list=byId('teamBOrderList');
 const drawOrder=()=>{
  if(!list)return;
  const values=normalizeTeamSectionOrder(orderField?.value);
  list.replaceChildren();
  for(let i=0;i<values.length;i++){
   const key=values[i],item=document.createElement('div');item.className='teamBOrderItem';
   const label=document.createElement('span');label.textContent=(i+1)+'. '+SECTION_LABELS[key];
   const buttons=document.createElement('div');buttons.className='teamBOrderActions';
   for(const [direction,symbol,labelText] of [[-1,'↑','Subir'],[1,'↓','Bajar']]){
    const btn=document.createElement('button');btn.type='button';btn.className='btn';
    btn.textContent=symbol;btn.dataset.teamBMove=key;btn.dataset.direction=String(direction);
    btn.disabled=direction===-1?i===0:i===values.length-1;
    btn.setAttribute('aria-label',labelText+' '+SECTION_LABELS[key]);buttons.append(btn);
   }
   item.append(label,buttons);list.append(item);
  }
 };
 const setAppearance=raw=>{
  const appearance=sanitizeTeamAppearance(raw);
  for(const [key,value] of Object.entries(appearance)){
   const field=getField(key);if(field)field.value=String(value);
  }
  const strength=byId('teamBStrength');
  if(strength)strength.textContent=getField('team_pattern_intensity')?.value||'0';
  refreshPreview();
 };
 list?.addEventListener('click',event=>{
  const button=event.target.closest('button[data-team-b-move]');
  if(!button||!orderField)return;
  const values=normalizeTeamSectionOrder(orderField.value),i=values.indexOf(button.dataset.teamBMove);
  const j=i+Number(button.dataset.direction);
  if(i<0||j<0||j>=values.length)return;
  [values[i],values[j]]=[values[j],values[i]];
  orderField.value=values.join(',');drawOrder();refreshPreview();
 });
 orderField?.addEventListener('input',drawOrder);
 getField('team_pattern_intensity')?.addEventListener('input',e=>{const target=byId('teamBStrength');if(target)target.textContent=e.target.value});
 const themeSelect=byId('teamBStored');
 const showStored=()=>{
  if(!themeSelect)return;
  themeSelect.replaceChildren(new Option('Elegir tema guardado',''));
  readStore(storeKey).forEach((r,i)=>themeSelect.add(new Option(r.name,String(i))));
 };
 showStored();drawOrder();
 byId('teamBExport')?.addEventListener('click',()=>{
  try{byId('teamBThemeJSON').value=exportTeamAppearance(readSettings(),byId('teamBThemeName')?.value);message('JSON listo para copiar o guardar como respaldo.')}
  catch(e){message(e.message)}
 });
 byId('teamBSavePreset')?.addEventListener('click',()=>{
  try{
   const name=(byId('teamBThemeName')?.value||'').trim();
   if(!name||name.length>40)throw Error('Indica un nombre de hasta 40 caracteres');
   const appearance=sanitizeTeamAppearance(readSettings());
   const rows=readStore(storeKey).filter(x=>x.name!==name);
   if(rows.length>=8)throw Error('Solo se admiten ocho temas locales. Elimina uno antes.');
   rows.push({name,appearance});localStorage.setItem(storeKey,JSON.stringify(rows));
   showStored();message('Tema guardado en este navegador, sin publicar cambios.');
  }catch(e){message('No se pudo guardar: '+e.message)}
 });
 byId('teamBApplyStored')?.addEventListener('click',()=>{
  const selected=themeSelect?.value,rows=readStore(storeKey);
  if(!selected||!rows[Number(selected)]){message('Selecciona un tema de la biblioteca.');return}
  try{setAppearance(rows[Number(selected)].appearance);message('Tema aplicado a la vista previa. Guarda la personalización para publicarlo.')}
  catch(e){message(e.message)}
 });
 byId('teamBDeleteStored')?.addEventListener('click',()=>{
  const selected=themeSelect?.value,rows=readStore(storeKey);
  if(!selected||!rows[Number(selected)]){message('Selecciona primero un tema.');return}
  rows.splice(Number(selected),1);
  try{localStorage.setItem(storeKey,JSON.stringify(rows));showStored();message('Tema local eliminado.')}
  catch{message('No fue posible actualizar la biblioteca local.')}
 });
 byId('teamBImport')?.addEventListener('click',()=>{
  try{const imported=importTeamAppearance(byId('teamBThemeJSON')?.value||'');
   setAppearance(imported.appearance);if(byId('teamBThemeName'))byId('teamBThemeName').value=imported.name;
   message('Tema importado para la vista previa. No se publicará hasta que guardes.');
  }catch(e){message('Importación fallida: '+e.message)}
 });
 byId('teamBCopy')?.addEventListener('click',async()=>{
  const value=byId('teamBThemeJSON')?.value;
  if(!value){message('Prepara primero el JSON.');return}
  try{if(!navigator.clipboard?.writeText)throw Error('portapapeles no disponible');await navigator.clipboard.writeText(value);message('JSON copiado al portapapeles.')}
  catch{byId('teamBThemeJSON')?.select();message('Selecciona y copia manualmente el texto.')}
 });
}
