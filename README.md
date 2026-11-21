# Sistema de Asistencia Escolar con QR

Sistema web para el registro de asistencia de estudiantes mediante códigos QR.  
Incluye gestión de múltiples colegios, roles de usuario, generación de QR, escaneo, reportes y configuración de turnos.

**Demo en línea:**  
https://asistencia-escolar-qr-production.up.railway.app/

## Credenciales de acceso (Demo)

### Acceso Master
- **Correo:** `admin@gmail.com`
- **Contraseña:** `EdENDNd90D2v5K-oHyJnTLeJUtWq2X6j`

### Acceso Administrador (ColegioPrueba)
- **Correo:** `admin@demo-01.local`
- **Contraseña:** `2a91WmgqoFPreO-LXESgf4U-kgHaBia7`

> Estas credenciales son únicamente para la demo del proyecto escolar.

---

## Tecnologías

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Base de datos:** MySQL
- **Autenticación:** JWT
- **Despliegue:** Railway

---

## Funcionalidades

- **Roles de usuario**
  - Master: crea colegios y sus administradores.
  - Administrador: gestiona usuarios, turnos y estudiantes del colegio.
  - Operador: escanea QR y consulta asistencias.
- **Estudiantes**
  - Registro individual o masivo (Excel).
  - Validación, detección de duplicados y generación automática de token QR.
- **Códigos QR**
  - Visualización y descarga individual (PNG).
  - Descarga masiva en ZIP.
  - Generación de carnets imprimibles en PDF.
- **Asistencia**
  - Escaneo con cámara.
  - Cálculo de puntualidad según turno y tolerancia.
  - Prevención de duplicados.
- **Reportes**
  - Filtros por fecha, estudiante, grado, sección y estado.
  - Exportación a Excel y PDF.
  - Justificación manual de faltas.
- **Configuración**
  - Turnos, horarios, tolerancia y días de asistencia.
  - Zona horaria America/Lima.
- **Aislamiento de datos**
  - Cada colegio solo puede ver y modificar su propia información.

---

## Estructura del proyecto

```text
asistencia-escolar-qr/
├── backend/
│   ├── scripts/          # Scripts de configuración y base de datos
│   └── src/
│       ├── config/       # Conexión a MySQL
│       ├── middleware/   # Autenticación y roles
│       └── routes/       # Endpoints de la API
├── database/
│   └── schema.sql        # Esquema de la base de datos
├── frontend/
│   └── src/
│       ├── components/   # Componentes de la interfaz
│       └── lib/          # Cliente de la API
└── package.json

Instalación local: 
Clona el repositorio e instala dependencias:
Bashgit clone https://github.com/linki123/asistencia-escolar-qr.git

## Instalación local (Windows)

1. Clona el repositorio:

   ```bash
   git clone https://github.com/linki123/asistencia-escolar-qr.git
   cd asistencia-escolar-qr

2- Configura el backend y la base de datos:

cd backend
npm install
npm run configure:db

3- Crea las tablas y el usuario master:

npm run db:setup
npm run create:master

4-Inicia el backend:

npm run dev


5- En otra terminal, inicia el frontend:

cd frontend
npm install
npm run dev

6- Abre el navegador en:

http://localhost:5173
