# Creare l'APK di OPERA STEP su Windows

## 1. Installa gli strumenti
Installa:
- Node.js LTS
- Android Studio

Durante l'installazione di Android Studio lascia installare anche Android SDK, Platform Tools ed emulator.

## 2. Apri PowerShell nella cartella del progetto
```powershell
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

`npx cap add android` si esegue solo la prima volta. Nei build successivi usa:
```powershell
npm run build
npx cap sync android
npx cap open android
```

## 3. Test sul telefono
In Android Studio:
- abilita le Opzioni sviluppatore e Debug USB sul telefono;
- collega il telefono via USB;
- seleziona il dispositivo nella barra superiore;
- premi Run.

## 4. Creare un APK di test
In Android Studio usa il menu Build e scegli la voce per generare APK / App Bundle disponibile nella versione installata.
Il file debug viene normalmente prodotto sotto:
`android/app/build/outputs/apk/debug/`

## 5. Creare un APK firmato
Per distribuire l'app fuori dal tuo telefono crea un keystore e genera una build signed/release da Android Studio.
Per Play Store è preferibile un Android App Bundle (.aab).

## Pagamento con foto bonifico
La app usa il plugin Camera di Capacitor. Nel pagamento puoi:
- inserire i dati manualmente;
- scattare una foto del bonifico;
- scegliere una foto dalla galleria.

Questa versione MVP conserva i dati sul dispositivo. La versione produzione dovrà spostare dati e ricevute in un backend sicuro con autenticazione e backup.
