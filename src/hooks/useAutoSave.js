import { useEffect, useRef } from 'react'

/**
 * Auto-save avec debounce.
 * Appelle onSave après `delay` ms d'inactivité.
 */
export function useAutoSave(value, onSave, delay = 1200) {
  const timerRef = useRef(null)
  const lastRef  = useRef(value)

  useEffect(() => {
    if (value === lastRef.current) return
    lastRef.current = value

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSave(value)
    }, delay)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [value, onSave, delay])
}
