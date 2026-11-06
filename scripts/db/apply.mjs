#!/usr/bin/env node
/**
 * Apply SQL migrations (and optionally the synthetic seed) to a hosted Supabase
 * project through the Supabase Management API.
 *
 *   SUPABASE_ACCESS_TOKEN=<personal access token> \
 *   SUPABASE_PROJECT_REF=<project ref> \
 *   node scripts/db/apply.mjs [--seed] [--only-seed]
 *
 * Migrations already recorded in supabase_migrations.schema_migrations are
 * skipped, so the history stays compatible with `supabase db push`.
 * The access token is only ever sent to api.supabase.com.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const args = new Set(process.argv.slice(2));

if (!ref || !token) {
  console.error('Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN first.');
  process.exit(1);
}

async function runSql(query, label) {
  const started = Date.now();
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label} failed (HTTP ${res.status}): ${text.slice(0, 2000)}`);
  }
  console.log(`  ✓ ${label} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const sqlLiteral = (s) => `'${s.replaceAll("'", "''")}'`;

async function applyMigrations() {
  await runSql(
    `create schema if not exists supabase_migrations;
     create table if not exists supabase_migrations.schema_migrations (
       version text primary key, statements text[], name text);`,
    'ensure migration history table',
  );
  const applied = new Set(
    (await runSql('select version from supabase_migrations.schema_migrations', 'read history')).map((r) => r.version),
  );
  const dir = join(root, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
    if (applied.has(version)) {
      console.log(`  • ${file} already applied`);
      continue;
    }
    const sql = readFileSync(join(dir, file), 'utf8');
    // Run the migration and record it atomically.
    await runSql(
      `begin;\n${sql}\n;insert into supabase_migrations.schema_migrations (version, name, statements)
       values (${sqlLiteral(version)}, ${sqlLiteral(rest.join('_'))}, array[]::text[]);\ncommit;`,
      `migration ${file}`,
    );
  }
}

async function applySeed() {
  const dir = join(root, 'supabase', 'seed');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    // "-- @@split" separates statements that are sent as separate requests so
    // that no single Management API call runs into the gateway timeout.
    // (psql / `supabase db reset` simply treat the marker as a comment.)
    const chunks = readFileSync(join(dir, file), 'utf8')
      .split(/^--\s*@@split.*$/m)
      .map((c) => c.trim())
      .filter((c) => c.replace(/--.*$/gm, '').trim().length > 0);
    for (const [i, chunk] of chunks.entries()) {
      await runSql(chunk, chunks.length > 1 ? `seed ${file} [${i + 1}/${chunks.length}]` : `seed ${file}`);
    }
  }
}

try {
  if (!args.has('--only-seed')) {
    console.log('Applying migrations…');
    await applyMigrations();
  }
  if (args.has('--seed') || args.has('--only-seed')) {
    console.log('Loading synthetic seed data…');
    await applySeed();
  }
  console.log('Done.');
} catch (err) {
  console.error(String(err.message ?? err));
  process.exit(1);
}
