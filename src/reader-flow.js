// Continuous reader: progressive chapter loading, stable paragraph anchors and account sync.
// Uses the existing reading_progress.anchor field; no privileged backend access is required.
export function createReaderFlow(deps){
 const {state,renderBlock,escapeText,request,readCache,writeCache,queueProgress,markRead,readIds}=deps;
 const chapters=new Map(),maxSeen=new Map();
 let loading=false,token=0,lastLocal=0,lastCloud=0,saving=false,pending=null,failedNext=null;
 const S=()=>state();
 const active=()=>S().readerFlowActive||S().readerSection;
 const enabled=()=>S().readerPrefs?.flow==='continuous';
 const paper=id=>[...document.querySelectorAll('.readerExperience .readerPaper[data-section-id]')].find(el=>el.dataset.sectionId===id)||null;
 const blockHtml=blocks=>(blocks||[]).map((block,i)=>'<div class="readerAnchorBlock" data-block-index="'+i+'">'+renderBlock(block)+'</div>').join('');
 function parse(anchor){
  const match=/^p:(\d+):(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(anchor||''));
  if(!match)return null;
  const block=Number(match[1]),offset=Number(match[2]),percent=Number(match[3]);
  return Number.isSafeInteger(block)&&block>=0&&block<100000&&Number.isFinite(offset)&&offset>=0&&offset<=1&&Number.isFinite(percent)&&percent>=0&&percent<=100?{block,offset,percent}:null;
 }
 function position(id=active()?.id){
  const root=paper(id);if(!root)return null;
  const aim=window.innerHeight*.35;
  const blocks=[...root.querySelectorAll('[data-block-index]')];
  const current=blocks.find(x=>x.getBoundingClientRect().bottom>aim)||blocks.at(-1);
  const rect=current?.getBoundingClientRect(),bounds=root.getBoundingClientRect();
  return {block:current?Number(current.dataset.blockIndex):0,offset:rect?Math.round(Math.max(0,Math.min(1,(aim-rect.top)/Math.max(1,rect.height)))*1000)/1000:0,percent:Math.round(Math.max(0,Math.min(1,(aim-bounds.top)/Math.max(1,bounds.height)))*1000)/10,updatedAt:Date.now()};
 }
 function best(id){
  let local=null;
  try{const raw=JSON.parse(localStorage.getItem('nlobi_reader_position_'+id)||'null');if(raw&&Number.isFinite(raw.percent))local={block:Number.isInteger(raw.block)?raw.block:null,offset:Number(raw.offset)||0,percent:raw.percent,updatedAt:Number(raw.updatedAt)||0}}catch{}
  const chapter=S().readerSection;
  const remote=S().user?(S().readingProgress||[]).find(x=>x.translation_id===chapter?.translation_id&&x.section_id===id):null;
  const saved=parse(remote?.anchor),timestamp=Date.parse(remote?.updated_at||'')||0;
  return saved&&(!local||timestamp>local.updatedAt)?{...saved,updatedAt:timestamp}:local;
 }
 function restore(pos,id=active()?.id){
  const root=paper(id);if(!root||!pos)return;
  const target=Number.isInteger(pos.block)?root.querySelector('[data-block-index="'+pos.block+'"]'):null;
  if(target){
   const box=target.getBoundingClientRect();
   window.scrollTo({top:Math.max(0,window.scrollY+box.top+box.height*(pos.offset||0)-window.innerHeight*.35),behavior:'instant'});
  }else{
   const box=root.getBoundingClientRect();
   window.scrollTo({top:Math.max(0,window.scrollY+box.top+box.height*Math.max(0,Math.min(100,pos.percent))/100-window.innerHeight*.35),behavior:'instant'});
  }
 }
 function writeLocal(id,pos){
  if(!pos)return;
  try{localStorage.setItem('nlobi_reader_position_'+id,JSON.stringify(pos))}catch{}
 }
 async function save(force=false){
  const r=active(),pos=position(r?.id);if(!r||!pos)return;
  writeLocal(r.id,pos);
  if(!S().user?.id||(!force&&(Date.now()-lastCloud<8000||pos.percent<1)))return;
  lastCloud=Date.now();
  const nav=r.navigation||[],idx=nav.findIndex(x=>x.id===r.id);
  const old=(S().readingProgress||[]).find(x=>x.translation_id===r.translation_id);
  const whole=idx>=0?Math.round(1000*(idx+pos.percent/100)/Math.max(1,nav.length))/10:0;
  const progress={user_id:S().user.id,translation_id:r.translation_id,volume_id:r.volume_id,section_id:r.id,progress_percent:Math.max(whole,Number(old?.progress_percent||0)),anchor:'p:'+pos.block+':'+pos.offset+':'+pos.percent,updated_at:new Date(pos.updatedAt).toISOString()};
  const lib=(S().library||[]).find(x=>x.translation_id===r.translation_id);
  const library={user_id:S().user.id,translation_id:r.translation_id,status:['completed','paused','dropped'].includes(lib?.status)?lib.status:'reading',is_favorite:!!lib?.is_favorite};
  if(saving){pending={progress,library};return}
  saving=true;
  try{
   let item={progress,library};
   while(item){
    if(!navigator.onLine)queueProgress({user_id:item.progress.user_id,translation_id:item.progress.translation_id,...item});
    else try{
     await request('/rest/v1/reading_progress?on_conflict=user_id,translation_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(item.progress)});
     if(!lib)await request('/rest/v1/library_entries?on_conflict=user_id,translation_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(item.library)});
     const stored=(S().readingProgress||[]).find(x=>x.translation_id===item.progress.translation_id);
     if(stored){if(Date.parse(stored.updated_at||'')<=Date.parse(item.progress.updated_at))Object.assign(stored,item.progress)}
     else (S().readingProgress||[]).push(item.progress);
    }catch(e){queueProgress({user_id:item.progress.user_id,translation_id:item.progress.translation_id,...item});console.warn('[NLOBI] Sincronización de posición pendiente',e)}
    item=pending;pending=null;
   }
  }finally{saving=false}
 }
 function clear(){
  token++;chapters.clear();maxSeen.clear();loading=false;failedNext=null;S().readerFlowActive=null;
 }
 function beforeRender(){
  const r=active(),pos=position(r?.id);
  if(r&&pos){writeLocal(r.id,pos);S().readerSection=r}
  clear();
  return pos;
 }
 function begin(){
  chapters.clear();maxSeen.clear();failedNext=null;S().readerFlowActive=null;
  if(S().readerSection)chapters.set(S().readerSection.id,S().readerSection);
 }
 function detect(){
  if(!enabled())return;
  const roots=[...document.querySelectorAll('#readerChapterStream .readerPaper')];
  const aim=window.innerHeight*.35;
  const shown=roots.find(x=>x.getBoundingClientRect().bottom>aim)||roots.at(-1);
  const next=shown&&chapters.get(shown.dataset.sectionId),previous=active();
  if(!next||next.id===previous?.id)return;
  if(previous&&(maxSeen.get(previous.id)||0)>=85&&!readIds().has(previous.id))void markRead(previous.id);
  S().readerFlowActive=next;lastCloud=0;
  history.replaceState(null,'','#reader:'+encodeURIComponent(next.id));
  const idx=next.navigation.findIndex(x=>x.id===next.id);
  const counter=document.getElementById('readerChapterIndex');
  const selection=document.getElementById('readerChapterJump');
  if(counter&&idx>=0)counter.textContent='CAPÍTULO '+(idx+1)+' DE '+next.navigation.length;
  if(selection)selection.value=next.id;
 }
 function markup(chapter,original){
  const el=document.createElement('article');
  el.className=original.className;el.style.cssText=original.style.cssText;el.dataset.sectionId=chapter.id;
  el.setAttribute('aria-label','Capítulo: '+(chapter.title||'Capítulo'));
  el.innerHTML='<div class="readerMeta">'+escapeText(chapter.novel_title||'El Obi del Lector')+' · Vol. '+escapeText(chapter.volume_number??'—')+'</div><h2 class="readerStreamHeading">'+escapeText(chapter.title||'Capítulo')+'</h2><div class="readerChapterDivider" aria-hidden="true"></div>'+blockHtml(chapter.content||[]);
  return el;
 }
 async function loadMore(){
  if(!enabled()||loading||!S().view.startsWith('reader:'))return;
  const stream=document.getElementById('readerChapterStream'),roots=stream?[...stream.querySelectorAll('.readerPaper')]:[];
  if(!stream||!roots.length)return;
  const last=roots.at(-1),chapter=chapters.get(last.dataset.sectionId),nav=chapter?.navigation||[];
  const idx=nav.findIndex(x=>x.id===chapter?.id),next=idx>=0?nav[idx+1]:null;
  if(!next||failedNext===next.id||last.getBoundingClientRect().bottom>window.innerHeight*2)return;
  const currentToken=token;loading=true;
  const msg=document.getElementById('readerStreamStatus');
  if(msg)msg.textContent='Cargando el siguiente capítulo…';
  try{
   let incoming=readCache(next.id);
   if(!incoming&&navigator.onLine){
    const rows=await request('/rest/v1/sections?id=eq.'+encodeURIComponent(next.id)+'&status=eq.published&select=id,volume_id,title,section_type,section_number,content&limit=1');
    if(!rows?.[0]||rows[0].volume_id!==next.volume_id)throw Error('Capítulo no disponible');
    incoming={...rows[0],translation_id:chapter.translation_id,novel_title:chapter.novel_title,volume_number:next.volume_number,navigation:nav,epub_fonts:chapter.epub_fonts};
    writeCache(incoming);
   }
   if(!incoming||incoming.volume_id!==next.volume_id||currentToken!==token||!stream.isConnected)return;
   incoming={...incoming,translation_id:chapter.translation_id,novel_title:chapter.novel_title,volume_number:next.volume_number,navigation:nav};
   stream.append(markup(incoming,roots[0]));chapters.set(incoming.id,incoming);
   paper(incoming.id)?.querySelectorAll('img[data-original-src]').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;const note=img.closest('figure')?.querySelector('.readerImageFallback');if(note)note.hidden=false}));
   if(stream.children.length>5&&roots[0].getBoundingClientRect().bottom<0){
    const old=roots[0],gap=parseFloat(getComputedStyle(stream).rowGap)||0,height=old.getBoundingClientRect().height+gap;
    chapters.delete(old.dataset.sectionId);old.remove();
    window.scrollTo({top:Math.max(0,window.scrollY-height),behavior:'instant'});
   }
  }catch(e){failedNext=next.id;if(msg)msg.textContent='No se pudo cargar el siguiente capítulo. Abre el capítulo desde el índice.';console.warn(e)}
  finally{loading=false;if(msg&&msg.textContent==='Cargando el siguiente capítulo…')msg.textContent=''}
 }
 function scroll(){
  const r=active(),pos=position(r?.id);if(!r||!pos)return;
  const bar=document.getElementById('readerProgressFill'),label=document.getElementById('readerProgressLabel');
  if(bar)bar.style.width=pos.percent+'%';
  if(label)label.textContent=Math.round(pos.percent)+'% leído';
  const nav=r.navigation||[],idx=nav.findIndex(x=>x.id===r.id);
  const full=document.getElementById('readerBookProgressLabel');
  if(full&&idx>=0)full.textContent='Obra '+Math.round(100*(idx+pos.percent/100)/Math.max(1,nav.length))+'%';
  if(Date.now()-lastLocal>1400){lastLocal=Date.now();maxSeen.set(r.id,Math.max(pos.percent,maxSeen.get(r.id)||0));void save()}
  if(enabled()){detect();void loadMore()}
 }
 return {active,enabled,paper,blockHtml,best,restore,position,save,begin,clear,beforeRender,scroll,loadMore};
}
