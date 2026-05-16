// src/lib/pdfExport.js
// T12 — Génération PDF du livre autobiographique
//
// Format A5 (148×210mm) : lisible smartphone et tablette, standard livre.
// Police 'times' intégrée à jsPDF — pas de souci de font sur visionneuses.
// Texte sélectionnable, métadonnées, outline (bookmarks), liens internes TOC.
// Photos compressées à 1200px JPEG 0.8 pour taille fichier raisonnable.
//
// Lot E3 — Ornements ❦ (FLORAL HEART, U+2766, natif dans EB Garamond)
//          + sanitizeForGaramond() pour caractères utilisateur hors police.
//
// API :
//   import { generateBookPDF } from './pdfExport'
//   const blob = await generateBookPDF({
//     name, chapters, traces, loadTraceBlob, options, onProgress
//   })

import { jsPDF } from 'jspdf'

// ─── D1 — Police Unicode embarquée ──────────────────────────────
// jsPDF n'utilise par défaut que les fontes built-in PostScript (Times,
// Helvetica, Courier) qui ne supportent qu'ISO-8859-1. Tout caractère
// Unicode hors plage (❦ — … « » ' ' etc.) était rendu en mojibake.
// On charge à la demande EB Garamond (Open Font License) depuis
// public/fonts/, et on l'active comme famille active pour tous les
// setFont() du fichier. Fallback gracieux sur Times si TTF absents.
const FONT_FAMILY = 'EBGaramond'
const FONT_PATH   = '/fonts/'

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

async function loadFontBase64(filename) {
  const r = await fetch(FONT_PATH + filename, { cache: 'force-cache' })
  if (!r.ok) throw new Error(`HTTP ${r.status} sur ${filename}`)
  return arrayBufferToBase64(await r.arrayBuffer())
}

async function registerUnicodeFonts(pdf) {
  try {
    const [regular, italic] = await Promise.all([
      loadFontBase64('EBGaramond-Regular.ttf'),
      loadFontBase64('EBGaramond-Italic.ttf'),
    ])
    pdf.addFileToVFS('EBGaramond-Regular.ttf', regular)
    pdf.addFileToVFS('EBGaramond-Italic.ttf',  italic)
    pdf.addFont('EBGaramond-Regular.ttf', FONT_FAMILY, 'normal')
    pdf.addFont('EBGaramond-Italic.ttf',  FONT_FAMILY, 'italic')
    return FONT_FAMILY
  } catch (e) {
    console.warn(
      '[PDF] Polices Unicode indisponibles — fallback Times. Les caractères',
      'Unicode (❦ — … « ») seront mal rendus. Place EBGaramond-Regular.ttf',
      'et EBGaramond-Italic.ttf dans public/fonts/ pour un PDF propre.',
      e?.message,
    )
    return 'times'
  }
}

// Famille de police active — réassignée par registerUnicodeFonts au début
// de generateBookPDF. Reste 'times' si fallback (PDF moins propre mais pas crash).
let _activeFamily = 'times'


// ─── Constantes de mise en page (mm) ──────────────────────────────────────────
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

// Ornement floral (U+2766 FLORAL HEART) — présent dans EB Garamond et times
const ORNAMENT = '❦ · ❦ · ❦'

// ─── Sanitize — Lot E3 ────────────────────────────────────────────────
/**
 * Remplace les caractères Unicode absents d'EB Garamond / times
 * par des équivalents sûrs, pour éviter les carrés vides dans le PDF.
 *
 * Glyphs présents dans times (jsPDF built-in) et EB Garamond :
 *   ❦ ❧ † ‡ ‖ ― — – … « » ‘ ’ “ ” „ ‹ › • · ◆ ◇
 *   Et tous les espaces typographiques, fractions, exposants de base.
 *
 * Glyphs ABSENTS — mappés ici :
 *   Box Drawings U+2500─U+257F : ═ ─ ━ │ ┃ ┌ ┐ └ ┘ ┬ ┴ ┤ ├ ┼
 *   Check marks  : ✓ ✔ ✗ ✘
 *   Étoiles/florets : ★ ☆ ✦ ✧ ✪ ❀ ✿
 *   Asterism / ref  : ⁂ ※
 */
