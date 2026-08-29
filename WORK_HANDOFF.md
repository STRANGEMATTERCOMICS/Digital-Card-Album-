# ALBUM DIGITALE — MASTER v13 REFRESH

**Master ufficiale:** 2026-08-29 v11 UPDATE READY  
**Base obbligatoria per ogni modifica futura:** `ALBUM_DIGITALE_MASTER_2026-08-29_v11_UPDATE_READY`  
**Regola:** non usare più vecchi pacchetti `WORK_TRANSFER`, `SPLASH_FIXED`, `SPLASH_GALLERY_FIXED` o precedenti MASTER come base. Ogni sviluppo deve partire da questa v11 o da una release successiva esplicitamente dichiarata MASTER.

## Stato consolidato della MASTER v13
- PWA mobile-first destinata a GitHub Pages e distribuzione tramite Patreon/link diretto.
- Catalogo card dinamico tramite `cards.json`; la release corrente contiene 20 slot, 2 card per riga, scroll verticale.
- Il numero di slot non è più hardcoded nell’interfaccia o nel validatore QR: nuove release possono aggiungere slot e asset aggiornando `cards.json`.
- Numerazione #001–#020.
- Supporto Variant `V` e Special `◆` provvisorio.
- Card complete cifrate AES-256-GCM in `cards_enc/`.
- Preview degradate WebP in `previews/`.
- Sblocchi, chiavi e stato collezione salvati localmente per uso offline.
- Reveal sequenziale fino a 5 card per QR, con pulsante `SKIP`.
- Gallery fullscreen con swipe orizzontale, scroll snap e card centrata verticalmente.
- Fondo gallery adattivo al contenuto della card.
- Orientamento portrait impostato nel manifest, con tentativo aggiuntivo via Screen Orientation API.
- Tutte le diciture visibili all'utente sono in inglese.

## QR — stato produzione v11
- Scanner QR reale presente nella topbar tramite pulsante `READ QR`.
- Scanner basato su `BarcodeDetector` + `getUserMedia`, con fotocamera posteriore, mirino fullscreen e chiusura automatica al riconoscimento.
- Richiede HTTPS/PWA e permesso fotocamera.
- Strumenti demo rimossi dall'interfaccia pubblica: nessun `TEST QR`, `QR A`, `QR B` o `RESET DEMO`.
- Formato produzione corrente: `AD1.<payload>.<signature>`.
- Payload firmato JSON v2 con:
  - `v:2`
  - identificatore casuale univoco `pack`
  - da 1 a 5 entry distinte `{id,k}`.
- Firma reale ECDSA P-256 / SHA-256 sul testo ASCII esatto `AD1.<payload>`.
- L'Album importa `qr_public_key.json` e rifiuta:
  - payload modificati;
  - firme non valide;
  - ID card duplicati;
  - chiavi AES malformate;
  - chiavi che non decifrano correttamente la `.card` associata (`QR CARD KEY MISMATCH`).
- Compatibilità legacy v1 ancora presente in modalità transitoria.
- Forme QR accettate dallo scanner/normalizzatore:
  - payload `AD1...` puro;
  - URL con `?qr=AD1...`;
  - URL/hash con `#qr=AD1...`;
  - `#AD1...`;
  - testo che contiene un payload `AD1...` valido.
- Il decoder Base64URL valida contenuto e padding prima di usare `atob()`; QR malformati producono il messaggio controllato `INVALID QR CODE`.
- Le chiavi card vengono validate come valori Base64URL da 32 byte prima del salvataggio.
- Dopo l'acquisizione del QR, l'URL viene ripulito con `history.replaceState`.
- I QR già usati sul dispositivo restano registrati localmente.
- La chiave privata di firma e i generatori privati NON devono essere caricati nel repository pubblico.

## Splash — stato v12
- `splash.png` è inclusa nella root, allo stesso livello di `index.html`.
- Splash custom mostrata a ogni avvio per 3 secondi prima del fade.
- Immagine edge-to-edge con `width:100%`, `height:100%`, `object-fit:cover`, senza padding.
- `splash.png` è precaricata.
- Nessun fallback alla normale icona PWA dentro la splash HTML.
- Copyright sovrapposto in bianco verso il fondo: `© TOTISMAGISTIS/STRANGE MATTER COMICS`.
- Copyright piccolo, discreto e sincronizzato con il fade della splash.
- Limite noto: Android/Chrome può mostrare una schermata nativa con icona prima dell'HTML. Questa schermata non è eliminabile dal codice della pagina.

