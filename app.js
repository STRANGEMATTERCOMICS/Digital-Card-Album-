const splashScreen=document.getElementById('splashScreen');
const splashImage=document.getElementById('splashImage');
if(splashImage){splashImage.addEventListener('error',()=>splashImage.classList.add('is-missing'),{once:true});}
function dismissSplash(){
  if(!splashScreen)return;
  splashScreen.classList.add('is-hiding');
  document.body.classList.remove('splash-active');
  window.setTimeout(()=>splashScreen.remove(),500);
}
window.setTimeout(dismissSplash,3000);

/* Blocca il portrait quando l'API è disponibile. Il manifest imposta comunque orientation: portrait. */
async function lockPortrait(){try{if(screen.orientation?.lock)await screen.orientation.lock('portrait');}catch(e){}}
window.addEventListener('load',lockPortrait,{once:true});

const APP_VERSION='13.0.0';
const APP_BUILD=13;
const CARD_CATALOG_URL='./cards.json';
const VERSION_URL='./version.json';
const STORAGE_KEY='album-digitale-encrypted-v1';
const QR_PUBLIC_KEY_URL='./qr_public_key.json';
const ALLOW_LEGACY_QR=true;
let cards=[];
const cardsById=new Map();
async function loadCardCatalog(){
  const response=await fetch(CARD_CATALOG_URL,{cache:'no-store'});
  if(!response.ok)throw new Error('Card catalog unavailable');
  const data=await response.json();
  if(!Array.isArray(data?.cards)||!data.cards.length)throw new Error('Invalid card catalog');
  const seen=new Set();
  const parsed=data.cards.map(item=>{
    const id=Number(item?.id);
    if(!Number.isInteger(id)||id<1||id>9999||seen.has(id)||typeof item.enc!=='string'||typeof item.preview!=='string')throw new Error('Invalid card catalog');
    seen.add(id);
    return {id,type:typeof item.type==='string'?item.type:'',enc:item.enc,preview:item.preview};
  }).sort((a,b)=>a.id-b.id);
  cards=parsed;cardsById.clear();for(const card of cards)cardsById.set(card.id,card);
}
function cardById(id){return cardsById.get(Number(id))||null;}
const state=loadState();
const decryptedUrls=new Map();
const grid=document.getElementById('albumGrid');
const ownedCount=document.getElementById('ownedCount');
const totalCount=document.getElementById('totalCount');
const gallery=document.getElementById('gallery');
const galleryTrack=document.getElementById('galleryTrack');
const galleryMeta=document.getElementById('galleryMeta');
const galleryPosition=document.getElementById('galleryPosition');
const revealBar=document.getElementById('revealBar');
const revealText=document.getElementById('revealText');
const revealCard=document.getElementById('revealCard');
const revealPreviewImage=document.getElementById('revealPreviewImage');
const revealFullImage=document.getElementById('revealFullImage');
const toast=document.getElementById('toast');
const scanQrButton=document.getElementById('scanQr');
const qrScanner=document.getElementById('qrScanner');
const closeQrScannerButton=document.getElementById('closeQrScanner');
const qrVideo=document.getElementById('qrVideo');
const qrStatus=document.getElementById('qrStatus');
let galleryIndex=0,revealCancelled=false,revealRunning=false,galleryScrollTimer=null;
let galleryPinchCard=null,galleryPinchStartDistance=0,galleryPinchScale=1,galleryPinchStartCenter=null,galleryPinchX=0,galleryPinchY=0,galleryPinchBaseWidth=0,galleryPinchBaseHeight=0;
let qrStream=null,qrDetector=null,qrScanning=false,qrFrameHandle=null;
let qrPublicKeyPromise=null;
const REVEAL_DURATION=2600;
let toastTimer=null;
function hideToast(){
  if(!toast)return;
  clearTimeout(toastTimer);toastTimer=null;
  toast.classList.remove('is-visible');
  window.setTimeout(()=>{if(!toast.classList.contains('is-visible'))toast.hidden=true;},180);
}
function showToast(message,duration=2600){
  if(!toast||!message)return;
  clearTimeout(toastTimer);
  toast.textContent=message;toast.hidden=false;
  requestAnimationFrame(()=>toast.classList.add('is-visible'));
  toastTimer=window.setTimeout(hideToast,duration);
}

