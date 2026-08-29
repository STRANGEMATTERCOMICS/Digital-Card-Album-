const CACHE='strange-matter-collector-master-2026-08-29-v21-card-metadata';
const CORE=["./","./index.html","./style.css","./app.js","./manifest.webmanifest","./qr_public_key.json","./cards-manifest.json","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-192.png","./icons/icon-maskable-512.png"];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(CORE);
    const catalogResponse=await fetch('./cards.json',{cache:'no-store'});
    if(!catalogResponse.ok)throw new Error('Card catalog unavailable');
    const catalog=await catalogResponse.clone().json();
    if(!Array.isArray(catalog?.cards))throw new Error('Invalid card catalog');
    await cache.put('./cards.json',catalogResponse.clone());
    const cardAssets=[];
    for(const card of catalog.cards){
      if(typeof card?.preview==='string')cardAssets.push(`./${card.preview.replace(/^\.\//,'')}`);
      if(typeof card?.enc==='string')cardAssets.push(`./${card.enc.replace(/^\.\//,'')}`);
    }
    await cache.addAll([...new Set(cardAssets)]);
    try{await cache.add('./splash.png');}catch(e){}
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  // version.json must always come from the network when an update check is requested.
  if(url.pathname.endsWith('/version.json')){
    event.respondWith(fetch(event.request,{cache:'no-store'}));
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(event.request,{ignoreSearch:false});
    if(cached)return cached;
    try{
      const response=await fetch(event.request);
      if(response&&response.ok){
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
