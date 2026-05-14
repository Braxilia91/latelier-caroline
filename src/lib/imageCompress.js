/**
 * src/lib/imageCompress.js
 *
 * Compression d'image pour Le tiroir (V1 photo).
 * Canvas resize max 1600px cote long + JPEG quality 0.85.
 * Spec : docs/le-tiroir-v1.md §5 (Schema traceBlobs) + §9 (stack technique).
 *
 * Usage :
 *   import { compressImage } from '../lib/imageCompress'
 *   const { blob, mimeType, width, height, originalSize } = await compressImage(file)
 *
 * En cas d'echec (fichier corrompu, format non supporte, navigateur refuse) :
 * la fonction throw une Error explicite. A catch cote appelant pour afficher
 * un message inline (cf. arbitrage LOT 3 Q2 : reste sur etape 1 + message inline).
 */

const MAX_LONG_EDGE = 1600
const JPEG_QUALITY = 0.85
const OUTPUT_MIME = 'image/jpeg'

/**
 * Compresse une image (File ou Blob) en JPEG.
 *
 * @param {File|Blob} file
 * @returns {Promise<{ blob: Blob, mimeType: string, width: number, height: number, originalSize: number }>}
 * @throws {Error} si le fichier ne peut pas etre charge ou encode
 */
export async function compressImage(file) {
  if (!file || typeof file !== 'object') {
    throw new Error('Aucun fichier fourni a compressImage.')
  }

  const originalSize = typeof file.size === 'number' ? file.size : 0
  const url = URL.createObjectURL(file)

  try {
    const img = await loadImage(url)
    const { targetWidth, targetHeight } = computeTargetDims(
      img.naturalWidth,
      img.naturalHeight
    )

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error("Impossible d'obtenir un contexte canvas 2D.")
    }

    // Fond blanc : evite le noir sur les PNG transparents convertis en JPEG.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetWidth, targetHeight)

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

    const blob = await canvasToBlob(canvas, OUTPUT_MIME, JPEG_QUALITY)
    if (!blob) {
      throw new Error("Echec de l'encodage JPEG (canvas.toBlob a renvoye null).")
    }

    return {
      blob,
      mimeType: OUTPUT_MIME,
      width: targetWidth,
      height: targetHeight,
      originalSize,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error("L'image chargee n'a pas de dimensions valides."))
        return
      }
      resolve(img)
    }
    img.onerror = () => reject(new Error("Impossible de charger l'image."))
    img.src = url
  })
}

function computeTargetDims(srcW, srcH) {
  const longEdge = Math.max(srcW, srcH)
  if (longEdge <= MAX_LONG_EDGE) {
    return { targetWidth: srcW, targetHeight: srcH }
  }
  const ratio = MAX_LONG_EDGE / longEdge
  return {
    targetWidth: Math.round(srcW * ratio),
    targetHeight: Math.round(srcH * ratio),
  }
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality)
  })
}
