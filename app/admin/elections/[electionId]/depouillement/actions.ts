"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";
import { getRuntimeDeps } from "@/lib/runtime";
import { runTally } from "@/lib/core/tally";
import { publishResults } from "@/lib/core/publication";

export async function runTallyAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const electionId = String(formData.get("electionId") ?? "");
  if (!electionId) redirect("/admin");

  await runTally(electionId, getRuntimeDeps());

  redirect(`/admin/elections/${electionId}/depouillement`);
}

export async function publishResultsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const electionId = String(formData.get("electionId") ?? "");
  if (!electionId) redirect("/admin");

  await publishResults(electionId, getRuntimeDeps());

  redirect(`/admin/elections/${electionId}/depouillement`);
}
