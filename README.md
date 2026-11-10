# Portfolio di Matteo Cappelli

Sito statico bilingue, senza dipendenze da installare:

- `index.html`: italiano, lingua predefinita.
- `en/index.html`: inglese.
- `servizi.html` e `en/services.html`: pagina servizi nelle due lingue.
- `templates/index.html` e `templates/services.html`: struttura delle pagine.
- `templates/partials/`: head, intestazione, contatti e footer condivisi.
- `locales/it.json` e `locales/en.json`: testi, attributi accessibili e messaggi del modulo.
- `public/`: CSS, JavaScript, immagini e CV condivisi.

La sezione progetti contiene dodici card in un carosello manuale:
tre card per pagina sopra i 900 px, una card alla volta sugli schermi più piccoli.
Frecce, indicatori e tastiera sono gestiti da `public/js/carousel.js`;
lo scorrimento touch e la lettura delle card funzionano anche senza JavaScript.
Il carosello non avanza automaticamente e rispetta la preferenza di movimento ridotto.

Per aggiornare i testi, modifica il file della lingua; per cambiare la struttura,
modifica il template o il componente condiviso. Poi rigenera le quattro pagine con Node.js 22 o successivo:

```sh
npm run build
npm test
```

In alternativa, senza npm: `node scripts/build.mjs` e `node --test`.
Il generatore controlla che le traduzioni abbiano le stesse chiavi e segnala
eventuali valori mancanti. Non modificare direttamente gli HTML generati.

Gli URL canonical e hreflang utilizzano `https://devacap.github.io/`, corrispondente
al repository. Per un dominio o un percorso di pubblicazione diverso:

```sh
npm run build -- --site-url https://example.com/portfolio/
```

Per l'anteprima basta il server statico locale di Laragon. Per la pubblicazione
servono `index.html`, `servizi.html`, la directory `en/` e `public/`; non è necessario Node.js
sull'hosting. I file generati sono inclusi nel repository e funzionano anche
senza JavaScript. JavaScript mantiene la sezione corrente durante il cambio
di lingua e gestisce l'invio del modulo.

Il cambio lingua mostra solo la bandiera dell'altra lingua, accanto a LinkedIn
nell'intestazione e nel menu sui dispositivi con schermo piccolo.
La pagina principale resta in italiano e non effettua
reindirizzamenti automatici in base alla lingua del browser.

La pagina servizi presenta l'offerta in sei ambiti generali, oltre a manutenzione,
evoluzione e metodo di lavoro, senza riferimenti ai singoli progetti svolti. Il cambio lingua
mantiene la pagina corrente, sia nel portfolio sia nei servizi.
