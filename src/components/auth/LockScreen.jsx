import { useState } from 'react'
import { Feather, ShieldCheck, RotateCcw, Shield, KeyRound } from 'lucide-react'
import { hashPin, verifyPin } from '../../utils/pin'
import { getPinHash, setPinHash } from '../../lib/db'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://latelier-api.atome-tdah-cloud.workers.dev'
const ADMIN_HASH = import.meta.env.VITE_ADMIN_HASH || ''
const NUMPAD     = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']]
const MAX_PIN    = 6

// ── Hachage admin (même logique que pin.js mais salt différent) ──
async function hashAdmin(pwd) {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode('latelier-caroline-admin-v1:' + pwd))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

export default function LockScreen({ mode, onUnlock, onAdminUnlock }) {
  // mode = 'setup' | 'unlock' | 'change'

  const [screen, setScreen]   = useState('main')    // 'main' | 'admin' | 'reset_req' | 'reset_verify'
  const [step,   setStep]     = useState('enter')   // 'enter' | 'confirm'
  const [pin,    setPin]      = useState('')
  const [conf,   setConf]     = useState('')
  const [admin,  setAdmin]    = useState('')
  const [otp,    setOtp]      = useState('')
  const [error,  setError]    = useState('')
  const [info,   setInfo]     = useState('')
  const [shake,  setShake]    = useState(false)
  const [ok,     setOk]       = useState(false)
  const [loading,setLoading]  = useState(false)

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 400) }

  // ── Numpad PIN principal ────────────────────────────────────
  const active    = step === 'confirm' ? conf : pin
  const setActive = step === 'confirm' ? setConf : setPin

  const pressDigit = (d) => {
    if (d === '⌫') { setActive(p => p.slice(0,-1)); setError(''); return }
    if (d === '' || active.length >= MAX_PIN) return
    const next = active + d
    setActive(next); setError('')
    if (next.length === MAX_PIN) setTimeout(() => handlePinSubmit(next), 120)
  }

  const handlePinSubmit = async (val) => {
    const v = val ?? active
    if (v.length < 4) { setError('4 chiffres minimum'); return }

    if (mode === 'unlock') {
      const stored = await getPinHash()
      if (await verifyPin(v, stored)) { setOk(true); setTimeout(onUnlock, 350) }
      else { triggerShake(); setError('Code incorrect'); setPin('') }
      return
    }
    // setup / change
    if (step === 'enter') { setStep('confirm'); return }
    if (v !== pin) { triggerShake(); setError('Les codes ne correspondent pas'); setConf('') }
    else {
      const hash = await hashPin(pin)
      await setPinHash(hash)
      setOk(true); setTimeout(onUnlock, 350)
    }
  }

  // ── Mode admin ──────────────────────────────────────────────
  const handleAdminSubmit = async () => {
    if (!admin.trim()) return
    setLoading(true)
    const h = await hashAdmin(admin)
    if (h === ADMIN_HASH) {
      setOk(true)
      setTimeout(() => onAdminUnlock ? onAdminUnlock() : onUnlock(), 350)
    } else {
      triggerShake(); setError('Mot de passe incorrect'); setAdmin('')
    }
    setLoading(false)
  }

  // ── Reset PIN : demande OTP ──────────────────────────────────
  const handleRequestOtp = async () => {
    setLoading(true); setError(''); setInfo('')
    try {
      const r = await fetch(`${WORKER_URL}/request-otp`, { method:'POST' })
      const d = await r.json()
      if (d.ok) { setInfo('Code envoyé à l\'administrateur ✓'); setScreen('reset_verify') }
      else if (d.error === 'too_many_requests') setError('Attends 2 minutes avant de réessayer')
      else setError('Erreur d\'envoi, réessaie plus tard')
    } catch { setError('Connexion impossible') }
    setLoading(false)
  }

  // ── Reset PIN : vérification OTP ────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.length < 6) { setError('Saisis les 6 chiffres'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`${WORKER_URL}/verify-otp`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ code: otp })
      })
      const d = await r.json()
      if (d.ok) {
        // OTP validé → laisser choisir un nouveau PIN
        await setPinHash(null)
        onUnlock()  // App détectera pin_hash=null → mode setup
      } else {
        triggerShake()
        setError(d.error === 'too_many_attempts'
          ? 'Trop de tentatives — demande un nouveau code'
          : `Code incorrect (${d.attempts_left ?? '?'} essai(s) restant(s))`)
        if (d.error === 'too_many_attempts') setScreen('reset_req')
      }
    } catch { setError('Connexion impossible') }
    setLoading(false)
  }

  // ── Titres selon contexte ────────────────────────────────────
  const titles = {
    main: ok ? 'Accès accordé ✓'
      : mode !== 'unlock'
        ? (step === 'enter' ? 'Choisir un code PIN' : 'Confirmer le code')
        : 'Entrer votre code',
    admin: 'Mode administrateur',
    reset_req: 'Réinitialiser le PIN',
    reset_verify: 'Entrer le code reçu',
  }
  const subs = {
    main: ok ? '' : mode !== 'unlock'
      ? (step === 'enter' ? 'Ce code protège votre atelier' : 'Saisissez à nouveau le même code')
      : 'Votre atelier est verrouillé',
    admin: 'Réservé à l\'administrateur',
    reset_req: 'Un code sera envoyé à l\'administrateur qui vous le communiquera',
    reset_verify: 'Saisissez le code à 6 chiffres reçu par l\'administrateur',
  }

  return (
    <div style={S.bg}>
      <div style={{...S.card, animation: shake ? 'shake .4s ease' : 'none'}}>

        {/* Header */}
        <div style={S.hdr}>
          <div style={S.icon}>
            {screen === 'admin'
              ? <Shield size={28} color="#C4956A" />
              : ok ? <ShieldCheck size={28} color="#C4956A" />
              : <Feather size={28} color="#C4956A" />}
          </div>
          <p style={S.ornament}>✦ · ✦ · ✦</p>
          <h1 style={S.appName}>L'Atelier</h1>
          <p style={S.appSub}>{screen === 'admin' ? 'Administration' : 'Mon Histoire'}</p>
        </div>

        <div style={S.body}>
          <p style={S.title}>{titles[screen]}</p>
          {subs[screen] && <p style={S.sub}>{subs[screen]}</p>}
          {info  && <p style={S.infoTxt}>{info}</p>}
          {error && <p style={S.err}>{error}</p>}

          {/* ── Écran principal (PIN numpad) ── */}
          {screen === 'main' && !ok && (<>
            <div style={S.dots}>
              {Array.from({length: MAX_PIN}).map((_,i) => (
                <div key={i} style={{...S.dot,
                  background: active.length > i ? '#8B6445' : 'transparent',
                  borderColor: '#8B6445',
                  transform: active.length > i ? 'scale(1.15)' : 'scale(1)',
                }}/>
              ))}
            </div>
            <div style={S.pad}>
              {NUMPAD.map((row,r) => (
                <div key={r} style={S.row}>
                  {row.map((d,c) => (
                    <button key={c} style={{...S.key, opacity: d==='' ? 0 : 1, pointerEvents: d==='' ? 'none' : 'auto'}}
                      onClick={() => pressDigit(d)}>{d}</button>
                  ))}
                </div>
              ))}
            </div>
            {mode !== 'unlock' && step === 'confirm' && (
              <button style={S.linkBtn} onClick={() => { setStep('enter'); setConf(''); setError('') }}>
                <RotateCcw size={13}/> Recommencer
              </button>
            )}
            {mode === 'unlock' && (<>
              <div style={{textAlign:'center', marginTop:18}}>
                <button style={S.linkBtn} onClick={() => { setScreen('reset_req'); setError('') }}>
                  <KeyRound size={12}/> Code oublié ?
                </button>
              </div>
              <div style={{textAlign:'center', marginTop:4}}>
                <button style={S.adminLink} onClick={() => { setScreen('admin'); setError('') }}>
                  ···
                </button>
              </div>
            </>)}
          </>)}

          {/* ── Écran admin ── */}
          {screen === 'admin' && !ok && (
            <div style={S.form}>
              <input
                type="password" autoFocus
                style={S.input}
                placeholder="Mot de passe administrateur"
                value={admin}
                onChange={e => { setAdmin(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleAdminSubmit()}
              />
              <button style={{...S.bigBtn, marginTop: 8}} onClick={handleAdminSubmit} disabled={loading || !admin}>
                {loading ? 'Vérification…' : 'Accéder →'}
              </button>
              <button style={S.linkBtn} onClick={() => { setScreen('main'); setAdmin(''); setError('') }}>
                ← Retour
              </button>
            </div>
          )}

          {/* ── Écran reset : demande OTP ── */}
          {screen === 'reset_req' && (
            <div style={S.form}>
              <p style={S.resetNote}>
                📧 Un code à 6 chiffres sera envoyé à l'administrateur.<br/>
                Il vous le communiquera pour réinitialiser votre PIN.
              </p>
              <button style={S.bigBtn} onClick={handleRequestOtp} disabled={loading}>
                {loading ? 'Envoi en cours…' : 'Envoyer le code →'}
              </button>
              <button style={S.linkBtn} onClick={() => { setScreen('main'); setError('') }}>
                ← Retour
              </button>
            </div>
          )}

          {/* ── Écran reset : saisie OTP ── */}
          {screen === 'reset_verify' && (
            <div style={S.form}>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus
                style={{...S.input, letterSpacing: 8, textAlign:'center', fontSize:'1.4rem', fontWeight:800}}
                placeholder="· · · · · ·"
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/,'')); setError('') }}
              />
              <button style={{...S.bigBtn, marginTop: 8}} onClick={handleVerifyOtp} disabled={loading || otp.length < 6}>
                {loading ? 'Vérification…' : 'Valider le code →'}
              </button>
              <button style={S.linkBtn} onClick={() => { setScreen('reset_req'); setOtp(''); setError('') }}>
                ← Renvoyer un code
              </button>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)}
        }
      `}</style>
    </div>
  )
}

const S = {
  bg: { position:'fixed',inset:0,zIndex:9999,background:'linear-gradient(160deg,#2D1B0E 0%,#5C3D1E 40%,#8B6445 100%)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Nunito',sans-serif" },
  card: { background:'#FFFEFB',borderRadius:24,width:'100%',maxWidth:340,overflow:'hidden',boxShadow:'0 24px 60px rgba(0,0,0,.4)' },
  hdr: { background:'linear-gradient(135deg,#2D1B0E,#8B6445)',padding:'32px 28px 22px',textAlign:'center',color:'#fff' },
  icon: { width:56,height:56,borderRadius:'50%',background:'rgba(255,255,255,.12)',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12 },
  ornament: { fontSize:'.7rem',letterSpacing:8,opacity:.5,marginBottom:4 },
  appName: { fontFamily:"'Cormorant Garamond',serif",fontSize:'1.8rem',fontWeight:400,marginBottom:2 },
  appSub:  { fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:'.9rem',opacity:.7 },
  body:  { padding:'24px 28px 28px',textAlign:'center' },
  title: { fontSize:'1rem',fontWeight:800,color:'#2A1A0E',marginBottom:4 },
  sub:   { fontSize:'.78rem',color:'#9C8878',marginBottom:20,lineHeight:1.5 },
  dots:  { display:'flex',gap:10,justifyContent:'center',marginBottom:18 },
  dot:   { width:14,height:14,borderRadius:'50%',border:'2px solid #8B6445',transition:'all .15s ease' },
  err:   { fontSize:'.78rem',color:'#C0392B',marginBottom:8,fontWeight:700 },
  infoTxt: { fontSize:'.78rem',color:'#27AE60',marginBottom:8,fontWeight:700 },
  pad:   { display:'flex',flexDirection:'column',gap:8,marginTop:8 },
  row:   { display:'flex',gap:8,justifyContent:'center' },
  key:   { width:68,height:52,borderRadius:12,background:'#FAF7F2',border:'1.5px solid #DDD5C8',fontSize:'1.3rem',fontWeight:700,color:'#2A1A0E',fontFamily:"'Nunito',sans-serif",cursor:'pointer' },
  footerLinks: { display:'flex',justifyContent:'space-between',marginTop:16 },
  linkBtn: { display:'inline-flex',alignItems:'center',gap:5,padding:'6px 10px',background:'transparent',border:'none',color:'#8B6445',fontSize:'.75rem',fontWeight:700,fontFamily:"'Nunito',sans-serif",cursor:'pointer' },
  adminLink: { padding:'4px 12px',background:'transparent',border:'none',color:'#C8BDB5',fontSize:'.7rem',letterSpacing:4,fontFamily:"'Nunito',sans-serif",cursor:'pointer' },
  form:  { display:'flex',flexDirection:'column',gap:8,marginTop:4 },
  input: { width:'100%',padding:'11px 14px',border:'1.5px solid #DDD5C8',borderRadius:10,fontSize:'.95rem',fontFamily:"'Nunito',sans-serif",background:'#FAF7F2',color:'#2A1A0E',outline:'none',boxSizing:'border-box' },
  bigBtn: { padding:'12px 20px',background:'linear-gradient(135deg,#8B6445,#C4956A)',color:'#fff',border:'none',borderRadius:12,fontSize:'.9rem',fontWeight:700,fontFamily:"'Nunito',sans-serif",cursor:'pointer' },
  resetNote: { fontSize:'.78rem',color:'#9C8878',lineHeight:1.6,background:'#FAF7F2',borderRadius:10,padding:'12px',textAlign:'left' },
}
