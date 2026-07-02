import { useCallback, useEffect, useRef, useState } from 'react'
import { api, postJSON, fmtSpeed } from '../api.js'

const STATUS = {
  queued: ["En file d'attente", 'wait'],
  downloading: ['Téléchargement', 'active'],
  processing: ['Traitement (ffmpeg)…', 'active'],
  done: ['Terminé ✓', 'ok'],
  error: ['Échec', 'err'],
}

const ago = (ts) => {
  if (!ts) return 'jamais'
  const m = Math.round((Date.now() / 1000 - ts) / 60)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`
}

function Watches() {
  const [data, setData] = useState(null)
  const [url, setUrl] = useState('')
  const [series, setSeries] = useState('')
  const [season, setSeason] = useState('')

  const refresh = useCallback(async () => {
    try {
      setData(await api('/api/watches'))
    } catch {
      /* serveur injoignable */
    }
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 10000)
    return () => clearInterval(t)
  }, [refresh])

  const add = async (e) => {
    e.preventDefault()
    try {
      await postJSON('/api/watches', {
        url: url.trim(),
        series: series.trim(),
        season: season ? parseInt(season, 10) : null,
      })
      setUrl('')
      setSeries('')
      setSeason('')
      refresh()
    } catch (err) {
      alert('Erreur : ' + err.message)
    }
  }

  return (
    <section className="watches">
      <h2>Séries suivies</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Les nouveaux épisodes de ces playlists/chaînes sont téléchargés automatiquement
        {data ? ` (vérification toutes les ${data.check_hours} h)` : ''}.
      </p>
      <form className="dl-form" onSubmit={add}>
        <label>
          URL de la playlist / chaîne
          <input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} required />
        </label>
        <label>
          Série (dossier)
          <input value={series} onChange={(e) => setSeries(e.target.value)} required />
        </label>
        <label>
          Saison
          <input type="number" min="0" placeholder="—" value={season} onChange={(e) => setSeason(e.target.value)} />
        </label>
        <button className="btn primary">Suivre</button>
      </form>
      {data?.watches?.length > 0 &&
        data.watches.map((w) => (
          <div key={w.id} className="job watch-row">
            <div className="job-head">
              <span className="job-title">{w.series}</span>
              <span className="watch-actions">
                <button
                  className="btn ghost small"
                  onClick={async () => {
                    await postJSON(`/api/watches/${w.id}/check`, {})
                    refresh()
                  }}
                >
                  Vérifier
                </button>
                <button
                  className="btn ghost small"
                  onClick={async () => {
                    if (!confirm(`Ne plus suivre « ${w.series} » ? (les fichiers sont conservés)`)) return
                    await api('/api/watches/' + w.id, { method: 'DELETE' })
                    refresh()
                  }}
                >
                  ✕
                </button>
              </span>
            </div>
            <div className="job-sub">
              {w.url}
              {w.season != null ? ` · Saison ${w.season}` : ''} · dernière vérification : {ago(w.last_check)}
            </div>
          </div>
        ))}
    </section>
  )
}

const HISTORY_STATUS = {
  done: ['terminé', 'ok'],
  error: ['échec', 'err'],
  interrupted: ['interrompu', 'wait'],
}

function History() {
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    api('/api/history?limit=30')
      .then((r) => alive && setRows(r))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [open])

  return (
    <section className="watches">
      <h2>
        Historique{' '}
        <button className="btn ghost small" onClick={() => setOpen(!open)}>
          {open ? 'Masquer' : 'Afficher'}
        </button>
      </h2>
      {open && rows === null && <div className="center-msg">Chargement…</div>}
      {open &&
        rows?.map((r) => {
          const [label, cls] = HISTORY_STATUS[r.status] || [r.status, 'wait']
          return (
            <div key={r.id} className="job">
              <div className="job-head">
                <span className="job-title">
                  {r.kind === 'watch' && <span className="pill">AUTO</span>}
                  {r.title || r.url}
                </span>
                <span className={'job-status ' + cls}>{label}</span>
              </div>
              <div className="job-sub">
                {r.series}
                {r.season != null ? ' · Saison ' + r.season : ''}
                {r.created_at ? ' · ' + new Date(r.created_at * 1000).toLocaleString('fr-FR') : ''}
              </div>
            </div>
          )
        })}
      {open && rows?.length === 0 && <div className="center-msg">Aucun téléchargement passé.</div>}
    </section>
  )
}

export default function Downloads({ onLibraryChange }) {
  const [jobs, setJobs] = useState([])
  const [url, setUrl] = useState('')
  const [series, setSeries] = useState('')
  const [season, setSeason] = useState('')
  const [busy, setBusy] = useState(false)
  const doneCount = useRef(0)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const list = await api('/api/downloads')
        if (!alive) return
        setJobs(list)
        const done = list.filter((j) => j.status === 'done').length
        if (done > doneCount.current) onLibraryChange()
        doneCount.current = done
      } catch {
        /* serveur injoignable */
      }
    }
    tick()
    const t = setInterval(tick, 2000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [onLibraryChange])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await postJSON('/api/download', {
        url: url.trim(),
        series: series.trim(),
        season: season ? parseInt(season, 10) : null,
      })
      setUrl('')
    } catch (err) {
      alert('Erreur : ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const hasFinished = jobs.some((j) => ['done', 'error'].includes(j.status))

  return (
    <main className="page below-bar">
      <h1>Téléchargements</h1>

      <form className="dl-form" onSubmit={submit}>
        <label>
          URL (épisode, playlist ou saison)
          <input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} required />
        </label>
        <label>
          Série (dossier)
          <input
            placeholder="One Piece"
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            required
          />
        </label>
        <label>
          Saison
          <input
            type="number"
            min="0"
            placeholder="—"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          />
        </label>
        <button className="btn primary" disabled={busy}>
          Télécharger
        </button>
      </form>

      {!jobs.length && <div className="center-msg">Aucun téléchargement.</div>}

      {jobs
        .slice()
        .reverse()
        .map((j) => {
          const [label, cls] = STATUS[j.status] || [j.status, '']
          const details =
            j.status === 'downloading'
              ? [
                  j.progress != null ? j.progress + ' %' : '',
                  fmtSpeed(j.speed),
                  j.eta ? `~${Math.ceil(j.eta / 60)} min` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              : j.error || ''
          return (
            <div key={j.id} className="job">
              <div className="job-head">
                <span className="job-title">
                  {j.kind === 'watch' && <span className="pill">AUTO</span>}
                  {j.kind === 'subtitle' && <span className="pill">IA</span>}
                  {j.title || j.url}
                </span>
                <span className={'job-status ' + cls}>{label}</span>
              </div>
              <div className="job-sub">
                {j.series}
                {j.season != null ? ' · Saison ' + j.season : ''}
                {details ? ' — ' + details : ''}
              </div>
              {['downloading', 'processing'].includes(j.status) && (
                <div className="progress">
                  <div style={{ width: (j.progress || 0) + '%' }} />
                </div>
              )}
            </div>
          )
        })}

      {hasFinished && (
        <button
          className="btn ghost small"
          onClick={async () => {
            await postJSON('/api/downloads/clear', {})
            setJobs(await api('/api/downloads'))
          }}
        >
          Effacer les terminés
        </button>
      )}

      <p className="hint">
        2 téléchargements en parallèle maximum. Les playlists sont numérotées automatiquement. Les
        plateformes protégées par DRM (Crunchyroll, Netflix, ADN…) ne sont pas prises en charge.
      </p>

      <Watches />
      <History />
    </main>
  )
}
