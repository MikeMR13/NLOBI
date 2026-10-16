/* OX-MR Fase 5: herramientas optativas del lector, cargadas solo en rutas de lectura.
   Anotaciones privadas en la tabla existente; nada se publica ni se añade al catálogo. */
window.createReaderToolsPhase5=function createReaderToolsPhase5({S,jreq,esc,toast,cacheReaderChapter,go}){
 if(!document.getElementById('reader-phase5-styles')){const link=document.createElement('link');link.id='reader-phase5-styles';link.rel='stylesheet';link.href='/assets/reader-tools-phase5.css';document.head.append(link)}
 const state={scope:'',rows:[],loaded:false,loading:false,error:'',open:false,draft:'',quote:''};
 const host=()=>document.getElementById('readerPhase5Tools');
 const current=()=>S.view.startsWith('reader:')?S.readerSection:null;
 const scope=()=>String(S.user?.id||'guest')+':'+String(current()?.id||'');
 const formatDate=value=>{try{return new Date(value).toLocaleDateString('es-MX',{dateStyle:'medium'})}catch{return''}};
 function selectedText(){
  const sel=window.getSelection(),r=current(),paper=document.querySelector('.readerPaper');
  if(!r||!sel||!sel.rangeCount||sel.isCollapsed||!paper)return '';
  const range=sel.getRangeAt(0);
  if(!paper.contains(range.commonAncestorContainer))return '';
  const chapter=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer.closest?.('[data-reader-chapter-id]'):range.commonAncestorContainer.parentElement?.closest?.('[data-reader-chapter-id]');
  if(chapter&&chapter.dataset.readerChapterId!==r.id)return '';
  return String(sel.toString()).trim().slice(0,1200);
 }
 function markup(){
  const r=current();if(!r)return'';
  const signedIn=!!S.user?.id;
  const rows=state.rows.map(a=>'<article class="readerP5Entry"><div class="readerP5EntryMeta"><strong>'+esc(a.kind==='highlight'?'Fragmento':'Nota privada')+'</strong><small>'+esc(formatDate(a.created_at))+'</small></div>'+(a.excerpt?'<blockquote>'+esc(a.excerpt)+'</blockquote>':'')+(a.note?'<p>'+esc(a.note)+'</p>':'')+'<button type="button" class="btn" data-reader-p5-delete="'+esc(a.id)+'" aria-label="Eliminar esta anotación">Eliminar</button></article>').join('');
  return '<details class="readerPhase5Tools" id="readerPhase5Details" '+(state.open?'open':'')+'><summary>Mi lectura · Offline y anotaciones</summary><div class="readerP5Body"><p class="muted">Guarda este capítulo en el dispositivo. Tus notas son privadas y se sincronizan con tu cuenta.</p><div class="readerP5Actions"><button class="btn" type="button" data-reader-p5-offline>Guardar este capítulo sin conexión</button><button class="btn" type="button" data-reader-p5-downloads>Descargas del equipo</button></div>'+
   (signedIn?'<section aria-label="Mis anotaciones"><h3>Mis notas de este capítulo</h3><label for="readerP5Note">Nota personal</label><textarea id="readerP5Note" maxlength="4000" rows="3" placeholder="¿Qué quieres recordar?">'+esc(state.draft)+'</textarea><label for="readerP5Quote">Fragmento seleccionado (opcional)</label><textarea id="readerP5Quote" maxlength="1200" rows="2" placeholder="Selecciona texto en el capítulo y pulsa Capturar">'+esc(state.quote)+'</textarea><div class="readerP5Actions"><button type="button" class="btn" data-reader-p5-capture>Capturar selección</button><button type="button" class="btn primary" data-reader-p5-save>Guardar anotación</button><button type="button" class="btn" data-reader-p5-export '+(!state.rows.length?'disabled':'')+'>Exportar mis notas (.txt)</button></div><p class="muted">Las notas solo son visibles para ti. No se incluyen en descargas públicas ni en comentarios.</p><div role="status" aria-live="polite">'+(state.loading?'Cargando anotaciones…':state.error?esc(state.error):state.rows.length+' anotación(es) guardada(s)')+'</div><div class="readerP5List">'+(rows||'<p class="muted">Todavía no tienes notas en este capítulo.</p>')+'</div></section>':'<p class="muted">Inicia sesión para conservar notas privadas en tu cuenta.</p>')+'</div></details>';
 }
 function paint(){
  const h=host();if(!h)return;
  const details=h.querySelector('details');
  if(details){state.open=details.open;state.draft=h.querySelector('#readerP5Note')?.value||state.draft;state.quote=h.querySelector('#readerP5Quote')?.value||state.quote}
  h.innerHTML=markup();
  const d=h.querySelector('details');if(d)d.addEventListener('toggle',()=>{state.open=d.open});
  h.querySelector('[data-reader-p5-offline]')?.addEventListener('click',()=>{
   const r=current();if(!r)return;
   try{if(cacheReaderChapter(r))toast('Capítulo guardado. Disponible en Biblioteca → Sin conexión.','ok');else toast('No se pudo guardar: comprueba el almacenamiento disponible.','bad')}
   catch{toast('No se pudo guardar el capítulo. Comprueba el espacio disponible.','bad')}
  });
  h.querySelector('[data-reader-p5-downloads]')?.addEventListener('click',()=>{
   const r=current();if(r)go('detail:'+r.translation_id);
  });
  h.querySelector('[data-reader-p5-capture]')?.addEventListener('click',()=>{
   const quote=selectedText();if(!quote){toast('Selecciona un fragmento de este capítulo antes de capturarlo.','bad');return}
   const field=h.querySelector('#readerP5Quote');if(field)field.value=quote;state.quote=quote;
  });
  h.querySelector('[data-reader-p5-save]')?.addEventListener('click',save);
  h.querySelector('[data-reader-p5-export]')?.addEventListener('click',exportMine);
  h.querySelectorAll('[data-reader-p5-delete]').forEach(b=>b.addEventListener('click',()=>remove(b.dataset.readerP5Delete)));
 }
 async function load(){
  const key=scope();if(!S.user?.id||!navigator.onLine)return;
  state.loading=true;state.error='';paint();
  try{
   const rows=await jreq('/rest/v1/reader_annotations?user_id=eq.'+encodeURIComponent(S.user.id)+'&section_id=eq.'+encodeURIComponent(current().id)+'&select=id,section_id,kind,excerpt,note,color,created_at&order=created_at.desc&limit=100');
   if(scope()!==key)return;state.rows=Array.isArray(rows)?rows:[];state.loaded=true;
  }catch(e){if(scope()===key)state.error='No se pudieron consultar tus notas. Puedes intentar al recuperar la conexión.'}
  finally{if(scope()===key){state.loading=false;paint()}}
 }
 async function save(){
  const r=current(),uid=S.user?.id,oldScope=scope(),h=host();
  if(!uid||!r||!navigator.onLine){toast('Conéctate e inicia sesión para guardar notas privadas.','bad');return}
  const note=(h?.querySelector('#readerP5Note')?.value||'').trim().slice(0,4000);
  const excerpt=(h?.querySelector('#readerP5Quote')?.value||'').trim().slice(0,1200);
  state.draft=note;state.quote=excerpt;
  if(!note&&!excerpt){toast('Escribe una nota o captura un fragmento.','bad');return}
  const btn=h?.querySelector('[data-reader-p5-save]');if(btn)btn.disabled=true;
  try{
   await jreq('/rest/v1/reader_annotations',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({
    user_id:uid,translation_id:r.translation_id,section_id:r.id,kind:note?'note':'highlight',anchor_mode:'block',
    start_block:0,start_offset:0,excerpt,note,color:'amber'
   })});
   if(oldScope!==scope())return;state.draft='';state.quote='';await load();toast('Anotación guardada de forma privada.','ok');
  }catch(e){toast('No se pudo guardar la nota. Verifica tu conexión y vuelve a intentar.','bad');if(btn?.isConnected)btn.disabled=false}
 }
 async function remove(id){
  if(!S.user?.id||!navigator.onLine||!state.rows.some(x=>x.id===id))return;
  if(!window.confirm('¿Eliminar esta anotación privada?'))return;
  const oldScope=scope();
  try{await jreq('/rest/v1/reader_annotations?id=eq.'+encodeURIComponent(id)+'&user_id=eq.'+encodeURIComponent(S.user.id),{method:'DELETE',headers:{Prefer:'return=minimal'}});
    if(oldScope!==scope())return;state.rows=state.rows.filter(x=>x.id!==id);paint();toast('Anotación eliminada.','ok')
  }catch(e){toast('No se pudo eliminar la anotación.','bad')}
 }
 function exportMine(){
  if(!S.user?.id||!state.rows.length)return;
  const r=current(),lines=['EL OBI DEL LECTOR — MIS ANOTACIONES',r?.novel_title||'',r?.title||'','Exportación privada · '+new Date().toLocaleDateString('es-MX'),''];
  for(const a of state.rows){lines.push('['+formatDate(a.created_at)+'] '+(a.kind==='highlight'?'Fragmento':'Nota'));if(a.excerpt)lines.push('«'+a.excerpt+'»');if(a.note)lines.push(a.note);lines.push('')}
  const file=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}),url=globalThis.URL.createObjectURL(file),link=document.createElement('a');
  link.href=url;link.download='mis-notas-'+String(r?.id||'capitulo').replace(/[^a-z0-9-]/gi,'')+'.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>globalThis.URL.revokeObjectURL(url),1000);
 }
 function mount(){
  const key=scope();
  if(key!==state.scope){state.scope=key;state.rows=[];state.draft='';state.quote='';state.loaded=false;state.loading=false;state.error='';state.open=false}
  if(!host())return;
  paint();
  if(S.user?.id&&navigator.onLine&&!state.loaded&&!state.loading)void load();
 }
 return {mount};
};