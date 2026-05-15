// src/lib/pdfExport.js
// T12 — Génération PDF du livre autobiographique
//
// Format A5 (148×210mm) : lisible smartphone et tablette, standard livre.
// Police 'times' intégrée à jsPDF — pas de souci de font sur visionneuses.
// Texte sélectionnable, métadonnées, outline (bookmarks), liens internes TOC.
// Photos compressées à 1200px JPEG 0.8 pour taille fichier raisonnable.
//
// API :
//   import { generateBookPDF } from './pdfExport'
//   const blob = await generateBookPDF({
//     name, chapters, traces, loadTraceBlob, options, onProgress
//   })

import { jsPDF } from 'jspdf'

// ─── Constantes de mise en page (mm) ────────────────────────────
const FORMAT = 'a5'
const PAGE_W = 148
const PAGE_H = 210
const MARGIN_INNER  = 18   // côté reliure (intérieur du livre)
const MARGIN_OUTER  = 14   // côté extérieur
const MARGIN_TOP    = 18
const MARGIN_BOTTOM = 18

const CONTENT_W = PAGE_W - MARGIN_INNER - MARGIN_OUTER
const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM

const COLOR_INK    = '#2A1A0E'
const COLOR_BROWN  = '#8B6445'
const COLOR_GOLD   = '#C4956A'
const COLOR_LIGHT  = '#9C8878'

// ─── Helpers pagination ─────────────────────────────────────────

/** Page courante impaire = recto (page de droite dans un livre). */
function isOddPage(pdf) {
  return pdf.internal.getNumberOfPages() % 2 === 1
}
function leftMargin(pdf)  { return isOddPage(pdf) ? MARGIN_INNER : MARGIN_OUTER }
function rightMargin(pdf) { return isOddPage(pdf) ? MARGIN_OUTER : MARGIN_INNER }

