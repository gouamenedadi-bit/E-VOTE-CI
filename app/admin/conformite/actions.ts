"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageElection, isSuperAdmin } from "@/lib/core/authorization";
import { appendAuditEvent } from "@/lib/core/audit";
import { getRuntimeDeps } from "@/lib/runtime";
import { listIncidents, updateIncidentStatus } from "@/lib/queries";

const schema = z.object({
  incidentId: z.string().min(1),
  status: z.enum(["open", "investigating", "resolved"]),
});

/**
 * Transition de statut d'un incident (doc 06 §6 : detection -> qualification
 * -> confinement -> communication -> resolution tracee). Reserve au super
 * administrateur, ou a l'administrateur electoral attribue au scrutin
 * concerne par l'incident (doc 04).
 */
export async function updateIncidentStatusAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();

  const parsed = schema.safeParse({
    incidentId: formData.get("incidentId"),
    status: formData.get("status"),
  });
  if (!parsed.success) redirect("/admin/conformite");

  const { incidentId, status } = parsed.data;

  const incidents = await listIncidents();
  const incident = incidents.find((i) => i.id === incidentId);
  if (!incident) redirect("/admin/conformite");

  const authorized = isSuperAdmin(session.roles) || (incident.electionId && canManageElection(session.roles, incident.electionId));
  if (!authorized) {
    redirect("/admin?erreur=forbidden");
  }

  await updateIncidentStatus(incidentId, status);

  await appendAuditEvent(
    {
      actorUserId: session.accountId,
      actionCode: "incident.status_changed",
      targetType: "incident",
      targetId: incidentId,
      metadata: { newStatus: status },
    },
    getRuntimeDeps()
  );

  redirect("/admin/conformite");
}
