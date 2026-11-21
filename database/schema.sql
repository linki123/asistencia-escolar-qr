CREATE TABLE IF NOT EXISTS colegios (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(180) NOT NULL,
    codigo VARCHAR(40) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_colegios_codigo (codigo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    colegio_id BIGINT UNSIGNED NULL,
    nombres VARCHAR(120) NOT NULL,
    apellidos VARCHAR(120) NOT NULL,
    correo VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('MASTER', 'ADMINISTRADOR', 'OPERADOR') NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_correo (correo),
    UNIQUE KEY uq_usuarios_colegio_id (colegio_id, id),
    CONSTRAINT fk_usuarios_colegio
        FOREIGN KEY (colegio_id) REFERENCES colegios (id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_usuarios_colegio_rol CHECK (
        (rol = 'MASTER' AND colegio_id IS NULL)
        OR (rol IN ('ADMINISTRADOR', 'OPERADOR') AND colegio_id IS NOT NULL)
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS grados (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    colegio_id BIGINT UNSIGNED NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_grados_colegio_nombre (colegio_id, nombre),
    UNIQUE KEY uq_grados_colegio_id (colegio_id, id),
    CONSTRAINT fk_grados_colegio
        FOREIGN KEY (colegio_id) REFERENCES colegios (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS secciones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    colegio_id BIGINT UNSIGNED NOT NULL,
    grado_id BIGINT UNSIGNED NOT NULL,
    nombre VARCHAR(40) NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_secciones_colegio_grado_nombre (colegio_id, grado_id, nombre),
    UNIQUE KEY uq_secciones_colegio_grado_id (colegio_id, grado_id, id),
    CONSTRAINT fk_secciones_grado
        FOREIGN KEY (colegio_id, grado_id) REFERENCES grados (colegio_id, id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS turnos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    colegio_id BIGINT UNSIGNED NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    hora_entrada TIME NOT NULL,
    hora_salida TIME NOT NULL,
    tolerancia_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    registrar_entrada BOOLEAN NOT NULL DEFAULT TRUE,
    registrar_salida BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_turnos_colegio_nombre (colegio_id, nombre),
    UNIQUE KEY uq_turnos_colegio_id (colegio_id, id),
    CONSTRAINT fk_turnos_colegio
        FOREIGN KEY (colegio_id) REFERENCES colegios (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estudiantes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    colegio_id BIGINT UNSIGNED NOT NULL,
    grado_id BIGINT UNSIGNED NOT NULL,
    seccion_id BIGINT UNSIGNED NOT NULL,
    turno_id BIGINT UNSIGNED NOT NULL,
    codigo VARCHAR(60) NOT NULL,
    nombres VARCHAR(120) NOT NULL,
    apellidos VARCHAR(120) NOT NULL,
    dni VARCHAR(20) NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_estudiantes_colegio_codigo (colegio_id, codigo),
    UNIQUE KEY uq_estudiantes_colegio_id (colegio_id, id),
    KEY ix_estudiantes_colegio_turno (colegio_id, turno_id),
    KEY ix_estudiantes_colegio_apellidos (colegio_id, apellidos, nombres),
    CONSTRAINT fk_estudiantes_seccion_grado
        FOREIGN KEY (colegio_id, grado_id, seccion_id)
        REFERENCES secciones (colegio_id, grado_id, id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_estudiantes_turno
        FOREIGN KEY (colegio_id, turno_id) REFERENCES turnos (colegio_id, id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS codigos_qr (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    colegio_id BIGINT UNSIGNED NOT NULL,
    estudiante_id BIGINT UNSIGNED NOT NULL,
    token CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_codigos_qr_token (token),
    UNIQUE KEY uq_codigos_qr_estudiante (colegio_id, estudiante_id),
    CONSTRAINT fk_codigos_qr_estudiante
        FOREIGN KEY (colegio_id, estudiante_id)
        REFERENCES estudiantes (colegio_id, id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dias_asistencia (
    colegio_id BIGINT UNSIGNED NOT NULL,
    turno_id BIGINT UNSIGNED NOT NULL,
    dia_semana TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (turno_id, dia_semana),
    CONSTRAINT chk_dias_asistencia_rango CHECK (dia_semana BETWEEN 1 AND 7),
    CONSTRAINT fk_dias_asistencia_turno
        FOREIGN KEY (colegio_id, turno_id) REFERENCES turnos (colegio_id, id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS configuraciones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    colegio_id BIGINT UNSIGNED NOT NULL,
    clave VARCHAR(100) NOT NULL,
    valor JSON NOT NULL,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_configuraciones_colegio_clave (colegio_id, clave),
    CONSTRAINT fk_configuraciones_colegio
        FOREIGN KEY (colegio_id) REFERENCES colegios (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asistencias (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    colegio_id BIGINT UNSIGNED NOT NULL,
    estudiante_id BIGINT UNSIGNED NOT NULL,
    turno_id BIGINT UNSIGNED NOT NULL,
    fecha DATE NOT NULL,
    tipo_registro ENUM('ENTRADA', 'SALIDA') NOT NULL DEFAULT 'ENTRADA',
    estado ENUM('PUNTUAL', 'TARDANZA', 'FALTA', 'JUSTIFICADO') NOT NULL,
    registrado_en DATETIME NOT NULL,
    observacion VARCHAR(500) NULL,
    registrado_por BIGINT UNSIGNED NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_asistencias_registro (colegio_id, estudiante_id, fecha, turno_id, tipo_registro),
    KEY ix_asistencias_colegio_fecha (colegio_id, fecha),
    CONSTRAINT fk_asistencias_estudiante
        FOREIGN KEY (colegio_id, estudiante_id)
        REFERENCES estudiantes (colegio_id, id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_asistencias_turno
        FOREIGN KEY (colegio_id, turno_id) REFERENCES turnos (colegio_id, id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_asistencias_usuario
        FOREIGN KEY (colegio_id, registrado_por) REFERENCES usuarios (colegio_id, id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
