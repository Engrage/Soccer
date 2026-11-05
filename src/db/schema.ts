import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  externalId: text("external_id"),
  leagueSlug: text("league_slug").notNull(),
  kickoff: timestamp("kickoff", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("scheduled"),
  homeName: text("home_name").notNull(),
  awayName: text("away_name").notNull(),
  homeGoals: integer("home_goals"),
  awayGoals: integer("away_goals"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
});