function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const p=JSON.parse(raw);return {keys:p.keys||{},usedQr:new Set(p.usedQr||[])};}}catch(e){}return {keys:{},usedQr:new Set()};}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify({keys:state.keys,usedQr:[...state.usedQr]}));}
function pad(n){return String(n).padStart(3,'0')}
function isUnlocked(id){return typeof state.keys[id]==='string'&&/^[A-Za-z0-9_-]{43}$/.test(state.keys[id])}
function b64uToBytes(value){
  if(typeof value!=='string')throw new Error('Invalid Base64 data');
  let s=value.trim().replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/');
  if(!s||!/^[A-Za-z0-9+/]*={0,2}$/.test(s)||s.length%4===1)throw new Error('Invalid Base64 data');
  s=s.replace(/=+$/,'');
  while(s.length%4)s+='=';
  try{
    const raw=atob(s);
    return Uint8Array.from(raw,c=>c.charCodeAt(0));
  }catch(e){throw new Error('Invalid Base64 data');}
}
function normalizeQrText(text){
  if(typeof text!=='string')return '';
  let value=text.trim();
  try{value=decodeURIComponent(value);}catch(e){}
  try{
    const u=new URL(value,location.href);
    const q=u.searchParams.get('qr');
    if(q)value=q;
    const h=u.hash.replace(/^#/,'');
    if(h.startsWith('qr='))value=decodeURIComponent(h.slice(3));
    else if(h.startsWith('AD1.'))value=decodeURIComponent(h);
  }catch(e){}
  const match=value.match(/AD1\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?/);
  return match?match[0]:'';
}
async function loadQrPublicKey(){
  if(!qrPublicKeyPromise){
    qrPublicKeyPromise=(async()=>{
      const response=await fetch(QR_PUBLIC_KEY_URL,{cache:'no-store'});
      if(!response.ok)throw new Error('QR verification key unavailable');
      const jwk=await response.json();
      if(jwk?.kty!=='EC'||jwk?.crv!=='P-256'||typeof jwk.x!=='string'||typeof jwk.y!=='string')throw new Error('Invalid QR verification key');
      return crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    })().catch(error=>{qrPublicKeyPromise=null;throw error;});
  }
  return qrPublicKeyPromise;
}
async function verifyQrSignature(payloadText,signatureText){
  if(!/^[A-Za-z0-9_-]{86}$/.test(signatureText))return false;
  const publicKey=await loadQrPublicKey();
  return crypto.subtle.verify(
    {name:'ECDSA',hash:'SHA-256'},
    publicKey,
    b64uToBytes(signatureText),
    new TextEncoder().encode(`AD1.${payloadText}`)
  );
}
async function decodePayload(text){
  const value=normalizeQrText(text);
  if(!value)throw new Error('QR code not recognized');
  const parts=value.split('.');
  if(parts.length<2||parts.length>3||parts[0]!=='AD1')throw new Error('Invalid QR code');
  const payloadText=parts[1],signature=parts[2]||'';
  let p;
  try{
    const raw=new TextDecoder('utf-8',{fatal:true}).decode(b64uToBytes(payloadText));
    p=JSON.parse(raw);
  }catch(e){throw new Error('Invalid QR code');}
  let packId='';
  if(p.v===2){
    if(parts.length!==3)throw new Error('Signed QR code required');
    let verified=false;
    try{verified=await verifyQrSignature(payloadText,signature);}catch(e){throw new Error('QR verification unavailable');}
    if(!verified)throw new Error('Invalid QR signature');
    packId=typeof p.pack==='string'?p.pack.trim():'';
  }else if(p.v===1&&ALLOW_LEGACY_QR){
    if(signature&&!/^[A-Za-z0-9_-]{80,96}$/.test(signature))throw new Error('Invalid legacy QR identifier');
    packId=typeof p.pack==='string'&&p.pack.trim()?p.pack.trim():signature;
  }else{
    throw new Error('Unsigned QR code not accepted');
  }
  if(!/^[A-Za-z0-9_-]{8,128}$/.test(packId)||!Array.isArray(p.cards)||p.cards.length<1||p.cards.length>5)throw new Error('Invalid QR payload');
  const ids=new Set();
  for(const item of p.cards){
    if(!Number.isInteger(item.id)||!cardById(item.id)||ids.has(item.id)||typeof item.k!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(item.k))throw new Error('Invalid QR card');
    ids.add(item.id);
  }
  p.pack=packId;
  return p;
}
async function decryptCard(id,keyText){const cached=decryptedUrls.get(id);if(cached?.key===keyText)return cached.url;const c=cardById(id);if(!c)throw new Error('Unknown card');const packed=new Uint8Array(await (await fetch(c.enc,{cache:'no-store'})).arrayBuffer());if(packed.length<29)throw new Error('Invalid encrypted file');const iv=packed.slice(0,12),cipher=packed.slice(12);const key=await crypto.subtle.importKey('raw',b64uToBytes(keyText),{name:'AES-GCM'},false,['decrypt']);const aad=new TextEncoder().encode(`ALBUMDIGITALE:CARD:${pad(id)}`);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},key,cipher);const url=URL.createObjectURL(new Blob([plain],{type:'image/webp'}));decryptedUrls.set(id,{key:keyText,url});return url;}
async function imageFor(c){if(!isUnlocked(c.id))return c.preview;try{return await decryptCard(c.id,state.keys[c.id]);}catch(e){return c.preview;}}

