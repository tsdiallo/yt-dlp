# AniStream — ton Netflix personnel, sur ton ordinateur

AniStream est une application qui s'installe sur **ton PC Windows ou ton Mac** et qui
te permet de :

- 🔍 **chercher** un animé ou une série sur plusieurs moteurs à la fois ;
- ⬇️ **télécharger** des épisodes ou des saisons entières (grâce à yt-dlp, qui
  connaît ~1800 sites) ;
- 📺 **regarder** le tout dans une belle interface façon Netflix, avec affiches
  officielles, reprise de lecture, bouton « Passer l'intro », etc. ;
- 🔔 **suivre** tes séries : les nouveaux épisodes se téléchargent tout seuls et tu
  reçois une notification.

Tout reste **sur ton ordinateur** : pas de compte, pas d'abonnement, pas de cloud.

> ⚠️ **À savoir avant de commencer**
> - Les plateformes protégées par DRM (Crunchyroll, Netflix, ADN, Disney+…) ne
>   fonctionnent **pas** : yt-dlp ne contourne pas ces protections.
> - À utiliser uniquement avec des contenus auxquels tu as légalement accès.

---

## 🪟 Installation sur Windows (10 ou 11)

**Durée : 5 à 10 minutes, tout est automatique. Aucun droit administrateur requis.**

### Étape 1 — Télécharger l'installateur

1. Ouvre cette page :
   [Install-AniStream.bat](https://github.com/tsdiallo/yt-dlp/blob/master/webapp/installer/Install-AniStream.bat)
2. Clique sur le bouton **⬇ (Download raw file)** en haut à droite du fichier.
3. Le fichier `Install-AniStream.bat` arrive dans ton dossier **Téléchargements**.

### Étape 2 — Lancer l'installation

1. **Double-clique** sur `Install-AniStream.bat`.
2. Windows va probablement afficher un écran bleu « **Windows a protégé votre
   ordinateur** » (SmartScreen). C'est normal : le script n'est pas signé
   numériquement, comme la plupart des petits programmes gratuits.
   👉 Clique sur « **Informations complémentaires** », puis « **Exécuter quand
   même** ».
   (Si tu veux vérifier ce que fait le script, tu peux l'ouvrir avec le Bloc-notes :
   tout est lisible.)
3. Une fenêtre noire s'ouvre et affiche la progression :
   - `[1/5]` téléchargement de l'application ;
   - `[2/5]` téléchargement de Python (une version **autonome**, qui ne touche pas à
     ton ordinateur ni à un éventuel Python déjà installé) ;
   - `[3/5]` installation des composants ;
   - `[4/5]` téléchargement de ffmpeg (~100 Mo — c'est lui qui assemble les vidéos et
     les sous-titres) ;
   - `[5/5]` création du raccourci.
4. Deux questions te sont posées à la fin :
   - « **Verifier les series suivies au demarrage de Windows ?** » → réponds `o` si
     tu veux que tes séries suivies se mettent à jour toutes seules dès que tu
     allumes le PC (recommandé), sinon appuie juste sur Entrée.
   - « **Lancer AniStream maintenant ?** » → appuie sur Entrée pour ouvrir l'appli.

### Étape 3 — C'est installé !

- Une **icône AniStream** (triangle rouge) est apparue **sur ton Bureau** et dans le
  menu Démarrer.
- Un **double-clic** dessus ouvre AniStream dans une fenêtre dédiée.
- Tes vidéos seront rangées dans **`Vidéos\AniStream`**.

> 💡 **Mettre à jour** : relance simplement `Install-AniStream.bat`. Ta bibliothèque
> et tes séries suivies sont conservées.
>
> 🗑 **Désinstaller** : ouvre le dossier `%LOCALAPPDATA%\AniStream` (copie-colle ça
> dans la barre d'adresse de l'Explorateur) et double-clique sur `Desinstaller.bat`.
> Tes vidéos dans `Vidéos\AniStream` ne sont pas supprimées.

---

## 🍎 Installation sur Mac

**Durée : 5 à 10 minutes. Aucun droit administrateur requis.**

### Étape 0 — Vérifier que Python est présent

AniStream a besoin de Python 3. La plupart des Mac récents l'ont déjà. Pour vérifier :
ouvre l'application **Terminal** (Cmd+Espace, tape « Terminal », Entrée) et tape :

```
python3 --version
```

- Si tu vois un numéro de version (ex. `Python 3.11.6`) → c'est bon, passe à
  l'étape 1. (macOS peut te proposer d'installer les « outils de développement » —
  accepte, ça installe Python.)
