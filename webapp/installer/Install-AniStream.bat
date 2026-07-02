<# : Install-AniStream.bat - installateur AniStream pour Windows (double-clic)
@echo off
title Installation d'AniStream
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex (Get-Content -LiteralPath '%~f0' -Raw)"
echo.
pause
goto :eof
#>

# ============================================================================
#  AniStream - installateur Windows
#  Telecharge l'application, un Python autonome et ffmpeg, puis cree un
#  raccourci sur le Bureau. Aucun droit administrateur necessaire.
# ============================================================================

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'

$Repo      = 'tsdiallo/yt-dlp'
$Branch    = 'master'
$PyUrl     = 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-embed-amd64.zip'
$FfmpegUrl = 'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip'

$Dest = Join-Path $env:LOCALAPPDATA 'AniStream'
$Tmp  = Join-Path $env:TEMP 'anistream-setup'

Write-Host ''
Write-Host '  =========================================' -ForegroundColor Red
Write-Host '   AniStream - installation' -ForegroundColor Red
Write-Host '  =========================================' -ForegroundColor Red
Write-Host "  Dossier d'installation : $Dest"
Write-Host ''

if (Test-Path $Tmp) { Remove-Item $Tmp -Recurse -Force }
New-Item -ItemType Directory -Path $Tmp | Out-Null
New-Item -ItemType Directory -Path $Dest -Force | Out-Null

# --- 1/5 : application -------------------------------------------------------
Write-Host '  [1/5] Telechargement de l''application...'
$repoZip = Join-Path $Tmp 'app.zip'
Invoke-WebRequest -Uri "https://github.com/$Repo/archive/refs/heads/$Branch.zip" -OutFile $repoZip
Expand-Archive -Path $repoZip -DestinationPath (Join-Path $Tmp 'repo') -Force
$repoDir = Get-ChildItem (Join-Path $Tmp 'repo') -Directory | Select-Object -First 1
if (Test-Path (Join-Path $Dest 'app')) { Remove-Item (Join-Path $Dest 'app') -Recurse -Force }
Move-Item $repoDir.FullName (Join-Path $Dest 'app')

# --- 2/5 : Python autonome ---------------------------------------------------
Write-Host '  [2/5] Telechargement de Python (autonome, sans installation systeme)...'
$pyDir = Join-Path $Dest 'python'
if (-not (Test-Path (Join-Path $pyDir 'python.exe'))) {
    $pyZip = Join-Path $Tmp 'python.zip'
    Invoke-WebRequest -Uri $PyUrl -OutFile $pyZip
    Expand-Archive -Path $pyZip -DestinationPath $pyDir -Force
    # active 'import site' pour permettre pip
    $pth = Get-ChildItem $pyDir -Filter 'python*._pth' | Select-Object -First 1
    (Get-Content $pth.FullName) -replace '^#\s*import site$', 'import site' | Set-Content $pth.FullName
}
$python = Join-Path $pyDir 'python.exe'

# --- 3/5 : dependances Python ------------------------------------------------
Write-Host '  [3/5] Installation des dependances (FastAPI, uvicorn)...'
if (-not (Test-Path (Join-Path $pyDir 'Scripts\pip.exe'))) {
    $getPip = Join-Path $Tmp 'get-pip.py'
    Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $getPip
    & $python $getPip --no-warn-script-location | Out-Null
}
& $python -m pip install --no-warn-script-location --quiet fastapi uvicorn

# --- 4/5 : ffmpeg (optionnel mais recommande) --------------------------------
Write-Host '  [4/5] Telechargement de ffmpeg (~100 Mo, fusion video+audio, sous-titres)...'
try {
    $ffDir = Join-Path $Dest 'ffmpeg'
    if (-not (Test-Path (Join-Path $ffDir 'ffmpeg.exe'))) {
        $ffZip = Join-Path $Tmp 'ffmpeg.zip'
        Invoke-WebRequest -Uri $FfmpegUrl -OutFile $ffZip
        Expand-Archive -Path $ffZip -DestinationPath (Join-Path $Tmp 'ffmpeg') -Force
        New-Item -ItemType Directory -Path $ffDir -Force | Out-Null
        Get-ChildItem (Join-Path $Tmp 'ffmpeg') -Recurse -Include 'ffmpeg.exe','ffprobe.exe' |
            ForEach-Object { Copy-Item $_.FullName $ffDir -Force }
    }
} catch {
    Write-Host '  ATTENTION : ffmpeg n''a pas pu etre telecharge. AniStream fonctionnera' -ForegroundColor Yellow
    Write-Host '  quand meme, avec une qualite video parfois limitee.' -ForegroundColor Yellow
}

# --- 5/5 : lanceur et raccourcis ---------------------------------------------
Write-Host '  [5/5] Creation du lanceur et du raccourci Bureau...'

