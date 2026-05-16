// src/lib/docxExport.js
// Lot E — Génération manuscrit Word (.docx) pour maison d'édition
//
// Standard manuscrit français :
//   - Page A4 portrait, marges 2.5 cm
//   - Police Garamond 12 pt, interligne 1.5
//   - Texte justifié, sauts de page entre chapitres
//   - Heading 1 par chapitre → TOC native Word/LibreOffice
//   - Métadonnées Word (titre, auteur, sujet)
//   - Photos rattachées via chapterId (parité Lot C PDF)
//   - Ornement ❦ · ❦ · ❦ (FLORAL HEART, compatible Garamond)
//
// API :
//   import { generateBookDOCX } from './docxExport'
//   const blob = await generateBookDOCX({
//     name, chapters, traces, loadTraceBlob, options, onProgress
//   })

// ─── Constantes mise en page ─────────────────────────────────────
// 1 inch = 1440 twips. A4 = 11907 × 16840 twips.
const PAGE_W_TWIPS  = 11907
const PAGE_H_TWIPS  = 16840
const MARGIN_TWIPS  = 1440  // 2.54 cm ≈ 1 inch

// Couleurs (hex sans #, format docx)
const COLOR_INK   = '2A1A0E'
const COLOR_BROWN = '8B6445'
const COLOR_GOLD  = 'C4956A'
const COLOR_LIGHT = '9C8878'

// Ornement floral compatible Garamond (U+2766)
const ORNEMENT = '❦ · ❦ · ❦'

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Crée un run de texte avec options optionnelles.
 * @param {import('docx').default} D  — namespace docx importé dynamiquement
 */
function run(D, text, opts = {}) {
  return new D.TextRun({
    text,
    font: 'Garamond',
    size: opts.size ?? 24,          // demi-points : 24 = 12 pt
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? COLOR_INK,
    ...opts.extra,
  })
}

/** Paragraphe justifié avec interligne 1.5. */
function para(D, children, opts = {}) {
  return new D.Paragraph({
    children,
    alignment: opts.alignment ?? D.AlignmentType.JUSTIFIED,
    spacing: { line: 360, lineRule: D.LineRuleType.AUTO, after: opts.after ?? 0 },
    pageBreakBefore: opts.pageBreakBefore ?? false,
    style: opts.style,
  })
}

/** Ornement centré (séparateur de chapitre). */
function ornamentPara(D) {
  return new D.Paragraph({
    children: [
      new D.TextRun({
        text: ORNEMENT,
        font: 'Garamond',
        size: 22,
        color: COLOR_GOLD,
      }),
    ],
    alignment: D.AlignmentType.CENTER,
    spacing: { line: 360, lineRule: D.LineRuleType.AUTO, before: 240, after: 240 },
  })
}

/** Saut de page explicite. */
function pageBreakPara(D) {
  return new D.Paragraph({
    children: [new D.PageBreak()],
  })
}

/**
 * Convertit un blob image en base64 DataURL.
 * Utilisé pour insérer les photos dans le DOCX.
 */
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Convertit une string base64 pure en Uint8Array.
 * docx v9 ImageRun.data n'accepte pas une string — il faut un Uint8Array.
 * @param {string} base64 — base64 pur (sans préfixe data:...)
 * @returns {Uint8Array}
 */
function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Compresse une image (canvas) et retourne { dataUrl, w, h }.
 * Parité avec pdfExport.compressImage.
 */
async function compressImage(blob, maxDim = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1)
      const w = Math.max(1, Math.round(img.width  * ratio))
      const h = Math.max(1, Math.round(img.height * ratio))
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      try {
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), w, h })
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

/**
 * Crée les paragraphes d'un chapitre (heading + intention + ornement + contenu).
 */
