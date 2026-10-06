import "server-only";
import { redirect } from "next/navigation";
import { currentUser } from "./auth";

export async function requireAccountUser() {
  const user = await currentUser();
  if (!user) redirect("/cuenta/ingresar");
  return user;
}
