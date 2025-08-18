import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'

type Session = import('@supabase/supabase-js').Session

function pad(n:number){ return n.toString().padStart(2,'0') }
function dateKey(y:number,m0:number,d:number){ return `${y}-${pad(m0+1)}-${pad(d)}` }
function daysInMonth(year:number,month0:number){ return new Date(year, month0+1, 0).getDate() }

export default function Calendar({ session, year, month0, openYear, openMonth0, areaId }:{ session:Session|null, year:number, month0:number, openYear:number, openMonth0:number, areaId:string }){
  const [shifts, setShifts] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set())
  const days = daysInMonth(year, month0)
  const monthStart = `${year}-${pad(month0+1)}-01`
  const monthEnd = `${year}-${pad(month0+1)}-${pad(days)}`

  useEffect(()=>{
    (async ()=>{
      const { data: sData } = await supabase.from('shifts').select('id,area_id,date,code').eq('area_id', areaId).gte('date', monthStart).lte('date', monthEnd).order('date')
      setShifts(sData||[])

      if (session){
        const { data: bData } = await supabase.from('bookings').select('id,shift_id,officer_id,hours').eq('officer_id', session.user.id)
        setBookings(bData||[])
      } else setBookings([])

      const view = await supabase.from('v_shift_taken').select('shift_id')
      if (!view.error && view.data){ setTakenIds(new Set(view.data.map(r=>r.shift_id))) }
    })()
  }, [areaId, month0, year, session])

  function slotHours(code:string){ return ({'1':4,'2':4,'3':4,'4':4,'12':8,'34':8} as any)[code] || 0 }
  function isOpenMonth(date:string){ const y=parseInt(date.slice(0,4)); const m0=parseInt(date.slice(5,7))-1; return y===openYear && m0===openMonth0 }
  const myHoursByDate = useMemo(()=>{
    const m = new Map<string,number>()
    for (const b of bookings){
      const s = shifts.find(x=>x.id===b.shift_id); if (!s) continue
      m.set(s.date, (m.get(s.date)||0)+b.hours)
    }
    return m
  }, [bookings, shifts])

  async function toggle(shift:any){
    if (!session) return alert('Iniciá sesión')
    const mine = bookings.find(b=>b.shift_id===shift.id)
    if (mine){
      if (!isOpenMonth(shift.date)) return alert('Cambios solo en el mes habilitado')
      const { error } = await supabase.from('bookings').delete().eq('id', mine.id)
      if (error) return alert(error.message)
      setBookings(prev=>prev.filter(b=>b.id!==mine.id))
      const next = new Set(takenIds); next.delete(shift.id); setTakenIds(next)
      return
    } else {
      if (!isOpenMonth(shift.date)) return alert('Reservas solo para el mes habilitado')
      if (takenIds.has(shift.id)) return alert('Slot ocupado')
      const add = slotHours(shift.code); const cur = myHoursByDate.get(shift.date)||0
      if (add===8 && cur>0) return alert('Máximo 8h/día (1×8h o 2×4h)')
      if (add===4 && cur+4>8) return alert('Máximo 8h/día')
      const { error } = await supabase.from('bookings').insert({ shift_id: shift.id, officer_id: session.user.id, hours: add })
      if (error) return alert(error.message)
      setBookings(prev=>[...prev, { id: crypto.randomUUID(), shift_id: shift.id, officer_id: session.user.id, hours: add }])
      const next = new Set(takenIds); next.add(shift.id); setTakenIds(next)
    }
  }

  function Day({ d }:{ d:number }){
    const date = dateKey(year, month0, d)
    const list = shifts.filter(s=>s.date===date).sort((a,b)=> a.code.localeCompare(b.code))
    return (
      <div style={{ border:'1px solid #eee', padding:8, borderRadius:8, minHeight:58 }}>
        <div style={{ fontWeight:600, marginBottom:6 }}>{d}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
          {list.length===0 && <div style={{ gridColumn:'span 3', color:'#888' }}>Sin slots</div>}
          {list.map(s=>{
            const mine = bookings.some(b=>b.shift_id===s.id)
            const taken = takenIds.has(s.id) && !mine
            const disabled = !session || !isOpenMonth(s.date) || taken
            return (
              <button key={s.id} onClick={()=>toggle(s)} disabled={disabled} title={`${s.code} – ${s.date}`}
                style={{ padding:'6px 8px', border:'1px solid #ddd', borderRadius:8, background: mine ? '#e6ffed' : (taken ? '#f6f7f8' : '#fff'), cursor: disabled ? 'not-allowed':'pointer' }}>
                {s.code} {mine ? '· mío' : taken ? '· ocupado' : ''}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:8 }}>
      {Array.from({ length: days }, (_,i)=> i+1).map(d=> <Day d={d} key={d} />)}
    </div>
  )
}
