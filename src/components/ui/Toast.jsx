import { useState, useCallback, useEffect, useRef, createContext, useContext } from 'react'

const ToastCtx = createContext(null)

let _seq = 0
const newId = () => `toast_${Date.now()}_${++_seq}`

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  useEffect(() => {
    const activeTimers = timers.current
    return () => {
      Object.values(activeTimers).forEach(clearTimeout)
    }
  }, [])

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((msg, type = 'info', duration = 3000, action = null) => {
    const id = newId()
    const safeAction = action && typeof action.fn === 'function' ? action : null
    setToasts(prev => [...prev, { id, msg, type, action: safeAction }])
    timers.current[id] = setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1 }}>{t.msg}</span>
            {t.action && (
              <button
                style={{
                  flexShrink: 0,
                  background: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: 6,
                  color: 'inherit',
                  padding: '3px 10px',
                  fontSize: '.76rem',
                  fontWeight: 700,
                  fontFamily: "'Nunito', sans-serif",
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                }}
                onClick={() => { t.action.fn(); dismiss(t.id) }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
