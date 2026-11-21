# Sistema de asistencia escolar con QR

Versión inicial funcional para una demostración local. Usa React + Vite, Node.js + Express y MySQL. Incluye acceso por roles, varios colegios aislados, estudiantes, importación Excel, QR, escaneo, asistencias, reportes y configuración de turnos.

## Estructura

```text
SistemaAsistencia/
├── backend/
│   ├── scripts/       # preparar entorno, base de datos y cuenta master
│   └── src/
│       ├── config/    # conexión MySQL
│       ├── lib/       # hora America/Lima
│       ├── middleware/# autenticación y roles
│       └── routes/    # API por módulo
├── database/
│   └── schema.sql
└── frontend/
    └── src/
        ├── components/# pantallas de cada módulo
        └── lib/       # API y exportaciones
```

## Funcionalidades

- **Roles:** master crea colegios y sus cuentas administradoras; el administrador gestiona usuarios, turnos y estudiantes; el operador puede escanear y consultar asistencias.
- **Estudiantes:** altas individuales, actualización y desactivación; plantilla Excel; vista previa, validación y detección de duplicados antes de importar. Se crea un token QR aleatorio por estudiante.
- **QR:** visualización y descarga individual PNG, descarga ZIP por los filtros seleccionados y PDF de carnets imprimibles.
- **Asistencia:** cámara QR, turno y tipo de marcación, puntualidad calculada con tolerancia, prevención de duplicados y faltas al terminar los turnos configurados.
- **Consultas:** filtros por fechas, estudiante, grado, sección y estado; descarga de reportes XLSX/PDF; justificación manual por el administrador.
- **Configuración:** turnos, horarios, tolerancia y días de asistencia, con zona horaria `America/Lima`.
- **Aislamiento:** todos los endpoints de colegio usan el `colegio_id` autenticado; las claves foráneas compuestas evitan relacionar estudiantes, turnos y registros de instituciones distintas.

## Requisitos

- Node.js 22.12 o posterior y npm.
- MySQL 8.0.16 o posterior.
- MySQL Workbench o cliente equivalente para crear la base de datos.

## Instalación en Windows

1. Inicia el servicio MySQL.

2. Prepara el backend y configura la base:

   ```powershell
   Set-Location .\backend
   npm install
   npm run configure:db
   ```

   Ingresa usuario y contraseña en la terminal; la contraseña no se muestra ni se envía fuera de tu computadora. El asistente prueba la conexión, crea `asistencia_escolar` si hace falta y guarda las credenciales y una clave de sesión aleatoria en `backend/.env`, excluido del repositorio. Si tu usuario no tiene permiso para crear bases, crea `asistencia_escolar` desde MySQL Workbench y vuelve a ejecutar el asistente.

3. Instala el esquema y crea tu cuenta master:

   ```powershell
   npm run db:setup
   npm run create:master
   ```

   El segundo comando solicita los datos de la cuenta en la terminal y oculta la contraseña al escribirla. La cuenta master no se crea con credenciales predeterminadas.

4. En una terminal, inicia la API:

   ```powershell
   npm run dev
   ```

5. En una segunda terminal desde la carpeta del proyecto, inicia la web:

   ```powershell
   Set-Location .\frontend
   npm install
   npm run dev
   ```

6. Abre `http://localhost:5173`, inicia sesión como master y registra un colegio con su primer administrador. Luego cierra sesión e ingresa como administrador para configurar el colegio.

`npm run db:setup` crea el esquema y aplica la asignación de turnos necesaria a instalaciones previas de esta aplicación. Puedes ejecutarlo otra vez si necesitas comprobar o completar el esquema; no elimina datos.

## Escáner desde celular

En un celular, los navegadores solo permiten usar la cámara desde un contexto seguro. `localhost` funciona para pruebas en la computadora, pero para escanear desde otro dispositivo se requiere publicar la web bajo HTTPS. Abrir la dirección de red local de Vite en HTTP sirve para revisar la interfaz, no necesariamente para activar la cámara.

