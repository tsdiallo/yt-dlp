import { useEffect, useState } from 'react'

// Système global de toasts + modales (remplace alert/confirm/prompt natifs).
let pushToast = null
let openModal = null

export const toast = (msg, type = 'ok') =>
  pushToast?.({ id: Date.now() + Math.random(), msg, type })

export const confirmDialog = (opts) =>
  new Promise((resolve) => {
    if (openModal) openModal({ mode: 'confirm', ...opts, resolve })
    else resolve(window.confirm(opts.message || opts.title))
  })

export const promptDialog = (opts) =>
  new Promise((resolve) => {
    if (openModal) openModal({ mode: 'prompt', ...opts, resolve })
    else resolve(window.prompt(opts.message || opts.title, opts.defaultValue || ''))
  })

export function UIHost() {
  const [toasts, setToasts] = useState([])
  const [modal, setModal] = useState(null)
  const [input, setInput] = useState('')

  useEffect(() => {
    pushToast = (t) => {
      setToasts((list) => [...list.slice(-3), t])
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), 4200)
    }
    openModal = (m) => {
      setInput(m.defaultValue || '')
      setModal(m)
    }
    return () => {
      pushToast = null
      openModal = null
    }
  }, [])

  const close = (value) => {
    modal.resolve(value)
    setModal(null)
  }
  const cancelValue = modal?.mode === 'prompt' ? null : false
  const okValue = () => (modal.mode === 'prompt' ? input : true)

  return (
    <>
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.type}>
            {t.type === 'err' ? '✕ ' : '✓ '}
            {t.msg}
          </div>
        ))}
      </div>
      {modal && (
        <div className="modal-back" onClick={() => close(cancelValue)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close(cancelValue)
              if (e.key === 'Enter') close(okValue())
            }}
          >
            <h3>{modal.title}</h3>
            {modal.message && <p>{modal.message}</p>}
            {modal.mode === 'prompt' && (
              <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} />
            )}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => close(cancelValue)}>
                Annuler
              </button>
              <button
                autoFocus={modal.mode !== 'prompt'}
                className={'btn ' + (modal.danger ? 'danger' : 'primary')}
                onClick={() => close(okValue())}
              >
                {modal.confirmLabel || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
