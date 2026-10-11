/* Studio Fase 6 — diagnóstico de calidad previo a publicar.
   Reutiliza datos ya autorizados del proyecto; no consulta contenidos de otros equipos ni cambia estados.
*/
window.createStudioPhase6=function({S,esc,$,$$,teamCan,editSection,toast,blocksToPlainText}){
 const levelLabels={error:'Requiere corrección',warning:'Advertencia',info:'Sugerencia'};
 const kinds=['error','warning','info'];
 function reportFor(project){
  if(!project)return {issues:[],volumes:[],totals:{errors:0,warnings:0,infos:0,sections:0,images:0}};
  const issues=[],volumes=[],novel=project.novels||{},reviews=project.review_requests||[],schedules=project.publication_schedules||[];
  const add=(level,code,message,volume=null,sec=null)=>issues.push({
   level,code,message,volumeId:volume?.id||null,volumeLabel:volume?'Vol. '+volume.volume_number:'',
   sectionId:sec?.id||null,sectionLabel:sec?.title||''
  });
  if(!['light_novel','web_novel','original'].includes(novel.novel_type))
   add('warning','novel-type','Especifica si la obra es novela ligera, web u original.');
  if(!String(novel.title||project.title||'').trim())add('warning','novel-title','La obra no tiene un título público.');
  if(!String(novel.synopsis||'').trim())add('warning','novel-synopsis','Falta la sinopsis pública de la obra.');
  if(!String(novel.author_name||'').trim())add('info','novel-author','Se recomienda indicar el autor de la obra.');
  if(!Array.isArray(novel.genres)||!novel.genres.length)add('warning','novel-genres','Selecciona al menos un género.');
  if(!String(novel.demography||'').trim())add('warning','novel-demography','Falta especificar la demografía.');
  if(!novel.cover_url)add('warning','novel-cover','No se ha asignado una portada a la obra.');
  if(!(project.volumes||[]).length)add('warning','no-volumes','La obra todavía no tiene volúmenes.');
  let sectionsCount=0,imagesCount=0;
  for(const volume of project.volumes||[]){
   const before=issues.length,sections=volume.sections||[];
   if(!sections.length)add('error','empty-volume','El volumen aún no tiene capítulos ni secciones.',volume);
   if(!volume.cover_url)add('warning','volume-cover','Este volumen no tiene portada propia.',volume);
   if(!String(volume.title||'').trim())add('info','volume-title','Puedes añadir un título descriptivo para este volumen.',volume);
   if(volume.is_final_volume&&!['complete','awaiting_sequel','no_sequel_confirmed'].includes(volume.final_translation_status))
    add('error','final-status','El volumen final necesita un estado automático válido.',volume);
   if(!volume.is_final_volume&&volume.final_translation_status)
    add('warning','final-flag','Existe un estado final sin que el volumen esté marcado como final.',volume);
   const numberSeen=new Set(),titleSeen=new Set();
   for(const sec of sections){
    sectionsCount++;
    const title=String(sec.title||'').trim(),display=title||'Sin título';
    if(!title||title.toLocaleLowerCase('es')==='sin título')add('warning','chapter-title','Esta sección no tiene un título descriptivo.',volume,sec);
    const uniqueTitle=title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
    if(uniqueTitle&&titleSeen.has(uniqueTitle))add('warning','chapter-duplicate-title','Hay títulos de secciones repetidos en este volumen.',volume,sec);
    titleSeen.add(uniqueTitle);
    const num=String(sec.section_number??'').trim();
    if(num&&numberSeen.has(num))add('warning','chapter-duplicate-number','El número de esta sección está repetido.',volume,sec);
    if(num)numberSeen.add(num);
    const blocks=Array.isArray(sec.content)?sec.content:[];
    const readable=blocks.some(b=>['paragraph','heading','quote','translator_note','ruby'].includes(b?.type)&&String(b.text||b.base||'').trim());
    const images=blocks.filter(b=>b?.type==='image');
    imagesCount+=images.length;
    const validImage=images.some(b=>String(b.url||'').trim());
    if(!readable&&!validImage)add('error','chapter-empty',display+': no hay contenido de lectura.',volume,sec);
    if(images.some(b=>!String(b.url||'').trim()))add('warning','image-url','Hay ilustraciones sin archivo o enlace.',volume,sec);
    if(images.some(b=>String(b.url||'').trim()&&!String(b.alt||'').trim()))add('warning','image-alt','Añade una descripción accesible a las ilustraciones.',volume,sec);
    if(blocks.some(b=>b?.type==='ruby'&&(!String(b.base||'').trim()||!String(b.reading||'').trim())))
     add('warning','ruby-incomplete','Se encontró furigana incompleto.',volume,sec);
    if(blocks.some(b=>b?.type==='paragraph'&&String(b.text||'').length>2500))
     add('info','long-paragraph','Hay párrafos extensos; revisa su legibilidad en móvil.',volume,sec);
    if(project.translator_groups?.review_required&&sec.status!=='published'){
     const history=reviews.filter(r=>r.section_id===sec.id).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
     if(!history.length||history[0].status!=='approved')
      add('error','review-required','El equipo exige aprobación editorial antes de publicar esta sección.',volume,sec);
     else
      add('info','review-verify','Confirma que la aprobación corresponde al texto actual antes de publicar.',volume,sec);
    }else if(reviews.some(r=>r.section_id===sec.id&&r.status==='pending'))
     add('info','review-pending','Hay una revisión editorial pendiente.',volume,sec);
   }
   const pending=schedules.filter(s=>s.volume_id===volume.id);
   if(pending.some(s=>s.status==='failed'))add('warning','schedule-failed','Se detectó una programación de publicación fallida.',volume);
   if(pending.some(s=>s.status==='pending'))add('info','schedule-pending','Este volumen tiene una publicación programada.',volume);
   const subset=issues.slice(before);
   volumes.push({id:volume.id,number:volume.volume_number,title:volume.title||'',sections:sections.length,errors:subset.filter(v=>v.level==='error').length,warnings:subset.filter(v=>v.level==='warning').length,infos:subset.filter(v=>v.level==='info').length});
  }
  const rank={error:0,warning:1,info:2};
  issues.sort((a,b)=>rank[a.level]-rank[b.level]);
  return {issues,volumes,totals:{errors:issues.filter(i=>i.level==='error').length,warnings:issues.filter(i=>i.level==='warning').length,infos:issues.filter(i=>i.level==='info').length,sections:sectionsCount,images:imagesCount}};
 }
 function renderPanel(project){
  const report=reportFor(project),canEdit=teamCan(project.group_id,'edit');
  const q=S.studioQaQuery||'',filter=S.studioQaSeverity||'all';
  const items=report.issues;
  return `<details class="studioV6Audit" id="studioProjectQuality">
   <summary class="studioV6Summary"><span><span class="studioV3Kicker">FASE 6 · PREPUBLICACIÓN</span><strong>Auditoría editorial</strong><small>Diagnóstico de metadatos, capítulos, ilustraciones, revisiones y volúmenes finales</small></span><span class="studioV6Indicators"><span class="studioV6Count ${report.totals.errors?'isError':''}">${report.totals.errors} errores</span><span class="studioV6Count">${report.totals.warnings} avisos</span><span class="studioV6Count">${report.totals.infos} sugerencias</span></span></summary>
   <div class="studioV6Body"><div class="studioV6Intro"><p>Se analizan los datos cargados en Studio. Este informe no verifica enlaces remotos ni sustituye las políticas de permisos, aprobación y publicación del servidor. Los errores requieren revisión; las advertencias deben comprobarse antes de continuar.</p><button class="btn" type="button" data-qa-export="json">Exportar diagnóstico (.json)</button></div>
   <div class="studioV6Stats"><div><strong>${report.volumes.length}</strong><span>Volúmenes</span></div><div><strong>${report.totals.sections}</strong><span>Secciones</span></div><div><strong>${report.totals.images}</strong><span>Ilustraciones</span></div><div><strong>${report.totals.errors+report.totals.warnings}</strong><span>Aspectos por revisar</span></div></div>
   <section class="studioV6VolumeSection" aria-label="Resumen de volúmenes"><h3>Estado por volumen</h3><div class="studioV6Volumes">${report.volumes.length?report.volumes.map(v=>`<article class="studioV6Volume"><span class="studioV6VolumeNumber">Vol. ${esc(v.number)}</span><strong>${esc(v.title||'Sin título descriptivo')}</strong><small>${v.sections} secciones · ${v.errors} errores · ${v.warnings} avisos</small><button type="button" class="btn" data-qa-volume="${esc(v.id)}">Ver volumen</button></article>`).join(''):'<p class="muted">Agrega un volumen para iniciar la revisión.</p>'}</div></section>
   <div class="studioV6FindingsHead"><div><h3>Hallazgos del diagnóstico</h3><p class="muted" id="studioQaCount" aria-live="polite">${items.length} hallazgos</p></div><div class="studioV6Filters"><label for="studioQaSeverity">Gravedad</label><select id="studioQaSeverity"><option value="all" ${filter==='all'?'selected':''}>Todas</option>${kinds.map(k=>`<option value="${k}" ${filter===k?'selected':''}>${esc(levelLabels[k])}</option>`).join('')}</select><label for="studioQaQuery">Buscar</label><input type="search" id="studioQaQuery" autocomplete="off" value="${esc(q)}" placeholder="Problema o capítulo"></div></div>
   <div class="studioV6FindingList" id="studioQaFindings">${items.length?items.map(x=>`<article class="studioV6Finding" data-qa-severity="${x.level}" data-qa-search="${esc([x.message,x.volumeLabel,x.sectionLabel,x.code].join(' ').toLocaleLowerCase('es'))}"><div><span class="studioV6Tag studioV6Tag-${x.level}">${esc(levelLabels[x.level])}</span>${x.volumeId?`<small>${esc(x.volumeLabel)}${x.sectionLabel?' · '+esc(x.sectionLabel):''}</small>`:'<small>Información general</small>'}<p>${esc(x.message)}</p></div>${x.volumeId?`<div class="studioV6FindingActions"><button class="btn" type="button" data-qa-volume="${esc(x.volumeId)}">Localizar</button>${canEdit&&x.sectionId?`<button class="btn primary" type="button" data-qa-section="${esc(x.sectionId)}">Editar sección</button>`:''}</div>`:''}</article>`).join(''):'<p class="muted">Sin observaciones en este diagnóstico. Revisa también la vista previa de lectura antes de publicar.</p>'}</div>
   <p id="studioQaEmpty" class="muted" hidden>No hay hallazgos que coincidan con los filtros.</p></div></details>`;
 }
 function findIssueFilter(){
  const sev=$('#studioQaSeverity')?.value||'all',query=($('#studioQaQuery')?.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
  let shown=0;
  for(const el of $$('[data-qa-severity]')){
   const text=(el.dataset.qaSearch||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
   el.hidden=!(sev==='all'||el.dataset.qaSeverity===sev)||!!query&&!text.includes(query);
   if(!el.hidden)shown++;
  }
  const total=$$('[data-qa-severity]').length;
  const counter=$('#studioQaCount');if(counter)counter.textContent=shown+' de '+total+' hallazgos';
  const empty=$('#studioQaEmpty');if(empty)empty.hidden=shown!==0||total===0;
 }
 function goToVolume(id){
  const els=$$('[data-studio-volume-id]');
  const el=els.find(x=>x.dataset.studioVolumeId===id);
  if(!el){toast('No se encontró este volumen en la vista actual.','bad');return}
  const details=$('#studioProjectQuality');if(details)details.open=false;
  el.scrollIntoView({behavior:'auto',block:'start'});
  el.setAttribute('tabindex','-1');el.focus({preventScroll:true});
 }
 function exportReport(project){
  const report=reportFor(project);
  const value={format:'nlobi-studio-quality-v1',generated_at:new Date().toISOString(),translation_id:project.id,
   title:project.novels?.title||project.title||'',summary:report.totals,volumes:report.volumes,issues:report.issues};
  const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='nlobi-auditoria-'+String(project.id||'obra').replace(/[^a-zA-Z0-9-]/g,'').slice(0,60)+'.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function bind(){
  const input=$('#studioQaQuery');if(input)input.oninput=()=>{S.studioQaQuery=input.value;findIssueFilter()};
  const severity=$('#studioQaSeverity');if(severity)severity.onchange=()=>{S.studioQaSeverity=severity.value;findIssueFilter()};
  if(input||severity)findIssueFilter();
  $$('[data-qa-volume]').forEach(btn=>btn.onclick=()=>goToVolume(btn.dataset.qaVolume));
  $$('[data-qa-section]').forEach(btn=>btn.onclick=()=>{const p=S.studioProject;if(p&&teamCan(p.group_id,'edit'))editSection(btn.dataset.qaSection)});
  const exportButton=$('[data-qa-export]');if(exportButton)exportButton.onclick=()=>{
   if(S.studioProject?.id&&S.groups.some(g=>g.translator_groups?.id===S.studioProject.group_id))exportReport(S.studioProject);
  };
 }
 return {reportFor,renderPanel,bind,findIssueFilter};
};