function sanitizeForGaramond(text) {
  if (!text) return text
  return String(text)
    // Box Drawings — lignes horizontales → tiret cadratin
    .replace(/[═─━┄┅┈┉╌╍═]/g, '―')
    // Box Drawings — lignes verticales → barre
    .replace(/[│┃┆┇┊┋╎╏]/g, '|')
    // Box Drawings — coins et jonctions → plus
    .replace(/[┌┍┎┏┐┑┒┓└┕┖┗┘┙┚┛├┝┞┟┠┡┢┣┤┥┦┧┨┩┪┫┬┭┮┯┰┱┲┳┴┵┶┷┸┹┺┻┼┽┾┿╀╁╂╃╄╅╆╇╈╉╊╋]/g, '+')
    // Check marks
    .replace(/[✓✔]/g, 'OK')
    .replace(/[✗✘]/g, 'X')
    // Étoiles et florets — remplacés par ❦ (floral heart, présent)
    .replace(/[★☆✦✧✪✫✬✭✮✯✰✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❄❅❆❇❈❉❊❋]/g, '❦')
    // Asterism / reference mark
    .replace(/[⁂※]/g, '❦')
}

// ─── Helpers pagination ───────────────────────────────────────────────────

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
  pdf.setFont(_activeFamily, 'normal')
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

// ─── Couverture ───────────────────────────────────────────────────
function renderCover(pdf, { name, dateLabel }) {
  // Ornement haut
  pdf.setFont(_activeFamily, 'normal')
  pdf.setFontSize(12)
  pdf.setTextColor(COLOR_GOLD)
  pdf.text(ORNAMENT, PAGE_W / 2, 60, { align: 'center' })

  // Titre
  pdf.setFont(_activeFamily, 'italic')
  pdf.setFontSize(30)
  pdf.setTextColor(COLOR_INK)
  pdf.text('Mon Histoire', PAGE_W / 2, 90, { align: 'center' })

  // Prénom (défensif : skip si vide/null/whitespace)
  if (name && name.trim()) {
    pdf.setFont(_activeFamily, 'normal')
    pdf.setFontSize(15)
    pdf.setTextColor(COLOR_BROWN)
    pdf.text(name.trim(), PAGE_W / 2, 112, { align: 'center' })
  }

  // Ornement médian
  pdf.setFont(_activeFamily, 'normal')
  pdf.setFontSize(12)
  pdf.setTextColor(COLOR_GOLD)
  pdf.text(ORNAMENT, PAGE_W / 2, 144, { align: 'center' })

  // Date en pied
  pdf.setFont(_activeFamily, 'italic')
  pdf.setFontSize(9)
  pdf.setTextColor(COLOR_LIGHT)
  pdf.text(`Imprimé le ${dateLabel}`, PAGE_W / 2, PAGE_H - 20, { align: 'center' })
}

