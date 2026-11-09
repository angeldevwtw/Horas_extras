# Horas Extras

Página web para diligenciar las horas extras de los colegas y descargar el formato en Excel que
se adjunta al ticket de Services Central. Reemplaza el Excel llenado a mano: la base de datos no
deja guardar un registro que incumpla las reglas, ni siquiera llamando a la API directamente.

Los empleados no tienen login: quien abre la página llena el formulario, elige a su coordinador
(o "Ninguno" y su director) y guarda; el registro queda pendiente. Hay tres niveles con acceso:

| Rol | Entra con | Ve | Puede |
|---|---|---|---|
| Coordinador | Su cuenta, en "Mi equipo" (`#equipo`) | Lo de su equipo | Aprobar, negar y bajar el Excel de lo aprobado |
| Director | Su cuenta, en "Mi equipo" (`#equipo`) | Lo de sus coordinadores y de quienes lo eligieron directamente | Lo mismo que el coordinador, agregar o desactivar sus coordinadores y asignar su filial y la de ellos |
| Super admin | Clave, en "Administración" (`#admin`) | Todo, de todas las filiales | Anular, bajar el Excel de lo aprobado y mantener la lista de jefes; no aprueba |

Vale la primera decisión. Un registro pendiente cuenta para los topes; uno negado libera sus horas.
El Excel solo lleva lo aprobado. Las firmas de VP y RRHH se siguen haciendo por fuera, en el ticket;
el Excel lleva al pie la política y las líneas de firma. Lo registrado antes de esta aprobación
quedó aprobado y sin jefe, así que solo lo ve el super admin.

## Reglas que valida la base

| Regla | Código de error |
|---|---|
| Solo niveles 68 (Analista - Ejecutivo), 73 (Asistentes) y 78 (Conductor) | `HE_NIVEL` |
| Máximo 2 horas en día hábil | `HE_TOPE_DIARIO` |
| Sábado, domingo o festivo: máximo 2 horas, a cualquier hora | `HE_TOPE_FIN_DE_SEMANA` |
| Domingo solo en Sufi; las demás filiales no lo registran | `HE_DOMINGO` |
| En Sufi, el sábado o (si el colega descansa el sábado) el domingo, nunca los dos | `HE_DESCANSO` |
| Máximo 12 horas por colega en la semana (lunes a domingo, aunque cruce de mes) | `HE_TOPE_SEMANAL` |
| Festivo solo si el colega no trabajó ese fin de semana, ni sábado ni domingo (lunes festivo: el anterior; otro día: el de esa semana), y al revés | `HE_DESCANSO` |
| Día hábil: inicio exactamente al terminar la jornada (5:00 PM; viernes 4:30 PM), sin pausas (no aplica a Sufi) | `HE_INICIO_JORNADA` |
| Sufi en día hábil: jornada con final máximo a las 9:00 PM | `HE_FIN_SUFI` |
| Sufi en día hábil: total de horas extras en medias horas y dentro de la jornada | `HE_TOTAL_INVALIDO` |
| Fecha del mes anterior o del mes en curso (hora de Bogotá) | `HE_FECHA_FUERA_DEL_MES` |
| Fecha no posterior a hoy: se registra después de trabajar (hora de Bogotá) | `HE_FECHA_FUTURA` |
| Hora final posterior a la de inicio, sin pasar de medianoche | `HE_HORAS_INVALIDAS` |
| Día ya registrado: hábil con cualquier registro, sábado o festivo con las 2:00 completas | `HE_DIA_REGISTRADO` |
| Sin horarios cruzados el mismo día | `HE_SOLAPAMIENTO` |
| Horas en punto o y media (sin 15 ni 45 minutos) | restricción `registros_media_hora` |
| Justificación obligatoria | `HE_JUSTIFICACION` |
| Coordinador activo o, con "Ninguno", director activo, de la filial del registro (o sin filial) | `HE_JEFE` |
| Decidir solo lo de su línea y solo si sigue pendiente | `HE_SIN_PERMISO`, `HE_YA_DECIDIDO` |
| Filial: Banco, Sufi, Leasing o Empleados | `HE_FILIAL` |

Se pueden registrar varios días a la vez para un mismo colega (`registrar_varios`): cada día
pasa por las mismas reglas, el tope semanal suma también los otros días elegidos, un festivo no
puede ir con su sábado o domingo en la misma selección, ni el sábado con el domingo y se guardan todos o ninguno. La justificación
puede ser una para todos los días o una por día. Cada día queda como un
registro con su propio código.

Sufi tiene un horario especial en día hábil: se marca el inicio y el final de la jornada y aparte
el total de horas extras, que es lo que cuenta para los topes y sale en el Excel. La hora límite se
cambia en `configuracion` (`fin_jornada_sufi`). En sábado y festivo registra como las demás
filiales; el domingo, que solo Sufi puede registrar, también va con hora de inicio y hasta 2:00.

Los topes cuentan todo lo registrado para el colega, desde cualquier equipo. Los registros no se
editan ni se borran: se anulan con un motivo y las horas anuladas dejan de contar.

## Cómo se usa

1. Se diligencian los datos del colega, se marcan en el calendario uno o varios días y se elige
   el horario (común para todos, ajustable por día); los errores salen junto a cada campo o día y
   el botón Guardar no se activa mientras haya alguno.
2. Cada registro guardado aparece en la lista "Registrado en esta ventana".
3. "Descargar Excel" arma el formato con esa lista.
4. "Administración" (enlace arriba a la derecha, o la dirección con `#admin`): con la clave de
   administración se ven todos los registros del mes, también los anulados; se busca por código,
   cédula o nombre; se descarga el Excel del mes y se anula cualquier registro con su motivo,
   aunque la ventana donde se hizo ya esté cerrada. Tras 10 claves equivocadas en 15 minutos
   desde la misma conexión, se bloquea por 15 minutos. La clave no se guarda en el navegador.

