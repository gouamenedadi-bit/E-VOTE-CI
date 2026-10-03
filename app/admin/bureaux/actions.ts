"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageElection, canManagePollingStations } from "@/lib/core/authorization";
import { appendAuditEvent } from "@/lib/core/audit";
import { isSupabaseConfigured, getServiceRoleClient } from "@/lib/db/supabase-server";
import { getRuntimeDeps } from "@/lib/runtime";
import * as demo from "@/lib/demo/store";

const createStationSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(200),
  communeName: z.string().trim().min(2).max(200),
});

export async function createPollingStationAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  if (!canManagePollingStations(session.roles)) {
    redirect("/admin?erreur=forbidden");
  }

  const parsed = createStationSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    communeName: formData.get("communeName"),
  });
  if (!parsed.success) redirect("/admin/bureaux?erreur=1");

  const { code, name, communeName } = parsed.data;
  let stationId: string | null = null;

  if (!isSupabaseConfigured()) {
    const result = demo.createPollingStation({ code, name, communeName });
    if (!result.ok) redirect("/admin/bureaux?erreur=code");
    stationId = result.station.id;
  } else {
    const client = getServiceRoleClient();
    const { data, error } = await client
      .from("polling_stations")
      .insert({ code, name, commune_name: communeName, is_active: true })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") redirect("/admin/bureaux?erreur=code");
      throw error;
    }
    stationId = data.id;
  }

  await appendAuditEvent(
    {
      actorUserId: session.accountId,
      actionCode: "polling_station.created",
      targetType: "polling_station",
      targetId: stationId,
      metadata: { code },
    },
    getRuntimeDeps()
  );

  redirect("/admin/bureaux");
}

const attachSchema = z.object({
  electionId: z.string().min(1),
  pollingStationId: z.string().min(1),
});

export async function attachPollingStationAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();

  const parsed = attachSchema.safeParse({
    electionId: formData.get("electionId"),
    pollingStationId: formData.get("pollingStationId"),
  });
  if (!parsed.success) redirect("/admin");

  const { electionId, pollingStationId } = parsed.data;

  if (!canManageElection(session.roles, electionId)) {
    redirect("/admin?erreur=forbidden");
  }

  if (!isSupabaseConfigured()) {
    demo.attachPollingStationToElection(electionId, pollingStationId);
  } else {
    const client = getServiceRoleClient();
    const { error } = await client
      .from("election_polling_stations")
      .insert({ election_id: electionId, polling_station_id: pollingStationId });
    if (error && error.code !== "23505") throw error;
  }

  await appendAuditEvent(
    {
      actorUserId: session.accountId,
      actionCode: "polling_station.attached",
      targetType: "election",
      targetId: electionId,
      metadata: { pollingStationId },
    },
    getRuntimeDeps()
  );

  redirect(`/admin/elections/${electionId}`);
}
