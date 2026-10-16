// Bootstrap editorial de Inicio: la portada llega antes de descargar y evaluar
// el paquete completo de Studio/lector. Las rutas no-Home cargan inmediatamente.
(function(){
 const tag=document.currentScript;
 const source=tag?.dataset?.appSrc||'/assets/app.js';
 let launched=false,timeout=null;
 function launch(){
  if(launched)return;
  launched=true;
  if(timeout!==null)clearTimeout(timeout);
  window.removeEventListener('hashchange',launch);
  window.removeEventListener('click',wakeOnInteraction,true);
  const module=document.createElement('script');
  module.type='module';
  module.src=source;
  module.dataset.nlobiApp='1';
  document.body.appendChild(module);
 }
 function wakeOnInteraction(event){
  const target=event.target?.closest?.('[data-v],a[href^="#"]');
  if(!target)return;
  // Los dos botones editoriales existen antes del JS completo: conservar su
  // primera activación, incluso con táctil o teclado.
  const route=target.dataset?.v;
  if(route==='explore'||route==='auth')location.hash='#'+route;
  launch();
 }
 function afterCoverPaint(){
  // Dos fotogramas permiten pintar la imagen decodificada antes de rehidratar.
  requestAnimationFrame(()=>requestAnimationFrame(launch));
 }
 // El modo de fixtures automatizados nunca espera por imágenes de red: así se
 // mantienen deterministas las acciones del lector sin afectar producción.
 if(window.__NLOBI_CONFIG__?.qaMode===true){launch();return;}
 const home=!location.hash||location.hash==='#home'||location.hash==='#home%20';
 const cover=home?document.querySelector('img[data-early-featured-cover]'):null;
 if(!cover){launch();return;}
 window.addEventListener('hashchange',launch,{once:true});
 window.addEventListener('click',wakeOnInteraction,true);
 // La conexión del lector no espera una imagen lenta o inaccesible.
 timeout=setTimeout(launch,1500);
 if(cover.complete){
  if(typeof cover.decode==='function')cover.decode().then(afterCoverPaint,afterCoverPaint);
  else afterCoverPaint();
 }else{
  cover.addEventListener('load',()=>{
   if(typeof cover.decode==='function')cover.decode().then(afterCoverPaint,afterCoverPaint);
   else afterCoverPaint();
  },{once:true});
  cover.addEventListener('error',afterCoverPaint,{once:true});
 }
})();