/** Numéro de page en pied (skip couverture page 1). */
function drawPageNumber(pdf) {
  const n = pdf.internal.getNumberOfPages()
  if (n <= 1) return
  pdf.setFont('times', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(COLOR_LIGHT)
  const x = isOddPage(pdf) ? PAGE_W - rightMargin(pdf) : leftMargin(pdf)
  const align = isOddPage(pdf) ? 'right' : 'left'
  pdf.text(String(n), x, PAGE_H - 8, { align })
}

/** Ajoute une page et numérote la nouvelle page courante. */
function addPageWithNumber(pdf) {
  pdf.addPage()
  drawPageNumber(pdf)
}

/** Garantit qu'on est sur une page recto (impaire). Insère une blanche sinon. */
function ensureRecto(pdf) {
  if (!isOddPage(pdf)) addPageWithNumber(pdf)
}

// ─── Couverture ─────────────────────────────────────────────────
function renderCover(pdf, { name, dateLabel }) {
  // Ornement haut
  pdf.setFont('times', 'normal')
  pdf.setFontSize(12)
  pdf.setTextColor(COLOR_GOLD)
  pdf.text('✦ · ✦ · ✦', PAGE_W / 2, 60, { align: 'center' })

  // Titre
  pdf.setFont('times', 'italic')
  pdf.setFontSize(30)
  pdf.setTextColor(COLOR_INK)
  pdf.text('Mon Histoire', PAGE_W / 2, 90, { align: 'center' })

  // Prénom (défensif : skip si vide/null/whitespace)
  if (name && name.trim()) {
    pdf.setFont('times', 'normal')
    pdf.setFontSize(15)
    pdf.setTextColor(COLOR_BROWN)
    pdf.text(name.trim(), PAGE_W / 2, 112, { align: 'center' })
  }

  // Ornement médian
  pdf.setFont('times', 'normal')
  pdf.setFontSize(12)
  pdf.setTextColor(COLOR_GOLD)
  pdf.text('✦ · ✦ · ✦', PAGE_W / 2, 144, { align: 'center' })

  // Date en pied
  pdf.setFont('times', 'italic')
  pdf.setFontSize(9)
  pdf.setTextColor(COLOR_LIGHT)
  pdf.text(`Imprimé le ${dateLabel}`, PAGE_W / 2, PAGE_H - 20, { align: 'center' })
}

// ─── Table des matières ─────────────────────────────────────────
function renderTOC(pdf, entries) {
  pdf.setFont('times', 'italic')
  pdf.setFontSize(22)
  pdf.setTextColor(COLOR_BROWN)
  pdf.text('Table des matières', PAGE_W / 2, MARGIN_TOP + 14, { align: 'center' })

  pdf.setFont('times', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(COLOR_GOLD)
  pdf.text('✦', PAGE_W / 2, MARGIN_TOP + 22, { align: 'center' })

  pdf.setFont('times', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(COLOR_INK)

  const lineH = 7
  let y = MARGIN_TOP + 38
  const leftX  = leftMargin(pdf)
  const rightX = PAGE_W - rightMargin(pdf)

  for (let i = 0; i < entries.length; i++) {
    if (y > PAGE_H - MARGIN_BOTTOM - 4) break  // TOC tient sur 1 page MVP

    const { title, pageNum } = entries[i]
    const cleanTitle = (title || 'Sans titre').slice(0, 42)
    pdf.text(`${i + 1}.  ${cleanTitle}`, leftX, y)
    pdf.text(String(pageNum), rightX, y, { align: 'right' })

    try {
      pdf.link(leftX, y - 5, rightX - leftX, 6, { pageNumber: pageNum })
    } catch (_) { /* tolérant si API varie */ }

    y += lineH
  }
}

// ─── Chapitre ───────────────────────────────────────────────────
function renderChapter(pdf, chapter, indexHumain) {
  pdf.setFont('times', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(COLOR_GOLD)
  pdf.text(`CHAPITRE ${indexHumain}`, PAGE_W / 2, MARGIN_TOP + 8, { align: 'center' })

  pdf.setFont('times', 'italic')
  pdf.setFontSize(20)
  pdf.setTextColor(COLOR_INK)
  const titleLines = pdf.splitTextToSize(chapter.title || 'Sans titre', CONTENT_W)
  let y = MARGIN_TOP + 26
  for (const line of titleLines) {
    pdf.text(line, PAGE_W / 2, y, { align: 'center' })
    y += 8
  }

  if (chapter.intention && chapter.intention.trim()) {
    pdf.setFont('times', 'italic')
    pdf.setFontSize(10)
    pdf.setTextColor(COLOR_LIGHT)
    const intLines = pdf.splitTextToSize(`✦ ${chapter.intention.trim()}`, CONTENT_W * 0.85)
    for (const line of intLines) {
      pdf.text(line, PAGE_W / 2, y, { align: 'center' })
      y += 5
    }
  }

  // Séparateur ornemental
  y += 5
  pdf.setFont('times', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(COLOR_GOLD)
  pdf.text('✦ · ✦ · ✦', PAGE_W / 2, y, { align: 'center' })
  y += 12

  writeFlowText(pdf, chapter.content || '', y)
}

/**
 * Écrit du texte en flux avec pagination automatique.
 * Découpe par paragraphes (\n+), wrap mot à mot, saute de page si dépassement.
 * Recalcule la marge gauche à chaque ligne (alternance recto/verso).
 */
function writeFlowText(pdf, text, startY) {
  const lineH = 5.6  // mm pour 11pt
  let y = startY

  pdf.setFont('times', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(COLOR_INK)

  const paragraphs = String(text).split(/\n{2,}/g)

  for (let p = 0; p < paragraphs.length; p++) {
    const paragraph = paragraphs[p].replace(/\n+/g, ' ').trim()
    if (!paragraph) continue

    const lines = pdf.splitTextToSize(paragraph, CONTENT_W)
    for (const line of lines) {
      if (y > PAGE_H - MARGIN_BOTTOM) {
        addPageWithNumber(pdf)
        y = MARGIN_TOP
        pdf.setFont('times', 'normal')
        pdf.setFontSize(11)
        pdf.setTextColor(COLOR_INK)
      }
      pdf.text(line, leftMargin(pdf), y)
      y += lineH
    }
    y += lineH * 0.7  // espace inter-paragraphe
  }
}

// ─── Photo pleine page ──────────────────────────────────────────

async function compressImage(blob, maxDim = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1)
      const w = Math.max(1, Math.round(img.width * ratio))
      const h = Math.max(1, Math.round(img.height * ratio))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), w, h })
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}

async function renderPhotoPage(pdf, trace, blob) {
  const compressed = await compressImage(blob, 1200, 0.8)
  const { dataUrl, w, h } = compressed

  const maxW = CONTENT_W
  const maxH = CONTENT_H - 24
  const ratioPx = w / h
  let dispW = maxW
  let dispH = dispW / ratioPx
  if (dispH > maxH) {
    dispH = maxH
    dispW = dispH * ratioPx
  }
  const x = (PAGE_W - dispW) / 2
  const y = MARGIN_TOP + (maxH - dispH) / 2

  pdf.addImage(dataUrl, 'JPEG', x, y, dispW, dispH)

  const legendY = MARGIN_TOP + maxH + 8
  pdf.setFont('times', 'italic')
  pdf.setFontSize(11)
  pdf.setTextColor(COLOR_BROWN)
  pdf.text(trace.title || 'Souvenir', PAGE_W / 2, legendY, { align: 'center' })

  if (trace.date) {
    pdf.setFont('times', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(COLOR_LIGHT)
    let dateLabel = String(trace.date)
    try {
      dateLabel = new Date(trace.date).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    } catch (_) { /* fallback string brute */ }
    pdf.text(dateLabel, PAGE_W / 2, legendY + 5, { align: 'center' })
  }
}

// ─── Main API ───────────────────────────────────────────────────

/**
 * Génère le livre PDF complet.
 *
 * @param {object}  params
 * @param {string}  params.name             Prénom de l'auteur (couverture + métadonnées)
 * @param {Array}   params.chapters         Liste des chapitres (déjà filtrés selon mode)
 * @param {Array}   [params.traces=[]]      Métadonnées des traces (section Souvenirs)
 * @param {Function}[params.loadTraceBlob]  async (traceId) → { blob, mimeType } | null
 * @param {object}  [params.options]
 * @param {boolean} [params.options.includePhotos=true]
 * @param {Function}[params.onProgress]     callback({ phase, index, total, title })
 * @returns {Promise<Blob>} PDF blob
 */
export async function generateBookPDF({
  name = '',
  chapters = [],
  traces = [],
  loadTraceBlob = null,
  options = {},
  onProgress = null,
}) {
  const { includePhotos = true } = options

  const pdf = new jsPDF({ format: FORMAT, unit: 'mm', orientation: 'portrait' })

  // Métadonnées (lues par les visionneuses : titre dans Apple Books, etc.)
  const safeName = (name || '').trim()
  pdf.setProperties({
    title:    `${safeName ? safeName + ' — ' : ''}Mon Histoire`,
    author:   safeName || "L'Atelier",
    creator:  "L'Atelier Caroline",
    subject:  'Autobiographie',
    keywords: 'autobiographie, mémoire, livre',
  })

  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // 1. Couverture (page 1, sans numéro)
  renderCover(pdf, { name: safeName, dateLabel })

  // 2. Tri des chapitres par order
  const eligible = [...chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // Cas dégénéré : aucun chapitre éligible
  if (eligible.length === 0) {
    addPageWithNumber(pdf)
    pdf.setFont('times', 'italic')
    pdf.setFontSize(12)
    pdf.setTextColor(COLOR_LIGHT)
    pdf.text(
      'Ce livre est encore à écrire.',
      PAGE_W / 2, PAGE_H / 2,
      { align: 'center' },
    )
    return pdf.output('blob')
  }

  // 3. Réserver la page TOC (sera remplie en fin de génération)
  addPageWithNumber(pdf)
  const tocPageIdx = pdf.internal.getNumberOfPages()

  // 4. Chapitres — chacun démarre sur une page recto
  const tocEntries = []
  for (let i = 0; i < eligible.length; i++) {
    const ch = eligible[i]
    onProgress?.({ phase: 'chapter', index: i, total: eligible.length, title: ch.title })

    addPageWithNumber(pdf)
    ensureRecto(pdf)

    const pageNum = pdf.internal.getNumberOfPages()
    tocEntries.push({ title: ch.title, pageNum })

    // Bookmark PDF (outline) — navigation native dans les visionneuses
    try {
      pdf.outline.add(null, `Chapitre ${i + 1} — ${ch.title || 'Sans titre'}`, { pageNumber: pageNum })
    } catch (_) { /* tolérant : outline API peut varier selon version jsPDF */ }

    renderChapter(pdf, ch, i + 1)
  }

  // 5. Section Souvenirs (si traces et loader fournis)
  if (includePhotos && Array.isArray(traces) && traces.length > 0 && typeof loadTraceBlob === 'function') {
    onProgress?.({ phase: 'photos-section' })

    addPageWithNumber(pdf)
    ensureRecto(pdf)

    pdf.setFont('times', 'italic')
    pdf.setFontSize(24)
    pdf.setTextColor(COLOR_BROWN)
    pdf.text('Souvenirs', PAGE_W / 2, PAGE_H / 2 - 6, { align: 'center' })
    pdf.setFont('times', 'normal')
    pdf.setFontSize(12)
    pdf.setTextColor(COLOR_GOLD)
    pdf.text('✦ · ✦ · ✦', PAGE_W / 2, PAGE_H / 2 + 6, { align: 'center' })

    try {
      pdf.outline.add(null, 'Souvenirs', { pageNumber: pdf.internal.getNumberOfPages() })
    } catch (_) {}

    for (let i = 0; i < traces.length; i++) {
      const trace = traces[i]
      onProgress?.({ phase: 'photo', index: i, total: traces.length, title: trace.title })

      try {
        const blobRec = await loadTraceBlob(trace.id)
        if (!blobRec?.blob) continue
        addPageWithNumber(pdf)
        await renderPhotoPage(pdf, trace, blobRec.blob)
      } catch (e) {
        console.warn('[PDF] photo failed for trace', trace.id, e?.message)
      }
    }
  }

  // 6. Remplir la TOC sur la page réservée
  onProgress?.({ phase: 'toc' })
  pdf.setPage(tocPageIdx)
  renderTOC(pdf, tocEntries)

  // 7. Mode d'affichage pour les visionneuses (mobile-friendly)
  try {
    pdf.setDisplayMode('fit', 'single', 'UseOutlines')
  } catch (_) { /* tolérant si setDisplayMode signature varie */ }

  onProgress?.({ phase: 'done' })
  return pdf.output('blob')
}
