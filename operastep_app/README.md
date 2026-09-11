# OperaStep — Android MVP

## Funzioni presenti
- dashboard con valore maturato, pagato e massimo acconto consigliato;
- aggiornamento avanzamento delle singole lavorazioni;
- pagamento manuale;
- pagamento con foto del bonifico da fotocamera o galleria;
- anteprima della ricevuta;
- storico pagamenti;
- salvataggio locale sul dispositivo;
- blocco di un pagamento superiore al limite sicuro calcolato.

## Avvio web
```bash
npm install
npm run dev
```

## Preparazione Android
```bash
npm install
npm run build
npx cap add android   # solo la prima volta
npx cap sync android
npx cap open android
```

In Android Studio:
1. attendere la sincronizzazione Gradle;
2. collegare un telefono Android con debug USB oppure usare un emulatore;
3. Run per testare;
4. Build > Generate App Bundles or APKs > Generate APKs per APK di test;
5. per una release distribuibile, creare una chiave di firma e usare Generate Signed App Bundle / APK.

## Nota dati
Questa MVP salva dati e immagini in locale. Per la versione multi-dispositivo/backup bisogna aggiungere un backend (database + storage file + autenticazione).

## Identità tecnica
- Nome app: `OperaStep`
- Repository consigliato: `operastep-app`
- Android application ID: `com.operastep.app`
- Artifact GitHub Actions: `operastep-debug-apk`

## Principio prodotto
OperaStep collega ogni pagamento all’avanzamento economico reale del lavoro: progetto → preventivo dettagliato → condizioni di pagamento → aggiornamenti settimanali / pre-pagamento → acconto massimo consigliato.