## Publicar una demo con un enlace (Railway)

La aplicación puede ejecutar React, Express y MySQL en Railway. El proyecto queda preparado para que Express sirva el frontend compilado y la API desde el mismo dominio. La base MySQL es un servicio separado, privado dentro del proyecto Railway; sus datos no se copian automáticamente desde tu MySQL local.

1. Inicia sesión en Railway con `railway login` desde una terminal de VS Code. También puedes crear el proyecto desde el dashboard y conectar un repositorio **privado** de GitHub. Si usas GitHub, comprueba los archivos de Source Control y no subas `.env`, contraseñas ni datos reales.
2. En Railway, crea un proyecto y agrega un servicio MySQL con almacenamiento persistente.
3. Crea el servicio web a partir del proyecto/repo usando la raíz del proyecto (no `/frontend` ni `/backend`). El `package.json` raíz prepara build y start.
4. En Settings del servicio web, configura:
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
   - **Pre-deploy command:** `npm run db:setup --prefix backend && npm run provision:demo --prefix backend`
   - **Healthcheck path:** `/api/health`
   - Genera un dominio en **Networking → Public Networking**.
5. En Variables del servicio web, agrega referencias privadas al servicio MySQL. Si el servicio se llama `MySQL`, usa:

   ```text
   MYSQLHOST=${{MySQL.MYSQLHOST}}
   MYSQLPORT=${{MySQL.MYSQLPORT}}
   MYSQLUSER=${{MySQL.MYSQLUSER}}
   MYSQLPASSWORD=${{MySQL.MYSQLPASSWORD}}
   MYSQLDATABASE=${{MySQL.MYSQLDATABASE}}
   ```

   Los nombres de servicio distinguen mayúsculas/minúsculas. Usa el nombre exacto de tu servicio. Agrega también `JWT_SECRET` como valor secreto aleatorio de al menos 32 caracteres.
6. Para crear el acceso inicial del sitio, agrega temporalmente estas variables al servicio web. Usa una contraseña nueva, distinta a cualquiera que hayas compartido, con 12 o más caracteres:

   ```text
   DEMO_MASTER_NAME=Tu nombre
   DEMO_MASTER_EMAIL=tu correo
   DEMO_MASTER_PASSWORD=contraseña nueva y única
   DEMO_SCHOOL_NAME=ColegioPrueba
   DEMO_SCHOOL_CODE=DEMO-01
   DEMO_SCHOOL_ADMIN_EMAIL=admin-demo@ejemplo.invalid
   DEMO_SCHOOL_ADMIN_PASSWORD=otra contraseña nueva y única
   ```

   El comando de pre-despliegue prepara las tablas y crea esas cuentas solo si aún no hay cuenta master. No escribe las contraseñas en los logs. Después del primer despliegue exitoso, elimina las variables de contraseña `DEMO_MASTER_PASSWORD` y `DEMO_SCHOOL_ADMIN_PASSWORD`; la siguiente publicación detectará que ya se inicializó.
7. Espera a que el healthcheck responda y abre el dominio HTTPS. Inicia sesión con `DEMO_MASTER_EMAIL` y `DEMO_MASTER_PASSWORD`. El dominio HTTPS permite probar cámara QR desde un celular.

Railway cobra según su plan y uso; revisa el precio y posibles costos antes de desplegar. La prueba gratuita/crediticia y sus condiciones pueden cambiar. Una demo pública no debe contener información personal real. Las claves de prueba que se usaron en conversaciones anteriores no deben reutilizarse.

## Notas

- Los colegios nuevos comienzan con un turno de lunes a viernes de 08:00 a 13:00, tolerancia de 10 minutos. El administrador puede cambiarlo desde Configuración.
- Los estudiantes se asignan a un turno; las importaciones Excel usan el primer turno activo. La asignación puede cambiarse al editar un estudiante.
- No se crea una cuenta master automática ni se incluyen estudiantes de ejemplo.
