import { useMemo, useRef, useState } from 'react'
import { streamUrl, getSeen, getPos, getDur, getWatchlist, toggleWatchlist } from '../api.js'
import { toast } from '../ui.jsx'

const NEW_DAYS = 7
const isNew = (ep) => ep.mtime && Date.now() / 1000 - ep.mtime < NEW_DAYS * 86400

const STATUS_LABELS = {
  RELEASING: 'En cours',
  FINISHED: 'Terminé',
  NOT_YET_RELEASED: 'À venir',
  HIATUS: 'En pause',
}

function Row({ title, children }) {
  const ref = useRef(null)
  const scroll = (dir) => {
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' })
  }
  return (
    <section className="row">
      <h2>{title}</h2>
      <div className="row-wrap">
        <button className="row-arrow left" onClick={() => scroll(-1)} aria-label="Précédent">
          ‹
        </button>
        <div className="row-scroller" ref={ref}>
          {children}
        </div>
        <button className="row-arrow right" onClick={() => scroll(1)} aria-label="Suivant">
          ›
        </button>
      </div>
    </section>
  )
}

function SeriesCard({ series }) {
  const [inList, setInList] = useState(() => getWatchlist().has(series.name))
  const seen = getSeen()
  const nextEp = series.episodes.find((e) => !seen.has(e.path)) || series.episodes[0]
  const hasNew = series.episodes.some((e) => isNew(e) && !seen.has(e.path))

  return (
    <a className="card" href={'#/series/' + encodeURIComponent(series.name)}>
      <div
        className="card-img poster"
        style={series.cover ? { backgroundImage: `url("${streamUrl(series.cover)}")` } : undefined}
      >
        {!series.cover && <span className="card-fallback">▶</span>}
        {hasNew && <span className="new-badge">NOUVEAU</span>}
        <div className="card-hover">
          <div className="card-hover-actions">
            <button
              className="round-btn play"
              title="Lecture"
              onClick={(e) => {
                e.preventDefault()
                location.hash = '#/watch/' + encodeURIComponent(nextEp.path)
              }}
            >
              ▶
            </button>
            <button
              className={'round-btn' + (inList ? ' on' : '')}
              title={inList ? 'Retirer de ma liste' : 'Ajouter à ma liste'}
              onClick={(e) => {
                e.preventDefault()
                const now = toggleWatchlist(series.name).has(series.name)
                setInList(now)
                toast(now ? 'Ajouté à ma liste' : 'Retiré de ma liste')
              }}
            >
              {inList ? '✓' : '+'}
            </button>
          </div>
          {series.meta?.genres?.length > 0 && (
            <div className="card-hover-genres">{series.meta.genres.slice(0, 3).join(' · ')}</div>
          )}
        </div>
      </div>
      <div className="card-title">{series.meta?.title || series.name}</div>
      <div className="card-sub">
        {series.episodes.length} épisode{series.episodes.length > 1 ? 's' : ''}
        {series.meta?.score ? ` · ★ ${series.meta.score / 10}` : ''}
      </div>
    </a>
  )
}

