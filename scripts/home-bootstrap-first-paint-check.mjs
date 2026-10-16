import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('src/app-bootstrap.js','utf8');
const html=fs.readFileSync('src/index.html','utf8');
const built=fs.readFileSync('dist/index.html','utf8');
const sw=fs.readFileSync('dist/sw.js','utf8');
assert.ok(html.includes('defer src="/assets/app-bootstrap.js"'));
assert.doesNotMatch(html,/rel="modulepreload" href="\/assets\/app\.js/);
assert.doesNotMatch(html,/<script type="module" src="\/assets\/app\.js/);
assert.ok(html.indexOf('data-initial-home')<html.indexOf('src="/assets/app-bootstrap.js'));
assert.match(built,/\/assets\/app-bootstrap\.js\?v=[a-f0-9]{12}/);
assert.match(built,/data-app-src="\/assets\/app\.js\?v=[a-f0-9]{12}"/);
assert.ok(sw.includes('/assets/app-bootstrap.js?v='));
assert.match(source,/cover\.decode\(\)/);
assert.match(source,/1500/);
function simulate({route='#home',seeded=true,complete=false}={}){
 const nodes=[],listeners=new Map(),coverHandlers=new Map(),frames=[],timers=[];
 const image=seeded?{
  complete,decode:()=>Promise.resolve(),addEventListener(name,cb){coverHandlers.set(name,cb)}
 }:null;
 const document={
  currentScript:{dataset:{appSrc:'/assets/app.js?v=abc123'}},
  querySelector(query){return query==='img[data-early-featured-cover]'?image:null},
  createElement(tag){assert.equal(tag,'script');return {dataset:{}}},
  body:{appendChild(el){nodes.push(el)}}
 };
 const window={
  addEventListener(name,cb){listeners.set(name,cb)},
  removeEventListener(name){listeners.delete(name)}
 };
 const location={hash:route};
 vm.runInNewContext(source,{document,window,location,
  requestAnimationFrame:cb=>{frames.push(cb)},
  setTimeout:cb=>{timers.push(cb);return timers.length},
  clearTimeout:()=>{}});
 const tick=()=>{const batch=frames.splice(0);batch.forEach(cb=>cb())};
 return {nodes,listeners,coverHandlers,frames,timers,location,tick};
}
const direct=simulate({route:'#reader:section-1'});
assert.equal(direct.nodes.length,1,'Rutas lector deben iniciar sin espera');
assert.equal(direct.nodes[0].src,'/assets/app.js?v=abc123');
const missing=simulate({seeded:false});
assert.equal(missing.nodes.length,1,'Sin portada sembrada se mantiene inicio inmediato');
const early=simulate();
assert.equal(early.nodes.length,0,'Inicio no evalúa JS grande antes de la imagen');
early.coverHandlers.get('load')();
await Promise.resolve();await Promise.resolve();
early.tick();assert.equal(early.nodes.length,0,'Dar un cuadro para la primera imagen');
early.tick();assert.equal(early.nodes.length,1,'Cargar aplicación tras pintar portada');
early.timers[0]();assert.equal(early.nodes.length,1,'Carga idempotente');
const slow=simulate();
slow.timers[0]();assert.equal(slow.nodes.length,1,'Tiempo máximo sin bloquear usuarios');
const route=simulate();
route.location.hash='#studio';
route.listeners.get('hashchange')();
assert.equal(route.nodes.length,1,'Cambios de ruta deben despertar la aplicación');
const click=simulate();
click.listeners.get('click')({target:{closest:()=>({dataset:{v:'explore'}})}});
assert.equal(click.location.hash,'#explore','Explorar funciona al primer clic');
assert.equal(click.nodes.length,1);
console.log('Home bootstrap: portada primero, lector directo inmediato, navegación y fallback: OK');
