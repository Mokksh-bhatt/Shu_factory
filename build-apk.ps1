# Shon Ceramics — Build APK (portable, no MSI installs needed)
# Run: cd "C:\Users\mokks\Desktop\anti\Shu_factory" && .\build-apk.ps1

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"  # Faster downloads

$PROJECT_ROOT = "C:\Users\mokks\Desktop\anti\Shu_factory"
$TOOLS_DIR    = "C:\Users\mokks\.android-build"
$JDK_DIR      = "$TOOLS_DIR\jdk17"
$ANDROID_SDK  = "$TOOLS_DIR\sdk"
$CMDLINE_TOOLS= "$ANDROID_SDK\cmdline-tools\latest\bin"

function Step { param([string]$msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function OK   { param([string]$msg) Write-Host "   OK: $msg" -ForegroundColor Green }
function Info { param([string]$msg) Write-Host "   $msg" -ForegroundColor White }
function Fail { param([string]$msg) Write-Host "   ERROR: $msg" -ForegroundColor Red; exit 1 }

New-Item -ItemType Directory -Path $TOOLS_DIR -Force | Out-Null

Write-Host @"
=====================================================
  Shon Ceramics APK Builder
=====================================================
"@ -ForegroundColor Cyan

# ── 1. JDK 17 (portable ZIP, no MSI) ─────────────────────────────────────────
Step "Setting up JDK 17..."

if (-not (Test-Path "$JDK_DIR\bin\java.exe")) {
    $jdkZip = "$TOOLS_DIR\jdk17.zip"
    $jdkUrl = "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.11%2B9/OpenJDK17U-jdk_x64_windows_hotspot_17.0.11_9.zip"

    Info "Downloading Eclipse Temurin JDK 17 (~200MB)..."
    Invoke-WebRequest -Uri $jdkUrl -OutFile $jdkZip -UseBasicParsing
    OK "Downloaded"

    Info "Extracting JDK..."
    Expand-Archive -Path $jdkZip -DestinationPath $TOOLS_DIR -Force
    # Rename the extracted folder to jdk17
    $extracted = Get-ChildItem $TOOLS_DIR -Directory | Where-Object { $_.Name -like "jdk-17*" } | Select-Object -First 1
    if ($extracted) { Rename-Item $extracted.FullName "jdk17" }
    Remove-Item $jdkZip -Force
    OK "JDK 17 extracted"
} else {
    OK "JDK 17 already present"
}

$env:JAVA_HOME = $JDK_DIR
$env:PATH = "$JDK_DIR\bin;$env:PATH"
$jv = (java -version 2>&1 | Select-String '(\d+)' | Select-Object -First 1).Matches[0].Value
OK "Java: $jv"

# ── 2. Android SDK command-line tools ─────────────────────────────────────────
Step "Setting up Android SDK..."

$env:ANDROID_HOME = $ANDROID_SDK
$env:PATH = "$ANDROID_SDK\platform-tools;$CMDLINE_TOOLS;$env:PATH"

if (-not (Test-Path "$CMDLINE_TOOLS\sdkmanager.bat")) {
    $sdkZip = "$TOOLS_DIR\cmdtools.zip"
    $sdkUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"

    Info "Downloading Android command-line tools (~135MB)..."
    Invoke-WebRequest -Uri $sdkUrl -OutFile $sdkZip -UseBasicParsing
    OK "Downloaded"

    Info "Extracting..."
    New-Item -ItemType Directory -Path "$ANDROID_SDK\cmdline-tools" -Force | Out-Null
    Expand-Archive -Path $sdkZip -DestinationPath "$ANDROID_SDK\cmdline-tools" -Force
    $extracted = Get-ChildItem "$ANDROID_SDK\cmdline-tools" -Directory | Where-Object { $_.Name -ne 'latest' } | Select-Object -First 1
    if ($extracted) { Rename-Item $extracted.FullName "latest" -Force }
    Remove-Item $sdkZip -Force
    OK "SDK tools extracted"
} else {
    OK "Android SDK tools already present"
}

# Accept licenses + install required packages
Info "Accepting licenses and installing SDK packages..."
$sdkmanager = "$CMDLINE_TOOLS\sdkmanager.bat"
"y`ny`ny`ny`ny`ny`ny`n" | & $sdkmanager --sdk_root=$ANDROID_SDK --licenses 2>&1 | Out-Null
& $sdkmanager --sdk_root=$ANDROID_SDK "platform-tools" "platforms;android-36" "build-tools;35.0.0" 2>&1 | Where-Object { $_ -match 'done|Downloading|Unpacking|Warning' } | Select-Object -Last 8
OK "Android SDK ready"

# ── 3. Write local.properties ─────────────────────────────────────────────────
Step "Configuring Android project..."
Set-Location "$PROJECT_ROOT\android"
$sdkPath = $ANDROID_SDK -replace '\\', '/'
"sdk.dir=$sdkPath" | Out-File "local.properties" -Encoding utf8 -NoNewline
OK "local.properties written"
Set-Location $PROJECT_ROOT

# ── 4. Build web app ──────────────────────────────────────────────────────────
Step "Building web app..."
npm run build 2>&1 | Select-Object -Last 3
OK "Web build complete"

# ── 5. Sync Capacitor ─────────────────────────────────────────────────────────
Step "Syncing Capacitor..."
npx cap sync android 2>&1 | Select-Object -Last 5
OK "Synced"

# ── 6. Build APK ──────────────────────────────────────────────────────────────
Step "Building APK (~2 min)..."
Set-Location "$PROJECT_ROOT\android"

$gradleOutput = & ".\gradlew.bat" assembleDebug --no-daemon 2>&1
$gradleOutput | Where-Object { $_ -match 'BUILD|error:|Error|FAILED|Task :app' } | Select-Object -Last 20

Set-Location $PROJECT_ROOT

# ── 7. Copy to Desktop ────────────────────────────────────────────────────────
$apkSrc  = "$PROJECT_ROOT\android\app\build\outputs\apk\debug\app-debug.apk"
$apkDest = "C:\Users\mokks\Desktop\ShonCeramics.apk"

if (Test-Path $apkSrc) {
    Copy-Item $apkSrc $apkDest -Force
    $mb = [math]::Round((Get-Item $apkDest).Length / 1MB, 1)
    Write-Host @"

=====================================================
  APK READY!  ($mb MB)
  Desktop\ShonCeramics.apk

  Install on Android:
  1. Copy file to phone (USB or WhatsApp yourself)
  2. Tap the file on your phone -> Install
     (Settings -> Allow unknown sources if asked)

  Alarm notifications active:
  - Rings even when phone on silent
  - Bypasses Do Not Disturb
  - Aggressive vibration
  - Stays on screen until dismissed
=====================================================
"@ -ForegroundColor Green
} else {
    Write-Host "Build failed - APK not found at expected path" -ForegroundColor Red
    Write-Host "Last gradle output:"
    $gradleOutput | Select-Object -Last 30 | ForEach-Object { Write-Host $_ }
}
