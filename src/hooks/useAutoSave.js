import { useEffect, useRef } from 'react'

/**
 * Auto-save avec debounce + flush sur visibilitychange.
 * - Appelle onSave après `delay` ms d'inactivité.
 * - Si la page est cachée (changement d'onglet, verrouillage téléphone)
 *   et qu'un timer est en attente, flush immédiatement pour éviter
 *   de perdre les derniers mots tapés.
 */
export function useAutoSave(value, onSave, delay = 1200) {
  const timerRef  = useRef(null)
  const lastRef   = useRef(value)
  // Refs stables pour le listener visibilitychange (pas de re-registration)
  const valueRef  = useRef(value)
  const onSaveRef = useRef(onSave)

  // Maintenir les refs à jour sans déclencher d'effet
  useEffect(() => { valueRef.current  = value  }, [value])
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  // Debounce classique
  useEffect(() => {
    if (value === lastRef.current) return
    lastRef.current = value

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSave(value)
    }, delay)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [value, onSave, delay])

  // Flush immédiat si la page est cachée et qu'un debounce est en attente
  useEffect(() => {
    const handleHide = () => {
      if (document.visibilityState === 'hidden' && timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        onSaveRef.current(valueRef.current)
      }
    }
    document.addEventListener('visibilitychange', handleHide)
    return () => document.removeEventListener('visibilitychange', handleHide)
  }, []) // refs stables — pas de dépendances
}