async function render(){
  grid.innerHTML='';
  for(let i=0;i<cards.length;i++){
    const c=cards[i],unlocked=isUnlocked(c.id);
    const slot=document.createElement('article');slot.className='slot'+(unlocked?'':' locked');slot.dataset.id=c.id;
    const btn=document.createElement('button');btn.type='button';btn.className='card-button';btn.disabled=!unlocked;btn.setAttribute('aria-label',`Card ${pad(c.id)}${c.type?' '+c.type:''}${unlocked?'':' locked'}`);
    const src=await imageFor(c);
    btn.innerHTML=`<div class="card-frame"><img class="card-image" src="${src}" alt="Card ${pad(c.id)}"><div class="shade"></div></div><div class="slot-meta"><span>#${pad(c.id)}</span><span>${c.type}</span></div>`;
    btn.addEventListener('click',()=>openGallery(i));slot.appendChild(btn);grid.appendChild(slot);
  }
  ownedCount.textContent=cards.filter(c=>isUnlocked(c.id)).length;
  totalCount.textContent=cards.length;
}

async function buildGallery(){
  galleryTrack.innerHTML='';
  for(let i=0;i<cards.length;i++){
    const c=cards[i],locked=!isUnlocked(c.id),src=await imageFor(c);
    const slide=document.createElement('article');slide.className='gallery-slide';slide.dataset.index=String(i);
    slide.innerHTML=`<div class="gallery-card${locked?' locked':''}"><img class="card-image" src="${src}" alt="Card ${pad(c.id)}"><div class="shade"></div></div>`;
    const galleryCard=slide.querySelector('.gallery-card');if(galleryCard)installGalleryPinch(galleryCard);
    galleryTrack.appendChild(slide);
  }
}

function clampByte(n){return Math.max(0,Math.min(255,Math.round(n)))}
function adaptiveColorFromImage(img){
  try{
    const canvas=document.createElement('canvas');canvas.width=18;canvas.height=27;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let r=0,g=0,b=0,n=0;
    for(let i=0;i<data.length;i+=16){if(data[i+3]<80)continue;r+=data[i];g+=data[i+1];b+=data[i+2];n++;}
    if(!n)return '#090b0d';r/=n;g/=n;b/=n;
    const lum=.2126*r+.7152*g+.0722*b;
    const scale=lum>0?Math.min(.34,42/lum):.22;
    return `rgb(${clampByte(r*scale)},${clampByte(g*scale)},${clampByte(b*scale)})`;
  }catch(e){return '#090b0d';}
}
function updateAdaptiveGallery(i){
  const img=galleryTrack.children[i]?.querySelector('img');
  if(!img){gallery.style.setProperty('--gallery-bg','#090b0d');return;}
  const apply=()=>gallery.style.setProperty('--gallery-bg',adaptiveColorFromImage(img));
  if(img.complete&&img.naturalWidth)apply();else img.addEventListener('load',apply,{once:true});
}

