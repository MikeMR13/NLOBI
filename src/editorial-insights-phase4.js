window.createEditorialInsightsPhase4=function createEditorialInsightsPhase4({S,jreq,esc,toast,friendlyError,teamCan,openProject,render,getWorkData,getTeamFilter}){
 let data={comments:[],errata:[],loading:false,error:'',scope:'',truncated:false};
 const now=()=>Date.now();
 const stamp=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:0};
 const fmt=v=>v?new Date(v).toLocaleDateString('es-MX',{year:'numeric',month:'short',day:'numeric'}):'—';
 const title=p=>p?.novels?.title||p?.title||'Obra';
 const teamIds=()=>new Set((S.groups||[]).map(g=>g.translator_groups?.id).filter(Boolean));
 const projects=()=> (S.studioTranslations||[]).filter(p=>teamIds().has(p.group_id));
 function publishedSections(){
  return projects().flatMap(p=>(p.volumes||[]).filter(v=>v.status==='published').flatMap(v=>(v.sections||[]).filter(s=>s.status==='published').map(s=>({s,p,v}))));
 }
 const bySection=()=>new Map(publishedSections().map(x=>[x.s.id,x]));
 const currentScope=()=>[S.user?.id||'',...(projects().map(p=>p.id).sort())].join('|');
 async function load(force=false){
  const scope=currentScope();
  if(!force&&data.scope===scope&&(data.loading||data.fetched))return;
  data={comments:[],errata:[],loading:true,error:'',scope,truncated:false,fetched:false};
  if(!S.user)return;
  const published=publishedSections().sort((a,b)=>stamp(b.s.updated_at)-stamp(a.s.updated_at));
  const limited=published.slice(0,180);
  data.truncated=published.length>limited.length;
  if(!limited.length){data.loading=false;data.fetched=true;if(S.view==='studio:work')render();return}
  const blocks=[];
  for(let i=0;i<limited.length;i+=50)blocks.push(limited.slice(i,i+50).map(x=>x.s.id));
  const requests=blocks.flatMap(ids=>{
   const q='section_id=in.('+ids.map(encodeURIComponent).join(',')+')';
   return [
    jreq('/rest/v1/comments?'+q+'&select=id,section_id,body,is_spoiler,created_at&order=created_at.desc&limit=80'),
    jreq('/rest/v1/translation_errata?'+q+'&select=id,section_id,excerpt,body,status,resolution_note,created_at,updated_at&order=created_at.desc&limit=120')
   ];
  });
  const results=await Promise.allSettled(requests);
  if(data.scope!==scope)return;
  data.comments=results.filter((r,i)=>i%2===0&&r.status==='fulfilled').flatMap(r=>r.value||[]).sort((a,b)=>stamp(b.created_at)-stamp(a.created_at)).slice(0,80);
  data.errata=results.filter((r,i)=>i%2===1&&r.status==='fulfilled').flatMap(r=>r.value||[]).sort((a,b)=>stamp(b.created_at)-stamp(a.created_at)).slice(0,240);
  const errors=results.map((r,i)=>r.status==='rejected'?(i%2?'erratas':'comentarios'):null).filter(Boolean);
  if(errors.length)data.error='No se pudieron cargar algunos datos: '+[...new Set(errors)].join(', ')+'.';
  data.loading=false;data.fetched=true;
  if(S.view==='studio:work')render();
 }
 const visibleProject=p=>getTeamFilter()==='all'||getTeamFilter()===p.group_id;
 function metrics(){
  const all=projects().filter(visibleProject),ids=new Set(all.map(p=>p.id));
  const published=all.flatMap(p=>(p.volumes||[]).filter(v=>v.status==='published'));
  const sections=all.flatMap(p=>(p.volumes||[]).flatMap(v=>v.sections||[]));
  const pub=sections.filter(s=>s.status==='published').length;
  const D=getWorkData()||{};
  const task=(D.tasks||[]).filter(t=>teamIds().has(t.group_id)&&
    (getTeamFilter()==='all'||t.group_id===getTeamFilter())&&!['done','cancelled'].includes(t.status));
  const reviews=(D.reviews||[]).filter(r=>getTeamFilter()==='all'||r.group_id===getTeamFilter()).filter(r=>r.status==='pending');
  const eventLast30=(D.events||[]).filter(e=>ids.has(e.translation_id)&&stamp(e.created_at)>=now()-30*86400000);
  const chapters=bySection();
  const myErrata=data.errata.filter(e=>visibleProject(chapters.get(e.section_id)?.p||{}));
  const myComments=data.comments.filter(e=>visibleProject(chapters.get(e.section_id)?.p||{}));
  return {works:all.length,volumes:published.length,chapters:pub,tasks:task.length,reviews:reviews.length,events:eventLast30.length,
   errata:myErrata,comments:myComments,sectionCount:sections.length,sections};
 }
 function view(){
  const M=metrics(),sectionMap=bySection(),projectsMap=new Map(projects().map(p=>[p.id,p]));
  const summary=[
   ['Obras del equipo',M.works],['Volúmenes publicados',M.volumes],['Capítulos publicados',M.chapters],['Tareas pendientes',M.tasks],
   ['Revisiones pendientes',M.reviews],['Eventos últimos 30 días',M.events]
  ];
  const open=M.errata.filter(e=>['open','reviewing'].includes(e.status));
  const resolved=M.errata.filter(e=>e.status==='resolved').length;
  const boardStats=summary.map(([label,val])=>`<div><strong>${val}</strong><span>${esc(label)}</span></div>`).join('');
  const rows=M.errata.slice(0,60).map(e=>{
   const ctx=sectionMap.get(e.section_id);
   if(!ctx)return '';
   const canUpdate=teamCan(ctx.p.group_id,'review')||teamCan(ctx.p.group_id,'edit');
   const stage=e.status==='resolved'?'Resuelta':e.status==='dismissed'?'Descartada':e.status==='reviewing'?'En revisión':'Nueva';
   return `<article class="studioV9Feedback"><div class="studioV9FeedbackHead"><span class="badge">${esc(stage)}</span><small>${esc(fmt(e.created_at))}</small></div>
     <strong>${esc(title(ctx.p))} · Vol. ${esc(ctx.v.volume_number??'—')} · ${esc(ctx.s.title||'Capítulo')}</strong>
     ${e.excerpt?`<blockquote>${esc(e.excerpt)}</blockquote>`:''}<p>${esc(e.body)}</p>
     ${e.resolution_note?`<p class="muted"><strong>Respuesta:</strong> ${esc(e.resolution_note)}</p>`:''}
     <div class="studioV9FeedbackActions"><button class="btn" type="button" data-v9-project="${esc(ctx.p.id)}">Abrir obra</button>
      ${canUpdate?`<label class="srOnly" for="v9Status-${esc(e.id)}">Estado de errata</label>
       <select id="v9Status-${esc(e.id)}" data-v9-status="${esc(e.id)}">
       ${[['open','Nueva'],['reviewing','En revisión'],['resolved','Resuelta'],['dismissed','Descartada']].map(([v,label])=>`<option value="${v}" ${e.status===v?'selected':''}>${label}</option>`).join('')}
       </select><label class="srOnly" for="v9Note-${esc(e.id)}">Nota de resolución</label>
       <input id="v9Note-${esc(e.id)}" maxlength="1200" data-v9-note="${esc(e.id)}" value="${esc(e.resolution_note||'')}" placeholder="Respuesta editorial">
       <button type="button" class="btn primary" data-v9-save="${esc(e.id)}">Guardar</button>`:''}</div></article>`;
  }).join('');
  const comments=M.comments.slice(0,30).map(c=>{
   const ctx=sectionMap.get(c.section_id);if(!ctx)return '';
   return `<article class="studioV9Feedback"><div class="studioV9FeedbackHead"><span class="badge">Comentario</span><small>${esc(fmt(c.created_at))}</small></div>
     <strong>${esc(title(ctx.p))} · ${esc(ctx.s.title||'Capítulo')}</strong>
     ${c.is_spoiler?`<details><summary>Ver comentario con spoiler</summary><p>${esc(c.body)}</p></details>`:`<p>${esc(c.body)}</p>`}
     <button class="btn" type="button" data-v9-project="${esc(ctx.p.id)}">Abrir obra</button></article>`;
  }).join('');
  return `<section class="studioV9Insights" aria-labelledby="studioV9Heading">
    <header class="studioV9Heading"><div><span class="studioV3Kicker">FASE 4 · SEGUIMIENTO EDITORIAL</span><h2 id="studioV9Heading">Estadísticas y comentarios</h2>
      <p class="muted">Datos reales del catálogo y las tareas. Las cifras no representan visitas, lectores únicos ni conversiones.</p></div>
      <button type="button" class="btn" data-v9-reload>Actualizar estadísticas</button></header>
    <div class="studioV9Stats">${boardStats}</div>
    <div class="studioV9FeedbackTotals"><strong>${open.length} erratas pendientes</strong><span>${resolved} resueltas · ${M.comments.length} comentarios recientes consultados</span></div>
    ${data.loading?'<p class="muted" role="status">Consultando comentarios y erratas…</p>':''}
    ${data.error?`<p class="notice" role="alert">${esc(data.error)}</p>`:''}
    ${data.truncated?'<p class="muted">La revisión de comentarios y erratas comprende los 180 capítulos publicados más recientemente actualizados de tus equipos.</p>':''}
    <div class="studioV9Panels">
      <section aria-label="Bandeja de erratas"><h3>Erratas de lectores</h3><p class="muted">Solo los responsables con permisos editoriales pueden cambiar su estado.</p>
        ${rows||'<p class="muted">No hay reportes de erratas en los capítulos consultados.</p>'}</section>
      <section aria-label="Comentarios recientes"><h3>Comentarios de capítulos</h3><p class="muted">Los comentarios ya se moderan con el sistema existente. Los spoilers permanecen ocultos.</p>
        ${comments||'<p class="muted">Sin comentarios recientes en los capítulos consultados.</p>'}</section>
    </div>
  </section>`;
 }
 async function updateErrata(id){
  const item=data.errata.find(e=>e.id===id),context=bySection().get(item?.section_id);
  if(!item||!context||!(teamCan(context.p.group_id,'review')||teamCan(context.p.group_id,'edit')))return;
  const status=document.querySelector('[data-v9-status="'+id+'"]')?.value;
  const note=document.querySelector('[data-v9-note="'+id+'"]')?.value.trim()||'';
  if(!['open','reviewing','resolved','dismissed'].includes(status)||note.length>1200)return;
  try{
   await jreq('/rest/v1/translation_errata?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,resolution_note:note})});
   await load(true);toast('Errata actualizada.','ok');
  }catch(e){toast(friendlyError(e,'No se pudo actualizar la errata.'),'bad')}
 }
 function bind(){
  document.querySelectorAll('[data-v9-save]').forEach(b=>b.onclick=()=>updateErrata(b.dataset.v9Save));
  document.querySelectorAll('[data-v9-project]').forEach(b=>b.onclick=()=>openProject(b.dataset.v9Project));
  document.querySelectorAll('[data-v9-reload]').forEach(b=>b.onclick=()=>load(true));
 }
 return {load,view,bind,metrics};
};
