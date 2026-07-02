import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  streamUrl,
  fmtTime,
  qualityLabel,
  getPos,
  savePos,
  clearPos,
  markSeen,
} from '../api.js'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export default function Player({ path, library }) {
  const videoRef = useRef(null)
  const shellRef = useRef(null)
  const hideTimer = useRef(null)
  const seekbarRef = useRef(null)

  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem('anistream.vol') || '1'))
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [quality, setQuality] = useState(null)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [menu, setMenu] = useState(null) // 'subs' | 'speed' | null
  const [subIdx, setSubIdx] = useState(0) // 0 = premier sous-titre si dispo
  const [countdown, setCountdown] = useState(null)
  const [error, setError] = useState(null)

  const { ep, series, next } = useMemo(() => {
    if (!library) return {}
    for (const s of library) {
      const i = s.episodes.findIndex((e) => e.path === path)
      if (i !== -1) return { ep: s.episodes[i], series: s, next: s.episodes[i + 1] }
    }
    return {}
  }, [library, path])

  const showControls = useCallback(() => {
    setControlsVisible(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (!videoRef.current?.paused) {
        setControlsVisible(false)
        setMenu(null)
      }
    }, 2800)
  }, [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }, [])

  const seekBy = useCallback((delta) => {
    const v = videoRef.current
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + delta))
  }, [])

  const setVol = useCallback((val) => {
    const v = videoRef.current
    const vol = Math.max(0, Math.min(1, val))
    if (v) {
      v.volume = vol
      v.muted = false
    }
    setVolume(vol)
    setMuted(false)
    localStorage.setItem('anistream.vol', String(vol))
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen()
    else shellRef.current?.requestFullscreen()
  }, [])

  // clavier : espace/K lecture, ←→/J/L ±10s, ↑↓ volume, M muet, F plein écran
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      showControls()
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'arrowleft':
        case 'j':
          seekBy(-10)
          break
        case 'arrowright':
        case 'l':
          seekBy(10)
          break
        case 'arrowup':
          e.preventDefault()
          setVol((videoRef.current?.volume ?? 1) + 0.1)
          break
        case 'arrowdown':
          e.preventDefault()
          setVol((videoRef.current?.volume ?? 1) - 0.1)
          break
        case 'm': {
          const v = videoRef.current
          if (v) {
            v.muted = !v.muted
            setMuted(v.muted)
          }
          break
        }
        case 'f':
          toggleFullscreen()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, seekBy, setVol, toggleFullscreen, showControls])

  // reprise + volume initial
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = volume
    const resume = getPos(path)
    const onMeta = () => {
      setDuration(v.duration)
      setQuality(qualityLabel(v.videoWidth, v.videoHeight))
      if (resume > 5 && resume < v.duration - 10) v.currentTime = resume
    }
    v.addEventListener('loadedmetadata', onMeta)
    return () => v.removeEventListener('loadedmetadata', onMeta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  // sous-titres : activer la piste choisie
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const apply = () => {
      for (let i = 0; i < v.textTracks.length; i++) {
        v.textTracks[i].mode = i === subIdx - 1 ? 'showing' : 'hidden'
      }
    }
    apply()
    v.textTracks.addEventListener?.('addtrack', apply)
    return () => v.textTracks.removeEventListener?.('addtrack', apply)
  }, [subIdx, path])

  // compte à rebours de l'épisode suivant
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      if (next) location.hash = '#/watch/' + encodeURIComponent(next.path)
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, next])

  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setTime(v.currentTime)
    if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
    if (v.currentTime > 0) savePos(path, v.currentTime, v.duration)
    if (v.duration && v.currentTime / v.duration > 0.9) markSeen(path)
  }

  const onEnded = () => {
    markSeen(path)
    clearPos(path)
    if (next) setCountdown(5)
  }

  const seekFromEvent = (e) => {
    const bar = seekbarRef.current
    const v = videoRef.current
    if (!bar || !v || !v.duration) return
    const rect = bar.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    v.currentTime = frac * v.duration
    setTime(v.currentTime)
  }

  const onSeekDown = (e) => {
    seekFromEvent(e)
    const move = (ev) => seekFromEvent(ev)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (library === null) return <main className="page center-msg">Chargement…</main>
  if (!ep) {
    return (
      <main className="page center-msg">
        Épisode introuvable. <a href="#/">Retour à l'accueil</a>
      </main>
    )
  }

  const backHref = '#/series/' + encodeURIComponent(series.name)
  const playedPct = duration ? (time / duration) * 100 : 0
  const bufferedPct = duration ? (buffered / duration) * 100 : 0

  return (
    <div
      ref={shellRef}
      className={'player' + (controlsVisible ? '' : ' hide-cursor')}
      onPointerMove={showControls}
      onClick={() => setMenu(null)}
    >
      <video
        ref={videoRef}
        src={streamUrl(ep.path)}
        poster={ep.thumb ? streamUrl(ep.thumb) : undefined}
        autoPlay
        crossOrigin="anonymous"
        onPlay={() => {
          setPlaying(true)
          showControls()
        }}
        onPause={() => {
          setPlaying(false)
          setControlsVisible(true)
        }}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onError={() => setError('Impossible de lire cette vidéo (codec non supporté par le navigateur ?)')}
        onClick={(e) => {
          e.stopPropagation()
          setMenu(null)
          togglePlay()
        }}
        onDoubleClick={toggleFullscreen}
      >
        {ep.subs.map((s) => (
          <track
            key={s.path}
            kind="subtitles"
            label={s.lang}
            srcLang={s.lang}
            src={streamUrl(s.path)}
          />
        ))}
      </video>

      {error && <div className="player-error">{error}</div>}

      {countdown !== null && next && (
        <div className="next-overlay" onClick={(e) => e.stopPropagation()}>
          <p>Épisode suivant dans {countdown} s</p>
          <strong>{next.title}</strong>
          <div className="hero-actions">
            <a className="btn primary" href={'#/watch/' + encodeURIComponent(next.path)}>
              ▶ Lire maintenant
            </a>
            <button className="btn ghost" onClick={() => setCountdown(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className={'player-ui' + (controlsVisible ? ' visible' : '')}>
        <div className="player-top">
          <a className="icon-btn big" href={backHref} title="Retour">
            ←
          </a>
          <div className="player-titles">
            <strong>{ep.title}</strong>
            <span>
              {series.name}
              {ep.season ? ' · ' + ep.season : ''}
            </span>
          </div>
          {quality && <span className="quality-badge">{quality}</span>}
        </div>

        <div className="player-bottom" onClick={(e) => e.stopPropagation()}>
          <div className="seekbar" ref={seekbarRef} onPointerDown={onSeekDown}>
            <div className="seek-buffered" style={{ width: bufferedPct + '%' }} />
            <div className="seek-played" style={{ width: playedPct + '%' }}>
              <div className="seek-knob" />
            </div>
          </div>

          <div className="controls">
            <button className="icon-btn big" onClick={togglePlay} title="Lecture/Pause (espace)">
              {playing ? '⏸' : '▶'}
            </button>
            <button className="icon-btn" onClick={() => seekBy(-10)} title="-10 s (←)">
              ↺10
            </button>
            <button className="icon-btn" onClick={() => seekBy(10)} title="+10 s (→)">
              10↻
            </button>

            <div className="volume">
              <button
                className="icon-btn"
                title="Muet (M)"
                onClick={() => {
                  const v = videoRef.current
                  if (v) {
                    v.muted = !v.muted
                    setMuted(v.muted)
                  }
                }}
              >
                {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={(e) => setVol(parseFloat(e.target.value))}
              />
            </div>

            <span className="time">
              {fmtTime(time)} / {fmtTime(duration)}
            </span>

            <div className="spacer" />

            {next && (
              <a
                className="icon-btn"
                href={'#/watch/' + encodeURIComponent(next.path)}
                title="Épisode suivant"
              >
                ⏭
              </a>
            )}

            {ep.subs.length > 0 && (
              <div className="menu-wrap">
                <button
                  className={'icon-btn' + (subIdx > 0 ? ' on' : '')}
                  title="Sous-titres"
                  onClick={() => setMenu(menu === 'subs' ? null : 'subs')}
                >
                  CC
                </button>
                {menu === 'subs' && (
                  <div className="menu">
                    <button className={subIdx === 0 ? 'sel' : ''} onClick={() => setSubIdx(0)}>
                      Désactivés
                    </button>
                    {ep.subs.map((s, i) => (
                      <button
                        key={s.path}
                        className={subIdx === i + 1 ? 'sel' : ''}
                        onClick={() => setSubIdx(i + 1)}
                      >
                        {s.lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="menu-wrap">
              <button
                className="icon-btn"
                title="Vitesse"
                onClick={() => setMenu(menu === 'speed' ? null : 'speed')}
              >
                {rate}×
              </button>
              {menu === 'speed' && (
                <div className="menu">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      className={rate === s ? 'sel' : ''}
                      onClick={() => {
                        const v = videoRef.current
                        if (v) v.playbackRate = s
                        setRate(s)
                        setMenu(null)
                      }}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              )}
            </div>

            {document.pictureInPictureEnabled && (
              <button
                className="icon-btn"
                title="Picture-in-Picture"
                onClick={() => {
                  const v = videoRef.current
                  if (document.pictureInPictureElement) document.exitPictureInPicture()
                  else v?.requestPictureInPicture()
                }}
              >
                ⧉
              </button>
            )}

            <button className="icon-btn" onClick={toggleFullscreen} title="Plein écran (F)">
              ⛶
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