function updateGalleryMeta(i){
  galleryIndex=Math.max(0,Math.min(cards.length-1,i));
  const c=cards[galleryIndex],locked=!isUnlocked(c.id);
  galleryPosition.textContent=`${galleryIndex+1} / ${cards.length}`;
  galleryMeta.textContent=`#${pad(c.id)}${c.type?'  '+c.type:''}${locked?'  ·  LOCKED':''}`;
  updateAdaptiveGallery(galleryIndex);
}

function scrollGalleryTo(i,behavior='auto'){
  const slide=galleryTrack.children[i];if(!slide)return;
  slide.scrollIntoView({behavior,block:'nearest',inline:'center'});
  updateGalleryMeta(i);
}


function touchDistance(touches){
  if(!touches||touches.length<2)return 0;
  const dx=touches[0].clientX-touches[1].clientX;
  const dy=touches[0].clientY-touches[1].clientY;
  return Math.hypot(dx,dy);
}
function touchCenter(touches){
  if(!touches||touches.length<2)return null;
  return {x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2};
}
function resetGalleryPinch(card=galleryPinchCard){
  if(!card)return;
  card.classList.remove('is-pinching');
  card.style.transform='translate3d(0,0,0) scale(1)';
  if(card===galleryPinchCard){
    galleryPinchCard=null;galleryPinchStartDistance=0;galleryPinchScale=1;galleryPinchStartCenter=null;galleryPinchX=0;galleryPinchY=0;galleryPinchBaseWidth=0;galleryPinchBaseHeight=0;
  }
}
function installGalleryPinch(card){
  card.addEventListener('touchstart',e=>{
    if(e.touches.length!==2)return;
    if(galleryPinchCard&&galleryPinchCard!==card)resetGalleryPinch(galleryPinchCard);
    galleryPinchCard=card;
    galleryPinchStartDistance=touchDistance(e.touches);
    galleryPinchStartCenter=touchCenter(e.touches);
    galleryPinchScale=1;galleryPinchX=0;galleryPinchY=0;
    const baseRect=card.getBoundingClientRect();galleryPinchBaseWidth=baseRect.width;galleryPinchBaseHeight=baseRect.height;
    card.classList.add('is-pinching');
    e.preventDefault();
  },{passive:false});
  card.addEventListener('touchmove',e=>{
    if(card!==galleryPinchCard||e.touches.length!==2||galleryPinchStartDistance<=0||!galleryPinchStartCenter)return;
    const distance=touchDistance(e.touches);
    const center=touchCenter(e.touches);
    galleryPinchScale=Math.max(1,Math.min(2,distance/galleryPinchStartDistance));
    const maxX=Math.max(0,galleryPinchBaseWidth*(galleryPinchScale-1)/2);
    const maxY=Math.max(0,galleryPinchBaseHeight*(galleryPinchScale-1)/2);
    galleryPinchX=Math.max(-maxX,Math.min(maxX,center.x-galleryPinchStartCenter.x));
    galleryPinchY=Math.max(-maxY,Math.min(maxY,center.y-galleryPinchStartCenter.y));
    card.style.transform=`translate3d(${galleryPinchX}px,${galleryPinchY}px,0) scale(${galleryPinchScale})`;
    e.preventDefault();
  },{passive:false});
  const finish=e=>{
    if(card!==galleryPinchCard)return;
    if(e.touches&&e.touches.length>=2)return;
    resetGalleryPinch(card);
  };
  card.addEventListener('touchend',finish,{passive:true});
  card.addEventListener('touchcancel',finish,{passive:true});
}

async function openGallery(i){
  galleryIndex=i;await buildGallery();updateGalleryMeta(i);gallery.showModal();
  requestAnimationFrame(()=>requestAnimationFrame(()=>scrollGalleryTo(i,'auto')));
}

document.getElementById('closeGallery').addEventListener('click',()=>{resetGalleryPinch();gallery.close();});
gallery.addEventListener('close',()=>resetGalleryPinch());

