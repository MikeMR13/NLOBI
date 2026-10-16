window.createStudioBoardPhase3=function createStudioBoardPhase3({S,esc,jreq,teamCan,isManager,toast,friendlyError,openProject,getData,getTeamFilter,refresh}){
 const STAGES=[
  {key:'draft',title:'Traducción',help:'Borrador sin revisión vigente'},
  {key:'review',title:'En revisión',help:'Solicitud pendiente'},
  {key:'changes',title:'Correcciones',help:'Cambios solicitados'},
  {key:'ready',title:'Listo',help:'Revisión aprobada'},
  {key:'published',title:'Publicado',help:'Capítulo disponible'}
 ];
 const safeDate=x=>{const time=Date.parse(x||'');return Number.isFinite(time)?time:0};
 const projectTitle=p=>p?.novels?.title||p?.title||'Obra';
 const memberName=(groupId,id)=>{
  const m=(getData()?.members||[]).find(m=>m.group_id===groupId&&m.user_id===id);
  return m?.profiles?.display_name||m?.profiles?.username||(id?'Integrante del equipo':'Sin asignar');
 };
 const currentTeam=()=>getTeamFilter();
 const allowedProject=p=>{
  const groups=(S.groups||[]).map(g=>g.translator_groups?.id);
  return groups.includes(p.group_id)&&(currentTeam()==='all'||currentTeam()===p.group_id);
 };
 function stage(section,review){
  if(section.status==='published')return 'published';
  if(!review)return 'draft';
  if(review.status==='pending')return 'review';
  if(review.status==='changes_requested')return 'changes';
  if(review.status==='approved'){
   const edited=safeDate(section.updated_at),reviewed=safeDate(review.reviewed_at||review.created_at);
   return edited>reviewed&&reviewed>0?'draft':'ready';
  }
  return 'draft';
 }
 function chapters(){
  const D=getData()||{};
  const latest=new Map();
  for(const r of [...(D.reviews||[])].sort((a,b)=>safeDate(b.reviewed_at||b.created_at)-safeDate(a.reviewed_at||a.created_at))){
   if(!latest.has(r.section_id))latest.set(r.section_id,r);
  }
  return (S.studioTranslations||[]).filter(allowedProject).flatMap(p=>
   (p.volumes||[]).flatMap(v=>(v.sections||[]).map(s=>({p,v,s,review:latest.get(s.id),stage:stage(s,latest.get(s.id))})))
  ).sort((a,b)=>safeDate(b.s.updated_at)-safeDate(a.s.updated_at));
 }
 function taskAssigneeControl(t){
  const canEdit=(isManager(t.group_id)||t.created_by===S.user?.id)&&
   ['edit','create','review'].some(a=>teamCan(t.group_id,a));
  if(!canEdit)return '';
  const members=(getData()?.members||[]).filter(m=>m.group_id===t.group_id);
  return `<label class="srOnly" for="boardAssignee-${esc(t.id)}">Responsable de ${esc(t.title)}</label>
   <select id="boardAssignee-${esc(t.id)}" data-board-assignee="${esc(t.id)}" aria-label="Asignar responsable de ${esc(t.title)}">
     <option value="">Sin asignar</option>${members.map(m=>`<option value="${esc(m.user_id)}" ${m.user_id===t.assigned_to?'selected':''}>${esc(memberName(t.group_id,m.user_id))}</option>`).join('')}
   </select>`;
 }
 async function reassign(taskId,person){
  const D=getData();
  const task=D?.tasks?.find(t=>t.id===taskId);
  if(!task||!((isManager(task.group_id)||task.created_by===S.user?.id)&&['edit','create','review'].some(a=>teamCan(task.group_id,a))))return;
  const selected=person||null;
  if(selected&&!D.members.some(m=>m.group_id===task.group_id&&m.user_id===selected)){
   toast('El responsable debe pertenecer al mismo equipo.','bad');return;
  }
  try{
   await jreq('/rest/v1/editorial_tasks?id=eq.'+encodeURIComponent(taskId),{
    method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({assigned_to:selected})
   });
   await refresh();toast('Responsable actualizado.','ok');
  }catch(e){toast(friendlyError(e,'No se pudo asignar la tarea.'),'bad');await refresh()}
 }
 function view(){
  const D=getData();
  if(!D)return '';
  const cards=chapters();
  const lanes=STAGES.map(l=>{
   const matches=cards.filter(c=>c.stage===l.key);
   return `<section class="studioV8Lane" aria-label="${esc(l.title)}">
    <header><h3>${esc(l.title)}</h3><span class="badge">${matches.length}</span><p>${esc(l.help)}</p></header>
    ${matches.length?matches.slice(0,25).map(c=>{
     const title=c.s.title||'Capítulo '+(c.s.section_number||'—');
     const reviewer=c.review?'Revisor: '+memberName(c.p.group_id,c.review.assigned_to):'Sin solicitud de revisión';
     return `<article class="studioV8ChapterCard">
      <strong>${esc(title)}</strong><span>${esc(projectTitle(c.p))} · Vol. ${esc(c.v.volume_number??'—')}</span>
      <small>${esc(reviewer)}</small>
      <button class="btn" type="button" data-board-open="${esc(c.p.id)}">Abrir obra</button>
     </article>`;
    }).join(''):'<p class="muted">No hay capítulos en esta etapa.</p>'}
    ${matches.length>25?`<p class="muted">Mostrando 25 de ${matches.length}; abre la obra para ver más.</p>`:''}
   </section>`;
  }).join('');
  const belongs=x=>currentTeam()==='all'||currentTeam()===x.group_id;
  const rows=[
   ...(D.events||[]).filter(belongs).map(e=>({when:e.created_at,label:'Publicación',description:e.summary||e.event_type,group:e.group_id,by:e.actor_user_id})),
   ...(D.tasks||[]).filter(belongs).map(t=>({when:t.updated_at,label:'Tarea',description:t.title+' · '+t.status,group:t.group_id,by:t.assigned_to})),
   ...(D.reviews||[]).filter(belongs).map(r=>({when:r.reviewed_at||r.created_at,label:'Revisión',description:r.status,group:r.group_id,by:r.assigned_to}))
  ].sort((a,b)=>safeDate(b.when)-safeDate(a.when)).slice(0,24);
  return `<section class="studioV8BoardPanel" aria-labelledby="studioV8Title">
    <header class="studioV8Heading"><div><span class="studioV3Kicker">STUDIO · FLUJO EDITORIAL</span><h2 id="studioV8Title">Tablero de capítulos</h2>
     <p>Etapas calculadas desde los borradores, solicitudes de revisión y publicaciones existentes. El tablero no publica ni envía notificaciones.</p></div>
     <span class="badge">${cards.length} capítulos</span></header>
    <div class="studioV8Board" role="region" tabindex="0" aria-label="Tablero editorial desplazable horizontalmente">${lanes}</div>
    <section class="studioV8Log" aria-labelledby="studioV8LogTitle"><h3 id="studioV8LogTitle">Bitácora editorial integrada</h3>
     <p class="muted">Tareas, revisiones y eventos de publicación de tus equipos, sin exponer capítulos privados.</p>
     ${rows.length?`<ol>${rows.map(row=>`<li><span class="badge">${esc(row.label)}</span><strong>${esc(row.description)}</strong>
       <small>${esc(new Date(row.when||0).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}))} · ${esc(memberName(row.group,row.by))}</small></li>`).join('')}</ol>`:'<p class="muted">Aún no hay actividad editorial registrada.</p>'}
    </section>
   </section>`;
 }
 function bind(){
  document.querySelectorAll('[data-board-open]').forEach(b=>b.onclick=()=>openProject(b.dataset.boardOpen));
  document.querySelectorAll('[data-board-assignee]').forEach(el=>el.onchange=()=>reassign(el.dataset.boardAssignee,el.value));
 }
 return {view,bind,stage,chapters,taskAssigneeControl,reassign};
};
