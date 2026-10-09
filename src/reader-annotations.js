// NLOBI reader phase 8 — private per-user bookmarks, highlights and notes.
// Text anchors reference content block indices + plain-text offsets (never alter published blocks).
export function createReaderAnnotations({state,request,escape,flow,openChapter,renderApp,notify,cancelAutoResume=()=>{}}){
 const S=()=>state();
 let entries=[],owner=null,loading=null,root=null,streamObserver=null,controller=null,chosen=null,editing=null,libraryFilter='all',pendingJump=null,lastViewed=null;
 const table='/rest/v1/reader_annotations';
 const cleanId=id=>/^[0-9a-f-]{36}$/i.test(String(id||''))?String(id):'';
 const safeKind=kind=>['bookmark','highlight','note'].includes(kind)?kind:'bookmark';
 const colors=['amber','mint','rose','blue'];
 const esc=x=>escape(String(x??''));
 const all=()=>entries.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
 const current=()=>flow.active();
 const currentRows=()=>all().filter(x=>x.section_id===current()?.id);
 const ownerValid=()=>!!(owner&&S().user?.id===owner);
 function reset(){
  controller?.abort();controller=null;
  streamObserver?.disconnect();streamObserver=null;
  owner=null;entries=[];loading=null;chosen=null;editing=null;pendingJump=null;lastViewed=null;root=null;
 }
 async function load(){
  const uid=S().user?.id;
  if(!uid){reset();return []}
  if(owner!==uid){reset();owner=uid}
  if(loading)return loading;
  loading=(async()=>{
   try{
    const rows=await request(table+'?user_id=eq.'+encodeURIComponent(uid)+'&select=id,user_id,translation_id,section_id,kind,anchor_mode,start_block,start_offset,end_block,end_offset,excerpt,note,color,created_at,updated_at,sections(title),translations(title,novels(title))&order=created_at.desc&limit=1000');
    if(owner===uid&&S().user?.id===uid)entries=Array.isArray(rows)?rows:[];
   }catch(err){console.warn('[NLOBI] Anotaciones pendientes de cargar',err);if(owner===uid)notify('No fue posible cargar tus anotaciones.','bad')}
   finally{loading=null}
   if(owner===uid){refreshReader();if(S().view==='library'&&S().libraryTab==='annotations')renderApp()}
   return entries;
  })();
  return loading;
 }
 function ensureUser(){if(!S().user?.id){notify('Inicia sesión para guardar marcadores, subrayados y notas privadas.','bad');return false}if(!navigator.onLine){notify('Conéctate a internet para guardar anotaciones en tu cuenta.','bad');return false}if(owner!==S().user.id){void load();notify('Cargando tus anotaciones, inténtalo de nuevo.','bad');return false}return true}
 function segmentText(block,start=0,end=170){return String(block?.textContent||'').trim().slice(start,end)}
 function paragraphAnchor(){
  const r=current(),paper=flow.paper(r?.id);if(!paper)return null;
  const pos=flow.position(r.id),block=Number(pos?.block)||0,anchor=paper.querySelector('[data-block-index="'+block+'"]');
  return {section_id:r.id,translation_id:r.translation_id,kind:'bookmark',anchor_mode:'block',
   start_block:block,start_offset:Math.round((Number(pos?.offset)||0)*1000),end_block:null,end_offset:null,
   excerpt:segmentText(anchor)||r.title||'Marcador de lectura',note:'',color:'amber'};
 }
 function blockOffset(block,node,offset){
  const range=document.createRange();range.selectNodeContents(block);range.setEnd(node,offset);
  return range.toString().length;
 }
 function capture(){
  if(!root)return null;
  const selection=document.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
  const range=selection.getRangeAt(0),start=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;
  const end=range.endContainer.nodeType===1?range.endContainer:range.endContainer.parentElement;
  const first=start?.closest?.('[data-block-index]'),last=end?.closest?.('[data-block-index]');
  if(!first||!last||!root.contains(first)||!root.contains(last))return null;
  const parent=first.closest('.readerPaper'),lastParent=last.closest('.readerPaper');
  if(!parent||parent!==lastParent||!parent.dataset.sectionId)return null;
  const chapter=parent.dataset.sectionId;
  const active=chapter===current()?.id?current():current()?.navigation?.find(x=>x.id===chapter);
  if(!active)return null;
  const a=Number(first.dataset.blockIndex),b=Number(last.dataset.blockIndex);
  const x=blockOffset(first,range.startContainer,range.startOffset),y=blockOffset(last,range.endContainer,range.endOffset);
  if(a>b||(a===b&&x>=y))return null;
  const excerpt=selection.toString().replace(/\s+/g,' ').trim().slice(0,1200);
  if(!excerpt||excerpt.length<2)return null;
  const rect=range.getBoundingClientRect();
  return {section_id:chapter,translation_id:active.translation_id||current()?.translation_id,
   kind:'highlight',anchor_mode:'text',start_block:a,start_offset:x,end_block:b,end_offset:y,
   excerpt,note:'',color:'amber',rect:{x:rect.left+rect.width/2,y:rect.top}};
 }
 async function save(data){
  if(!ensureUser()||!data||!cleanId(data.translation_id)||!cleanId(data.section_id))return false;
  const uid=S().user.id,ownerAtStart=owner;
  const payload={user_id:uid,translation_id:data.translation_id,section_id:data.section_id,
   kind:safeKind(data.kind),anchor_mode:data.anchor_mode==='text'?'text':'block',
   start_block:Math.max(0,Math.min(99999,Math.floor(Number(data.start_block)||0))),
   start_offset:Math.max(0,Math.min(1000000,Math.round(Number(data.start_offset)||0))),
   end_block:data.anchor_mode==='text'?Math.floor(Number(data.end_block)):null,
   end_offset:data.anchor_mode==='text'?Math.round(Number(data.end_offset)):null,
   excerpt:String(data.excerpt||'').slice(0,1200),note:String(data.note||'').trim().slice(0,4000),
   color:colors.includes(data.color)?data.color:'amber'};
  try{
   let returned;
   if(data.id){
    const url=table+'?id=eq.'+encodeURIComponent(data.id)+'&user_id=eq.'+encodeURIComponent(uid);
    returned=await request(url,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({note:payload.note,color:payload.color,updated_at:new Date().toISOString()})});
   }else returned=await request(table,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
   if(owner!==ownerAtStart||S().user?.id!==uid)return false;
   if(!Array.isArray(returned)||!returned.length)throw Error('No se confirmó el guardado.');
   if(data.id){entries=entries.map(x=>x.id===data.id?{...x,...returned[0]}:x)}
   else entries.unshift(returned[0]);
   document.getSelection()?.removeAllRanges();chosen=null;hideSelection();refreshReader();
   notify(data.id?'Anotación actualizada.':payload.kind==='bookmark'?'Marcador añadido.':'Anotación guardada.','ok');
   if(S().view==='library'&&S().libraryTab==='annotations')renderApp();
   return true;
  }catch(err){notify('No se guardó la anotación: '+String(err.message||err),'bad');return false}
 }
 async function remove(id){
  const item=entries.find(x=>x.id===id);if(!item||!ensureUser()||!confirm('¿Eliminar esta anotación privada?'))return;
  try{
   await request(table+'?id=eq.'+encodeURIComponent(id)+'&user_id=eq.'+encodeURIComponent(owner),{method:'DELETE',headers:{Prefer:'return=minimal'}});
   entries=entries.filter(x=>x.id!==id);refreshReader();
   if(S().view==='library'&&S().libraryTab==='annotations')renderApp();
   notify('Anotación eliminada.','ok');
  }catch(err){notify('No se pudo eliminar la anotación.','bad')}
 }
 function titleFor(x){return x.sections?.title||x.section_id===current()?.id?x.sections?.title||current()?.title||'Capítulo':'Capítulo guardado'}
 function titleOf(x){return x.translations?.novels?.title||x.translations?.title||'Novela'}
 function labelFor(x){return x.kind==='bookmark'?'Marcador':x.kind==='note'?'Nota':'Subrayado'}
 function card(x,library=false){
  return '<article class="readerAnnotationCard" data-annotation-id="'+esc(x.id)+'">'+
   '<div class="readerAnnotationCardHead"><span class="readerAnnotationKind">'+esc(labelFor(x))+'</span><span class="readerAnnotationDate">'+esc((x.created_at||'').slice(0,10))+'</span></div>'+
   (library?'<div class="readerAnnotationOrigin">'+esc(titleOf(x))+' · '+esc(x.sections?.title||'Capítulo')+'</div>':'')+
   '<p class="readerAnnotationExcerpt '+(x.kind!=='bookmark'?'readerAnnotationExcerptColor-'+esc(x.color):'')+'">'+esc(x.excerpt||'Punto guardado')+'</p>'+
   (x.note?'<p class="readerAnnotationNote">'+esc(x.note)+'</p>':'')+
   '<div class="readerAnnotationCardActions"><button type="button" data-annotation-go="'+esc(x.id)+'">Ir al fragmento</button>'+
   '<button type="button" data-annotation-edit="'+esc(x.id)+'">Editar</button><button type="button" data-annotation-delete="'+esc(x.id)+'" class="danger">Eliminar</button></div></article>';
 }
 function refreshReader(){
  if(!root?.isConnected)return;
  const items=root.querySelector('#readerAnnotationItems');
  if(items)items.innerHTML=currentRows().length?currentRows().map(x=>card(x)).join(''):'<p class="muted">Todavía no has guardado marcadores ni subrayados en este capítulo.</p>';
  const count=root.querySelector('#readerAnnotationCount');
  if(count)count.textContent=currentRows().length+' guardadas';
  applyHighlights();
 }
 function markText(block,from,to,color){
  if(to<=from)return;
  const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
  let node,offset=0,nodes=[];
  while(node=walker.nextNode()){
   const n=node.textContent?.length||0;
   if(n&&node.parentElement&&!node.parentElement.closest('script,style,rt,.readerAnnotationFloating'))nodes.push({node,start:offset,end:offset+n});
   offset+=n;
  }
  for(const part of nodes){
   const begin=Math.max(0,from-part.start),finish=Math.min(part.end-part.start,to-part.start);
   if(finish<=begin)continue;
   const original=part.node;
   // Split the text node to wrap only the annotated span; no HTML string injection.
   const tail=finish<original.length?original.splitText(finish):null;
   const inside=begin>0?original.splitText(begin):original;
   const tag=document.createElement('mark');tag.className='readerMarkedText readerMarked-'+color;
   inside.parentNode.insertBefore(tag,inside);tag.appendChild(inside);
   void tail;
  }
 }
 function applyHighlights(){
  const stream=root?.querySelector('#readerChapterStream');if(!stream)return;
  stream.querySelectorAll('mark.readerMarkedText').forEach(mark=>mark.replaceWith(...mark.childNodes));
  for(const paper of stream.querySelectorAll('.readerPaper[data-section-id]')){
   const rows=entries.filter(x=>x.section_id===paper.dataset.sectionId&&x.anchor_mode==='text');
   const blocks=[...paper.querySelectorAll('.readerAnchorBlock[data-block-index]')];
   for(const block of blocks){
    const idx=Number(block.dataset.blockIndex);
    const ranges=rows.filter(x=>idx>=x.start_block&&idx<=x.end_block).map(x=>({
      start:idx===x.start_block?x.start_offset:0,
      end:idx===x.end_block?x.end_offset:1e9,
      color:colors.includes(x.color)?x.color:'amber'
    }));
    if(!ranges.length)continue;
    const len=block.textContent?.length||0,breaks=[0,len];
    for(const r of ranges){breaks.push(Math.max(0,Math.min(len,r.start)),Math.max(0,Math.min(len,r.end)))}
    const points=[...new Set(breaks)].sort((a,b)=>a-b);
    for(let i=points.length-2;i>=0;i--){
     const from=points[i],to=points[i+1];
     const matched=ranges.findLast(r=>r.start<=from&&r.end>=to);
     if(matched)markText(block,from,to,matched.color);
    }
   }
  }
 }
 function track(){const id=current()?.id;if(id&&lastViewed!==id){lastViewed=id;refreshReader()}}
 function hideSelection(){const popup=root?.querySelector('#readerSelectionActions');if(popup)popup.hidden=true}
 function showSelection(){
  if(!root?.isConnected)return;
  const popup=root.querySelector('#readerSelectionActions');
  if(!popup)return;
  const data=capture();
  if(!data){hideSelection();return}
  chosen=data;popup.hidden=false;
  const x=Math.max(12,Math.min(window.innerWidth-popup.offsetWidth-12,data.rect.x-popup.offsetWidth/2));
  const y=Math.max(12,Math.min(window.innerHeight-popup.offsetHeight-12,data.rect.y-popup.offsetHeight-62));
  popup.style.left=x+'px';popup.style.top=y+'px';
 }
 function openEditor(entry,kind){
  if(!ensureUser())return;
  editing=entry?.id||null;
  if(entry&&!entry.id)chosen=entry;
  const dialog=root?.querySelector('#readerAnnotationEditor');
  if(!dialog)return;
  const title=root.querySelector('#readerAnnotationDialogTitle'),note=root.querySelector('#readerAnnotationNoteInput'),color=root.querySelector('#readerAnnotationColor');
  if(title)title.textContent=editing?'Editar anotación':kind==='bookmark'?'Nuevo marcador':kind==='note'?'Añadir nota al texto':'Subrayar texto';
  if(note)note.value=entry?.note||'';
  if(color)color.value=colors.includes(entry?.color)?entry.color:'amber';
  hideSelection();
  if(!dialog.open)dialog.showModal();
  note?.focus();
 }
 function restoreAnnotation(x){
  if(!x)return;
  const paper=flow.paper(x.section_id);if(!paper){pendingJump=x;return}
  const target=paper.querySelector('[data-block-index="'+x.start_block+'"]');
  if(!target){pendingJump=null;return}
  cancelAutoResume();
  const pos=x.anchor_mode==='block'?Number(x.start_offset||0)/1000:0;
  const rect=target.getBoundingClientRect(),top=Math.max(0,window.scrollY+rect.top+rect.height*pos-window.innerHeight*.32);
  window.scrollTo({top,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  pendingJump=null;
 }
 function navigate(id){
  const x=entries.find(a=>a.id===id);if(!x)return;
  pendingJump=x;
  if(S().view.startsWith('reader:')&&flow.paper(x.section_id)){restoreAnnotation(x);return}
  openChapter(x.section_id,x.translation_id);
 }
 function bindReader(){
  controller?.abort();controller=null;streamObserver?.disconnect();streamObserver=null;
  root=document.querySelector('.readerExperience');
  if(!root)return;
  controller=new AbortController();const signal=controller.signal;
  const content=root.querySelector('#readerChapterStream');
  root.addEventListener('mouseup',event=>{if(event.target.closest('button,dialog'))return;requestAnimationFrame(showSelection)},{signal});
  root.addEventListener('keyup',event=>{if(event.key==='Shift'||event.key.startsWith('Arrow'))requestAnimationFrame(showSelection)},{signal});
  root.addEventListener('touchend',()=>requestAnimationFrame(showSelection),{passive:true,signal});
  root.addEventListener('click',event=>{
   const target=event.target.closest('button');if(!target)return;
   if(target.id==='readerAddBookmark'){const x=paragraphAnchor();if(x)openEditor(x,'bookmark')}
   if(target.id==='readerAnnotationsToggle'){const panel=root.querySelector('#readerAnnotationsPanel');if(panel){panel.hidden=!panel.hidden;if(!panel.hidden){refreshReader();panel.querySelector('button')?.focus({preventScroll:true})}}}
   if(target.id==='readerAnnotationsClose'){root.querySelector('#readerAnnotationsPanel').hidden=true}
   if(target.dataset.readerSelection==='highlight'){const x=chosen;if(x){void save({...x,kind:'highlight'});hideSelection()}}
   if(target.dataset.readerSelection==='note'&&chosen)openEditor({...chosen,kind:'note'},'note');
   if(target.dataset.annotationGo)navigate(target.dataset.annotationGo);
   if(target.dataset.annotationEdit){const x=entries.find(a=>a.id===target.dataset.annotationEdit);if(x)openEditor(x,x.kind)}
   if(target.dataset.annotationDelete)void remove(target.dataset.annotationDelete);
   if(target.id==='readerAnnotationCancel')root.querySelector('#readerAnnotationEditor')?.close();
  },{signal});
  root.querySelector('#readerAnnotationForm')?.addEventListener('submit',async event=>{
   event.preventDefault();
   const x=editing?entries.find(x=>x.id===editing):chosen;if(!x)return;
   const payload={...x,kind:x.kind||'bookmark',note:root.querySelector('#readerAnnotationNoteInput')?.value||'',color:root.querySelector('#readerAnnotationColor')?.value||'amber'};
   const ok=await save(payload);
   if(ok){root.querySelector('#readerAnnotationEditor')?.close();editing=null;chosen=null}
  },{signal});
  if(content){streamObserver=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&n.matches?.('.readerPaper')))){refreshReader();if(pendingJump)requestAnimationFrame(()=>restoreAnnotation(pendingJump))}});streamObserver.observe(content,{childList:true})}
  lastViewed=current()?.id;refreshReader();
  if(pendingJump&&pendingJump.section_id===current()?.id)requestAnimationFrame(()=>requestAnimationFrame(()=>restoreAnnotation(pendingJump)));
 }
 function readerUi(){
  const signed=!!S().user;
  return '<div class="readerAnnotationTools"><button type="button" id="readerAddBookmark" title="Guardar este punto">♧ Añadir marcador</button><button type="button" id="readerAnnotationsToggle">Mis marcas y notas <span id="readerAnnotationCount">'+currentRows().length+' guardadas</span></button></div>'+
   '<div class="readerSelectionActions" id="readerSelectionActions" hidden role="toolbar" aria-label="Acciones para el texto seleccionado"><button type="button" data-reader-selection="highlight">Subrayar</button><button type="button" data-reader-selection="note">Añadir nota</button></div>'+
   '<aside class="readerAnnotationsPanel" id="readerAnnotationsPanel" hidden aria-label="Mis marcas y notas"><div class="readerAnnotationsHeader"><h2>Mis marcas y notas</h2><button id="readerAnnotationsClose" type="button" aria-label="Cerrar mis marcas">✕</button></div><p class="muted">Solo tú puedes consultar y editar estas anotaciones.</p><div id="readerAnnotationItems">'+(signed?(currentRows().length?currentRows().map(x=>card(x)).join(''):'<p class="muted">Todavía no tienes anotaciones en este capítulo.</p>'):'<p class="muted">Inicia sesión para guardar y sincronizar tus anotaciones.</p>')+'</div></aside>'+
   '<dialog id="readerAnnotationEditor" class="readerAnnotationEditor" aria-labelledby="readerAnnotationDialogTitle"><form id="readerAnnotationForm"><h2 id="readerAnnotationDialogTitle">Nueva anotación</h2><label for="readerAnnotationNoteInput">Nota privada (opcional)</label><textarea id="readerAnnotationNoteInput" maxlength="4000" rows="5" placeholder="Escribe lo que quieras recordar de esta escena..."></textarea><label for="readerAnnotationColor">Color de subrayado</label><select id="readerAnnotationColor"><option value="amber">Ámbar</option><option value="mint">Menta</option><option value="rose">Rosa</option><option value="blue">Azul</option></select><div class="readerAnnotationEditorButtons"><button id="readerAnnotationCancel" type="button">Cancelar</button><button type="submit" class="btn primary">Guardar anotación</button></div></form></dialog>';
 }
 function libraryUi(){
  const list=all().filter(x=>libraryFilter==='all'||x.kind===libraryFilter);
  return '<section class="readerAnnotationsLibrary" aria-labelledby="readerAnnotationsLibraryTitle"><div class="sectionHead"><div><span class="librarySectionKicker">TUS RECUERDOS</span><h2 id="readerAnnotationsLibraryTitle">Mis marcas y notas</h2><p>Marcadores, subrayados y notas privadas. Solo tú puedes verlos.</p></div></div>'+
   '<div class="readerAnnotationFilters" role="group" aria-label="Filtrar anotaciones">'+[['all','Todas'],['bookmark','Marcadores'],['highlight','Subrayados'],['note','Notas']].map(([kind,title])=>'<button type="button" data-annotation-filter="'+kind+'" class="'+(libraryFilter===kind?'active':'')+'" aria-pressed="'+(libraryFilter===kind)+'">'+title+'</button>').join('')+'</div>'+
   '<p class="muted">'+list.length+' anotaciones</p><div class="readerAnnotationLibraryGrid">'+(list.length?list.map(x=>card(x,true)).join(''):'<div class="empty"><strong>Aún no has guardado anotaciones.</strong><p>Abre un capítulo, selecciona un fragmento o añade un marcador.</p></div>')+'</div></section>';
 }
 function bindLibrary(){
  document.querySelectorAll('[data-annotation-filter]').forEach(b=>b.onclick=()=>{libraryFilter=b.dataset.annotationFilter;renderApp()});
  document.querySelectorAll('.readerAnnotationsLibrary [data-annotation-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.annotationGo));
  document.querySelectorAll('.readerAnnotationsLibrary [data-annotation-delete]').forEach(b=>b.onclick=()=>void remove(b.dataset.annotationDelete));
  document.querySelectorAll('.readerAnnotationsLibrary [data-annotation-edit]').forEach(b=>b.onclick=()=>{const x=entries.find(a=>a.id===b.dataset.annotationEdit);if(x){navigate(x.id);pendingEdit=x.id}});
 }
 let pendingEdit=null;
 function maybeOpenPendingEdit(){
  if(!pendingEdit)return;
  const x=entries.find(e=>e.id===pendingEdit);
  if(x&&root&&flow.paper(x.section_id)){pendingEdit=null;openEditor(x,x.kind)}
 }
 const previousBind=bindReader;
 return {load,reset,all,readerUi,libraryUi,bindLibrary,bindReader(){previousBind();requestAnimationFrame(maybeOpenPendingEdit)},refresh:refreshReader,track,navigate};
}
