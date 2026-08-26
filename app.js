const TYPE_MAP={3:'V',7:'◆',11:'V',14:'◆',18:'V'};
const STORAGE_KEY='album-digitale-encrypted-v2';
const LEGACY_STORAGE_KEY='album-digitale-encrypted-v1';
const KEY_DB='album-digitale-secure-store';
const KEY_STORE='crypto';
const DEVICE_KEY_ID='device-wrap-key-v1';
const QR_PUBLIC_JWK={"kty":"EC","crv":"P-256","x":"zIaO_UNZG3dcxEVdIgNOWFUBgMaUV_h5l0UeXlAVNw4","y":"mfat8VZrHZ151yjyilpWAaX4GsJq2MEHY6WFyIx-3A4","ext":true};
const cards=Array.from({length:20},(_,i)=>({id:i+1,type:TYPE_MAP[i+1]||'',enc:`cards_enc/${String(i+1).padStart(3,'0')}.card?v=20260826-content1`,preview:`previews/${String(i+1).padStart(3,'0')}.webp?v=20260826-content1`}));
const state={protectedKeys:{},usedQr:new Set()};
const cardKeyCache=new Map();
const decryptedUrls=new Map();
const grid=document.getElementById('albumGrid');
const ownedCount=document.getElementById('ownedCount');
const gallery=document.getElementById('gallery');
const galleryTrack=document.getElementById('galleryTrack');
const galleryMeta=document.getElementById('galleryMeta');
const galleryPosition=document.getElementById('galleryPosition');
const revealBar=document.getElementById('revealBar');
const revealText=document.getElementById('revealText');
const toast=document.getElementById('toast');
const scannerDialog=document.getElementById('scannerDialog');
const scannerVideo=document.getElementById('scannerVideo');
const scannerStatus=document.getElementById('scannerStatus');
let scannerStream=null,scannerActive=false,scannerDetector=null,scannerTimer=null;
let galleryIndex=0,revealCancelled=false,revealRunning=false,galleryScrollTimer=null;
const revealPending=new Set();

function bytesToB64u(bytes){let raw='';for(const b of bytes)raw+=String.fromCharCode(b);return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function b64uToBytes(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0));}
function pad(n){return String(n).padStart(3,'0')}
function openKeyDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(KEY_DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(KEY_STORE))db.createObjectStore(KEY_STORE);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function getDeviceWrapKey(){
  const db=await openKeyDb();
  const existing=await new Promise((resolve,reject)=>{const tx=db.transaction(KEY_STORE,'readonly');const req=tx.objectStore(KEY_STORE).get(DEVICE_KEY_ID);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});
  if(existing){db.close();return existing;}
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  await new Promise((resolve,reject)=>{const tx=db.transaction(KEY_STORE,'readwrite');tx.objectStore(KEY_STORE).put(key,DEVICE_KEY_ID);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
  db.close();return key;
}
function loadProtectedState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const p=JSON.parse(raw);state.protectedKeys=p.protectedKeys||{};state.usedQr=new Set(p.usedQr||[]);}}catch(e){state.protectedKeys={};state.usedQr=new Set();}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify({v:2,protectedKeys:state.protectedKeys,usedQr:[...state.usedQr]}));}
function isUnlocked(id){const e=state.protectedKeys[id];return !!(e&&typeof e.iv==='string'&&typeof e.ct==='string');}
async function protectCardKey(id,keyText){
  const wrapKey=await getDeviceWrapKey();const iv=crypto.getRandomValues(new Uint8Array(12));
  const aad=new TextEncoder().encode(`ALBUMDIGITALE:LOCALKEY:${pad(id)}`);
  const plain=new TextEncoder().encode(keyText);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},wrapKey,plain);
  state.protectedKeys[id]={iv:bytesToB64u(iv),ct:bytesToB64u(new Uint8Array(ct))};cardKeyCache.set(id,keyText);
}
async function getCardKey(id){
  if(cardKeyCache.has(id))return cardKeyCache.get(id);const e=state.protectedKeys[id];if(!e)throw new Error('Chiave card assente');
  const wrapKey=await getDeviceWrapKey();const aad=new TextEncoder().encode(`ALBUMDIGITALE:LOCALKEY:${pad(id)}`);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64uToBytes(e.iv),additionalData:aad},wrapKey,b64uToBytes(e.ct));
  const keyText=new TextDecoder().decode(plain);cardKeyCache.set(id,keyText);return keyText;
}
async function migrateLegacyState(){
  let legacy=null;try{const raw=localStorage.getItem(LEGACY_STORAGE_KEY);if(raw)legacy=JSON.parse(raw);}catch(e){}
  if(!legacy)return;
  if(Array.isArray(legacy.usedQr))for(const q of legacy.usedQr)state.usedQr.add(q);
  if(legacy.keys&&typeof legacy.keys==='object'){for(const [id,keyText] of Object.entries(legacy.keys)){if(typeof keyText==='string'&&keyText.length>20&&!isUnlocked(Number(id)))await protectCardKey(Number(id),keyText);}}
  saveState();localStorage.removeItem(LEGACY_STORAGE_KEY);
}
async function verifyAndDecodePayload(text){if(typeof text!=='string'||!text.startsWith('AD1.'))throw new Error('QR non riconosciuto');const parts=text.split('.');if(parts.length!==3||!parts[1]||!parts[2])throw new Error('QR non firmato o formato non valido');const payloadBytes=b64uToBytes(parts[1]);const signature=b64uToBytes(parts[2]);if(signature.length!==64)throw new Error('Firma QR non valida');const publicKey=await crypto.subtle.importKey('jwk',QR_PUBLIC_JWK,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);const authentic=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,signature,payloadBytes);if(!authentic)throw new Error('QR NON AUTENTICO');let p;try{p=JSON.parse(new TextDecoder().decode(payloadBytes));}catch(e){throw new Error('Payload QR non valido');}if(p.v!==1||!Array.isArray(p.cards)||p.cards.length<1||p.cards.length>5)throw new Error('Payload QR non valido');for(const item of p.cards){if(typeof item.k!=='string'&&typeof item.key==='string')item.k=item.key;if(!Number.isInteger(item.id)||item.id<1||item.id>20||typeof item.k!=='string')throw new Error('Card QR non valida');}return p;}
async function decryptCard(id,keyText=null){if(decryptedUrls.has(id))return decryptedUrls.get(id);if(!keyText)keyText=await getCardKey(id);const c=cards[id-1];const packed=new Uint8Array(await (await fetch(c.enc)).arrayBuffer());if(packed.length<29)throw new Error('File cifrato non valido');const iv=packed.slice(0,12),cipher=packed.slice(12);const key=await crypto.subtle.importKey('raw',b64uToBytes(keyText),{name:'AES-GCM'},false,['decrypt']);const aad=new TextEncoder().encode(`ALBUMDIGITALE:CARD:${pad(id)}`);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},key,cipher);const url=URL.createObjectURL(new Blob([plain],{type:'image/webp'}));decryptedUrls.set(id,url);return url;}
async function imageFor(c){if(!isUnlocked(c.id)||revealPending.has(c.id))return c.preview;try{return await decryptCard(c.id);}catch(e){return c.preview;}}

