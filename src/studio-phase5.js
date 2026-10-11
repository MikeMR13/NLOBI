/* Studio Fase 5. Scoped to the authenticated editorial workspace. */
window.createStudioPhase5=function({S,nav,status,context,esc,jreq,toast,friendlyError,render,$,$$,teamCan,isManager,openProject,roleLabel}){
 const STATES=[['todo','Por hacer'],['in_progress','En curso'],['blocked','Bloqueada'],['done','Terminada'],['cancelled','Cancelada']];
 const PRIORITIES=[['normal','Normal'],['high','Alta'],['urgent','Urgente']];
 const label=(list,id)=>list.find(x=>x[0]===id)?.[1]||id||'—';
 const groups=()=>S.groups.map(g=>g.translator_groups).filter(g=>g?.id);
 const allowed=id=>teamCan(id,'edit')||teamCan(id,'create')||teamCan(id,'review');
 const projectBySection=id=>(S.studioTranslations||[]).find(p=>p.volumes?.some(v=>v.sections?.some(s=>s.id===id)));
 const projectByVolume=id=>(S.studioTranslations||[]).find(p=>p.volumes?.some(v=>v.id===id));
 const projectTitle=p=>p?.novels?.title||p?.title||'Obra';
 const date=v=>v?new Date(v).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}):'—';
 const work={data:null,loading:false,team:'all',status:'open',warning:'',scope:''};
 async function load(){
  if(work.loading)return;
  const ids=groups().map(g=>g.id),scope=work.scope;
  work.loading=true;work.warning='';
  try{
   if(!ids.length){work.data={tasks:[],reviews:[],schedule:[],members:[],taskReady:true,errors:[]};return}
   const q='group_id=in.('+ids.join(',')+')';
   const result=await Promise.allSettled([
    jreq('/rest/v1/editorial_tasks?'+q+'&select=id,group_id,translation_id,title,details,status,priority,assigned_to,created_by,due_at,created_at,updated_at&order=updated_at.desc&limit=300'),
    jreq('/rest/v1/editorial_review_requests?'+q+'&select=id,group_id,section_id,requested_by,assigned_to,status,request_note,review_note,created_at,reviewed_at&order=created_at.desc&limit=300'),
    jreq('/rest/v1/volume_publication_schedule?'+q+'&select=id,group_id,volume_id,status,scheduled_at,error_message&status=in.(pending,failed)&order=scheduled_at.asc&limit=200'),
    jreq('/rest/v1/group_members?'+q+'&select=group_id,user_id,role,permissions,profiles(id,username,display_name)')
   ]);
   if(work.scope!==scope)return; // A different user or team must never receive stale results.
   const get=i=>result[i].status==='fulfilled'?result[i].value||[]:[];
   work.data={tasks:get(0),reviews:get(1),schedule:get(2),members:get(3),taskReady:result[0].status==='fulfilled',errors:result.slice(1).flatMap((r,i)=>r.status==='rejected'?[['revisiones','calendario','miembros'][i]]:[])};
   if(!work.data.taskReady)work.warning='Las tareas necesitan aplicar la migración de Studio Fase 5 en Supabase. El resto de herramientas puede utilizarse por separado.';
  }catch(e){if(work.scope===scope)work.warning=friendlyError(e,'No se pudo cargar el escritorio editorial.')}
  finally{if(work.scope===scope){work.loading=false;if(S.view==='studio:work')render()}}
 }
 function view(){
  const teams=groups();
  const currentScope=(S.user?.id||'')+':'+teams.map(g=>g.id).sort().join(',');
  if(work.scope!==currentScope){work.scope=currentScope;work.data=null;work.loading=false;work.warning='';work.team='all';work.status='open'}
  if(!S.user||!teams.length)return `${nav()}<main class="wrap"><div class="notice">Este espacio está reservado a los equipos traductores.</div><button class="btn" data-v="studio">Regresar a Studio</button></main>`;
  if(!work.data&&!work.loading)void load();
  const D=work.data;
  if(!D)return `${nav()}<main class="wrap"><div class="notice" role="status">Cargando trabajo editorial…</div></main>`;
  const belongs=x=>work.team==='all'||work.team===x.group_id;
  const filtered=(rows,closed,mine)=>rows.filter(belongs).filter(r=>work.status==='all'||work.status==='mine'?work.status!=='mine'||mine(r):work.status==='closed'?closed(r):!closed(r));
  const tasks=filtered(D.tasks,t=>['done','cancelled'].includes(t.status),t=>t.assigned_to===S.user?.id);
  const reviews=filtered(D.reviews,r=>r.status!=='pending',r=>r.assigned_to===S.user?.id);
  const schedule=D.schedule.filter(belongs);
  const name=id=>D.members.find(m=>m.user_id===id)?.profiles?.display_name||D.members.find(m=>m.user_id===id)?.profiles?.username||'Sin asignar';
  const teamName=id=>teams.find(g=>g.id===id)?.name||'Equipo';
  const projects=S.studioTranslations||[];
  const writable=teams.filter(g=>allowed(g.id));
  const events=[...D.tasks.filter(t=>belongs(t)&&t.due_at&&!['done','cancelled'].includes(t.status)).map(t=>({when:t.due_at,type:'Tarea',title:t.title,project:t.translation_id})),...schedule.map(s=>({when:s.scheduled_at,type:s.status==='failed'?'Publicación fallida':'Publicación',title:projectTitle(projectByVolume(s.volume_id)),project:projectByVolume(s.volume_id)?.id}))].sort((a,b)=>Date.parse(a.when)-Date.parse(b.when));
  const history=[...D.tasks.filter(belongs).map(t=>({when:t.updated_at,title:t.title,type:'Tarea · '+label(STATES,t.status)})),...D.reviews.filter(belongs).map(r=>({when:r.reviewed_at||r.created_at,title:projectTitle(projectBySection(r.section_id)),type:'Revisión · '+r.status}))].sort((a,b)=>Date.parse(b.when)-Date.parse(a.when)).slice(0,15);
  const taskCard=t=>{const p=projects.find(p=>p.id===t.translation_id),canChange=isManager(t.group_id)||t.created_by===S.user?.id||t.assigned_to===S.user?.id&&allowed(t.group_id);
   return `<article class="studioV5Item"><div><div class="row"><span class="badge">${esc(label(PRIORITIES,t.priority))}</span><span class="badge">${esc(label(STATES,t.status))}</span></div><h3>${esc(t.title)}</h3>${t.details?`<p>${esc(t.details)}</p>`:''}<p class="muted">${esc(teamName(t.group_id))} · ${esc(name(t.assigned_to))}${t.due_at?' · Límite: '+esc(date(t.due_at)):''}</p></div><div class="studioV5Actions">${p?`<button class="btn" data-work-open="${esc(p.id)}">Abrir obra</button>`:''}${canChange?`<label class="srOnly" for="taskState-${esc(t.id)}">Estado de ${esc(t.title)}</label><select id="taskState-${esc(t.id)}" data-work-state="${esc(t.id)}">${STATES.map(([key,title])=>`<option value="${key}" ${t.status===key?'selected':''}>${title}</option>`).join('')}</select>`:''}</div></article>`};
  const reviewCard=r=>{const p=projectBySection(r.section_id),canReview=teamCan(r.group_id,'review')&&r.status==='pending'&&r.requested_by!==S.user?.id&&(!r.assigned_to||r.assigned_to===S.user?.id||isManager(r.group_id));
   return `<article class="studioV5Item"><div><span class="badge">${esc(({pending:'Pendiente',approved:'Aprobada',changes_requested:'Correcciones solicitadas',cancelled:'Cancelada'})[r.status]||r.status)}</span><h3>${esc(projectTitle(p))}</h3><p class="muted">${esc(teamName(r.group_id))} · ${r.assigned_to?'Revisor: '+esc(name(r.assigned_to)):'Sin revisor asignado'} · ${esc(date(r.created_at))}</p>${r.request_note?`<p>${esc(r.request_note)}</p>`:''}${r.review_note?`<p><strong>Observaciones:</strong> ${esc(r.review_note)}</p>`:''}</div><div class="studioV5Actions">${p?`<button class="btn" data-work-open="${esc(p.id)}">Abrir capítulo</button>`:''}${canReview?`<label class="srOnly" for="reviewNote-${esc(r.id)}">Nota de revisión</label><textarea id="reviewNote-${esc(r.id)}" rows="2" placeholder="Nota de revisión" data-work-note="${esc(r.id)}"></textarea><button class="btn primary" data-work-approve="${esc(r.id)}">Aprobar</button><button class="btn" data-work-changes="${esc(r.id)}">Solicitar cambios</button>`:''}</div></article>`};
  return `${nav()}<main class="wrap studioV5" id="mainContent">${status()}${context()}
   <header class="studioV5Header"><div><span class="studioV3Kicker">STUDIO / FASE 5</span><h1>Trabajo editorial</h1><p>Bandeja de tareas, revisiones, historial y calendario privado para tus equipos.</p></div><div class="row"><button class="btn" id="workRefresh">Actualizar</button><button class="btn" data-v="studio:teams">Gestionar equipos</button></div></header>
   ${work.warning?`<div class="notice" role="status">${esc(work.warning)}</div>`:''}${D.errors.length?`<div class="notice">No se pudo leer: ${esc(D.errors.join(', '))}. Revisa los permisos.</div>`:''}
   <div class="studioV5Stats"><div><strong>${D.tasks.filter(t=>belongs(t)&&!['done','cancelled'].includes(t.status)).length}</strong><span>Tareas abiertas</span></div><div><strong>${D.reviews.filter(r=>belongs(r)&&r.status==='pending').length}</strong><span>Revisiones pendientes</span></div><div><strong>${schedule.filter(s=>s.status==='pending').length}</strong><span>Programadas</span></div><div><strong>${teams.length}</strong><span>Equipos</span></div></div>
   <div class="studioV5Filters"><label>Equipo<select id="workTeamFilter"><option value="all">Todos mis equipos</option>${teams.map(g=>`<option value="${esc(g.id)}" ${work.team===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label><label>Estado<select id="workStatusFilter">${[['open','Pendientes'],['mine','Asignadas a mí'],['closed','Cerradas'],['all','Todas']].map(([k,v])=>`<option value="${k}" ${work.status===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
   <div class="studioV5Grid"><div><section class="studioV5Panel"><h2>Bandeja de tareas</h2>${tasks.length?tasks.map(taskCard).join(''):'<p class="muted">No hay tareas con este filtro.</p>'}</section><section class="studioV5Panel"><h2>Revisiones editoriales</h2>${reviews.length?reviews.map(reviewCard).join(''):'<p class="muted">No hay revisiones con este filtro.</p>'}</section></div><div>
   <section class="studioV5Panel"><h2>Calendario editorial</h2><p class="muted">Horas locales del navegador. Gestiona publicaciones programadas dentro de cada volumen.</p>${events.length?`<ol class="studioV5Timeline">${events.slice(0,30).map(e=>`<li><time datetime="${esc(e.when)}">${esc(date(e.when))}</time><strong>${esc(e.type)} · ${esc(e.title)}</strong>${e.project?`<button class="btn" data-work-open="${esc(e.project)}">Abrir obra</button>`:''}</li>`).join('')}</ol>`:'<p class="muted">No hay eventos próximos registrados.</p>'}</section>
   <section class="studioV5Panel"><h2>Actividad reciente</h2><p class="muted">Seguimiento de tareas y revisiones. Las versiones de texto continúan en el historial del capítulo.</p>${history.length?`<ol class="studioV5Timeline">${history.map(h=>`<li><time datetime="${esc(h.when)}">${esc(date(h.when))}</time><strong>${esc(h.type)}</strong><span>${esc(h.title)}</span></li>`).join('')}</ol>`:'<p class="muted">Sin actividad registrada.</p>'}</section></div></div>
   ${writable.length&&D.taskReady?`<section class="studioV5Panel" id="studioV5Create"><h2>Crear tarea editorial</h2><div class="studioV5Form">
   <label>Equipo<select id="workNewGroup">${writable.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label>
   <label>Obra<select id="workNewProject"><option value="">General del equipo</option>${projects.filter(p=>writable.some(g=>g.id===p.group_id)).map(p=>`<option data-team="${esc(p.group_id)}" value="${esc(p.id)}">${esc(projectTitle(p))}</option>`).join('')}</select></label>
   <label>Responsable<select id="workNewAssignee"><option value="">Sin asignar</option>${D.members.filter(m=>writable.some(g=>g.id===m.group_id)).map(m=>`<option data-team="${esc(m.group_id)}" value="${esc(m.user_id)}">${esc(name(m.user_id))} · ${esc(roleLabel(m.role))}</option>`).join('')}</select></label>
   <label>Prioridad<select id="workNewPriority">${PRIORITIES.map(([key,title])=>`<option value="${key}">${title}</option>`).join('')}</select></label>
   <label>Fecha límite<input type="datetime-local" id="workNewDue"></label><label class="studioV5Wide">Título<input id="workNewTitle" minlength="3" maxlength="180" placeholder="Ej. Revisar capítulo 3"></label><label class="studioV5Wide">Indicaciones<textarea id="workNewDetails" rows="3" maxlength="4000"></textarea></label></div><button class="btn primary" id="workCreate">Crear tarea</button></section>`:''}</main>`;
 }
 async function create(){
  const group_id=$('#workNewGroup')?.value,title=$('#workNewTitle')?.value.trim()||'',details=$('#workNewDetails')?.value.trim()||'',priority=$('#workNewPriority')?.value,translation_id=$('#workNewProject')?.value||null,assigned_to=$('#workNewAssignee')?.value||null,due=$('#workNewDue')?.value;
  if(!allowed(group_id)||title.length<3||title.length>180){toast('Revisa el equipo y el título (3–180 caracteres).','bad');return}
  if(translation_id&&!S.studioTranslations?.some(p=>p.id===translation_id&&p.group_id===group_id)){toast('La obra no pertenece al equipo.','bad');return}
  if(assigned_to&&!work.data?.members?.some(m=>m.group_id===group_id&&m.user_id===assigned_to)){toast('Responsable ajeno al equipo.','bad');return}
  const dueAt=due?new Date(due):null;if(dueAt&&!Number.isFinite(dueAt.getTime())){toast('Fecha inválida.','bad');return}
  const btn=$('#workCreate');if(btn)btn.disabled=true;
  try{await jreq('/rest/v1/editorial_tasks',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({group_id,translation_id,title,details,priority,assigned_to,created_by:S.user.id,due_at:dueAt?.toISOString()||null})});await load();toast('Tarea creada.','ok')}
  catch(e){toast(friendlyError(e,'No se pudo crear la tarea.'),'bad')}
  finally{if(btn?.isConnected)btn.disabled=false}
 }
 async function setState(id,state){
  const t=work.data?.tasks.find(t=>t.id===id);
  if(!t||!STATES.some(([k])=>k===state)||!(isManager(t.group_id)||t.created_by===S.user?.id||t.assigned_to===S.user?.id&&allowed(t.group_id)))return;
  try{await jreq('/rest/v1/editorial_tasks?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:state})});await load();toast('Tarea actualizada.','ok')}
  catch(e){toast(friendlyError(e),'bad');await load()}
 }
 async function review(id,decision){
  const r=work.data?.reviews.find(r=>r.id===id);
  if(!r||r.status!=='pending'||!teamCan(r.group_id,'review')||r.requested_by===S.user?.id||(r.assigned_to&&r.assigned_to!==S.user?.id&&!isManager(r.group_id)))return;
  const note=$('[data-work-note="'+id+'"]')?.value.trim()||null;
  if(decision==='changes_requested'&&!note){toast('Escribe las correcciones requeridas.','bad');return}
  try{await jreq('/rest/v1/editorial_review_requests?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:decision,review_note:note})});await load();toast('Revisión registrada.','ok')}
  catch(e){toast(friendlyError(e),'bad')}
 }
 function bind(){
  const team=$('#workTeamFilter');if(team)team.onchange=()=>{work.team=team.value;render()};
  const st=$('#workStatusFilter');if(st)st.onchange=()=>{work.status=st.value;render()};
  const refresh=$('#workRefresh');if(refresh)refresh.onclick=load;
  const group=$('#workNewGroup'),project=$('#workNewProject'),assignee=$('#workNewAssignee');
  if(group){const update=()=>{for(const select of [project,assignee])if(select){for(const opt of select.options)opt.hidden=!!opt.dataset.team&&opt.dataset.team!==group.value;if(select.selectedOptions[0]?.hidden)select.value=''}};group.onchange=update;update()}
  const createBtn=$('#workCreate');if(createBtn)createBtn.onclick=create;
  $$('[data-work-state]').forEach(el=>el.onchange=()=>setState(el.dataset.workState,el.value));
  $$('[data-work-open]').forEach(el=>el.onclick=()=>openProject(el.dataset.workOpen));
  $$('[data-work-approve]').forEach(el=>el.onclick=()=>review(el.dataset.workApprove,'approved'));
  $$('[data-work-changes]').forEach(el=>el.onclick=()=>review(el.dataset.workChanges,'changes_requested'));
 }
 return {view,bind,load};
};
