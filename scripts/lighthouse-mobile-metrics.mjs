// Estadísticas reproducibles a partir de varias ejecuciones Lighthouse.
// Este módulo no requiere dependencias ni modifica resultados de cada auditoría.
const AUDITS={
 LCP:'largest-contentful-paint',
 FCP:'first-contentful-paint',
 TBT:'total-blocking-time',
 CLS:'cumulative-layout-shift',
 TTFB:'server-response-time'
};
export function median(values){
 const sorted=values.filter(Number.isFinite).slice().sort((a,b)=>a-b);
 if(!sorted.length)return null;
 const m=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;
}
export function lighthouseMetrics(report){
 const audits=report?.audits||{},perf=report?.categories?.performance?.score,access=report?.categories?.accessibility?.score;
 const out={performance:Number.isFinite(perf)?Math.round(perf*100):null,accessibility:Number.isFinite(access)?Math.round(access*100):null};
 for(const [name,id] of Object.entries(AUDITS))out[name]=Number.isFinite(audits[id]?.numericValue)?audits[id].numericValue:null;
 return out;
}
export function summarizeLighthouse(reports){
 if(!Array.isArray(reports)||!reports.length)throw new Error('Faltan reportes Lighthouse');
 const samples=reports.map(lighthouseMetrics);
 const keys=['performance','accessibility','LCP','FCP','TBT','CLS','TTFB'];
 const values=Object.fromEntries(keys.map(key=>[key,median(samples.map(s=>s[key]))]));
 if(values.performance===null||values.LCP===null||values.TBT===null)throw new Error('Reportes Lighthouse incompletos');
 // Conservar también un reporte real cercano a la mediana para diagnostics.
 const representativeIndex=samples.map((sample,i)=>({
  i,delta:Math.abs((sample.performance??0)-values.performance)+
   Math.abs((sample.TBT??0)-values.TBT)/100+
   Math.abs((sample.LCP??0)-values.LCP)/100
 })).sort((a,b)=>a.delta-b.delta)[0].i;
 const spread={performance:Math.max(...samples.map(s=>s.performance))-Math.min(...samples.map(s=>s.performance)),
  TBT:Math.max(...samples.map(s=>s.TBT))-Math.min(...samples.map(s=>s.TBT)),
  LCP:Math.max(...samples.map(s=>s.LCP))-Math.min(...samples.map(s=>s.LCP))};
 return {...values,sampleCount:samples.length,representativeIndex,spread,samples};
}
export function performanceWarnings(summary){
 const warnings=[];
 if(summary.sampleCount<3)warnings.push('menos de tres ejecuciones válidas');
 if(summary.performance<75)warnings.push('mediana Performance por debajo de 75');
 if(summary.LCP>2500)warnings.push('mediana LCP supera 2.5 s');
 if(summary.TBT>200)warnings.push('mediana TBT supera 200 ms');
 if(summary.spread.performance>15||summary.spread.TBT>500)warnings.push('alta variación entre ejecuciones (CI ruidoso)');
 return warnings;
}
