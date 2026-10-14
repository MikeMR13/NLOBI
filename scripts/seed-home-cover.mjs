// Opcional y sin dependencias: en build, recordar la primera portada pública
// para descubrirla antes de cargar el catálogo desde el navegador.
// Si la red no está disponible, el build continúa con el comportamiento habitual.
import fs from 'node:fs';
import path from 'node:path';

const dir=process.argv[2]||'dist';
const configFile=path.join(dir,'runtime-config.js');
const htmlFile=path.join(dir,'index.html');
try{
 const configSrc=fs.readFileSync(configFile,'utf8');
 const json=configSrc.match(/window\.__NLOBI_CONFIG__=(\{[^\n]+\});?/);
 if(!json)throw Error('Runtime config no reconocida');
 const config=JSON.parse(json[1]);
 const endpoint=new URL('/rest/v1/translations',config.supabaseUrl);
 endpoint.searchParams.set('select','id,novels(cover_url)');
 endpoint.searchParams.set('status','in.(active,complete,paused)');
 endpoint.searchParams.set('order','updated_at.desc');
 endpoint.searchParams.set('limit','60');
 const response=await fetch(endpoint,{
  headers:{apikey:config.supabasePublishableKey,Accept:'application/json'},
  signal:AbortSignal.timeout(3200)
 });
 if(!response.ok)throw Error('Estado del catálogo: '+response.status);
 const rows=await response.json();
 const cover=rows.find(row=>row.novels?.cover_url)?.novels.cover_url;
 if(!cover){console.log('Home cover seed: no hay portada pública');process.exit(0)}
 const image=new URL(cover);
 const supabase=new URL(config.supabaseUrl);
 const prefix='/storage/v1/object/public/nlobi-media/';
 if(image.origin!==supabase.origin||!image.pathname.startsWith(prefix))throw Error('Portada sin ruta pública de media');
 const relative='/media/'+image.pathname.slice(prefix.length)+image.search;
 if(/[<>"'\\]/.test(relative))throw Error('Ruta insegura de portada');
 let html=fs.readFileSync(htmlFile,'utf8');
 const anchor='<script src="/assets/home-cover-hint.js';
 const at=html.indexOf(anchor);
 if(at<0)throw Error('No se encontró el script de precarga');
 html=html.slice(0,at)+'<meta name="nlobi-build-cover" content="'+relative+'">\n'+html.slice(at);
 fs.writeFileSync(htmlFile,html);
 console.log('Home cover seed: portada pública inicial disponible');
}catch(error){
 console.warn('Home cover seed: omitiendo precarga de compilación ('+String(error?.message||error)+')');
}
