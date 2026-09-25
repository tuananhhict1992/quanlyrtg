import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pool, transaction } from "../backend/db";
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL on the server before migration.");
try {
  await transaction(async (db) => {
    await db.query("select pg_advisory_xact_lock(726446)");
    await db.query("create schema if not exists private");
    await db.query(
      "create table if not exists private.schema_migrations(name text primary key,checksum text not null,applied_at timestamptz not null default now())",
    );
    await db.query(
      "alter table private.schema_migrations enable row level security",
    );
    await db.query(
      "revoke all on private.schema_migrations from public,anon,authenticated",
    );
    for (const name of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const sql = await readFile("supabase/migrations/" + name, "utf8"),
        hash = createHash("sha256").update(sql).digest("hex");
      const old = (
        await db.query(
          "select checksum from private.schema_migrations where name=$1",
          [name],
        )
      ).rows[0];
      if (old) {
        if (old.checksum !== hash)
          throw new Error("Previously applied migration changed: " + name);
        continue;
      }
      await db.query(sql);
      await db.query(
        "insert into private.schema_migrations(name,checksum) values($1,$2)",
        [name, hash],
      );
      console.log("Applied " + name);
    }
  });
} finally {
  await pool.end();
}
