// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import AdminPanel from "./components/AdminPanel";

// === FECHAS ===
function startOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x; }
function endOfMonth(d: Date)   { const x = new Date(d.getFullYear(), d.getMonth()+1, 0); x.setHours(23,59,59,999); return x; }
function addMonths(d: Date, m: number) { return new Date(d.getFullYear(), d.getMonth()+m, 1); }
function iso(d: Date) { return d.toISOString().slice(0,10); }

// === UI helpers ===
const Badge = (p:any)=><span style={{padding:"2px 8px",borderRadius:999,background:"#eee",fontSize:12}}>{p.children}</span>;

// 🔧 Botón global: texto negro, fondo blanco SIEMPRE (ignora color/background externos)
const Button = ({ children, style = {}, ...props }: any) => {
  const { color, background, backgroundColor, ...rest } = style || {};
  return (
    <button
      {...props}
      style={{
        border: "1px solid #ddd",
        borderRadius: 16,
        padding: "8px 14px",
        background: "#fff",   // fondo blanco
        color: "#000",        // texto negro
        ...rest,              // respeta width, opacity, etc.
      }}
    >
      {children}
    </button>
  );
};

const Card = (p:any)=><div style={{border:"1px solid #e5e7eb",borderRadius:16,padding:16,background:"#fff"}}>{p.children}</div>;

// === Tipos ===
type Puesto = { id: number; name: string };
type TimeSlot = { id: number; puesto_id: number; label: string; start_time: string; end_time: string; duration_hours: number };
type Profile = { id: string; full_name: string | null; hierarchy: string | null; is_admin: boolean; restricted: boolean; allowed_puestos: number[] | null; allowed_time_slots: number[] | null; };

// === Auth simple ===
function AuthCard({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false);
  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setLoading(false); if (error) alert(error.message); else setSent(true);
  };
  return (
    <Card>
      <h2 style={{fontSize:20, marginBottom:8}}>Ingresá para reservar</h2>
      <p style={{opacity:.8, fontSize:14}}>Recibirás un enlace mágico por correo (sin contraseña).</p>
      <form onSubmit={sendMagicLink} style={{display:"grid", gap:8, marginTop:8}}>
        <input type="email" required placeholder="tu@correo.com" value={email}
               onChange={(e)=>setEmail(e.target.value)}
               style={{padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}}/>
        <Button disabled={loading || !email}>{loading ? "Enviando..." : "Enviar enlace"}</Button>
      </form>
      {sent && <p style={{fontSize:12, marginTop:8}}>Revisá tu bandeja (y spam). Volvé con el enlace.</p>}
    </Card>
  );
}

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [hierarchy, setHierarchy] = useState(profile?.hierarchy || "");
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<{ code: string; enabled: boolean }[]>([]);
  useEffect(()=>{ (async()=>{ const { data } = await supabase.from("hierarchies").select("code,enabled").order("code"); setOptions(data||[]); })(); },[]);
  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { id: user?.id, full_name: fullName, hierarchy: hierarchy || null };
    const { error } = await supabase.from("profiles").upsert(payload);
    setSaving(false); if (error) alert(error.message); else onSaved();
  };
  return (
    <Card>
      <h3 style={{fontSize:18, marginBottom:8}}>Tu perfil</h3>
      <div style={{display:"grid", gap:8, gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}>
        <div>
          <label style={{fontSize:12, opacity:.7}}>Apellido y Nombre</label>
          <input style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}} value={fullName} onChange={(e)=>setFullName(e.target.value)} />
        </div>
        <div>
          <label style={{fontSize:12, opacity:.7}}>Jerarquía</label>
          <select style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}} value={hierarchy} onChange={(e)=>setHierarchy(e.target.value)}>
            <option value="">Seleccioná...</option>
            {options.map((o) => <option key={o.code} value={o.code} disabled={!o.enabled}>{o.code} {!o.enabled ? "(no habilitada)" : ""}</option>)}
          </select>
        </div>
      </div>
      <div style={{marginTop:12, display:"flex", gap:8}}>
        <Button onClick={save} disabled={saving || !fullName || !hierarchy}>{saving ? "Guardando..." : "Guardar"}</Button>
        <Button onClick={async()=> (await supabase.auth.signOut(), window.location.reload())}>Salir</Button>
      </div>
    </Card>
  );
}

