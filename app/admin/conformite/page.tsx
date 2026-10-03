import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin-session";
import { canManageElection, canViewAudit, isSuperAdmin } from "@/lib/core/authorization";
import { getAuditChainStatus, getRoleAccountCounts, listIncidents } from "@/lib/queries";
import { updateIncidentStatusAction } from "./actions";
import packageJson from "../../../package.json";

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  open: "Ouvert",
  investigating: "En cours d'investigation",
  resolved: "Résolu",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrateur",
  election_admin: "Administrateur électoral",
  station_agent: "Agent de bureau",
  observer: "Observateur",
};

const DATA_INVENTORY = [
  {
    table: "demo_voters / voter_eligibility",
    content: "Numéro d'électeur fictif, nom de démonstration, éligibilité par scrutin.",
    purpose: "Vérifier l'éligibilité à un scrutin de simulation.",
    retention: "Durée de vie du prototype local — données entièrement fictives (doc 01 §6).",
  },
  {
    table: "voting_credentials",
    content: "Hash du jeton de vote, statut, horodatages.",
    purpose: "Empêcher le double vote, séparer identité et bulletin.",
    retention: "Jusqu'à expiration/consommation du jeton ; jamais relié au bulletin (doc 02 §3).",
  },
  {
    table: "encrypted_ballots",
    content: "Bulletin chiffré (AES-256-GCM), empreinte d'intégrité.",
    purpose: "Décompte des résultats.",
    retention: "Jusqu'au dépouillement puis archivage chiffré ; aucune colonne d'identité (doc 03 §5).",
  },
  {
    table: "audit_events",
    content: "Acteur, action, cible, horodatage — jamais de choix électoral.",
    purpose: "Traçabilité des actions administratives.",
    retention: "Conservation continue, append-only, chaînée (doc 06 §3).",
  },
  {
    table: "users / user_roles",
    content: "Identité et rôle des comptes administratifs.",
    purpose: "Contrôle d'accès par rôle et par périmètre.",
    retention: "Durée de vie du compte administratif.",
  },
];

