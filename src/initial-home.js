// Presenta el encabezado editorial inicial sin esperar al paquete completo de Studio y lector.
// Solo se expone en Home; el resto de rutas espera al render real de la aplicación.
(function(){
 const hash=location.hash;
 if(!hash||hash==='#home'||hash==='#home%20')document.getElementById('app')?.removeAttribute('hidden');
})();
