import { sql } from "drizzle-orm";

import { db } from "@/db";
import { ensureDatabase } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    await ensureDatabase();
    const rows = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from matches`,
    );
    const matchCount = Number(rows.rows?.[0]?.count ?? 0);
    return Response.json({
      ok: true,
      service: "goalseer",
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
