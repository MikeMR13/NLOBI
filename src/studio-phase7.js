/* Studio Fase 7: publicación guiada, agenda editorial e historial.
 * Los cambios de estado siguen ejecutándose por las rutas protegidas de Supabase.
 * El diálogo es una revisión previa; no confiere permisos ni crea notificaciones.
 */
window.createStudioPhase7=function({
 S,esc,$,$$,jreq,toast,friendlyError,teamCan,renderReaderBlock,
 safeMediaUrl,studioVolumeQuality,studioSectionQuality,refreshProject,loadCatalog
}){
 const publicationStatusLabel={active:'Activa',paused:'En pausa',abandoned:'Abandonada',complete:'Finalizada',awaiting_sequel:'En espera de secuela',no_sequel_confirmed:'Sin secuela confirmada'};
 const eventsLabels={volume_published:'Volumen publicado',volume_hidden:'Volumen ocultado',volume_updated:'Volumen actualizado',
  section_published:'Capítulo publicado',section_hidden:'Capítulo ocultado',section_updated:'Capítulo actualizado',
  schedule_created:'Programación creada',schedule_rescheduled:'Publicación reprogramada',
  schedule_cancelled:'Programación cancelada',schedule_completed:'Publicación ejecutada',schedule_failed:'Programación fallida'};
 const sortSections=v=>[...(v.sections||[])].sort((a,b)=>Number(a.sort_order??a.section_number??0)-Number(b.sort_order??b.section_number??0));
 const validDate=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d:null};
 const dateLabel=value=>{const d=validDate(value);return d?d.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}):'Fecha no disponible'};
 const projectVolume=(P,id)=>(P?.volumes||[]).find(v=>v.id===id);
 const projectSection=(P,id)=>(P?.volumes||[]).flatMap(v=>(v.sections||[]).map(section=>({section,volume:v}))).find(x=>x.section.id===id);
 const pendingSchedule=(P,id)=>(P?.publication_schedules||[]).filter(s=>s.volume_id===id&&s.status==='pending').sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at));
 const isMember=P=>!!(S.user&&S.groups?.some(g=>g.translator_groups?.id===P?.group_id));
 const publicationStats=P=>({volumes:(P?.volumes||[]).filter(v=>v.status==='published').length,sections:(P?.volumes||[]).flatMap(v=>v.sections||[]).filter(s=>s.status==='published').length,pending:(P?.publication_schedules||[]).filter(s=>s.status==='pending').length,failed:(P?.publication_schedules||[]).filter(s=>s.status==='failed').length});
 function readiness(P,mode,id){
  const isVolume=mode==='volume'||mode==='schedule';
  const v=isVolume?projectVolume(P,id):projectSection(P,id)?.volume;
  const section=isVolume?null:projectSection(P,id)?.section;
  const check=v?(isVolume?studioVolumeQuality(v):studioSectionQuality(section)):{issues:['No se encontró el contenido.'],warnings:[]};
  const errors=[...(check.issues||[])],warnings=[...(check.warnings||[])];
  if(!v)return {v,section,errors,warnings,allowed:false};
  if(mode==='volume'&&pendingSchedule(P,v.id).length)errors.push('Este volumen tiene una programación pendiente. Cancélala antes de publicarlo inmediatamente.');
  if(mode==='schedule'&&pendingSchedule(P,v.id).length)errors.push('Ya hay una programación pendiente. Utiliza Reprogramar en vez de crear otra.');
  if(isVolume&&v.status==='published')errors.push('Este volumen ya se encuentra publicado.');
  if(section?.status==='published')errors.push('El capítulo ya está publicado.');
  if(v.is_final_volume&&!['complete','awaiting_sequel','no_sequel_confirmed'].includes(v.final_translation_status))errors.push('Configura el estado automático de este volumen final.');
  if(P?.translator_groups?.review_required){
   const reqs=P.review_requests||[];
   for(const s of isVolume?sortSections(v):[section]){
    if(s.status==='published')continue;
    const latest=reqs.filter(r=>r.section_id===s.id).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0))[0];
    if(!latest||latest.status!=='approved')errors.push((s.title||'Capítulo')+': requiere aprobación editorial.');
   }
  }
  return {v,section,errors:[...new Set(errors)],warnings:[...new Set(warnings)],allowed:!errors.length};
 }
 function statusBadge(value){return ({published:'Publicado',draft:'Borrador',hidden:'Oculto',pending:'Pendiente',failed:'Fallida',cancelled:'Cancelada'})[value]||value||'Borrador'}
 function summary(P){
  if(!P)return '';
  const counts=publicationStats(P),schedules=(P.publication_schedules||[]).filter(x=>x.status==='pending'||x.status==='failed')
    .sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at));
  const events=P.publication_events||[];
  const actorName=id=>{if(!id)return 'Sistema / programación';const member=(P.review_members||[]).find(m=>m.user_id===id);return member?.profiles?.display_name||member?.profiles?.username||'Integrante del equipo';};
  return `<section class="studioV7Hub" id="studioPublicationHub" aria-labelledby="studioV7Title">
   <div class="studioV7Heading"><div><span class="studioV3Kicker">STUDIO / FASE 7</span><h2 id="studioV7Title">Centro de publicaciones</h2><p>Previsualiza, revisa y organiza tus lanzamientos antes de compartirlos con los lectores.</p></div><span class="studioV7Badge">Control editorial</span></div>
   <div class="studioV7Metrics">
    <div><strong>${counts.volumes}</strong><span>Volúmenes públicos</span></div>
    <div><strong>${counts.sections}</strong><span>Capítulos públicos</span></div>
    <div><strong>${counts.pending}</strong><span>Programados</span></div>
    <div><strong>${counts.failed}</strong><span>Fallidos</span></div>
   </div>
   <div class="studioV7Actions">${(P.volumes||[]).length?`<label for="studioV7PreviewVolume">Vista previa del lector</label><select id="studioV7PreviewVolume">${(P.volumes||[]).map(v=>`<option value="${esc(v.id)}">Vol. ${esc(v.volume_number)} · ${esc(v.title||'Sin título')}</option>`).join('')}</select><button class="btn primary" data-studio-v7-preview="selected" type="button">Abrir vista previa</button>`:'<p class="muted">Crea un volumen para habilitar la vista previa.</p>'}</div>
   <div class="studioV7Cols">
    <section class="studioV7Panel" aria-labelledby="studioV7Queue"><h3 id="studioV7Queue">Cola de publicaciones</h3><p class="muted">Las fechas se muestran en el horario local del dispositivo. Solo se permite una programación pendiente por volumen.</p>
    ${schedules.length?schedules.map(s=>{const v=projectVolume(P,s.volume_id);return `<article class="studioV7QueueItem"><div><span class="badge">${esc(statusBadge(s.status))}</span><strong>Vol. ${esc(v?.volume_number??'—')} · ${esc(v?.title||'Sin título')}</strong><time datetime="${esc(s.scheduled_at)}">${esc(dateLabel(s.scheduled_at))}</time>${s.error_message?`<p class="muted">${esc(s.error_message)}</p>`:''}</div>
    ${s.status==='pending'&&teamCan(P.group_id,'schedule')?`<div class="studioV7QueueControls"><label for="studioV7Reschedule-${esc(s.id)}">Nueva fecha local</label><input id="studioV7Reschedule-${esc(s.id)}" type="datetime-local" data-studio-v7-reschedule-time="${esc(s.id)}"><button class="btn" data-studio-v7-reschedule="${esc(s.id)}" type="button">Reprogramar</button><button class="btn danger" type="button" data-cancel-schedule="${esc(s.id)}">Cancelar</button></div>`:''}</article>`}).join(''):'<p class="muted">No hay publicaciones pendientes ni fallidas.</p>'}
    </section>
    <section class="studioV7Panel" aria-labelledby="studioV7History"><h3 id="studioV7History">Historial de publicaciones</h3><p class="muted">Registro privado de cambios de estado, ediciones y programación. No expone el texto de los capítulos.</p>
    ${P.publication_events_unavailable?'<p class="notice">El historial requiere aplicar la migración de la Fase 7 en Supabase.</p>':events.length?`<ol class="studioV7History">${events.slice(0,35).map(e=>`<li><span class="studioV7EventDot" aria-hidden="true"></span><div><strong>${esc(eventsLabels[e.event_type]||e.event_type)}</strong><span>${esc(e.summary||'Cambio editorial')}</span><time datetime="${esc(e.created_at)}">${esc(dateLabel(e.created_at))} · ${esc(actorName(e.actor_user_id))}</time></div></li>`).join('')}</ol>`:'<p class="muted">Todavía no hay eventos editoriales registrados.</p>'}</section>
   </div>
   <p class="studioV7Notices"><strong>Anuncios automáticos:</strong> los nuevos volúmenes aparecen en Inicio y se comunica un solo lanzamiento a cada seguidor con notificaciones habilitadas. La aprobación y los permisos siguen siendo verificados por Supabase. Nunca se envía un aviso desde esta interfaz.</p>
   </section>`;
 }
 let modal=null,modalResolver=null;
 function dismiss(value){
  if(!modal)return;
  const node=modal;modal=null;const done=modalResolver;modalResolver=null;
  try{node.close()}catch{}node.remove();
  done?.(value);
 }
 function buildReviewHtml(P,mode,id,when=null){
  const check=readiness(P,mode,id),v=check.v,section=check.section,isScheduled=mode==='schedule';
  const rows=mode==='section'?[section].filter(Boolean):sortSections(v||{});
  const isFinal=!!v?.is_final_volume;
  return `<div class="studioV7Confirm"><div class="studioV7ConfirmHead"><span class="studioV3Kicker">CONFIRMACIÓN EDITORIAL</span><h2 id="studioV7ModalTitle">${isScheduled?'Programar publicación':mode==='section'?'Publicar capítulo':'Publicar volumen'}</h2><p>${esc(P?.novels?.title||P?.title||'Obra')} · Vol. ${esc(v?.volume_number??'—')}</p></div>
  <div class="studioV7ConfirmNumbers"><div><strong>${rows.length}</strong><span>Secciones incluidas</span></div><div><strong>${rows.filter(s=>s.status!=='published').length}</strong><span>Pendientes de publicación</span></div></div>
  <h3>Contenido incluido</h3><ul class="studioV7ChapterList">${rows.map(s=>`<li><span>${esc(s.title||'Sin título')}</span><span class="badge">${esc(statusBadge(s.status))}</span></li>`).join('')}</ul>
  <p class="muted">${isScheduled?'Fecha prevista: '+esc(dateLabel(when)):mode==='section'?'Solo se publica el capítulo seleccionado.':'Se publicará el volumen y sus capítulos en una operación.'}</p>
  <p class="studioV7Final">${isFinal?'Volumen final: al publicar, la traducción cambiará automáticamente a «'+esc(publicationStatusLabel[v.final_translation_status]||v.final_translation_status)+'».':'Este volumen no está marcado como final.'}</p>
  ${check.errors.length?`<div class="studioV7Errors" role="alert"><strong>Se requiere corrección</strong><ul>${check.errors.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
  ${check.warnings.length?`<div class="studioV7Warnings"><strong>Advertencias (${check.warnings.length})</strong><ul>${check.warnings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><label class="studioV7Accept"><input type="checkbox" id="studioV7WarningsAccepted"> He revisado las advertencias y deseo continuar.</label></div>`:''}
  <p class="studioV7ConfirmNote">Se respetarán las validaciones de permisos y revisiones del servidor. Los seguidores recibirán avisos solamente cuando la publicación se complete.</p>
  <div class="studioV7ConfirmButtons"><button type="button" class="btn" data-studio-v7-close>Volver</button><button type="button" class="btn primary" id="studioV7ConfirmProceed" ${check.errors.length?'disabled':''}>${isScheduled?'Confirmar programación':'Confirmar publicación'}</button></div></div>`;
 }
 function review(mode,id,when=null,projectOverride=null){
  const P=projectOverride||S.studioProject;
  if(!P||!isMember(P))return Promise.resolve(false);
  const action=mode==='schedule'?'schedule':'publish';
  if(!teamCan(P.group_id,action))return Promise.resolve(false);
  if(modal) dismiss(false);
  return new Promise(resolve=>{
   modalResolver=resolve;
   const node=document.createElement('dialog');
   node.className='studioV7Dialog';node.setAttribute('aria-labelledby','studioV7ModalTitle');
   node.innerHTML=buildReviewHtml(P,mode,id,when);
   document.body.appendChild(node);modal=node;
   node.addEventListener('cancel',e=>{e.preventDefault();dismiss(false)});
   node.querySelector('[data-studio-v7-close]')?.addEventListener('click',()=>dismiss(false));
   const proceed=node.querySelector('#studioV7ConfirmProceed');
   proceed?.addEventListener('click',()=>{
    if(!readiness(P,mode,id).allowed){toast('Hay errores que impiden publicar.','bad');return}
    const needAck=!!node.querySelector('#studioV7WarningsAccepted');
    if(needAck&&!node.querySelector('#studioV7WarningsAccepted').checked){toast('Confirma que revisaste las advertencias.','bad');return}
    dismiss(true);
   });
   try{node.showModal()}catch{node.setAttribute('open','')}
   node.querySelector('[data-studio-v7-close]')?.focus();
  });
 }
 function openPreview(id){
  const P=S.studioProject,v=projectVolume(P,id);
  if(!P||!isMember(P)||!v)return;
  if(modal)dismiss(false);
  const list=sortSections(v),first=list[0];
  const logo=P.translator_groups?.avatar_url||'';
  const escapedLogo=logo&&safeMediaUrl(logo)!=='#'?`<img class="studioV7TeamLogo" src="${esc(safeMediaUrl(logo))}" alt="Logo del equipo ${esc(P.translator_groups?.name||'traductor')}">`:'';
  const node=document.createElement('dialog');node.className='studioV7Dialog studioV7PreviewDialog';
  node.setAttribute('aria-label','Vista previa privada del volumen');
  node.innerHTML=`<div class="studioV7PreviewHead"><div><span class="studioV3Kicker">PREVISUALIZACIÓN PRIVADA · NO PUBLICA</span><h2>${esc(P.novels?.title||P.title||'Novela')}</h2><p>Volumen ${esc(v.volume_number)} · ${esc(v.title||'')}</p></div><button type="button" class="btn" data-studio-v7-close>Cerrar</button></div>
  <div class="studioV7PreviewToolbar"><label for="studioV7PreviewChapter">Sección</label><select id="studioV7PreviewChapter">${list.map(s=>`<option value="${esc(s.id)}">${esc(s.title||'Sin título')}</option>`).join('')}</select><span>Se muestra el formato del lector y el contenido guardado.</span></div>
  <div class="readerExperience studioV7ReaderSimulation"><div class="studioV7BookHead">${escapedLogo}<div><strong>${esc(P.novels?.title||P.title||'Novela')}</strong><small>Vol. ${esc(v.volume_number)} · ${esc(v.title||'')}</small></div></div><article class="readerPaper" id="studioV7ReaderPaper" tabindex="0" aria-live="polite"></article></div>`;
  function draw(secId){
   const section=list.find(s=>s.id===secId)||first;
   const paper=node.querySelector('#studioV7ReaderPaper');
   if(!paper)return;
   paper.innerHTML=section?`<h3 class="studioV7ChapterTitle">${esc(section.title||'Sin título')}</h3>${(section.content||[]).map(renderReaderBlock).join('')}`:'<p>No hay capítulos en este volumen.</p>';
   const prefs=S.readerPrefs||{};
   const size=Math.min(32,Math.max(12,Number(prefs.fontSize)||18));
   paper.style.fontSize=size+'px';
   paper.style.textAlign=prefs.align==='justify'?'justify':'left';
   paper.style.lineHeight=prefs.lineHeight==='compact'?'1.55':prefs.lineHeight==='relaxed'?'2.05':'1.8';
   paper.scrollTop=0;
  }
  node.querySelector('#studioV7PreviewChapter')?.addEventListener('change',e=>draw(e.target.value));
  node.querySelector('[data-studio-v7-close]')?.addEventListener('click',()=>{node.close();node.remove()});
  node.addEventListener('close',()=>node.remove());
  document.body.append(node);
  try{node.showModal()}catch{node.setAttribute('open','')}
  draw(first?.id);
 }
 async function reschedule(id){
  const P=S.studioProject,sch=P?.publication_schedules?.find(s=>s.id===id&&s.status==='pending');
  if(!P||!sch||!isMember(P)||!teamCan(P.group_id,'schedule'))return;
  const input=$('[data-studio-v7-reschedule-time="'+id+'"]');
  const date=validDate(input?.value||'');
  if(!date||date.getTime()<=Date.now()+60000){toast('Elige una fecha futura, al menos un minuto después de ahora.','bad');return}
  const count=pendingSchedule(P,sch.volume_id).length;
  if(count!==1){toast('Hay varias programaciones activas. Revísalas antes de continuar.','bad');return}
  const yes=await reviewScheduleChange(sch,date);
  if(!yes)return;
  if(input)input.disabled=true;
  try{
   await jreq('/rest/v1/volume_publication_schedule?id=eq.'+encodeURIComponent(id)+'&status=eq.pending',{
    method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({scheduled_at:date.toISOString()})});
   await refreshProject();toast('Publicación reprogramada.','ok');
  }catch(e){toast(friendlyError(e,'No fue posible reprogramar. La migración de Fase 7 debe estar aplicada.'),'bad')}
  finally{if(input?.isConnected)input.disabled=false}
 }
 function reviewScheduleChange(sch,date){
  if(modal)dismiss(false);
  return new Promise(resolve=>{
   modalResolver=resolve;
   const node=document.createElement('dialog');modal=node;
   node.className='studioV7Dialog';node.setAttribute('aria-label','Confirmar reprogramación');
   node.innerHTML=`<div class="studioV7Confirm"><h2>Reprogramar volumen</h2><p>Fecha original: <strong>${esc(dateLabel(sch.scheduled_at))}</strong></p><p>Nueva fecha: <strong>${esc(dateLabel(date))}</strong></p><p>La publicación todavía no se ejecutará; solo se actualizará su fecha.</p><div class="studioV7ConfirmButtons"><button class="btn" type="button" data-studio-v7-close>Cancelar</button><button class="btn primary" type="button" data-studio-v7-confirm>Confirmar nueva fecha</button></div></div>`;
   document.body.append(node);
   node.addEventListener('cancel',e=>{e.preventDefault();dismiss(false)});
   node.querySelector('[data-studio-v7-close]').onclick=()=>dismiss(false);
   node.querySelector('[data-studio-v7-confirm]').onclick=()=>dismiss(true);
   try{node.showModal()}catch{node.setAttribute('open','')}
  });
 }
 function bind(){
  $$('[data-studio-v7-preview]').forEach(b=>b.onclick=()=>openPreview(b.dataset.studioV7Preview==='selected'?$('#studioV7PreviewVolume')?.value:b.dataset.studioV7Preview));
  $$('[data-studio-v7-reschedule]').forEach(b=>b.onclick=()=>reschedule(b.dataset.studioV7Reschedule));
 }
 return {summary,readiness,review,openPreview,reschedule,bind,publicationStats};
};