La lista y las claves para anular viven solo en esa pestaña (se borran al cerrarla, para no dejar
cédulas en el equipo). Un registro hecho desde otra pestaña ya no se puede anular desde la página;
se anula en el panel de Supabase (ver abajo).

## Estructura

```
23_Horas_Extras/
├─ supabase/
│  ├─ migrations/      ← esquema, reglas, permisos y festivos 2026-2027
│  ├─ seed.sql         ← datos ficticios, solo para desarrollo local
│  └─ tests/           ← pruebas SQL de cada regla (corren en PGlite, sin Docker)
└─ web/                ← React + TypeScript + Vite + Tailwind
   └─ src/theme/tema.css   ← único archivo con los colores de la marca
```

## Instalación

Requiere Node 20 o superior. La CLI de Supabase se usa con `npx`, no hay que instalarla.

### 1. Base de datos

En Vercel no hay que hacer nada: en cada despliegue, `web/scripts/migrar.mjs` aplica las
migraciones que falten con la variable `POSTGRES_URL_NON_POOLING` que deja la integración de
Supabase (script `vercel-build`). Si una migración falla, el despliegue falla y queda publicada
la versión anterior.

También se pueden aplicar a mano con la CLI; las dos formas usan el mismo historial
(`supabase_migrations.schema_migrations`) y no repiten nada:

```bash
npx supabase login
npx supabase link --project-ref jhvkmjurhktikzplspyp
npx supabase db push
```

El `seed.sql` no se sube al proyecto real.

### 2. Frontend en local

```bash
cd web
npm install
cp .env.example .env.local   # poner la URL y la clave publicable del proyecto
npm run dev
```

## Publicar el frontend (Vercel)

- Carpeta base (Root Directory): `web`; Framework: Vite.
- Variables: `POSTGRES_URL_NON_POOLING` (solo para las migraciones al compilar; no llega al
  navegador) y `SUPABASE_URL` y `SUPABASE_ANON_KEY`, todas creadas por la integración, o
  `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. `web/vite.config.ts` pasa al navegador solo
  esas dos; la `service_role` nunca.
- Settings → Deployment Protection: desactivar *Vercel Authentication* en producción, o la
  página pedirá iniciar sesión en Vercel.

## Directores y coordinadores

1. En Authentication → Providers → Email (o Sign In / Providers, según la versión del panel):
   **desactivar "Allow new users to sign up"**. Las cuentas las crea solo el administrador. Es
   necesario: si cualquiera pudiera crear una cuenta autoconfirmada con el correo de un jefe,
   entraría con su rol.
2. En "Administración" → "Directores y coordinadores": agregar los directores. Los coordinadores
   los agrega ahí el administrador o cada director en "Mi equipo", solo para su propia línea. Con
   filial, el jefe sale en el formulario solo para esa; con "Todas las filiales", para todas.
   Mientras no haya jefes activos, nadie puede registrar horas.
3. En Authentication → Users → Add user: crear cada cuenta con el mismo correo, una contraseña y
   "Auto Confirm User". La lista muestra "Creada" cuando ya existe. Las contraseñas se cambian ahí.

## Administración (panel de Supabase)

Quien no tenga la clave de administración o una cuenta de jefe no puede leer nada de lo guardado.
En el panel de Supabase:

- **Definir o cambiar la clave de administración** (SQL Editor; mínimo 12 caracteres).
  Mientras no se defina, la página de administración no funciona. Solo se guarda su hash:

  ```sql
  select privado.cambiar_clave_descarga('la-clave-que-se-comparte-con-rrhh');
  ```
- **Table Editor → registros**: consultar lo registrado.
- **Table Editor → festivos / configuracion**: agregar festivos o cambiar topes y fin de jornada.
- **Anular un registro**: lo normal es hacerlo desde la página de administración. Los registros
  no se borran ni se editan, ni siquiera desde el panel; también se pueden anular en el SQL Editor:

  ```sql
  select privado.anular_registro_admin('HE-00001', 'Motivo de la anulación');
  ```

## Pruebas

```bash
npm install          # en la raíz, una sola vez
npm run test:sql     # reglas y permisos en la base

cd web
npm test             # minutos, tipo de día, formato H:MM y el Excel
```

Las pruebas SQL levantan un Postgres en memoria (PGlite) con lo mínimo de Supabase
(`supabase/tests/entorno_supabase.sql`), aplican las migraciones y simulan la hora con
`prueba.reloj()`. La hora simulada solo la acepta una conexión directa como `postgres`; desde la
API siempre se usa la hora real de Bogotá.

No cubren dos registros simultáneos del mismo colega (PGlite tiene una sola conexión); para eso
el trigger toma un `pg_advisory_xact_lock` por colega antes de sumar las horas.

## Datos personales

Las cédulas son datos personales (Ley 1581 de 2012). Como los empleados no tienen login:

- Desde la API no se pueden leer registros ni colegas; solo registrar, revisar reglas, ver el total
  de horas de la semana de una cédula, anular con la clave que se entregó al registrar y, con la
  clave de administración, ver y anular los registros del mes y bajar su Excel. Un jefe con su
  cuenta solo lee los registros de su línea.
- Los nombres de los jefes activos son públicos para llenar los desplegables; sus correos no.
- Cualquiera con la dirección puede registrar; conviene compartirla solo internamente.
- El archivo descargado se llama `horas-extras-AAAA-MM-DD.xlsx`, sin datos del colega.
