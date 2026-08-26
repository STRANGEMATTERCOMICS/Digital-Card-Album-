const CACHE='album-digitale-master-2026-08-26-v1';
const CORE=["./","./index.html","./style.css","./app.js","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"];
const PREVIEWS=Array.from({length:20},(_,i)=>`./previews/${String(i+1).padStart(3,'0')}.webp`);
const CARDS=Array.from({length:20},(_,i)=>`./cards_enc/${String(i+1).padStart(3,'0')}.card`);
const ASSETS=[...CORE,...PREVIEWS,...CARDS];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin)return;
  const isFresh=url.pathname.endsWith('/')||/\.(?:html|css|js|webmanifest|webp)$/.test(url.pathname);
  if(isFresh){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;}).catch(()=>caches.match(e.request)));
  }else{
    e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;})));
  }
});
