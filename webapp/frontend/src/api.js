export const streamUrl = (path) =>
  '/api/stream/' + path.split('/').map(encodeURIComponent).join('/')

export async function api(path, opts) {
  const res = await fetch(path, opts)
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))).detail
    throw new Error(detail || res.statusText)
  }
  return res.json()
}

export const postJSON = (path, body) =>
  api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

// --- progression de lecture et épisodes vus (localStorage, mêmes clés que v1)

export const getSeen = () =>
  new Set(JSON.parse(localStorage.getItem('anistream.seen') || '[]'))

export const markSeen = (path) => {
  const s = getSeen()
  s.add(path)
  localStorage.setItem('anistream.seen', JSON.stringify([...s]))
}

export const savePos = (path, time, duration) => {
  localStorage.setItem('anistream.pos.' + path, String(time))
  if (duration) localStorage.setItem('anistream.dur.' + path, String(duration))
}

export const getPos = (path) =>
  parseFloat(localStorage.getItem('anistream.pos.' + path) || '0')

export const getDur = (path) =>
  parseFloat(localStorage.getItem('anistream.dur.' + path) || '0')

export const clearPos = (path) => {
  localStorage.removeItem('anistream.pos.' + path)
}

// --- formatage

export const fmtTime = (s) => {
  if (!isFinite(s)) return '0:00'
  s = Math.max(0, Math.round(s))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export const fmtSpeed = (b) => (b ? (b / 1048576).toFixed(1) + ' Mo/s' : '')

export const qualityLabel = (w, h) => {
  if (!w || !h) return null
  const p = Math.min(w, h)
  if (p >= 2100) return '4K'
  if (p >= 1400) return '2K'
  if (p >= 1050) return 'FHD'
  if (p >= 700) return 'HD'
  return 'SD'
}
