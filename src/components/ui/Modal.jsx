import { useEffect, useRef } from 'react'

/**
 * Wrapper modal accessible — L4-3.
 *
 * Fournit :
 *   • role="dialog" + aria-modal="true"
 *   • aria-label (nom accessible) — REQUIS
 *   • Focus initial : data-autofocus → 1er focusable → container (tabIndex=-1)
 *   • Focus trap (Tab / Shift+Tab cycliques)
 *   • Escape → onClose
 *   • Restitution du focus au déclencheur après fermeture
 *   • Overlay click-to-close optionnel (par défaut : true)
 *
 * Chaque modale conserve ses styles existants en passant
 * `overlayStyle`, `overlayClassName`, `modalStyle`, `modalClassName`.
 *
 * Le composant ne gère pas le mount/unmount : c'est le parent
 * (App.jsx) qui décide d'afficher la modale ou non. Donc le wrapper
 * suppose qu'il est rendu = ouvert.
 */
export default function Modal({
  onClose,
  ariaLabel,
  // Default false : évite la fermeture accidentelle au click outside / Alt+Tab.
  // L'utilisateur ferme via le bouton X ou la touche Échap (déjà câblés).
  // Une modale peut opt-in explicitement avec closeOnOverlay={true} si besoin.
  closeOnOverlay = false,
  overlayStyle,
  overlayClassName,
  modalStyle,
  modalClassName,
  children,
}) {
  const dialogRef         = useRef(null)
  const previousFocusRef  = useRef(null)

  // ── Capture le focus précédent + focus initial sur la modale ──
  useEffect(() => {
    previousFocusRef.current = document.activeElement

    // Délai pour laisser React monter le DOM
    const id = setTimeout(() => {
      if (!dialogRef.current) return
      const autofocus = dialogRef.current.querySelector('[data-autofocus]')
      const firstFocusable = dialogRef.current.querySelector(FOCUSABLE_SELECTOR)
      const target = autofocus || firstFocusable || dialogRef.current
      try { target.focus({ preventScroll: true }) } catch (_) { /* tolérant */ }
    }, 0)

    return () => {
      clearTimeout(id)
      // Restitution du focus au déclencheur
      const prev = previousFocusRef.current
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus({ preventScroll: true }) } catch (_) { /* tolérant */ }
      }
    }
  }, [])

  // ── Escape + focus trap ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
        if (focusables.length === 0) {
          e.preventDefault()
          dialogRef.current.focus()
          return
        }
        const first  = focusables[0]
        const last   = focusables[focusables.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleOverlayClick = (e) => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose?.()
    }
  }

  return (
    <div
      style={overlayStyle}
      className={overlayClassName}
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        style={modalStyle}
        className={modalClassName}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]):not([aria-hidden="true"]), ' +
  '[href], ' +
  'input:not([type="hidden"]):not([disabled]), ' +
  'textarea:not([disabled]), ' +
  'select:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])'
