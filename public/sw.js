const CACHE='nlobi-shell-v20-23';
const OFFLINE_MEDIA='nlobi-offline-volume-media-v1';
const CORE=['/','/index.html','/assets/styles.css','/assets/app.js','/assets/reader-flow.js','/assets/reader-enhancements.js','/assets/reader-annotations.js','/assets/reader-pagination.js','/assets/reader-preferences.js','/runtime-config.js','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];
const NETWORK_FIRST=new Set(['/index.html','/assets/styles.css','/assets/app.js','/assets/reader-flow.js','/assets/reader-enhancements.js','/assets/reader-annotations.js','/assets/reader-pagination.js','/assets/reader-preferences.js','/runtime-config.js']);

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
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!==OFFLINE_MEDIA).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(req,cacheKey=req){
  const cache=await caches.open(CACHE);
  try{
    const fresh=await fetch(req,{cache:'no-store'});
    if(fresh.ok)await cache.put(cacheKey,fresh.clone());
    return fresh;
  }catch{
    const stored=await cache.match(cacheKey);
    if(stored)return stored;
    if(new URL(req.url).pathname.startsWith('/media/'))return (await (await caches.open(OFFLINE_MEDIA)).match(req)) || Response.error();
    return Response.error();
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
    event.respondWith(networkFirst(req,req));
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
