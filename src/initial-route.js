// Solo el Home muestra una vista inicial antes del módulo principal.
// Las rutas directas a capítulos, perfiles o Studio permanecen ocultas hasta su carga.
(function(){
 let show=!location.hash||location.hash==='#home';
 if(!location.hash){
  try{
   const options=JSON.parse(localStorage.getItem('nlobi_site_appearance')||'{}');
   if(options.startPage==='library'&&localStorage.getItem('nlobi_token'))show=false;
  }catch{}
 }
 document.documentElement.dataset.initialHome=show?'yes':'no';
})();
