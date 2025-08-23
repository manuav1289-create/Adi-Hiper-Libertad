// @ts-nocheck
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

/** Helpers de fecha */
function startOfMonth(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x; }
function endOfMonth(d: Date)   { const x = new Date(d.getFullYear(), d.getMonth()+1, 0); x.setHours(23,59,59,999); return x; }
function iso(d: Date) { return d.toISOString().slice(0,10); }

/** UI helpers básicos */
const Card = (p:any)=><div style={{border:"1px solid #e5e7eb", borderRadius:16, padding:16, background:"#fff", color:"#000"}}>{p.children}</div>;
const Button = ({ children, ...props }: any) =>
  <button style={{border:"1px solid #000", borderRadius:12, padding:"8px 14px", background:"#fff", color:"#000"}} {...props}>{children}</button>;

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [puestos, setPuestos] = useState<{id:number; name:string}[]>([]);
  const [puestoId, setPuestoId] = useState<number | "">("");
  const [from, setFrom] = useState(iso(startOfMonth(new Date())));
  const [to, setTo] = useState(iso(endOfMonth(new Date())));
  const [working, setWorking] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("puestos").select("id,name").order("name");
      if (!error) setPuestos(data || []);
    })();
  }, []);

  const borrarPorPuesto = async () => {
    if (!puestoId) return alert("Elegí un puesto.");
    if (!from || !to) return alert("Elegí el rango de fechas.");
    if (!window.confirm(`¿Seguro que querés borrar reservas del puesto seleccionado entre ${from} y ${to}?`)) return;

    setWorking(true);
    const { data, error } = await supabase.rpc("admin_delete_reservations_by_puesto", {
      p_id: Number(puestoId),
      from_date: from,
      to_date: to,
    });
    setWorking(false);
    if (error) return alert(error.message);
    alert(`Listo. Se borraron ${data ?? 0} reservas.`);
  };

  const vaciarTodo = async () => {
    if (!from || !to) return alert("Elegí el rango de fechas.");
    if (!window.confirm(`⚠️ Esto borra TODAS las reservas entre ${from} y ${to}. ¿Seguro?`)) return;

    setWorking(true);
    const { data, error } = await supabase.rpc("admin_delete_reservations_all", {
      from_date: from,
      to_date: to,
    });
    setWorking(false);
    if (error) return alert(error.message);
    alert(`Listo. Se borraron ${data ?? 0} reservas en total.`);
  };

  return (
    <div style={{maxWidth:1000, margin:"20px auto", padding:16}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
        <h2 style={{margin:0, color:"#000"}}>Administrador</h2>
        <Button onClick={onClose}>Cerrar</Button>
      </div>

      {/* === Sección: Borrar reservas === */}
      <Card>
        <h3 style={{marginTop:0}}>Borrar reservas</h3>
        <p style={{marginTop:4, opacity:.8}}>Elegí un rango de fechas. Podés borrar por puesto o vaciar todo el rango.</p>

        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12}}>
          <div>
            <label style={{fontSize:12, opacity:.7}}>Desde</label>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)}
                   style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}} />
          </div>

          <div>
            <label style={{fontSize:12, opacity:.7}}>Hasta</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)}
                   style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}} />
          </div>

          <div>
            <label style={{fontSize:12, opacity:.7}}>Puesto (para borrar por puesto)</label>
            <select value={puestoId as any} onChange={e=>setPuestoId(e.target.value ? Number(e.target.value) : "")}
                    style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}}>
              <option value="">-- Elegí un puesto --</option>
              {puestos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{display:"flex", gap:8, flexWrap:"wrap", marginTop:12}}>
          <Button onClick={borrarPorPuesto} disabled={!puestoId || working}>
            {working ? "Borrando..." : "Borrar por puesto"}
          </Button>
          <Button onClick={vaciarTodo} disabled={working}>
            {working ? "Borrando..." : "Vaciar TODO el rango"}
          </Button>
        </div>

        <p style={{marginTop:10, fontSize:12, opacity:.7}}>
          Nota: sólo usuarios con rol <b>Admin</b> pueden ejecutar estas acciones.
        </p>
      </Card>
    </div>
  );
}