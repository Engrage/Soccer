import { sql } from "drizzle-orm";

import { db } from "@/db";
import { ensureDatabase } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    if (!db) {
      return Response.json({
        ok: true,
        service: "goalseer",
        database: "optional-disabled",
        matches: 0,
        time: new Date().toISOString(),
      });
    }
    await db.execute(sql`select 1`);
    await ensureDatabase();
    const rows = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from matches`,
    );
    const matchCount = Number(rows.rows?.[0]?.count ?? 0);
    return Response.json({
      ok: true,
      service: "goalseer",
      database: "connected",
      matches: matchCount,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
