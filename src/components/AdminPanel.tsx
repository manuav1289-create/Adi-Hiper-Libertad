// src/components/AdminPanel.tsx
// @ts-nocheck
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

type Puesto = { id: number; name: string };

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [puestoId, setPuestoId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("puestos").select("id,name").order("name");
      if (!error) setPuestos(data || []);
    })();
  }, []);

  const validateRange = () => {
    if (!fromDate || !toDate) { alert("Elegí un rango de fechas (Desde y Hasta)."); return false; }
    if (fromDate > toDate) { alert("La fecha Desde no puede ser mayor que Hasta."); return false; }
    return true;
  };

  const deleteAll = async () => {
    if (!validateRange()) return;
    if (!confirm(`⚠️ Vas a borrar TODAS las reservas del ${fromDate} al ${toDate}. ¿Continuar?`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_delete_reservations_all", {
      from_date: fromDate,
      to_date: toDate,
    });
    setBusy(false);
    if (error) return alert(error.message);
    alert(`✅ Borradas ${data ?? 0} reservas en total.`);
  };

  const deleteByPuesto = async () => {
    if (!validateRange()) return;
    if (!puestoId) { alert("Elegí un puesto."); return; }
    const name = puestos.find(p => p.id === puestoId)?.name || `#${puestoId}`;
    if (!confirm(`⚠️ Vas a borrar reservas del puesto "${name}" entre ${fromDate} y ${toDate}. ¿Continuar?`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_delete_reservations_by_puesto", {
      p_puesto_id: puestoId,
      from_date: fromDate,
      to_date: toDate,
    });
    setBusy(false);
    if (error) return alert(error.message);
    alert(`✅ Borradas ${data ?? 0} reservas del puesto "${name}".`);
  };

  return (
    <div style={{maxWidth:900, margin:"24px auto", padding:16}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
        <h2 style={{margin:0, color:"#000"}}>Panel de Administración</h2>
        <button onClick={onClose} style={{border:"1px solid #ddd", borderRadius:12, padding:"6px 12px"}}>Cerrar</button>
      </div>

      <div style={{border:"1px solid #e5e7eb", borderRadius:16, padding:16, background:"#fff", color:"#000"}}>
        <h3 style={{marginTop:0}}>Borrar reservas</h3>
        <p style={{marginTop:0, opacity:.8}}>Elegí un rango de fechas. Podés borrar TODO o sólo por un puesto.</p>

        <div style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}>
          <div>
            <label style={{fontSize:12, opacity:.7}}>Desde</label><br/>
            <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
                   style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}} />
          </div>
          <div>
            <label style={{fontSize:12, opacity:.7}}>Hasta</label><br/>
            <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
                   style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}} />
          </div>
          <div>
            <label style={{fontSize:12, opacity:.7}}>Puesto (para borrar por puesto)</label><br/>
            <select value={puestoId ?? ""} onChange={e=>setPuestoId(e.target.value ? Number(e.target.value) : null)}
                    style={{width:"100%", padding:"8px 10px", border:"1px solid #ddd", borderRadius:12}}>
              <option value="">— Elegí un puesto —</option>
              {puestos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{display:"flex", gap:8, flexWrap:"wrap", marginTop:16}}>
          <button
            onClick={deleteAll}
            disabled={busy}
            style={{border:"1px solid #ddd", borderRadius:16, padding:"8px 14px", background:"#111", color:"#fff"}}
          >
            {busy ? "Borrando…" : "Vaciar TODO (rango)"}
          </button>

          <button
            onClick={deleteByPuesto}
            disabled={busy}
            style={{border:"1px solid #ddd", borderRadius:16, padding:"8px 14px", background:"#111", color:"#fff"}}
          >
            {busy ? "Borrando…" : "Borrar por puesto (rango)"}
          </button>
        </div>
      </div>
    </div>
  );
}