async function render(){
  grid.innerHTML='';
  for(let i=0;i<cards.length;i++){
    const c=cards[i],unlocked=isUnlocked(c.id)&&!revealPending.has(c.id);
    const slot=document.createElement('article');slot.className='slot'+(unlocked?'':' locked');slot.dataset.id=c.id;
    const btn=document.createElement('button');btn.type='button';btn.className='card-button';btn.disabled=!unlocked;btn.setAttribute('aria-label',`Card ${pad(c.id)}${c.type?' '+c.type:''}${unlocked?'':' non sbloccata'}`);
    const src=await imageFor(c);
    btn.innerHTML=`<div class="card-frame"><img class="card-image" src="${src}" alt="Card ${pad(c.id)}"><div class="shade"></div></div><div class="slot-meta"><span>#${pad(c.id)}</span><span>${c.type}</span></div>`;
    btn.addEventListener('click',()=>openGallery(i));slot.appendChild(btn);grid.appendChild(slot);
  }
  ownedCount.textContent=Object.keys(state.protectedKeys).filter(k=>isUnlocked(Number(k))).length;
}

async function buildGallery(){
  galleryTrack.innerHTML='';
  for(let i=0;i<cards.length;i++){
    const c=cards[i],locked=!isUnlocked(c.id)||revealPending.has(c.id),src=await imageFor(c);
    const slide=document.createElement('article');slide.className='gallery-slide';slide.dataset.index=String(i);
    slide.innerHTML=`<div class="gallery-card${locked?' locked':''}"><img class="card-image" src="${src}" alt="Card ${pad(c.id)}"><div class="shade"></div></div>`;
    const gi=slide.querySelector('.card-image');
    const gc=slide.querySelector('.gallery-card');
    gi.addEventListener('load',()=>{
      if(gi.naturalWidth&&gi.naturalHeight){
        gc.style.setProperty('--card-ratio',`${gi.naturalWidth}/${gi.naturalHeight}`);
      }
    },{once:true});
    galleryTrack.appendChild(slide);
  }
}

