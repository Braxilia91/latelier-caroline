import { useState, useEffect } from 'react'

/**
 * Hook qui retourne true si la media query CSS matches le viewport actuel.
 * Init synchrone via window.matchMedia pour éviter le flash desktop sur mobile.
 * SSR-safe via guard typeof window.
 *
 * Usage : const isMobile = useMediaQuery('(max-width: 767px)')
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const handler = (e) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
