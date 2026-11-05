import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type ScoreLine = {
  score: string;
  probability: number;
};

export type HtftLine = {
  outcome: string;
  label: string;
  probability: number;
};

export type DoubleChanceLine = {
  outcome: "1X" | "12" | "X2";
  probability: number;
};

export const leagues = pgTable(
  "leagues",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    country: text("country").notNull(),
    countryCode: text("country_code").notNull(),
    flag: text("flag").notNull(),
    tier: integer("tier").notNull().default(1),
    accent: text("accent").notNull().default("#38bdf8"),
    averageGoals: real("average_goals").notNull().default(2.7),
    externalId: text("external_id"),
    standingsSyncedAt: timestamp("standings_synced_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("leagues_slug_key").on(table.slug)],
);

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    leagueId: integer("league_id").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    abbreviation: text("abbreviation").notNull(),
    attack: real("attack").notNull(),
    defense: real("defense").notNull(),
    form: real("form").notNull().default(1),
    elo: real("elo").notNull().default(1500),
    lastFive: text("last_five").notNull().default("-----"),
    externalId: text("external_id"),
    record: text("record"),
  },
  (table) => [
    uniqueIndex("teams_name_league_key").on(table.leagueId, table.name),
    index("teams_league_idx").on(table.leagueId),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    externalKey: text("external_key").notNull(),
    leagueId: integer("league_id").notNull(),
    homeTeamId: integer("home_team_id").notNull(),
    awayTeamId: integer("away_team_id").notNull(),
    kickoff: timestamp("kickoff", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("scheduled"),
    homeGoals: integer("home_goals"),
    awayGoals: integer("away_goals"),
    htHomeGoals: integer("ht_home_goals"),
    htAwayGoals: integer("ht_away_goals"),
    roundName: text("round_name").notNull(),
    venue: text("venue").notNull(),
    source: text("source").notNull().default("demo"),
    broadcast: text("broadcast"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("matches_external_key_key").on(table.externalKey),
    index("matches_kickoff_idx").on(table.kickoff),
    index("matches_league_idx").on(table.leagueId),
  ],
);

export const predictions = pgTable(
  "predictions",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull(),
    expectedHome: real("expected_home").notNull(),
    expectedAway: real("expected_away").notNull(),
    scoreHome: integer("score_home").notNull(),
    scoreAway: integer("score_away").notNull(),
    probHome: real("prob_home").notNull(),
    probDraw: real("prob_draw").notNull(),
    probAway: real("prob_away").notNull(),
    probOver15: real("prob_over15").notNull(),
    probOver25: real("prob_over25").notNull(),
    probOver35: real("prob_over35").notNull(),
    probBtts: real("prob_btts").notNull(),
    probHomeCleanSheet: real("prob_home_clean_sheet").notNull(),
    probAwayCleanSheet: real("prob_away_clean_sheet").notNull(),
    topScores: jsonb("top_scores").$type<ScoreLine[]>().notNull(),
    htft: jsonb("htft").$type<HtftLine[]>().notNull(),
    doubleChance: jsonb("double_chance").$type<DoubleChanceLine[]>().notNull(),
    tip: text("tip").notNull(),
    tipLabel: text("tip_label").notNull(),
    tipProbability: real("tip_probability").notNull(),
    altTip: text("alt_tip").notNull(),
    altTipLabel: text("alt_tip_label").notNull(),
    altTipProbability: real("alt_tip_probability").notNull(),
    confidence: real("confidence").notNull(),
    oddsHome: real("odds_home").notNull(),
    oddsDraw: real("odds_draw").notNull(),
    oddsAway: real("odds_away").notNull(),
    valueEdge: real("value_edge").notNull(),
    hitOutcome: boolean("hit_outcome"),
    hitOver25: boolean("hit_over25"),
    hitBtts: boolean("hit_btts"),
    hitCorrectScore: boolean("hit_correct_score"),
    hitHtft: boolean("hit_htft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("predictions_match_key").on(table.matchId),
    index("predictions_tip_idx").on(table.tip),
  ],
);

export type League = typeof leagues.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