## Gallery — stato v12
- Dialog fullscreen forzato a `100vw × 100dvh`.
- Track centrale con altezza definita e card centrata verticalmente.
- Swipe orizzontale + `scroll-snap`.
- Rapporto frame card corretto a **5:7**, ricavato dalla card `001.webp` (360 × 504 px).
- `object-fit: contain` per evitare tagli.
- Correzione v8 elimina le bande nere sopra/sotto presenti con il vecchio rapporto 2:3.
- Fondo gallery adattivo calcolato dalla card corrente, con transizione morbida.
- Pinch-to-zoom a due dita sulla card: scala limitata a 1.0–1.5× (+50%).
- Nessun trascinamento/pan della card durante lo zoom.
- Al rilascio di una delle dita, ritorno automatico a 1× con transizione morbida di circa 180 ms.
- Lo swipe orizzontale a un dito e lo scroll-snap della gallery restano invariati.

## Reveal card — stato v12
- Tutte le nuove card usano un unico reveal fullscreen, indipendentemente da rarità o tipo.
- Sequenza: preview cifrata/degradata → scan bianco neutro → breve glitch → flash completamente opaco → card decifrata.
- La card completa rimane a opacità zero fino al flash opaco, impedendo esposizioni anticipate dell'artwork.
- Nessun suono e nessuna vibrazione.
- Nei QR multi-card, le card vengono rivelate una alla volta.
- `SKIP` chiude immediatamente l'overlay senza perdere alcuno sblocco.
- Con `prefers-reduced-motion`, l'animazione viene ridotta a reveal immediato.

## Offline / PWA installata — stato v12
- Dopo una prima installazione completa, l'Album deve poter funzionare senza collegamento a GitHub per l'uso quotidiano.
- Service Worker impostato per precache/offline di HTML, CSS, JS, manifest, icone, preview, `.card`, splash e chiave pubblica QR.
- Il Service Worker legge `cards.json` in fase di installazione e precacha automaticamente preview e `.card` dichiarate nel catalogo.
- `.card`: strategia cache-first dopo il precache.
- File applicativi/preview: configurazione pensata per ricevere aggiornamenti senza restare bloccata su vecchie versioni.
- Registrazione Service Worker con `updateViaCache:'none'`. Dalla v11 il nuovo Service Worker resta in attesa finché l’utente non conferma `UPDATE`; quindi riceve `SKIP_WAITING`, prende il controllo e l’app si ricarica.
- Lo scanner QR usa API locali del browser/dispositivo; non richiede CDN o servizi esterni durante la scansione.
- La fotocamera continua a richiedere il permesso del sistema anche offline.
- GitHub resta necessario per installare/pubblicare nuove versioni, non per usare normalmente una PWA già installata.
- `version.json` viene richiesto dalla rete con cache disabilitata per il controllo aggiornamenti.

## Cache / Service Worker
- Cache corrente MASTER v13: `album-digitale-master-2026-08-29-v12-refresh`.
- `qr_public_key.json` è inclusa nel precache per consentire verifica firme anche offline.
- A ogni release pubblicata deve cambiare il nome/versione della cache.
- Obiettivo prioritario: evitare il riuso di HTML/JS/preview obsolete dopo un aggiornamento GitHub.

## File principali della MASTER v13
- `index.html` — struttura UI.
- `style.css` — album, splash, gallery, reveal.
- `app.js` — stato collezione, decifratura, QR firmati, scanner, reveal, gallery e fondo adattivo.
- `sw.js` — Service Worker, precache, offline e versioning cache.
- `manifest.webmanifest` — configurazione PWA, fullscreen/portrait e icone.
- `qr_public_key.json` — chiave pubblica per verifica ECDSA dei QR v2.
- `cards.json` — catalogo dinamico degli slot/card.
- `version.json` — versione/build pubblicata e note usate dal sistema UPDATE.
- `splash.png` — splash ufficiale corrente.
- `icons/icon-192.png`, `icons/icon-512.png` — icone PWA correnti, da sostituire in una release futura con un'identità grafica definitiva.
- `previews/001.webp`…`020.webp` — preview degradate.
- `cards_enc/001.card`…`020.card` — card cifrate.