async function updateGalleryBackground(i){
  const slide=galleryTrack.children[i]; if(!slide)return;
  const img=slide.querySelector('img'); if(!img)return;
  try{
    if(!img.complete)await new Promise((res,rej)=>{img.addEventListener('load',res,{once:true});img.addEventListener('error',rej,{once:true});});
    const c=document.createElement('canvas'); c.width=24;c.height=36;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,c.width,c.height);
    const d=ctx.getImageData(0,0,c.width,c.height).data;
    let r=0,g=0,b=0,n=0;
    for(let p=0;p<d.length;p+=16){if(d[p+3]<100)continue;r+=d[p];g+=d[p+1];b+=d[p+2];n++;}
    if(!n)return; r/=n;g/=n;b/=n;
    const lum=.2126*r+.7152*g+.0722*b;
    const factor=lum>145?.24:.34;
    const rr=Math.max(7,Math.round(r*factor)),gg=Math.max(8,Math.round(g*factor)),bb=Math.max(9,Math.round(b*factor));
    gallery.style.setProperty('--gallery-bg',`rgb(${rr} ${gg} ${bb})`);
  }catch(e){gallery.style.setProperty('--gallery-bg','#090b0d');}
}

function updateGalleryMeta(i){
  galleryIndex=Math.max(0,Math.min(cards.length-1,i));
  const c=cards[galleryIndex],locked=!isUnlocked(c.id)||revealPending.has(c.id);
  galleryPosition.textContent=`${galleryIndex+1} / ${cards.length}`;
  galleryMeta.textContent=`#${pad(c.id)}${c.type?'  '+c.type:''}${locked?'  ·  NON SBLOCCATA':''}`;
  updateGalleryBackground(galleryIndex);
}

function scrollGalleryTo(i,behavior='auto'){
  const slide=galleryTrack.children[i];if(!slide)return;
  slide.scrollIntoView({behavior,block:'nearest',inline:'center'});
  updateGalleryMeta(i);
}

async function openGallery(i){
  galleryIndex=i;
  await buildGallery();
  gallery.showModal();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    scrollGalleryTo(i,'auto');
    updateGalleryMeta(i);
  }));
}

document.getElementById('closeGallery').addEventListener('click',()=>gallery.close());

galleryTrack.addEventListener('scroll',()=>{
  clearTimeout(galleryScrollTimer);
  galleryScrollTimer=setTimeout(()=>{
    const center=galleryTrack.scrollLeft+galleryTrack.clientWidth/2;
    let best=0,bestDist=Infinity;
    Array.from(galleryTrack.children).forEach((slide,i)=>{
      const slideCenter=slide.offsetLeft+slide.offsetWidth/2;
      const d=Math.abs(slideCenter-center);
      if(d<bestDist){bestDist=d;best=i;}
    });
    updateGalleryMeta(best);
  },70);
},{passive:true});

galleryTrack.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'&&galleryIndex<cards.length-1){e.preventDefault();scrollGalleryTo(galleryIndex+1,'smooth');}
  if(e.key==='ArrowLeft'&&galleryIndex>0){e.preventDefault();scrollGalleryTo(galleryIndex-1,'smooth');}
});

const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function importQr(text){
  if(revealRunning)return;

  let p;
  try{ p=await verifyAndDecodePayload(text); }
  catch(e){ toast.textContent=e.message; toast.hidden=false; return; }

  const targets=[],already=[];
  for(const item of p.cards){
    if(isUnlocked(item.id)){ already.push(item.id); continue; }
    targets.push({id:item.id,k:item.k});
    revealPending.add(item.id);
  }

  if(!targets.length){
    toast.textContent=p.cards.length===1
      ?'HAI GIÀ QUESTA CARD!'
      :'HAI GIÀ TUTTE LE CARD DI QUESTO PACCHETTO!';
    toast.hidden=false;
    await render();
    return;
  }

  revealRunning=true;
  revealCancelled=false;
  toast.hidden=true;
  revealBar.hidden=false;

  /* IMPORTANT:
     the AES key of a new card is NOT written to persistent storage until
     that card reaches its own reveal turn. Therefore render() cannot ever
     see a future card as unlocked. */
  for(let pos=0;pos<targets.length;pos++){
    const item=targets[pos], id=item.id;
    if(revealCancelled)break;

    await render();
    const slot=grid.querySelector(`[data-id="${id}"]`);
    if(!slot)continue;

    slot.classList.add('locked');
    const img=slot.querySelector('.card-image');
    img.src=cards[id-1].preview;

    slot.scrollIntoView({behavior:'smooth',block:'center'});
    revealText.textContent=`RIVELAZIONE #${pad(id)}${cards[id-1].type?' '+cards[id-1].type:''}`;

    await wait(650);
    if(revealCancelled)break;

    let decrypted=null;
    try{
      /* decrypt using the QR key directly; still not persisted */
      decrypted=await decryptCard(id,item.k);
    }catch(e){
      toast.textContent=`ERRORE DECIFRAZIONE #${pad(id)}`;
      toast.hidden=false;
    }

    if(decrypted){
      img.src=decrypted;                 // exact reveal moment
      slot.classList.remove('locked');
      slot.classList.add('revealing');
      await wait(900);

      /* Only now does the card become officially owned. */
      await protectCardKey(id,item.k);
      saveState();
    }

    revealPending.delete(id);
    await wait(450);
  }

  if(revealCancelled){
    /* SALTA means: acquire every remaining card immediately, without
       briefly showing their full images during the interrupted reveal. */
    for(const item of targets){
      if(!isUnlocked(item.id)){
        await protectCardKey(item.id,item.k);
      }
      revealPending.delete(item.id);
    }
    saveState();
  }

  await render();
  revealBar.hidden=true;
  revealRunning=false;

  const newCount=targets.length;
  const msg=already.length
    ?`${newCount} NUOVE CARD · ${already.length} GIÀ POSSEDUTE`
    :`${newCount} NUOVE CARD SBLOCCATE`;
  toast.textContent=msg;
  toast.hidden=false;
}