galleryTrack.addEventListener('scroll',()=>{
  clearTimeout(galleryScrollTimer);
  galleryScrollTimer=setTimeout(()=>{
    const center=galleryTrack.scrollLeft+galleryTrack.clientWidth/2;
    let best=0,bestDist=Infinity;
    Array.from(galleryTrack.children).forEach((slide,i)=>{const slideCenter=slide.offsetLeft+slide.offsetWidth/2;const d=Math.abs(slideCenter-center);if(d<bestDist){bestDist=d;best=i;}});
    updateGalleryMeta(best);
  },70);
},{passive:true});

galleryTrack.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'&&galleryIndex<cards.length-1){e.preventDefault();scrollGalleryTo(galleryIndex+1,'smooth');}
  if(e.key==='ArrowLeft'&&galleryIndex>0){e.preventDefault();scrollGalleryTo(galleryIndex-1,'smooth');}
});

const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function waitForReveal(ms){
  const end=performance.now()+ms;
  while(!revealCancelled&&performance.now()<end)await wait(Math.min(50,Math.max(0,end-performance.now())));
}
async function loadRevealImage(img,src){
  img.src=src;
  if(typeof img.decode==='function'){try{await img.decode();return;}catch(e){}}
  if(img.complete&&img.naturalWidth)return;
  await new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true});});
}
async function playCardReveal(id){
  revealCard.classList.remove('is-running');
  const revealCatalogCard=cardById(id);if(!revealCatalogCard)throw new Error('Unknown card');
  revealText.textContent=`REVEAL #${pad(id)}${revealCatalogCard.type?' '+revealCatalogCard.type:''}`;
  await loadRevealImage(revealPreviewImage,revealCatalogCard.preview);
  const fullSrc=await decryptCard(id,state.keys[id]);
  await loadRevealImage(revealFullImage,fullSrc);
  if(revealCancelled)return;
  void revealCard.offsetWidth;
  revealCard.classList.add('is-running');
  const duration=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?100:REVEAL_DURATION;
  await waitForReveal(duration);
}
async function importQr(text){
  if(revealRunning)return;
  let p;try{p=await decodePayload(text);}catch(e){showToast(e.message);return;}
  if(state.usedQr.has(p.pack)){showToast('QR CODE ALREADY USED ON THIS DEVICE');return;}
  try{
    for(const item of p.cards)await decryptCard(item.id,item.k);
  }catch(e){showToast('QR CARD KEY MISMATCH');return;}
  const targets=[];
  for(const item of p.cards){if(!isUnlocked(item.id))targets.push(item.id);state.keys[item.id]=item.k;}
  state.usedQr.add(p.pack);saveState();
  if(!targets.length){showToast('NO NEW CARDS');await render();return;}
  revealRunning=true;revealCancelled=false;hideToast();revealCard.classList.remove('is-running');revealBar.hidden=false;document.body.classList.add('reveal-active');ownedCount.textContent=cards.filter(c=>isUnlocked(c.id)).length;
  for(const id of targets){
    if(revealCancelled)break;
    try{await playCardReveal(id);}catch(e){showToast(`DECRYPTION ERROR #${pad(id)}`);break;}
    if(!revealCancelled)await waitForReveal(180);
  }
  revealCard.classList.remove('is-running');revealBar.hidden=true;document.body.classList.remove('reveal-active');await render();revealRunning=false;showToast(`${targets.length} NEW CARDS UNLOCKED`);
}

document.getElementById('skipReveal').addEventListener('click',()=>{revealCancelled=true;revealCard.classList.remove('is-running');revealBar.hidden=true;document.body.classList.remove('reveal-active');});


/* Scanner QR reale tramite fotocamera posteriore. Nessun payload demo incorporato. */
function stopQrScanner(){
  qrScanning=false;
  if(qrFrameHandle){cancelAnimationFrame(qrFrameHandle);qrFrameHandle=null;}
  if(qrVideo){try{qrVideo.pause();}catch(e){}qrVideo.srcObject=null;}
  if(qrStream){for(const track of qrStream.getTracks())track.stop();qrStream=null;}
  if(qrScanner?.open)qrScanner.close();
}

