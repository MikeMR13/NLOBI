window.createGlossaryPhase1=function createGlossaryPhase1(ctx){
 const {S,jreq,esc,toast,teamCan}=ctx,endpoint='/rest/v1/translation_glossary_terms',cache=new Map();
 const types=['Término','Personaje','Lugar','Organización','Habilidad','Objeto','Otro'];
 const reEscape=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const termRegex=terms=>terms.length?new RegExp('(?<![\\p{L}\\p{N}])('+terms.map(t=>t.term).sort((a,b)=>b.length-a.length).map(reEscape).join('|')+')(?![\\p{L}\\p{N}])','giu'):null;
 function load(id,refresh=false){
  if(!refresh&&cache.has(id))return cache.get(id);
  const p=jreq(endpoint+'?translation_id=eq.'+encodeURIComponent(id)+'&select=id,term,category,definition&order=term.asc&limit=500').then(r=>Array.isArray(r)?r:[]).catch(e=>{cache.delete(id);throw e});
  cache.set(id,p);return p;
 }
 function check(project,terms){
  const issues=[],r=termRegex(terms),map=new Map(terms.map(t=>[t.term.toLocaleLowerCase('es'),t.term]));
  if(!r||!project)return issues;
  for(const v of project.volumes||[])for(const s of v.sections||[]){
   const content=(s.content||[]).filter(b=>['paragraph','heading','quote','ruby','translator_note'].includes(b?.type)).map(b=>String(b.text||b.base||'')).join(' ');
   for(const m of content.matchAll(r)){
    const target=map.get(m[1].toLocaleLowerCase('es'));
    if(!target||target===m[1])continue;
    const key=s.id+'|'+target+'|'+m[1],existing=issues.find(x=>x.key===key);
    if(existing)existing.count++;else issues.push({key,expected:target,actual:m[1],volume:v.volume_number,chapter:s.title,count:1});
    if(issues.length>200)break;
   }
  }
  return issues;
 }
 function panel(p){
  if(!p?.id)return '';
  const can=teamCan(p.group_id,'edit');
  const fields=can?'<form data-glossary-form><div class="nlobiGlossaryFields"><label>Término<input name="term" required minlength="2" maxlength="80"></label><label>Categoría<select name="category">'+types.map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></label><label>Definición<textarea name="definition" required rows="2" maxlength="800"></textarea></label></div><div class="row"><button type="submit" class="btn primary" data-glossary-save>Guardar término</button><button type="button" class="btn" data-glossary-cancel hidden>Cancelar</button></div></form>':'';
  return '<details class="nlobiGlossaryPanel" id="studioProjectGlossary" data-translation-id="'+esc(p.id)+'" data-editable="'+(can?'1':'0')+'"><summary><span><strong>語 · Glosario y terminología</strong><small>Definiciones para lectores y consistencia editorial</small></span><span class="badge">Por obra</span></summary>'
   +'<div class="nlobiGlossaryBody"><p class="muted">Los avisos no alteran automáticamente el texto ni su formato.</p><p data-glossary-status role="status" aria-live="polite">Abre para consultar los términos.</p><div data-glossary-loaded hidden>'
   +fields+'<div class="nlobiGlossaryTools"><label>Buscar término<input type="search" data-glossary-search placeholder="Buscar término o definición"></label><span data-glossary-count></span></div><div data-glossary-list class="nlobiGlossaryItems"></div>'
   +'<section class="nlobiGlossaryAudit"><h4>Verificación editorial</h4><p class="muted">Revisa variantes de mayúsculas en bloques de texto; no sustituye palabras ni altera HTML incrustado.</p><div data-glossary-audit></div></section></div></div></details>';
 }
 function bind(){
  const root=document.getElementById('studioProjectGlossary');if(!root||root.dataset.bound)return;root.dataset.bound='1';
  const id=root.dataset.translationId,can=root.dataset.editable==='1';
  const status=root.querySelector('[data-glossary-status]'),area=root.querySelector('[data-glossary-loaded]');
  const list=root.querySelector('[data-glossary-list]'),audit=root.querySelector('[data-glossary-audit]'),count=root.querySelector('[data-glossary-count]');
  const input=root.querySelector('[data-glossary-search]'),form=root.querySelector('[data-glossary-form]');
  let items=[],editing='',ready=false,busy=false;
  function reset(){editing='';form?.reset();if(form){form.querySelector('[data-glossary-save]').textContent='Guardar término';form.querySelector('[data-glossary-cancel]').hidden=true;}}
  function draw(){
   const q=(input.value||'').trim().toLocaleLowerCase('es'),shown=items.filter(t=>(t.term+' '+t.category+' '+t.definition).toLocaleLowerCase('es').includes(q));
   list.innerHTML=shown.length?shown.map(t=>'<article class="nlobiGlossaryItem"><div><strong>'+esc(t.term)+'</strong><small>'+esc(t.category)+'</small><p>'+esc(t.definition)+'</p></div>'
    +(can?'<div class="row"><button class="btn" type="button" data-term-edit="'+esc(t.id)+'">Editar</button><button class="btn" type="button" data-term-delete="'+esc(t.id)+'">Eliminar</button></div>':'')+'</article>').join(''):'<p class="muted">Aún no hay términos que mostrar.</p>';
   count.textContent=shown.length+' de '+items.length+' términos';
   const issues=check(S.studioProject?.id===id?S.studioProject:null,items);
   const n=issues.reduce((a,x)=>a+x.count,0);status.textContent=items.length+' términos · '+n+' observaciones';
   audit.innerHTML=issues.length?'<strong>'+n+' variante(s) de mayúsculas para revisar:</strong>'+issues.slice(0,30).map(x=>'<p class="nlobiGlossaryIssue">'+esc(x.chapter)+' (Vol. '+esc(x.volume)+'): «'+esc(x.actual)+'» → <strong>'+esc(x.expected)+'</strong> ('+x.count+')</p>').join(''):'<p class="muted">No se encontraron variantes de mayúsculas en los capítulos cargados.</p>';
  }
  async function begin(){
   if(ready||busy)return;busy=true;status.textContent='Consultando glosario…';
   try{items=await load(id);ready=true;area.hidden=false;draw();}
   catch(e){status.textContent='No se pudo cargar. Revisa permisos o la migración del glosario.';}finally{busy=false;}
  }
  root.addEventListener('toggle',()=>{if(root.open)begin()});if(root.open)begin();
  input.addEventListener('input',draw);
  form?.querySelector('[data-glossary-cancel]')?.addEventListener('click',reset);
  form?.addEventListener('submit',async e=>{
   e.preventDefault();if(!can)return;
   const term=form.elements.term.value.trim(),definition=form.elements.definition.value.trim(),category=form.elements.category.value.trim();
   if(term.length<2||term.length>80||!definition||definition.length>800)return toast('Término o definición inválidos.','bad');
   if(items.some(t=>t.id!==editing&&t.term.toLocaleLowerCase('es')===term.toLocaleLowerCase('es')))return toast('Término duplicado.','bad');
   const button=form.querySelector('[data-glossary-save]');button.disabled=true;
   try{
    const body={term,category,definition};
    const saved=editing?await jreq(endpoint+'?id=eq.'+encodeURIComponent(editing),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(body)}):
     await jreq(endpoint,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({...body,translation_id:id})});
    if(!saved?.[0])throw Error('No se confirmó el guardado.');
    items=editing?items.map(t=>t.id===editing?saved[0]:t):[...items,saved[0]];
    items.sort((a,b)=>a.term.localeCompare(b.term,'es'));cache.set(id,Promise.resolve(items));reset();draw();toast('Glosario actualizado.','ok');
   }catch(e){toast(e.message||'No se pudo guardar.','bad');}finally{button.disabled=false;}
  });
  list.addEventListener('click',async e=>{
   if(!can)return;
   const edit=e.target.closest('[data-term-edit]'),del=e.target.closest('[data-term-delete]');
   if(edit){const t=items.find(x=>x.id===edit.dataset.termEdit);if(!t)return;
    editing=t.id;form.elements.term.value=t.term;form.elements.category.value=types.includes(t.category)?t.category:'Otro';form.elements.definition.value=t.definition;
    form.querySelector('[data-glossary-save]').textContent='Guardar cambios';form.querySelector('[data-glossary-cancel]').hidden=false;form.elements.term.focus();
   }
   if(del){const t=items.find(x=>x.id===del.dataset.termDelete);if(!t||!confirm('¿Eliminar «'+t.term+'»?'))return;del.disabled=true;
    try{await jreq(endpoint+'?id=eq.'+encodeURIComponent(t.id),{method:'DELETE',headers:{Prefer:'return=minimal'}});
     items=items.filter(x=>x.id!==t.id);cache.set(id,Promise.resolve(items));reset();draw();toast('Término eliminado.','ok');
    }catch(err){toast(err.message||'No se pudo eliminar.','bad');del.disabled=false;}
   }
  });
 }
 let activePaper=null,observer=null;
 function show(term,source){
  const d=document.createElement('dialog');d.className='nlobiGlossaryDialog';
  const head=document.createElement('small'),h=document.createElement('h2'),p=document.createElement('p'),b=document.createElement('button'),box=document.createElement('div');
  head.textContent='Glosario · '+term.category;h.textContent=term.term;p.textContent=term.definition;b.textContent='Cerrar';b.type='button';b.className='btn';
  box.append(head,h,p,b);d.append(box);document.body.append(d);
  b.addEventListener('click',()=>d.close());d.addEventListener('click',e=>{if(e.target===d)d.close()});
  d.addEventListener('close',()=>{d.remove();if(source.isConnected)source.focus({preventScroll:true})},{once:true});d.showModal();
 }
 function mark(paper,terms){
  const re=termRegex(terms);if(!re)return;
  const lookup=new Map(terms.map((t,i)=>[t.term.toLocaleLowerCase('es'),i]));
  const targets=paper.querySelector('#readerContinuousChapters')?[...paper.querySelectorAll('.readerContinuousChapter')]:[paper];
  const nodes=[];
  for(const target of targets){
   const walk=document.createTreeWalker(target,NodeFilter.SHOW_TEXT,{acceptNode(n){
    if(!n.nodeValue?.trim()||!n.parentElement||n.parentElement.closest('button,a,ruby,rt,script,style,code,textarea,.translatorNote,.nlobiGlossaryTerm'))return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
   }});while(walk.nextNode())nodes.push(walk.currentNode);
  }
  for(const node of nodes){
   const original=node.nodeValue;re.lastIndex=0;const matches=[...original.matchAll(re)];if(!matches.length)continue;
   let cursor=0;const frag=document.createDocumentFragment();
   for(const match of matches){
    const index=lookup.get(match[1].toLocaleLowerCase('es'));if(index===undefined)continue;
    if(match.index>cursor)frag.append(document.createTextNode(original.slice(cursor,match.index)));
    const b=document.createElement('button');b.type='button';b.className='nlobiGlossaryTerm';b.dataset.glossaryIndex=String(index);b.textContent=match[1];
    b.setAttribute('aria-label','Glosario: '+terms[index].term);frag.append(b);cursor=match.index+match[0].length;
   }
   if(cursor){if(cursor<original.length)frag.append(document.createTextNode(original.slice(cursor)));node.replaceWith(frag);}
  }
 }
 async function decorateReader(reader){
  const paper=document.querySelector('.readerExperience .readerPaper');
  if(!reader?.translation_id||!paper||activePaper===paper)return;
  observer?.disconnect();observer=null;activePaper=paper;
  if(!navigator.onLine)return;
  let items;try{items=await load(reader.translation_id)}catch{return;}
  if(!paper.isConnected||paper!==activePaper||!items.length)return;
  paper.addEventListener('click',e=>{const b=e.target.closest('.nlobiGlossaryTerm');if(!b)return;const t=items[Number(b.dataset.glossaryIndex)];if(t)show(t,b);});
  const apply=()=>{observer?.disconnect();mark(paper,items);observer?.observe(paper,{childList:true,subtree:true})};
  observer=new MutationObserver(changes=>{if(changes.some(c=>[...c.addedNodes].some(n=>n.nodeType===1&&!n.classList?.contains('nlobiGlossaryTerm'))))apply()});
  apply();
 }
 return {panel,bind,decorateReader,check};
};
