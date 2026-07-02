import { useMemo, useState } from 'react'
import { api, postJSON, fmtTime, streamUrl } from '../api.js'
import { toast } from '../ui.jsx'

function Result({ result, defaultSeries, seriesNames }) {
  const [open, setOpen] = useState(false)
  const [series, setSeries] = useState(defaultSeries)
  const [season, setSeason] = useState('')
  const [state, setState] = useState('idle') // idle | busy | done | followed

  const launch = async (e) => {
    e.preventDefault()
    setState('busy')
    try {
      await postJSON('/api/download', {
        url: result.url,
        series: series.trim(),
        season: season ? parseInt(season, 10) : null,
      })
      setState('done')
      toast('Téléchargement lancé — suivi dans l\'onglet Téléchargements')
    } catch (err) {
      toast(err.message, 'err')
      setState('idle')
    }
  }

  const follow = async () => {
    setState('busy')
    try {
      await postJSON('/api/watches', {
        url: result.url,
        series: series.trim() || defaultSeries,
        season: season ? parseInt(season, 10) : null,
      })
      setState('followed')
      toast('Série suivie : les nouveaux épisodes arriveront tout seuls')
    } catch (err) {
      toast(err.message, 'err')
      setState('idle')
    }
  }

  return (
    <div className="result">
      <div className="result-main">
        <div className="result-text">
          <div className="result-title">
            {result.is_playlist && <span className="pill">PLAYLIST</span>}
            {result.title}
          </div>
          <div className="result-sub">
            {result.source}
            {result.uploader ? ' · ' + result.uploader : ''}
            {result.duration ? ' · ' + fmtTime(result.duration) : ''}
          </div>
        </div>
        <a className="btn ghost small" href={result.url} target="_blank" rel="noopener noreferrer">
          Ouvrir
        </a>
        <button className="btn primary small" onClick={() => setOpen(!open)}>
          Télécharger
        </button>
      </div>
      {open && (
        <form className="confirm" onSubmit={launch}>
          <label>
            Série (dossier)
            <input
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              required
              list="series-names"
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
          <button className="btn primary small" disabled={state !== 'idle'}>
            {state === 'done' ? 'Lancé ✓' : state === 'busy' ? '…' : 'Lancer'}
          </button>
          {result.is_playlist && (
            <button
              type="button"
              className="btn ghost small"
              disabled={state !== 'idle'}
              onClick={follow}
              title="Télécharge maintenant puis récupère automatiquement les nouveaux épisodes"
            >
              {state === 'followed' ? 'Suivie ✓' : '★ Suivre'}
            </button>
          )}
          <datalist id="series-names">
            {seriesNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </form>
      )}
    </div>
  )
}

export default function Search({ library }) {
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('videos')
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const seriesNames = useMemo(() => (library || []).map((s) => s.name), [library])

  // recherche unifiée : correspondances instantanées dans la bibliothèque locale
  const localMatches = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (needle.length < 2) return []
    return (library || [])
      .filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          (s.meta?.title || '').toLowerCase().includes(needle),
      )
      .slice(0, 8)
  }, [library, q])

  const bySite = useMemo(() => {
    const map = new Map()
    for (const r of data?.results || []) {
      if (!map.has(r.site)) map.set(r.site, [])
      map.get(r.site).push(r)
    }
    return map
  }, [data])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setData(await api(`/api/search?q=${encodeURIComponent(q.trim())}&mode=${mode}`))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page below-bar">
      <h1>Recherche</h1>
      <form className="search-bar" onSubmit={submit}>
        <input
          autoFocus
          placeholder="One Piece épisode 1 vostfr…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          required
        />
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="videos">Vidéos / épisodes (tous sites)</option>
          <option value="playlists">Playlists YouTube (saisons)</option>
        </select>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Recherche…' : 'Rechercher'}
        </button>
      </form>

      {localMatches.length > 0 && (
        <section className="result-group">
          <h2>
            Dans ma bibliothèque <span className="count">{localMatches.length}</span>
          </h2>
          <div className="local-matches">
            {localMatches.map((s) => (
              <a key={s.name} className="local-match" href={'#/series/' + encodeURIComponent(s.name)}>
                <span
                  className="local-cover"
                  style={s.cover ? { backgroundImage: `url("${streamUrl(s.cover)}")` } : undefined}
                />
                <span className="local-name">{s.meta?.title || s.name}</span>
                <span className="local-count">{s.episodes.length} ép.</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {busy && <div className="center-msg pulse">Interrogation de tous les sites…</div>}
      {error && <div className="center-msg">Erreur : {error}</div>}

      {data && !busy && (
        <>
          {data.failed_sources.length > 0 && (
            <p className="hint">Sans réponse : {data.failed_sources.join(', ')}</p>
          )}
          {!data.results.length && <div className="center-msg">Aucun résultat.</div>}
          {[...bySite.entries()].map(([site, results]) => (
            <section key={site} className="result-group">
              <h2>
                {site} <span className="count">{results.length}</span>
              </h2>
              {results.map((r) => (
                <Result
                  key={r.url}
                  result={r}
                  defaultSeries={data.query}
                  seriesNames={seriesNames}
                />
              ))}
            </section>
          ))}
        </>
      )}

      <p className="hint">
        La recherche interroge YouTube, Google Vidéo et Yahoo (méta-moteurs couvrant de nombreux
        sites), BiliBili et NicoNico. Pour un site précis non couvert, colle directement l'URL dans
        l'onglet Téléchargements.
      </p>
    </main>
  )
}
