#!/bin/bash
# ============================================================================
#  AniStream - installateur macOS (double-clic)
#  Installe l'application, un environnement Python isole et ffmpeg, puis
#  cree AniStream.app avec un raccourci sur le Bureau.
# ============================================================================
set -e

REPO="tsdiallo/yt-dlp"
BRANCH="master"

DEST="$HOME/Library/Application Support/AniStream"
APP="$HOME/Applications/AniStream.app"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

bold=$(tput bold 2>/dev/null || true); red=$(tput setaf 1 2>/dev/null || true)
green=$(tput setaf 2 2>/dev/null || true); reset=$(tput sgr0 2>/dev/null || true)

echo ""
echo "${red}${bold}  ========================================="
echo "   AniStream - installation macOS"
echo "  =========================================${reset}"
echo "  Dossier d'installation : $DEST"
echo ""

# --- prerequis : python3 -----------------------------------------------------
if ! command -v python3 >/dev/null 2>&1; then
    echo "${red}Python 3 est requis.${reset}"
    echo "Installez-le depuis https://www.python.org/downloads/macos/ puis relancez ce script."
    read -r -p "Appuyez sur Entree pour fermer..." _
    exit 1
fi

mkdir -p "$DEST"

# --- 1/5 : application -------------------------------------------------------
echo "  [1/5] Telechargement de l'application..."
curl -fsSL "https://github.com/$REPO/archive/refs/heads/$BRANCH.zip" -o "$TMP/app.zip"
unzip -q "$TMP/app.zip" -d "$TMP/repo"
rm -rf "$DEST/app"
mv "$TMP/repo/"* "$DEST/app"

# --- 2/5 : environnement Python isole ---------------------------------------
echo "  [2/5] Creation de l'environnement Python..."
if [ ! -x "$DEST/venv/bin/python3" ]; then
    python3 -m venv "$DEST/venv"
fi

# --- 3/5 : dependances -------------------------------------------------------
echo "  [3/5] Installation des dependances (FastAPI, uvicorn)..."
"$DEST/venv/bin/pip" install --quiet --upgrade pip
"$DEST/venv/bin/pip" install --quiet fastapi uvicorn

# --- 4/5 : ffmpeg (optionnel mais recommande) --------------------------------
echo "  [4/5] Telechargement de ffmpeg..."
if [ ! -x "$DEST/ffmpeg/ffmpeg" ]; then
    mkdir -p "$DEST/ffmpeg"
    if curl -fsSL "https://evermeet.cx/ffmpeg/getrelease/zip" -o "$TMP/ffmpeg.zip" 2>/dev/null; then
        unzip -qo "$TMP/ffmpeg.zip" -d "$DEST/ffmpeg" && chmod +x "$DEST/ffmpeg/ffmpeg" || true
    fi
    if [ ! -x "$DEST/ffmpeg/ffmpeg" ] && command -v brew >/dev/null 2>&1; then
        echo "  (telechargement direct impossible, tentative via Homebrew...)"
        brew install ffmpeg || true
    fi
    if [ ! -x "$DEST/ffmpeg/ffmpeg" ] && ! command -v ffmpeg >/dev/null 2>&1; then
        echo "  ATTENTION : ffmpeg n'a pas pu etre installe. AniStream fonctionnera"
        echo "  quand meme, avec une qualite video parfois limitee."
    fi
fi

# --- 5/5 : AniStream.app + raccourci Bureau ----------------------------------
echo "  [5/5] Creation d'AniStream.app et du raccourci Bureau..."
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>AniStream</string>
    <key>CFBundleDisplayName</key><string>AniStream</string>
    <key>CFBundleIdentifier</key><string>local.anistream.app</string>
    <key>CFBundleVersion</key><string>1.0</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleExecutable</key><string>AniStream</string>
    <key>CFBundleIconFile</key><string>anistream</string>
    <key>LSUIElement</key><false/>
</dict>
</plist>
PLIST

cat > "$APP/Contents/MacOS/AniStream" <<LAUNCHER
#!/bin/bash
DEST="$DEST"
export PATH="\$DEST/ffmpeg:\$PATH"
export ANISTREAM_MEDIA="\$HOME/Movies/AniStream"
export ANISTREAM_DATA="\$DEST/data"

if ! curl -s --max-time 1 -o /dev/null http://127.0.0.1:8000/; then
    cd "\$DEST/app"
    nohup "\$DEST/venv/bin/python3" webapp/app.py > "\$DEST/server.log" 2>&1 &
    for _ in \$(seq 1 60); do
        curl -s --max-time 1 -o /dev/null http://127.0.0.1:8000/ && break
        sleep 0.5
    done
fi
open "http://127.0.0.1:8000"
LAUNCHER
chmod +x "$APP/Contents/MacOS/AniStream"

cp "$DEST/app/webapp/installer/anistream.icns" "$APP/Contents/Resources/anistream.icns" 2>/dev/null || true
touch "$APP"

# raccourci Bureau (alias symbolique)
ln -sfn "$APP" "$HOME/Desktop/AniStream"

# desinstalleur
cat > "$DEST/Desinstaller.command" <<UNINSTALL
#!/bin/bash
echo "Arret du serveur AniStream..."
pkill -f "AniStream/venv/bin/python3" 2>/dev/null || true
echo "Suppression (la bibliotheque dans ~/Movies/AniStream est conservee)..."
rm -f "\$HOME/Desktop/AniStream"
rm -rf "\$HOME/Applications/AniStream.app"
rm -f "\$HOME/Library/LaunchAgents/local.anistream.plist" 2>/dev/null
launchctl unload "\$HOME/Library/LaunchAgents/local.anistream.plist" 2>/dev/null || true
rm -rf "$DEST"
echo "Termine."
UNINSTALL
chmod +x "$DEST/Desinstaller.command"

echo ""
echo "${green}${bold}  ========================================="
echo "   Installation terminee !"
echo "  =========================================${reset}"
echo ""
echo "  - AniStream.app est dans ~/Applications, avec un raccourci sur le Bureau"
echo "  - Bibliotheque : ~/Movies/AniStream"
echo "  - Pour desinstaller : Desinstaller.command dans $DEST"
echo ""
read -r -p "  Lancer AniStream maintenant ? (O/n) " answer
if [ "$answer" != "n" ] && [ "$answer" != "N" ]; then
    open "$APP"
fi
