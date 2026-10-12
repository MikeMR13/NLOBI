// Home: da oportunidad al navegador de pintar el título HTML antes del módulo pesado.
// Otras rutas cargan inmediatamente para conservar la navegación, Studio y el lector.
(function(){
  let started=false;
  const start=()=>{
    if(started)return;
    started=true;
    const script=document.createElement('script');
    script.type='module';
    script.src='/assets/app.js?v=home-painted-first-20261012';
    document.body.appendChild(script);
  };
  if(document.documentElement.dataset.initialHome!=='yes'||document.visibilityState!=='visible'){
    start();
    return;
  }
  // requestAnimationFrame por sí solo se ejecuta antes del pintado. El task siguiente
  // permite presentar el H1 estático sin competir con el parseo/ejecución del módulo.
  requestAnimationFrame(()=>setTimeout(start,0));
  // Si el documento queda en segundo plano y no recibe frames, no se bloquea el arranque.
  setTimeout(start,500);
})();