function BookingView({ profile, onOpenAdmin }: { profile: Profile; onOpenAdmin: ()=>void }) {
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedPuesto, setSelectedPuesto] = useState(0);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [onlyFree, setOnlyFree] = useState(true);

  // reservas y bloqueos
  const [reservedMap, setReservedMap] = useState<Set<string>>(new Set());
  const [myReservedSet, setMyReservedSet] = useState<Set<string>>(new Set());
  const [myDayData, setMyDayData] = useState<Record<string,{count:number;hours:number}>>({});
  const [blackSlotSet, setBlackSlotSet] = useState<Set<string>>(new Set());        // date|slotId
  const [blackPuestoSet, setBlackPuestoSet] = useState<Set<string>>(new Set());    // date|puestoId

  const monthStart = startOfMonth(month), monthEnd = endOfMonth(month);
  const daysInMonth = useMemo(()=>{ const res:Date[]=[]; const d = new Date(monthStart); while(d<=monthEnd){ res.push(new Date(d)); d.setDate(d.getDate()+1);} return res; },[monthStart,monthEnd]);

  useEffect(()=>{ (async()=>{
    const [pRes,sRes] = await Promise.all([
      supabase.from("puestos").select("id,name").order("name"),
      supabase.from("time_slots").select("id,puesto_id,label,start_time,end_time,duration_hours").order("puesto_id,start_time"),
    ]);
    setPuestos(pRes.data||[]); setSlots(sRes.data||[]);
    if (pRes.data?.length && !selectedPuesto) setSelectedPuesto(pRes.data[0].id);
  })(); },[]);

  const refreshMonthData = async () => {
    // ocupaciones (para todo el mes)
    const { data: resv } = await supabase.rpc("get_reserved", { month_start: iso(monthStart), month_end: iso(monthEnd) });
    const all = new Set<string>(); for (const r of resv||[]) all.add(`${r.date}|${r.time_slot_id}`); setReservedMap(all);

    // mis reservas (para cancelar y sumar horas)
    const { data: myResv } = await supabase.from("reservations")
      .select("date,time_slot_id,time_slots(duration_hours)")
      .gte("date", iso(monthStart)).lte("date", iso(monthEnd));
    const mine = new Set<string>(); const agg:any = {};
    for (const r of myResv||[]) {
      const k = r.date as string; const dur = r.time_slots?.duration_hours || 0;
      agg[k] = agg[k] || {count:0, hours:0}; agg[k].count+=1; agg[k].hours+=dur;
      mine.add(`${r.date}|${r.time_slot_id}`);
    }
    setMyDayData(agg); setMyReservedSet(mine);

    // bloqueos
    const { data: b } = await supabase.from("blackouts").select("date, puesto_id, time_slot_id")
      .gte("date", iso(monthStart)).lte("date", iso(monthEnd));
    const bs = new Set<string>(), bp = new Set<string>();
    for (const x of b||[]) {
      if (x.time_slot_id) bs.add(`${x.date}|${x.time_slot_id}`);
      if (x.puesto_id)    bp.add(`${x.date}|${x.puesto_id}`);
    }
    setBlackSlotSet(bs); setBlackPuestoSet(bp);
  };
  useEffect(()=>{ refreshMonthData(); /* eslint-disable-next-line */}, [monthStart.getTime(), monthEnd.getTime()]);

  const tryReserve = async (dateISO: string, slot: TimeSlot) => {
    const cur = myDayData[dateISO] || { count: 0, hours: 0 };
    if (cur.count >= 2) return alert("Límite diario: máximo 2 turnos.");
    if (cur.hours + slot.duration_hours > 8) return alert("Límite diario: máximo 8 horas.");
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { user_id: user?.id, date: dateISO, time_slot_id: slot.id };
    const { error } = await supabase.from("reservations").insert(payload);
    if (error) return alert(error.message);
    await refreshMonthData(); alert("✅ Reservado");
  };

  const cancelReservation = async (dateISO: string, slot: TimeSlot) => {
    const { data: { user } } = await supabase.auth.getUser();
    let q = supabase.from("reservations").delete().eq("date", dateISO).eq("time_slot_id", slot.id);
    if (!profile.is_admin) q = q.eq("user_id", user?.id);  // usuario normal: solo la suya
    const { error } = await q;
    if (error) return alert(error.message);
    await refreshMonthData(); alert("✅ Turno liberado");
  };

  const exportCSV = async () => {
    const data = await supabase.rpc("export_reservations", { month_start: iso(monthStart), month_end: iso(monthEnd) });
    if ((data as any).error) return alert((data as any).error.message);
    const rows = ((data as any).data || []) as any[];
    const header = ["fecha","puesto","turno","inicio","fin","horas","nombre","jerarquia"];
    const csv = [header.join(","), ...rows.map((r)=>[r.date,r.puesto,r.slot,r.start_time,r.end_time,r.duration,r.full_name,r.hierarchy].join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `reservas-${monthStart.getFullYear()}-${String(monthStart.getMonth()+1).padStart(2,"0")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{maxWidth:1100, margin:"20px auto", padding:16}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12}}>
        <div>
          <h2 style={{margin:0}}>Reservá tus turnos</h2>
          <div style={{fontSize:14, opacity:.8}}>
            {profile?.full_name} — <Badge>{profile?.hierarchy || "Sin jerarquía"}</Badge> {profile.is_admin && <Badge>Admin</Badge>}
          </div>
        </div>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          {profile.is_admin && <Button onClick={onOpenAdmin}>Administrar</Button>}
          <Button onClick={exportCSV}>Exportar Excel (CSV)</Button>
          <Button onClick={async()=> (await supabase.auth.signOut(), window.location.reload())}>Salir</Button>
        </div>
      </div>

      <Card>
        <div style={{display:"flex", gap:12, flexWrap:"wrap", alignItems:"center"}}>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <Button onClick={()=>setMonth(addMonths(month, -1))}>◀</Button>
            <div style={{minWidth:160, textAlign:"center", fontWeight:600}}>
              {month.toLocaleDateString("es-AR", { month:"long", year:"numeric" })}
            </div>
            <Button onClick={()=>setMonth(addMonths(month, 1))}>▶</Button>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <label style={{fontSize:14, opacity:.8}}>Puesto</label>
            <select value={selectedPuesto} onChange={(e)=>setSelectedPuesto(Number(e.target.value))}
                    style={{padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}}>
              {puestos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <label style={{display:"inline-flex", alignItems:"center", gap:6, fontSize:14}}>
            <input type="checkbox" checked={onlyFree} onChange={(e)=>setOnlyFree(e.target.checked)} /> Ver solo disponibles
          </label>
        </div>

        <div style={{marginTop:12, overflowX:"auto"}}>
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2">Día</th>
                {slots.filter(s=>s.puesto_id===selectedPuesto).map(s=>(
                  <th key={s.id} className="p-2 text-left">
                    <div style={{fontWeight:600}}>{s.label}</div>
                    <div style={{fontSize:11, opacity:.7}}>{s.start_time}–{s.end_time} · {s.duration_hours}h</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daysInMonth.map((d) => {
                const dateISO = iso(d);
                const myDay = myDayData[dateISO] || { count: 0, hours: 0 };
                return (
                  <tr key={dateISO} className="border-t">
                    <td className="p-2 whitespace-nowrap">
                      <div style={{fontWeight:600}}>{d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit" })}</div>
                      <div style={{fontSize:11, opacity:.7}}>{myDay.hours}h / {myDay.count} turnos</div>
                    </td>
                    {slots.filter(s=>s.puesto_id===selectedPuesto).map((s) => {
                      // Ocultar SALON 10-14 de lunes a jueves
                      const puestoName = puestos.find(p=>p.id===selectedPuesto)?.name;
                      const dow = d.getDay(); // 0=Dom..6=Sáb
                      if (puestoName==='SALON' && (dow>=1 && dow<=4) && s.label==='10:00-14:00') return <td key={s.id} className="p-2" />;

                      const closed = blackSlotSet.has(`${dateISO}|${s.id}`) || blackPuestoSet.has(`${dateISO}|${s.puesto_id}`);
                      const reserved = reservedMap.has(`${dateISO}|${s.id}`);
                      const mine = myReservedSet.has(`${dateISO}|${s.id}`);
                      const show = onlyFree ? (!reserved && !closed) : true;

                      if (!show) return <td key={s.id} className="p-2" style={{textAlign:"center", opacity:.4}}>—</td>;

                      if (closed) return (
                        <td key={s.id} className="p-2">
                          <Button className="w-full" disabled style={{opacity:.6}}>Cerrado</Button>
                        </td>
                      );

                      if (reserved) {
                        if (mine || profile.is_admin) {
                          return (
                            <td key={s.id} className="p-2">
                              <Button className="w-full" onClick={()=>cancelReservation(dateISO, s)}>
                                {mine ? "Cancelar" : "Liberar"}
                              </Button>
                            </td>
                          );
                        }
                        return (
                          <td key={s.id} className="p-2">
                            <Button className="w-full" disabled>Ocupado</Button>
                          </td>
                        );
                      }

                      return (
                        <td key={s.id} className="p-2">
                          <Button className="w-full" onClick={()=>tryReserve(dateISO, s)}>
                            Reservar
                          </Button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// === Root App ===
export default function App() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [processingFromLink, setProcessingFromLink] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setProfile(null);
    const { data: p } = await supabase
      .from("profiles")
      .select("id, full_name, hierarchy, is_admin, restricted, allowed_puestos, allowed_time_slots")
      .eq("id", user.id).single();
    setProfile((p as any) || { id: user.id, full_name: null, hierarchy: null, is_admin: false, restricted: false, allowed_puestos: null, allowed_time_slots: null });
  };

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        setProcessingFromLink(true);
        const { error } = await supabase.auth.exchangeCodeForSession({ code });
        url.search = ""; window.history.replaceState({}, "", url.toString());
        if (error) console.error("exchangeCodeForSession:", error);
      }
      if (window.location.hash.includes("access_token")) {
        setProcessingFromLink(true);
        const hash = new URLSearchParams(window.location.hash.substring(1));
        const at = hash.get("access_token"); const rt = hash.get("refresh_token");
        if (at && rt) await supabase.auth.setSession({ access_token: at, refresh_token: rt });
        window.history.replaceState({}, "", window.location.pathname + window.location.search);
      }
      await loadProfile(); setProcessingFromLink(false); setSessionChecked(true);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { if (s?.user) loadProfile(); else setProfile(null); });
    return () => subscription.unsubscribe();
  }, []);

  if (!sessionChecked) return <div style={{padding:24}}>Cargando...</div>;
  if (processingFromLink) return <div style={{padding:24}}>Procesando tu acceso…</div>;
  if (!profile) return <div style={{maxWidth:420, margin:"40px auto"}}><AuthCard onSignedIn={loadProfile}/></div>;
  if (!profile.full_name || !profile.hierarchy) return <div style={{maxWidth:700, margin:"30px auto"}}><ProfileForm profile={profile} onSaved={loadProfile}/></div>;
  if (showAdmin && profile.is_admin) return <AdminPanel onClose={()=>setShowAdmin(false)} />;

  return <BookingView profile={profile} onOpenAdmin={()=>setShowAdmin(true)} />;
}
