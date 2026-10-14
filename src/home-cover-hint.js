// Pista de precarga de una portada pública ya mostrada. No carga datos de usuario.
// Se descarta al cambiar de portada o después de 12 horas.
(function(){
 try{
  if(location.hash&&location.hash!=='#home')return;
  const hint=JSON.parse(localStorage.getItem('nlobi_home_cover_hint_v1')||'null');
  const fresh=hint&&typeof hint.path==='string'&&Number.isFinite(hint.at)&&
     Date.now()-hint.at<=12*60*60*1000&&Date.now()>=hint.at;
  // Visitas recurrentes usan la portada vista; la primera visita usa la pista
  // pública generada durante el despliegue (sin solicitudes extra del cliente).
  const path=fresh?hint.path:document.querySelector?.('meta[name="nlobi-build-cover"]')?.content;
  if(!path)return;
  const url=new URL(path,location.origin);
  if(url.origin!==location.origin||!url.pathname.startsWith('/media/')||
     url.pathname.includes('..')||url.hash)return;
  const link=document.createElement('link');
  link.rel='preload';link.as='image';link.href=url.href;
  link.fetchPriority='high';link.dataset.homeCoverHint='1';
  document.head.append(link);
 }catch{}
})();
