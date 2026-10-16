// CI Lighthouse: proxy local de /media, sin servidor adicional de pago.
// Los navegadores abortan recursos durante la auditoría: los streams deben
// cancelarse con sus clientes y nunca tumbar el servidor de la siguiente muestra.
import http from 'node:http';
import {Readable} from 'node:stream';

const TARGET='https://hfbpsizgwzvvznrktiuq.supabase.co/storage/v1/object/public/nlobi-media/';
const ORIGIN='http://127.0.0.1:4173';
const port=Number(process.env.NLOBI_MEDIA_PREVIEW_PORT||4175);
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url||'/',ORIGIN);
 const replyError=(label,error)=>{
  console.warn(label,String(error));
  if(res.destroyed)return;
  if(!res.headersSent){res.writeHead(502);res.end();}else res.destroy();
 };
 res.on('error',error=>console.warn('[CI media downstream]',String(error)));
 if(url.pathname.startsWith('/media/')){
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const pathname=url.pathname.slice('/media/'.length);
  if(!pathname||pathname.includes('..')||pathname.includes('\\')){res.writeHead(400).end();return;}
  try{
   const response=await fetch(TARGET+pathname+url.search,{method:req.method,signal:AbortSignal.timeout(12000)});
   if(res.destroyed){await response.body?.cancel().catch(()=>{});return;}
   res.writeHead(response.status,{
    'Content-Type':response.headers.get('content-type')||'application/octet-stream',
    'Cache-Control':response.headers.get('cache-control')||'public, max-age=300',
    'Access-Control-Allow-Origin':'*'
   });
   if(req.method==='HEAD'||!response.body){res.end();return;}
   const stream=Readable.fromWeb(response.body);
   stream.on('error',error=>replyError('[CI media aborted resource]',error));
   res.on('close',()=>stream.destroy());
   stream.pipe(res);
  }catch(error){replyError('[CI media preview]',error)}
  return;
 }
 const proxy=http.request(ORIGIN+url.pathname+url.search,{
  method:req.method,
  headers:{...req.headers,host:'127.0.0.1:4173'}
 },upstream=>{
  if(res.destroyed){upstream.destroy();return;}
  res.writeHead(upstream.statusCode||502,upstream.headers);
  upstream.on('error',error=>replyError('[CI preview upstream]',error));
  res.on('close',()=>{upstream.unpipe(res);upstream.destroy();proxy.destroy()});
  upstream.pipe(res);
 });
 proxy.on('error',error=>replyError('[CI preview]',error));
 req.on('aborted',()=>proxy.destroy());
 req.pipe(proxy);
});
server.on('clientError',(error,socket)=>{
 console.warn('[CI media malformed client]',String(error));
 if(!socket.destroyed)socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
server.listen(port,'127.0.0.1',()=>console.log('NLOBI CI media preview on '+port));
