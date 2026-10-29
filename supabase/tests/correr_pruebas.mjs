// Corre las pruebas SQL en PGlite (Postgres en Node), sin Docker ni Supabase.
// Cada archivo arranca con una base nueva: entorno mínimo de Supabase, migraciones y seed.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..');
const leer = (...partes) => readFileSync(join(raiz, ...partes), 'utf8');
const migraciones = readdirSync(join(raiz, 'migrations')).filter((a) => a.endsWith('.sql')).sort();
const archivos = readdirSync(join(raiz, 'tests')).filter((a) => /^\d+_.*\.sql$/.test(a)).sort();

let fallidas = 0;
let total = 0;

for (const archivo of archivos) {
  const db = new PGlite();
  await db.exec(leer('tests', 'entorno_supabase.sql'));
  for (const m of migraciones) await db.exec(leer('migrations', m));
  await db.exec(leer('seed.sql'));
  await db.exec(leer('tests', 'ayudas.sql'));

  console.log(`\n${archivo}`);
  try {
    await db.exec(leer('tests', archivo));
  } catch (error) {
    console.log(`  FALLA el archivo no terminó de correr: ${error.message}`);
    total++;
    fallidas++;
  }
  await db.exec('reset role');
  const { rows } = await db.query('select nombre, ok, detalle from prueba.resultados order by n');
  for (const r of rows) {
    total++;
    if (!r.ok) fallidas++;
    console.log(`  ${r.ok ? 'PASA ' : 'FALLA'} ${r.nombre}${r.ok ? '' : `\n         ${r.detalle}`}`);
  }
  await db.close();
}

console.log(`\n${total - fallidas} de ${total} pruebas pasan.`);
process.exitCode = fallidas ? 1 : 0;
