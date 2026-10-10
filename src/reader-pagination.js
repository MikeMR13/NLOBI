// Chapter pagination for NLOBI. Native CSS multicolumns keep EPUB images/ruby/notes
// in the same article; only page movement is controlled here.
export function createReaderPagination({state,flow,onNext,updateProgress}){
 let root=null,paper=null,controller=null,touchStart=null,layoutObserver=null;
 const S=()=>state();
 const active=()=>S().readerPrefs?.flow==='paged'&&S().view.startsWith('reader:');
 const $=id=>root?.querySelector('#'+id);
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function stride(){
  if(!paper)return 1;
  const css=getComputedStyle(paper),gap=parseFloat(css.columnGap)||36;
  return Math.max(100,paper.clientWidth-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0)+gap);
 }
 function count(){return paper?Math.max(1,Math.round(Math.max(0,paper.scrollWidth-paper.clientWidth)/stride())+1):1}
 function index(){return paper?Math.min(count()-1,Math.max(0,Math.round(paper.scrollLeft/stride()))):0}
 function refresh(){
  if(!active()||!paper)return;
  const n=count(),i=index();
  const number=$('readerPageCount'),before=$('readerPagePrev'),next=$('readerPageNext'),label=$('readerPageStatus');
  if(number)number.textContent='Página '+(i+1)+' de '+n;
  if(label)label.textContent='Página '+(i+1)+' de '+n;
  if(before)before.disabled=i<=0;
  if(next)next.textContent=i>=n-1?'Siguiente capítulo →':'Página siguiente →';
  if(next)next.disabled=i>=n-1&&!nextChapter();
  root.dataset.readerPageCount=String(n);
 }
 function nextChapter(){
  const r=flow.active(),nav=r?.navigation||[],idx=nav.findIndex(x=>x.id===r.id);
  return idx>=0?nav[idx+1]:null;
 }
 function move(delta){
  if(!active()||!paper)return;
  const n=count(),i=index(),to=i+delta;
  if(to>=n){const next=nextChapter();if(next)onNext(next.id,flow.active()?.translation_id);return}
  if(to<0)return;
  paper.scrollTo({left:Math.max(0,Math.min(paper.scrollWidth-paper.clientWidth,to*stride())),behavior:reduced()?'instant':'smooth'});
  requestAnimationFrame(()=>{refresh();updateProgress()});
 }
 function position(){
  if(!active()||!paper)return null;
  const n=count(),i=index(),ratio=n>1?i/(n-1):0;
  const aim=paper.getBoundingClientRect().left+paper.clientWidth*.38;
  const visible=[...paper.querySelectorAll('.readerAnchorBlock')].find(x=>{const rect=x.getBoundingClientRect();return rect.right>aim&&rect.left<paper.getBoundingClientRect().right})||paper.querySelector('.readerAnchorBlock');
  return {block:Number(visible?.dataset.blockIndex)||0,offset:0,percent:Math.round(ratio*1000)/10,updatedAt:Date.now()};
 }
 function restore(pos){
  if(!active()||!paper||!pos)return false;
  const n=count(),percent=Math.max(0,Math.min(100,Number(pos.percent)||0));
  const target=n>1?Math.round(percent/100*(n-1)):0;
  paper.scrollLeft=Math.max(0,Math.min(paper.scrollWidth-paper.clientWidth,target*stride()));
  refresh();return true;
 }
 function unbind(){
  controller?.abort();controller=null;layoutObserver?.disconnect();layoutObserver=null;
  root=null;paper=null;touchStart=null;
 }
 function bind(){
  unbind();
  root=document.querySelector('.readerExperience');
  if(!root||!active())return;
  paper=root.querySelector('#readerChapterStream .readerPaper');
  if(!paper)return;
  controller=new AbortController();const signal=controller.signal;
  const contentWidth=Math.max(250,paper.clientWidth-(parseFloat(getComputedStyle(paper).paddingLeft)||0)-(parseFloat(getComputedStyle(paper).paddingRight)||0));
  paper.style.setProperty('--reader-page-width',contentWidth+'px');
  $('readerPagePrev')?.addEventListener('click',()=>move(-1),{signal});
  $('readerPageNext')?.addEventListener('click',()=>move(1),{signal});
  let frame=0;
  paper.addEventListener('scroll',()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;refresh();updateProgress()})},{passive:true,signal});
  paper.addEventListener('touchstart',event=>{
   if(S().readerPrefs.swipe==='off'||event.touches.length!==1)return;
   touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY,page:index()};
  },{passive:true,signal});
  paper.addEventListener('touchend',event=>{
   if(!touchStart||S().readerPrefs.swipe==='off')return;
   const x=event.changedTouches[0]?.clientX,y=event.changedTouches[0]?.clientY;
   const dx=x-touchStart.x,dy=y-touchStart.y,oldPage=touchStart.page;touchStart=null;
   if(Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy)*1.4||!document.getSelection()?.isCollapsed)return;
   const target=oldPage+(dx<0?1:-1),last=count()-1;
   if(target>last){const next=nextChapter();if(next)onNext(next.id,flow.active()?.translation_id);return}
   paper.scrollTo({left:Math.max(0,Math.min(paper.scrollWidth-paper.clientWidth,Math.max(0,target)*stride())),behavior:reduced()?'instant':'smooth'});
   requestAnimationFrame(()=>{refresh();updateProgress()});
  },{passive:true,signal});
  document.addEventListener('keydown',event=>{
   if(!active()||event.defaultPrevented||event.repeat||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey)return;
   if(document.querySelector('dialog[open]')||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target?.tagName)||event.target?.isContentEditable)return;
   if(event.key==='ArrowRight'||event.key==='PageDown'){event.preventDefault();move(1)}
   if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();move(-1)}
  },{signal});
  if(typeof ResizeObserver==='function'){
   layoutObserver=new ResizeObserver(()=>{
    if(!root?.isConnected||!paper)return;
    const p=position();paper.style.setProperty('--reader-page-width',Math.max(250,paper.clientWidth-(parseFloat(getComputedStyle(paper).paddingLeft)||0)-(parseFloat(getComputedStyle(paper).paddingRight)||0))+'px');
    if(p)restore(p);
   });
   // Observe viewport container, not scrollWidth changes induced by new columns.
   layoutObserver.observe(root.querySelector('.readerShell')||root);
  }
  paper.querySelectorAll('img').forEach(img=>{if(!img.complete)img.addEventListener('load',refresh,{signal,once:true})});
  Promise.resolve(document.fonts?.ready).then(()=>{if(root?.isConnected)refresh()}).catch(()=>{});
  requestAnimationFrame(refresh);
 }
 return {active,bind,unbind,refresh,position,restore,move};
}
