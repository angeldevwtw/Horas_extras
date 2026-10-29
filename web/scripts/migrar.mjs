// Aplica en Supabase las migraciones de supabase/migrations que falten. Corre en Vercel antes
// de compilar ("vercel-build"), con la conexión que deja la integración de Supabase.
// Anota cada una en supabase_migrations.schema_migrations, la misma tabla de la CLI, así que
// `npx supabase db push` sigue funcionando y no repite nada.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.SUPABASE_DB_URL;
if (!url) {
  if (process.env.VERCEL) {
    console.error('Falta POSTGRES_URL_NON_POOLING (la crea la integración de Supabase en Vercel).');
    process.exit(1);
  }
  console.log('Sin conexión a la base configurada: no se aplican migraciones.');
  process.exit(0);
}

const carpeta = join(import.meta.dirname, '..', '..', 'supabase', 'migrations');
const migraciones = readdirSync(carpeta).filter((a) => /^\d+_.+\.sql$/.test(a)).sort();

// El certificado de Supabase no viene en los CA de Node; la conexión sigue cifrada.
const conexion = new URL(url);
const sinSsl = conexion.searchParams.get('sslmode') === 'disable';
conexion.searchParams.delete('sslmode');
const cliente = new pg.Client({
  connectionString: conexion.toString(),
  ssl: sinSsl ? false : { rejectUnauthorized: false },
});

await cliente.connect();
try {
  await cliente.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );
    alter table supabase_migrations.schema_migrations
      add column if not exists statements text[], add column if not exists name text;
  `);
  // Dos despliegues a la vez no deben aplicar la misma migración.
  await cliente.query("select pg_advisory_lock(hashtext('horas_extras:migraciones'))");

  const { rows } = await cliente.query('select version from supabase_migrations.schema_migrations');
  const aplicadas = new Set(rows.map((r) => r.version));
  const pendientes = migraciones.filter((a) => !aplicadas.has(a.split('_')[0]));

  for (const archivo of pendientes) {
    const [version, ...resto] = archivo.replace(/\.sql$/, '').split('_');
    const sql = readFileSync(join(carpeta, archivo), 'utf8');
    await cliente.query('begin');
    try {
      await cliente.query(sql);
      await cliente.query(
        'insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)',
        [version, [sql], resto.join('_')],
      );
      await cliente.query('commit');
      console.log(`Migración aplicada: ${archivo}`);
    } catch (error) {
      await cliente.query('rollback');
      console.error(`Falló la migración ${archivo}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }
  if (!pendientes.length) console.log('La base ya tiene todas las migraciones.');
  // Para que la API de Supabase vea las tablas nuevas sin esperar.
  if (pendientes.length && !process.exitCode) await cliente.query("notify pgrst, 'reload schema'");
} finally {
  await cliente.end();
}
