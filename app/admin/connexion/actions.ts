"use server";

import { redirect } from "next/navigation";
import { authenticateAdmin, setAdminSession } from "@/lib/admin-session";

export async function adminLoginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const mfaToken = String(formData.get("mfaToken") ?? "");

  const result = await authenticateAdmin(email, password, mfaToken);

  if (!result.ok) {
    redirect(`/admin/connexion?erreur=${result.reason}`);
  }

  await setAdminSession(result.accountId);
  redirect("/admin");
}
