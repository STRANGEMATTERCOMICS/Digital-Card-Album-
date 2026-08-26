ALBUM DIGITALE — PUBLIC UI3 — 26/08/2026

Questa build corregge realmente:

1) GALLERIA CENTRATA IN ALTEZZA
La card è centrata rispetto al viewport intero (non nello spazio residuo fra header e footer).
Header e metadati sono overlay e non spostano il centro geometrico della card.

2) SFONDO DINAMICO
Il colore viene campionato dalla card attualmente visibile e applicato al fondo della galleria
con transizione morbida.

3) REVEAL SENZA ANTICIPAZIONE
Le chiavi AES delle card nuove NON vengono più salvate tutte prima del reveal.
Ogni chiave viene resa persistente solo dopo il turno di rivelazione di quella card.
Le card successive restano quindi tecnicamente bloccate e possono mostrare solo la preview.

4) CACHE / GITHUB PAGES
style.css e app.js usano un identificatore di build (?v=20260826-ui3).
Il Service Worker usa una nuova cache e strategia network-first per HTML/JS/CSS.
Questo impedisce alla vecchia UI di restare visibile dopo il deploy.

CARICAMENTO SU GITHUB
Sostituire tutti i file pubblici con quelli di questo ZIP.
Dopo il deploy, aprire la pagina una volta e ricaricarla. Il nuovo service worker elimina le cache precedenti.
