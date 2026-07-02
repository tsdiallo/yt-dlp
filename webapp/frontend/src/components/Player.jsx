import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  api,
  postJSON,
  track,
  streamUrl,
  fmtTime,
  qualityLabel,
  getPos,
  savePos,
  clearPos,
  markSeen,
} from '../api.js'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

const transcodeUrl = (path, t) =>
  '/api/transcode/' + path.split('/').map(encodeURIComponent).join('/') + (t > 0 ? `?t=${t}` : '')

export default function Player({ path, library, onLibraryChange }) {
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
  const [subIdx, setSubIdx] = useState(0)
  const [countdown, setCountdown] = useState(null)
  const [error, setError] = useState(null)
  // mode transcodage : null = lecture directe, sinon décalage de départ (s)
  const [tcOffset, setTcOffset] = useState(null)
  const [tcDuration, setTcDuration] = useState(null)
  const [introSkipped, setIntroSkipped] = useState(false)

  const { ep, series, next } = useMemo(() => {
    if (!library) return {}
    for (const s of library) {
      const i = s.episodes.findIndex((e) => e.path === path)
      if (i !== -1) return { ep: s.episodes[i], series: s, next: s.episodes[i + 1] }
    }
    return {}
  }, [library, path])

  // remise à zéro quand on change d'épisode
  useEffect(() => {
    setTcOffset(null)
    setTcDuration(null)
    setError(null)
    setTime(0)
    setDuration(0)
    setCountdown(null)
    setIntroSkipped(false)
    if (series) track('play', { series: series.name })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  const inTc = tcOffset !== null
  const effTime = inTc ? tcOffset + time : time
  const effDuration = inTc ? tcDuration || 0 : duration

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

  const seekTo = useCallback(
    (target) => {
      const v = videoRef.current
      if (tcOffset !== null) {
        const max = tcDuration ? tcDuration - 1 : Infinity
        setTcOffset(Math.max(0, Math.min(max, target)))
        setTime(0)
      } else if (v) {
        v.currentTime = Math.max(0, Math.min(v.duration || Infinity, target))
      }
    },
    [tcOffset, tcDuration],
  )

  const seekBy = useCallback(
    (delta) => seekTo((tcOffset !== null ? tcOffset : 0) + (videoRef.current?.currentTime || 0) + delta),
    [seekTo, tcOffset],
  )

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

  const switchToTranscode = useCallback(async () => {
    try {
      const info = await api('/api/mediainfo/' + path.split('/').map(encodeURIComponent).join('/'))
      if (!info.transcodable) {
        setError('Impossible de lire cette vidéo (codec non supporté, et ffmpeg est indisponible)')
        return
      }
      setTcDuration(info.duration)
      const resume = getPos(path)
      setTcOffset(resume > 5 ? resume : 0)
      setTime(0)
    } catch {
      setError('Impossible de lire cette vidéo')
    }
  }, [path])

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
  }, [subIdx, path, tcOffset])

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

  const onLoadedMetadata = (e) => {
    const v = e.target
    v.volume = volume
    if (!inTc) {
      setDuration(v.duration || 0)
      setQuality(qualityLabel(v.videoWidth, v.videoHeight))
      const resume = getPos(path)
      if (resume > 5 && resume < (v.duration || Infinity) - 10) v.currentTime = resume
    } else if (v.videoWidth) {
      setQuality(qualityLabel(v.videoWidth, v.videoHeight))
    }
    if (rate !== 1) v.playbackRate = rate
  }

  const onTimeUpdate = () => {
    const v = videoRef.current
    if (!v) return
    setTime(v.currentTime)
    if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
    const t = inTc ? tcOffset + v.currentTime : v.currentTime
    if (t > 0) savePos(path, t, effDuration || undefined)
    if (effDuration && t / effDuration > 0.9) markSeen(path)
  }

  const onEnded = () => {
    markSeen(path)
    clearPos(path)
    if (next) setCountdown(5)
  }

  const onVideoError = () => {
    if (!inTc) switchToTranscode()
    else setError('Le transcodage a échoué (voir les logs du serveur)')
  }

  const seekFromEvent = (e, apply) => {
    const bar = seekbarRef.current
    if (!bar || !effDuration) return
    const rect = bar.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    apply(frac * effDuration)
  }

  const onSeekDown = (e) => {
    if (inTc) {
      // flux transcodé : pas de scrubbing continu, un clic = un redémarrage
      seekFromEvent(e, seekTo)
      return
    }
    const applyDirect = (target) => {
      const v = videoRef.current
      if (v) {
        v.currentTime = target
        setTime(target)
      }
    }
    seekFromEvent(e, applyDirect)
    const move = (ev) => seekFromEvent(ev, applyDirect)
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
  const playedPct = effDuration ? (effTime / effDuration) * 100 : 0
  const bufferedPct = !inTc && duration ? (buffered / duration) * 100 : 0

  return (
    <div
      ref={shellRef}
      className={'player' + (controlsVisible ? '' : ' hide-cursor')}
      onPointerMove={showControls}
      onClick={() => setMenu(null)}
    >
      <video
        key={inTc ? 'tc-' + tcOffset : 'direct'}
        ref={videoRef}
        src={inTc ? transcodeUrl(ep.path, tcOffset) : streamUrl(ep.path)}
        poster={ep.thumb ? streamUrl(ep.thumb) : undefined}
        autoPlay
        crossOrigin="anonymous"
        onLoadedMetadata={onLoadedMetadata}
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
        onError={onVideoError}
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

      {series.intro &&
        !introSkipped &&
        effTime >= series.intro.start &&
        effTime < series.intro.end - 1 && (
          <button
            className="btn ghost skip-intro"
            onClick={(e) => {
              e.stopPropagation()
              setIntroSkipped(true)
              seekTo(series.intro.end)
            }}
          >
            Passer l'intro ⏭
          </button>
        )}

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
          <span className="spacer" style={{ flex: 1 }} />
          {inTc && <span className="tc-badge">transcodage</span>}
          {quality && <span className="quality-badge">{quality}</span>}
        </div>

        <div className="player-bottom" onClick={(e) => e.stopPropagation()}>
          {effDuration > 0 && (
            <div className="seekbar" ref={seekbarRef} onPointerDown={onSeekDown}>
              <div className="seek-buffered" style={{ width: bufferedPct + '%' }} />
              <div className="seek-played" style={{ width: playedPct + '%' }}>
                <div className="seek-knob" />
              </div>
            </div>
          )}

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
              {fmtTime(effTime)}
              {effDuration > 0 ? ' / ' + fmtTime(effDuration) : ''}
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
                  {ep.subs.length > 0 && (
                    <button className={subIdx === 0 ? 'sel' : ''} onClick={() => setSubIdx(0)}>
                      Désactivés
                    </button>
                  )}
                  {ep.subs.map((s, i) => (
                    <button
                      key={s.path}
                      className={subIdx === i + 1 ? 'sel' : ''}
                      onClick={() => setSubIdx(i + 1)}
                    >
                      {s.lang}
                    </button>
                  ))}
                  <button
                    onClick={async () => {
                      setMenu(null)
                      try {
                        await postJSON('/api/subtitle', { path: ep.path })
                        alert(
                          'Génération lancée — suivez la progression dans Téléchargements. ' +
                            'Les sous-titres apparaîtront ici une fois prêts.',
                        )
                      } catch (err) {
                        alert(err.message)
                      }
                    }}
                  >
                    ✨ Générer par IA (Whisper)
                  </button>
                </div>
              )}
            </div>

            <div className="menu-wrap">
              <button
                className="icon-btn"
                title="Marqueurs d'intro (Passer l'intro)"
                onClick={() => setMenu(menu === 'intro' ? null : 'intro')}
              >
                ⏩
              </button>
              {menu === 'intro' && (
                <div className="menu">
                  <button
                    onClick={async () => {
                      await postJSON(
                        '/api/series/' + encodeURIComponent(series.name) + '/intro',
                        { start: effTime },
                      )
                      onLibraryChange?.()
                      setMenu(null)
                    }}
                  >
                    Début d'intro = {fmtTime(effTime)}
                  </button>
                  <button
                    onClick={async () => {
                      await postJSON(
                        '/api/series/' + encodeURIComponent(series.name) + '/intro',
                        { end: effTime },
                      )
                      onLibraryChange?.()
                      setMenu(null)
                    }}
                  >
                    Fin d'intro = {fmtTime(effTime)}
                  </button>
                  {series.intro && (
                    <button
                      onClick={async () => {
                        await postJSON(
                          '/api/series/' + encodeURIComponent(series.name) + '/intro',
                          {},
                        )
                        onLibraryChange?.()
                        setMenu(null)
                      }}
                    >
                      Effacer les marqueurs
                    </button>
                  )}
                </div>
              )}
            </div>

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
