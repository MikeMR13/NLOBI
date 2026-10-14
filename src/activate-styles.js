// CSS global asíncrono. Fuentes de lectura solo cuando la ruta las utiliza.
(function(){
 function enable(link){
  if(!link)return;
  const done=()=>{link.media='all'};
  link.addEventListener('load',done,{once:true});
  if(link.sheet)done();
 }
 enable(document.getElementById('siteStyles'));
 let fontsRequested=false;
 window.__nlobiActivateReaderFonts=function(route){
  const view=String(route||decodeURIComponent(location.hash.slice(1))||'home');
  if(!/^(reader:|auth:edit|studio(?::|$))/.test(view)||fontsRequested)return;
  const link=document.getElementById('readerFonts');
  if(!link)return;
  fontsRequested=true;
  enable(link);
  link.href=link.dataset.readerHref||'';
 };
 window.__nlobiActivateReaderFonts();
 window.addEventListener('hashchange',()=>window.__nlobiActivateReaderFonts?.());
})();
