import { useState } from 'react'
import { Shield, UserX, Eye, ArrowRight, BookOpen, RotateCcw } from 'lucide-react'
import { getKV, setKV, resetAllData, setPinHash } from '../../lib/db'

export default function AdminPanel({ onClose, onResetDone }) {

  const [screen,   setScreen]   = useState('home')  // 'home' | 'reset_confirm'
  const [keepData, setKeepData] = useState(true)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  const handleReset = async () => {
    setLoading(true)
    if (keepData) {
      // Garder les chapitres, effacer seulement le profil utilisateur
      await Promise.all([
        setKV('name', ''),
        setKV('password', ''),
        setPinHash(null),
        setKV('streak', 0),
        setKV('sessions', 0),
        setKV('lastSession', ''),
        setKV('moodToday', ''),
        setKV('moodValue', ''),
      ])
    } else {
      // Reset total (supprime tout, y compris chapitres)
      await resetAllData()
    }
    setLoading(false)
    setDone(true)
    setTimeout(() => {
      onResetDone()
    }, 1500)
  }

  return (
    <div style={S.bg}>
      <div style={S.card}>

        {/* Header */}
        <div style={S.hdr}>
          <div style={S.icon}><Shield size={28} color="#C4956A" /></div>
          <p style={S.ornament}>✦ · ✦ · ✦</p>
          <h1 style={S.appName}>Administration</h1>
          <p style={S.appSub}>L'Atelier de Caroline</p>
        </div>

        <div style={S.body}>

          {done && (
            <div style={S.successBox}>
              <p style={S.successTxt}>✅ Profil réinitialisé — l'app va redémarrer</p>
            </div>
          )}

          {!done && screen === 'home' && (<>
            <p style={S.sectionTitle}>Accès administrateur actif</p>

            {/* Accéder à l'app */}
            <button style={S.actionBtn} onClick={onClose}>
              <Eye size={16} color="#8B6445" />
              <div style={S.actionText}>
                <span style={S.actionLabel}>Accéder à l'atelier</span>
                <span style={S.actionSub}>Mode consultation / debug</span>
              </div>
              <ArrowRight size={14} color="#8B6445" />
            </button>

            {/* Reset profil */}
            <button style={{...S.actionBtn, borderColor:'#FECACA', background:'#FFF5F5'}}
              onClick={() => setScreen('reset_confirm')}>
              <UserX size={16} color="#C0392B" />
              <div style={S.actionText}>
                <span style={{...S.actionLabel, color:'#C0392B'}}>Changer de profil utilisateur</span>
                <span style={S.actionSub}>Prépare l'app pour un nouvel utilisateur</span>
              </div>
              <ArrowRight size={14} color="#C0392B" />
            </button>
          </>)}

          {!done && screen === 'reset_confirm' && (<>
            <p style={S.sectionTitle}>Réinitialisation du profil</p>
            <p style={S.resetDesc}>
              Ceci efface le prénom, le mot de passe et le code PIN.<br/>
              Le prochain visiteur devra refaire l'onboarding.
            </p>

            {/* Option chapitres */}
            <div style={S.optionBox} onClick={() => setKeepData(!keepData)}>
              <div style={{...S.checkbox, background: keepData ? '#8B6445' : 'transparent'}}>
                {keepData && <span style={{color:'#fff', fontSize:12}}>✓</span>}
              </div>
              <div>
                <p style={S.optLabel}>Conserver les chapitres</p>
                <p style={S.optSub}>Le travail d'écriture existant sera préservé</p>
              </div>
            </div>
            <div style={S.optionBox} onClick={() => setKeepData(!keepData)}>
              <div style={{...S.checkbox, background: !keepData ? '#C0392B' : 'transparent', borderColor: !keepData ? '#C0392B' : '#DDD5C8'}}>
                {!keepData && <span style={{color:'#fff', fontSize:12}}>✓</span>}
              </div>
              <div>
                <p style={{...S.optLabel, color:'#C0392B'}}>Tout effacer</p>
                <p style={S.optSub}>Supprime aussi les chapitres — irréversible</p>
              </div>
            </div>

            <button style={{...S.bigBtn, background: keepData ? 'linear-gradient(135deg,#8B6445,#C4956A)' : '#C0392B'}}
              onClick={handleReset} disabled={loading}>
              {loading ? 'Réinitialisation…' : keepData ? '🔄 Réinitialiser le profil' : '⚠️ Tout effacer'}
            </button>
            <button style={S.linkBtn} onClick={() => setScreen('home')}>
              <RotateCcw size={12} /> Annuler
            </button>
          </>)}

        </div>
      </div>
    </div>
  )
}

