import { useEffect, useMemo, useState } from 'react';
import { Download, FileArchive, FileText, Search } from 'lucide-react';
import { api } from '../lib/api.js';

export default function QrPage() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewImage, setPreviewImage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('buscar', search.trim());
      if (grade) params.set('grado', grade);
      if (section) params.set('seccion', section);
      setStudents(await api(`/students?${params}`));
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { load(); }, [search, grade, section]);

  const gradeOptions = useMemo(() => [...new Map(students.map((item) => [item.grado_id, item.grado])).entries()], [students]);
  const sections = useMemo(
    () => [...new Map(students.filter((item) => !grade || String(item.grado_id) === grade).map((item) => [item.seccion_id, item.seccion])).entries()],
    [students, grade]
  );

  async function openPreview(student) {
    if (!student.qr_token) {
      setError('Este estudiante aún no tiene un QR activo.');
      return;
    }
    try {
      const QRCode = (await import('qrcode')).default;
      setPreview(student);
      setPreviewImage(await QRCode.toDataURL(student.qr_token, { width: 280, margin: 2 }));
    } catch (requestError) {
      setError(`No se pudo generar el QR: ${requestError.message}`);
    }
  }

  async function downloadOne(student) {
    if (!student.qr_token) return;
    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(student.qr_token, { width: 600, margin: 2 });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `QR-${student.codigo}.png`;
      link.click();
    } catch (requestError) {
      setError(`No se pudo descargar el QR: ${requestError.message}`);
    }
  }

  async function downloadZip() {
    setBusy(true);
    setError('');
    try {
      const [QRCode, JSZip] = await Promise.all([
        import('qrcode').then((module) => module.default),
        import('jszip').then((module) => module.default)
      ]);
      const zip = new JSZip();
      for (const student of students) {
        if (!student.qr_token) continue;
        const data = await QRCode.toDataURL(student.qr_token, { width: 500, margin: 2 });
        zip.file(`QR-${student.codigo}.png`, data.split(',')[1], { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'codigos-qr-estudiantes.zip';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (requestError) {
      setError(`No se pudo crear el ZIP: ${requestError.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    setBusy(true);
    setError('');
    try {
      const [{ jsPDF }, QRCode] = await Promise.all([
        import('jspdf'),
        import('qrcode').then((module) => module.default)
      ]);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const cardWidth = 94;
      const cardHeight = 51;
      const gapX = 6;
      const gapY = 5;
      const marginX = 8;
      const marginY = 9;
      const perPage = 10;

      for (let index = 0; index < students.length; index += 1) {
        if (index && index % perPage === 0) pdf.addPage();
        const position = index % perPage;
        const x = marginX + (position % 2) * (cardWidth + gapX);
        const y = marginY + Math.floor(position / 2) * (cardHeight + gapY);
        const student = students[index];
        pdf.setDrawColor(190, 200, 210);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2);
        pdf.setFontSize(8);
        pdf.setTextColor(25, 45, 70);
        pdf.text('CARNET ESCOLAR', x + 5, y + 7);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(pdf.splitTextToSize(`${student.apellidos}, ${student.nombres}`, 49), x + 5, y + 16);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.text(`Código: ${student.codigo}`, x + 5, y + 29);
        pdf.text(`${student.grado} · ${student.seccion} · ${student.turno}`, x + 5, y + 36);
        if (student.qr_token) {
          const qr = await QRCode.toDataURL(student.qr_token, { width: 300, margin: 1 });
          pdf.addImage(qr, 'PNG', x + 61, y + 6, 28, 28);
        }
      }
      pdf.save('carnets-estudiantes.pdf');
    } catch (requestError) {
      setError(`No se pudo generar el PDF: ${requestError.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div><p className="eyebrow">Identificación</p><h1>Códigos QR</h1><p className="muted">Los códigos contienen un token aleatorio, no datos personales.</p></div>
        <div className="flex flex-wrap gap-2">
          <button className="button-secondary" disabled={busy || !students.length} onClick={downloadZip} type="button"><FileArchive size={16} /> ZIP PNG</button>
          <button className="button-primary" disabled={busy || !students.length} onClick={downloadPdf} type="button"><FileText size={16} /> Carnets PDF</button>
        </div>
      </div>
      {error && <p className="alert-error">{error}</p>}
      <section className="panel">
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="relative min-w-56 flex-1"><Search className="absolute left-3 top-3 text-slate-500" size={17} /><input className="input-dark pl-10" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar estudiante" value={search} /></label>
          <select className="input-dark sm:w-48" onChange={(event) => { setGrade(event.target.value); setSection(''); }} value={grade}><option value="">Todos los grados</option>{gradeOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <select className="input-dark sm:w-44" onChange={(event) => setSection(event.target.value)} value={section}><option value="">Todas las secciones</option>{sections.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Código</th><th>Estudiante</th><th>Grado / sección</th><th className="text-right">Descarga</th></tr></thead>
            <tbody>{students.map((student) => (
              <tr key={student.id}>
                <td>{student.codigo}</td><td>{student.apellidos}, {student.nombres}</td><td>{student.grado} · {student.seccion}</td>
                <td><div className="flex justify-end gap-2"><button className="table-button" onClick={() => openPreview(student)} type="button">Ver QR</button><button aria-label={`Descargar QR ${student.codigo}`} className="table-button" onClick={() => downloadOne(student)} type="button"><Download size={16} /> PNG</button></div></td>
              </tr>
            ))}
            {!students.length && <tr><td className="py-8 text-center text-slate-500" colSpan="4">No hay estudiantes para mostrar.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {preview && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
          <section aria-labelledby="qr-preview-title" aria-modal="true" className="modal-card text-center" role="dialog">
            <h2 className="section-title" id="qr-preview-title">Código QR del estudiante</h2>
            {previewImage && <img alt={`QR aleatorio de ${preview.codigo}`} className="mx-auto my-5 h-56 w-56" src={previewImage} />}
            <p className="font-medium">{preview.apellidos}, {preview.nombres}</p><p className="muted mt-1">{preview.codigo} · {preview.grado} · {preview.seccion}</p>
            <div className="mt-5 flex justify-center gap-2"><button className="button-primary" onClick={() => downloadOne(preview)} type="button"><Download size={16} /> Descargar PNG</button><button className="button-secondary" onClick={() => setPreview(null)} type="button">Cerrar</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
