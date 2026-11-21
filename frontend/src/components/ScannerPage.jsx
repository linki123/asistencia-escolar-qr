import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api.js';

export default function ScannerPage() {
  const [shifts, setShifts] = useState([]);
  const [shiftId, setShiftId] = useState('');
  const [type, setType] = useState('ENTRADA');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const scannerRef = useRef(null);
  const processingRef = useRef(false);

  useEffect(() => {
    api('/attendance/shifts')
      .then((items) => {
        setShifts(items);
        if (items.length) setShiftId(String(items[0].id));
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => () => {
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch((stopError) => console.error('No se pudo detener el escáner:', stopError));
    }
  }, []);

  async function handleScan(decodedText) {
    if (processingRef.current) return;
    processingRef.current = true;
    if (scannerRef.current?.isScanning) scannerRef.current.pause(true);
    setError('');
    setResult(null);
    try {
      const attendance = await api('/attendance/scan', {
        method: 'POST',
        body: JSON.stringify({ token: decodedText, turnoId: Number(shiftId), tipo: type })
      });
      setResult(attendance);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      window.setTimeout(() => {
        processingRef.current = false;
        if (scannerRef.current?.isScanning) {
          try { scannerRef.current.resume(); } catch (resumeError) { console.error('No se pudo reanudar el escáner:', resumeError); }
        }
      }, 1800);
    }
  }

  async function start() {
    setError('');
    setResult(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        handleScan,
        () => {}
      );
      setRunning(true);
    } catch (startError) {
      setError(`No se pudo iniciar la cámara. Verifica los permisos y que la página use HTTPS o localhost. ${startError.message}`);
      scannerRef.current = null;
    }
  }

  async function stop() {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch (stopError) {
      setError(`No se pudo detener la cámara: ${stopError.message}`);
    } finally {
      scannerRef.current = null;
      setRunning(false);
      processingRef.current = false;
    }
  }

  const selectedShift = shifts.find((shift) => String(shift.id) === shiftId);
  const typeAvailable = type === 'ENTRADA' ? selectedShift?.registrar_entrada : selectedShift?.registrar_salida;

  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">Registro rápido</p><h1>Escáner QR</h1><p className="muted">La cámara lee el token y guarda fecha y hora de America/Lima.</p></div></div>
      {error && <p className="alert-error">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <section className="panel">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <label className="form-label">Turno<select className="input-dark mt-2" disabled={running || !shifts.length} onChange={(event) => setShiftId(event.target.value)} value={shiftId}><option value="">No hay turnos hoy</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.nombre} · {shift.hora_entrada.slice(0, 5)}</option>)}</select></label>
            <label className="form-label">Marcación<select className="input-dark mt-2" disabled={running} onChange={(event) => setType(event.target.value)} value={type}><option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option></select></label>
          </div>
          {selectedShift && !typeAvailable && <p className="mb-3 text-sm text-amber-300">Este turno no tiene habilitado el registro de {type.toLowerCase()}.</p>}
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-black">
            <div className="min-h-72" id="qr-reader" />
          </div>
          <div className="mt-4 flex gap-2">
            {!running
              ? <button className="button-primary" disabled={!selectedShift || !typeAvailable} onClick={start} type="button"><Camera size={17} /> Iniciar cámara</button>
              : <button className="button-secondary" onClick={stop} type="button"><CameraOff size={17} /> Detener cámara</button>}
          </div>
        </section>
        <section className="panel">
          <h2 className="section-title">Resultado del escaneo</h2>
          {!result && !error && <p className="muted mt-3">La confirmación aparecerá aquí después de leer un código QR.</p>}
          {result && (
            <div className="mt-5 rounded-2xl border border-emerald-900 bg-emerald-950/40 p-5">
              <CheckCircle2 className="text-emerald-300" size={30} />
              <p className="mt-3 text-lg font-semibold text-emerald-100">Asistencia registrada</p>
              <p className="mt-3 text-white">{result.estudiante.apellidos}, {result.estudiante.nombres}</p>
              <p className="mt-1 text-sm text-slate-400">{result.estudiante.codigo} · {result.estudiante.grado} · {result.estudiante.seccion}</p>
              <div className="mt-4 flex flex-wrap gap-2"><span className={`badge badge-${result.estado.toLowerCase()}`}>{result.estado}</span><span className="badge badge-neutral">{result.hora} · {result.turno}</span></div>
            </div>
          )}
          {shifts.length === 0 && !error && <p className="alert-warning mt-5">No hay turnos habilitados para el día de hoy. Pide al administrador que revise la configuración.</p>}
          <p className="mt-5 text-xs leading-5 text-slate-500">Para usar la cámara desde un celular, navegador requiere HTTPS. En esta computadora, localhost funciona sin certificado.</p>
        </section>
      </div>
    </div>
  );
}
