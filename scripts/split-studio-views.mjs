// Build-time route splitting without changing the shared editor/reader behavior.
// Large Studio presentation functions run only after navigating to Studio.
// Source remains readable for existing static QA fixtures; only dist is partitioned.
import fs from 'node:fs';
import path from 'node:path';

const targets=['studio','studioTeamView','studioProjectView','studioMediaView',
 'studioTeamsManagement','studioImport','studioSectionEditor','importStepView'];
const namePattern=/^(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/gm;
export function splitStudioViews(source){
 const funcs=[...source.matchAll(namePattern)].map(m=>({name:m[1],index:m.index}));
 const methods=new Map();
 for(const name of targets){
  const fn=funcs.find(x=>x.name===name);
  if(!fn)throw new Error('No se encontró vista Studio: '+name);
  const next=funcs.find(x=>x.index>fn.index);
  if(!next)throw new Error('No hay delimitador posterior para '+name);
  const code=source.slice(fn.index,next.index);
  // No mover una declaración global que pertenezca a la siguiente vista.
  if(/^(?:const|let|var|class)\s+[A-Za-z_$]/m.test(code))
   throw new Error('La vista '+name+' contiene declaraciones globales adyacentes');
  methods.set(name,{code,start:fn.index,end:next.index});
 }
 const moved=[...methods.values()].map(x=>x.code).join('\n');
 const functions=funcs.map(x=>x.name);
 const globals=[...source.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
 // En app.js los ayudantes de URL están definidos en la misma línea:
 // const safeUrl=...;const safeMediaUrl=...;const safeCssUrl=...
 // El análisis por ^const no detectaba las declaraciones segunda y tercera.
 const symbols=[...new Set([...functions,...globals,'safeMediaUrl','safeCssUrl','$','studioQuality','studioWorkflow'])];
 const referenced=symbols.filter(name=>!methods.has(name)&&
  new RegExp('\\b'+name.replaceAll('$','\\$')+'\\b').test(moved));
 // $ es un selector léxico válido y no se comporta como palabra en regexp.
 for(const name of ['$','$$'])if(!methods.has(name)&&moved.includes(name)&&!referenced.includes(name))referenced.push(name);
 const module='// Studio pesado: carga diferida por ruta; generado durante npm run build.\n'+
  'export function createStudioViews(deps){\n const {'+referenced.join(',')+'}=deps;\n'+
  moved+'\n return {'+targets.join(',')+'};\n}\n';
 let reduced=source;
 for(const [name,fn] of [...methods.entries()].sort((a,b)=>b[1].start-a[1].start)){
  // Reemplazar por índices en orden descendente para conservar posiciones.
  reduced=reduced.slice(0,fn.start)+
   'function '+name+'(...args){return lazyStudioViews?.'+name+
   '(...args)??(nav()+\'<main class="wrap" id="mainContent"><p class="muted">Preparando Studio…</p></main>\')}\n'+
   reduced.slice(fn.end);
 }
 const marker='let studioLaunch=null,studioQuality=null,studioWorkflow=null,studioModulesPromise=null;';
 if(!reduced.includes(marker))throw new Error('Falta punto de entrada de Studio');
 reduced=reduced.replace(marker,'let lazyStudioViews=null;\n'+marker);
 const deps=referenced.map(name=>name+':'+name).join(',');
 const section="import('/assets/studio-phase7.js'),\n  loadGlossaryPhase1().catch(error=>{console.warn('[Glosario opcional]',error);return null})\n ]).then(()=>{";
 if(!reduced.includes(section))throw new Error('No se puede conectar la importación de vistas Studio');
 reduced=reduced.replace(section,"import('/assets/studio-phase7.js'),\n  loadGlossaryPhase1().catch(error=>{console.warn('[Glosario opcional]',error);return null}),\n  import('/assets/studio-views.js')\n ]).then((modules)=>{\n  const createLazyStudioViews=modules[4].createStudioViews;");
 const finishStudio='  return true;\n }).catch(error=>{studioModulesPromise=null;throw error});';
 if(!reduced.includes(finishStudio))throw new Error('No se encontró el final del inicializador Studio');
 reduced=reduced.replace(finishStudio,'  lazyStudioViews=createLazyStudioViews({'+deps+'});\n'+finishStudio);
 return {app:reduced,module,bytesSaved:source.length-reduced.length,dependencies:referenced};
}
const dir=process.argv[2];
if(dir){
 const file=path.join(dir,'assets','app.js'),source=fs.readFileSync(file,'utf8');
 const result=splitStudioViews(source);
 fs.writeFileSync(file,result.app);
 fs.writeFileSync(path.join(dir,'assets','studio-views.js'),result.module);
 console.log('Studio route split: '+result.bytesSaved+' bytes removed from app.js; '+result.dependencies.length+' references preserved');
}
