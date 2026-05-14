import { useState, useEffect, useRef } from 'react'
import Modal from '../ui/Modal'
import { X, ImagePlus } from 'lucide-react'
import { compressImage } from '../../lib/imageCompress'

/**
 * AddTraceFlow — Flow d'ajout d'une trace photo dans Le tiroir.
 *
 * Spec : docs/le-tiroir-v1.md §4 étapes 1-2 (V1 photo uniquement).
 * LOT 3 = étapes 1-2 seulement. Étapes 3-5 (OCR, 3 questions, choix de sortie)
 * reportées aux LOT 4-5-6.
 *
 * Étape 1 — Importer :
 *   File picker (accept="image/*") → compressImage (Canvas 1600px + JPEG q=0.85).
 *   En cas d'échec : message inline, reste sur étape 1, permet de retenter
 *   (cf. arbitrage LOT 3 Q2 figé dans REPRISE_CONV_LOT3.md).
 *
 * Étape 2 — Première écoute :
 *   Photo plein cadre + une seule question « Pourquoi cette photo, maintenant ? »
 *   Champ texte multiligne, vide accepté.
 *   Boutons : "Passer" (sauve avec whyNow='') / "Suivante" (sauve avec whyNow=text).
 *
 * Architecture (LOT 3 Option 1 stricte) :
 *   Ce composant ne touche pas IndexedDB directement. La persistance est
 *   entièrement déléguée au parent via la prop `onCreateTrace`, qui sera
 *   câblée en LOT 3B (TiroirModal ou App.jsx) en appelant createTraceWithBlob
 *   depuis lib/db.js. Cela préserve l'architecture centrée sur useAppState
 *   et évite une double porte d'accès aux données côté UI.
 *
 * Statut : composant non branché (aucune importation) tant que LOT 3B
 * ne l'instancie pas.
 *
 * Props :
 *   onClose        : () => void                                — ferme la modale
 *                                                                (X header, Échap, overlay, fin du flow)
 *   onCreateTrace  : ({ metadata, blob }) => Promise<trace>    — handler de persistance fourni par le parent.
 *                                                                Doit throw en cas d'échec pour que l'UI
 *                                                                affiche un message inline.
 */
