# OperaStep 1.0 — Distribuzione Android

Il workflow genera due artefatti:
- `operastep-android-apk`: APK per test e condivisione privata.
- `operastep-playstore-aab`: bundle per Google Play.

Per pubblicare su Google Play, l'AAB deve essere firmato. Configurare in GitHub Actions Secrets:
- ANDROID_KEYSTORE_BASE64
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS
- ANDROID_KEY_PASSWORD

Creare l'upload keystore con Java:
`keytool -genkeypair -v -keystore operastep-upload.keystore -alias operastep -keyalg RSA -keysize 2048 -validity 10000`

Non salvare mai il keystore nel repository.

Servono inoltre: account Google Play Console, e-mail supporto, URL pubblico Privacy Policy, screenshot store, Data Safety e classificazione contenuti.

La release 1.0 usa la nuova chiave locale `operastep-v1-state`, quindi i dati demo delle build precedenti non vengono caricati.
