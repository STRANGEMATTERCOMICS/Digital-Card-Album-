const CACHE='album-digitale-ui3-20260826';
const ASSETS=["./", "./index.html", "./style.css", "./app.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./previews/001.webp", "./previews/002.webp", "./previews/003.webp", "./previews/004.webp", "./previews/005.webp", "./previews/006.webp", "./previews/007.webp", "./previews/008.webp", "./previews/009.webp", "./previews/010.webp", "./previews/011.webp", "./previews/012.webp", "./previews/013.webp", "./previews/014.webp", "./previews/015.webp", "./previews/016.webp", "./previews/017.webp", "./previews/018.webp", "./previews/019.webp", "./previews/020.webp", "./cards_enc/001.card", "./cards_enc/002.card", "./cards_enc/003.card", "./cards_enc/004.card", "./cards_enc/005.card", "./cards_enc/006.card", "./cards_enc/007.card", "./cards_enc/008.card", "./cards_enc/009.card", "./cards_enc/010.card", "./cards_enc/011.card", "./cards_enc/012.card", "./cards_enc/013.card", "./cards_enc/014.card", "./cards_enc/015.card", "./cards_enc/016.card", "./cards_enc/017.card", "./cards_enc/018.card", "./cards_enc/019.card", "./cards_enc/020.card"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  const req=e.request;
  const url=new URL(req.url);
  const critical=req.mode==='navigate'||/\.(?:html|js|css)$/.test(url.pathname);
  if(critical){
    e.respondWith(
      fetch(req).then(resp=>{
        const copy=resp.clone();
        caches.open(CACHE).then(c=>c.put(req,copy));
        return resp;
      }).catch(()=>caches.match(req).then(hit=>hit||caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(hit=>hit||fetch(req).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE).then(c=>c.put(req,copy));
      return resp;
    }))
  );
});