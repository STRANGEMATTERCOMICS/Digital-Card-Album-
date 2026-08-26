ALBUM DIGITALE — PACCHETTO PUBBLICO

Questo ZIP contiene esclusivamente i file destinati a GitHub Pages.

CARICARE il CONTENUTO di questa cartella nella root del repository:
- index.html
- app.js
- style.css
- sw.js
- manifest.webmanifest
- qr_public_key.json
- cards_enc/
- previews/
- icons/

NON contiene:
- CARD BUILDER
- QR GENERATOR
- manifest privati delle card
- chiave privata ECDSA

Nota: i file cards_enc presenti sono quelli del set/demo corrente.

AGGIORNAMENTO UI CONSOLIDATO
- Galleria centrata verticalmente a schermo intero.
- Fondo adattivo derivato dalla card visualizzata.
- Corretto reveal anticipato: le card in attesa mostrano solo preview fino al proprio turno.
- QR reali compatibili con il QR Generator aggiornato.
- Card già possedute non vengono duplicate.
