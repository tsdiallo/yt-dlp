# Installateurs AniStream

Le **guide d'installation complet, pas à pas et illustré** (Windows et macOS, avec
les réponses aux avertissements SmartScreen/Gatekeeper) est dans le
[README principal d'AniStream](../README.md).

## En bref

| Système | Fichier à télécharger puis double-cliquer |
|---|---|
| Windows 10/11 | [`Install-AniStream.bat`](Install-AniStream.bat) |
| macOS | [`Install-AniStream.command`](Install-AniStream.command) *(premier lancement : clic droit → Ouvrir)* |

Les deux installateurs :

- installent tout automatiquement dans le dossier utilisateur, **sans droits
  administrateur** : application, Python autonome/venv isolé, ffmpeg, dépendances ;
- créent une **icône sur le Bureau** (et menu Démarrer / `~/Applications`) qui lance
  AniStream d'un double-clic ;
- proposent le **démarrage automatique** avec la session (serveur en arrière-plan
  pour les séries suivies) ;
- installent un **désinstalleur** (`Desinstaller.bat` / `Desinstaller.command`) qui
  conserve la bibliothèque vidéo.

**Mise à jour** : relancer le même installateur — bibliothèque, suivis et base de
données sont conservés (`data/` et le dossier vidéos ne sont pas touchés).

## Contenu du dossier

- `Install-AniStream.bat` — installateur Windows (batch + PowerShell, un seul fichier)
- `Install-AniStream.command` — installateur macOS (bash)
- `anistream.ico` / `anistream.icns` — icônes Windows / macOS
