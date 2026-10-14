// Lighthouse usa un preview local. Reproduce la redirección /media de Vercel
// sin cambiar el servidor principal de las pruebas funcionales.
import http from 'node:http';
import {Readable} from 'node:stream';

const TARGET='https://hfbpsizgwzvvznrktiuq.supabase.co/storage/v1/object/public/nlobi-media/';
const ORIGIN='http://127.0.0.1:4173';
const port=Number(process.env.NLOBI_MEDIA_PREVIEW_PORT||4175);
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url||'/',ORIGIN);
 if(url.pathname.startsWith('/media/')){
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const pathname=url.pathname.slice('/media/'.length);
  if(!pathname||pathname.includes('..')||pathname.includes('\\')){res.writeHead(400).end();return;}
  try{
   const response=await fetch(TARGET+pathname+url.search,{method:req.method,signal:AbortSignal.timeout(12000)});
   res.writeHead(response.status,{
    'Content-Type':response.headers.get('content-type')||'application/octet-stream',
    'Cache-Control':response.headers.get('cache-control')||'public, max-age=300',
    'Access-Control-Allow-Origin':'*'
   });
   if(req.method==='HEAD'||!response.body)res.end();
   else Readable.fromWeb(response.body).pipe(res);
  }catch(error){
   console.warn('[CI media preview]',String(error));
   if(!res.headersSent)res.writeHead(502);
   res.end();
  }
  return;
 }
 const proxy=http.request(ORIGIN+url.pathname+url.search,{
  method:req.method,
  headers:{...req.headers,host:'127.0.0.1:4173'}
 },upstream=>{
  res.writeHead(upstream.statusCode||502,upstream.headers);
  upstream.pipe(res);
 });
 proxy.on('error',error=>{console.warn('[CI preview]',String(error));if(!res.headersSent)res.writeHead(502);res.end()});
 req.pipe(proxy);
});
server.listen(port,'127.0.0.1',()=>console.log('NLOBI CI media preview on '+port));
