import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { api } from '../lib/api.js';

const blank = { nombres: '', apellidos: '', correo: '', password: '', rol: 'OPERADOR' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setUsers(await api('/users')); setError(''); }
    catch (requestError) { setError(requestError.message); }
  }
  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(form) });
      setForm(blank);
      setNotice('Usuario creado correctamente.');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally { setBusy(false); }
  }

  async function setActive(user) {
    try {
      await api(`/users/${user.id}/active`, { method: 'PATCH', body: JSON.stringify({ activo: !user.activo }) });
      await load();
    } catch (requestError) { setError(requestError.message); }
  }

  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">Acceso al sistema</p><h1>Usuarios</h1><p className="muted">Crea administradores y operadores para este colegio.</p></div></div>
      {notice && <p className="alert-success">{notice}</p>}{error && <p className="alert-error">{error}</p>}
      <form className="panel mb-6" onSubmit={submit}>
        <h2 className="section-title mb-4">Nuevo usuario</h2>
        <div className="form-grid">
          <label className="form-label">Nombres<input className="input-dark mt-2" onChange={(event) => setForm({ ...form, nombres: event.target.value })} required value={form.nombres} /></label>
          <label className="form-label">Apellidos<input className="input-dark mt-2" onChange={(event) => setForm({ ...form, apellidos: event.target.value })} required value={form.apellidos} /></label>
          <label className="form-label">Correo<input className="input-dark mt-2" onChange={(event) => setForm({ ...form, correo: event.target.value })} required type="email" value={form.correo} /></label>
          <label className="form-label">Contraseña inicial<input className="input-dark mt-2" minLength="8" onChange={(event) => setForm({ ...form, password: event.target.value })} required type="password" value={form.password} /></label>
          <label className="form-label">Rol<select className="input-dark mt-2" onChange={(event) => setForm({ ...form, rol: event.target.value })} value={form.rol}><option value="OPERADOR">Operador</option><option value="ADMINISTRADOR">Administrador</option></select></label>
        </div>
        <button className="button-primary mt-5" disabled={busy} type="submit"><UserPlus size={16} />{busy ? 'Creando...' : 'Crear usuario'}</button>
      </form>
      <section className="panel">
        <h2 className="section-title">Cuentas registradas</h2>
        <div className="table-scroll mt-4"><table className="data-table">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}><td>{user.apellidos}, {user.nombres}</td><td>{user.correo}</td><td>{user.rol}</td><td>{user.activo ? 'Activo' : 'Desactivado'}</td><td className="text-right"><button className="table-button" onClick={() => setActive(user)} type="button">{user.activo ? 'Desactivar' : 'Activar'}</button></td></tr>)}
            {!users.length && <tr><td className="py-8 text-center text-slate-500" colSpan="5">No hay usuarios registrados.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
