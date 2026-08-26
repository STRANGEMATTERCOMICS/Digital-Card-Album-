# ALBUM DIGITALE — MASTER DI PROGETTO

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
- Splash custom visibile a ogni avvio per 2 s + fade.
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
- `app.js` — cifratura, stato, reveal, gallery, QR da URL, adaptive background.
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