async function buildChapterBlocks(D, chapter, indexHumain, chapterPhotos, loadTraceBlob, includePhotos) {
  const blocks = []

  // Heading 1 (saut de page avant via style + pageBreakBefore)
  blocks.push(new D.Paragraph({
    children: [
      new D.TextRun({
        text: `Chapitre ${indexHumain} — ${chapter.title || 'Sans titre'}`,
        font: 'Garamond',
        size: 32,       // 16 pt
        bold: true,
        color: COLOR_INK,
      }),
    ],
    heading: D.HeadingLevel.HEADING_1,
    alignment: D.AlignmentType.CENTER,
    pageBreakBefore: indexHumain > 1,   // saut avant chaque chapitre sauf le 1er
    spacing: { line: 360, lineRule: D.LineRuleType.AUTO, after: 240 },
  }))

  // Intention (si présente)
  if (chapter.intention && chapter.intention.trim()) {
    blocks.push(para(D, [
      run(D, `❦  ${chapter.intention.trim()}  ❦`, {
        italics: true, size: 20, color: COLOR_LIGHT,
      }),
    ], { alignment: D.AlignmentType.CENTER, after: 160 }))
  }

  // Ornement
  blocks.push(ornamentPara(D))

  // Contenu — découpage en paragraphes
  const rawContent = (chapter.content || '').trim()
  if (rawContent) {
    const paragraphs = rawContent.split(/\n{2,}/g)
    for (const p of paragraphs) {
      const text = p.replace(/\n+/g, ' ').trim()
      if (!text) continue
      blocks.push(para(D, [ run(D, text) ], { after: 120 }))
    }
  } else {
    blocks.push(para(D, [
      run(D, '(chapitre non encore écrit)', { italics: true, color: COLOR_LIGHT }),
    ], { after: 120 }))
  }

  // Photos rattachées à ce chapitre
  if (includePhotos && chapterPhotos && chapterPhotos.length > 0 && typeof loadTraceBlob === 'function') {
    for (const trace of chapterPhotos) {
      try {
        const blobRec = await loadTraceBlob(trace.id)
        if (!blobRec?.blob) continue

        const { dataUrl, w, h } = await compressImage(blobRec.blob, 1200, 0.8)

        // FIX: transformation prend des PIXELS — docx v9 convertit en EMU en interne.
        // Ne pas pré-calculer en EMU, sinon factor ×9525 appliqué deux fois.
        const maxPx = 450
        const scale = Math.min(maxPx / w, 1)
        const pxW   = Math.round(w * scale)
        const pxH   = Math.round(h * scale)

        // FIX: data attend un Uint8Array — base64 string → 0 bytes dans le zip.
        const imgBytes = base64ToUint8Array(dataUrl.split(',')[1])

        blocks.push(pageBreakPara(D))
        blocks.push(new D.Paragraph({
          children: [
            new D.ImageRun({
              data: imgBytes,
              transformation: { width: pxW, height: pxH },
              type: 'jpg',
            }),
          ],
          alignment: D.AlignmentType.CENTER,
          spacing: { after: 160 },
        }))

        // Légende
        blocks.push(para(D, [
          run(D, trace.title || 'Souvenir', { italics: true, color: COLOR_BROWN, size: 20 }),
        ], { alignment: D.AlignmentType.CENTER, after: 80 }))

        if (trace.date) {
          let dateLabel = String(trace.date)
          try {
            dateLabel = new Date(trace.date).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric',
            })
          } catch (_) {}
          blocks.push(para(D, [
            run(D, dateLabel, { size: 18, color: COLOR_LIGHT }),
          ], { alignment: D.AlignmentType.CENTER, after: 160 }))
        }
      } catch (e) {
        console.warn('[DOCX] photo failed for trace', trace.id, e?.message)
      }
    }
  }

  return blocks
}

// ─── Page couverture ─────────────────────────────────────────────
function buildCoverBlocks(D, safeName, dateLabel) {
  const blocks = []

  // Espace avant le titre
  blocks.push(new D.Paragraph({
    children: [],
    spacing: { before: 2880, after: 0 },   // ~2 inches de marge supérieure
  }))

  // Ornement haut
  blocks.push(new D.Paragraph({
    children: [ new D.TextRun({ text: ORNEMENT, font: 'Garamond', size: 24, color: COLOR_GOLD }) ],
    alignment: D.AlignmentType.CENTER,
    spacing: { after: 480 },
  }))

  // Titre
  blocks.push(new D.Paragraph({
    children: [ new D.TextRun({ text: 'Mon Histoire', font: 'Garamond', size: 60, italics: true, color: COLOR_INK }) ],
    alignment: D.AlignmentType.CENTER,
    spacing: { after: 240 },
  }))

  // Prénom auteur
  if (safeName) {
    blocks.push(new D.Paragraph({
      children: [ new D.TextRun({ text: safeName, font: 'Garamond', size: 30, color: COLOR_BROWN }) ],
      alignment: D.AlignmentType.CENTER,
      spacing: { after: 480 },
    }))
  }

  // Ornement bas
  blocks.push(new D.Paragraph({
    children: [ new D.TextRun({ text: ORNEMENT, font: 'Garamond', size: 24, color: COLOR_GOLD }) ],
    alignment: D.AlignmentType.CENTER,
    spacing: { after: 2880 },
  }))

  // Date en pied de couverture
  blocks.push(new D.Paragraph({
    children: [ new D.TextRun({ text: `Manuscrit imprimé le ${dateLabel}`, font: 'Garamond', size: 18, italics: true, color: COLOR_LIGHT }) ],
    alignment: D.AlignmentType.CENTER,
    spacing: { after: 0 },
  }))

  return blocks
}