async function scanQrFrame(){
  if(!qrScanning||!qrDetector||!qrVideo)return;
  try{
    if(qrVideo.readyState>=2){
      const results=await qrDetector.detect(qrVideo);
      const value=results?.[0]?.rawValue?.trim();
      if(value){
        qrStatus.textContent='QR CODE DETECTED';
        stopQrScanner();
        await importQr(value);
        return;
      }
    }
  }catch(e){}
  if(qrScanning)qrFrameHandle=requestAnimationFrame(scanQrFrame);
}

async function openQrScanner(){
  if(revealRunning)return;
  hideToast();
  if(!('BarcodeDetector' in window)){
    showToast('QR SCANNING IS NOT SUPPORTED BY THIS BROWSER');
    return;
  }
  if(!navigator.mediaDevices?.getUserMedia){
    showToast('CAMERA NOT AVAILABLE');
    return;
  }
  try{
    const formats=await BarcodeDetector.getSupportedFormats?.();
    if(Array.isArray(formats)&&!formats.includes('qr_code'))throw new Error('qr-not-supported');
    qrDetector=new BarcodeDetector({formats:['qr_code']});
    qrStatus.textContent='STARTING CAMERA…';
    qrScanner.showModal();
    qrStream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:1280}}});
    qrVideo.srcObject=qrStream;
    await qrVideo.play();
    qrStatus.textContent='FRAME THE QR CODE INSIDE THE BOX';
    qrScanning=true;
    qrFrameHandle=requestAnimationFrame(scanQrFrame);
  }catch(e){
    stopQrScanner();
    showToast(e?.name==='NotAllowedError'?'CAMERA PERMISSION DENIED':'UNABLE TO START QR SCANNER');
  }
}

scanQrButton?.addEventListener('click',openQrScanner);
closeQrScannerButton?.addEventListener('click',stopQrScanner);
qrScanner?.addEventListener('cancel',e=>{e.preventDefault();stopQrScanner();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&qrScanning)stopQrScanner();});

