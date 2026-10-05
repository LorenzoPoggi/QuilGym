import { getGoogleReviews } from "@/lib/google-reviews";
export async function GET() {
  return Response.json(await getGoogleReviews(), { headers: { "Cache-Control": "no-store" } });
}
