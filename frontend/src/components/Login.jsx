import { useEffect, useState } from 'react';
import { ClipboardCheck, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api.js';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [serviceError, setServiceError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || '/api'}/health`)
      .then(async (response) => {
        const status = await response.json();
        if (!response.ok || status.database !== 'ok') {
          setServiceError('La aplicación aún no puede conectarse a MySQL. Configura tus credenciales locales en backend/.env y reinicia la API.');
        }
      })
      .catch(() => setServiceError('No se pudo contactar con la API. Comprueba que backend esté ejecutándose.'));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('asistencia-token', result.token);
      onLogin(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl sm:p-9">
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
          <ClipboardCheck size={25} />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Asistencia escolar</p>
        <h1 className="mt-2 text-3xl font-semibold">Iniciar sesión</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Ingresa con la cuenta asignada por tu institución.</p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          {serviceError && <p className="alert-warning">{serviceError}</p>}
          <label className="block text-sm font-medium text-slate-300">
            Correo
            <input
              autoComplete="username"
              className="input-dark mt-2"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Contraseña
            <span className="relative mt-2 block">
              <input
                autoComplete="current-password"
                className="input-dark pr-12"
                onChange={(event) => setPassword(event.target.value)}
                required
                type={visible ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-white"
                onClick={() => setVisible((value) => !value)}
                type="button"
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {error && <p className="rounded-xl border border-rose-900 bg-rose-950/60 p-3 text-sm text-rose-200">{error}</p>}
          <button className="button-primary w-full" disabled={busy} type="submit">
            {busy ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
