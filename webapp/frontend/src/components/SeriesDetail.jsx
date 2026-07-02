import { useMemo, useState } from 'react'
import { api, postJSON, streamUrl, getSeen, getPos, getDur } from '../api.js'

const STATUS_FR = {
  RELEASING: 'En cours de diffusion',
  FINISHED: 'Terminé',
  NOT_YET_RELEASED: 'À venir',
  HIATUS: 'En pause',
  CANCELLED: 'Annulé',
}

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
  const [descOpen, setDescOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const refreshMeta = async () => {
    const query = prompt(
      'Rechercher sur AniList (laisser tel quel ou corriger le titre) :',
      series?.meta?.title || name,
    )
    if (query === null) return
    setRefreshing(true)
    try {
      await postJSON('/api/series/' + encodeURIComponent(name) + '/metadata', { query })
      onLibraryChange()
    } catch (err) {
      alert('Erreur : ' + err.message)
    } finally {
      setRefreshing(false)
    }
  }

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

  const meta = series.meta
  const heroBg = meta?.banner || series.cover
  const desc = meta?.description

  return (
    <main className="series">
      <div
        className="series-hero"
        style={heroBg ? { backgroundImage: `url("${streamUrl(heroBg)}")` } : undefined}
      >
        <div className="hero-fade" />
        <div className="hero-content">
          <h1>{meta?.title || series.name}</h1>
          <p className="hero-facts">
            {meta?.score && <span className="score">★ {meta.score / 10}</span>}
            {series.episodes.length}
            {meta?.episodes ? `/${meta.episodes}` : ''} épisode
            {series.episodes.length > 1 ? 's' : ''}
            {seasons.length > 1 && ` · ${seasons.length} saisons`}
            {meta?.status && STATUS_FR[meta.status] && ` · ${STATUS_FR[meta.status]}`}
          </p>
          {meta?.genres?.length > 0 && (
            <div className="genres">
              {meta.genres.map((g) => (
                <span key={g} className="chip">
                  {g}
                </span>
              ))}
            </div>
          )}
          <div className="hero-actions">
            <a className="btn primary" href={'#/watch/' + encodeURIComponent(resumeEp.path)}>
              ▶ {getPos(resumeEp.path) > 5 ? 'Reprendre' : 'Lecture'}
            </a>
            <button className="btn ghost" onClick={refreshMeta} disabled={refreshing}>
              {refreshing ? '…' : meta ? '↻ Métadonnées' : '↻ Récupérer les infos (AniList)'}
            </button>
          </div>
        </div>
      </div>

      <div className="page">
        {desc && (
          <p className={'synopsis' + (descOpen ? ' open' : '')} onClick={() => setDescOpen(!descOpen)}>
            {desc}
          </p>
        )}
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