const S = {
  bg: { position:'fixed',inset:0,zIndex:9999,background:'linear-gradient(160deg,#2D1B0E 0%,#5C3D1E 40%,#8B6445 100%)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Nunito',sans-serif" },
  card: { background:'#FFFEFB',borderRadius:24,width:'100%',maxWidth:360,overflow:'hidden',boxShadow:'0 24px 60px rgba(0,0,0,.4)' },
  hdr: { background:'linear-gradient(135deg,#2D1B0E,#8B6445)',padding:'32px 28px 22px',textAlign:'center',color:'#fff' },
  icon: { width:56,height:56,borderRadius:'50%',background:'rgba(255,255,255,.12)',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12 },
  ornament: { fontSize:'.7rem',letterSpacing:8,opacity:.5,marginBottom:4 },
  appName: { fontFamily:"'Cormorant Garamond',serif",fontSize:'1.8rem',fontWeight:400,marginBottom:2 },
  appSub:  { fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:'.9rem',opacity:.7 },
  body: { padding:'24px 24px 28px' },
  sectionTitle: { fontSize:'.75rem',fontWeight:800,color:'#6B5A4E',textTransform:'uppercase',letterSpacing:'1px',marginBottom:14 },
  actionBtn: { display:'flex',alignItems:'center',gap:12,width:'100%',padding:'14px 16px',background:'#FAF7F2',border:'1.5px solid #DDD5C8',borderRadius:12,marginBottom:10,cursor:'pointer',textAlign:'left' },
  actionText: { flex:1,display:'flex',flexDirection:'column',gap:2 },
  actionLabel: { fontSize:'.88rem',fontWeight:700,color:'#2A1A0E' },
  actionSub: { fontSize:'.73rem',color:'#9C8878' },
  resetDesc: { fontSize:'.8rem',color:'#6B5A4E',lineHeight:1.6,marginBottom:14,background:'#FAF7F2',padding:'10px 12px',borderRadius:8 },
  optionBox: { display:'flex',alignItems:'flex-start',gap:10,padding:'10px 12px',borderRadius:10,border:'1.5px solid #DDD5C8',marginBottom:8,cursor:'pointer' },
  checkbox: { width:20,height:20,borderRadius:5,border:'2px solid #DDD5C8',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2,transition:'all .15s' },
  optLabel: { fontSize:'.85rem',fontWeight:700,color:'#2A1A0E',marginBottom:2 },
  optSub: { fontSize:'.73rem',color:'#9C8878' },
  bigBtn: { width:'100%',padding:'12px',color:'#fff',border:'none',borderRadius:12,fontSize:'.9rem',fontWeight:700,fontFamily:"'Nunito',sans-serif",cursor:'pointer',marginTop:4 },
  linkBtn: { display:'flex',alignItems:'center',justifyContent:'center',gap:5,width:'100%',marginTop:8,padding:'6px',background:'transparent',border:'none',color:'#8B6445',fontSize:'.78rem',fontWeight:700,fontFamily:"'Nunito',sans-serif",cursor:'pointer' },
  successBox: { background:'#F0FFF4',border:'1.5px solid #86EFAC',borderRadius:12,padding:'16px',textAlign:'center' },
  successTxt: { fontSize:'.88rem',fontWeight:700,color:'#166534' },
}
