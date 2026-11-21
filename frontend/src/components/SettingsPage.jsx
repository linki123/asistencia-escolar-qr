import { useEffect, useState } from 'react';
import { Clock3, Plus, Save } from 'lucide-react';
import { api } from '../lib/api.js';

const weekdays = [
  [1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [7, 'Dom']
];
const blank = {
  nombre: '', horaEntrada: '08:00', horaSalida: '13:00', toleranciaMinutos: 10,
  registrarEntrada: true, registrarSalida: false, dias: [1, 2, 3, 4, 5]
};

export default function SettingsPage() {
  const [data, setData] = useState({ turnos: [], zonaHoraria: 'America/Lima' });
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const result = await api('/settings');
      setData({
        ...result,
        turnos: result.turnos.map((turn) => ({
          ...turn,
          dias: Array.isArray(turn.dias) ? turn.dias.filter(Boolean).map(Number) : []
        }))
      });
      setError('');
    } catch (requestError) { setError(requestError.message); }
  }
  useEffect(() => { load(); }, []);

  function toggleDay(day) {
    setForm((current) => ({
      ...current,
      dias: current.dias.includes(day) ? current.dias.filter((value) => value !== day) : [...current.dias, day]
    }));
  }

  function startEdit(turn) {
    setEditing(turn.id);
    setForm({
      nombre: turn.nombre,
      horaEntrada: turn.hora_entrada.slice(0, 5),
      horaSalida: turn.hora_salida.slice(0, 5),
      toleranciaMinutos: turn.tolerancia_minutos,
      registrarEntrada: Boolean(turn.registrar_entrada),
      registrarSalida: Boolean(turn.registrar_salida),
      dias: turn.dias
    });
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(editing ? `/settings/shifts/${editing}` : '/settings/shifts', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, toleranciaMinutos: Number(form.toleranciaMinutos) })
      });
      setNotice(editing ? 'Turno actualizado.' : 'Turno creado.');
      setEditing(null);
      setForm(blank);
      await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function changeActive(turn) {
    try {
      await api(`/settings/shifts/${turn.id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: !turn.activo })
      });
      await load();
    } catch (requestError) { setError(requestError.message); }
  }

  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">Preferencias</p><h1>Configuración</h1><p className="muted">Zona horaria fija: {data.zonaHoraria}.</p></div></div>
      {notice && <p className="alert-success">{notice}</p>}{error && <p className="alert-error">{error}</p>}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="panel">
          <h2 className="section-title mb-4">{editing ? 'Editar turno' : 'Agregar turno'}</h2>
          <form onSubmit={submit}>
            <div className="form-grid">
              <label className="form-label">Nombre<input className="input-dark mt-2" onChange={(event) => setForm({ ...form, nombre: event.target.value })} required value={form.nombre} /></label>
              <label className="form-label">Tolerancia (minutos)<input className="input-dark mt-2" max="240" min="0" onChange={(event) => setForm({ ...form, toleranciaMinutos: event.target.value })} required type="number" value={form.toleranciaMinutos} /></label>
              <label className="form-label">Hora de entrada<input className="input-dark mt-2" onChange={(event) => setForm({ ...form, horaEntrada: event.target.value })} required type="time" value={form.horaEntrada} /></label>
              <label className="form-label">Hora de salida<input className="input-dark mt-2" onChange={(event) => setForm({ ...form, horaSalida: event.target.value })} required type="time" value={form.horaSalida} /></label>
            </div>
            <div className="mt-5">
              <p className="form-label">Días de asistencia</p>
              <div className="mt-2 flex flex-wrap gap-2">{weekdays.map(([day, label]) => (
                <button aria-pressed={form.dias.includes(day)} className={`day-chip ${form.dias.includes(day) ? 'day-chip-active' : ''}`} key={day} onClick={() => toggleDay(day)} type="button">{label}</button>
              ))}</div>
            </div>
            <div className="mt-5 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300"><input checked={form.registrarEntrada} onChange={(event) => setForm({ ...form, registrarEntrada: event.target.checked })} type="checkbox" /> Registrar entrada</label>
              <label className="flex items-center gap-2 text-sm text-slate-300"><input checked={form.registrarSalida} onChange={(event) => setForm({ ...form, registrarSalida: event.target.checked })} type="checkbox" /> Registrar salida</label>
            </div>
            <div className="mt-5 flex gap-2"><button className="button-primary" disabled={busy} type="submit"><Save size={16} />{busy ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear turno'}</button>{editing && <button className="button-secondary" onClick={() => { setEditing(null); setForm(blank); }} type="button">Cancelar</button>}</div>
          </form>
        </section>
        <section className="panel">
          <h2 className="section-title">Turnos y horarios</h2>
          <div className="mt-4 space-y-3">{data.turnos.map((turn) => (
            <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4" key={turn.id}>
              <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><Clock3 className="mt-1 text-cyan-300" size={18} /><div><p className="font-medium">{turn.nombre}</p><p className="mt-1 text-sm text-slate-400">{turn.hora_entrada.slice(0, 5)} – {turn.hora_salida.slice(0, 5)} · {turn.tolerancia_minutos} min de tolerancia</p><p className="mt-1 text-xs text-slate-500">Días: {turn.dias.map((day) => weekdays.find(([number]) => number === day)?.[1]).join(', ') || 'ninguno'}</p><p className="mt-1 text-xs text-slate-500">{turn.registrar_entrada ? 'Entrada' : ''}{turn.registrar_entrada && turn.registrar_salida ? ' y ' : ''}{turn.registrar_salida ? 'salida' : ''}</p></div></div><span className={`badge ${turn.activo ? 'badge-puntual' : 'badge-falta'}`}>{turn.activo ? 'Activo' : 'Inactivo'}</span></div>
              <div className="mt-3 flex gap-2"><button className="table-button" onClick={() => startEdit(turn)} type="button">Editar</button><button className="table-button" onClick={() => changeActive(turn)} type="button">{turn.activo ? 'Desactivar' : 'Activar'}</button></div>
            </article>
          ))}
          {!data.turnos.length && <p className="muted">Aún no hay turnos configurados.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
