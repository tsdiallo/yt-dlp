import { useEffect, useRef, useState } from 'react'
import { api, postJSON, fmtSpeed } from '../api.js'

const STATUS = {
  queued: ["En file d'attente", 'wait'],
  downloading: ['Téléchargement', 'active'],
  processing: ['Traitement (ffmpeg)…', 'active'],
  done: ['Terminé ✓', 'ok'],
  error: ['Échec', 'err'],
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
                <span className="job-title">{j.title || j.url}</span>
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
    </main>
  )
}
