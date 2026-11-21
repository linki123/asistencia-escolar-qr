import { useEffect, useMemo, useState } from 'react';
import { Download, FileUp, Plus, Search, Trash2, Upload } from 'lucide-react';
import * as XLSX from '@e965/xlsx';
import { api } from '../lib/api.js';
import { exportXlsx } from '../lib/export.js';

const emptyStudent = { codigo: '', nombres: '', apellidos: '', dni: '', grado: '', seccion: '', turnoId: '' };
const templateFields = ['Código', 'Nombres', 'Apellidos', 'DNI', 'Grado', 'Sección'];

function normalizeHeader(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function mapExcelRow(row) {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), String(value ?? '').trim()])
  );
  return {
    codigo: normalized.codigo || normalized.cod || '',
    nombres: normalized.nombres || normalized.nombre || '',
    apellidos: normalized.apellidos || normalized.apellido || '',
    dni: normalized.dni || '',
    grado: normalized.grado || '',
    seccion: normalized.seccion || normalized.sección || ''
  };
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [form, setForm] = useState(emptyStudent);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const sections = useMemo(
    () => grades.find((grade) => String(grade.id) === gradeFilter)?.secciones || [],
    [grades, gradeFilter]
  );

  async function load() {
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('buscar', search.trim());
      if (gradeFilter) params.set('grado', gradeFilter);
      if (sectionFilter) params.set('seccion', sectionFilter);
      const [rows, gradeOptions, settings] = await Promise.all([
        api(`/students?${params}`),
        api('/students/options'),
        api('/settings')
      ]);
      setStudents(rows);
      setShifts(settings.turnos.filter((turn) => turn.activo));
      const defaultShift = settings.turnos.find((turn) => turn.activo);
      if (defaultShift) {
        setForm((current) => current.turnoId ? current : { ...current, turnoId: String(defaultShift.id) });
      }
      setGrades(gradeOptions.map((grade) => ({
        ...grade,
        secciones: Array.isArray(grade.secciones) ? grade.secciones.filter((section) => section.id) : []
      })));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { load(); }, [search, gradeFilter, sectionFilter]);

  function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([templateFields]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Estudiantes');
    XLSX.writeFile(book, 'plantilla-estudiantes.xlsx');
  }

  async function readExcel(file) {
    if (!file) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('El archivo no puede superar 5 MB.');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
      if (!rawRows.length) throw new Error('El archivo no contiene estudiantes.');
      const rows = rawRows.map(mapExcelRow);
      const result = await api('/students/import/preview', {
        method: 'POST',
        body: JSON.stringify({ rows })
      });
      setPreview({ rows, result });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function importStudents() {
    const validRows = preview?.result.filas
      .filter((row) => row.valido)
      .map(({ fila: _rowNumber, valido: _valid, ...row }) => row) || [];
    if (!validRows.length) return;
    setBusy(true);
    setError('');
    try {
      const result = await api('/students/import', {
        method: 'POST',
        body: JSON.stringify({ rows: validRows })
      });
      setNotice(`Se importaron ${result.importados} estudiantes y sus códigos QR.`);
      setPreview(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveStudent(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await api(`/students/${editing}`, { method: 'PUT', body: JSON.stringify(form) });
        setNotice('Estudiante actualizado.');
      } else {
        await api('/students', { method: 'POST', body: JSON.stringify(form) });
        setNotice('Estudiante registrado y QR generado.');
      }
      setForm(emptyStudent);
      setEditing(null);
      setShowForm(false);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id) {
    if (!window.confirm('¿Desactivar este estudiante? Sus registros históricos se conservarán.')) return;
    try {
      await api(`/students/${id}/active`, { method: 'PATCH', body: JSON.stringify({ activo: false }) });
      setNotice('Estudiante desactivado.');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function editStudent(student) {
    setEditing(student.id);
    setForm({
      codigo: student.codigo,
      nombres: student.nombres,
      apellidos: student.apellidos,
      dni: student.dni || '',
      grado: student.grado,
      seccion: student.seccion,
      turnoId: String(student.turno_id)
    });
    setShowForm(true);
  }

  return (
    <div>
      <div className="page-heading">
        <div><p className="eyebrow">Matrícula</p><h1>Estudiantes</h1><p className="muted">Registro individual e importación con generación automática de QR.</p></div>
        <div className="flex flex-wrap gap-2">
          <button className="button-secondary" onClick={downloadTemplate} type="button"><Download size={16} /> Plantilla Excel</button>
          <label className="button-secondary cursor-pointer">
            <FileUp size={16} /> {busy ? 'Procesando...' : 'Importar Excel'}
            <input accept=".xlsx,.xls" className="hidden" disabled={busy} onChange={(event) => readExcel(event.target.files?.[0])} type="file" />
          </label>
          <button className="button-primary" onClick={() => { setEditing(null); setForm(emptyStudent); setShowForm((value) => !value); }} type="button"><Plus size={16} /> Nuevo estudiante</button>
        </div>
      </div>
      {notice && <p className="alert-success">{notice}</p>}
      {error && <p className="alert-error">{error}</p>}

      {showForm && (
        <form className="panel mb-6" onSubmit={saveStudent}>
          <h2 className="section-title mb-4">{editing ? 'Editar estudiante' : 'Registrar estudiante'}</h2>
          <div className="form-grid">
            {[
              ['codigo', 'Código *'], ['nombres', 'Nombres *'], ['apellidos', 'Apellidos *'],
              ['dni', 'DNI (opcional)'], ['grado', 'Grado *'], ['seccion', 'Sección *']
            ].map(([key, label]) => (
              <label className="form-label" key={key}>{label}
                <input className="input-dark mt-2" onChange={(event) => setForm({ ...form, [key]: event.target.value })} required={key !== 'dni'} value={form[key]} />
              </label>
            ))}
            <label className="form-label">Turno *
              <select className="input-dark mt-2" onChange={(event) => setForm({ ...form, turnoId: event.target.value })} required value={form.turnoId}>
                <option value="">Selecciona un turno</option>
                {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.nombre}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <button className="button-primary" disabled={busy} type="submit">{busy ? 'Guardando...' : 'Guardar'}</button>
            <button className="button-secondary" onClick={() => { setShowForm(false); setEditing(null); }} type="button">Cancelar</button>
          </div>
        </form>
      )}

      {preview && (
        <section className="panel mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="section-title">Vista previa de importación</h2><p className="muted mt-1">{preview.result.validas} válidas · {preview.result.rechazadas} duplicadas o con errores</p></div>
            <div className="flex gap-2">
              <button className="button-primary" disabled={busy || !preview.result.validas} onClick={importStudents} type="button"><Upload size={16} /> Confirmar importación</button>
              <button className="button-secondary" onClick={() => setPreview(null)} type="button">Cancelar</button>
            </div>
          </div>
          <div className="table-scroll mt-4 max-h-80">
            <table className="data-table">
              <thead><tr><th>Fila</th><th>Código</th><th>Estudiante</th><th>Grado / sección</th><th>Validación</th></tr></thead>
              <tbody>{preview.result.filas.map((row) => (
                <tr key={row.fila}>
                  <td>{row.fila}</td><td>{row.codigo || '—'}</td>
                  <td>{row.apellidos ? `${row.apellidos}, ${row.nombres}` : '—'}</td>
                  <td>{row.grado ? `${row.grado} · ${row.seccion}` : '—'}</td>
                  <td className={row.valido ? 'text-emerald-300' : 'text-rose-300'}>{row.valido ? 'Lista' : row.error}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="relative min-w-56 flex-1"><Search className="absolute left-3 top-3 text-slate-500" size={17} /><input className="input-dark pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, código o DNI" value={search} /></label>
          <select className="input-dark sm:w-48" onChange={(event) => { setGradeFilter(event.target.value); setSectionFilter(''); }} value={gradeFilter}><option value="">Todos los grados</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.nombre}</option>)}</select>
          <select className="input-dark sm:w-44" disabled={!sections.length} onChange={(event) => setSectionFilter(event.target.value)} value={sectionFilter}><option value="">Todas las secciones</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.nombre}</option>)}</select>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Código</th><th>Estudiante</th><th>DNI</th><th>Grado / sección</th><th>Turno</th><th className="text-right">Acciones</th></tr></thead>
            <tbody>{students.map((student) => (
              <tr key={student.id}>
                <td>{student.codigo}</td><td><span className="font-medium text-white">{student.apellidos}, {student.nombres}</span></td>
                <td>{student.dni || '—'}</td><td>{student.grado} · {student.seccion}</td><td>{student.turno}</td>
                <td><div className="flex justify-end gap-2"><button className="table-button" onClick={() => editStudent(student)} type="button">Editar</button><button aria-label={`Desactivar ${student.nombres}`} className="table-button text-rose-300" onClick={() => deactivate(student.id)} type="button"><Trash2 size={16} /></button></div></td>
              </tr>
            ))}
            {!students.length && <tr><td className="py-8 text-center text-slate-500" colSpan="6">No hay estudiantes que coincidan con la búsqueda.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
