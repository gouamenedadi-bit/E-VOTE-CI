"use client";

import { useState } from "react";

export interface VoteFormCandidate {
  id: string;
  displayName: string;
  partyName: string | null;
  ballotOrder: number;
  isBlankOption?: boolean;
  isNullOption?: boolean;
}

/**
 * Photo du candidat : donnees entierement fictives (doc 01 §1), aucune
 * vraie photographie disponible pour un candidat de demonstration — un
 * avatar genere localement (SVG en donnees, aucun appel reseau externe)
 * tient lieu de photo officielle pour ce prototype. A remplacer par
 * candidates.photo_url (doc 03 §3) des que de vraies fiches candidats
 * existent.
 */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return initials.toUpperCase() || "?";
}

function avatarDataUrl(name: string, background: string): string {
  const initials = initialsOf(name);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">` +
    `<rect width="160" height="160" rx="80" fill="${background}"/>` +
    `<text x="80" y="80" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="Arial, sans-serif" font-size="60" font-weight="700" fill="#ffffff">${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function VoteForm({
  electionId,
  candidates,
  action,
}: {
  electionId: string;
  candidates: VoteFormCandidate[];
  action: (formData: FormData) => void;
}) {
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  const choose = (id: string) => {
    setSelectedId(id);
    setStep("confirm");
  };

  const describe = (c: VoteFormCandidate) =>
    c.isBlankOption
      ? "Vote blanc"
      : c.isNullOption
        ? "Bulletin nul"
        : `N°${c.ballotOrder} — ${c.displayName}${c.partyName ? ` — ${c.partyName}` : ""}`;

  if (step === "select") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {candidates.map((candidate) => {
          const special = candidate.isBlankOption || candidate.isNullOption;
          return (
            <div key={candidate.id} className="ci-card flex flex-col items-center gap-3 text-center">
              {special ? (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white font-bold"
                  style={{ background: candidate.isNullOption ? "#6b7280" : "var(--color-ci-gray)" }}
                  aria-hidden
                >
                  {candidate.isNullOption ? "✕" : "○"}
                </div>
              ) : (
                <img
                  src={avatarDataUrl(candidate.displayName, "#F2760C")}
                  alt={`Photo de ${candidate.displayName}`}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full border-2 border-ci-orange/40 object-cover"
                  style={{ boxShadow: "0 4px 14px -3px rgba(242,118,12,0.3)" }}
                />
              )}

              <div>
                {!special && (
                  <p className="text-xs font-semibold text-ci-orange uppercase tracking-wide">
                    N°{candidate.ballotOrder}
                  </p>
                )}
                <p className="font-semibold text-ci-ink text-base">{candidate.displayName}</p>
                {candidate.partyName && <p className="text-sm text-ci-gray">{candidate.partyName}</p>}
              </div>

              <button type="button" onClick={() => choose(candidate.id)} className="ci-btn-primary w-full mt-1">
                Voter
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 ci-animate-in">
      <input type="hidden" name="electionId" value={electionId} />
      <input
        type="hidden"
        name="ballotType"
        value={selected?.isBlankOption ? "blank" : selected?.isNullOption ? "null" : "valid"}
      />
      <input
        type="hidden"
        name="candidateId"
        value={selected?.isBlankOption || selected?.isNullOption ? "" : selected?.id ?? ""}
      />

      <div className="ci-card ci-card--accent-green flex items-center gap-4">
        {selected && !selected.isBlankOption && !selected.isNullOption ? (
          <img
            src={avatarDataUrl(selected.displayName, "#F2760C")}
            alt=""
            width={56}
            height={56}
            className="w-14 h-14 rounded-full border-2 border-ci-orange/40 object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl text-white font-bold flex-shrink-0"
            style={{ background: selected?.isNullOption ? "#6b7280" : "var(--color-ci-gray)" }}
            aria-hidden
          >
            {selected?.isNullOption ? "✕" : "○"}
          </div>
        )}
        <div>
          <p className="text-ci-gray text-sm mb-1">Vous avez sélectionné :</p>
          <p className="font-semibold text-ci-ink text-lg">{selected ? describe(selected) : ""}</p>
        </div>
      </div>

      <p role="alert" className="text-sm text-ci-orange font-medium">
        ⚠ Après confirmation, ce choix ne pourra plus être modifié.
      </p>

      <div className="flex gap-4">
        <button type="button" onClick={() => setStep("select")} className="ci-btn-outline flex-1">
          Modifier mon choix
        </button>
        <button type="submit" className="ci-btn-primary flex-1">
          Confirmer le vote
        </button>
      </div>
    </form>
  );
}
