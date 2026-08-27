ALBUM DIGITALE — MASTER v8 GALLERY 5:7

Questa è la base pubblica dell'Album digitale.

FUNZIONAMENTO OFFLINE
Dopo l'installazione completa della PWA, l'album usa una cache locale offline-first.
Galleria, preview, card cifrate e scanner QR con fotocamera non richiedono GitHub durante l'uso.
GitHub/hosting HTTPS serve per la prima installazione e per distribuire gli aggiornamenti.

QR
Il pulsante SCAN QR apre la fotocamera posteriore e usa BarcodeDetector del browser/Android.
I nuovi QR v2 sono firmati ECDSA P-256 e verificati con qr_public_key.json.
I QR v1 precedenti restano temporaneamente compatibili.
Nessun TEST QR, payload demo, generatore o chiave privata è incluso nella PWA pubblica.

SPLASH
splash.png si trova nella root, accanto a index.html, ed è salvata anche per l'uso offline.