export default async function CompliancePage() {
  const session = await requireAdminSession();
  if (!canViewAudit(session.roles)) {
    redirect("/admin?erreur=forbidden");
  }

  const [incidents, chainStatus, roleCounts] = await Promise.all([
    listIncidents(),
    getAuditChainStatus(),
    getRoleAccountCounts(),
  ]);
  const openIncidents = incidents.filter((i) => i.status === "open");

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-8">
      <Link href="/admin" className="text-ci-green font-semibold hover:underline w-fit">
        ← Administration
      </Link>

      <div className="flex flex-col gap-2">
        <div className="ci-flag-rule" />
        <h1 className="text-2xl font-bold text-ci-ink">Conformité &amp; sécurité</h1>
        <p className="text-sm text-ci-gray mt-1">
          Préparation à l&apos;homologation (doc 01 §16). Ce centre documente l&apos;état réel du
          prototype — il ne prétend jamais qu&apos;un contrôle existe quand il n&apos;a pas encore été
          implémenté.
        </p>
      </div>

      <section>
        <h2 className="font-semibold text-ci-ink mb-3 text-lg">Inventaire des données et finalités</h2>
        <div className="flex flex-col gap-2">
          {DATA_INVENTORY.map((row) => (
            <div key={row.table} className="ci-card">
              <p className="font-mono text-sm text-ci-ink">{row.table}</p>
              <p className="text-sm text-ci-gray mt-1">
                <strong>Contenu :</strong> {row.content}
              </p>
              <p className="text-sm text-ci-gray">
                <strong>Finalité :</strong> {row.purpose}
              </p>
              <p className="text-sm text-ci-gray">
                <strong>Conservation :</strong> {row.retention}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-ci-ink mb-3 text-lg">Contrôle des accès</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(ROLE_LABELS).map(([code, label]) => (
            <div key={code} className="ci-card text-center">
              <p className="text-xl font-bold text-ci-ink">{roleCounts[code] ?? 0}</p>
              <p className="text-xs text-ci-gray">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-ci-gray mt-2">
          Chaque action administrative est vérifiée par rôle et par périmètre d&apos;attribution
          (<code>lib/core/authorization.ts</code>), en plus des politiques RLS Supabase — défense en
          profondeur (doc 04 §3).
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-ci-ink mb-3 text-lg">Audit et gestion des incidents</h2>
        <div
          className="rounded-xl p-4 border"
          style={{
            borderColor: chainStatus.consistent ? "rgba(0,132,61,0.3)" : "#fca5a5",
            background: chainStatus.consistent ? "rgba(0,132,61,0.06)" : "#fef2f2",
          }}
        >
          <p className="font-semibold text-ci-ink">
            {chainStatus.consistent
              ? `✓ Journal d'audit intact (${chainStatus.checkedCount} événement(s) vérifié(s))`
              : "⚠ Altération détectée dans le journal d'audit"}
          </p>
        </div>
        <p className="text-sm text-ci-gray mt-2">
          {openIncidents.length > 0
            ? `${openIncidents.length} incident(s) ouvert(s) — écarts de réconciliation détectés au dépouillement, jamais corrigés silencieusement (doc 01 §4.4).`
            : "Aucun incident ouvert."}
        </p>
        <Link href="/admin/audit" className="text-ci-green font-semibold text-sm hover:underline">
          Voir le journal d&apos;audit détaillé →
        </Link>
        <p className="text-sm text-ci-gray mt-3">
          <strong>Procédure :</strong> détection (réconciliation automatique ou vérification de
          chaîne) → qualification dans <code>incident_reports</code> → confinement → communication →
          résolution tracée → retour d&apos;expérience (doc 06 §6).
        </p>

        {incidents.length > 0 && (
          <ul className="flex flex-col gap-2 mt-4">
            {incidents.map((incident) => {
              const canResolve =
                isSuperAdmin(session.roles) ||
                (incident.electionId && canManageElection(session.roles, incident.electionId));
              return (
                <li key={incident.id} className="ci-card">
                  <p className="text-sm text-ci-ink">{incident.description}</p>
                  <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                    <span className="text-xs text-ci-gray">
                      {INCIDENT_STATUS_LABELS[incident.status]} ·{" "}
                      {incident.openedAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    {canResolve && incident.status !== "resolved" && (
                      <form action={updateIncidentStatusAction} className="flex items-center gap-2">
                        <input type="hidden" name="incidentId" value={incident.id} />
                        <select
                          name="status"
                          defaultValue={incident.status === "open" ? "investigating" : "resolved"}
                          className="text-sm rounded-lg border border-gray-300 px-2 py-1.5"
                        >
                          <option value="investigating">En cours d&apos;investigation</option>
                          <option value="resolved">Résolu</option>
                        </select>
                        <button type="submit" className="ci-btn-outline text-sm px-3 py-1.5 min-h-0">
                          Mettre à jour
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-ci-ink mb-3 text-lg">Évaluation des risques</h2>
        <p className="text-sm text-ci-gray">
          Le modèle de menaces complet (16 scénarios, de l&apos;usurpation d&apos;identité à la
          falsification rétroactive de la chaîne d&apos;intégrité) et les contre-mesures retenues sont
          documentés dans{" "}
          <a
            href="https://github.com/gouamenedadi-bit/E-VOTE-CI/blob/main/docs/06-plan-de-securite.md"
            className="text-ci-green font-semibold hover:underline"
          >
            docs/06-plan-de-securite.md
          </a>
          . Risques résiduels explicitement assumés en phase simulation : chiffrement sans
          vérifiabilité cryptographique de bout en bout, pas de vérification d&apos;identité réelle,
          ancrage d&apos;intégrité centralisé plutôt que distribué multi-parties.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-ci-ink mb-3 text-lg">Plan de continuité et de reprise</h2>
        <p className="text-sm text-ci-orange bg-orange-50 border border-ci-orange/25 rounded-xl p-3">
          ⚠ Aucune procédure de sauvegarde/restauration automatisée n&apos;est encore implémentée dans
          ce prototype. En mode démonstration, l&apos;état vit en mémoire et est perdu au redémarrage
          du serveur. En mode Supabase, les sauvegardes automatiques de la plateforme s&apos;appliquent,
          mais leur test de restauration périodique (doc 06 §6) reste à mettre en place avant tout
          usage au-delà du prototype local.
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-ci-ink mb-3 text-lg">Procédure d&apos;audit indépendant</h2>
        <p className="text-sm text-ci-gray">
          Non réalisé à ce stade. Avant toute évolution vers un usage officiel : audit de sécurité
          externe (OWASP Top 10, logique métier du jeton/bulletin, politiques RLS), test de
          pénétration, et revue indépendante du protocole de chiffrement par une expertise
          cryptographique (doc 06 §7.3, doc 01 §1).
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-ci-ink mb-3 text-lg">Registre des versions logicielles</h2>
        <p className="text-sm text-ci-gray">
          Version courante : <code className="font-mono">{packageJson.version}</code>. Historique
          complet des changements :{" "}
          <a
            href="https://github.com/gouamenedadi-bit/E-VOTE-CI/commits/main"
            className="text-ci-green font-semibold hover:underline"
          >
            journal des commits GitHub
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-ci-ink mb-3 text-lg">Validation avant mise en production</h2>
        <p className="text-sm text-ci-gray">
          À ce stade : build de production (<code>next build</code>), suite de tests unitaires et de
          bout en bout exécutée avant chaque évolution publiée. Aucune procédure formelle
          d&apos;approbation multi-parties n&apos;est encore en place — à définir avec l&apos;autorité
          électorale compétente avant tout usage officiel (doc 01 §1, doc 01 §16).
        </p>
      </section>
    </main>
  );
}
