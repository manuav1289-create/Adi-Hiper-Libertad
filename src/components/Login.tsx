import React, { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [session, setSession] = useState<any>(null)

  useEffect(()=>{
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signUp() {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return alert(error.message)
    if (data.user) {
      await supabase.from('officers').insert({ id: data.user.id, full_name: fullName || email.split('@')[0] })
      alert('Usuario creado, ya podés iniciar sesión.')
    }
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }

  if (session) {
    return (
      <div style={{ marginBottom: 12, display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #ddd', padding:8, borderRadius:8 }}>
        <div>
          <div style={{ fontWeight:600 }}>{session.user.email}</div>
          <small style={{ color:'#666' }}>Autenticado</small>
        </div>
        <button onClick={()=> supabase.auth.signOut()}>Cerrar sesión</button>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 12, border:'1px solid #ddd', padding:8, borderRadius:8 }}>
      <strong>Ingresar</strong>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
        <input placeholder='Email' value={email} onChange={e=>setEmail(e.target.value)} />
        <input placeholder='Contraseña' type='password' value={password} onChange={e=>setPassword(e.target.value)} />
        <button onClick={signIn}>Entrar</button>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
        <input placeholder='Nombre y Apellido (alta)' value={fullName} onChange={e=>setFullName(e.target.value)} />
        <button onClick={signUp}>Crear usuario</button>
      </div>
    </div>
  )
}
