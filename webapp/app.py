"""AniStream — serveur de streaming local propulsé par yt-dlp.

Lancement depuis la racine du dépôt :

    python3 webapp/app.py

Variables d'environnement :
    ANISTREAM_MEDIA   dossier de la bibliothèque (défaut : webapp/media)
    ANISTREAM_HOST    interface d'écoute (défaut : 127.0.0.1)
    ANISTREAM_PORT    port (défaut : 8000)
    ANISTREAM_LANGS   langues de sous-titres, séparées par des virgules (défaut : fr,en)
"""

import functools
import json
import mimetypes
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor, wait
from pathlib import Path
from urllib.parse import urlencode, urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

import yt_dlp  # noqa: E402  (importé depuis les sources du dépôt)

from fastapi import FastAPI, HTTPException, Request  # noqa: E402
from fastapi.responses import FileResponse, StreamingResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from pydantic import BaseModel  # noqa: E402

WEBAPP_DIR = Path(__file__).resolve().parent
MEDIA_DIR = Path(os.environ.get('ANISTREAM_MEDIA', WEBAPP_DIR / 'media')).resolve()
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

SUB_LANGS = [x.strip() for x in os.environ.get('ANISTREAM_LANGS', 'fr,en').split(',') if x.strip()]
FFMPEG = shutil.which('ffmpeg')
HAS_FFMPEG = bool(FFMPEG)

# données persistantes (hors du dossier de l'application si ANISTREAM_DATA est
# défini, pour survivre aux mises à jour — utilisé par les installateurs)
DATA_DIR = Path(os.environ.get('ANISTREAM_DATA', WEBAPP_DIR)).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_FILE = DATA_DIR / 'anistream.db'
db_lock = threading.Lock()


def db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


with db_lock, db() as _conn:
    _conn.execute('''CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        kind TEXT,
        url TEXT,
        series TEXT,
        season INTEGER,
        title TEXT,
        status TEXT,
        error TEXT,
        created_at REAL,
        finished_at REAL
    )''')


def db_record(job):
    with db_lock, db() as conn:
        conn.execute(
            '''INSERT INTO downloads (id, kind, url, series, season, title, status, error, created_at, finished_at)
               VALUES (:id, :kind, :url, :series, :season, :title, :status, :error, :created_at, :finished_at)
               ON CONFLICT(id) DO UPDATE SET
                 title = excluded.title, status = excluded.status,
                 error = excluded.error, finished_at = excluded.finished_at''',
            {
                'id': job['id'], 'kind': job.get('kind', 'manual'), 'url': job['url'],
                'series': job['series'], 'season': job.get('season'),
                'title': job.get('title'), 'status': job['status'],
                'error': job.get('error'), 'created_at': job.get('created_at'),
                'finished_at': job.get('finished_at'),
            })

VIDEO_EXTS = {'.mp4', '.mkv', '.webm', '.m4v', '.mov'}
THUMB_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}
STREAM_CHUNK = 1024 * 1024

app = FastAPI(title='AniStream')


# ---------------------------------------------------------------------------
# Gestionnaire de téléchargements
# ---------------------------------------------------------------------------

jobs = {}
jobs_lock = threading.Lock()
download_slots = threading.Semaphore(2)


class DownloadRequest(BaseModel):
    url: str
    series: str
    season: int | None = None


def sanitize_name(name):
    return re.sub(r'[\\/:*?"<>|]', '_', name).strip() or 'Sans titre'


