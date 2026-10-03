import { NextResponse } from "next/server";
import { getTallySummary } from "@/lib/queries";
import { buildResultsCsv } from "@/lib/export";

/**
 * Export public du proces-verbal — uniquement si les resultats sont
 * publies (doc 01 §4.4 : "Proces-verbaux publiables"). Jamais de donnee
 * avant publication, meme via cette route directe.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ electionId: string }> }
) {
  const { electionId } = await params;

  const summary = await getTallySummary(electionId);
  if (summary.publication?.status !== "published") {
    return NextResponse.json({ error: "not_published" }, { status: 404 });
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
