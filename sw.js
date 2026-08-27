const CACHE='album-digitale-master-2026-08-27-v7-signed-qr';
const CORE=["./","./index.html","./style.css","./app.js","./manifest.webmanifest","./qr_public_key.json","./icons/icon-192.png","./icons/icon-512.png"];
const PREVIEWS=Array.from({length:20},(_,i)=>`./previews/${String(i+1).padStart(3,'0')}.webp`);
const CARDS=Array.from({length:20},(_,i)=>`./cards_enc/${String(i+1).padStart(3,'0')}.card`);
const ASSETS=[...CORE,...PREVIEWS,...CARDS];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(ASSETS);
    // Splash opzionale: se presente nella root viene salvata offline,
    // ma la sua assenza non deve impedire l'installazione della PWA.
    try{await cache.add('./splash.png');}catch(e){}
    self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

// OFFLINE-FIRST: una volta installata, l'app usa prima la copia locale.
// La rete viene usata solo come fallback per risorse non ancora memorizzate.
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cached=await caches.match(event.request,{ignoreSearch:false});
    if(cached)return cached;
    try{
      const response=await fetch(event.request);
      if(response && response.ok){
        const cache=await caches.open(CACHE);
        cache.put(event.request,response.clone());
      }
      return response;
    }catch(e){
      if(event.request.mode==='navigate'){
        const shell=await caches.match('./index.html');
        if(shell)return shell;
      }
      throw e;
    }
  })());
});
