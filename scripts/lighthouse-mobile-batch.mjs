import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {summarizeLighthouse,performanceWarnings} from './lighthouse-mobile-metrics.mjs';

// Se mide el mismo preview móvil cinco veces para reducir falsos positivos.
// Los umbrales iniciales son informativos hasta establecer una línea base estable.
const count=Number(process.env.NLOBI_LIGHTHOUSE_RUNS||5);
if(!Number.isInteger(count)||count<3||count>9)throw new Error('NLOBI_LIGHTHOUSE_RUNS debe estar entre 3 y 9');
const directory='performance-results',samplesDir=path.join(directory,'samples');
fs.mkdirSync(samplesDir,{recursive:true});
const reports=[],errors=[],url=process.env.NLOBI_PERFORMANCE_URL||'http://127.0.0.1:4175/#home';
// Cada muestra necesita un reporte válido: reintentar Chrome transitoriamente
// antes de declarar una medición perdida. Nunca imputar puntuaciones faltantes.
for(let i=0;i<count;i++){
 const output=path.join(samplesDir,'mobile-home-'+(i+1)+'.json');
 let valid=false;
 for(let attempt=1;attempt<=3&&!valid;attempt++){
  const args=['--yes','lighthouse@12',url,
   '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage --disable-background-networking --no-first-run',
   '--form-factor=mobile','--screenEmulation.mobile=true',
   '--throttling-method=simulate','--only-categories=performance,accessibility',
   '--output=json','--output-path='+output,'--quiet'];
  const run=spawnSync('npx',args,{encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  if(run.error||run.status!==0){
   const err={sample:i+1,attempt,status:run.status,error:String(run.error||run.stderr||run.stdout).slice(-700)};
   errors.push(err);
   console.warn('Lighthouse sample '+(i+1)+' intento '+attempt+' fallido:',err.error);
   continue;
  }
  try{
   const report=JSON.parse(fs.readFileSync(output,'utf8'));
   if(!Number.isFinite(report?.categories?.performance?.score))throw new Error('Puntuación no disponible');
   reports.push(report);
   valid=true;
  }catch(error){
   errors.push({sample:i+1,attempt,error:String(error)});
   console.warn('Lighthouse sample '+(i+1)+' intento '+attempt+' inválido:',error);
  }
 }
}
if(reports.length<3){console.error('Lighthouse: insuficientes muestras',JSON.stringify(errors));process.exit(1)}
const summary=summarizeLighthouse(reports);
const selected=reports[summary.representativeIndex];
fs.writeFileSync(path.join(directory,'mobile-home.json'),JSON.stringify(selected));
const warnings=performanceWarnings(summary);
fs.writeFileSync(path.join(directory,'summary.json'),JSON.stringify({...summary,warnings,errors},null,2));
console.log('Lighthouse mobile:',JSON.stringify({
 performance:summary.performance,accessibility:summary.accessibility,
 LCP:summary.LCP,CLS:summary.CLS,TBT:summary.TBT,
 samples:summary.sampleCount,spread:summary.spread,warnings
}));
if(warnings.length)console.warn('Performance watch (informativo):',warnings.join(' | '));
if(reports.length!==count){console.error('Lighthouse: solo '+reports.length+'/'+count+' muestras válidas incluso tras los reintentos.');process.exitCode=1}

