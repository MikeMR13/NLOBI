// Fase 6 OX-MR: módulos editoriales en archivos independientes de mantenimiento.
// El CSS se recompone en el mismo orden de cascada y llega en una única solicitud.
// No introduce imports CSS remotos, fuentes ni peticiones adicionales al lector.
export const EDITORIAL_PHASE6_MODULES=Object.freeze([
 'editorial-identity',
 'editorial-collections',
 'editorial-books',
 'editorial-workspaces'
]);
export function composeEditorialCss(source,readModule){
 let css=String(source);
 for(const module of EDITORIAL_PHASE6_MODULES){
  const token='/* NLOBI_PHASE6_MODULE:'+module+' */';
  if(css.split(token).length!==2)throw Error('Módulo CSS ausente o duplicado: '+module);
  const fragment=String(readModule(module));
  if(!fragment.trim()||fragment.includes('NLOBI_PHASE6_MODULE:'))throw Error('Módulo CSS inválido: '+module);
  css=css.replace(token,fragment);
 }
 if(css.includes('NLOBI_PHASE6_MODULE:'))throw Error('Composición incompleta de estilos');
 return css;
}
