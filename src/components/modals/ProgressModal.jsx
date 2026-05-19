import { useState, useMemo } from 'react'
import Modal from '../ui/Modal'
import {
  X,
  CalendarDots as CalendarDays,
  Fire as Flame,
} from '@phosphor-icons/react'
import { DayPicker } from 'react-day-picker'
import { fr } from 'react-day-picker/locale'
import 'react-day-picker/style.css'

// ProgressModal — calendrier mensuel react-day-picker v9.
// Remplace l'ancienne heatmap 53x7 (illisible sur mobile <400px de large).
// Navigation par fleches mois precedent/suivant, jours d'ecriture en dore,
// jours futurs grises. Pas de selection interactive (pas de prop mode -> v9
// rend un calendrier de consultation, pas un date picker).

export default function ProgressModal({
  sessionDates = [],
  streak = 0,
  sessions = 0,
  name = '',
  onClose,
}) {
  // Mois actuellement affiche (defaut : mois en cours)
  const [displayMonth, setDisplayMonth] = useState(() => new Date())

  // Convertir 'YYYY-MM-DD' -> Date locale pour DayPicker modifiers
  // (eviter new Date(string) qui parse en UTC et decale d'un jour selon le fuseau)
  const writtenDays = useMemo(
    () => sessionDates
      .filter(s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s))
      .map(s => {
        const [y, m, d] = s.split('-').map(Number)
        return new Date(y, m - 1, d)
      }),
    [sessionDates]
  )

  // Premiere date d'ecriture pour le sous-titre
  const firstSessionDate = useMemo(() => {
    if (!sessionDates.length) return null
    return [...sessionDates].sort()[0]
  }, [sessionDates])

  const firstSessionLabel = firstSessionDate
    ? (() => {
        const [y, m, d] = firstSessionDate.split('-').map(Number)
        return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
      })()
    : null

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Ma régularité"
      overlayStyle={S.overlay}
      modalStyle={S.modal}
    >
      {/* Override CSS variables + selecteurs react-day-picker v9 pour palette Caroline.
          v9 : .rdp-root pour les vars, .rdp-caption_label pour le label mois/annee,
          .rdp-day_button pour les boutons jour. */}
      <style>{`
        .rdp-root {
          --rdp-accent-color: #C4956A;
          --rdp-accent-background-color: #F5F0E8;
          --rdp-font-family: 'Nunito', sans-serif;
          --rdp-today-color: #C4956A;
          --rdp-disabled-opacity: 0.3;
          --rdp-outside-opacity: 0.3;
        }
        .rdp-root .rdp-caption_label {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.05rem;
          font-weight: 700;
          color: #2A1A0E;
          text-transform: capitalize;
        }
        .rdp-root .rdp-day_button:hover:not(:disabled) {
          background-color: #F5F0E8;
        }
      `}</style>

      {/* Header */}
      <div style={S.hdr}>
        <div style={S.hdrLeft}>
          <span style={S.hdrIcon}><CalendarDays size={20} color="#C4956A" /></span>
          <div>
            <div style={S.hdrTitle}>
              Ma régularité{name ? `, ${name}` : ''}
            </div>
            <div style={S.hdrSub}>
              {sessions === 0
                ? "L'aventure commence — chaque jour visité comptera."
                : `${sessions} jour${sessions > 1 ? 's' : ''} d'écriture${firstSessionLabel ? ` depuis le ${firstSessionLabel}` : ''}.`}
            </div>
          </div>
        </div>
        <button style={S.closeBtn} onClick={onClose} aria-label="Fermer"><X size={18} /></button>
      </div>

      {/* Stats actuelles */}
      <div style={S.stats}>
        {streak > 0 && (
          <div style={S.statCard}>
            <Flame size={14} color="#C4956A" />
            <span style={S.statNum}>{streak}</span>
            <span style={S.statLbl}>jour{streak > 1 ? 's' : ''} d'affilée</span>
          </div>
        )}
        <div style={S.statCard}>
          <span style={S.statNum}>{sessions}</span>
          <span style={S.statLbl}>jour{sessions > 1 ? 's' : ''} en tout</span>
        </div>
      </div>

      {/* Calendrier mensuel — react-day-picker v9, pas de prop "mode" pour
          desactiver la selection interactive (consultation pure). */}
      <div style={S.calendarWrap}>
        <DayPicker
          locale={fr}
          month={displayMonth}
          onMonthChange={setDisplayMonth}
          weekStartsOn={1}
          showOutsideDays={false}
          disabled={{ after: today }}
          modifiers={{ written: writtenDays }}
          modifiersStyles={{
            written: {
              backgroundColor: '#C4956A',
              color: '#FFFEFB',
              borderRadius: '50%',
              fontWeight: 700,
            },
          }}
        />

        {/* Légende */}
        <div style={S.legend}>
          <span style={S.legendItem}>
            <span style={{ ...S.legendDot, background: '#C4956A' }} /> jour visité
          </span>
          <span style={S.legendItem}>
            <span style={{ ...S.legendDot, background: '#F5F0E8', border: '1px solid #E7D6BF' }} /> jour vide
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={S.footer}>
        <span style={S.footerNote}>
          Chaque jour où tu viens écrire est un point doré. Les jours vides ne sont pas un échec — c'est juste du gris doux.
        </span>
        <button style={S.closeFooterBtn} onClick={onClose}>Fermer</button>
      </div>
    </Modal>
  )
}

// ─── Style ────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(42,26,14,.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: 'var(--paper)',
    borderRadius: 18,
    width: '100%', maxWidth: 460,
    maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(42,26,14,.25)',
    overflow: 'hidden',
  },
  hdr: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '16px 20px 14px',
    borderBottom: '1px solid var(--border-l)',
    background: 'var(--cream)',
  },
  hdrLeft:  { display: 'flex', alignItems: 'flex-start', gap: 12 },
  hdrIcon:  { marginTop: 2 },
  hdrTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)' },
  hdrSub:   { fontSize: '.72rem', color: 'var(--ink-ll)', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    background: 'transparent', border: '1.5px solid var(--border-l)',
    color: 'var(--ink-ll)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stats: {
    display: 'flex', gap: 10, padding: '14px 20px 0', flexWrap: 'wrap',
  },
  statCard: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 14px',
    background: 'var(--gold-ll)',
    borderRadius: 10,
    fontSize: '.85rem', fontFamily: "'Nunito', sans-serif",
    color: 'var(--brown)',
  },
  statNum: { fontWeight: 800, fontSize: '1rem' },
  statLbl: { fontWeight: 600, opacity: 0.85 },
  calendarWrap: {
    padding: '14px 16px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    overflowY: 'auto',
  },
  legend: {
    display: 'flex', gap: 14, marginTop: 4,
    fontSize: '.72rem', color: 'var(--ink-ll)',
    fontFamily: "'Nunito', sans-serif",
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 5 },
  legendDot:  { width: 11, height: 11, borderRadius: '50%' },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid var(--border-l)',
    background: 'var(--cream)',
    gap: 10,
  },
  footerNote: {
    fontSize: '.74rem', color: 'var(--ink-ll)',
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    lineHeight: 1.6,
    flex: 1,
  },
  closeFooterBtn: {
    padding: '8px 18px',
    background: 'transparent', border: '1.5px solid var(--border-l)',
    borderRadius: 10, fontSize: '.82rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif", color: 'var(--ink-ll)',
    cursor: 'pointer', flexShrink: 0,
  },
}
