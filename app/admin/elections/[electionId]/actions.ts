"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-session";
import { isSupabaseConfigured, getServiceRoleClient } from "@/lib/db/supabase-server";
import * as demo from "@/lib/demo/store";

const statusSchema = z.object({
  electionId: z.string().min(1),
  newStatus: z.enum(["draft", "open", "closed"]),
});

export async function changeElectionStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = statusSchema.safeParse({
    electionId: formData.get("electionId"),
    newStatus: formData.get("newStatus"),
  });
  if (!parsed.success) redirect("/admin");

  const { electionId, newStatus } = parsed.data;

  if (!isSupabaseConfigured()) {
    demo.updateElectionStatus(electionId, newStatus);
  } else {
    const client = getServiceRoleClient();
    const { error } = await client.from("elections").update({ status: newStatus }).eq("id", electionId);
    if (error) throw error;
  }

  redirect(`/admin/elections/${electionId}`);
}

const candidateSchema = z.object({
  electionId: z.string().min(1),
  displayName: z.string().trim().min(1).max(200),
  partyName: z.string().trim().max(200).optional().default(""),
});

export async function addCandidateAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = candidateSchema.safeParse({
    electionId: formData.get("electionId"),
    displayName: formData.get("displayName"),
    partyName: formData.get("partyName"),
  });
  if (!parsed.success) redirect("/admin");

  const { electionId, displayName, partyName } = parsed.data;

  if (!isSupabaseConfigured()) {
    demo.addCandidate(electionId, { displayName, partyName: partyName || null });
  } else {
    const client = getServiceRoleClient();
    const { data: existing, error: existingError } = await client
      .from("candidates")
      .select("ballot_order")
      .eq("election_id", electionId)
      .order("ballot_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    const nextOrder = (existing?.ballot_order ?? 0) + 1;
    const { error } = await client.from("candidates").insert({
      election_id: electionId,
      display_name: displayName,
      party_name: partyName || null,
      ballot_order: nextOrder,
      validation_status: "validated",
    });
    if (error) throw error;
  }

  redirect(`/admin/elections/${electionId}`);
}
