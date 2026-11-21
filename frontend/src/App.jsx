import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Activity, BookUser, Building2, ClipboardList, LogOut, QrCode,
  ScanLine, Settings2, Users, Menu, X
} from 'lucide-react';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
const StudentsPage = lazy(() => import('./components/StudentsPage.jsx'));
import QrPage from './components/QrPage.jsx';
import ScannerPage from './components/ScannerPage.jsx';
const AttendancePage = lazy(() => import('./components/AttendancePage.jsx'));
import SettingsPage from './components/SettingsPage.jsx';
import UsersPage from './components/UsersPage.jsx';
import SchoolsPage from './components/SchoolsPage.jsx';
import { api } from './lib/api.js';

const navigation = {
  MASTER: [{ id: 'schools', label: 'Colegios', icon: Building2 }],
  ADMINISTRADOR: [
    { id: 'dashboard', label: 'Resumen', icon: Activity },
    { id: 'students', label: 'Estudiantes', icon: BookUser },
    { id: 'qrs', label: 'Códigos QR', icon: QrCode },
    { id: 'scanner', label: 'Escáner', icon: ScanLine },
    { id: 'attendance', label: 'Asistencias', icon: ClipboardList },
    { id: 'settings', label: 'Configuración', icon: Settings2 },
    { id: 'users', label: 'Usuarios', icon: Users }
  ],
  OPERADOR: [
    { id: 'scanner', label: 'Escáner', icon: ScanLine },
    { id: 'attendance', label: 'Consultar asistencias', icon: ClipboardList }
  ]
};

function Page({ page, user }) {
  if (page === 'schools') return <SchoolsPage />;
  if (page === 'dashboard') return <Dashboard />;
  if (page === 'students') return <StudentsPage />;
  if (page === 'qrs') return <QrPage />;
  if (page === 'scanner') return <ScannerPage />;
  if (page === 'attendance') return <AttendancePage user={user} />;
  if (page === 'settings') return <SettingsPage />;
  if (page === 'users') return <UsersPage />;
  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState(null);
  const [checking, setChecking] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('asistencia-token');
    if (!token) {
      setChecking(false);
      return;
    }
    api('/auth/me')
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        setPage(navigation[currentUser.rol]?.[0]?.id || null);
      })
      .catch(() => localStorage.removeItem('asistencia-token'))
      .finally(() => setChecking(false));
  }, []);

  function login(currentUser) {
    setUser(currentUser);
    setPage(navigation[currentUser.rol]?.[0]?.id || null);
  }

  function logout() {
    localStorage.removeItem('asistencia-token');
    setUser(null);
    setPage(null);
  }

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">Comprobando sesión...</div>;
  if (!user) return <Login onLogin={login} />;

  const items = navigation[user.rol] || [];
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 md:flex">
      {mobileMenu && <button aria-label="Cerrar menú" className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMobileMenu(false)} type="button" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-slate-900 transition-transform md:static md:translate-x-0 ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-slate-950"><QrCode size={22} /></div>
          <div><p className="font-semibold">Asistencia QR</p><p className="text-xs text-slate-500">{user.colegioNombre || 'Administración master'}</p></div>
          <button className="ml-auto text-slate-400 md:hidden" onClick={() => setMobileMenu(false)} type="button"><X size={20} /></button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-5">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              className={`nav-item ${page === id ? 'nav-item-active' : ''}`}
              key={id}
              onClick={() => { setPage(id); setMobileMenu(false); }}
              type="button"
            >
              <Icon size={18} />{label}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4">
          <p className="truncate px-2 text-sm font-medium">{user.nombres} {user.apellidos}</p>
          <p className="px-2 pt-1 text-xs text-slate-500">{user.rol}</p>
          <button className="nav-item mt-3 text-slate-400 hover:text-white" onClick={logout} type="button"><LogOut size={18} />Cerrar sesión</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex h-16 items-center border-b border-slate-800 px-4 md:hidden">
          <button aria-label="Abrir menú" className="text-slate-300" onClick={() => setMobileMenu(true)} type="button"><Menu size={22} /></button>
          <span className="ml-3 font-medium">Asistencia QR</span>
        </header>
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<div className="panel text-slate-400">Cargando módulo...</div>}>
            <Page page={page} user={user} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
