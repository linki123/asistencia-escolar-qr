import { useEffect, useState } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { exportPdf, exportXlsx } from '../lib/export.js';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
const states = ['PUNTUAL', 'TARDANZA', 'FALTA', 'JUSTIFICADO'];

export default function AttendancePage({ user }) {
  const [rows, setRows] = useState([]);
  const [grades, setGrades] = useState([]);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    try {
      const params = new URLSearchParams({ desde: from, hasta: to });
      if (search.trim()) params.set('buscar', search.trim());
      if (state) params.set('estado', state);
      if (grade) params.set('grado', grade);
      if (section) params.set('seccion', section);
      const [attendance, filters] = await Promise.all([api(`/attendance?${params}`), api('/attendance/filters')]);
      setRows(attendance);
      const optionMap = new Map();
      filters.forEach((item) => {
        if (!optionMap.has(item.id)) optionMap.set(item.id, { id: item.id, nombre: item.grado, secciones: [] });
        if (item.seccion_id) optionMap.get(item.id).secciones.push({ id: item.seccion_id, nombre: item.seccion });
      });
      setGrades([...optionMap.values()]);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { load(); }, [from, to, search, state, grade, section]);
  const sections = grades.find((item) => String(item.id) === grade)?.secciones || [];

  async function updateState(row, nextState) {
    const observacion = nextState === 'JUSTIFICADO'
      ? window.prompt('Motivo de la justificación:')?.trim()
      : '';
    if (nextState === 'JUSTIFICADO' && !observacion) return;
    try {
      await api(`/attendance/${row.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nextState, observacion })
      });
      setNotice(`Registro de ${row.apellidos}, ${row.nombres} actualizado.`);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function exportRows() {
    return rows.map((row) => ({
      Fecha: row.fecha,
      Hora: row.hora,
      Código: row.codigo,
      Estudiante: `${row.apellidos}, ${row.nombres}`,
      Grado: row.grado,
      Sección: row.seccion,
      Turno: row.turno,
      Tipo: row.tipo,
      Estado: row.estado,
      Observación: row.observacion || ''
    }));
  }

  async function downloadReport(format) {
    try {
      if (format === 'xlsx') {
        await exportXlsx('reporte-asistencias.xlsx', 'Asistencias', exportRows());
      } else {
        await exportPdf(
          'Reporte de asistencias',
          ['Fecha', 'Hora', 'Código', 'Estudiante', 'Grado', 'Sección', 'Turno', 'Tipo', 'Estado'],
          rows.map((row) => [row.fecha, row.hora, row.codigo, `${row.apellidos}, ${row.nombres}`, row.grado, row.seccion, row.turno, row.tipo, row.estado]),
          'reporte-asistencias.pdf'
        );
      }
    } catch (requestError) {
      setError(`No se pudo generar el reporte: ${requestError.message}`);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div><p className="eyebrow">Control diario</p><h1>Asistencias</h1><p className="muted">Consulta y exporta los registros del colegio.</p></div>
        <div className="flex flex-wrap gap-2">
          <button className="button-secondary" disabled={!rows.length} onClick={() => downloadReport('xlsx')} type="button"><Download size={16} /> Excel</button>
          <button className="button-primary" disabled={!rows.length} onClick={() => downloadReport('pdf')} type="button"><FileText size={16} /> PDF</button>
        </div>
      </div>
      {notice && <p className="alert-success">{notice}</p>}
      {error && <p className="alert-error">{error}</p>}
      <section className="panel">
        <div className="filter-grid">
          <label className="form-label">Desde<input className="input-dark mt-2" onChange={(event) => setFrom(event.target.value)} type="date" value={from} /></label>
          <label className="form-label">Hasta<input className="input-dark mt-2" onChange={(event) => setTo(event.target.value)} type="date" value={to} /></label>
          <label className="form-label">Estado<select className="input-dark mt-2" onChange={(event) => setState(event.target.value)} value={state}><option value="">Todos</option>{states.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="form-label">Grado<select className="input-dark mt-2" onChange={(event) => { setGrade(event.target.value); setSection(''); }} value={grade}><option value="">Todos</option>{grades.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label className="form-label">Sección<select className="input-dark mt-2" disabled={!sections.length} onChange={(event) => setSection(event.target.value)} value={section}><option value="">Todas</option>{sections.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
          <label className="form-label sm:col-span-2">Estudiante<div className="relative mt-2"><Search className="absolute left-3 top-3 text-slate-500" size={17} /><input className="input-dark pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o código" value={search} /></div></label>
        </div>
        <div className="table-scroll mt-5">
          <table className="data-table">
            <thead><tr><th>Fecha / hora</th><th>Estudiante</th><th>Grado / sección</th><th>Turno / tipo</th><th>Estado</th>{user.rol === 'ADMINISTRADOR' && <th>Editar</th>}</tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.id}>
                <td>{row.fecha}<span className="block text-xs text-slate-500">{row.hora}</span></td>
                <td><span className="font-medium text-white">{row.apellidos}, {row.nombres}</span><span className="block text-xs text-slate-500">{row.codigo}</span></td>
                <td>{row.grado} · {row.seccion}</td><td>{row.turno}<span className="block text-xs text-slate-500">{row.tipo}</span></td>
                <td><span className={`badge badge-${row.estado.toLowerCase()}`}>{row.estado}</span>{row.observacion && <span className="block max-w-36 truncate text-xs text-slate-500">{row.observacion}</span>}</td>
                {user.rol === 'ADMINISTRADOR' && <td><select aria-label="Cambiar estado" className="input-dark min-w-32 py-2 text-xs" onChange={(event) => updateState(row, event.target.value)} value={row.estado}>{states.map((item) => <option key={item}>{item}</option>)}</select></td>}
              </tr>
            ))}
            {!rows.length && <tr><td className="py-8 text-center text-slate-500" colSpan={user.rol === 'ADMINISTRADOR' ? 6 : 5}>No hay registros para los filtros seleccionados.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">{rows.length} registros · al consultar, el sistema completa faltas de turnos finalizados en días habilitados.</p>
      </section>
    </div>
  );
}
