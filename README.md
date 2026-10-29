# Horas Extras

Página web para diligenciar las horas extras de los colegas y descargar el formato en Excel que
se adjunta al ticket de Services Central. Reemplaza el Excel llenado a mano: la base de datos no
deja guardar un registro que incumpla las reglas, ni siquiera llamando a la API directamente.

No tiene login: quien abre la página llena el formulario, guarda y descarga el Excel. La
aprobación de jefe inmediato, VP y RRHH se sigue haciendo por fuera, en el ticket; el Excel lleva
al pie la política y las líneas de firma.

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
| Filial: Banco, Sufi, Leasing o Empleados | `HE_FILIAL` |

Los topes cuentan todo lo registrado para el colega, desde cualquier equipo. Los registros no se
editan ni se borran: se anulan con un motivo y las horas anuladas dejan de contar.

## Cómo se usa

1. Se diligencian los datos del colega y las horas; los errores salen junto a cada campo y el
   botón Guardar no se activa mientras haya alguno.
2. Cada registro guardado aparece en la lista "Registrado en esta ventana".
3. "Descargar Excel" arma el formato con esa lista.
4. "Descarga consolidada": con la clave de descarga, cualquiera que la conozca (por ejemplo RRHH)
   baja el Excel con todo lo registrado en un mes, por todas las personas. Tras 10 claves
   equivocadas en 15 minutos desde la misma conexión, se bloquea por 15 minutos.

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

## Administración (panel de Supabase)

Desde la página no se puede leer nada de lo guardado. En el panel de Supabase:

- **Definir o cambiar la clave de la descarga consolidada** (SQL Editor; mínimo 12 caracteres).
  Mientras no se defina, la descarga consolidada no funciona. Solo se guarda su hash:

  ```sql
  select privado.cambiar_clave_descarga('la-clave-que-se-comparte-con-rrhh');
  ```
- **Table Editor → registros**: consultar lo registrado.
- **Table Editor → festivos / configuracion**: agregar festivos o cambiar topes y fin de jornada.
- **Anular un registro** (SQL Editor). Los registros no se borran ni se editan, ni siquiera desde
  el panel; se anulan con:

  ```sql
  select privado.anular_registro_admin('HE-00001', 'Motivo de la anulación');
  ```

## Pruebas

```bash
npm install          # en la raíz, una sola vez
npm run test:sql     # reglas y permisos en la base (95 pruebas)

cd web
npm test             # minutos, tipo de día, formato H:MM y el Excel (32 pruebas)
```

Las pruebas SQL levantan un Postgres en memoria (PGlite) con lo mínimo de Supabase
(`supabase/tests/entorno_supabase.sql`), aplican las migraciones y simulan la hora con
`prueba.reloj()`. La hora simulada solo la acepta una conexión directa como `postgres`; desde la
API siempre se usa la hora real de Bogotá.

No cubren dos registros simultáneos del mismo colega (PGlite tiene una sola conexión); para eso
el trigger toma un `pg_advisory_xact_lock` por colega antes de sumar las horas.

## Datos personales

Las cédulas son datos personales (Ley 1581 de 2012). Como la página no tiene login:

- Desde la API no se pueden leer registros ni colegas; solo registrar, revisar reglas, ver el total
  de horas de la semana de una cédula, anular con la clave que se entregó al registrar y, con la
  clave de descarga, bajar el consolidado del mes.
- Cualquiera con la dirección puede registrar; conviene compartirla solo internamente.
- El archivo descargado se llama `horas-extras-AAAA-MM-DD.xlsx`, sin datos del colega.
