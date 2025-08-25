// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Puesto = { id: number; name: string };
type TimeSlot = { id: number; puesto_id: number; label: string; start_time: string; end_time: string; duration_hours: number; enabled?: boolean };
type Profile = {
  id: string;
  full_name: string | null;
  hierarchy: string | null;
  is_admin: boolean;
  restricted: boolean;
  allowed_puestos: number[] | null;
  allowed_time_slots: number[] | null;
  daily_max_slots: number;
  daily_max_hours: number;
  monthly_max_hours: number;
};

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"usuarios"|"disponibilidad"|"bloqueos"|"borrado">("usuarios");

  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filter, setFilter] = useState("");

  // selección de usuario
  const [selUser, setSelUser] = useState<Profile | null>(null);
  const [u_is_admin, setUIsAdmin] = useState(false);
  const [u_restricted, setURestricted] = useState(false);
  const [u_allowed_puestos, setUAllowedPuestos] = useState<number[]>([]);
  const [u_daily_slots, setUDailySlots] = useState(2);
  const [u_daily_hours, setUDailyHours] = useState(8);
  const [u_monthly_hours, setUMonthlyHours] = useState(160);

  // disponibilidad
  const [selPuesto, setSelPuesto] = useState<number | null>(null);
  const puestoSlots = useMemo(()=> slots.filter(s=>s.puesto_id===selPuesto), [slots, selPuesto]);

  // bloqueos por fecha
  const [blkFrom, setBlkFrom] = useState<string>("");
  const [blkTo, setBlkTo] = useState<string>("");
  const [blkPuestoId, setBlkPuestoId] = useState<number | "">("");
  const [blkSlotId, setBlkSlotId] = useState<number | "">("");

  // borrado (si tenés tus RPC de borrado)
  const [delFrom, setDelFrom] = useState<string>("");
  const [delTo, setDelTo] = useState<string>("");
  const [delPuestoId, setDelPuestoId] = useState<number | "">("");

  useEffect(()=>{ (async()=>{
    const [pRes, sRes, profRes] = await Promise.all([
      supabase.from("puestos").select("id,name").order("name"),
      supabase.from("time_slots").select("id,puesto_id,label,start_time,end_time,duration_hours,enabled").order("puesto_id,start_time"),
      supabase.from("profiles").select("id,full_name,hierarchy,is_admin,restricted,allowed_puestos,allowed_time_slots,daily_max_slots,daily_max_hours,monthly_max_hours").order("full_name"),
    ]);
    setPuestos(pRes.data||[]);
    setSlots(sRes.data||[]);
    setProfiles(profRes.data||[]);
    if (!selPuesto && (pRes.data||[]).length) setSelPuesto(pRes.data![0].id);
  })(); },[]);

  const filteredProfiles = useMemo(()=>{
    const q = filter.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p =>
      (p.full_name||"").toLowerCase().includes(q) ||
      (p.hierarchy||"").toLowerCase().includes(q) ||
      (p.id||"").toLowerCase().includes(q)
    );
  }, [profiles, filter]);

  const pickUser = (p: Profile) => {
    setSelUser(p);
    setUIsAdmin(!!p.is_admin);
    setURestricted(!!p.restricted);
    setUAllowedPuestos(p.allowed_puestos||[]);
    setUDailySlots(p.daily_max_slots||2);
    setUDailyHours(p.daily_max_hours||8);
    setUMonthlyHours(p.monthly_max_hours||160);
  };

  const saveUserPerms = async () => {
    if (!selUser) return;
    const { error } = await supabase.rpc("admin_update_user_permissions", {
      p_user_id: selUser.id,
      p_is_admin: u_is_admin,
      p_restricted: u_restricted,
      p_allowed_puestos: u_allowed_puestos.length ? u_allowed_puestos : null,
      p_allowed_time_slots: null, // si querés también por slot, armamos UI similar
      p_daily_max_slots: u_daily_slots,
      p_daily_max_hours: u_daily_hours,
      p_monthly_max_hours: u_monthly_hours,
    });
    if (error) return alert(error.message);
    alert("✅ Permisos/cuotas guardados");

    // refrescar perfiles
    const { data: profRes } = await supabase
      .from("profiles")
      .select("id,full_name,hierarchy,is_admin,restricted,allowed_puestos,allowed_time_slots,daily_max_slots,daily_max_hours,monthly_max_hours")
      .order("full_name");
    setProfiles(profRes||[]);
  };

  const toggleSlotEnabled = async (slot: TimeSlot, enabled: boolean) => {
    const { error } = await supabase.rpc("admin_set_slot_enabled", {
      p_time_slot_id: slot.id,
      p_enabled: enabled,
    });
    if (error) return alert(error.message);
    setSlots(prev => prev.map(s => s.id===slot.id ? { ...s, enabled } : s));
  };

  const setAllSlots = async (puestoId: number, enabled: boolean) => {
    const { error } = await supabase.rpc("admin_set_all_slots_enabled", {
      p_puesto_id: puestoId,
      p_enabled: enabled,
    });
    if (error) return alert(error.message);
    setSlots(prev => prev.map(s => s.puesto_id===puestoId ? { ...s, enabled } : s));
  };

  const addBlackout = async () => {
    if (!blkFrom || !blkTo) return alert("Elegí 'Desde' y 'Hasta'");
    const { error } = await supabase.rpc("admin_add_blackout", {
      p_from: blkFrom, p_to: blkTo,
      p_puesto_id: blkPuestoId===""? null : Number(blkPuestoId),
      p_time_slot_id: blkSlotId===""? null : Number(blkSlotId),
    });
    if (error) return alert(error.message);
    alert("✅ Bloqueos creados");
  };
  const removeBlackout = async () => {
    if (!blkFrom || !blkTo) return alert("Elegí 'Desde' y 'Hasta'");
    const { error } = await supabase.rpc("admin_remove_blackout", {
      p_from: blkFrom, p_to: blkTo,
      p_puesto_id: blkPuestoId===""? null : Number(blkPuestoId),
      p_time_slot_id: blkSlotId===""? null : Number(blkSlotId),
    });
    if (error) return alert(error.message);
    alert("✅ Bloqueos removidos");
  };

  // (Opcional) Borrado si ya tenés tus funciones de delete
  const deleteAllRange = async () => {
    if (!delFrom || !delTo) return alert("Elegí rango");
    if (!confirm("¿Borrar TODAS las reservas del rango?")) return;
    const { error } = await supabase.rpc("admin_delete_reservations_all", { from_date: delFrom, to_date: delTo });
    if (error) return alert(error.message);
    alert("✅ Reservas borradas");
  };
  const deleteByPuesto = async () => {
    if (!delPuestoId || !delFrom || !delTo) return alert("Elegí puesto y rango");
    if (!confirm("¿Borrar reservas del puesto y rango?")) return;
    const { error } = await supabase.rpc("admin_delete_reservations_by_puesto", { p_puesto_id: delPuestoId, from_date: delFrom, to_date: delTo });
    if (error) return alert(error.message);
    alert("✅ Reservas borradas para ese puesto");
  };

  return (
    <div style={{maxWidth:1100, margin:"20px auto", padding:16}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <h2 style={{margin:0}}>Panel de administración</h2>
        <button onClick={onClose} style={{border:"1px solid #ddd",borderRadius:12,padding:"8px 12px"}}>Volver</button>
      </div>

      {/* Tabs */}
      <div style={{display:"flex", gap:8, marginTop:12, flexWrap:"wrap"}}>
        <button onClick={()=>setTab("usuarios")}        style={{padding:"8px 12px", border:"1px solid #ddd", borderRadius:12, background: tab==="usuarios"?"#111":"#fff", color:tab==="usuarios"?"#fff":"#000"}}>Usuarios</button>
        <button onClick={()=>setTab("disponibilidad")}  style={{padding:"8px 12px", border:"1px solid #ddd", borderRadius:12, background: tab==="disponibilidad"?"#111":"#fff", color:tab==="disponibilidad"?"#fff":"#000"}}>Disponibilidad por puesto</button>
        <button onClick={()=>setTab("bloqueos")}        style={{padding:"8px 12px", border:"1px solid #ddd", borderRadius:12, background: tab==="bloqueos"?"#111":"#fff", color:tab==="bloqueos"?"#fff":"#000"}}>Bloqueos por fecha</button>
        <button onClick={()=>setTab("borrado")}         style={{padding:"8px 12px", border:"1px solid #ddd", borderRadius:12, background: tab==="borrado"?"#111":"#fff", color:tab==="borrado"?"#fff":"#000"}}>Borrar reservas</button>
      </div>

      {/* Usuarios */}
      {tab==="usuarios" && (
        <div style={{marginTop:16, display:"grid", gridTemplateColumns:"320px 1fr", gap:16}}>
          <div style={{border:"1px solid #eee", borderRadius:12, padding:12}}>
            <div style={{fontSize:12, opacity:.7, marginBottom:6}}>Buscar</div>
            <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Nombre, jerarquía o ID"
                   style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:10}} />
            <div style={{marginTop:10, maxHeight:420, overflow:"auto"}}>
              {(filteredProfiles||[]).map(p=>(
                <div key={p.id}
                     onClick={()=>pickUser(p)}
                     style={{padding:"6px 8px", borderRadius:8, cursor:"pointer", background: selUser?.id===p.id?"#f0f0f0":"transparent"}}>
                  <div style={{fontWeight:600}}>{p.full_name || "(Sin nombre)"}</div>
                  <div style={{fontSize:12, opacity:.7}}>{p.hierarchy || "Sin jerarquía"} {p.is_admin && "· Admin"}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{border:"1px solid #eee", borderRadius:12, padding:12}}>
            {!selUser ? <div>Elegí un usuario de la lista</div> : (
              <div style={{display:"grid", gap:12}}>
                <div>
                  <div style={{fontSize:12, opacity:.7}}>Usuario</div>
                  <div style={{fontWeight:700}}>{selUser.full_name || "(Sin nombre)"} <span style={{opacity:.6, fontWeight:400}}>— ID: {selUser.id}</span></div>
                  <div style={{fontSize:12, opacity:.7}}>Jerarquía: {selUser.hierarchy || "(sin datos)"}</div>
                </div>
                <label style={{display:"flex", alignItems:"center", gap:8}}>
                  <input type="checkbox" checked={u_is_admin} onChange={e=>setUIsAdmin(e.target.checked)} /> Admin
                </label>
                <label style={{display:"flex", alignItems:"center", gap:8}}>
                  <input type="checkbox" checked={u_restricted} onChange={e=>setURestricted(e.target.checked)} /> Restringir puestos visibles
                </label>

                <div>
                  <div style={{fontSize:12, opacity:.7, marginBottom:6}}>Puestos permitidos (si el usuario está restringido)</div>
                  <div style={{display:"flex", gap:12, flexWrap:"wrap"}}>
                    {puestos.map(p=>(
                      <label key={p.id} style={{display:"inline-flex", alignItems:"center", gap:6}}>
                        <input
                          type="checkbox"
                          checked={u_allowed_puestos.includes(p.id)}
                          onChange={(e)=>{
                            setUAllowedPuestos(prev => e.target.checked
                              ? [...prev, p.id]
                              : prev.filter(x=>x!==p.id)
                            );
                          }}
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12}}>
                  <div>
                    <div style={{fontSize:12, opacity:.7}}>Máx. turnos por día</div>
                    <input type="number" min={0} value={u_daily_slots} onChange={e=>setUDailySlots(Number(e.target.value))}
                           style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:10}} />
                  </div>
                  <div>
                    <div style={{fontSize:12, opacity:.7}}>Máx. horas por día</div>
                    <input type="number" min={0} value={u_daily_hours} onChange={e=>setUDailyHours(Number(e.target.value))}
                           style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:10}} />
                  </div>
                  <div>
                    <div style={{fontSize:12, opacity:.7}}>Máx. horas por mes</div>
                    <input type="number" min={0} value={u_monthly_hours} onChange={e=>setUMonthlyHours(Number(e.target.value))}
                           style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:10}} />
                  </div>
                </div>

                <div>
                  <button onClick={saveUserPerms} style={{border:"1px solid #ddd", borderRadius:12, padding:"8px 12px", background:"#111", color:"#fff"}}>
                    Guardar cambios
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disponibilidad */}
      {tab==="disponibilidad" && (
        <div style={{marginTop:16}}>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={{fontSize:12, opacity:.7}}>Puesto</div>
            <select value={selPuesto??""} onChange={e=>setSelPuesto(Number(e.target.value))}
                    style={{padding:"6px 10px", border:"1px solid #ddd", borderRadius:10}}>
              {puestos.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {selPuesto && (
              <>
                <button onClick={()=>setAllSlots(selPuesto, true)}  style={{border:"1px solid #ddd", borderRadius:10, padding:"6px 10px"}}>Habilitar todos</button>
                <button onClick={()=>setAllSlots(selPuesto, false)} style={{border:"1px solid #ddd", borderRadius:10, padding:"6px 10px"}}>Deshabilitar todos</button>
              </>
            )}
          </div>
          <div style={{marginTop:12, border:"1px solid #eee", borderRadius:12, padding:12}}>
            {!selPuesto ? <div>Elegí un puesto</div> : (
              <div style={{display:"grid", gap:10}}>
                {puestoSlots.map(s=>(
                  <label key={s.id} style={{display:"flex", alignItems:"center", gap:10}}>
                    <input type="checkbox" checked={s.enabled!==false} onChange={e=>toggleSlotEnabled(s, e.target.checked)} />
                    <div style={{minWidth:140, fontWeight:600}}>{s.label}</div>
                    <div style={{opacity:.7, fontSize:12}}>{s.start_time}–{s.end_time} · {s.duration_hours}h</div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bloqueos */}
      {tab==="bloqueos" && (
        <div style={{marginTop:16, display:"grid", gap:12}}>
          <div style={{display:"flex", gap:10, flexWrap:"wrap", alignItems:"center"}}>
            <div>
              <div style={{fontSize:12, opacity:.7}}>Desde</div>
              <input type="date" value={blkFrom} onChange={e=>setBlkFrom(e.target.value)} />
            </div>
            <div>
              <div style={{fontSize:12, opacity:.7}}>Hasta</div>
              <input type="date" value={blkTo} onChange={e=>setBlkTo(e.target.value)} />
            </div>
            <div>
              <div style={{fontSize:12, opacity:.7}}>Puesto (opcional)</div>
              <select value={blkPuestoId} onChange={e=>setBlkPuestoId(e.target.value===""? "": Number(e.target.value))}>
                <option value="">— Todos —</option>
                {puestos.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:12, opacity:.7}}>Turno (opcional)</div>
              <select value={blkSlotId} onChange={e=>setBlkSlotId(e.target.value===""? "": Number(e.target.value))}>
                <option value="">— Todos —</option>
                {slots.filter(s => !blkPuestoId || s.puesto_id === blkPuestoId).map(s=>(
                  <option key={s.id} value={s.id}>{s.label} ({s.start_time}-{s.end_time})</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{display:"flex", gap:10}}>
            <button onClick={addBlackout} style={{border:"1px solid #ddd", borderRadius:10, padding:"8px 12px"}}>Bloquear</button>
            <button onClick={removeBlackout} style={{border:"1px solid #ddd", borderRadius:10, padding:"8px 12px"}}>Desbloquear</button>
          </div>
        </div>
      )}

      {/* Borrado */}
      {tab==="borrado" && (
        <div style={{marginTop:16, display:"grid", gap:12}}>
          <div style={{display:"flex", gap:10, flexWrap:"wrap", alignItems:"center"}}>
            <div>
              <div style={{fontSize:12, opacity:.7}}>Desde</div>
              <input type="date" value={delFrom} onChange={e=>setDelFrom(e.target.value)} />
            </div>
            <div>
              <div style={{fontSize:12, opacity:.7}}>Hasta</div>
              <input type="date" value={delTo} onChange={e=>setDelTo(e.target.value)} />
            </div>
            <div>
              <div style={{fontSize:12, opacity:.7}}>Puesto (opcional)</div>
              <select value={delPuestoId} onChange={e=>setDelPuestoId(e.target.value===""? "": Number(e.target.value))}>
                <option value="">— Todos —</option>
                {puestos.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex", gap:10}}>
            <button onClick={deleteAllRange} style={{border:"1px solid #ddd", borderRadius:10, padding:"8px 12px"}}>Borrar TODO el rango</button>
            <button onClick={deleteByPuesto} style={{border:"1px solid #ddd", borderRadius:10, padding:"8px 12px"}}>Borrar por puesto</button>
          </div>
          <div style={{fontSize:12, opacity:.6}}>Nota: estas acciones usan tus funciones RPC de borrado. Si no existen, te paso el SQL luego.</div>
        </div>
      )}
    </div>
  );
}