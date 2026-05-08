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
      timerRef.current = null  // ← null avant save : évite double-save si visibilitychange arrive au même moment
      onSave(value)
    }, delay)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null  // ← null après cleanup : visibilitychange ne ghost-save plus
      }
    }
  }, [value, onSave, delay])

  // Flush immédiat si la page est cachée OU avant fermeture (verrouillage, kill app, navigation).
  // Couvre 3 vecteurs de perte :
  //   - changement d'onglet / verrouillage écran  → visibilitychange
  //   - fermeture d'onglet / reload                → beforeunload
  //   - mise en arrière-plan PWA Android          → pagehide (souvent plus fiable que beforeunload sur mobile)
  useEffect(() => {
    const flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
        try { onSaveRef.current(valueRef.current) } catch (_) {/* tolérant */}
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const handlePageHide = () => flush()
    const handleBeforeUnload = () => flush()

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide',           handlePageHide)
    window.addEventListener('beforeunload',       handleBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide',           handlePageHide)
      window.removeEventListener('beforeunload',       handleBeforeUnload)
    }
  }, []) // refs stables — pas de dépendances
}