// ─── Table des matières ────────────────────────────────────────────────
// ─── TOC ────────────────────────────────────────────────────────────────
// T12-TOC : pagination multi-pages. Les pages TOC sont réservées en amont
// dans generateBookPDF (addPageWithNumber x tocPagesNeeded). Cette fonction
// les remplit dans l'ordre : titre + ornement sur la 1ère, entrées suivantes
// sur les pages réservées. Plus de break silencieux.
//
// Capacités (A5 148×210, marges top/bottom 18mm, lineH 7mm) :
//   - Page TOC #1 (avec titre + ornement) : 19 entrées max
//   - Pages TOC #2+ (sans titre)          : 23 entrées max
function renderTOC(pdf, entries, startPageIdx) {
  const lineH    = 7
  const yMax     = PAGE_H - MARGIN_BOTTOM - 4
  const yStart1  = MARGIN_TOP + 38   // 1ère page : sous le titre + ornement
  const yStart2  = MARGIN_TOP + 14   // pages suivantes : juste sous la marge

  let pageIdx = startPageIdx
  pdf.setPage(pageIdx)

  // — Titre + ornement uniquement sur la 1ère page TOC —
  pdf.setFont(_activeFamily, 'italic')
  pdf.setFontSize(22)
  pdf.setTextColor(COLOR_BROWN)
  pdf.text('Table des matières', PAGE_W / 2, MARGIN_TOP + 14, { align: 'center' })

  pdf.setFont(_activeFamily, 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(COLOR_GOLD)
  pdf.text('❦', PAGE_W / 2, MARGIN_TOP + 22, { align: 'center' })

  // — Réglage du corps —
  pdf.setFont(_activeFamily, 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(COLOR_INK)

  let y = yStart1

  for (let i = 0; i < entries.length; i++) {
    if (y > yMax) {
      pageIdx += 1
      pdf.setPage(pageIdx)
      pdf.setFont(_activeFamily, 'normal')
      pdf.setFontSize(11)
      pdf.setTextColor(COLOR_INK)
      y = yStart2
    }

    const leftX  = leftMargin(pdf)
    const rightX = PAGE_W - rightMargin(pdf)

    const { title, pageNum } = entries[i]
    // Lot E3 — sanitize les titres de chapitre dans la TOC
    const cleanTitle = sanitizeForGaramond((title || 'Sans titre').slice(0, 42))
    pdf.text(`${i + 1}.  ${cleanTitle}`, leftX, y)
    pdf.text(String(pageNum), rightX, y, { align: 'right' })

    try {
      pdf.link(leftX, y - 5, rightX - leftX, 6, { pageNumber: pageNum })
    } catch (_) { /* tolérant si API varie */ }

    y += lineH
  }
}

// ─── Chapitre ─────────────────────────────────────────────────────────────────
function renderChapter(pdf, chapter, indexHumain) {
  // Lot E3 — sanitize le titre de chapitre (peut contenir des glyphs absents)
  const safeTitle = sanitizeForGaramond(chapter.title || 'Sans titre')

  pdf.setFont(_activeFamily, 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(COLOR_GOLD)
  pdf.text(`CHAPITRE ${indexHumain}`, PAGE_W / 2, MARGIN_TOP + 8, { align: 'center' })

  pdf.setFont(_activeFamily, 'italic')
  pdf.setFontSize(20)
  pdf.setTextColor(COLOR_INK)
  const titleLines = pdf.splitTextToSize(safeTitle, CONTENT_W)
  let y = MARGIN_TOP + 26
  for (const line of titleLines) {
    pdf.text(line, PAGE_W / 2, y, { align: 'center' })
    y += 8
  }

  if (chapter.intention && chapter.intention.trim()) {
    pdf.setFont(_activeFamily, 'italic')
    pdf.setFontSize(10)
    pdf.setTextColor(COLOR_LIGHT)
    const safeIntention = sanitizeForGaramond(chapter.intention.trim())
    const intLines = pdf.splitTextToSize(`❦  ${safeIntention}`, CONTENT_W * 0.85)
    for (const line of intLines) {
      pdf.text(line, PAGE_W / 2, y, { align: 'center' })
      y += 5
    }
  }

  // Séparateur ornemental
  y += 5
  pdf.setFont(_activeFamily, 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(COLOR_GOLD)
  pdf.text(ORNAMENT, PAGE_W / 2, y, { align: 'center' })
  y += 12

  writeFlowText(pdf, chapter.content || '', y)
}

/**
 * Écrit du texte en flux avec pagination automatique.
 * Lot E3 — sanitizeForGaramond appliqué sur chaque paragraphe.
 */
function writeFlowText(pdf, text, startY) {
  const lineH = 5.6  // mm pour 11pt
  let y = startY

  pdf.setFont(_activeFamily, 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(COLOR_INK)

  const paragraphs = String(text).split(/\n{2,}/g)

  for (let p = 0; p < paragraphs.length; p++) {
    const raw = paragraphs[p].replace(/\n+/g, ' ').trim()
    if (!raw) continue
    // Lot E3 — sanitize avant wrap
    const paragraph = sanitizeForGaramond(raw)

    const lines = pdf.splitTextToSize(paragraph, CONTENT_W)
    for (const line of lines) {
      if (y > PAGE_H - MARGIN_BOTTOM) {
        addPageWithNumber(pdf)
        y = MARGIN_TOP
        pdf.setFont(_activeFamily, 'normal')
        pdf.setFontSize(11)
        pdf.setTextColor(COLOR_INK)
      }
      pdf.text(line, leftMargin(pdf), y)
      y += lineH
    }
    y += lineH * 0.7  // espace inter-paragraphe
  }
}

// ─── Photo pleine page ───────────────────────────────────────────────────

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
  pdf.setFont(_activeFamily, 'italic')
  pdf.setFontSize(11)
  pdf.setTextColor(COLOR_BROWN)
  pdf.text(sanitizeForGaramond(trace.title || 'Souvenir'), PAGE_W / 2, legendY, { align: 'center' })

  if (trace.date) {
    pdf.setFont(_activeFamily, 'normal')
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

// ─── Main API ────────────────────────────────────────────────────

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

  // D1 — Charger la police Unicode AVANT toute écriture. Le retour est
  // 'EBGaramond' (succès) ou 'times' (fallback gracieux). On réassigne
  // _activeFamily pour que tous les setFont() suivants utilisent la bonne.
  _activeFamily = await registerUnicodeFonts(pdf)

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
    pdf.setFont(_activeFamily, 'italic')
    pdf.setFontSize(12)
    pdf.setTextColor(COLOR_LIGHT)
    pdf.text(
      'Ce livre est encore à écrire.',
      PAGE_W / 2, PAGE_H / 2,
      { align: 'center' },
    )
    return pdf.output('blob')
  }

  // 3. Réserver les pages TOC (T12-TOC : pagination dynamique)
  const TOC_CAP_FIRST  = 19
  const TOC_CAP_OTHERS = 23
  let tocPagesNeeded
  if (eligible.length <= TOC_CAP_FIRST) {
    tocPagesNeeded = 1
  } else {
    tocPagesNeeded = 1 + Math.ceil((eligible.length - TOC_CAP_FIRST) / TOC_CAP_OTHERS)
  }
  const tocFirstPageIdx = pdf.internal.getNumberOfPages() + 1
  for (let i = 0; i < tocPagesNeeded; i++) {
    addPageWithNumber(pdf)
  }

  // 4. Chapitres — chacun démarre sur une page recto
  const tracesByChapter = new Map()
  const orphanTraces    = []
  const willRenderPhotos =
    includePhotos &&
    Array.isArray(traces) &&
    traces.length > 0 &&
    typeof loadTraceBlob === 'function'

  if (willRenderPhotos) {
    for (const tr of traces) {
      if (!tr?.id) continue
      if (tr.chapterId) {
        if (!tracesByChapter.has(tr.chapterId)) tracesByChapter.set(tr.chapterId, [])
        tracesByChapter.get(tr.chapterId).push(tr)
      } else {
        orphanTraces.push(tr)
      }
    }
  }

  const tocEntries = []
  for (let i = 0; i < eligible.length; i++) {
    const ch = eligible[i]
    onProgress?.({ phase: 'chapter', index: i, total: eligible.length, title: ch.title })

    addPageWithNumber(pdf)
    ensureRecto(pdf)

    const pageNum = pdf.internal.getNumberOfPages()
    tocEntries.push({ title: ch.title, pageNum })

    try {
      pdf.outline.add(null, `Chapitre ${i + 1} — ${ch.title || 'Sans titre'}`, { pageNumber: pageNum })
    } catch (_) {}

    renderChapter(pdf, ch, i + 1)

    if (willRenderPhotos && tracesByChapter.has(ch.id)) {
      const chTraces = tracesByChapter.get(ch.id)
      for (let j = 0; j < chTraces.length; j++) {
        const trace = chTraces[j]
        onProgress?.({ phase: 'chapter-photo', chapterIndex: i, photoIndex: j, total: chTraces.length, title: trace.title })
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
  }

  // 5. Section Souvenirs — photos orphelines uniquement
  if (willRenderPhotos && orphanTraces.length > 0) {
    onProgress?.({ phase: 'photos-section' })

    addPageWithNumber(pdf)
    ensureRecto(pdf)

    pdf.setFont(_activeFamily, 'italic')
    pdf.setFontSize(24)
    pdf.setTextColor(COLOR_BROWN)
    pdf.text('Souvenirs', PAGE_W / 2, PAGE_H / 2 - 6, { align: 'center' })
    pdf.setFont(_activeFamily, 'normal')
    pdf.setFontSize(12)
    pdf.setTextColor(COLOR_GOLD)
    pdf.text(ORNAMENT, PAGE_W / 2, PAGE_H / 2 + 6, { align: 'center' })

    try {
      pdf.outline.add(null, 'Souvenirs', { pageNumber: pdf.internal.getNumberOfPages() })
    } catch (_) {}

    for (let i = 0; i < orphanTraces.length; i++) {
      const trace = orphanTraces[i]
      onProgress?.({ phase: 'photo', index: i, total: orphanTraces.length, title: trace.title })

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

  // 6. Remplir la TOC sur les pages réservées
  onProgress?.({ phase: 'toc' })
  renderTOC(pdf, tocEntries, tocFirstPageIdx)

  // 7. Mode d'affichage pour les visionneuses
  try {
    pdf.setDisplayMode('fit', 'single', 'UseOutlines')
  } catch (_) {}

  onProgress?.({ phase: 'done' })
  return pdf.output('blob')
}
