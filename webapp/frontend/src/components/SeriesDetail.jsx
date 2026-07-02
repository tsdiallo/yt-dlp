import { useMemo, useState } from 'react'
import { api, streamUrl, getSeen, getPos, getDur } from '../api.js'

export default function SeriesDetail({ name, library, onLibraryChange }) {
  const series = library?.find((s) => s.name === name)
  const seasons = useMemo(() => {
    if (!series) return []
    const map = new Map()
    for (const ep of series.episodes) {
      const key = ep.season || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(ep)
    }
    return [...map.entries()]
  }, [series])

  const [seasonIdx, setSeasonIdx] = useState(0)

  if (library === null) return <main className="page center-msg">Chargement…</main>
  if (!series) {
    return (
      <main className="page center-msg">
        Série introuvable. <a href="#/">Retour à l'accueil</a>
      </main>
    )
  }

  const seen = getSeen()
  const [seasonName, episodes] = seasons[Math.min(seasonIdx, seasons.length - 1)]
  const resumeEp =
    series.episodes.find((e) => getPos(e.path) > 5 && !seen.has(e.path)) ||
    series.episodes.find((e) => !seen.has(e.path)) ||
    series.episodes[0]

  const deleteEp = async (ep) => {
    if (!confirm(`Supprimer « ${ep.title} » du disque ?`)) return
    await api('/api/media/' + ep.path.split('/').map(encodeURIComponent).join('/'), {
      method: 'DELETE',
    })
    onLibraryChange()
  }

  return (
    <main className="series">
      <div
        className="series-hero"
        style={series.cover ? { backgroundImage: `url("${streamUrl(series.cover)}")` } : undefined}
      >
        <div className="hero-fade" />
        <div className="hero-content">
          <h1>{series.name}</h1>
          <p>
            {series.episodes.length} épisode{series.episodes.length > 1 ? 's' : ''}
            {seasons.length > 1 && ` · ${seasons.length} saisons`}
          </p>
          <div className="hero-actions">
            <a className="btn primary" href={'#/watch/' + encodeURIComponent(resumeEp.path)}>
              ▶ {getPos(resumeEp.path) > 5 ? 'Reprendre' : 'Lecture'}
            </a>
          </div>
        </div>
      </div>

      <div className="page">
        <div className="season-bar">
          <h2>Épisodes</h2>
          {seasons.length > 1 && (
            <select value={seasonIdx} onChange={(e) => setSeasonIdx(Number(e.target.value))}>
              {seasons.map(([sName], i) => (
                <option key={sName || 'racine'} value={i}>
                  {sName || 'Épisodes'}
                </option>
              ))}
            </select>
          )}
          {seasons.length === 1 && seasonName && <span className="season-label">{seasonName}</span>}
        </div>

        <div className="ep-grid">
          {episodes.map((ep, i) => {
            const pct = getDur(ep.path)
              ? Math.min(100, (getPos(ep.path) / getDur(ep.path)) * 100)
              : 0
            return (
              <div key={ep.path} className="ep-card">
                <a className="ep-thumb-wrap" href={'#/watch/' + encodeURIComponent(ep.path)}>
                  <div
                    className="ep-thumb"
                    style={ep.thumb ? { backgroundImage: `url("${streamUrl(ep.thumb)}")` } : undefined}
                  >
                    <span className="ep-play">▶</span>
                    {pct > 0 && !seen.has(ep.path) && (
                      <div className="card-progress">
                        <div style={{ width: pct + '%' }} />
                      </div>
                    )}
                  </div>
                </a>
                <div className="ep-info">
                  <span className="ep-num">{i + 1}</span>
                  <span className="ep-name" title={ep.title}>
                    {ep.title}
                  </span>
                  {seen.has(ep.path) && <span className="ep-seen">✓</span>}
                  <button className="icon-btn" title="Supprimer" onClick={() => deleteEp(ep)}>
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
