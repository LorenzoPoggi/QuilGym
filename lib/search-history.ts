import "server-only";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { db } from "./db";
import { searchHistory } from "./db/schema";
import { normalizeText } from "./slugify";

const MAX_HISTORY = 30;

export function cleanSearchQuery(value: unknown) {
  if (typeof value !== "string") return null;
  const query = value.trim().replace(/\s+/g, " ");
  return query.length >= 2 && query.length <= 80 ? query : null;
}

export async function listSearchHistory(userId: string) {
  return db.select({ id: searchHistory.id, query: searchHistory.query, createdAt: searchHistory.createdAt })
    .from(searchHistory).where(eq(searchHistory.userId, userId))
    .orderBy(desc(searchHistory.createdAt), desc(searchHistory.id)).limit(MAX_HISTORY);
}

export async function rememberSearch(userId: string, value: unknown) {
  const query = cleanSearchQuery(value);
  if (!query) return false;
  const normalizedQuery = normalizeText(query);
  await db.insert(searchHistory).values({ userId, query, normalizedQuery })
    .onConflictDoUpdate({ target: [searchHistory.userId, searchHistory.normalizedQuery], set: { query, createdAt: new Date() } });
  const recent = await listSearchHistory(userId);
  await db.delete(searchHistory).where(and(eq(searchHistory.userId, userId), notInArray(searchHistory.id, recent.map((item) => item.id))));
  return true;
}

export async function forgetSearch(userId: string, id: number) {
  await db.delete(searchHistory).where(and(eq(searchHistory.userId, userId), eq(searchHistory.id, id)));
}
