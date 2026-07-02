# AniStream — streaming local propulsé par yt-dlp

Serveur web personnel, pensé pour tourner sur ton PC, qui permet de se constituer une
bibliothèque d'animés/séries en local et de la regarder dans le navigateur, façon
Netflix : page d'accueil avec héros et rangées, fiches séries par saison, et lecteur
vidéo intégré (jusqu'au 4K selon la source). Le téléchargement s'appuie sur les sources
yt-dlp de ce dépôt : tous les sites supportés par yt-dlp (~1800) fonctionnent.

> **Limites** : les plateformes protégées par DRM (Crunchyroll, Netflix, ADN…) ne sont
> pas prises en charge — yt-dlp ne contourne pas les DRM. À utiliser uniquement avec des
> contenus auxquels vous avez légalement accès.

## Installation Windows en un double-clic (recommandé)

Télécharger [`webapp/installer/Install-AniStream.bat`](installer/Install-AniStream.bat)
et double-cliquer dessus : tout est installé automatiquement (application, Python
autonome, ffmpeg), **sans droits administrateur**, avec une **icône sur le Bureau** qui
lance AniStream d'un double-clic. Détails dans [`installer/README.md`](installer/README.md).

## Installation manuelle (Linux, macOS, ou depuis les sources)

```bash
pip install -r webapp/requirements.txt
```

`ffmpeg` est fortement recommandé (fusion vidéo+audio en mp4, conversion des sous-titres
en VTT pour le lecteur, miniatures) :

```bash
sudo apt install ffmpeg        # Debian/Ubuntu
winget install ffmpeg          # Windows
brew install ffmpeg            # macOS
```

## Lancement

Depuis la racine du dépôt :

```bash
python3 webapp/app.py
```

Puis ouvrir <http://127.0.0.1:8000> dans ton navigateur. Tout reste sur ta machine :
les fichiers sont enregistrés dans `webapp/media/` (modifiable, voir Configuration).

## Utilisation

### 1. Rechercher un animé ou une série (onglet Recherche)

Tape un titre (par exemple `one piece vostfr`) et AniStream interroge en parallèle
plusieurs moteurs de recherche vidéo :

| Moteur       | Couverture                                                        |
|--------------|-------------------------------------------------------------------|
| YouTube      | vidéos et, en mode « Playlists », saisons/playlists entières      |
| Google Vidéo | méta-moteur : trouve des vidéos hébergées sur de très nombreux sites |
| Yahoo Vidéo  | méta-moteur, idem                                                 |
| BiliBili     | beaucoup d'animés asiatiques                                      |
| NicoNico     | idem                                                              |

Les résultats indiquent automatiquement **sur quel site** la vidéo est disponible
(domaine affiché sous le titre). Un clic sur **Télécharger** pré-remplit le nom de la
série (dossier de la bibliothèque) et lance le téléchargement via yt-dlp depuis le site
trouvé.

Deux modes :

- **Vidéos / épisodes** : cherche des vidéos individuelles sur tous les moteurs.
- **Playlists YouTube** : cherche des playlists (pratique pour récupérer une saison
  complète d'un coup — chaque épisode est numéroté automatiquement).

> Note d'honnêteté : il n'existe pas de recherche universelle sur les ~1800 sites —
> seuls les sites exposant un moteur de recherche sont interrogeables directement. Les
> méta-moteurs (Google/Yahoo Vidéo) comblent l'essentiel du reste. Pour un site précis
> non couvert, copie simplement l'URL de l'épisode ou de la playlist dans l'onglet
> Téléchargements : yt-dlp saura presque toujours la télécharger.

### 2. Suivre une série (téléchargement automatique)

Deux façons :

- bouton **★ Suivre** sur un résultat playlist de la Recherche ;
- section **Séries suivies** de l'onglet Téléchargements (URL de playlist/chaîne + nom
  de série).

AniStream vérifie ensuite périodiquement (toutes les 6 h par défaut, réglable via
`ANISTREAM_CHECK_HOURS`) et télécharge **uniquement les nouveaux épisodes**, grâce à
l'archive yt-dlp (`.anistream/archive.txt` dans le dossier de la série). Un épisode
supprimé de la bibliothèque n'est pas retéléchargé. La première vérification part
immédiatement, et un bouton « Vérifier » permet de forcer un passage.

### 3. Métadonnées AniList (affiches, synopsis, genres, note)

À la première apparition d'une série (téléchargement ou suivi), AniStream interroge
l'API publique [AniList](https://anilist.co) avec le nom de la série et enregistre
localement : titre officiel, affiche, bannière, synopsis, genres, note et nombre
d'épisodes (`.anistream/meta.json`, `cover.jpg`, `banner.jpg`). L'accueil et les fiches
séries les utilisent automatiquement.

Si la correspondance est mauvaise (nom de dossier trop vague), le bouton
**↻ Métadonnées** d'une fiche série permet de relancer la recherche avec un autre titre.

### 4. Télécharger par URL (onglet Téléchargements)

Coller n'importe quelle URL supportée par yt-dlp :

- une **vidéo individuelle** (YouTube ou autre) ;
- une **playlist YouTube** ou une page de saison : tous les épisodes sont téléchargés
  et numérotés (`01 - …`, `02 - …`) ;
- indiquer le nom de la série et éventuellement le numéro de saison pour le rangement.

La progression s'affiche en direct (2 téléchargements en parallèle maximum).

### 5. Regarder (Accueil)

L'accueil affiche un héros avec ta série la plus récente, une rangée « Continuer la
lecture » et ta bibliothèque en carrousel. Chaque fiche série liste les épisodes par
saison avec leur progression. Le lecteur intégré propose :

- contrôles personnalisés (lecture, ±10 s, volume, vitesse ×0.5 à ×2, Picture-in-Picture,
  plein écran) avec masquage automatique ;
- raccourcis clavier : `espace`/`K` lecture, `←`/`→` ou `J`/`L` ±10 s, `↑`/`↓` volume,
  `M` muet, `F` plein écran ;
- menu de sous-titres, badge de qualité (SD/HD/FHD/2K/**4K** selon la vidéo) ;
- reprise là où tu t'étais arrêté, enchaînement automatique de l'épisode suivant avec
  compte à rebours, marquage « vu ».

Les fichiers sont rangés dans `webapp/media/<Série>/<Saison XX>/…` — le dossier peut
aussi être alimenté à la main avec des vidéos existantes, elles apparaîtront dans la
bibliothèque au prochain rechargement.

## Configuration (variables d'environnement)

| Variable          | Défaut         | Rôle                                    |
|-------------------|----------------|-----------------------------------------|
| `ANISTREAM_MEDIA` | `webapp/media` | Dossier de la bibliothèque              |
| `ANISTREAM_HOST`  | `127.0.0.1`    | Interface d'écoute                      |
| `ANISTREAM_PORT`  | `8000`         | Port                                    |
| `ANISTREAM_LANGS` | `fr,en`        | Langues de sous-titres à récupérer      |
| `ANISTREAM_CHECK_HOURS` | `6`      | Intervalle de vérification des séries suivies |
| `ANISTREAM_DATA`  | `webapp/`      | Dossier des données persistantes (`watches.json`) |

Exemple pour stocker la bibliothèque dans tes Vidéos :

```bash
ANISTREAM_MEDIA=~/Videos/Animes python3 webapp/app.py
```

> Le serveur n'a pas d'authentification : garde l'écoute sur `127.0.0.1` (défaut),
> c'est-à-dire accessible uniquement depuis ton PC.

## Développement du frontend

Le frontend est une application React (Vite) dans `frontend/`. Un build est déjà commité
dans `frontend/dist/`, donc **aucune installation Node n'est nécessaire pour utiliser
AniStream**. Pour le modifier :

```bash
cd webapp/frontend
npm install
npm run dev      # serveur de dev avec proxy vers l'API (lancer app.py à côté)
npm run build    # régénère dist/ servi par FastAPI
```

## Notes techniques

- Backend FastAPI dans `app.py` :
  - recherche : extracteurs `SearchInfoExtractor` de yt-dlp interrogés en parallèle
    (extraction « flat », 30 s maximum) ; le mode playlists utilise la page de
    résultats YouTube filtrée sur les playlists ;
  - téléchargements : file yt-dlp avec hooks de progression ;
  - bibliothèque : scan du dossier média (séries → saisons → épisodes, sous-titres et
    miniatures associés) ;
  - streaming HTTP avec support des requêtes `Range` (indispensable pour se déplacer
    dans la vidéo).
- Frontend React 19 + Vite dans `frontend/` (routeur par hash, lecteur vidéo custom,
  états de lecture dans le localStorage), servi par FastAPI depuis `frontend/dist/`.
- Les vidéos sont téléchargées en mp4/h264 en priorité pour la lecture native dans le
  navigateur — jusqu'au 4K quand la source le propose ; le mkv est servi mais sa
  lecture dépend des codecs du navigateur.
