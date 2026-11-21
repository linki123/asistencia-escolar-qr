import { useEffect, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { api } from '../lib/api.js';

const blank = {
  nombre: '', codigo: '', adminNombres: '', adminApellidos: '',
  adminCorreo: '', adminPassword: ''
};

export default function SchoolsPage() {
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setSchools(await api('/schools')); setError(''); }
    catch (requestError) { setError(requestError.message); }
  }
  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/schools', { method: 'POST', body: JSON.stringify(form) });
      setForm(blank);
      setNotice('Colegio creado junto a su administrador y turno inicial.');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">Administración central</p><h1>Colegios</h1><p className="muted">Cada institución cuenta con sus propios usuarios y registros aislados.</p></div></div>
      {notice && <p className="alert-success">{notice}</p>}{error && <p className="alert-error">{error}</p>}
      <form className="panel mb-6" onSubmit={submit}>
        <h2 className="section-title mb-4">Registrar colegio</h2>
        <div className="form-grid">
          <label className="form-label">Nombre del colegio<input className="input-dark mt-2" onChange={(event) => setForm({ ...form, nombre: event.target.value })} required value={form.nombre} /></label>
          <label className="form-label">Código institucional<input className="input-dark mt-2" onChange={(event) => setForm({ ...form, codigo: event.target.value })} required value={form.codigo} /></label>
          <label className="form-label">Nombres del administrador<input className="input-dark mt-2" onChange={(event) => setForm({ ...form, adminNombres: event.target.value })} required value={form.adminNombres} /></label>
          <label className="form-label">Apellidos del administrador<input className="input-dark mt-2" onChange={(event) => setForm({ ...form, adminApellidos: event.target.value })} required value={form.adminApellidos} /></label>
          <label className="form-label">Correo del administrador<input className="input-dark mt-2" onChange={(event) => setForm({ ...form, adminCorreo: event.target.value })} required type="email" value={form.adminCorreo} /></label>
          <label className="form-label">Contraseña inicial<input className="input-dark mt-2" minLength="8" onChange={(event) => setForm({ ...form, adminPassword: event.target.value })} required type="password" value={form.adminPassword} /></label>
        </div>
        <button className="button-primary mt-5" disabled={busy} type="submit"><Plus size={16} />{busy ? 'Creando...' : 'Crear colegio y administrador'}</button>
      </form>
      <section className="panel">
        <h2 className="section-title">Instituciones registradas</h2>
        <div className="table-scroll mt-4"><table className="data-table">
          <thead><tr><th>Código</th><th>Institución</th><th>Estudiantes activos</th><th>Estado</th></tr></thead>
          <tbody>{schools.map((school) => <tr key={school.id}><td>{school.codigo}</td><td><span className="inline-flex items-center gap-2"><Building2 size={16} className="text-cyan-300" />{school.nombre}</span></td><td>{school.estudiantes}</td><td>{school.activo ? 'Activa' : 'Inactiva'}</td></tr>)}
            {!schools.length && <tr><td className="py-8 text-center text-slate-500" colSpan="4">No hay colegios registrados.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
