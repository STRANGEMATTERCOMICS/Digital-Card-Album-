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

const TYPE_MAP={3:'V',7:'◆',11:'V',14:'◆',18:'V'};
const STORAGE_KEY='album-digitale-encrypted-v1';
const cards=Array.from({length:20},(_,i)=>({id:i+1,type:TYPE_MAP[i+1]||'',enc:`cards_enc/${String(i+1).padStart(3,'0')}.card`,preview:`previews/${String(i+1).padStart(3,'0')}.webp`}));
const state=loadState();
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
const scanQrButton=document.getElementById('scanQr');
const qrScanner=document.getElementById('qrScanner');
const closeQrScannerButton=document.getElementById('closeQrScanner');
const qrVideo=document.getElementById('qrVideo');
const qrStatus=document.getElementById('qrStatus');
let galleryIndex=0,revealCancelled=false,revealRunning=false,galleryScrollTimer=null;
let qrStream=null,qrDetector=null,qrScanning=false,qrFrameHandle=null;

function loadState(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const p=JSON.parse(raw);return {keys:p.keys||{},usedQr:new Set(p.usedQr||[])};}}catch(e){}return {keys:{},usedQr:new Set()};}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify({keys:state.keys,usedQr:[...state.usedQr]}));}
function pad(n){return String(n).padStart(3,'0')}
function isUnlocked(id){return typeof state.keys[id]==='string'&&state.keys[id].length>20}
function b64uToBytes(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0));}
function normalizeQrText(text){
  if(typeof text!=='string')return '';
  let value=text.trim();
  try{value=decodeURIComponent(value);}catch(e){}
  if(value.startsWith('AD1.'))return value;
  try{
    const u=new URL(value,location.href);
    const q=u.searchParams.get('qr');
    if(q&&q.startsWith('AD1.'))return q;
    const h=u.hash.replace(/^#/,'');
    if(h.startsWith('qr=')){const hv=decodeURIComponent(h.slice(3));if(hv.startsWith('AD1.'))return hv;}
    if(h.startsWith('AD1.'))return decodeURIComponent(h);
  }catch(e){}
  const match=value.match(/AD1\.[A-Za-z0-9_-]+/);
  return match?match[0]:value;
}
function decodePayload(text){const value=normalizeQrText(text);if(!value.startsWith('AD1.'))throw new Error('QR code not recognized');const raw=new TextDecoder().decode(b64uToBytes(value.slice(4)));const p=JSON.parse(raw);if(p.v!==1||typeof p.pack!=='string'||!Array.isArray(p.cards)||p.cards.length<1||p.cards.length>5)throw new Error('Invalid QR payload');for(const item of p.cards){if(!Number.isInteger(item.id)||item.id<1||item.id>20||typeof item.k!=='string')throw new Error('Invalid QR card');}return p;}
async function decryptCard(id,keyText){if(decryptedUrls.has(id))return decryptedUrls.get(id);const c=cards[id-1];const packed=new Uint8Array(await (await fetch(c.enc,{cache:'no-store'})).arrayBuffer());if(packed.length<29)throw new Error('Invalid encrypted file');const iv=packed.slice(0,12),cipher=packed.slice(12);const key=await crypto.subtle.importKey('raw',b64uToBytes(keyText),{name:'AES-GCM'},false,['decrypt']);const aad=new TextEncoder().encode(`ALBUMDIGITALE:CARD:${pad(id)}`);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad},key,cipher);const url=URL.createObjectURL(new Blob([plain],{type:'image/webp'}));decryptedUrls.set(id,url);return url;}
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
  ownedCount.textContent=Object.keys(state.keys).filter(k=>isUnlocked(Number(k))).length;
}

async function buildGallery(){
  galleryTrack.innerHTML='';
  for(let i=0;i<cards.length;i++){
    const c=cards[i],locked=!isUnlocked(c.id),src=await imageFor(c);
    const slide=document.createElement('article');slide.className='gallery-slide';slide.dataset.index=String(i);
    slide.innerHTML=`<div class="gallery-card${locked?' locked':''}"><img class="card-image" src="${src}" alt="Card ${pad(c.id)}"><div class="shade"></div></div>`;
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

async function openGallery(i){
  galleryIndex=i;await buildGallery();updateGalleryMeta(i);gallery.showModal();
  requestAnimationFrame(()=>requestAnimationFrame(()=>scrollGalleryTo(i,'auto')));
}

document.getElementById('closeGallery').addEventListener('click',()=>gallery.close());

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
async function importQr(text){
  if(revealRunning)return;
  let p;try{p=decodePayload(text);}catch(e){toast.textContent=e.message;toast.hidden=false;return;}
  if(state.usedQr.has(p.pack)){toast.textContent='QR CODE ALREADY USED ON THIS DEVICE';toast.hidden=false;return;}
  const targets=[];
  for(const item of p.cards){if(!isUnlocked(item.id))targets.push(item.id);state.keys[item.id]=item.k;}
  state.usedQr.add(p.pack);saveState();
  if(!targets.length){toast.textContent='NO NEW CARDS';toast.hidden=false;await render();return;}
  revealRunning=true;revealCancelled=false;toast.hidden=true;revealBar.hidden=false;ownedCount.textContent=Object.keys(state.keys).filter(k=>isUnlocked(Number(k))).length;
  for(const id of targets){
    if(revealCancelled)break;
    await render();const slot=grid.querySelector(`[data-id="${id}"]`);if(!slot)continue;
    slot.classList.add('locked');const img=slot.querySelector('.card-image');img.src=cards[id-1].preview;slot.scrollIntoView({behavior:'smooth',block:'center'});revealText.textContent=`REVEAL #${pad(id)}${cards[id-1].type?' '+cards[id-1].type:''}`;
    await wait(600);if(revealCancelled)break;
    try{img.src=await decryptCard(id,state.keys[id]);}catch(e){toast.textContent=`DECRYPTION ERROR #${pad(id)}`;toast.hidden=false;}
    slot.classList.remove('locked');slot.classList.add('revealing');await wait(800);if(revealCancelled)break;await wait(600);
  }
  await render();revealBar.hidden=true;revealRunning=false;toast.textContent=`${targets.length} NEW CARDS UNLOCKED`;toast.hidden=false;
}

document.getElementById('skipReveal').addEventListener('click',async()=>{revealCancelled=true;revealBar.hidden=true;revealRunning=false;await render();toast.textContent='CARDS UNLOCKED';toast.hidden=false;});


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
  toast.hidden=true;
  if(!('BarcodeDetector' in window)){
    toast.textContent='QR SCANNING IS NOT SUPPORTED BY THIS BROWSER';
    toast.hidden=false;
    return;
  }
  if(!navigator.mediaDevices?.getUserMedia){
    toast.textContent='CAMERA NOT AVAILABLE';
    toast.hidden=false;
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
    toast.textContent=e?.name==='NotAllowedError'?'CAMERA PERMISSION DENIED':'UNABLE TO START QR SCANNER';
    toast.hidden=false;
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

if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await reg.update();
      let refreshed=sessionStorage.getItem('album-sw-refreshed')==='1';
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!refreshed){refreshed=true;sessionStorage.setItem('album-sw-refreshed','1');location.reload();}});
    }catch(e){}
  });
}

render().then(consumeQrFromLocation);
