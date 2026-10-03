"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-session";
import { canCreateElections } from "@/lib/core/authorization";
import { appendAuditEvent } from "@/lib/core/audit";
import { isSupabaseConfigured, getServiceRoleClient } from "@/lib/db/supabase-server";
import { getRuntimeDeps } from "@/lib/runtime";
import * as demo from "@/lib/demo/store";

const createElectionSchema = z.object({
  electionTypeId: z.string().min(1),
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional().default(""),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
});

export async function createElectionAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  if (!canCreateElections(session.roles)) {
    redirect("/admin?erreur=forbidden");
  }

  const parsed = createElectionSchema.safeParse({
    electionTypeId: formData.get("electionTypeId"),
    name: formData.get("name"),
    description: formData.get("description"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });

  if (!parsed.success) {
    redirect("/admin/elections/nouveau?erreur=1");
  }

  const { electionTypeId, name, description, startsAt, endsAt } = parsed.data;
  const startsAtDate = new Date(startsAt);
  const endsAtDate = new Date(endsAt);

  if (endsAtDate <= startsAtDate) {
    redirect("/admin/elections/nouveau?erreur=dates");
  }

  let electionId: string;

  if (!isSupabaseConfigured()) {
    const election = demo.createElection({
      electionTypeId,
      name,
      description,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
    });
    electionId = election.id;
  } else {
    const client = getServiceRoleClient();
    const { data, error } = await client
      .from("elections")
      .insert({
        election_type_id: electionTypeId,
        name,
        description,
        starts_at: startsAtDate.toISOString(),
        ends_at: endsAtDate.toISOString(),
        status: "draft",
        created_by: session.accountId,
      })
      .select("id")
      .single();

    if (error) throw error;
    electionId = data.id;

    // Simplification de prototype : rend tous les electeurs de
    // demonstration eligibles au nouveau scrutin (doc 05 §2).
    const { data: voters, error: votersError } = await client.from("demo_voters").select("id");
    if (votersError) throw votersError;
    if (voters && voters.length > 0) {
      const { error: eligibilityError } = await client.from("voter_eligibility").insert(
        voters.map((v) => ({ demo_voter_id: v.id, election_id: electionId, is_eligible: true }))
      );
      if (eligibilityError) throw eligibilityError;
    }
  }

  await appendAuditEvent(
    {
      actorUserId: session.accountId,
      actionCode: "election.created",
      targetType: "election",
      targetId: electionId,
      metadata: { name },
    },
    getRuntimeDeps()
  );

  redirect(`/admin/elections/${electionId}`);
}
