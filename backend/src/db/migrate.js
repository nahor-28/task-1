import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
const { rows: applied } = await client.query('SELECT name FROM schema_migrations');
const appliedNames = new Set(applied.map((r) => r.name));

for (const file of files) {
  if (appliedNames.has(file)) continue;

  const sql = await readFile(join(migrationsDir, file), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`Applied: ${file}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Failed: ${file}`);
    throw err;
  }
}

await client.end();
console.log('Migrations up to date.');
