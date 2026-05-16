/**
 * imagePreprocess.js — Prétraitement image pour améliorer la précision OCR.
 *
 * API publique :
 *   preprocessForOCR(blob): Promise<Blob>
 *
 * Pipeline :
 *   1. Decode blob → canvas (createImageBitmap)
 *   2. Grayscale perceptuel (luminosité BT.601)
 *   3. Guard plage dynamique (skip binarisation si contraste < 30)
 *   4. Seuillage binaire adaptatif (algorithme Otsu)
 *   5. Encode canvas → PNG (sans artefacts JPEG)
 *
 * Le blob original reste inchangé — uniquement le blob OCR est transformé.
 * En cas d'erreur, renvoie le blob original en fallback silencieux.
 */
export async function preprocessForOCR(blob) {
  try {
    const bmp = await createImageBitmap(blob)
    const { width, height } = bmp

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No 2D context')

    ctx.drawImage(bmp, 0, 0)
    bmp.close() // libère mémoire GPU immédiatement

    const imageData = ctx.getImageData(0, 0, width, height)
    const { data } = imageData

    // Étape 1 — Grayscale BT.601 + histogramme
    // IMPORTANT : les valeurs R,G,B sont remplacées par gray.
    // La boucle de binarisation (Étape 4) relit data[i] comme valeur grise.
    // Ne pas réordonner ces deux boucles.
    const histogram = new Uint32Array(256)
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      data[i] = data[i + 1] = data[i + 2] = gray
      histogram[gray]++
    }

    // Étape 2 — Guard plage dynamique
    // Si l'image est trop sombre ou uniforme (range < 30), Otsu retournerait
    // un threshold pathologique → on retourne le grayscale sans binarisation.
    let minVal = 255, maxVal = 0
    for (let v = 0; v < 256; v++) {
      if (histogram[v] > 0) {
        if (v < minVal) minVal = v
        if (v > maxVal) maxVal = v
      }
    }
    if (maxVal - minVal < 30) {
      ctx.putImageData(imageData, 0, 0)
      return await canvasToBlob(canvas, 'image/png')
    }

    // Étape 3 — Calcul du seuil optimal (algorithme d'Otsu)
    const total = width * height
    let sum = 0
    for (let i = 0; i < 256; i++) sum += i * histogram[i]

    let sumB = 0, wB = 0, max = 0, threshold = 128
    for (let t = 0; t < 256; t++) {
      wB += histogram[t]
      if (!wB) continue
      const wF = total - wB
      if (!wF) break
      sumB += t * histogram[t]
      const mB = sumB / wB
      const mF = (sum - sumB) / wF
      const between = wB * wF * (mB - mF) ** 2
      if (between > max) { max = between; threshold = t }
    }

    // Étape 4 — Binarisation : chaque pixel → blanc (255) ou noir (0)
    for (let i = 0; i < data.length; i += 4) {
      const bin = data[i] > threshold ? 255 : 0
      data[i] = data[i + 1] = data[i + 2] = bin
      // canal alpha inchangé
    }

    ctx.putImageData(imageData, 0, 0)
    return await canvasToBlob(canvas, 'image/png')
  } catch (err) {
    // Fallback silencieux : blob original, Tesseract fonctionne sans prétraitement
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.warn('[preprocessForOCR] fallback:', err)
    }
    return blob
  }
}

function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvasToBlob returned null'))
    }, mimeType)
  })
}
