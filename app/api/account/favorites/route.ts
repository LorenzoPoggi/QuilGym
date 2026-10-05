import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { favorites } from "@/lib/db/schema";
export async function GET() {
  const user = await currentUser();
  const ids = user ? (await db.select({ id: favorites.productId }).from(favorites).where(eq(favorites.userId, user.id))).map((p) => p.id) : [];
  return Response.json({ ids }, { headers: { "Cache-Control": "private, no-store" } });
}
