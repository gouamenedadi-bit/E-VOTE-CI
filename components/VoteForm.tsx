"use client";

import { useState } from "react";

export interface VoteFormCandidate {
  id: string;
  displayName: string;
  partyName: string | null;
  ballotOrder: number;
  isBlankOption?: boolean;
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

  if (step === "select") {
    return (
      <div className="flex flex-col gap-4">
        {candidates.map((candidate) => {
          const isSelected = selectedId === candidate.id;
          return (
            <label
              key={candidate.id}
              className="flex items-center gap-3 rounded-xl p-4 cursor-pointer bg-white"
              style={{
                border: `2px solid ${isSelected ? "var(--color-ci-orange)" : "rgba(242,118,12,0.15)"}`,
                boxShadow: isSelected
                  ? "0 6px 18px -4px rgba(242,118,12,0.3)"
                  : "0 2px 8px -2px rgba(242,118,12,0.08)",
                transition: "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
                transform: isSelected ? "translateY(-1px)" : "none",
              }}
            >
              <input
                type="radio"
                name="candidate"
                value={candidate.id}
                checked={isSelected}
                onChange={() => setSelectedId(candidate.id)}
                className="w-5 h-5 accent-[var(--color-ci-orange)]"
              />
              <span className="text-base text-ci-ink">
                {candidate.isBlankOption
                  ? "Vote blanc"
                  : `N°${candidate.ballotOrder} — ${candidate.displayName}${
                      candidate.partyName ? ` — ${candidate.partyName}` : ""
                    }`}
              </span>
            </label>
          );
        })}

        <button
          type="button"
          disabled={!selected}
          onClick={() => setStep("confirm")}
          className="ci-btn-primary"
        >
          Continuer
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 ci-animate-in">
      <input type="hidden" name="electionId" value={electionId} />
      <input type="hidden" name="ballotType" value={selected?.isBlankOption ? "blank" : "valid"} />
      <input type="hidden" name="candidateId" value={selected?.isBlankOption ? "" : selected?.id ?? ""} />

      <div className="ci-card ci-card--accent-green">
        <p className="text-ci-gray text-sm mb-1">Vous avez sélectionné :</p>
        <p className="font-semibold text-ci-ink text-lg">
          {selected?.isBlankOption
            ? "Vote blanc"
            : `N°${selected?.ballotOrder} — ${selected?.displayName}${
                selected?.partyName ? ` — ${selected.partyName}` : ""
              }`}
        </p>
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