$launcher = @'
param([switch]$ServerOnly)
$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:PATH = (Join-Path $root 'ffmpeg') + ';' + $env:PATH
$env:ANISTREAM_MEDIA = Join-Path ([Environment]::GetFolderPath('MyVideos')) 'AniStream'
$env:ANISTREAM_DATA = Join-Path $root 'data'

function Test-AniPort {
    try {
        $c = New-Object Net.Sockets.TcpClient
        $c.Connect('127.0.0.1', 8000)
        $c.Close()
        $true
    } catch { $false }
}

if (-not (Test-AniPort)) {
    $py = Join-Path $root 'python\python.exe'
    $app = Join-Path $root 'app\webapp\app.py'
    Start-Process -FilePath $py -ArgumentList ('"' + $app + '"') -WorkingDirectory (Join-Path $root 'app') -WindowStyle Hidden
    for ($i = 0; $i -lt 60; $i++) {
        if (Test-AniPort) { break }
        Start-Sleep -Milliseconds 500
    }
}

if (-not $ServerOnly) {
    $edge = @(
        (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($edge) {
        Start-Process -FilePath $edge -ArgumentList '--app=http://127.0.0.1:8000'
    } else {
        Start-Process 'http://127.0.0.1:8000'
    }
}
'@
Set-Content -Path (Join-Path $Dest 'launcher.ps1') -Value $launcher -Encoding ASCII

$vbs = 'CreateObject("Wscript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -File ""' + (Join-Path $Dest 'launcher.ps1') + '""", 0, False'
Set-Content -Path (Join-Path $Dest 'AniStream.vbs') -Value $vbs -Encoding ASCII

$uninstall = @'
@echo off
title Desinstallation d'AniStream
echo Arret du serveur AniStream...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.ExecutablePath -like '*AniStream*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Suppression des raccourcis...
del "%USERPROFILE%\Desktop\AniStream.lnk" 2>nul
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\AniStream.lnk" 2>nul
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AniStream (serveur).lnk" 2>nul
echo Suppression des fichiers (votre bibliotheque dans Videos\AniStream est conservee)...
cd /d "%TEMP%"
rmdir /s /q "%LOCALAPPDATA%\AniStream"
echo Termine.
pause
'@
Set-Content -Path (Join-Path $Dest 'Desinstaller.bat') -Value $uninstall -Encoding ASCII

$icon = Join-Path $Dest 'app\webapp\installer\anistream.ico'
$ws = New-Object -ComObject WScript.Shell
foreach ($lnkPath in @(
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'AniStream.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'AniStream.lnk')
)) {
    $sc = $ws.CreateShortcut($lnkPath)
    $sc.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
    $sc.Arguments = '"' + (Join-Path $Dest 'AniStream.vbs') + '"'
    $sc.WorkingDirectory = $Dest
    if (Test-Path $icon) { $sc.IconLocation = $icon }
    $sc.Description = 'AniStream - streaming local'
    $sc.Save()
}

$serverVbs = 'CreateObject("Wscript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -File ""' + (Join-Path $Dest 'launcher.ps1') + '"" -ServerOnly", 0, False'
Set-Content -Path (Join-Path $Dest 'AniStreamServer.vbs') -Value $serverVbs -Encoding ASCII

$startupLnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'AniStream (serveur).lnk'
$auto = Read-Host '  Verifier les series suivies au demarrage de Windows ? (o/N)'
if ($auto -eq 'o' -or $auto -eq 'O') {
    $sc = $ws.CreateShortcut($startupLnk)
    $sc.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
    $sc.Arguments = '"' + (Join-Path $Dest 'AniStreamServer.vbs') + '"'
    if (Test-Path $icon) { $sc.IconLocation = $icon }
    $sc.Description = 'Serveur AniStream (arriere-plan)'
    $sc.Save()
    Write-Host '  Le serveur AniStream demarrera en arriere-plan avec Windows.'
} elseif (Test-Path $startupLnk) {
    Remove-Item $startupLnk -Force
}

Remove-Item $Tmp -Recurse -Force

Write-Host ''
Write-Host '  =========================================' -ForegroundColor Green
Write-Host '   Installation terminee !' -ForegroundColor Green
Write-Host '  =========================================' -ForegroundColor Green
Write-Host ''
Write-Host '  - Icone AniStream ajoutee sur le Bureau et au menu Demarrer'
Write-Host '  - Bibliotheque : dossier Videos\AniStream'
Write-Host '  - Pour desinstaller : Desinstaller.bat dans ' -NoNewline
Write-Host $Dest
Write-Host ''

$launch = Read-Host '  Lancer AniStream maintenant ? (O/n)'
if ($launch -ne 'n' -and $launch -ne 'N') {
    Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList ('"' + (Join-Path $Dest 'AniStream.vbs') + '"')
}
