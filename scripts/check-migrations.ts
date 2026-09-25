import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
export async function testDatabase() {
  const db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;",
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  return db;
}
if (process.argv[1]?.endsWith("check-migrations.ts")) {
  const db = await testDatabase();
  const result = await db.query<{ tablename: string; rowsecurity: boolean }>(
    "select tablename,rowsecurity from pg_tables where schemaname in ('public','private')",
  );
  assert(result.rows.length >= 10);
  assert(result.rows.every((r) => r.rowsecurity));
  console.log(
    "Migration executed successfully in local PostgreSQL (PGlite); RLS enabled on all " +
      result.rows.length +
      " application tables.",
  );
  await db.close();
}
