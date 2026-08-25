ALBUM DIGITALE — PWA CIFRATA, PROTOTIPO 20 SLOT

COSA CAMBIA
- Le immagini complete NON sono presenti in chiaro nella PWA.
- Ogni card è cifrata separatamente con AES-256-GCM in cards_enc/NNN.card.
- Ogni card usa una chiave casuale diversa.
- Il file cifrato contiene IV + ciphertext autenticato.
- Le chiavi delle card vengono fornite dal payload QR e salvate localmente solo dopo lo sblocco.
- Gli slot bloccati mostrano previews/NNN.webp: anteprime fortemente ridotte, sfocate, desaturate e oscurate. Non sono le card originali.
- Alla rivelazione la PWA decifra la card in memoria con Web Crypto API e crea un Blob URL temporaneo.
- Il service worker mette in cache i file cifrati e le preview per il funzionamento offline.

TEST
- All'avvio tutte le 20 card sono bloccate.
- TEST QR apre due QR simulati da 5 card.
- QR A sblocca #004, #007 Special, #011 Variant, #014 Special, #018 Variant.
- QR B sblocca #001, #002, #005, #009, #013.
- RESET DEMO cancella chiavi e sblocchi locali.

FORMATO PAYLOAD ATTUALE
AD1.<JSON codificato base64url>
Il JSON contiene versione, identificativo del QR e da 1 a 5 coppie {id, k}.

IMPORTANTE
Questa build implementa la CIFRATURA delle card, ma i QR simulati sono incorporati nell'app esclusivamente per il test. Nella build di produzione questi payload demo verranno rimossi. Il prossimo modulo dovrà generare QR reali e firmati; l'app conterrà soltanto la chiave pubblica per verificarli.

SICUREZZA OFFLINE
Dopo che una card è stata sbloccata, la sua chiave deve necessariamente esistere sul dispositivo per poterla rivedere offline. Un utente con pieno controllo del dispositivo può teoricamente estrarre le chiavi delle card già sbloccate. Le card NON sbloccate restano invece cifrate e le loro chiavi non sono presenti nell'app di produzione.

INSTALLAZIONE PWA
Pubblica l'intera cartella su HTTPS. Apri il sito dal telefono e usa Installa app / Aggiungi alla schermata Home.
