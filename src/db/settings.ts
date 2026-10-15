import { eq } from "drizzle-orm";
import type { Db } from "./index";
import { settings, type Settings } from "./schema";

/** The single settings row (id = 1), created with defaults on first access. */
export async function ensureSettings(db: Db): Promise<Settings> {
  const existing = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db.insert(settings).values({ id: 1 }).onConflictDoNothing().returning();
  if (inserted[0]) return inserted[0];
  const again = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return again[0];
}
