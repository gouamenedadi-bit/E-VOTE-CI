"use server";

import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canRunTally } from "@/lib/core/authorization";
import { getRuntimeDeps } from "@/lib/runtime";
import { runTally } from "@/lib/core/tally";
import { publishResults, verifyResults } from "@/lib/core/publication";

export async function runTallyAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const electionId = String(formData.get("electionId") ?? "");
  if (!electionId) redirect("/admin");
  if (!canRunTally(session.roles, electionId)) {
    redirect("/admin?erreur=forbidden");
  }

  await runTally(electionId, getRuntimeDeps());

  redirect(`/admin/elections/${electionId}/depouillement`);
}

export async function verifyResultsAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const electionId = String(formData.get("electionId") ?? "");
  if (!electionId) redirect("/admin");
  if (!canRunTally(session.roles, electionId)) {
    redirect("/admin?erreur=forbidden");
  }

  await verifyResults(electionId, session.accountId, getRuntimeDeps());

  redirect(`/admin/elections/${electionId}/depouillement`);
}

export async function publishResultsAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const electionId = String(formData.get("electionId") ?? "");
  if (!electionId) redirect("/admin");
  if (!canRunTally(session.roles, electionId)) {
    redirect("/admin?erreur=forbidden");
  }

  await publishResults(electionId, session.accountId, getRuntimeDeps());

  redirect(`/admin/elections/${electionId}/depouillement`);
}
