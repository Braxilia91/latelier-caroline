import { useState, useEffect } from 'react'
import { Feather, ShieldCheck, RotateCcw } from 'lucide-react'
import { hashPin, verifyPin } from '../../utils/pin'
import { getPinHash, setPinHash } from '../../lib/db'

const NUMPAD = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']]
const MAX = 6

export default function LockScreen({ mode, onUnlock }) {
  // mode = 'setup' | 'unlock' | 'change'
  const [step,  setStep]  = useState('enter')  // 'enter' | 'confirm'
  const [pin,   setPin]   = useState('')
  const [conf,  setConf]  = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [ok,    setOk]    = useState(false)

  useEffect(() => { setPin(''); setConf(''); setError('') }, [mode])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  const active = step === 'confirm' ? conf : pin
  const setActive = step === 'confirm' ? setConf : setPin

  const pressDigit = (d) => {
    if (d === '⌫') { setActive(p => p.slice(0,-1)); setError(''); return }
    if (d === '')   return
    if (active.length >= MAX) return
    const next = active + d
    setActive(next)
    setError('')
    if (next.length === MAX) setTimeout(() => handleSubmit(next), 120)
  }

  const handleSubmit = async (val) => {
    const v = val ?? active
    if (v.length < 4) { setError('4 chiffres minimum'); return }

    if (mode === 'unlock') {
      const stored = await getPinHash()
      const valid  = await verifyPin(v, stored)
      if (valid) { setOk(true); setTimeout(onUnlock, 350) }
      else { triggerShake(); setError('Code incorrect'); setPin('') }
      return
    }

    // setup / change
    if (step === 'enter') {
      setStep('confirm')
      return
    }
    // confirm step
    if (v !== pin) {
      triggerShake()
      setError('Les codes ne correspondent pas')
      setConf('')
    } else {
      const hash = await hashPin(pin)
      await setPinHash(hash)
      setOk(true)
      setTimeout(onUnlock, 350)
    }
  }

  const isSetup  = mode !== 'unlock'
  const title    = ok ? 'Accès accordé ✓'
    : isSetup
      ? (step === 'enter' ? 'Choisir un code PIN' : 'Confirmer le code')
      : 'Entrer votre code'
  const subtitle = ok ? ''
    : isSetup
      ? (step === 'enter' ? 'Ce code protégera votre atelier' : 'Saisissez à nouveau le même code')
      : 'Votre atelier est verrouillé'

  return (
    <div style={S.bg}>
      <div style={{...S.card, animation: shake ? 'shake .4s ease' : 'none'}}>

        {/* Header */}
        <div style={S.hdr}>
          <div style={S.icon}>
            {ok
              ? <ShieldCheck size={28} color="#C4956A" />
              : <Feather size={28} color="#C4956A" />}
          </div>
          <p style={S.ornament}>✦ · ✦ · ✦</p>
          <h1 style={S.appName}>L'Atelier</h1>
          <p style={S.appSub}>Mon Histoire</p>
        </div>

        {/* Titre */}
        <div style={S.body}>
          <p style={S.title}>{title}</p>
          {subtitle && <p style={S.sub}>{subtitle}</p>}

          {/* Indicateurs PIN */}
          <div style={S.dots}>
            {Array.from({length: MAX}).map((_,i) => (
              <div key={i} style={{
                ...S.dot,
                background: (ok ? '#27AE60' : active.length > i) ? (ok ? '#27AE60' : '#8B6445') : 'transparent',
                borderColor: ok ? '#27AE60' : '#8B6445',
                transform: active.length > i ? 'scale(1.15)' : 'scale(1)',
              }} />
            ))}
          </div>

          {/* Erreur */}
          {error && <p style={S.err}>{error}</p>}

          {/* Numpad */}
          {!ok && (
            <div style={S.pad}>
              {NUMPAD.map((row, r) => (
                <div key={r} style={S.row}>
                  {row.map((d, c) => (
                    <button
                      key={c}
                      style={{...S.key, opacity: d === '' ? 0 : 1, pointerEvents: d === '' ? 'none' : 'auto'}}
                      onClick={() => pressDigit(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Retour si confirmation */}
          {isSetup && step === 'confirm' && !ok && (
            <button style={S.back} onClick={() => { setStep('enter'); setConf(''); setError('') }}>
              <RotateCcw size={13} /> Recommencer
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-5px)}
          80%{transform:translateX(5px)}
        }
      `}</style>
    </div>
  )
}

const S = {
  bg: {
    position:'fixed',inset:0,zIndex:9999,
    background:'linear-gradient(160deg,#2D1B0E 0%,#5C3D1E 40%,#8B6445 100%)',
    display:'flex',alignItems:'center',justifyContent:'center',
    fontFamily:"'Nunito',sans-serif",
  },
  card: {
    background:'#FFFEFB',borderRadius:24,width:'100%',maxWidth:340,
    overflow:'hidden',boxShadow:'0 24px 60px rgba(0,0,0,.4)',
  },
  hdr: {
    background:'linear-gradient(135deg,#2D1B0E,#8B6445)',
    padding:'32px 28px 22px',textAlign:'center',color:'#fff',
  },
  icon: {
    width:56,height:56,borderRadius:'50%',
    background:'rgba(255,255,255,.12)',
    display:'inline-flex',alignItems:'center',justifyContent:'center',
    marginBottom:12,
  },
  ornament: {fontSize:'.7rem',letterSpacing:8,opacity:.5,marginBottom:4},
  appName: {fontFamily:"'Cormorant Garamond',serif",fontSize:'1.8rem',fontWeight:400,marginBottom:2},
  appSub:  {fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:'.9rem',opacity:.7},
  body:  {padding:'24px 28px 28px',textAlign:'center'},
  title: {fontSize:'1rem',fontWeight:800,color:'#2A1A0E',marginBottom:4},
  sub:   {fontSize:'.78rem',color:'#9C8878',marginBottom:20,lineHeight:1.4},
  dots:  {display:'flex',gap:10,justifyContent:'center',marginBottom:18},
  dot: {
    width:14,height:14,borderRadius:'50%',
    border:'2px solid #8B6445',
    transition:'all .15s ease',
  },
  err: {fontSize:'.78rem',color:'#C0392B',marginBottom:10,fontWeight:700},
  pad: {display:'flex',flexDirection:'column',gap:8,marginTop:8},
  row: {display:'flex',gap:8,justifyContent:'center'},
  key: {
    width:68,height:52,borderRadius:12,
    background:'#FAF7F2',border:'1.5px solid #DDD5C8',
    fontSize:'1.3rem',fontWeight:700,color:'#2A1A0E',
    fontFamily:"'Nunito',sans-serif",cursor:'pointer',
    transition:'background .1s',
  },
  back: {
    display:'inline-flex',alignItems:'center',gap:5,
    marginTop:14,padding:'6px 12px',
    background:'transparent',border:'none',
    color:'#8B6445',fontSize:'.78rem',fontWeight:700,
    fontFamily:"'Nunito',sans-serif",cursor:'pointer',
  },
}
