import { useEffect, useRef } from 'react'

/**
 * Ferme un panneau quand l'utilisateur clique en dehors du conteneur référencé.
 * @param {React.RefObject} ref - ref attachée au conteneur (bouton trigger + dropdown)
 * @param {Function} onClickAway - callback appelé quand le clic est en dehors
 */
export default function useClickAway(ref, onClickAway) {
  const handlerRef = useRef(onClickAway)

  useEffect(() => {
    handlerRef.current = onClickAway
  }, [onClickAway])

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        handlerRef.current(e)
      }
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [ref])
}
