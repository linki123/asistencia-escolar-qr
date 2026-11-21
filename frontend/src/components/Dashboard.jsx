import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock3, Users } from 'lucide-react';
import { api } from '../lib/api.js';

const cards = [
  { key: 'estudiantes', label: 'Estudiantes activos', icon: Users, color: 'text-cyan-300' },
  { key: 'puntuales', label: 'Puntuales hoy', icon: Check, color: 'text-emerald-300' },
  { key: 'tardanzas', label: 'Tardanzas hoy', icon: Clock3, color: 'text-amber-300' },
  { key: 'faltas', label: 'Faltas hoy', icon: AlertTriangle, color: 'text-rose-300' }
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await api('/dashboard'));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Resumen diario</p>
          <h1>Dashboard</h1>
          <p className="muted">{data ? new Date(`${data.fecha}T12:00:00-05:00`).toLocaleDateString('es-PE', { dateStyle: 'full' }) : 'Cargando fecha...'}</p>
        </div>
        <button className="button-secondary" disabled={loading} onClick={load} type="button">Actualizar</button>
      </div>
      {error && <p className="alert-error">{error}</p>}
      <div className="stats-grid">
        {cards.map(({ key, label, icon: Icon, color }) => (
          <article className="panel stat-card" key={key}>
            <div className="flex items-center justify-between">
              <span className="muted">{label}</span>
              <Icon className={color} size={20} />
            </div>
            <p className="stat-number">{loading ? '—' : data?.[key] ?? 0}</p>
          </article>
        ))}
      </div>
      <section className="panel mt-6">
        <h2 className="section-title">Últimos registros</h2>
        {loading ? <p className="muted mt-4">Cargando registros...</p> : (
          <div className="table-scroll mt-4">
            <table className="data-table">
              <thead><tr><th>Hora</th><th>Estudiante</th><th>Grado / sección</th><th>Estado</th></tr></thead>
              <tbody>
                {data?.ultimos?.map((row, index) => (
                  <tr key={`${row.codigo}-${row.fecha}-${row.hora}-${index}`}>
                    <td>{row.hora}</td>
                    <td><span className="font-medium text-white">{row.apellidos}, {row.nombres}</span><span className="block text-xs text-slate-500">{row.codigo}</span></td>
                    <td>{row.grado} · {row.seccion}</td>
                    <td><span className={`badge badge-${row.estado.toLowerCase()}`}>{row.estado}</span></td>
                  </tr>
                ))}
                {!data?.ultimos?.length && <tr><td className="py-8 text-center text-slate-500" colSpan="4">Aún no hay registros de asistencia.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
