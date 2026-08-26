ALBUM DIGITALE — MASTER 2026-08-26 v1

Questa cartella è la base unica di sviluppo del progetto.

PUBBLICAZIONE
Carica tutti i file su GitHub Pages mantenendo cartelle e nomi. Aggiungi `splash.png` nella root accanto a `index.html`.

IMPORTANTE
- Nessun TEST QR è presente nell'interfaccia o nel codice demo.
- La gallery è full-screen e non deve più collassare in una linea.
- La splash HTML è full-screen edge-to-edge e non usa l'icona come fallback.
- Un'eventuale icona mostrata PRIMA della splash su una PWA installata è la schermata nativa del sistema/browser, non la splash HTML.
- Orientamento richiesto: portrait.
- La cache è versionata e le preview usano network-first per evitare immagini vecchie dopo gli aggiornamenti.

QR
Il MASTER accetta payload AD1 passati alla PWA tramite `?qr=`, `#qr=` o hash diretto `#AD1.`. La firma crittografica dei QR non viene dichiarata attiva in questa build perché non era presente nei file sorgente recuperati.
