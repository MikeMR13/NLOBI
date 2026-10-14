// Compresión conservadora: elimina comentarios sin tocar selectores ni reglas.
// Mantiene el orden de cascada, variables, media queries y fuentes del lector.
export function optimizeCss(css){
 let out='',quote='',i=0;
 while(i<css.length){
  const ch=css[i],next=css[i+1];
  if(quote){
   out+=ch;
   if(ch==='\\'&&i+1<css.length){out+=css[i+1];i+=2;continue}
   if(ch===quote)quote='';
   i++;continue;
  }
  if(ch==='"'||ch==="'"){quote=ch;out+=ch;i++;continue}
  if(ch==='/'&&next==='*'){
   const end=css.indexOf('*/',i+2);
   if(end<0)throw new Error('Comentario CSS sin cierre');
   // Conservar un separador, pues /*comment*/ equivale a un espacio.
   out+=' ';
   i=end+2;continue;
  }
  out+=ch;i++;
 }
 // Recortar únicamente líneas totalmente vacías: no alterar espacios en reglas.
 return out.replace(/^[ \t]*\n/gm,'');
}
