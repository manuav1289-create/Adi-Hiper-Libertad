// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

// helpers de fechas
function startOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x; }
function endOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth()+1, 0); x.setHours(23,59,59,999); return x; }
function addMonths(d: Date, m: number) { return new Date(d.getFullYear(), d.getMonth()+m, 1); }
function iso(d: Date) { return d.toISOString().slice(0,10); }

// mini UI
const Card = (p:any)=><div style={{border:"1px solid #e5e7eb",borderRadius:16,padding:16,background:"#fff"}}>{p.children}</div>;
const Button = ({children, ...props}:any)=><button style={{border:"1px solid #ddd",borderRadius:16,padding:"8px 14px",background:"#fff"}} {...props}>{children}</button>;

export default function AdminPanel({ onClose }:{ onClose:()=>void }) {
  const [puestos, setPuestos] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [blackouts, setBlackouts] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(iso(new Date()));
  const [mode, setMode] = useState<"puesto"|"slot">("puesto");
  const [puestoId, setPuestoId] = useState<number | "">("");
  const [slotId, setSlotId] = useState<number | "">("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([
        supabase.from("puestos").select("id,name").order("name"),
        supabase.from("time_slots").select("id,puesto_id,label,start_time,end_time").order("puesto_id,start_time"),
      ]);
      setPuestos(p.data || []); setSlots(s.data || []);
    })();
  }, []);

  const refreshBlackouts = async () => {
    const { data } = await supabase
      .from("blackouts").select("id,date,puesto_id,time_slot_id,reason,created_at")
      .gte("date", iso(monthStart)).lte("date", iso(monthEnd))
      .order("date");
    setBlackouts(data || []);
  };
  useEffect(()=>{ refreshBlackouts(); /* eslint-disable-next-line */}, [monthStart.getTime(), monthEnd.getTime()]);

  const addBlackout = async () => {
    if (!date) return alert("Elegí una fecha");
    if (mode === "puesto" && !puestoId) return alert("Elegí un puesto");
    if (mode === "slot" && !slotId) return alert("Elegí un turno");
    const payload:any = { date, reason: reason || null };
    if (mode === "puesto") payload.puesto_id = Number(puestoId);
    if (mode === "slot") payload.time_slot_id = Number(slotId);
    const { error } = await supabase.from("blackouts").insert(payload);
    if (error) return alert(error.message);
    setReason(""); setSlotId(""); setPuestoId("");
    await refreshBlackouts(); alert("✅ Bloqueo creado");
  };

  const delBlackout = async (id: string) => {
    const { error } = await supabase.from("blackouts").delete().eq("id", id);
    if (error) return alert(error.message);
    await refreshBlackouts();
  };

  const refreshProfiles = async () => {
    const { data } = await supabase.from("profiles")
      .select("id, full_name, hierarchy, is_admin").order("full_name", {ascending:true, nullsFirst:false});
    setProfiles(data || []);
  };
  useEffect(()=>{ refreshProfiles(); },[]);

  const filteredProfiles = useMemo(()=>{
    const k = q.trim().toLowerCase();
    if (!k) return profiles;
    return profiles.filter((p)=> (p.full_name||"").toLowerCase().includes(k));
  }, [q, profiles]);

  const toggleAdmin = async (id:string, v:boolean) => {
    const { error } = await supabase.from("profiles").update({ is_admin: v }).eq("id", id);
    if (error) return alert(error.message);
    await refreshProfiles();
  };

  return (
    <div style={{maxWidth:1100, margin:"20px auto", padding:16}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <h2 style={{margin:0}}>Panel de administración</h2>
        <Button onClick={onClose} style={{background:"#111", color:"#fff"}}>Volver</Button>
      </div>

      {/* Bloqueos */}
      <div style={{display:"grid", gap:12, marginTop:16}}>
        <Card>
          <h3 style={{marginTop:0}}>Crear bloqueo (cierre de turnos)</h3>
          <div style={{display:"grid", gap:8, gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}>
            <div>
              <label>Fecha</label>
              <input type="date" value={date} onChange={(e)=>setDate(e.target.value)}
                     style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}} />
            </div>
            <div>
              <label>Tipo</label>
              <select value={mode} onChange={(e)=>setMode(e.target.value as any)}
                      style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}}>
                <option value="puesto">Puesto completo</option>
                <option value="slot">Turno específico</option>
              </select>
            </div>
            {mode==="puesto" ? (
              <div>
                <label>Puesto</label>
                <select value={puestoId} onChange={(e)=>setPuestoId(Number(e.target.value))}
                        style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}}>
                  <option value="">Elegí…</option>
                  {puestos.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label>Turno</label>
                <select value={slotId} onChange={(e)=>setSlotId(Number(e.target.value))}
                        style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}}>
                  <option value="">Elegí…</option>
                  {slots.map(s=><option key={s.id} value={s.id}>
                    {`${s.label} — ${s.start_time}-${s.end_time} (${ (puestos.find(p=>p.id===s.puesto_id)?.name) || "?" })`}
                  </option>)}
                </select>
              </div>
            )}
            <div>
              <label>Motivo (opcional)</label>
              <input value={reason} onChange={(e)=>setReason(e.target.value)}
                     placeholder="feriado / mantenimiento / evento"
                     style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}} />
            </div>
          </div>
          <div style={{marginTop:12}}>
            <Button onClick={addBlackout} style={{background:"#111", color:"#fff"}}>Guardar bloqueo</Button>
          </div>
        </Card>

        <Card>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <Button onClick={()=>setMonth(addMonths(month,-1))}>◀</Button>
            <div style={{minWidth:160, textAlign:"center", fontWeight:600}}>
              {month.toLocaleDateString("es-AR", { month:"long", year:"numeric" })}
            </div>
            <Button onClick={()=>setMonth(addMonths(month, 1))}>▶</Button>
          </div>
          <div style={{marginTop:12, overflowX:"auto"}}>
            <table className="min-w-full text-sm">
              <thead><tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Ámbito</th><th className="p-2">Motivo</th><th/></tr></thead>
              <tbody>
                {blackouts.map(b=>{
                  const slot = slots.find(s=>s.id===b.time_slot_id);
                  const puesto = puestos.find(p=>p.id===b.puesto_id);
                  return (
                    <tr key={b.id} className="border-t">
                      <td className="p-2">{b.date}</td>
                      <td className="p-2">
                        {slot ? `Turno ${slot.label} (${slot.start_time}-${slot.end_time}) – ${puestos.find(p=>p.id===slot.puesto_id)?.name || ""}`
                              : `Puesto ${puesto?.name}`}
                      </td>
                      <td className="p-2">{b.reason || "—"}</td>
                      <td className="p-2">
                        <Button onClick={()=>delBlackout(b.id)} style={{background:"#111", color:"#fff"}}>Eliminar</Button>
                      </td>
                    </tr>
                  );
                })}
                {!blackouts.length && <tr><td colSpan={4} className="p-2">No hay bloqueos este mes.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 style={{marginTop:0}}>Usuarios (marcar / desmarcar admin)</h3>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar por nombre…"
                 style={{width:"100%", maxWidth:320, padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}} />
          <div style={{marginTop:12, overflowX:"auto"}}>
            <table className="min-w-full text-sm">
              <thead><tr><th className="p-2 text-left">Nombre</th><th className="p-2">Jerarquía</th><th className="p-2">Admin</th></tr></thead>
              <tbody>
                {filteredProfiles.map(p=>(
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{p.full_name || "—"}</td>
                    <td className="p-2" style={{textAlign:"center"}}>{p.hierarchy || "—"}</td>
                    <td className="p-2" style={{textAlign:"center"}}>
                      <input type="checkbox" checked={!!p.is_admin} onChange={(e)=>toggleAdmin(p.id, e.target.checked)} />
                    </td>
                  </tr>
                ))}
                {!filteredProfiles.length && <tr><td colSpan={3} className="p-2">Sin resultados.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}