/* Ingresso QR di produzione: il QR può aprire la PWA con ?qr=AD1... oppure #qr=AD1... / #AD1... . Nessun QR demo è incorporato. */
function qrFromLocation(){
  const qs=new URLSearchParams(location.search);const q=qs.get('qr');if(q)return q;
  const h=location.hash.replace(/^#/,'');if(!h)return null;
  if(h.startsWith('qr='))return decodeURIComponent(h.slice(3));
  if(h.startsWith('AD1.'))return decodeURIComponent(h);
  return null;
}
async function consumeQrFromLocation(){
  const q=qrFromLocation();if(!q)return;
  try{history.replaceState(null,'',location.pathname); }catch(e){}
  await importQr(q);
}

let swRegistration=null;
let pendingRemoteVersion=null;
const openMenuButton=document.getElementById('openMenu');
const closeMenuButton=document.getElementById('closeMenu');
const sideMenu=document.getElementById('sideMenu');
const menuBackdrop=document.getElementById('menuBackdrop');
const refreshAlbumButton=document.getElementById('refreshAlbum');
const checkUpdateButton=document.getElementById('checkUpdate');
const openAboutButton=document.getElementById('openAbout');
const aboutDialog=document.getElementById('aboutDialog');
const closeAboutButton=document.getElementById('closeAbout');
const updateDialog=document.getElementById('updateDialog');
const updateTitle=document.getElementById('updateTitle');
const updateMessage=document.getElementById('updateMessage');
const updateNowButton=document.getElementById('updateNow');
const updateLaterButton=document.getElementById('updateLater');
document.getElementById('appVersion').textContent=APP_VERSION;
document.getElementById('aboutVersion').textContent=APP_VERSION;
function setMenu(open){sideMenu.classList.toggle('is-open',open);sideMenu.setAttribute('aria-hidden',String(!open));menuBackdrop.hidden=!open;}
openMenuButton?.addEventListener('click',()=>setMenu(true));
closeMenuButton?.addEventListener('click',()=>setMenu(false));
menuBackdrop?.addEventListener('click',()=>setMenu(false));
openAboutButton?.addEventListener('click',()=>{setMenu(false);aboutDialog.showModal();});
closeAboutButton?.addEventListener('click',()=>aboutDialog.close());
aboutDialog?.addEventListener('cancel',e=>{e.preventDefault();aboutDialog.close();});
updateLaterButton?.addEventListener('click',()=>updateDialog.close());

async function refreshAlbum(){
  setMenu(false);
  refreshAlbumButton.disabled=true;
  const previousText=refreshAlbumButton.textContent;
  refreshAlbumButton.textContent='REFRESHING…';
  hideToast();
  try{
    if(qrScanning)stopQrScanner();
    if(gallery?.open){resetGalleryPinch();gallery.close();}
    const freshState=loadState();
    state.keys=freshState.keys;
    state.usedQr=freshState.usedQr;
    await loadCardCatalog();
    await render();
    showToast('ALBUM REFRESHED');
  }catch(e){
    showToast('REFRESH FAILED');
  }finally{
    refreshAlbumButton.disabled=false;
    refreshAlbumButton.textContent=previousText;
  }
}
refreshAlbumButton?.addEventListener('click',refreshAlbum);

async function fetchRemoteVersion(){
  const response=await fetch(`${VERSION_URL}?check=${Date.now()}`,{cache:'no-store'});
  if(!response.ok)throw new Error('Update server unavailable');
  const data=await response.json();
  if(!Number.isInteger(data?.build)||typeof data.version!=='string')throw new Error('Invalid update information');
  return data;
}
function showUpdateState(title,message,canUpdate=false){
  updateTitle.textContent=title;updateMessage.textContent=message;updateNowButton.hidden=!canUpdate;
  if(!updateDialog.open)updateDialog.showModal();
}
async function checkForUpdate({silent=false}={}){
  try{
    const remote=await fetchRemoteVersion();pendingRemoteVersion=remote;
    if(remote.build>APP_BUILD){
      showUpdateState(`VERSION ${remote.version} AVAILABLE`,remote.notes||'A new version of Digital Album is available.',true);
      return true;
    }
    if(!silent)showUpdateState('UP TO DATE',`Digital Album ${APP_VERSION} is the latest version.`,false);
    return false;
  }catch(e){
    if(!silent)showUpdateState('OFFLINE / UNAVAILABLE','Unable to check for updates. The album can continue to work offline.',false);
    return false;
  }
}
async function activateWaitingWorker(reg){
  if(reg?.waiting){reg.waiting.postMessage({type:'SKIP_WAITING'});return true;}
  return false;
}
async function installAvailableUpdate(){
  updateNowButton.disabled=true;updateLaterButton.disabled=true;updateTitle.textContent='UPDATING…';updateMessage.textContent='Downloading the new version. Your unlocked cards will be preserved.';
  try{
    const reg=swRegistration||await navigator.serviceWorker.getRegistration();
    if(!reg)throw new Error('Service Worker unavailable');
    await reg.update();
    if(await activateWaitingWorker(reg))return;
    const worker=reg.installing;
    if(worker){
      await new Promise((resolve,reject)=>{
        const done=()=>{if(worker.state==='installed')resolve();else if(worker.state==='redundant')reject(new Error('Update failed'));};
        worker.addEventListener('statechange',done);done();
      });
      if(await activateWaitingWorker(reg))return;
    }
    const newest=await fetchRemoteVersion();
    if(newest.build>APP_BUILD)throw new Error('New Service Worker not ready');
    location.reload();
  }catch(e){
    updateTitle.textContent='UPDATE FAILED';updateMessage.textContent='The update could not be installed. Try again when the connection is stable.';updateNowButton.disabled=false;updateLaterButton.disabled=false;
  }
}
checkUpdateButton?.addEventListener('click',()=>{setMenu(false);checkForUpdate({silent:false});});
updateNowButton?.addEventListener('click',installAvailableUpdate);

if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      swRegistration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
      navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
      window.setTimeout(()=>checkForUpdate({silent:true}),3800);
    }catch(e){}
  });
}

(async()=>{
  try{await loadCardCatalog();await render();await consumeQrFromLocation();}
  catch(e){showToast(e.message||'Unable to load album',3600);}
})();