def notify(title, message):
    """Notification système (toast Windows, bannière macOS, notify-send Linux)."""
    try:
        if sys.platform == 'win32':
            script = (
                "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, "
                "ContentType = WindowsRuntime] | Out-Null; "
                "$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent("
                "[Windows.UI.Notifications.ToastTemplateType]::ToastText02); "
                "$texts = $xml.GetElementsByTagName('text'); "
                f"$texts.Item(0).AppendChild($xml.CreateTextNode('{title.replace(chr(39), chr(39) * 2)}')) | Out-Null; "
                f"$texts.Item(1).AppendChild($xml.CreateTextNode('{message.replace(chr(39), chr(39) * 2)}')) | Out-Null; "
                "$toast = New-Object Windows.UI.Notifications.ToastNotification $xml; "
                "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("
                "'AniStream').Show($toast)"
            )
            encoded = __import__('base64').b64encode(script.encode('utf-16-le')).decode()
            subprocess.Popen(['powershell', '-NoProfile', '-EncodedCommand', encoded],
                             creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        elif sys.platform == 'darwin':
            m, t = message.replace('"', '\\"'), title.replace('"', '\\"')
            subprocess.Popen(['osascript', '-e',
                              f'display notification "{m}" with title "{t}"'])
        elif shutil.which('notify-send'):
            subprocess.Popen(['notify-send', title, message])
    except Exception:
        pass


def series_meta_dir(series_name):
    return MEDIA_DIR / sanitize_name(series_name) / '.anistream'


def archive_file(series_name):
    return series_meta_dir(series_name) / 'archive.txt'


# ---------------------------------------------------------------------------
# Métadonnées AniList
# ---------------------------------------------------------------------------

ANILIST_QUERY = '''query ($s: String) {
  Media(search: $s, type: ANIME) {
    id
    title { romaji english }
    description(asHtml: false)
    genres
    averageScore
    episodes
    status
    coverImage { extraLarge }
    bannerImage
  }
}'''


def http_get(url, timeout=20):
    req = urllib.request.Request(url, headers={'User-Agent': 'AniStream/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def fetch_anilist(search):
    body = json.dumps({'query': ANILIST_QUERY, 'variables': {'s': search}}).encode()
    req = urllib.request.Request(
        'https://graphql.anilist.co', data=body,
        headers={'Content-Type': 'application/json', 'User-Agent': 'AniStream/1.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r).get('data', {}).get('Media')


def clean_description(html):
    if not html:
        return None
    text = re.sub(r'<br\s*/?>', '\n', html)
    return re.sub(r'<[^>]+>', '', text).strip()


def refresh_metadata(series_name, search=None):
    media = fetch_anilist(search or series_name)
    if not media:
        return None
    mdir = series_meta_dir(series_name)
    mdir.mkdir(parents=True, exist_ok=True)
    meta = {
        'anilist_id': media['id'],
        'title': (media.get('title') or {}).get('english') or (media.get('title') or {}).get('romaji'),
        'description': clean_description(media.get('description')),
        'genres': media.get('genres') or [],
        'score': media.get('averageScore'),
        'episodes': media.get('episodes'),
        'status': media.get('status'),
        'fetched_at': time.time(),
    }
    for key, url in (('cover', (media.get('coverImage') or {}).get('extraLarge')),
                     ('banner', media.get('bannerImage'))):
        if url:
            try:
                (mdir / f'{key}.jpg').write_bytes(http_get(url))
            except Exception:
                pass
    (mdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


def load_metadata(sdir):
    mdir = sdir / '.anistream'
    try:
        meta = json.loads((mdir / 'meta.json').read_text())
    except (OSError, ValueError):
        return None
    for key in ('cover', 'banner'):
        f = mdir / f'{key}.jpg'
        meta[key] = str(f.relative_to(MEDIA_DIR)) if f.is_file() else None
    return meta


def ensure_metadata(series_name):
    """Récupère les métadonnées AniList à la première apparition d'une série."""
    if not (series_meta_dir(series_name) / 'meta.json').is_file():
        try:
            refresh_metadata(series_name)
        except Exception:
            pass


def read_intro_raw(sdir):
    try:
        data = json.loads((sdir / '.anistream' / 'intro.json').read_text())
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def load_intro(sdir):
    data = read_intro_raw(sdir)
    if isinstance(data.get('start'), (int, float)) and isinstance(data.get('end'), (int, float)) \
            and data['end'] > data['start']:
        return {'start': float(data['start']), 'end': float(data['end'])}
    return None


class IntroRequest(BaseModel):
    start: float | None = None
    end: float | None = None


@app.post('/api/series/{name}/intro')
def set_intro(name: str, req: IntroRequest):
    """Définit les marqueurs d'intro de la série (start/end en secondes).
    Les champs absents conservent la valeur existante ; start et end à null effacent."""
    sdir = MEDIA_DIR / sanitize_name(name)
    if not sdir.is_dir():
        raise HTTPException(404, 'Série introuvable')
    mdir = sdir / '.anistream'
    intro_file = mdir / 'intro.json'
    if req.start is None and req.end is None:
        intro_file.unlink(missing_ok=True)
        return {'intro': None}
    current = read_intro_raw(sdir)
    if req.start is not None:
        current['start'] = max(0.0, req.start)
    if req.end is not None:
        current['end'] = max(0.0, req.end)
    mdir.mkdir(parents=True, exist_ok=True)
    intro_file.write_text(json.dumps(current))
    return {'intro': load_intro(sdir) or current}


class MetadataRequest(BaseModel):
    query: str | None = None


@app.post('/api/series/{name}/metadata')
def series_metadata(name: str, req: MetadataRequest):
    try:
        meta = refresh_metadata(name, req.query)
    except Exception as e:
        raise HTTPException(502, f'AniList injoignable : {e}')
    if meta is None:
        raise HTTPException(404, 'Aucun animé trouvé sur AniList pour cette recherche')
    return meta


def progress_hook(job_id):
    def hook(d):
        with jobs_lock:
            job = jobs.get(job_id)
            if job is None:
                return
            info = d.get('info_dict') or {}
            if info.get('title'):
                job['title'] = info['title']
            if d['status'] == 'downloading':
                job['status'] = 'downloading'
                total = d.get('total_bytes') or d.get('total_bytes_estimate')
                if total:
                    job['progress'] = round(d.get('downloaded_bytes', 0) / total * 100, 1)
                job['speed'] = d.get('speed')
                job['eta'] = d.get('eta')
            elif d['status'] == 'finished':
                job['status'] = 'processing'
                job['progress'] = 100.0
                job['speed'] = None
                job['eta'] = None
    return hook


def build_ydl_opts(req: DownloadRequest, job_id):
    dest = MEDIA_DIR / sanitize_name(req.series)
    if req.season is not None:
        dest = dest / f'Saison {req.season:02d}'
    adir = archive_file(req.series)
    adir.parent.mkdir(parents=True, exist_ok=True)
    opts = {
        'outtmpl': str(dest / '%(playlist_index&{} - |)s%(title)s.%(ext)s'),
        'progress_hooks': [progress_hook(job_id)],
        'ignoreerrors': 'only_download',
        'noprogress': True,
        'writethumbnail': True,
        'writesubtitles': True,
        'subtitleslangs': SUB_LANGS,
        'restrictfilenames': False,
        'windowsfilenames': True,
        # mémorise ce qui a déjà été téléchargé : les suivis ne reprennent
        # que les nouveaux épisodes, même si un fichier a été supprimé
        'download_archive': str(adir),
    }
    if HAS_FFMPEG:
        # mp4/h264 en priorité pour la lecture native dans le navigateur
        opts['format'] = 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b'
        opts['merge_output_format'] = 'mp4'
        opts['postprocessors'] = [
            {'key': 'FFmpegSubtitlesConvertor', 'format': 'vtt'},
            {'key': 'FFmpegThumbnailsConvertor', 'format': 'jpg'},
        ]
    else:
        # sans ffmpeg : pas de fusion possible, on prend le meilleur fichier unique
        opts['format'] = 'b[ext=mp4]/b'
    return opts


def archive_count(series_name):
    try:
        return len(archive_file(series_name).read_text().splitlines())
    except OSError:
        return 0


def run_download(job_id, req: DownloadRequest):
    with download_slots:
        with jobs_lock:
            jobs[job_id]['status'] = 'downloading'
            kind = jobs[job_id].get('kind', 'manual')
            db_record(jobs[job_id])
        ensure_metadata(req.series)
        before = archive_count(req.series) if kind == 'watch' else 0
        try:
            with yt_dlp.YoutubeDL(build_ydl_opts(req, job_id)) as ydl:
                retcode = ydl.download([req.url])
            with jobs_lock:
                job = jobs[job_id]
                if retcode == 0:
                    job['status'] = 'done'
                    job['progress'] = 100.0
                else:
                    job['status'] = 'error'
                    job['error'] = 'Certains éléments ont échoué (voir les logs du serveur)'
        except Exception as e:
            with jobs_lock:
                jobs[job_id]['status'] = 'error'
                jobs[job_id]['error'] = str(e)
        with jobs_lock:
            jobs[job_id]['finished_at'] = time.time()
            db_record(jobs[job_id])
        if kind == 'watch':
            new_count = archive_count(req.series) - before
            if new_count > 0:
                notify('AniStream',
                       f'{req.series} : {new_count} nouvel épisode téléchargé' if new_count == 1
                       else f'{req.series} : {new_count} nouveaux épisodes téléchargés')


@app.post('/api/download')
def start_download(req: DownloadRequest):
    if not req.url.strip():
        raise HTTPException(400, 'URL manquante')
    if not req.series.strip():
        raise HTTPException(400, 'Nom de série manquant')
    return enqueue_download(req)


@app.get('/api/downloads')
def list_downloads():
    with jobs_lock:
        return sorted(jobs.values(), key=lambda j: j['id'])


@app.post('/api/downloads/clear')
def clear_downloads():
    with jobs_lock:
        for jid in [j['id'] for j in jobs.values() if j['status'] in ('done', 'error')]:
            del jobs[jid]
    return {'ok': True}


# ---------------------------------------------------------------------------
# Suivi automatique de séries
# ---------------------------------------------------------------------------

WATCHES_FILE = DATA_DIR / 'watches.json'
CHECK_HOURS = float(os.environ.get('ANISTREAM_CHECK_HOURS', '6'))

watches_lock = threading.Lock()
try:
    watches = json.loads(WATCHES_FILE.read_text())
except (OSError, ValueError):
    watches = []


def save_watches():
    WATCHES_FILE.write_text(json.dumps(watches, ensure_ascii=False, indent=1))


class WatchRequest(BaseModel):
    url: str
    series: str
    season: int | None = None


def enqueue_download(req: DownloadRequest, kind='manual'):
    job_id = uuid.uuid4().hex[:12]
    with jobs_lock:
        jobs[job_id] = {
            'id': job_id,
            'kind': kind,
            'url': req.url,
            'series': sanitize_name(req.series),
            'season': req.season,
            'title': None,
            'status': 'queued',
            'progress': 0.0,
            'speed': None,
            'eta': None,
            'error': None,
            'created_at': time.time(),
            'finished_at': None,
        }
        db_record(jobs[job_id])
    threading.Thread(target=run_download, args=(job_id, req), daemon=True).start()
    return jobs[job_id]


@app.get('/api/history')
def download_history(limit: int = 50):
    with db_lock, db() as conn:
        rows = conn.execute(
            'SELECT * FROM downloads ORDER BY created_at DESC LIMIT ?',
            (max(1, min(limit, 200)),)).fetchall()
    return [dict(r) for r in rows]


def recover_interrupted_downloads():
    """Relance au démarrage les téléchargements coupés par un arrêt du serveur."""
    with db_lock, db() as conn:
        rows = conn.execute(
            "SELECT * FROM downloads WHERE status IN ('queued', 'downloading', 'processing')"
        ).fetchall()
        conn.execute(
            "UPDATE downloads SET status = 'interrupted' "
            "WHERE status IN ('queued', 'downloading', 'processing')")
    for r in rows:
        enqueue_download(
            DownloadRequest(url=r['url'], series=r['series'], season=r['season']),
            kind=r['kind'] or 'manual')


def check_watch(watch):
    with watches_lock:
        watch['last_check'] = time.time()
        save_watches()
    return enqueue_download(
        DownloadRequest(url=watch['url'], series=watch['series'], season=watch.get('season')),
        kind='watch')


@app.get('/api/watches')
def list_watches():
    with watches_lock:
        return {'watches': list(watches), 'check_hours': CHECK_HOURS}


@app.post('/api/watches')
def add_watch(req: WatchRequest):
    if not req.url.strip() or not req.series.strip():
        raise HTTPException(400, 'URL ou nom de série manquant')
    watch = {
        'id': uuid.uuid4().hex[:12],
        'url': req.url.strip(),
        'series': sanitize_name(req.series),
        'season': req.season,
        'added_at': time.time(),
        'last_check': None,
    }
    with watches_lock:
        if any(w['url'] == watch['url'] and w['series'] == watch['series'] for w in watches):
            raise HTTPException(409, 'Cette série est déjà suivie avec cette URL')
        watches.append(watch)
        save_watches()
    check_watch(watch)  # première vérification immédiate
    return watch


@app.delete('/api/watches/{watch_id}')
def delete_watch(watch_id: str):
    with watches_lock:
        before = len(watches)
        watches[:] = [w for w in watches if w['id'] != watch_id]
        if len(watches) == before:
            raise HTTPException(404, 'Suivi introuvable')
        save_watches()
    return {'ok': True}


@app.post('/api/watches/{watch_id}/check')
def check_watch_now(watch_id: str):
    with watches_lock:
        watch = next((w for w in watches if w['id'] == watch_id), None)
    if watch is None:
        raise HTTPException(404, 'Suivi introuvable')
    return check_watch(watch)


def watch_loop():
    while True:
        time.sleep(60)
        now = time.time()
        with watches_lock:
            due = [w for w in watches if now - (w.get('last_check') or 0) >= CHECK_HOURS * 3600]
        for w in due:
            try:
                check_watch(w)
            except Exception:
                pass


recover_interrupted_downloads()
threading.Thread(target=watch_loop, daemon=True).start()


# ---------------------------------------------------------------------------
# Recherche multi-sites
# ---------------------------------------------------------------------------

# Extracteurs de recherche yt-dlp interrogés en parallèle. Google Vidéo et
# Yahoo sont des méta-moteurs : ils remontent des vidéos hébergées sur de
# nombreux sites, que yt-dlp sait ensuite télécharger.
SEARCH_SOURCES = [
    ('ytsearch', 'YouTube'),
    ('gvsearch', 'Google Vidéo'),
    ('yvsearch', 'Yahoo Vidéo'),
    ('bilisearch', 'BiliBili'),
    ('nicosearch', 'NicoNico'),
]
SEARCH_TIMEOUT = 30


def flat_extract(query):
    opts = {
        'quiet': True,
        'noprogress': True,
        'extract_flat': True,
        'skip_download': True,
        'ignoreerrors': True,
        'socket_timeout': 15,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(query, download=False)


def entry_to_result(entry, site):
    url = entry.get('url') or entry.get('webpage_url')
    if not url or not url.startswith('http'):
        return None
    return {
        'site': site,
        'source': urlparse(url).netloc.removeprefix('www.') or site,
        'title': entry.get('title') or url,
        'url': url,
        'duration': entry.get('duration'),
        'uploader': entry.get('uploader') or entry.get('channel'),
        'is_playlist': entry.get('_type') == 'playlist' or 'list=' in url,
    }


def search_source(key, label, q, count):
    info = flat_extract(f'{key}{count}:{q}') or {}
    results = []
    for entry in info.get('entries') or []:
        if entry and (r := entry_to_result(entry, label)):
            results.append(r)
    return results


def search_youtube_playlists(q, count):
    # page de résultats YouTube filtrée sur les playlists (sp=EgIQAw==)
    url = 'https://www.youtube.com/results?' + urlencode({'search_query': q, 'sp': 'EgIQAw=='})
    info = flat_extract(url) or {}
    results = []
    for entry in (info.get('entries') or [])[:count]:
        if entry and (r := entry_to_result(entry, 'YouTube')):
            r['is_playlist'] = True
            results.append(r)
    return results


@app.get('/api/search')
def search(q: str, mode: str = 'videos', count: int = 8):
    q = q.strip()
    if not q:
        raise HTTPException(400, 'Recherche vide')
    count = max(1, min(count, 20))

    executor = ThreadPoolExecutor(max_workers=len(SEARCH_SOURCES))
    try:
        if mode == 'playlists':
            futures = {executor.submit(search_youtube_playlists, q, count): 'YouTube'}
        else:
            futures = {
                executor.submit(search_source, key, label, q, count): label
                for key, label in SEARCH_SOURCES
            }
        done, not_done = wait(futures, timeout=SEARCH_TIMEOUT)
        results, failed = [], [futures[f] for f in not_done]
        for fut in done:
            try:
                results.extend(fut.result())
            except Exception:
                failed.append(futures[fut])
        return {'query': q, 'results': results, 'failed_sources': sorted(failed)}
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


# ---------------------------------------------------------------------------
# Bibliothèque
# ---------------------------------------------------------------------------

def find_siblings(video: Path):
    """Sous-titres .vtt et miniature associés à un fichier vidéo."""
    subs, thumb = [], None
    prefix = video.stem + '.'
    for f in video.parent.iterdir():
        if not f.name.startswith(prefix) or f == video:
            continue
        if f.suffix == '.vtt':
            middle = f.name[len(prefix):-len('.vtt')]
            subs.append({'lang': middle or 'und', 'path': str(f.relative_to(MEDIA_DIR))})
        elif f.suffix.lower() in THUMB_EXTS and thumb is None:
            thumb = str(f.relative_to(MEDIA_DIR))
    return subs, thumb


@app.get('/api/library')
def library():
    series_list = []
    for sdir in sorted(MEDIA_DIR.iterdir(), key=lambda p: p.name.lower()):
        if not sdir.is_dir():
            continue
        episodes = []
        for f in sorted(sdir.rglob('*'), key=lambda p: str(p).lower()):
            if not (f.is_file() and f.suffix.lower() in VIDEO_EXTS):
                continue
            subs, thumb = find_siblings(f)
            episodes.append({
                'title': f.stem,
                'path': str(f.relative_to(MEDIA_DIR)),
                'season': f.parent.name if f.parent != sdir else None,
                'subs': subs,
                'thumb': thumb,
                'mtime': f.stat().st_mtime,
            })
        if episodes:
            meta = load_metadata(sdir)
            series_list.append({
                'name': sdir.name,
                'cover': (meta or {}).get('cover') or next((e['thumb'] for e in episodes if e['thumb']), None),
                'meta': meta,
                'intro': load_intro(sdir),
                'episodes': episodes,
            })
    return series_list


def safe_media_path(rel_path):
    target = (MEDIA_DIR / rel_path).resolve()
    if not target.is_relative_to(MEDIA_DIR) or not target.is_file():
        raise HTTPException(404, 'Fichier introuvable')
    return target


@app.delete('/api/media/{rel_path:path}')
def delete_episode(rel_path: str):
    video = safe_media_path(rel_path)
    prefix = video.stem + '.'
    for f in list(video.parent.iterdir()):
        if f == video or f.name.startswith(prefix):
            f.unlink()
    # supprime les dossiers devenus vides (saison puis série)
    parent = video.parent
    while parent != MEDIA_DIR and not any(parent.iterdir()):
        parent.rmdir()
        parent = parent.parent
    return {'ok': True}


# ---------------------------------------------------------------------------
# Streaming avec support des requêtes Range
# ---------------------------------------------------------------------------

@app.get('/api/stream/{rel_path:path}')
def stream(rel_path: str, request: Request):
    file = safe_media_path(rel_path)
    size = file.stat().st_size
    content_type = {
        '.mkv': 'video/x-matroska',
        '.vtt': 'text/vtt',
    }.get(file.suffix.lower()) or mimetypes.guess_type(file.name)[0] or 'application/octet-stream'

    start, end, status = 0, size - 1, 200
    m = re.match(r'bytes=(\d*)-(\d*)$', request.headers.get('range', ''))
    if m and (m.group(1) or m.group(2)):
        if m.group(1):
            start = int(m.group(1))
            if m.group(2):
                end = min(int(m.group(2)), size - 1)
        else:  # suffixe : bytes=-N (les N derniers octets)
            start = max(size - int(m.group(2)), 0)
        if start >= size:
            raise HTTPException(416, 'Range invalide')
        status = 206

    def iter_file():
        with open(file, 'rb') as fh:
            fh.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk = fh.read(min(STREAM_CHUNK, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    headers = {'Accept-Ranges': 'bytes', 'Content-Length': str(end - start + 1)}
    if status == 206:
        headers['Content-Range'] = f'bytes {start}-{end}/{size}'
    return StreamingResponse(iter_file(), status_code=status, headers=headers, media_type=content_type)


# ---------------------------------------------------------------------------
# Transcodage à la volée (secours quand le navigateur ne peut pas lire)
# ---------------------------------------------------------------------------

def _ffmpeg_list(flag, marker):
    try:
        out = subprocess.run([FFMPEG, '-hide_banner', flag],
                             capture_output=True, text=True, timeout=10).stdout
    except Exception:
        return set()
    names = set()
    for line in out.splitlines():
        line = line.strip()
        if line.startswith(marker) and len(line.split()) >= 2:
            names.add(line.split()[1])
    return names


@functools.lru_cache(maxsize=1)
def transcode_profile():
    """Choisit le meilleur profil selon les encodeurs ffmpeg disponibles."""
    if not FFMPEG:
        return None
    venc = _ffmpeg_list('-encoders', 'V')
    aenc = _ffmpeg_list('-encoders', 'A')
    audio = (['-c:a', 'aac', '-b:a', '160k'] if 'aac' in aenc
             else ['-c:a', 'libopus'] if 'libopus' in aenc
             else ['-c:a', 'libvorbis'] if 'libvorbis' in aenc
             else ['-an'])
    if 'libx264' in venc:
        return {
            'args': ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
                     *audio, '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
                     '-f', 'mp4'],
            'mime': 'video/mp4',
        }
    if 'libvpx' in venc:
        args = ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '2M']
        args += audio if audio != ['-c:a', 'aac', '-b:a', '160k'] else ['-an']
        return {'args': [*args, '-f', 'webm'], 'mime': 'video/webm'}
    return None


@app.get('/api/transcode/{rel_path:path}')
def transcode(rel_path: str, t: float = 0):
    file = safe_media_path(rel_path)
    profile = transcode_profile()
    if profile is None:
        raise HTTPException(501, 'ffmpeg indisponible : transcodage impossible')
    cmd = [FFMPEG, '-v', 'error', '-nostdin']
    if t > 0:
        cmd += ['-ss', f'{t:.3f}']
    cmd += ['-i', str(file), *profile['args'], 'pipe:1']
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

    def gen():
        try:
            while chunk := proc.stdout.read(64 * 1024):
                yield chunk
        finally:
            proc.kill()

    return StreamingResponse(gen(), media_type=profile['mime'],
                             headers={'Cache-Control': 'no-store'})


@app.get('/api/mediainfo/{rel_path:path}')
def mediainfo(rel_path: str):
    """Durée du fichier (pour la barre de lecture en mode transcodage)."""
    file = safe_media_path(rel_path)
    duration = None
    ffprobe = shutil.which('ffprobe')
    if ffprobe:
        try:
            out = subprocess.run(
                [ffprobe, '-v', 'error', '-show_entries', 'format=duration',
                 '-of', 'csv=p=0', str(file)],
                capture_output=True, text=True, timeout=15).stdout.strip()
            duration = float(out)
        except (ValueError, subprocess.SubprocessError):
            pass
    if duration is None and FFMPEG:
        # pas de ffprobe : on lit la ligne « Duration: » de ffmpeg -i
        try:
            err = subprocess.run([FFMPEG, '-hide_banner', '-i', str(file)],
                                 capture_output=True, text=True, timeout=15).stderr
            m = re.search(r'Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)', err)
            if m:
                duration = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
        except subprocess.SubprocessError:
            pass
    return {'duration': duration, 'transcodable': transcode_profile() is not None}


# ---------------------------------------------------------------------------
# Frontend (build React dans frontend/dist)
# ---------------------------------------------------------------------------

FRONTEND_DIST = WEBAPP_DIR / 'frontend' / 'dist'


@app.get('/')
def index():
    if not (FRONTEND_DIST / 'index.html').is_file():
        raise HTTPException(500, "Frontend non construit : lancez `npm install && npm run build` dans webapp/frontend")
    return FileResponse(FRONTEND_DIST / 'index.html')


@app.get('/favicon.svg')
def favicon():
    return FileResponse(FRONTEND_DIST / 'favicon.svg')


if (FRONTEND_DIST / 'assets').is_dir():
    app.mount('/assets', StaticFiles(directory=FRONTEND_DIST / 'assets'), name='assets')


if __name__ == '__main__':
    import uvicorn

    host = os.environ.get('ANISTREAM_HOST', '127.0.0.1')
    port = int(os.environ.get('ANISTREAM_PORT', '8000'))
    print(f'AniStream : http://{host}:{port}  (bibliothèque : {MEDIA_DIR})')
    if not HAS_FFMPEG:
        print('ATTENTION : ffmpeg introuvable — qualité limitée, pas de conversion de sous-titres.')
    uvicorn.run(app, host=host, port=port)