export default function AddTraceFlow({ onClose, onCreateTrace }) {
  const [step, setStep]             = useState('import')   // 'import' | 'firstListen'
  const [compressed, setCompressed] = useState(null)        // { blob, mimeType, width, height, originalSize }
  const [previewUrl, setPreviewUrl] = useState(null)        // URL.createObjectURL pour <img>
  const [whyNow, setWhyNow]         = useState('')
  const [error, setError]           = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef                = useRef(null)
  const textareaRef                 = useRef(null)

  // Libère le URL.createObjectURL au démontage ou au remplacement du blob.
  // Évite les fuites mémoire si la modale est fermée avant la fin du flow.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Modal.jsx ne re-trigger pas son autofocus au step change (useEffect deps []).
  // On focus explicitement la textarea quand on bascule sur l'étape 2.
  useEffect(() => {
    if (step === 'firstListen') {
      const id = setTimeout(() => {
        try { textareaRef.current?.focus({ preventScroll: true }) } catch (_) { /* tolérant */ }
      }, 0)
      return () => clearTimeout(id)
    }
  }, [step])

  const handlePickFile = () => {
    setError(null)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''  // permet de re-sélectionner le même fichier après une erreur
    if (!file) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await compressImage(file)
      const url = URL.createObjectURL(result.blob)
      setCompressed(result)
      setPreviewUrl(url)
      setStep('firstListen')
    } catch (err) {
      setError(err?.message || "Cette photo n'a pas pu être chargée.")
    } finally {
      setSubmitting(false)
    }
  }

  const persistTrace = async (whyNowValue) => {
    if (!compressed || submitting) return
    if (typeof onCreateTrace !== 'function') {
      setError("Configuration manquante : impossible de sauvegarder pour l'instant.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onCreateTrace({
        metadata: {
          type:      'photo',
          mimeType:  compressed.mimeType,
          width:     compressed.width,
          height:    compressed.height,
          sizeBytes: compressed.blob.size,
          whyNow:    (whyNowValue || '').trim(),
          status:    'private',
        },
        blob: compressed.blob,
      })
      onClose?.()
      // Note : pas de setSubmitting(false) ici — le composant va être démonté par onClose.
      //        En cas d'erreur, le catch s'en charge.
    } catch (err) {
      setError(err?.message || "La sauvegarde a échoué. Réessaye dans un instant.")
      setSubmitting(false)
    }
  }

  const handleSkip = () => persistTrace('')
  const handleNext = () => persistTrace(whyNow)

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Ajouter au tiroir"
      overlayStyle={S.overlay}
      modalStyle={S.modal}
    >
      {/* Header */}
      <div style={S.hdr}>
        <div style={S.hdrLeft}>
          <span style={S.hdrIcon}>🪶</span>
          <div>
            <div style={S.hdrTitle}>Ajouter au tiroir</div>
            <div style={S.hdrSub}>
              {step === 'import'
                ? "Choisis une photo qui te parle aujourd'hui."
                : 'Pourquoi cette photo, maintenant ?'}
            </div>
          </div>
        </div>
        <button style={S.closeBtn} onClick={onClose} aria-label="Fermer">
          <X size={18} />
        </button>
      </div>

      {/* Étape 1 — Importer */}
      {step === 'import' && (
        <div style={S.bodyImport}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            data-autofocus
            style={{ ...S.pickBtn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer' }}
            onClick={handlePickFile}
            disabled={submitting}
          >
            <ImagePlus size={18} />
            {submitting ? 'Préparation…' : 'Choisir une photo'}
          </button>
          <p style={S.hint}>Une seule photo à la fois.</p>
          {error && <p style={S.errorInline} role="alert">{error}</p>}
        </div>
      )}

      {/* Étape 2 — Première écoute */}
      {step === 'firstListen' && (
        <div style={S.bodyListen}>
          <div style={S.imgWrap}>
            {previewUrl && <img src={previewUrl} alt="" style={S.img} />}
          </div>
          <textarea
            ref={textareaRef}
            data-autofocus
            style={S.textarea}
            value={whyNow}
            onChange={(e) => setWhyNow(e.target.value)}
            placeholder="Si rien ne vient, c'est très bien."
            rows={3}
            disabled={submitting}
          />
          {error && <p style={S.errorInline} role="alert">{error}</p>}
          <div style={S.footer}>
            <button
              style={{ ...S.skipBtn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer' }}
              onClick={handleSkip}
              disabled={submitting}
            >
              Passer
            </button>
            <button
              style={{ ...S.nextBtn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer' }}
              onClick={handleNext}
              disabled={submitting}
            >
              {submitting ? 'Sauvegarde…' : 'Suivante'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(42,26,14,.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#FFFEFB',
    borderRadius: 18,
    width: '100%', maxWidth: '90vw',
    maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(42,26,14,.25)',
    overflow: 'hidden',
  },
  hdr: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '16px 20px 14px',
    borderBottom: '1px solid #EDE7DE',
    background: '#FAF7F2',
  },
  hdrLeft: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  hdrIcon: { fontSize: '1.5rem', marginTop: 2 },
  hdrTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.1rem', fontWeight: 700, color: '#2A1A0E',
  },
  hdrSub: {
    fontSize: '.78rem', color: '#9C8878', marginTop: 2,
    fontFamily: "'Lora', serif", fontStyle: 'italic',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    background: 'transparent', border: '1.5px solid #EDE7DE',
    color: '#9C8878', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  bodyImport: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '40px 28px',
    gap: 14,
  },
  pickBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #8B6445, #C4956A)',
    color: '#fff',
    border: 'none', borderRadius: 12,
    fontSize: '.95rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
  },
  hint: {
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.82rem', color: '#9C8878',
    margin: 0,
  },

  bodyListen: {
    display: 'flex', flexDirection: 'column',
    padding: '16px 20px 18px',
    gap: 12,
    overflowY: 'auto',
  },
  imgWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#FAF7F2',
    borderRadius: 14,
    padding: 8,
    border: '1px solid #EDE7DE',
  },
  img: {
    display: 'block',
    maxWidth: '100%',
    maxHeight: '55vh',
    borderRadius: 8,
    objectFit: 'contain',
  },
  textarea: {
    width: '100%',
    padding: '10px 13px',
    border: '1.5px solid #EDE7DE',
    borderRadius: 12,
    fontFamily: "'Lora', serif",
    fontSize: '.9rem', lineHeight: 1.6,
    background: '#FAF7F2', color: '#2A1A0E',
    outline: 'none', resize: 'vertical',
    caretColor: '#8B6445',
    boxSizing: 'border-box',
    minHeight: 76,
  },
  errorInline: {
    margin: 0,
    padding: '8px 12px',
    background: '#FEF0F0',
    border: '1px solid #E8A0A0',
    borderRadius: 10,
    color: '#8B2020',
    fontSize: '.8rem',
    fontFamily: "'Nunito', sans-serif",
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    marginTop: 4,
  },
  skipBtn: {
    padding: '9px 18px',
    background: '#FAF7F2',
    color: '#8B6445',
    border: '1.5px solid #EDE7DE',
    borderRadius: 10,
    fontSize: '.85rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
  },
  nextBtn: {
    padding: '9px 20px',
    background: 'linear-gradient(135deg, #8B6445, #C4956A)',
    color: '#fff',
    border: 'none', borderRadius: 10,
    fontSize: '.85rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
  },
}
