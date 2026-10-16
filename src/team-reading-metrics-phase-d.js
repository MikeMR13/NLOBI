/* Fase D — panel de finalizaciones agregado. Sin datos de usuarios ni seguimiento nuevo. */
const validUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));
const integer=value=>Number.isInteger(Number(value))&&Number(value)>=0?Number(value):0;
const node=(tag,text,cls)=>{
 const e=document.createElement(tag);
 if(text!==undefined&&text!==null)e.textContent=String(text);
 if(cls)e.className=cls;
 return e;
};
export function summarizeReadingSnapshot(data){
 if(!data||typeof data!=='object'||data.qualified!==true)return {ready:false,readers:null,completions:null,days:[],chapters:[]};
 const daily=Array.isArray(data.daily)?data.daily:[];
 const chapters=Array.isArray(data.chapters)?data.chapters:[];
 return {
  ready:true,
  readers:integer(data.unique_readers),completions:integer(data.chapter_completions),
  days:daily.filter(row=>row&&/^\d{4}-\d{2}-\d{2}$/.test(row.date||'')&&integer(row.readers)>=5).slice(0,90).map(row=>({date:row.date,completions:integer(row.completions)})),
  chapters:chapters.filter(row=>row&&integer(row.completions)>=5).slice(0,10).map(row=>({
   title:String(row.title||'Capítulo sin título').slice(0,220),
   novel:String(row.novel_title||'Obra').slice(0,220),
   volume:row.volume_number,completions:integer(row.completions)
  }))
 };
}
export function renderReadingSnapshot(element,data){
 const summary=summarizeReadingSnapshot(data);
 element.replaceChildren();
 if(!summary.ready){
  element.append(node('p','No hay suficientes lecturas diferentes para generar estadísticas anónimas. Se requieren al menos cinco lectores en este periodo.','muted'));
  return;
 }
 const cards=node('div',undefined,'teamReadingCards');
 for(const [label,value] of [['Lectores distintos',summary.readers],['Capítulos marcados como leídos',summary.completions]]){
  const card=node('div',undefined,'teamReadingKpi');
  card.append(node('strong',String(value)),node('span',label));cards.append(card);
 }
 element.append(cards);
 const heading=node('h4','Actividad diaria · días con al menos cinco lectores');
 const list=node('div',undefined,'teamReadingChart');
 list.setAttribute('role','list');
 const peak=Math.max(1,...summary.days.map(row=>row.completions));
 for(const row of summary.days){
  const barRow=node('div',undefined,'teamReadingBarRow');
  barRow.setAttribute('role','listitem');
  const day=node('time',row.date);day.dateTime=row.date;
  const track=node('div',undefined,'teamReadingTrack');
  const bar=node('span',undefined,'teamReadingBar');
  bar.style.width=(100*row.completions/peak).toFixed(1)+'%';
  track.append(bar);
  barRow.append(day,track,node('strong',row.completions));list.append(barRow);
 }
 element.append(heading,summary.days.length?list:node('p','No hay días individuales con suficientes lectores para mostrarlos.','muted'));
 const chaptersTitle=node('h4','Capítulos con mayor actividad');
 element.append(chaptersTitle);
 if(summary.chapters.length){
  const items=node('ol',undefined,'teamReadingTopChapters');
  for(const c of summary.chapters){
   const li=node('li');
   li.append(node('strong',c.title),node('small',c.novel+' · Vol. '+String(c.volume??'—')),node('span',c.completions+' lecturas'));
   items.append(li);
  }
  element.append(items);
 }else element.append(node('p','No hay capítulos con suficientes lectores para mostrarlos.','muted'));
 element.append(node('p','Lecturas contabilizadas una vez por usuario y capítulo según la fecha UTC en que se marcó como leído. Los grupos pequeños se omiten.','muted'));
}
export async function bindTeamReadingMetrics({request}){
 const target=document.getElementById('teamReadingMetricsData');
 if(!target)return;
 const id=target.dataset.teamReadingGroup;
 if(!validUuid(id)){target.replaceChildren(node('p','No hay un equipo válido para consultar las métricas.','muted'));return}
 try{
  const data=await request('/rest/v1/rpc/team_reading_snapshot',{method:'POST',body:JSON.stringify({p_group_id:id,p_days:30})});
  if(!target.isConnected||target.dataset.teamReadingGroup!==id)return;
  renderReadingSnapshot(target,data);
 }catch(error){
  if(!target.isConnected)return;
  target.replaceChildren(node('p','Las métricas de lectura aún no están disponibles. Comprueba los permisos y que se haya aplicado la migración de la Fase D.','muted'));
  console.warn('[NLOBI] No se pudieron consultar las métricas privadas del equipo:',String(error?.message||error).slice(0,160));
 }
}
