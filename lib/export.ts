import "server-only";
import { getElection, getTallySummary } from "./queries";

function csvEscape(value: string): string {
  if (/[";\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export CSV du proces-verbal de depouillement (doc 01 §4.4 : "Proces-
 * verbaux numeriques, export PDF/CSV, archivage"). Export PDF non
 * implemente dans ce prototype — le CSV couvre le meme besoin de
 * reconciliation externe et est directement exploitable dans un tableur.
 */
export async function buildResultsCsv(electionId: string): Promise<string | null> {
  const [election, summary] = await Promise.all([getElection(electionId), getTallySummary(electionId)]);
  if (!election || !summary.hasTally) return null;

  const lines: string[] = [];
  lines.push("Scrutin;Statut;Candidat;Type de bulletin;Voix");
  for (const record of summary.records) {
    lines.push(
      [election.name, summary.consistent ? "DEFINITIF" : "PROVISOIRE", record.candidateName, record.ballotType, String(record.voteCount)]
        .map(csvEscape)
        .join(";")
    );
  }

  lines.push("");
  lines.push("Bureau;Participations;Bulletins;Coherent");
  for (const station of summary.stations) {
    lines.push(
      [station.pollingStationLabel, String(station.participationCount), String(station.ballotCount), station.consistent ? "OUI" : "NON"]
        .map(csvEscape)
        .join(";")
    );
  }

  return lines.join("\r\n");
}
