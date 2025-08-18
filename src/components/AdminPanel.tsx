import React, { useMemo, useState } from 'react'
import { supabase } from '../supabase'

type Session = import('@supabase/supabase-js').Session

const adminList = (import.meta.env.VITE_ADMIN_EMAILS as string || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)

function pad(n:number){ return n.toString().padStart(2,'0') }

export default function AdminPanel({ session, openYear, openMonth0, onSaved }:{ session: Session|null, openYear:number, openMonth0:number, onSaved:(y:number,m0:number)=>void }){
  if (!session) return null
  const isAllowed = adminList.length === 0 || adminList.includes((session.user.email||'').toLowerCase())
  if (!isAllowed) return null

  const [y, setY] = useState(openYear)
  const [m0, setM0] = useState(openMonth0)
  const [busy, setBusy] = useState(false)
  const [busyClear, setBusyClear] = useState(false)

  async function saveMonth(){
    const { error } = await supabase.from('settings').upsert({ id: true, open_year: y, open_month: m0+1 })
    if (error) return alert(error.message)
    onSaved(y, m0)
    alert('Mes habilitado actualizado')
  }

  async function generate(){
    setBusy(true)
    const { data, error } = await supabase.rpc('generate_month_slots')
    setBusy(false)
    if (error) return alert(error.message)
    alert(`Generados ${data||0} slots para ${pad(m0+1)}/${y}`)
  }

  async function clear(force:boolean){
    setBusyClear(true)
    const { data, error } = await supabase.rpc('clear_shifts_for_open_month', { force })
    setBusyClear(false)
    if (error) return alert(error.message)
    alert(typeof data==='object' ? JSON.stringify(data) : String(data))
  }

  return (
    <div style={{ border:'1px solid #ddd', borderRadius:8, padding:8 }}>
      <strong>Admin · Mes habilitado</strong>
      <div style={{ color:'#666', fontSize:12 }}>Actual: {pad(openMonth0+1)}/{openYear}</div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
        <select value={y} onChange={e=>setY(parseInt(e.target.value))}>
          {[openYear-1, openYear, openYear+1].map(yy => <option key={yy} value={yy}>{yy}</option>)}
        </select>
        <select value={m0} onChange={e=>setM0(parseInt(e.target.value))}>
          {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((mm,i)=> <option key={i} value={i}>{mm}</option>)}
        </select>
        <button onClick={saveMonth}>Guardar mes</button>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
        <button disabled={busy} onClick={generate}>Generar slots del mes</button>
        <button disabled={busyClear} onClick={()=>clear(false)}>Vaciar mes (sin reservas)</button>
        <button disabled={busyClear} onClick={()=>clear(true)}>Vaciar mes FORZADO</button>
      </div>
    </div>
  )
}
