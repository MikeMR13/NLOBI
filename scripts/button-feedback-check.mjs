import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';

const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const start=source.indexOf('// Prevent duplicate writes and show a clear busy state');
const end=source.indexOf('let toastTimer,lastToastMessage',start);
assert.ok(start>0&&end>start,'Busy state utility must be defined');
const helper=source.slice(start,end);
for(const id of ['createProject','saveVolumeMeta','postComment','sendCollaborationInvite','publishImportNow','saveImportDrafts']){
 assert.ok(source.includes("withBusyButton('"+id+"'"),id+' must be protected from repeated clicks');
}

for(const [name,type] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.goto('about:blank');
  await page.setContent('<html lang="es"><body><button id="saveVolumeMeta" aria-label="Guardar">Guardar cambios</button></body></html>');
  const result=await page.evaluate(async code=>{
   const $=q=>document.querySelector(q);
   const withBusyButton=new Function('$',code+';return withBusyButton;')($);
   const button=$('#saveVolumeMeta');
   let calls=0,complete;
   const pending=new Promise(resolve=>complete=resolve);
   const action=()=>{calls++;return pending};
   const first=withBusyButton('saveVolumeMeta','Guardando volumen…',action);
   const second=withBusyButton('saveVolumeMeta','Guardando volumen…',action);
   const during={calls,disabled:button.disabled,busy:button.getAttribute('aria-busy'),text:button.textContent};
   complete('ok');
   await Promise.all([first,second]);
   const after={disabled:button.disabled,busy:button.getAttribute('aria-busy'),text:button.textContent,label:button.getAttribute('aria-label')};
   let caught=false;
   try{await withBusyButton('saveVolumeMeta','Guardando volumen…',async()=>{throw Error('Fallo de prueba')})}catch(error){caught=error.message==='Fallo de prueba'}
   const rejected={caught,disabled:button.disabled,busy:button.hasAttribute('aria-busy'),text:button.textContent};
   return {during,after,rejected};
  },helper);
  assert.deepEqual(result.during,{calls:1,disabled:true,busy:'true',text:'Guardando volumen…'},name+' busy state');
  assert.deepEqual(result.after,{disabled:false,busy:null,text:'Guardar cambios',label:'Guardar'},name+' restored label');
  assert.deepEqual(result.rejected,{caught:true,disabled:false,busy:false,text:'Guardar cambios'},name+' reset after failure');
 }finally{await browser.close()}
}
console.log('Button busy feedback OK: six write handlers protected; Chromium/WebKit async, dedupe, success and error states.');
