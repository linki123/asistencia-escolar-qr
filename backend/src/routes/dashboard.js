import { Router } from 'express';
import pool from '../config/database.js';
import { allowRoles, requireAuth, requireSchool } from '../middleware/auth.js';
import { getLimaDateTime } from '../lib/limaTime.js';
import { generateCompletedAbsences } from '../lib/attendance.js';

const router = Router();
router.use(requireAuth, requireSchool, allowRoles('ADMINISTRADOR'));

router.get('/', async (request, response, next) => {
  try {
    const { date, weekday } = getLimaDateTime();
    const [studentRows] = await pool.execute(
      'SELECT COUNT(*) AS total FROM estudiantes WHERE colegio_id = ? AND activo = TRUE',
      [request.user.colegioId]
    );
    await generateCompletedAbsences(pool, request.user.colegioId, date, weekday);
    const [attendanceRows] = await pool.execute(
      `SELECT
         SUM(CASE WHEN estado = 'PUNTUAL' AND tipo_registro = 'ENTRADA' THEN 1 ELSE 0 END) AS puntuales,
         SUM(CASE WHEN estado = 'TARDANZA' AND tipo_registro = 'ENTRADA' THEN 1 ELSE 0 END) AS tardanzas,
         SUM(CASE WHEN estado = 'FALTA' AND tipo_registro = 'ENTRADA' THEN 1 ELSE 0 END) AS faltas
       FROM asistencias WHERE colegio_id = ? AND fecha = ?`,
      [request.user.colegioId, date]
    );
    response.json({
      fecha: date,
      estudiantes: Number(studentRows[0].total),
      puntuales: Number(attendanceRows[0].puntuales || 0),
      tardanzas: Number(attendanceRows[0].tardanzas || 0),
      faltas: Number(attendanceRows[0].faltas || 0),
      ultimos: await recentRecords(request.user.colegioId)
    });
  } catch (error) {
    next(error);
  }
});

async function recentRecords(schoolId) {
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(a.registrado_en, '%H:%i') AS hora, a.fecha, a.estado,
            e.codigo, e.nombres, e.apellidos, g.nombre AS grado, s.nombre AS seccion
     FROM asistencias a
     JOIN estudiantes e ON e.colegio_id = a.colegio_id AND e.id = a.estudiante_id
     JOIN grados g ON g.colegio_id = e.colegio_id AND g.id = e.grado_id
     JOIN secciones s ON s.colegio_id = e.colegio_id AND s.id = e.seccion_id
     WHERE a.colegio_id = ? AND a.tipo_registro = 'ENTRADA'
     ORDER BY a.registrado_en DESC LIMIT 10`,
    [schoolId]
  );
  return rows;
}

export default router;
