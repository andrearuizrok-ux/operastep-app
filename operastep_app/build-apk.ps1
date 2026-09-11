$ErrorActionPreference = "Stop"
npm install
npm run build
if (-not (Test-Path "android")) {
  npx cap add android
}
npx cap sync android
Set-Location android
.\gradlew.bat assembleDebug
Write-Host "APK creato in android\app\build\outputs\apk\debug\app-debug.apk"
