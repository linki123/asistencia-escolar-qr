import { getLimaDateTime } from './limaTime.js';

export async function generateCompletedAbsences(pool, schoolId, date, weekday) {
  const now = getLimaDateTime();
  const isPastDate = date < now.date;
  const [shifts] = await pool.execute(
    `SELECT t.id, t.hora_salida
     FROM turnos t
     JOIN dias_asistencia d ON d.colegio_id = t.colegio_id AND d.turno_id = t.id
     WHERE t.colegio_id = ? AND t.activo = TRUE AND t.registrar_entrada = TRUE
       AND d.dia_semana = ?`,
    [schoolId, weekday]
  );
  for (const shift of shifts) {
    if (!isPastDate && now.time < shift.hora_salida) continue;
    await pool.execute(
      `INSERT IGNORE INTO asistencias
         (colegio_id, estudiante_id, turno_id, fecha, tipo_registro, estado, registrado_en)
       SELECT e.colegio_id, e.id, ?, ?, 'ENTRADA', 'FALTA', CONCAT(?, ' ', ?)
       FROM estudiantes e
       LEFT JOIN asistencias a
         ON a.colegio_id = e.colegio_id AND a.estudiante_id = e.id
         AND a.turno_id = ? AND a.fecha = ? AND a.tipo_registro = 'ENTRADA'
       WHERE e.colegio_id = ? AND e.activo = TRUE AND e.turno_id = ? AND a.id IS NULL`,
      [shift.id, date, date, shift.hora_salida, shift.id, date, schoolId, shift.id]
    );
  }
}
