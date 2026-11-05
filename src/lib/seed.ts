import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * The public boards run from the ESPN feed with a deterministic simulation
 * fallback, so a database is optional. When DATABASE_URL is present we keep a
 * lightweight matches table available for health checks / future persistence.
 */
export async function ensureDatabase(): Promise<void> {
  if (!db) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      external_id TEXT,
      league_slug TEXT NOT NULL,
      kickoff TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      home_name TEXT NOT NULL,
      away_name TEXT NOT NULL,
      home_goals INTEGER,
      away_goals INTEGER,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