- Sinon → télécharge Python sur [python.org/downloads](https://www.python.org/downloads/)
  (gros bouton jaune), installe-le comme n'importe quelle app, puis reviens ici.

### Étape 1 — Télécharger l'installateur

1. Ouvre cette page :
   [Install-AniStream.command](https://github.com/tsdiallo/yt-dlp/blob/master/webapp/installer/Install-AniStream.command)
2. Clique sur le bouton **⬇ (Download raw file)**.
3. Le fichier arrive dans ton dossier **Téléchargements**.

### Étape 2 — Lancer l'installation

1. Dans le Finder, **clic droit** (ou Ctrl+clic) sur `Install-AniStream.command`,
   puis **Ouvrir**.
2. macOS affiche « impossible de vérifier le développeur » (Gatekeeper). C'est
   normal pour un script téléchargé : clique sur **Ouvrir** dans la boîte de
   dialogue. *(Un double-clic normal ne suffit pas la première fois — il faut passer
   par clic droit → Ouvrir.)*
   - Sur macOS 15 (Sequoia) et plus récent, si le bouton « Ouvrir » n'apparaît pas :
     va dans **Réglages Système → Confidentialité et sécurité**, descends en bas, et
     clique sur « **Ouvrir quand même** » à côté du message concernant le fichier.
3. Le Terminal s'ouvre et déroule les 5 étapes (application, Python, composants,
   ffmpeg, création de l'app).
4. Réponds aux deux questions de fin (démarrage automatique, lancement immédiat),
   comme sur Windows.

### Étape 3 — C'est installé !

- **AniStream.app** est dans le dossier `~/Applications`, avec un **raccourci sur le
  Bureau**. Double-clique dessus pour ouvrir AniStream dans ton navigateur.
- Tes vidéos seront rangées dans **`Vidéos/AniStream`** (dossier « Movies »).

> 💡 **Mettre à jour** : relance `Install-AniStream.command` (clic droit → Ouvrir).
>
> 🗑 **Désinstaller** : dans le Finder, menu **Aller → Aller au dossier…**, colle
> `~/Library/Application Support/AniStream`, puis double-clique sur
> `Desinstaller.command`. Tes vidéos sont conservées.

---

## 📖 Guide d'utilisation

Au premier lancement, ta bibliothèque est vide. Voici le parcours type.

### 1. Chercher un animé — onglet **Recherche**

1. Clique sur **Recherche** dans la barre du haut.
2. Tape le nom de ce que tu cherches, par exemple `one piece vostfr`.
3. Choisis le type :
   - **Vidéos / épisodes** : cherche des vidéos sur YouTube, Google Vidéo, Yahoo
     (qui indexent des milliers de sites), BiliBili et NicoNico ;
   - **Playlists YouTube** : cherche des playlists — idéal pour récupérer une
     **saison entière d'un coup**.
4. Les résultats s'affichent groupés par moteur, avec **le site où la vidéo est
   hébergée** indiqué sous chaque titre. Le bouton **Ouvrir** permet de vérifier la
   vidéo dans un nouvel onglet avant de la télécharger.

### 2. Télécharger

Sur un résultat de recherche, clique **Télécharger** :

- **Série (dossier)** : le nom sous lequel l'épisode sera rangé (ex. `One Piece`).
  C'est ce nom qui sert aussi à retrouver l'affiche et le synopsis officiels.
- **Saison** : optionnel, pour ranger en `Saison 01`, `Saison 02`…
- Clique **Lancer**. La progression est visible dans l'onglet **Téléchargements**.

Tu peux aussi **coller directement une URL** (épisode, playlist, chaîne) dans
l'onglet Téléchargements — pratique pour un site que la recherche ne couvre pas.

> 💡 Les épisodes d'une playlist sont automatiquement numérotés (`01 - …`, `02 - …`)
> et l'affiche/le synopsis de la série sont récupérés tout seuls depuis AniList.

### 3. Suivre une série (téléchargement automatique) — bouton **★ Suivre**

Sur un résultat de type **playlist**, clique **★ Suivre** au lieu de Lancer :

- tous les épisodes disponibles sont téléchargés immédiatement ;
- ensuite, AniStream **revérifie toutes les 6 heures** et télécharge les nouveaux
  épisodes dès leur sortie ;
- tu reçois une **notification** (en bas à droite sur Windows, en haut à droite sur
  Mac) quand de nouveaux épisodes sont arrivés.

Tes suivis se gèrent dans l'onglet **Téléchargements → Séries suivies** (vérifier
maintenant, arrêter de suivre). Un épisode que tu supprimes ne sera **pas**
retéléchargé.

### 4. Regarder — onglet **Accueil**

- L'accueil affiche ta série la plus récente en grand, une rangée **Continuer la
  lecture**, ta liste **À voir** et ta bibliothèque.
- La **barre de recherche et les filtres** (genre, statut, tri par note…) aident à
  s'y retrouver quand la bibliothèque grandit.
- Clique sur une série → la fiche montre l'affiche, la note, le synopsis et les
  épisodes par saison. Clique sur un épisode → la lecture démarre.

**Dans le lecteur :**

| Action | Souris | Clavier |
|---|---|---|
| Lecture / pause | clic sur la vidéo | `Espace` ou `K` |
| Reculer / avancer de 10 s | boutons ↺10 / 10↻ | `←` / `→` |
| Volume | molette sur l'icône 🔊 | `↑` / `↓` |
| Couper le son | 🔊 | `M` |
| Plein écran | ⛶ | `F` ou double-clic |
| Épisode suivant | ⏭ | — |
| Sous-titres | CC | — |
| Vitesse ×0.5 à ×2 | 1× | — |

- La lecture **reprend là où tu t'étais arrêté**, et l'épisode suivant s'enchaîne
  automatiquement (avec un compte à rebours annulable).
- Un badge indique la qualité réelle (HD, FHD, **4K**…).
- Si une vidéo refuse de se lire (format exotique), AniStream la **convertit
  automatiquement en direct** — tu n'as rien à faire, un badge « transcodage »
  apparaît simplement.

### 5. Passer l'intro 🎵

Pour ne plus jamais te retaper le générique :

1. Pendant un épisode, mets-toi au **début** du générique, ouvre le menu **⏩** et
   clique « Début d'intro = … ».
2. Avance à la **fin** du générique, menu **⏩** → « Fin d'intro = … ».
3. C'est tout : sur **tous les épisodes de la série**, un bouton **« Passer
   l'intro »** apparaîtra au bon moment.

### 6. Sous-titres

- Les sous-titres disponibles (français, anglais) sont téléchargés automatiquement
  avec chaque épisode → menu **CC** du lecteur.
- Pas de sous-titres pour un épisode ? Le menu **CC → ✨ Générer par IA (Whisper)**
  peut en créer automatiquement (fonction optionnelle, voir la section avancée).

### 7. Faire le ménage — onglet **Stats**

L'onglet **Stats** montre combien d'épisodes tu as vus, le temps de visionnage et
**l'espace disque occupé par chaque série**. Les boutons **🗑 vus** suppriment d'un
clic les épisodes que tu as déjà regardés (série par série, ou tout d'un coup) —
et ils ne seront pas retéléchargés par tes suivis.

---

## ❓ Problèmes courants

**« Windows a protégé votre ordinateur » / « développeur non identifié »**
→ Normal (script non signé) : voir les étapes d'installation ci-dessus. Le contenu
des scripts est lisible avec un éditeur de texte.

**La recherche ne trouve pas ma série**
→ Essaie d'autres mots-clés (`vostfr`, `episode 1`, titre japonais…). Si tu connais
un site qui a la série, va sur la page de l'épisode dans ton navigateur, copie
l'URL et colle-la dans l'onglet **Téléchargements** : yt-dlp connaît ~1800 sites.

**Un téléchargement échoue**
→ Certains sites bloquent ou retirent des vidéos. Réessaie, ou trouve une autre
source via la recherche. Les sites à DRM (Crunchyroll, Netflix, ADN…) ne
fonctionneront jamais — c'est une limite volontaire de yt-dlp.

**La vidéo ne se lit pas / écran noir**
→ AniStream bascule normalement tout seul en mode « transcodage ». Si ça ne suffit
pas, vérifie que ffmpeg s'est bien installé (relance l'installateur).

**L'affiche/le synopsis ne correspondent pas à ma série**
→ Sur la fiche série, bouton **↻ Métadonnées** : corrige le titre recherché
(ex. `Kimetsu no Yaiba` au lieu de `Demon Slayer S2`).

**Mon PC s'est éteint pendant un téléchargement**
→ Au prochain lancement, les téléchargements interrompus **reprennent tout seuls**.

**AniStream ne s'ouvre pas**
→ Attends quelques secondes après le double-clic (le serveur démarre), puis ouvre
manuellement `http://127.0.0.1:8000` dans ton navigateur. Toujours rien ? Regarde
le fichier `server.log` dans le dossier d'installation et ouvre un ticket avec son
contenu.

---

## 🔧 Pour les utilisateurs avancés

### Installation manuelle (Linux ou depuis les sources)

```bash
git clone https://github.com/tsdiallo/yt-dlp && cd yt-dlp
pip install -r webapp/requirements.txt
sudo apt install ffmpeg          # fortement recommandé
python3 webapp/app.py            # puis http://127.0.0.1:8000
```

### Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `ANISTREAM_MEDIA` | `webapp/media` | Dossier de la bibliothèque |
| `ANISTREAM_DATA`  | `webapp/` | Données persistantes (suivis, base SQLite) |
| `ANISTREAM_HOST` / `ANISTREAM_PORT` | `127.0.0.1` / `8000` | Adresse d'écoute |
| `ANISTREAM_LANGS` | `fr,en` | Langues de sous-titres à récupérer |
| `ANISTREAM_CHECK_HOURS` | `6` | Intervalle de vérification des suivis |
| `ANISTREAM_WHISPER_MODEL` | `small` | Modèle des sous-titres IA (`tiny`…`large-v3`) |
| `ANISTREAM_POSTHOG_KEY` | *(vide = désactivé)* | Clé projet PostHog pour les statistiques d'usage |
| `ANISTREAM_POSTHOG_HOST` | `https://eu.i.posthog.com` | Instance PostHog |

### Sous-titres IA (Whisper)

```bash
pip install faster-whisper
# Windows (installateur) :
#   %LOCALAPPDATA%\AniStream\python\python.exe -m pip install faster-whisper
# macOS (installateur) :
#   "$HOME/Library/Application Support/AniStream/venv/bin/pip" install faster-whisper
```

Puis redémarre AniStream. Le premier lancement télécharge le modèle (~500 Mo pour
`small`). La génération se suit dans l'onglet Téléchargements (badge IA).

### Statistiques d'usage avec PostHog (opt-in, désactivé par défaut)

AniStream peut envoyer des événements anonymes (téléchargements, lectures, pages
vues…) vers **ton propre projet [PostHog](https://posthog.com)** — utile pour voir
tes habitudes de visionnage sur de beaux dashboards. Rien n'est envoyé tant que la
clé n'est pas configurée :

```bash
ANISTREAM_POSTHOG_KEY=phc_xxx python3 webapp/app.py
# instance US : ajouter ANISTREAM_POSTHOG_HOST=https://us.i.posthog.com
```

Événements envoyés : `app_started`, `search`, `download_started/finished`,
`watch_added/check`, `ui_page`, `ui_play`, `subtitle_generated`,
`episodes_purged`. Identifiant : un ID aléatoire local (aucune donnée personnelle).

### Développer le frontend

```bash
cd webapp/frontend
npm install
npm run dev      # serveur de dev (proxy API vers app.py)
npm run build    # régénère dist/ servi par FastAPI
```

Le build est commité dans `frontend/dist/`, donc les utilisateurs n'ont jamais
besoin de Node.
