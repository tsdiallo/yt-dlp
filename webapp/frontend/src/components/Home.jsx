import { useMemo, useRef } from 'react'
import { streamUrl, getSeen, getPos, getDur } from '../api.js'

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
  return (
    <a className="card" href={'#/series/' + encodeURIComponent(series.name)}>
      <div
        className="card-img poster"
        style={series.cover ? { backgroundImage: `url("${streamUrl(series.cover)}")` } : undefined}
      >
        {!series.cover && <span className="card-fallback">▶</span>}
      </div>
      <div className="card-title">{series.name}</div>
      <div className="card-sub">
        {series.episodes.length} épisode{series.episodes.length > 1 ? 's' : ''}
      </div>
    </a>
  )
}

function ResumeCard({ ep, seriesName }) {
  const pct = getDur(ep.path) ? Math.min(100, (getPos(ep.path) / getDur(ep.path)) * 100) : 0
  return (
    <a className="card wide" href={'#/watch/' + encodeURIComponent(ep.path)}>
      <div
        className="card-img landscape"
        style={ep.thumb ? { backgroundImage: `url("${streamUrl(ep.thumb)}")` } : undefined}
      >
        {!ep.thumb && <span className="card-fallback">▶</span>}
        <div className="card-progress">
          <div style={{ width: pct + '%' }} />
        </div>
      </div>
      <div className="card-title">{ep.title}</div>
      <div className="card-sub">{seriesName}</div>
    </a>
  )
}

export default function Home({ library }) {
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
    return [...library].sort(
      (a, b) => Math.max(...b.episodes.map((e) => e.mtime || 0)) - Math.max(...a.episodes.map((e) => e.mtime || 0)),
    )[0]
  }, [library])

  if (library === null) {
    return <main className="page center-msg">Chargement…</main>
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

  return (
    <main className="home">
      <div
        className="hero"
        style={hero.cover ? { backgroundImage: `url("${streamUrl(hero.cover)}")` } : undefined}
      >
        <div className="hero-fade" />
        <div className="hero-content">
          <h1>{hero.name}</h1>
          <p>
            {hero.episodes.length} épisode{hero.episodes.length > 1 ? 's' : ''}
            {hero.episodes.some((e) => e.season) &&
              ` · ${new Set(hero.episodes.map((e) => e.season).filter(Boolean)).size} saison(s)`}
          </p>
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

      <div className="rows">
        {resume.length > 0 && (
          <Row title="Continuer la lecture">
            {resume.map(({ ep, seriesName }) => (
              <ResumeCard key={ep.path} ep={ep} seriesName={seriesName} />
            ))}
          </Row>
        )}
        <Row title="Ma bibliothèque">
          {library.map((s) => (
            <SeriesCard key={s.name} series={s} />
          ))}
        </Row>
      </div>
    </main>
  )
}
