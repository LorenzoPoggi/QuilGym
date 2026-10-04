import { timingSafeEqual } from "node:crypto";

/** Vercel Cron envía `Authorization: Bearer <CRON_SECRET>`. Sin secreto, ningún cron queda habilitado. */
export function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
