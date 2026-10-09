// Reader phase 7: quiet floating navigation, image lightbox, and layout-stable resuming.
// Does not replace the existing progress store; it stabilizes the same paragraph anchor.
export function createReaderEnhancements({flow,state,readPosition,openChapter,savePosition,openSettings,seekTo}){
 let root=null,observer=null,layoutObserver=null,controller=null,restoreToken=0,lastScrollY=0,lastChapterId=null;
 let images=[],galleryIndex=0,zoom=1,returnFocus=null,touchStartX=null;
 const $=id=>root?.querySelector('#'+id);
 const active=()=>flow.active();
 const reader=()=>state().view.startsWith('reader:');
 function cancelRestore(){restoreToken++;layoutObserver?.disconnect();layoutObserver=null}
 function clear(){
  cancelRestore();
  observer?.disconnect();observer=null;
  controller?.abort();controller=null;
  const dlg=$('readerIllustrationDialog');
  if(dlg?.open)dlg.close();
  root=null;images=[];galleryIndex=0;lastChapterId=null;
 }
 function prepareImages(){
  const stream=$('readerChapterStream');
  if(!stream)return;
  stream.querySelectorAll('figure.readerIllustration img').forEach(img=>{
   if(img.closest('button.readerIllustrationOpen'))return;
   const button=document.createElement('button');
   button.type='button';
   button.className='readerIllustrationOpen';
   button.setAttribute('aria-label','Ampliar '+(img.alt||'ilustración del capítulo'));
   img.parentNode.insertBefore(button,img);
   button.append(img);
  });
 }
 function updateDock(){
  if(!root||!reader())return;
  const r=active();if(!r)return;
  const idx=(r.navigation||[]).findIndex(c=>c.id===r.id);
  const pos=flow.position(r.id);
  const percent=Math.max(0,Math.min(100,Math.round(pos?.percent||0)));
  const title=$('readerFloatTitle'),meta=$('readerFloatMeta'),percentage=$('readerFloatPercentage'),fill=$('readerFloatFill'),seek=$('readerFloatSeek');
  if(title)title.textContent=r.title||'Capítulo';
  if(meta)meta.textContent='Vol. '+(r.volume_number??'—')+' · Capítulo '+(idx<0?'—':idx+1)+' de '+(r.navigation?.length||1);
  if(percentage)percentage.textContent=percent+'%';
  if(fill)fill.style.width=percent+'%';
  if(seek&&document.activeElement!==seek){seek.value=String(percent);seek.setAttribute('aria-valuetext',percent+' por ciento del capítulo')}
  if(lastChapterId!==r.id){
   lastChapterId=r.id;
   const select=$('readerFloatChapterJump');if(select)select.value=r.id;
  }
  const floating=$('readerFloatDock');
  const y=Math.max(0,window.scrollY),delta=y-lastScrollY;lastScrollY=y;
  if(floating&&!floating.matches(':focus-within')&&!$('readerFloatIndex')?.open&&!$('readerSettings')?.open){
   if(delta>16&&y>280)floating.classList.add('readerFloatHidden');
   else if(delta< -10||y<200)floating.classList.remove('readerFloatHidden');
  }else floating?.classList.remove('readerFloatHidden');
 }
 function showDock(){
  $('readerFloatDock')?.classList.remove('readerFloatHidden');
 }
 function stableRestore(position,sectionId=active()?.id){
  if(!root||!reader()||!position||!sectionId)return;
  cancelRestore();
  const current=restoreToken;
  const article=flow.paper(sectionId);
  if(!article)return;
  const apply=()=>{
   if(current!==restoreToken||!root?.isConnected||active()?.id!==sectionId)return;
   flow.restore(position,sectionId);
   lastScrollY=window.scrollY;
   updateDock();
  };
  // An initial and a post-paint pass handle the first layout; subsequent
  // image/font changes retain the original block anchor unless user interacts.
  requestAnimationFrame(()=>{apply();requestAnimationFrame(apply)});
  Promise.resolve(document.fonts?.ready).then(()=>requestAnimationFrame(apply)).catch(()=>{});
  if(typeof ResizeObserver==='function'){
   layoutObserver=new ResizeObserver(()=>requestAnimationFrame(apply));
   layoutObserver.observe(article);
  }
  document.fonts?.addEventListener?.('loadingdone',()=>requestAnimationFrame(apply),{signal:controller.signal});
  article.querySelectorAll('img').forEach(img=>{
   if(!img.complete)img.addEventListener('load',()=>requestAnimationFrame(apply),{once:true,signal:controller.signal});
  });
 }
 function imageList(){
  return [...(root?.querySelectorAll('#readerChapterStream figure.readerIllustration img')||[])].filter(x=>!x.hidden&&x.getAttribute('src'));
 }
 function showImage(){
  const dialog=$('readerIllustrationDialog'),img=$('readerLightboxImage');
  if(!dialog||!img||!images.length)return;
  const source=images[galleryIndex],count=$('readerLightboxCount'),caption=$('readerLightboxCaption');
  if(!source)return;
  img.src=source.currentSrc||source.src;
  img.alt=source.alt||'Ilustración del capítulo';
  img.hidden=false;
  const fallback=$('readerLightboxError');if(fallback)fallback.hidden=true;
  if(count)count.textContent='Ilustración '+(galleryIndex+1)+' de '+images.length;
  if(caption)caption.textContent=source.closest('figure')?.querySelector('figcaption:not(.readerImageFallback)')?.textContent?.trim()||source.alt||'';
  const prev=$('readerLightboxPrev'),next=$('readerLightboxNext');
  if(prev)prev.disabled=galleryIndex===0;
  if(next)next.disabled=galleryIndex===images.length-1;
  setZoom(1);
 }
 function setZoom(value){
  zoom=Math.max(1,Math.min(3,Math.round(value*2)/2));
  const img=$('readerLightboxImage'),label=$('readerLightboxZoomLabel');
  if(img)img.style.width=(zoom*100)+'%';
  if(label)label.textContent=Math.round(zoom*100)+'%';
  const out=$('readerLightboxZoomOut'),more=$('readerLightboxZoomIn');
  if(out)out.disabled=zoom<=1;
  if(more)more.disabled=zoom>=3;
 }
 function openImage(source){
  images=imageList();
  galleryIndex=images.indexOf(source);
  if(galleryIndex<0)return;
  const dialog=$('readerIllustrationDialog');if(!dialog)return;
  returnFocus=source.closest('button')||source;
  showImage();
  if(!dialog.open)dialog.showModal();
  $('readerLightboxClose')?.focus();
  showDock();
 }
 function nextImage(direction){
  const next=galleryIndex+direction;
  if(next<0||next>=images.length)return;
  galleryIndex=next;showImage();
 }
 function bind(){
  clear();
  root=document.querySelector('.readerExperience');
  if(!root)return;
  controller=new AbortController();
  const signal=controller.signal;
  lastScrollY=window.scrollY;
  prepareImages();
  const stream=$('readerChapterStream');
  if(stream){
   observer=new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length)){prepareImages();updateDock()}});
   observer.observe(stream,{childList:true,subtree:true});
  }
  root.addEventListener('click',event=>{
   const target=event.target;
   const img=target.closest?.('button.readerIllustrationOpen')?.querySelector('img');
   if(img){openImage(img);return}
   if(target.closest?.('#readerFloatBookmark')){void savePosition();showDock();return}
   if(target.closest?.('#readerFloatSettings')){openSettings();showDock();return}
   if(target.closest?.('#readerFloatChapterJump'))return;
   if(target.closest?.('#readerLightboxClose')){$('readerIllustrationDialog')?.close();return}
   if(target.closest?.('#readerLightboxPrev')){nextImage(-1);return}
   if(target.closest?.('#readerLightboxNext')){nextImage(1);return}
   if(target.closest?.('#readerLightboxZoomOut')){setZoom(zoom-.5);return}
   if(target.closest?.('#readerLightboxZoomIn')){setZoom(zoom+.5);return}
   if(target.closest?.('#readerLightboxZoomReset')){setZoom(1);return}
   if(target.id==='readerIllustrationDialog'){$('readerIllustrationDialog')?.close();return}
  },{signal});
  const chapters=$('readerFloatChapterJump');
  if(chapters)chapters.addEventListener('change',()=>{
   const id=chapters.value;
   $('readerFloatIndex').open=false;
   if(id&&id!==active()?.id)openChapter(id);
  },{signal});
  const slider=$('readerFloatSeek');
  if(slider)slider.addEventListener('change',()=>{
   cancelRestore();seekTo(Number(slider.value),active()?.id);showDock();
   requestAnimationFrame(updateDock);
  },{signal});
  const dialog=$('readerIllustrationDialog');
  if(dialog){
   dialog.addEventListener('close',()=>{
    const opener=returnFocus;returnFocus=null;images=[];
    if(opener?.isConnected)opener.focus({preventScroll:true});
   },{signal});
   dialog.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'){event.preventDefault();nextImage(-1)}
    if(event.key==='ArrowRight'){event.preventDefault();nextImage(1)}
   },{signal});
   dialog.addEventListener('touchstart',e=>{touchStartX=e.touches[0]?.clientX??null},{passive:true,signal});
   dialog.addEventListener('touchend',e=>{
    if(touchStartX===null)return;
    const diff=(e.changedTouches[0]?.clientX??touchStartX)-touchStartX;touchStartX=null;
    if(Math.abs(diff)>90)nextImage(diff<0?1:-1);
   },{passive:true,signal});
   $('readerLightboxImage')?.addEventListener('error',()=>{
    const image=$('readerLightboxImage'),fallback=$('readerLightboxError');
    if(image)image.hidden=true;
    if(fallback)fallback.hidden=false;
   },{signal});
  }
  root.addEventListener('pointerdown',event=>{
   if(event.target.closest?.('.readerPaper')){
    cancelRestore();
    showDock();
   }
  },{signal});
  root.addEventListener('wheel',cancelRestore,{passive:true,signal});
  root.addEventListener('touchstart',cancelRestore,{passive:true,signal});
  root.addEventListener('keydown',event=>{
   if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)&&!event.target.closest?.('#readerIllustrationDialog'))cancelRestore();
  },{signal});
  const previous=readPosition(active()?.id);
  if(previous&&previous.percent>0)stableRestore(previous);
  requestAnimationFrame(updateDock);
 }
 return {bind,refresh:updateDock,restoreStable:stableRestore,cancelRestore,clear};
}
