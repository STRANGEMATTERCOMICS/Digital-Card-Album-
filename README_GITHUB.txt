ALBUM DIGITALE — MASTER v7 SIGNED QR — 27/08/2026

STATO
- PWA offline-first.
- QR di produzione firmati ECDSA P-256 / SHA-256.
- Chiave pubblica in qr_public_key.json e disponibile offline.
- Compatibilità temporanea con i QR v1 precedenti.
- Controllo di corrispondenza tra chiavi AES del QR e file .card prima dello sblocco.

SICUREZZA
Non caricare mai su GitHub Card Builder, QR Generator, manifest privati,
card-keyring.json o qr-signing-private-key.json.

AGGIORNAMENTI
Quando vengono sostituiti app, preview o file .card, aggiornare sempre il nome
della cache in sw.js. Card e preview devono essere pubblicate insieme al
portachiavi privato generato nella stessa operazione.