function stopScanner(){scannerActive=false;if(scannerTimer){clearTimeout(scannerTimer);scannerTimer=null;}if(scannerStream){scannerStream.getTracks().forEach(t=>t.stop());scannerStream=null;}scannerVideo.srcObject=null;if(scannerDialog.open)scannerDialog.close();}
async function scanFrame(){if(!scannerActive||!scannerDetector)return;try{if(scannerVideo.readyState>=2){const codes=await scannerDetector.detect(scannerVideo);if(codes&&codes.length){const raw=(codes[0].rawValue||'').trim();if(raw){scannerStatus.textContent='QR rilevato. Verifica firma…';scannerActive=false;if(scannerStream)scannerStream.getTracks().forEach(t=>t.stop());scannerStream=null;scannerVideo.srcObject=null;scannerDialog.close();await importQr(raw);return;}}}}catch(e){}if(scannerActive)scannerTimer=setTimeout(scanFrame,120);}
async function startScanner(){toast.hidden=true;if(!window.isSecureContext){toast.textContent='LA FOTOCAMERA RICHIEDE HTTPS';toast.hidden=false;return;}if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast.textContent='FOTOCAMERA NON DISPONIBILE';toast.hidden=false;return;}if(!('BarcodeDetector' in window)){toast.textContent='SCANNER QR NON SUPPORTATO DA QUESTO BROWSER';toast.hidden=false;return;}try{const formats=await BarcodeDetector.getSupportedFormats();if(!formats.includes('qr_code'))throw new Error('QR non supportato');scannerDetector=new BarcodeDetector({formats:['qr_code']});scannerStatus.textContent='Inquadra il QR firmato all’interno del riquadro.';scannerDialog.showModal();scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:1280}},audio:false});scannerVideo.srcObject=scannerStream;await scannerVideo.play();scannerActive=true;scanFrame();}catch(e){stopScanner();const denied=e&&(/NotAllowed|Permission/i.test(e.name||'')||/denied|permission/i.test(e.message||''));toast.textContent=denied?'PERMESSO FOTOCAMERA NEGATO':'IMPOSSIBILE AVVIARE LO SCANNER';toast.hidden=false;}}

document.getElementById('skipReveal').addEventListener('click',()=>{revealCancelled=true;revealText.textContent='COMPLETAMENTO SBLOCCO…';});
document.getElementById('scanQr').addEventListener('click',startScanner);
document.getElementById('closeScanner').addEventListener('click',stopScanner);
scannerDialog.addEventListener('cancel',e=>{e.preventDefault();stopScanner();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&scannerActive)stopScanner();});
if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js?v=20260826-ui8');
      reg.update().catch(()=>{});
    }catch(e){}
  });
}
(async()=>{try{loadProtectedState();await migrateLegacyState();await getDeviceWrapKey();await render();}catch(e){toast.textContent='ERRORE ARCHIVIO SICURO LOCALE';toast.hidden=false;console.error(e);}})();



window.addEventListener('load',()=>{
  const splash=document.getElementById('splashScreen');
  if(!splash)return;
  setTimeout(()=>{splash.classList.add('splash-hide');setTimeout(()=>splash.remove(),750);},2000);
});

/* Portrait-only PWA. Manifest is the primary lock; API is an additional attempt where supported. */
async function lockPortrait(){
  try{
    if(screen.orientation && screen.orientation.lock){
      await screen.orientation.lock('portrait');
    }
  }catch(e){}
}
window.addEventListener('load',lockPortrait);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)lockPortrait();});
