/** Identidades autorizadas para administrar la tienda. */
export const ADMIN_EMAILS = [
  "quilgym@gmail.com",
  "lorenzo.poggijanin@gmail.com",
] as const;

export function isAdminEmail(email: string) {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase() as (typeof ADMIN_EMAILS)[number]);
}