## Cronologia consolidata release
- **v4** — UI completamente in inglese; splash 3 s; copyright splash.
- **v5** — normalizzazione QR letti da camera/URL/hash.
- **v6** — correzione Base64URL/`atob()`, validazione payload e chiavi.
- **v7** — QR produzione firmati ECDSA P-256 v2 + `qr_public_key.json` + verifica chiavi card.
- **v8** — gallery corretta al rapporto 5:7.
- **v9** — reveal cinematografico unificato con protezione contro reveal anticipato.
- **v10** — pinch-to-zoom semplificato in gallery: massimo 1.5×, nessun pan persistente, ritorno automatico a 1× al rilascio.
- **v11** — menu laterale `UPDATE / ABOUT`, versione visibile, controllo remoto `version.json`, aggiornamento Service Worker su conferma, catalogo dinamico `cards.json` e precache guidato dal catalogo.
- **v12** — aggiunta voce `REFRESH`: rilegge catalogo e stato locale, ricostruisce slot/contatori e UI senza cancellare sblocchi, QR usati o cache applicativa.

## Prossimi interventi pianificati — NON ancora implementati nella v12
1. **Nuova icona PWA definitiva:** almeno 192×192 e 512×512, più variante maskable se necessaria.
2. **Test reale UPDATE v11 → v12** su GitHub Pages/PWA installata, verificando popup, conferma, reload e conservazione collezione.
3. Eventuale rifinitura grafica del menu laterale dopo test su Android/iPhone.

## Regole obbligatorie per modifiche future
1. Partire sempre dalla MASTER più recente dichiarata in questo file.
2. Aggiornare `WORK_HANDOFF.md` nella stessa build di ogni nuova release.
3. Incrementare coerentemente numero versione, cache Service Worker e riferimenti di release.
4. Non reintrodurre strumenti demo/test nell'interfaccia pubblica.
5. Non inserire mai chiave privata di firma, Builder privato o QR Generator privato nel repository pubblico.
6. Non modificare `cards_enc/` senza mantenere la corrispondenza con le chiavi prodotte dal Builder privato.
7. Prima di consegnare una nuova release verificare almeno:
   - sintassi JavaScript;
   - riferimenti ai file;
   - Service Worker e cache name;
   - manifest PWA;
   - scanner QR reale;
   - verifica firme QR;
   - splash;
   - gallery 5:7;
   - reveal senza esposizione anticipata;
   - assenza stringhe `TEST QR`, `QR A`, `QR B`, `RESET DEMO`.
8. Lo stato collezione dell'utente deve restare separato dalla cache applicativa e non deve essere cancellato dagli aggiornamenti.

## Sistema UPDATE — stato v12
- Menu laterale discreto con `REFRESH`, `UPDATE` e `ABOUT`; `EXIT` non è implementato.
- `REFRESH` non esegue update e non svuota cache/storage: rilegge `cards.json`, rilegge lo stato locale della collezione e ricostruisce l’interfaccia.
- All’avvio, dopo la splash, l’app controlla silenziosamente `version.json` quando la rete è disponibile.
- Se `build` remoto è maggiore di `APP_BUILD`, compare il dialog di aggiornamento con `UPDATE` e `LATER`.
- Il pulsante `UPDATE` nel menu forza un controllo manuale e mostra anche lo stato `UP TO DATE` o indisponibilità rete.
- L’aggiornamento sostituisce cache/codice/catalogo, ma non cancella `localStorage` (`album-digitale-encrypted-v1`): card sbloccate e QR usati restano conservati.
- Ogni release deve incrementare coerentemente `APP_VERSION`, `APP_BUILD`, `version.json` e il nome cache in `sw.js`.

## Regola di sincronizzazione Work
Il contenuto di Work deve essere aggiornato insieme alla MASTER. Work non deve più contenere soltanto `index.html` o un handoff obsoleto: deve riflettere la struttura e lo stato dell'ultima release ufficiale, oppure indicare esplicitamente che la MASTER ZIP è la fonte primaria.


## MASTER v13 — PINCH PAN + POPUP NOTIFICATIONS (2026-08-29)
- Gallery pinch maximum increased from 1.5x to 2x.
- While two fingers remain on the card, their midpoint can pan the enlarged image.
- Pan is clamped so the card cannot be dragged completely away.
- One-finger horizontal gallery navigation remains conceptually separate from two-finger inspection.
- Releasing the pinch automatically recenters and returns the card to 1x with the existing short transition.
- Footer-style status messages replaced by temporary floating popup/toast notifications.
- Notifications close automatically after about 2.6 seconds (longer only for startup/load errors).
- REFRESH, UPDATE, ABOUT and collection persistence behavior remain unchanged.
- Service Worker cache bumped to v13.