// ─── Section Souvenirs (photos orphelines) ───────────────────────
async function buildSouvenirsBlocks(D, orphanTraces, loadTraceBlob, onProgress) {
  const blocks = []

  blocks.push(pageBreakPara(D))
  blocks.push(new D.Paragraph({
    children: [ new D.TextRun({ text: 'Souvenirs', font: 'Garamond', size: 48, italics: true, color: COLOR_BROWN }) ],
    heading: D.HeadingLevel.HEADING_1,
    alignment: D.AlignmentType.CENTER,
    spacing: { after: 240 },
  }))
  blocks.push(ornamentPara(D))

  for (let i = 0; i < orphanTraces.length; i++) {
    const trace = orphanTraces[i]
    onProgress?.({ phase: 'photo', index: i, total: orphanTraces.length, title: trace.title })
    try {
      const blobRec = await loadTraceBlob(trace.id)
      if (!blobRec?.blob) continue

      const { dataUrl, w, h } = await compressImage(blobRec.blob, 1200, 0.8)

      // FIX: pixels directs + Uint8Array (même correctif que buildChapterBlocks)
      const maxPx  = 450
      const scale  = Math.min(maxPx / w, 1)
      const pxW    = Math.round(w * scale)
      const pxH    = Math.round(h * scale)
      const imgBytes = base64ToUint8Array(dataUrl.split(',')[1])

      blocks.push(pageBreakPara(D))
      blocks.push(new D.Paragraph({
        children: [
          new D.ImageRun({ data: imgBytes, transformation: { width: pxW, height: pxH }, type: 'jpg' }),
        ],
        alignment: D.AlignmentType.CENTER,
        spacing: { after: 160 },
      }))

      blocks.push(para(D, [
        run(D, trace.title || 'Souvenir', { italics: true, color: COLOR_BROWN, size: 20 }),
      ], { alignment: D.AlignmentType.CENTER, after: 80 }))

      if (trace.date) {
        let dateLabel = String(trace.date)
        try { dateLabel = new Date(trace.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) } catch (_) {}
        blocks.push(para(D, [
          run(D, dateLabel, { size: 18, color: COLOR_LIGHT }),
        ], { alignment: D.AlignmentType.CENTER, after: 160 }))
      }
    } catch (e) {
      console.warn('[DOCX] orphan photo failed for trace', trace.id, e?.message)
    }
  }

  return blocks
}

// ─── Main API ────────────────────────────────────────────────────

/**
 * Génère le manuscrit Word complet.
 *
 * @param {object}   params
 * @param {string}   params.name              Prénom de l'auteur
 * @param {Array}    params.chapters           Chapitres (déjà filtrés selon mode)
 * @param {Array}    [params.traces=[]]        Métadonnées des traces (photos)
 * @param {Function} [params.loadTraceBlob]    async (traceId) → { blob, mimeType } | null
 * @param {object}   [params.options]
 * @param {boolean}  [params.options.includePhotos=true]
 * @param {Function} [params.onProgress]       callback({ phase, index, total, title })
 * @returns {Promise<Blob>} DOCX blob
 */
export async function generateBookDOCX({
  name = '',
  chapters = [],
  traces = [],
  loadTraceBlob = null,
  options = {},
  onProgress = null,
}) {
  // Dynamic import : chargé seulement au clic export
  const D = await import('docx')

  const { includePhotos = true } = options
  const safeName  = (name || '').trim()
  const dateLabel = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  // Index traces par chapterId
  const tracesByChapter = new Map()
  const orphanTraces    = []
  const willRenderPhotos =
    includePhotos &&
    Array.isArray(traces) && traces.length > 0 &&
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

  const eligible = [...chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const allBlocks = []

  // 1. Couverture
  allBlocks.push(...buildCoverBlocks(D, safeName, dateLabel))

  // 2. Chapitres
  if (eligible.length === 0) {
    allBlocks.push(pageBreakPara(D))
    allBlocks.push(para(D, [
      run(D, 'Ce livre est encore à écrire.', { italics: true, color: COLOR_LIGHT }),
    ], { alignment: D.AlignmentType.CENTER }))
  } else {
    for (let i = 0; i < eligible.length; i++) {
      const ch = eligible[i]
      onProgress?.({ phase: 'chapter', index: i, total: eligible.length, title: ch.title })
      const chPhotos = willRenderPhotos ? (tracesByChapter.get(ch.id) ?? []) : []
      const blocks   = await buildChapterBlocks(D, ch, i + 1, chPhotos, loadTraceBlob, includePhotos)
      allBlocks.push(...blocks)
    }
  }

  // 3. Section Souvenirs (photos orphelines)
  if (willRenderPhotos && orphanTraces.length > 0) {
    onProgress?.({ phase: 'photos-section' })
    const souvenirsBlocks = await buildSouvenirsBlocks(D, orphanTraces, loadTraceBlob, onProgress)
    allBlocks.push(...souvenirsBlocks)
  }

  onProgress?.({ phase: 'done' })

  // 4. Assembler le Document
  const doc = new D.Document({
    creator:     "L'Atelier Caroline",
    title:       safeName ? `${safeName} — Mon Histoire` : 'Mon Histoire',
    description: 'Manuscrit autobiographique',
    subject:     'Autobiographie',
    keywords:    'autobiographie, mémoire, manuscrit',
    styles: {
      default: {
        document: {
          run: {
            font: 'Garamond',
            size: 24,
            color: COLOR_INK,
          },
          paragraph: {
            spacing: { line: 360, lineRule: D.LineRuleType?.AUTO },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size:   { width: PAGE_W_TWIPS, height: PAGE_H_TWIPS },
            margin: { top: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS, right: MARGIN_TWIPS },
          },
        },
        children: allBlocks,
      },
    ],
  })

  // 5. Générer le blob
  const buffer = await D.Packer.toBlob(doc)
  return buffer
}
