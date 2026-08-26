# ALBUM DIGITALE — MASTER v3 OFFLINE DI PROGETTO

**Master:** 2026-08-26 v1  
**Regola:** da questa build in avanti NON usare più i vecchi ZIP `WORK_TRANSFER`, `SPLASH_FIXED` o `SPLASH_GALLERY_FIXED` come base. Ogni modifica futura deve partire da questo MASTER.

## Stato consolidato
- PWA mobile-first per GitHub Pages / Patreon.
- 20 slot prototipo, 2 card per riga, scroll verticale.
- Numerazione #001–#020.
- Variant `V`, Special `◆` provvisorio.
- Card complete cifrate AES-256-GCM in `cards_enc/`.
- Preview degradate WebP in `previews/`.
- Sblocco e chiavi salvati localmente per uso offline.
- Reveal sequenziale fino a 5 card con pulsante SALTA.
- Gallery full-screen, swipe orizzontale, snap, X, card centrata in altezza.
- Fondo gallery adattivo al contenuto della card.
- Orientamento impostato portrait nel manifest + tentativo Screen Orientation API.

## QR — produzione
- Scanner QR reale reintegrato: pulsante `LEGGI QR` nella topbar, fotocamera posteriore, mirino fullscreen, chiusura automatica al riconoscimento e passaggio del payload al decoder `AD1`.
- Implementazione scanner: `BarcodeDetector` + `getUserMedia`; richiede HTTPS/PWA e permesso fotocamera.
- **RIMOSSI definitivamente:** pulsante `TEST QR`, dialog test, QR A/B incorporati, RESET DEMO.
- L'app conserva il decoder del payload `AD1.` e il meccanismo reale di sblocco.
- Ingresso QR supportato dal MASTER tramite URL:
  - `?qr=AD1....`
  - `#qr=AD1....`
  - `#AD1....`
- Dopo aver letto il payload, l'URL viene ripulito con `history.replaceState`.
- I QR già usati sul dispositivo restano registrati in localStorage.
- Nota sicurezza: questa build recuperata usa ancora il formato AD1 con ID+chiavi. La firma crittografica del QR NON era presente nei file di base recuperati; non viene dichiarata come implementata finché non viene reintegrata con chiave pubblica verificabile.

## Splash
- `splash.png` va nella ROOT, allo stesso livello di `index.html`.
- Splash custom visibile a ogni avvio per 3 s + fade.
- Immagine realmente edge-to-edge: `width:100%`, `height:100%`, `object-fit:cover`, nessun padding.
- `splash.png` è precaricata.
- **Rimosso il fallback all'icona**: se `splash.png` manca, si vede solo il fondo scuro, mai `icon-512.png` come splash HTML.
- Limite PWA: Android/Chrome può mostrare una schermata nativa con icona PRIMA dell'HTML. Non è eliminabile dal codice della pagina. Il manifest usa `display: fullscreen` e colori coerenti per minimizzare il passaggio.

## Gallery
- Dialog forzato a `100vw × 100dvh`, evitando il bug della “linea”.
- Track centrale con altezza definita, card centrata verticalmente.
- Swipe orizzontale + `scroll-snap`.
- Card gallery con rapporto 2:3 e `object-fit: contain` per non tagliare l'immagine.
- Fondo gallery adattivo calcolato dalla card corrente con transizione morbida.

## Cache / preview
- Service Worker: `album-digitale-master-2026-08-26-v1`.
- HTML/CSS/JS/manifest/preview WebP: strategia network-first/no-store, con fallback cache offline.
- `.card`: cache-first dopo pre-cache.
- Registrazione SW con `updateViaCache:'none'` e reload singolo su nuovo controller.
- Obiettivo: impedire il ritorno delle vecchie preview WebP dopo aggiornamenti GitHub.

## File principali
- `index.html` — struttura UI.
- `style.css` — album, splash, gallery.
- `app.js` — cifratura, stato, reveal, gallery, scanner QR fotocamera + QR da URL, adaptive background.
- `sw.js` — cache/versioning.
- `manifest.webmanifest` — PWA fullscreen + portrait.
- `splash.png` — grafica splash da aggiungere in root (non inclusa nel MASTER se non fornita).
- `previews/` — 001.webp…020.webp.
- `cards_enc/` — 001.card…020.card.

## Regole per modifiche future
1. Partire sempre dal MASTER più recente.
2. Aggiornare `WORK_HANDOFF.md` nella stessa build.
3. Cambiare sempre il nome CACHE nel service worker per una release pubblicata.
4. Non reintrodurre strumenti demo/test nell'interfaccia pubblica.
5. Non inserire chiavi private o generatori QR nell'app pubblicata.
6. Prima di consegnare: controllare sintassi JS, riferimenti file, presenza di stringhe `TEST QR`, `QR A`, `QR B`, `RESET DEMO` e regressioni gallery/splash.


## OFFLINE / PWA installata — MASTER v3
- Dopo la prima installazione completa, l’album deve funzionare senza collegamento a GitHub.
- Service Worker impostato `offline-first`: HTML, CSS, JS, manifest, icone, preview e `.card` vengono precaricati localmente.
- `splash.png`, se presente nella root al momento dell’installazione/aggiornamento, viene memorizzata offline senza rendere fallita l’installazione se manca.
- Lo scanner QR usa `getUserMedia` + `BarcodeDetector` locali del browser/Android: non usa CDN né servizi GitHub durante la scansione.
- La fotocamera continua a richiedere il permesso del sistema anche quando la PWA è offline.
- GitHub resta necessario soltanto per installare o ricevere nuove versioni della PWA, non per l’uso quotidiano già installato.


## MASTER v4 — user-facing language + splash
- Tutte le diciture visibili nell’app sono ora in inglese, inclusi pulsanti, scanner QR, stato collezione, gallery, reveal, toast/errori, `aria-label`, titolo pagina e nome PWA nel manifest.
- Splash: durata 3 secondi prima dell’avvio del fade.
- Copyright sovrapposto in bianco verso il fondo: `© TOTISMAGISTIS/STRANGE MATTER COMICS`, piccolo e poco invasivo.
- Il copyright appartiene al contenitore splash e sfuma insieme alla splash; ha anche una propria transizione di opacità sincronizzata.
- Cache Service Worker aggiornata a `album-digitale-master-2026-08-27-v4-english-splash`.
- Questa v4 sostituisce la v3 come base MASTER ufficiale.


## MASTER v5 — QR compatibility fix
- QR scanner now normalizes scanned content before decoding.
- Supported scanned forms: raw `AD1...`, URL with `?qr=AD1...`, URL/hash with `#qr=AD1...`, direct `#AD1...`, and text containing an `AD1...` payload.
- This fixes the case where the camera successfully reads a QR but the album does not unlock cards because the scanned value is a full URL rather than a bare payload.

## MASTER v6 — QR Base64 decoder fix
- The QR normalizer now extracts only the `AD1.<payload>` segment before Base64 decoding, excluding URL suffixes, punctuation and any additional dot-separated segment.
- Base64URL validation and padding are handled before `atob()`; native browser exceptions are no longer shown to the user.
- Malformed QR codes now produce the controlled message `INVALID QR CODE`.
- AES card keys are validated as 32-byte Base64URL values before they are saved.
- Service Worker cache updated to `album-digitale-master-2026-08-27-v6-qr-decoder-fix` so installed PWAs receive the corrected `app.js`.
