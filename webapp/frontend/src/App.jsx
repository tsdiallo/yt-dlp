import { useCallback, useEffect, useState } from 'react'
import { api, track } from './api.js'
import TopBar from './components/TopBar.jsx'
import Home from './components/Home.jsx'
import SeriesDetail from './components/SeriesDetail.jsx'
import Player from './components/Player.jsx'
import Search from './components/Search.jsx'
import Downloads from './components/Downloads.jsx'
import Stats from './components/Stats.jsx'
import { UIHost } from './ui.jsx'

function parseHash() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''))
  if (h.startsWith('series/')) return { page: 'series', arg: h.slice(7) }
  if (h.startsWith('watch/')) return { page: 'watch', arg: h.slice(6) }
  if (h.startsWith('search')) return { page: 'search' }
  if (h.startsWith('downloads')) return { page: 'downloads' }
  if (h.startsWith('stats')) return { page: 'stats' }
  return { page: 'home' }
}

export const go = (route) => {
  location.hash = '#/' + route
}

export default function App() {
  const [route, setRoute] = useState(parseHash())
  const [library, setLibrary] = useState(null)
  const [activeJobs, setActiveJobs] = useState(0)

  const refreshLibrary = useCallback(async () => {
    try {
      setLibrary(await api('/api/library'))
    } catch {
      setLibrary([])
    }
  }, [])

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    refreshLibrary()
    return () => window.removeEventListener('hashchange', onHash)
  }, [refreshLibrary])

  useEffect(() => {
    track('page', { page: route.page })
  }, [route.page])

  // raccourci « / » : recherche unifiée depuis n'importe quelle page
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault()
        go('search')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const tick = async () => {
      try {
        const jobs = await api('/api/downloads')
        setActiveJobs(jobs.filter((j) => ['queued', 'downloading', 'processing'].includes(j.status)).length)
      } catch {
        /* serveur injoignable : on réessaiera */
      }
    }
    tick()
    const t = setInterval(tick, 5000)
    return () => clearInterval(t)
  }, [])

  if (route.page === 'watch') {
    return (
      <>
        <UIHost />
        <Player path={route.arg} library={library} onLibraryChange={refreshLibrary} />
      </>
    )
  }

  return (
    <>
      <UIHost />
      <TopBar page={route.page} activeJobs={activeJobs} />
      {route.page === 'home' && <Home library={library} />}
      {route.page === 'series' && (
        <SeriesDetail name={route.arg} library={library} onLibraryChange={refreshLibrary} />
      )}
      {route.page === 'search' && <Search library={library} />}
      {route.page === 'downloads' && <Downloads onLibraryChange={refreshLibrary} />}
      {route.page === 'stats' && <Stats library={library} onLibraryChange={refreshLibrary} />}
    </>
  )
}
