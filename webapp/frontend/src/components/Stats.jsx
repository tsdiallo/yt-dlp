import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, postJSON, fmtBytes, fmtHours, getSeen, getPos, getDur } from '../api.js'

function Tile({ label, value, sub }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  )
}

export default function Stats({ library, onLibraryChange }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    api('/api/stats').then(setData).catch((e) => setError(e.message))
  }, [])

  useEffect(refresh, [refresh])

  const purgeSeen = async (seriesName) => {
    const seen = getSeen()
    const paths = []
    for (const s of library || []) {
      if (seriesName && s.name !== seriesName) continue
      for (const ep of s.episodes) if (seen.has(ep.path)) paths.push(ep.path)
    }
    if (!paths.length) {
      alert('Aucun épisode vu à supprimer.')
      return
    }
    const where = seriesName ? `de « ${seriesName} »` : 'de toute la bibliothèque'
    if (!confirm(`Supprimer du disque les ${paths.length} épisode(s) déjà vu(s) ${where} ?`)) return
    const res = await postJSON('/api/media/delete-batch', { paths })
    alert(`${res.deleted} épisode(s) supprimé(s), ${fmtBytes(res.freed)} libérés.`)
    onLibraryChange?.()
    refresh()
  }

  // côté client : épisodes vus et temps de visionnage estimé (localStorage)
  const local = useMemo(() => {
    const seen = getSeen()
    let seenCount = 0
    let watchSeconds = 0
    for (const s of library || []) {
      for (const ep of s.episodes) {
        if (seen.has(ep.path)) {
          seenCount += 1
          watchSeconds += getDur(ep.path) || 0
        } else {
          watchSeconds += getPos(ep.path) || 0
        }
      }
    }
    return { seenCount, watchSeconds }
  }, [library])

  const episodeCount = (library || []).reduce((n, s) => n + s.episodes.length, 0)
  const seenBySeries = useMemo(() => {
    const seen = getSeen()
    const m = new Map()
    for (const s of library || []) {
      m.set(s.name, s.episodes.filter((e) => seen.has(e.path)).length)
    }
    return m
  }, [library])

  if (error) return <main className="page below-bar center-msg">Erreur : {error}</main>
  if (!data || library === null) return <main className="page below-bar center-msg">Chargement…</main>

  return (
    <main className="page below-bar">
      <h1>Statistiques</h1>

      <div className="tiles">
        <Tile label="Séries" value={library.length} />
        <Tile label="Épisodes" value={episodeCount} />
        <Tile
          label="Épisodes vus"
          value={local.seenCount}
          sub={episodeCount ? Math.round((local.seenCount / episodeCount) * 100) + ' %' : null}
        />
        <Tile label="Temps de visionnage estimé" value={fmtHours(local.watchSeconds)} />
        <Tile label="Espace utilisé" value={fmtBytes(data.total_size)} />
        <Tile label="Séries suivies" value={data.watch_count} />
        <Tile
          label="Téléchargements réussis"
          value={data.downloads.done}
          sub={data.downloads.failed ? data.downloads.failed + ' échec(s)' : null}
        />
      </div>

      <div className="season-bar">
        <h2 style={{ margin: 0 }}>Espace par série</h2>
        {local.seenCount > 0 && (
          <button className="btn ghost small" onClick={() => purgeSeen(null)}>
            🗑 Supprimer tous les épisodes vus
          </button>
        )}
      </div>
      {data.series.length === 0 ? (
        <div className="center-msg">Bibliothèque vide.</div>
      ) : (
        <table className="stats-table">
          <thead>
            <tr>
              <th>Série</th>
              <th>Épisodes</th>
              <th>Vus</th>
              <th>Taille</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.series.map((s) => (
              <tr key={s.name}>
                <td>
                  <a href={'#/series/' + encodeURIComponent(s.name)}>{s.name}</a>
                </td>
                <td>{s.episodes}</td>
                <td>{seenBySeries.get(s.name) ?? 0}</td>
                <td>{fmtBytes(s.size)}</td>
                <td>
                  {(seenBySeries.get(s.name) ?? 0) > 0 && (
                    <button
                      className="btn ghost small"
                      title="Supprimer les épisodes vus de cette série"
                      onClick={() => purgeSeen(s.name)}
                    >
                      🗑 vus
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
