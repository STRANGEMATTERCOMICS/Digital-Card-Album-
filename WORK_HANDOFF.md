# ALBUM DIGITALE — HANDOFF PER WORK

## Stato corrente
- Splash screen ripristinata: overlay full-screen a ogni avvio, durata 2 s + fade-out. Usa `splash.png` se presente nella root; fallback automatico a `icons/icon-512.png`.
- Cache PWA aggiornata a `album-digitale-encrypted-v2-splash` per forzare il refresh dei file applicativi.
Prototipo PWA mobile-first funzionante, già verificato su telefono tramite GitHub Pages e installabile come PWA.

## Regole UI fissate
- 20 slot nel prototipo.
- Album con scroll verticale.
- 2 slot affiancati per riga.
- Numerazione unica progressiva #001–#020.
- Variant e Special sono mescolate nella sequenza normale.
- Simbolo Variant: `V`.
- Simbolo Special: `◆` provvisorio.
- Slot bloccati mostrano preview irreversibilmente degradata/offuscata.
- Tap su card sbloccata apre gallery.
- Gallery comprende anche card bloccate.
- Gallery: card molto grandi (94–96% larghezza su smartphone), swipe orizzontale, scroll-snap, nessuna freccia visibile, X per uscire.
- Reveal QR: scorrimento automatico verso ogni slot, reveal in sequenza, massimo 5 card, pulsante SALTA.

## Cifratura
- Card complete cifrate singolarmente con AES-256-GCM.
- File cifrati in `cards_enc/`.
- Preview degradate in `previews/`.
- Le card complete vengono decifrate in memoria solo dopo sblocco.
- Le chiavi delle card sono salvate localmente nel browser/PWA.
- Nessun database esterno.

## QR — stato
La demo contiene due QR simulati. Il sistema definitivo da costruire in Work deve:
1. leggere QR reali dalla fotocamera;
2. accettare 1–5 card per QR;
3. contenere ID e materiale di decifratura;
4. verificare autenticità/firma del QR;
5. registrare localmente i QR già usati sul dispositivo;
6. ignorare eventuali card già sbloccate.

## Generatore QR da costruire
Modulo separato dall'Album.
- Generazione automatica casuale.
- Nessun doppione all'interno della stessa tiratura base.
- Esempio: 20 card / 4 QR = copertura completa delle 20 card, 5 per QR.
- Variant gestibili con QR dedicati.
- Special gestibili con QR dedicati/distribuzione Patreon a tempo o limitata.
- Firma con chiave privata nel generatore; PWA contiene solo chiave pubblica.

## Distribuzione
- PWA ospitata su GitHub Pages via HTTPS.
- Link distribuibile tramite Patreon.
- QR pubblicabili nei post Patreon.

## Prossimi lavori
1. Scanner QR reale.
2. Generatore QR automatico e firmato.
3. Struttura di import semplice per sostituire le 20 card demo con immagini reali.
4. Pulizia grafica finale e simbolo Special definitivo.
5. Versioning PWA/service worker per aggiornamenti affidabili.
