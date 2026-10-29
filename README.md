# Horas Extras

Aplicación web para registrar las horas extras de los colegas y descargar el formato en Excel
que se adjunta al ticket de Services Central. Reemplaza el Excel diligenciado a mano: la base
de datos no deja guardar un registro que incumpla las reglas, ni siquiera llamando a la API
directamente.

La aprobación de jefe inmediato, VP y RRHH se sigue haciendo por fuera, en el ticket; el Excel
lleva al pie la política y las líneas de firma.

## Reglas que valida la base

| Regla | Código de error |
|---|---|
| Solo niveles 68 (Analista - Ejecutivo), 73 (Asistentes) y 78 (Conductor) | `HE_NIVEL` |
| Máximo 2 horas en día hábil | `HE_TOPE_DIARIO` |
| Sábado, domingo o festivo: máximo 2 horas, a cualquier hora | `HE_TOPE_FIN_DE_SEMANA` |
| Máximo 12 horas por colega en la semana (lunes a domingo, aunque cruce de mes) | `HE_TOPE_SEMANAL` |
| Un día de descanso del fin de semana: sábado y domingo seguidos no (sábado 31 y domingo 1 tampoco) | `HE_DESCANSO` |
| Día hábil: inicio exactamente al terminar la jornada (5:00 PM), sin pausas | `HE_INICIO_JORNADA` |
| Fecha del mes y año en curso (hora de Bogotá) | `HE_FECHA_FUERA_DEL_MES` |
| Hora final posterior a la de inicio, sin pasar de medianoche | `HE_HORAS_INVALIDAS` |
| Sin horarios cruzados el mismo día | `HE_SOLAPAMIENTO` |
| Justificación obligatoria | `HE_JUSTIFICACION` |

Los topes y el fin de jornada se cambian en Administración → Configuración. Los registros no se
editan ni se borran: se anulan con un motivo y las horas anuladas dejan de contar.

## Estructura

```
23_Horas_Extras/
├─ supabase/
│  ├─ migrations/      ← esquema, reglas, permisos (RLS) y festivos 2026-2027
│  ├─ seed.sql         ← datos ficticios, solo para desarrollo local
│  └─ tests/           ← pruebas SQL de cada regla (corren en PGlite, sin Docker)
├─ scripts/
│  └─ registrar_admin.sql
└─ web/                ← React + TypeScript + Vite + Tailwind
   └─ src/theme/tema.css   ← único archivo con los colores de la marca
```

## Instalación

Requiere Node 20 o superior. La CLI de Supabase se usa con `npx`, no hay que instalarla.

### 1. Base de datos

```bash
npx supabase login
npx supabase link --project-ref jhvkmjurhktikzplspyp
npx supabase db push
```

`db push` aplica las migraciones; el `seed.sql` no se sube al proyecto real.

### 2. Autenticación (panel de Supabase)

1. **Authentication → Hooks → Before User Created**: activarlo con la función de Postgres
   `public.hook_antes_de_crear_usuario`. Así solo se crean cuentas para correos que estén en la
   tabla `usuarios` y activos.
2. **Authentication → Email Templates**: en *Magic Link* (usuarios que ya entraron) y en
   *Confirm signup* (primer ingreso) el correo debe mostrar el código. Poner `{{ .Token }}` en
   el cuerpo, por ejemplo: `Su código para entrar es {{ .Token }}`.
3. **Authentication → SMTP Settings**: configurar un SMTP propio. El de Supabase solo envía
   unos pocos correos por hora y no sirve para uso real.
4. **Authentication → URL Configuration**: poner en *Site URL* la dirección donde quede publicada
   la app.

### 3. Primer administrador

Abrir `scripts/registrar_admin.sql` en el SQL Editor, poner el correo y el nombre y ejecutarlo.
Con ese correo ya se entra, y los demás usuarios se agregan desde Administración.

### 4. Frontend

```bash
cd web
npm install
cp .env.example .env.local   # poner la URL y la clave publicable del proyecto
npm run dev
```

Solo van la URL y la clave publicable (anon). La `service_role` nunca va en el frontend.

## Pruebas

```bash
npm install          # en la raíz, una sola vez
npm run test:sql     # reglas, permisos y RLS en la base (85 pruebas)

cd web
npm test             # cálculo de minutos, tipo de día, formato H:MM y el Excel (31 pruebas)
```

Las pruebas SQL levantan un Postgres en memoria (PGlite) con lo mínimo de Supabase
(`supabase/tests/entorno_supabase.sql`), aplican las migraciones y simulan la hora con
`prueba.reloj()`. La hora simulada solo la acepta una conexión directa como `postgres`; desde
la API siempre se usa la hora real de Bogotá.

Lo que no cubren: el hook dentro del servicio de Auth (se prueba la función, no el servicio) y
dos registros simultáneos del mismo colega (PGlite tiene una sola conexión). Para lo segundo el
trigger toma un `pg_advisory_xact_lock` por colega antes de sumar las horas.

## Publicar el frontend

Es un sitio estático. En Netlify, Vercel o Cloudflare Pages:

- Carpeta base: `web`
- Comando de compilación: `npm run build`
- Carpeta publicada: `web/dist` (o `dist` si la carpeta base ya es `web`)
- Variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, o `SUPABASE_URL` y
  `SUPABASE_ANON_KEY`, que son las que crea la integración de Supabase en Vercel.
  `web/vite.config.ts` pasa al navegador solo esas dos; la `service_role` nunca.

La integración de Vercel con Supabase no crea las tablas; eso lo hace `npx supabase db push`.

Después de publicar, actualizar la *Site URL* del paso 2.

## Datos personales

Las cédulas son datos personales (Ley 1581 de 2012):

- Cada usuario ve solo los registros que hizo; el administrador ve todos.
- Las búsquedas por cédula van por RPC (POST), así que no quedan en URLs ni en los logs de la API.
- El archivo descargado se llama `horas-extras-AAAA-MM.xlsx`, sin datos del colega.
