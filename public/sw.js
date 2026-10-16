const CACHE='nlobi-shell-v19-40';
const CORE=['/','/index.html','/assets/styles.css','/assets/app.js','/assets/activate-styles.js','/assets/home-cover-hint.js','/assets/initial-home.js','/assets/app-bootstrap.js','/runtime-config.js','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];
const NETWORK_FIRST=new Set(['/index.html','/assets/styles.css','/assets/app.js','/assets/home-cover-hint.js','/assets/initial-home.js','/assets/app-bootstrap.js','/assets/studio-phase5.js','/assets/studio-board-phase3.js','/assets/studio-board-phase3.css','/assets/editorial-insights-phase4.js','/assets/editorial-insights-phase4.css','/assets/reader-tools-phase5.js','/assets/reader-tools-phase5.css','/assets/studio-phase6.js','/assets/studio-phase7.js','/assets/glossary-phase1.js','/assets/glossary-phase1.css','/assets/releases-phase2.js','/assets/releases-phase2.css','/runtime-config.js']);

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(CORE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(req,cacheKey=req,cacheMode='no-cache',event=null){
  // Iniciar red y apertura de caché en paralelo: ni la apertura ni la escritura
  // deben retrasar la primera pintura de una portada pública.
  const cacheReady=caches.open(CACHE);
  try{
    const fresh=await fetch(req,{cache:cacheMode});
    if(fresh.ok){
      const copy=fresh.clone();
      const update=cacheReady.then(cache=>cache.put(cacheKey,copy)).catch(()=>{});
      // waitUntil mantiene viva la actualización sin bloquear respondWith.
      if(event?.waitUntil)event.waitUntil(update);
      else await update;
    }
    return fresh;
  }catch{
    const cache=await cacheReady;
    return (await cache.match(cacheKey)) || Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(req.mode==='navigate'){
    event.respondWith(networkFirst(req,'/index.html'));
    return;
  }

  if(url.pathname.startsWith('/media/')){
    event.respondWith(networkFirst(req,req,'no-cache',event));
    return;
  }
  // Las URL versionadas contienen SHA-256 del archivo: no se vuelven a descargar
  // durante las visitas sucesivas de la misma versión.
  if(['/assets/app.js','/assets/styles.css','/assets/activate-styles.js','/assets/home-cover-hint.js','/assets/initial-home.js','/assets/app-bootstrap.js'].includes(url.pathname)&&/^[a-f0-9]{12}$/.test(url.searchParams.get('v')||'')){
    event.respondWith(caches.open(CACHE).then(async cache=>{
      const hit=await cache.match(req);
      if(hit)return hit;
      const response=await fetch(req);
      if(response.ok)await cache.put(req,response.clone());
      return response;
    }));
    return;
  }
  if(NETWORK_FIRST.has(url.pathname)){
    event.respondWith(networkFirst(req,url.pathname));
    return;
  }

  event.respondWith(
    caches.match(req).then(hit=>{
      if(hit)return hit;
      return fetch(req).then(async r=>{
        if(r.ok){
          const cache=await caches.open(CACHE);
          await cache.put(req,r.clone());
        }
        return r;
      });
    })
  );
});
