import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import pool from '../src/config/database.js';

try {
  const schema = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8');
  const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    await pool.query(statement);
  }

  const [columns] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'estudiantes' AND COLUMN_NAME = 'turno_id'`
  );
  if (!columns.length) {
    await pool.query('ALTER TABLE estudiantes ADD COLUMN turno_id BIGINT UNSIGNED NULL AFTER seccion_id');
  }

  await pool.query(
    `INSERT INTO turnos (colegio_id, nombre, hora_entrada, hora_salida, tolerancia_minutos)
     SELECT c.id, 'Mañana', '08:00:00', '13:00:00', 10
     FROM colegios c
     LEFT JOIN turnos t ON t.colegio_id = c.id AND t.activo = TRUE
     WHERE t.id IS NULL`
  );
  const [turnsWithoutDays] = await pool.query(
    `SELECT t.colegio_id, t.id FROM turnos t
     LEFT JOIN dias_asistencia d ON d.colegio_id = t.colegio_id AND d.turno_id = t.id
     WHERE t.activo = TRUE GROUP BY t.colegio_id, t.id HAVING COUNT(d.dia_semana) = 0`
  );
  for (const turn of turnsWithoutDays) {
    for (let day = 1; day <= 5; day += 1) {
      await pool.execute(
        'INSERT IGNORE INTO dias_asistencia (colegio_id, turno_id, dia_semana) VALUES (?, ?, ?)',
        [turn.colegio_id, turn.id, day]
      );
    }
  }
  await pool.query(
    `UPDATE estudiantes e
     JOIN (
       SELECT colegio_id, MIN(id) AS turno_id FROM turnos WHERE activo = TRUE GROUP BY colegio_id
     ) t ON t.colegio_id = e.colegio_id
     SET e.turno_id = t.turno_id
     WHERE e.turno_id IS NULL`
  );

  const [missingForeignKey] = await pool.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = 'estudiantes' AND CONSTRAINT_NAME = 'fk_estudiantes_turno'`
  );
  if (!missingForeignKey.length) {
    const [existingIndex] = await pool.query(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'estudiantes'
         AND INDEX_NAME = 'ix_estudiantes_colegio_turno' LIMIT 1`
    );
    await pool.query(
      `ALTER TABLE estudiantes
       MODIFY turno_id BIGINT UNSIGNED NOT NULL,
       ${existingIndex.length ? '' : 'ADD KEY ix_estudiantes_colegio_turno (colegio_id, turno_id),'}
       ADD CONSTRAINT fk_estudiantes_turno
         FOREIGN KEY (colegio_id, turno_id) REFERENCES turnos (colegio_id, id)
         ON UPDATE CASCADE ON DELETE RESTRICT`
    );
  }
  console.log(`Esquema instalado: ${statements.length} instrucciones verificadas.`);
} catch (error) {
  console.error('No se pudo instalar el esquema MySQL:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
