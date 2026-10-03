"use server";

import { redirect } from "next/navigation";
import { checkAdminPassword, setAdminSession } from "@/lib/admin-session";

export async function adminLoginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");

  if (!checkAdminPassword(password)) {
    redirect("/admin/connexion?erreur=1");
  }

  await setAdminSession();
  redirect("/admin");
}
