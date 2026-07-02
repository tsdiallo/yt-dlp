# Installateur Windows

## Installation en un double-clic

1. Télécharger **`Install-AniStream.bat`** (bouton « Raw » puis Ctrl+S, ou via le zip du dépôt).
2. Double-cliquer dessus. Le script télécharge et installe tout automatiquement dans
   `%LOCALAPPDATA%\AniStream`, **sans droits administrateur** :
   - l'application (dernière version de la branche `master` de ce dépôt) ;
   - un Python 3.12 autonome (n'affecte pas un Python déjà installé) ;
   - ffmpeg (fusion vidéo+audio, sous-titres) ;
   - les dépendances (FastAPI, uvicorn).
3. À la fin : une **icône AniStream sur le Bureau** et dans le menu Démarrer.

Ensuite, un double-clic sur l'icône démarre le serveur en arrière-plan (s'il ne tourne
pas déjà) et ouvre AniStream dans une fenêtre dédiée (Edge en mode application, sinon
le navigateur par défaut). La bibliothèque est rangée dans `Vidéos\AniStream`.

## Mise à jour

Relancer `Install-AniStream.bat` : l'application est remplacée par la dernière version.
La bibliothèque (`Vidéos\AniStream`) et les séries suivies (`%LOCALAPPDATA%\AniStream\data`)
sont conservées.

## Désinstallation

Double-cliquer sur `Désinstaller.bat` dans `%LOCALAPPDATA%\AniStream`. La bibliothèque
(`Vidéos\AniStream`) est conservée.

## Si Windows SmartScreen s'affiche

Le script n'est pas signé numériquement : cliquer sur « Informations complémentaires »
puis « Exécuter quand même ». Le contenu du script est lisible en l'ouvrant avec un
éditeur de texte.
