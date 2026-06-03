# Build APK script
$androidDir = "d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\android"
$gradlew = Join-Path $androidDir "gradlew.bat"
& $gradlew -p $androidDir assembleDebug 2>&1