import { useMemo } from 'react'

import Modal from '../ui/Modal'
import { X, CalendarDays, Flame } from 'lucide-react'

// T11b — Date ISO 'YYYY-MM-DD' depuis une instance Date (local).
function toIso(d) {
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// T11b — Construit la grille 7×53 alignée lundi pour les ~365 derniers jours.
// Retourne :
//   { weeks: Array<Array<Cell>>, firstMonday: Date, today: Date }
//   Cell = { date, iso, isVisited, isFuture }
function buildGrid(sessionDatesSet, todayDate) {
  const today = new Date(todayDate)
  today.setHours(0, 0, 0, 0)

  // Reculer de 364 jours
  const start = new Date(today)
  start.setDate(today.getDate() - 364)

  // Aligner start sur le lundi qui le précède (ou lui-même si déjà lundi)
  const startDay = start.getDay()              // 0=dim, 1=lun, …, 6=sam
  const daysToMonday = startDay === 0 ? 6 : startDay - 1
  start.setDate(start.getDate() - daysToMonday)

  const weeks = []
  const cur = new Date(start)
  // 53 colonnes suffisent à couvrir 365 jours alignés au lundi
  for (let w = 0; w < 53; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const iso = toIso(cur)
      week.push({
        date: new Date(cur),
        iso,
        isVisited: sessionDatesSet.has(iso),
        isFuture:  cur > today,
      })
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  return { weeks, firstMonday: start, today }
}

// T11b — Ticks de mois affichés au-dessus de la grille.
// Renvoie [{ label: 'janv.', colIdx: 4 }, …] : pour chaque mois traversé,
// l'index de la première colonne où il apparaît.
function monthTicks(weeks) {
  const ticks = []
  let lastMonth = -1
  weeks.forEach((week, colIdx) => {
    // On regarde le premier jour de la semaine (lundi)
    const m = week[0].date.getMonth()
    if (m !== lastMonth) {
      const label = week[0].date.toLocaleDateString('fr-FR', { month: 'short' })
      ticks.push({ label, colIdx })
      lastMonth = m
    }
  })
  return ticks
}

export default function ProgressModal({
  sessionDates = [],
  streak = 0,
  sessions = 0,
  name = '',
  onClose,
}) {
  const today = new Date()

  // Set pour lookup O(1) dans la grille
  const sessionSet = useMemo(() => new Set(sessionDates), [sessionDates])

  const { weeks } = useMemo(() => buildGrid(sessionSet, today), [sessionSet, today.toDateString()])
  const ticks     = useMemo(() => monthTicks(weeks), [weeks])

  // Première date de session (= début de la pratique de Caroline)
  const firstSessionDate = useMemo(() => {
    if (!sessionDates.length) return null
    // Sort copie défensive — sessionDates non muté
    const sorted = [...sessionDates].sort()
    return sorted[0]
  }, [sessionDates])

  const firstSessionLabel = firstSessionDate
    ? new Date(firstSessionDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Ma régularité"
      overlayStyle={S.overlay}
      modalStyle={S.modal}
    >
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

      {/* Heatmap */}
      <div style={S.heatmapWrap}>
        {/* Ticks de mois */}
        <div style={S.monthRow}>
          {ticks.map((t, i) => (
            <span
              key={`${t.label}-${i}`}
              style={{
                ...S.monthLabel,
                left: `${t.colIdx * (CELL + GAP)}px`,
              }}
            >
              {t.label}
            </span>
          ))}
        </div>

        <div style={S.grid}>
          {weeks.map((week, colIdx) => (
            <div key={colIdx} style={S.col}>
              {week.map((cell) => (
                <span
                  key={cell.iso}
                  style={{
                    ...S.cell,
                    background: cell.isFuture
                      ? 'transparent'
                      : (cell.isVisited ? S.cellVisited.background : S.cellEmpty.background),
                    boxShadow: cell.isVisited ? S.cellVisited.boxShadow : 'none',
                  }}
                  title={
                    cell.isFuture
                      ? ''
                      : `${cell.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} — ${cell.isVisited ? 'visité ✓' : 'jour vide'}`
                  }
                  aria-hidden="true"
                />
              ))}
            </div>
          ))}
        </div>

        {/* Légende */}
        <div style={S.legend}>
          <span style={S.legendItem}>
            <span style={{ ...S.legendDot, background: S.cellEmpty.background }} /> jour vide
          </span>
          <span style={S.legendItem}>
            <span style={{ ...S.legendDot, background: S.cellVisited.background }} /> jour visité
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
const CELL = 11   // taille des cells en px
const GAP  = 3    // gap entre cells

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
    width: '100%', maxWidth: 760,
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
  heatmapWrap: {
    padding: '18px 20px 8px',
    overflowX: 'auto',
  },
  monthRow: {
    position: 'relative',
    height: 16,
    marginBottom: 4,
  },
  monthLabel: {
    position: 'absolute',
    top: 0,
    fontSize: '.62rem',
    fontFamily: "'Nunito', sans-serif",
    color: 'var(--ink-ll)',
    textTransform: 'capitalize',
    whiteSpace: 'nowrap',
  },
  grid: {
    display: 'flex',
    gap: GAP,
  },
  col: {
    display: 'flex', flexDirection: 'column',
    gap: GAP,
  },
  cell: {
    width: CELL, height: CELL,
    borderRadius: 2,
    transition: 'background .12s',
    flexShrink: 0,
  },
  cellEmpty: {
    background: 'var(--border-l)',
  },
  cellVisited: {
    background: 'var(--gold-l)',
    boxShadow: '0 0 0 1px rgba(196,149,106,.35)',
  },
  legend: {
    display: 'flex', gap: 14, marginTop: 12,
    fontSize: '.7rem', color: 'var(--ink-ll)',
    fontFamily: "'Nunito', sans-serif",
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 5 },
  legendDot:  { width: 9, height: 9, borderRadius: 2 },
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