function SkeletonHome() {
  return (
    <main className="home">
      <div className="hero skeleton-hero">
        <div className="hero-fade" />
      </div>
      <div className="rows" style={{ marginTop: '3vh' }}>
        <section className="row">
          <h2>
            <span className="skeleton-line" style={{ width: 160 }} />
          </h2>
          <div className="row-scroller">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="card">
                <div className="card-img poster skeleton" />
                <div className="skeleton-line" style={{ width: '80%', marginTop: 8 }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function ResumeCard({ ep, seriesName, isNew: showNew }) {
  const pct = getDur(ep.path) ? Math.min(100, (getPos(ep.path) / getDur(ep.path)) * 100) : 0
  return (
    <a className="card wide" href={'#/watch/' + encodeURIComponent(ep.path)}>
      <div
        className="card-img landscape"
        style={ep.thumb ? { backgroundImage: `url("${streamUrl(ep.thumb)}")` } : undefined}
      >
        {!ep.thumb && <span className="card-fallback">▶</span>}
        {showNew && <span className="new-badge">NOUVEAU</span>}
        {pct > 0 && (
          <div className="card-progress">
            <div style={{ width: pct + '%' }} />
          </div>
        )}
      </div>
      <div className="card-title">{ep.title}</div>
      <div className="card-sub">{seriesName}</div>
    </a>
  )
}

const seriesMtime = (s) => Math.max(...s.episodes.map((e) => e.mtime || 0))

export default function Home({ library }) {
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('recent')

  const genres = useMemo(() => {
    const g = new Set()
    for (const s of library || []) for (const x of s.meta?.genres || []) g.add(x)
    return [...g].sort()
  }, [library])

  const filtering = query.trim() !== '' || genre !== '' || status !== ''

  const filtered = useMemo(() => {
    if (!library) return []
    const q = query.trim().toLowerCase()
    let list = library.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !(s.meta?.title || '').toLowerCase().includes(q)) {
        return false
      }
      if (genre && !(s.meta?.genres || []).includes(genre)) return false
      if (status && s.meta?.status !== status) return false
      return true
    })
    if (sort === 'alpha') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'score') list = [...list].sort((a, b) => (b.meta?.score || 0) - (a.meta?.score || 0))
    else list = [...list].sort((a, b) => seriesMtime(b) - seriesMtime(a))
    return list
  }, [library, query, genre, status, sort])

  const resume = useMemo(() => {
    if (!library) return []
    const seen = getSeen()
    const items = []
    for (const s of library) {
      for (const ep of s.episodes) {
        if (getPos(ep.path) > 5 && !seen.has(ep.path)) {
          items.push({ ep, seriesName: s.name })
        }
      }
    }
    return items.slice(0, 20)
  }, [library])

  const hero = useMemo(() => {
    if (!library?.length) return null
    // série la plus récente (dernier fichier ajouté)
    return [...library].sort((a, b) => seriesMtime(b) - seriesMtime(a))[0]
  }, [library])

  const watchlist = useMemo(
    () => (library || []).filter((s) => getWatchlist().has(s.name)),
    [library],
  )

  const newEpisodes = useMemo(() => {
    if (!library) return []
    const seen = getSeen()
    const items = []
    for (const s of library) {
      for (const ep of s.episodes) {
        if (isNew(ep) && !seen.has(ep.path)) items.push({ ep, seriesName: s.name })
      }
    }
    return items.sort((a, b) => (b.ep.mtime || 0) - (a.ep.mtime || 0)).slice(0, 20)
  }, [library])

  if (library === null) {
    return <SkeletonHome />
  }

  if (!library.length) {
    return (
      <main className="page center-msg">
        <div className="empty-hero">
          <h1>Ta bibliothèque est vide</h1>
          <p>
            Trouve un animé dans l'onglet <a href="#/search">Recherche</a> ou colle une URL dans{' '}
            <a href="#/downloads">Téléchargements</a>.
          </p>
          <a className="btn primary" href="#/search">
            Commencer
          </a>
        </div>
      </main>
    )
  }

  const firstEp = hero.episodes[0]
  const heroBg = hero.meta?.banner || hero.cover
  const heroDesc = hero.meta?.description

  return (
    <main className="home">
      <div
        className="hero"
        style={heroBg ? { backgroundImage: `url("${streamUrl(heroBg)}")` } : undefined}
      >
        <div className="hero-fade" />
        <div className="hero-content">
          <h1>{hero.meta?.title || hero.name}</h1>
          <p className="hero-facts">
            {hero.meta?.score && <span className="score">★ {hero.meta.score / 10}</span>}
            {hero.episodes.length} épisode{hero.episodes.length > 1 ? 's' : ''}
            {hero.meta?.genres?.length > 0 && ' · ' + hero.meta.genres.slice(0, 4).join(' · ')}
          </p>
          {heroDesc && <p className="hero-desc">{heroDesc}</p>}
          <div className="hero-actions">
            <a className="btn primary" href={'#/watch/' + encodeURIComponent(firstEp.path)}>
              ▶ Lecture
            </a>
            <a className="btn ghost" href={'#/series/' + encodeURIComponent(hero.name)}>
              Plus d'infos
            </a>
          </div>
        </div>
      </div>

      <div className="lib-toolbar">
        <input
          className="lib-search"
          placeholder="🔍  Rechercher dans ma bibliothèque…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">Tous les genres</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Plus récents</option>
          <option value="alpha">A → Z</option>
          <option value="score">Meilleures notes</option>
        </select>
      </div>

      {filtering ? (
        <div className="page" style={{ paddingTop: 0 }}>
          {filtered.length === 0 ? (
            <div className="center-msg">Aucune série ne correspond.</div>
          ) : (
            <div className="series-grid">
              {filtered.map((s) => (
                <SeriesCard key={s.name} series={s} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rows">
          {newEpisodes.length > 0 && (
            <Row title="Nouveaux épisodes">
              {newEpisodes.map(({ ep, seriesName }) => (
                <ResumeCard key={ep.path} ep={ep} seriesName={seriesName} isNew />
              ))}
            </Row>
          )}
          {resume.length > 0 && (
            <Row title="Continuer la lecture">
              {resume.map(({ ep, seriesName }) => (
                <ResumeCard key={ep.path} ep={ep} seriesName={seriesName} />
              ))}
            </Row>
          )}
          {watchlist.length > 0 && (
            <Row title="Ma liste">
              {watchlist.map((s) => (
                <SeriesCard key={s.name} series={s} />
              ))}
            </Row>
          )}
          <Row title="Ma bibliothèque">
            {filtered.map((s) => (
              <SeriesCard key={s.name} series={s} />
            ))}
          </Row>
        </div>
      )}
    </main>
  )
}
