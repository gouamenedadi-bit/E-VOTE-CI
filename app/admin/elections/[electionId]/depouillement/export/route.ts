import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { canRunTally } from "@/lib/core/authorization";
import { buildResultsCsv } from "@/lib/export";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ electionId: string }> }
) {
  const session = await requireAdminSession();
  const { electionId } = await params;

  if (!canRunTally(session.roles, electionId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const csv = await buildResultsCsv(electionId);
  if (!csv) {
    return NextResponse.json({ error: "not_tallied" }, { status: 404 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pv-${electionId}.csv"`,
    },
  });
}
