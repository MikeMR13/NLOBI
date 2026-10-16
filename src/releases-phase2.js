window.createReleasesPhase2=function createReleasePhase2(ctx){
 const {S,nav,status,esc,visibleCatalog,titleOf,safeMediaUrl,volumeReleaseDate,render}=ctx;
 const storageKey=()=>`nlobi:releases:v2:${S.user?.id||'guest'}`;
 let hydratedKey='';
 let preferences={compact:false,hideRead:false,onlyFollowing:false,grouping:'volume',mode:'list',muted:[]};
 const getJson=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
 function hydrate(){
  const k=storageKey();if(k===hydratedKey)return;
  hydratedKey=k;const item=getJson(k)||{};
  preferences={
   compact:!!item.compact,hideRead:!!item.hideRead,onlyFollowing:!!item.onlyFollowing,
   grouping:item.grouping==='chapter'?'chapter':'volume',
   mode:item.mode==='calendar'?'calendar':'list',
   muted:Array.isArray(item.muted)?item.muted.filter(v=>typeof v==='string').slice(0,250):[]
  };
  S.releaseShown=30;S.releaseMonthOffset=0;
 }
 function save(){try{localStorage.setItem(storageKey(),JSON.stringify(preferences))}catch{}}
 function dataset(){
  const translations=new Map(visibleCatalog().filter(t=>!t.demo).map(t=>[t.id,t]));
  const volumes=new Map((S.publishedVolumes||[]).filter(v=>v.status==='published').map(v=>[v.id,v]));
  const all=[
   ...(S.publishedVolumes||[]).filter(v=>v.status==='published'&&v.published_at).map(v=>({id:v.id,type:'volume',volume:v,date:v.published_at})),
   ...(S.publishedSections||[]).filter(c=>c.status==='published'&&c.published_at).map(c=>({id:c.id,type:'chapter',chapter:c,date:c.published_at,volume:volumes.get(c.volume_id)}))
  ];
  return all.map(item=>{
   const volume=item.volume;
   const translation=volume&&translations.get(volume.translation_id);
   const parsed=Date.parse(item.date);
   return translation&&Number.isFinite(parsed)&&parsed<=Date.now()?{...item,translation,stamp:parsed}:null;
  }).filter(Boolean).sort((a,b)=>b.stamp-a.stamp);
 }
 const groupId=e=>e.translation.translator_groups?.id||e.translation.translator_groups?.name||'';
 const following=id=>(S.follows||[]).some(f=>f.target_type==='translation'&&f.target_id===id);
 function readIds(){
  let ids=[];try{ids=JSON.parse(localStorage.getItem('nlobi_read_sections_'+(S.user?.id||'guest'))||'[]')}catch{}
  return new Set([...(Array.isArray(ids)?ids:[]),...(S.readSections||[])]);
 }
 function isRead(entry,ids){
  if(entry.type==='chapter')return ids.has(entry.chapter.id);
  const volumeId=entry.volume.id;
  const chapters=(S.publishedSections||[]).filter(x=>x.volume_id===volumeId&&x.status==='published');
  return chapters.length>0&&chapters.every(c=>ids.has(c.id));
 }
 function prepared(){
  hydrate();
  const type=S.releaseType||'all',team=S.releaseTeam||'all',q=(S.releaseQuery||'').trim().toLocaleLowerCase('es');
  const muted=new Set(preferences.muted),read=readIds();
  const base=dataset().filter(e=>
   (type==='all'||e.type===type)&&
   (team==='all'||groupId(e)===team)&&
   (!q||[titleOf(e.translation),e.volume.title,e.chapter?.title,e.translation.translator_groups?.name].join(' ').toLocaleLowerCase('es').includes(q))&&
   !muted.has(e.translation.id)&&
   (!preferences.onlyFollowing||!!S.user&&following(e.translation.id))&&
   (!preferences.hideRead||!!S.user&&!isRead(e,read))
  );
  if(preferences.grouping==='chapter')return base;
  const grouped=new Map();
  for(const event of base){
   const old=grouped.get(event.volume.id);
   if(!old)grouped.set(event.volume.id,{...event,events:1});
   else{
    old.events++;
    // Keep a real volume release record, when it exists, for accurate labeling.
    if(old.type!=='volume'&&event.type==='volume'){
     grouped.set(event.volume.id,{...event,events:old.events,stamp:Math.max(event.stamp,old.stamp),date:old.stamp>event.stamp?old.date:event.date});
    }
   }
  }
  return [...grouped.values()].sort((a,b)=>b.stamp-a.stamp);
 }
 function action(e){
  if(e.type==='chapter'&&preferences.grouping==='chapter')return `data-read-section="${esc(e.chapter.id)}" data-translation="${esc(e.translation.id)}"`;
  return `data-release-volume="${esc(e.volume.id)}" data-release-translation="${esc(e.translation.id)}"`;
 }
 function label(e){
  if(preferences.grouping==='volume'&&e.events>1)return 'VOLUMEN CON ACTUALIZACIONES';
  return e.type==='volume'?'NUEVO VOLUMEN':'NUEVO CAPÍTULO';
 }
 function eventCard(e){
  const t=e.translation,v=e.volume,cover=safeMediaUrl(v.cover_url||t.novels?.cover_url||'');
  const asVolume=preferences.grouping==='volume'||e.type==='volume';
  return `<article class="releasesItem releaseV2Item">
  <div class="releasesCover">${cover&&cover!=='#'?`<img src="${esc(cover)}" alt="Portada de ${esc(titleOf(t))}" loading="lazy" decoding="async">`:'<span aria-hidden="true">物語</span>'}</div>
  <div class="releasesBody"><span class="releasesKind">${esc(label(e))} · Vol. ${esc(v.volume_number)}</span>
   <h2>${esc(titleOf(t))}</h2><p>${esc(asVolume?v.title||'Volumen '+v.volume_number:e.chapter?.title||v.title||'Capítulo')}</p>
   <small>${esc(t.translator_groups?.name||'Equipo traductor')} · <time datetime="${esc(e.date)}">${esc(volumeReleaseDate(e.date))}</time>${e.events>1?` · ${e.events} publicaciones`:''}</small>
  </div>
  <div class="releaseV2Actions"><button type="button" class="btn" data-rel-mute="${esc(t.id)}" aria-label="Silenciar ${esc(titleOf(t))} en lanzamientos">Silenciar</button>
  <button type="button" class="btn primary" ${action(e)}>${asVolume?'Abrir volumen':'Leer capítulo'} →</button></div></article>`;
 }
 function calendar(entries){
  const offset=Math.max(-48,Math.min(12,Number(S.releaseMonthOffset)||0)),today=new Date();
  const current=new Date(today.getFullYear(),today.getMonth()+offset,1);
  const year=current.getFullYear(),month=current.getMonth();
  const first=(current.getDay()+6)%7,days=new Date(year,month+1,0).getDate();
  const byDate=new Map();
  for(const e of entries){
   const d=new Date(e.date);if(d.getFullYear()!==year||d.getMonth()!==month)continue;
   const day=d.getDate();if(!byDate.has(day))byDate.set(day,[]);
   byDate.get(day).push(e);
  }
  const columns=['L','M','M','J','V','S','D'].map((day,i)=>`<span class="releaseV2DayLabel" aria-label="${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][i]}">${day}</span>`).join('');
  const cells=Array.from({length:Math.ceil((days+first)/7)*7},(_,n)=>{
   const day=n-first+1;if(day<1||day>days)return '<span class="releaseV2EmptyDay" aria-hidden="true"></span>';
   const found=byDate.get(day)||[];
   return `<div class="releaseV2Day ${found.length?'hasReleases':''}" ${found.length?`aria-label="${day}: ${found.length} publicaciones"`:''}><strong>${day}</strong>${found.length?`<span>${found.length} ${found.length===1?'lanzamiento':'lanzamientos'}</span>`:''}</div>`;
  }).join('');
  const monthEntries=entries.filter(e=>{const d=new Date(e.date);return d.getFullYear()===year&&d.getMonth()===month;});
  return `<section class="releaseV2Calendar" aria-label="Calendario de lanzamientos publicados"><header class="releaseV2CalendarNav"><div><strong>${esc(current.toLocaleDateString('es-MX',{month:'long',year:'numeric'}))}</strong><small>Fechas reales de publicación, no anuncios futuros</small></div>
  <div class="row"><button type="button" class="btn" data-rel-month="-1" ${offset<=-48?'disabled':''} aria-label="Mes anterior">←</button><button type="button" class="btn" data-rel-month="0">Hoy</button><button type="button" class="btn" data-rel-month="1" ${offset>=12?'disabled':''} aria-label="Mes siguiente">→</button></div></header>
  <div class="releaseV2MonthGrid">${columns}${cells}</div>
  <h2 class="releaseV2MonthTitle">Publicaciones de este mes (${monthEntries.length})</h2>
  <div class="releasesList">${monthEntries.length?monthEntries.map(eventCard).join(''):'<p class="muted">No hay publicaciones para los filtros y el mes seleccionados.</p>'}</div>
  <p class="muted">Las fechas futuras programadas por un equipo son privadas en Studio hasta que se publiquen. Este calendario nunca revela borradores.</p></section>`;
 }
 function view(){
  hydrate();const source=dataset(),entries=prepared(),pageSize=Math.max(30,Number(S.releaseShown)||30);
  const groups=[...new Map(source.map(e=>[groupId(e),{id:groupId(e),name:e.translation.translator_groups?.name||'Equipo traductor'}])).values()].filter(g=>g.id).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const list=entries.slice(0,pageSize),muted=preferences.muted.map(id=>{const found=source.find(e=>e.translation.id===id);return found?.translation||null}).filter(Boolean);
  const type=S.releaseType||'all',group=S.releaseTeam||'all';
  const toggles=[
   `<label class="releaseV2Check"><input type="checkbox" data-rel-hide ${preferences.hideRead?'checked':''} ${!S.user?'disabled':''}> Ocultar lo leído</label>`,
   `<label class="releaseV2Check"><input type="checkbox" data-rel-follow ${preferences.onlyFollowing?'checked':''} ${!S.user?'disabled':''}> Solo obras que sigo</label>`,
   `<label class="releaseV2Check"><input type="checkbox" data-rel-dense ${preferences.compact?'checked':''}> Vista compacta</label>`
  ].join('');
  return `${nav()}<main class="wrap releasesPage releaseV2Page ${preferences.compact?'releaseV2Compact':''}" id="mainContent">${status()}
  <header class="releasesHeader"><span class="homeSectionKicker">CATÁLOGO DE ACTUALIZACIONES</span><h1>Lanzamientos</h1><p>Actualizaciones verificadas de volúmenes y capítulos, con un calendario editorial de publicaciones.</p></header>
  <div class="releaseV2Modes" role="group" aria-label="Presentación de lanzamientos">
   <button type="button" class="btn ${preferences.mode==='list'?'primary':''}" data-rel-mode="list" aria-pressed="${preferences.mode==='list'}">Lista</button>
   <button type="button" class="btn ${preferences.mode==='calendar'?'primary':''}" data-rel-mode="calendar" aria-pressed="${preferences.mode==='calendar'}">Calendario</button>
   <span class="releaseV2ModeGap" aria-hidden="true"></span>
   <button type="button" class="btn ${preferences.grouping==='volume'?'primary':''}" data-rel-grouping="volume" aria-pressed="${preferences.grouping==='volume'}">Agrupar por volumen</button>
   <button type="button" class="btn ${preferences.grouping==='chapter'?'primary':''}" data-rel-grouping="chapter" aria-pressed="${preferences.grouping==='chapter'}">Por publicación</button>
  </div>
  <div class="releasesFilters" role="search" aria-label="Filtrar lanzamientos">
    <label>Tipo de publicación<select id="releaseType"><option value="all" ${type==='all'?'selected':''}>Todos</option><option value="volume" ${type==='volume'?'selected':''}>Volúmenes</option><option value="chapter" ${type==='chapter'?'selected':''}>Capítulos</option></select></label>
    <label>Equipo traductor<select id="releaseTeam"><option value="all">Todos los equipos</option>${groups.map(g=>`<option value="${esc(g.id)}" ${group===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>
    <label>Buscar<input id="releaseQuery" type="search" placeholder="Novela, volumen o capítulo" value="${esc(S.releaseQuery||'')}" autocomplete="off"></label>
  </div>
  <div class="releaseV2Toolbar">${toggles}${!S.user?'<span class="muted">Inicia sesión para filtrar obras seguidas o leídas.</span>':''}
   ${muted.length?`<button type="button" class="btn" data-rel-unmute-panel aria-expanded="${!!S.releaseShowMuted}">Silenciadas (${muted.length})</button>`:''}</div>
  ${S.releaseShowMuted&&muted.length?`<section class="releaseV2Muted" aria-label="Obras silenciadas"><h2>Silenciadas en lanzamientos</h2><p class="muted">Esto solo oculta obras de esta lista; no modifica las notificaciones.</p><div class="row">${muted.map(t=>`<button type="button" class="btn" data-rel-unmute="${esc(t.id)}">Restaurar ${esc(titleOf(t))}</button>`).join('')}</div></section>`:''}
  <p class="releasesCount" role="status">${entries.length} ${preferences.grouping==='volume'?'volúmenes con lanzamientos':'publicaciones'} coinciden con los filtros.</p>
  ${preferences.mode==='calendar'?calendar(entries):`<div class="releasesList">${list.length?list.map(eventCard).join(''):'<div class="empty">No hay lanzamientos que coincidan con los filtros seleccionados.</div>'}</div>${entries.length>list.length?`<button type="button" class="btn releaseV2More" data-rel-more>Mostrar más (${entries.length-list.length} restantes)</button>`:''}`}
  </main>`;
 }
 function bind(){
  hydrate();
  const attach=(selector,callback)=>document.querySelectorAll(selector).forEach(b=>b.addEventListener('click',()=>callback(b)));
  const toggle=(selector,key)=>document.querySelector(selector)?.addEventListener('change',e=>{preferences[key]=!!e.target.checked;S.releaseShown=30;save();render()});
  attach('[data-rel-mode]',b=>{preferences.mode=b.dataset.relMode;save();render()});
  attach('[data-rel-grouping]',b=>{preferences.grouping=b.dataset.relGrouping;S.releaseShown=30;save();render()});
  attach('[data-rel-mute]',b=>{
   const id=b.dataset.relMute;if(!id)return;
   if(!preferences.muted.includes(id))preferences.muted.push(id);
   save();render();
  });
  attach('[data-rel-unmute]',b=>{preferences.muted=preferences.muted.filter(x=>x!==b.dataset.relUnmute);save();render()});
  attach('[data-rel-unmute-panel]',()=>{S.releaseShowMuted=!S.releaseShowMuted;render()});
  attach('[data-rel-more]',()=>{S.releaseShown=(S.releaseShown||30)+30;render()});
  attach('[data-rel-month]',b=>{
   const step=Number(b.dataset.relMonth)||0;S.releaseMonthOffset=step===0?0:Math.max(-48,Math.min(12,(S.releaseMonthOffset||0)+step));render();
  });
  toggle('[data-rel-hide]','hideRead');
  toggle('[data-rel-follow]','onlyFollowing');
  toggle('[data-rel-dense]','compact');
 }
 return {view,bind,prepared,calendar};
};
