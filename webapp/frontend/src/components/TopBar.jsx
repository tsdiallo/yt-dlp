import { useEffect, useState } from 'react'

export default function TopBar({ page, activeJobs }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={'topbar' + (scrolled ? ' solid' : '')}>
      <a className="logo" href="#/">
        ANI<span>STREAM</span>
      </a>
      <nav>
        <a href="#/" className={page === 'home' || page === 'series' ? 'active' : ''}>
          Accueil
        </a>
        <a href="#/search" className={page === 'search' ? 'active' : ''}>
          Recherche
        </a>
        <a href="#/downloads" className={page === 'downloads' ? 'active' : ''}>
          Téléchargements
          {activeJobs > 0 && <span className="badge">{activeJobs}</span>}
        </a>
        <a href="#/stats" className={page === 'stats' ? 'active' : ''}>
          Stats
        </a>
      </nav>
    </header>
  )
}
