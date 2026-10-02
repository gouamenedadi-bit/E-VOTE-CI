"use server";

import { redirect } from "next/navigation";
import { clearVoterSession } from "@/lib/session";

export async function logoutAction(): Promise<void> {
  await clearVoterSession();
  redirect("/");
}
