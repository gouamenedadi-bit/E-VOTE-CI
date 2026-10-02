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
        {candidates.map((candidate) => (
          <label
            key={candidate.id}
            className="flex items-center gap-3 border border-gray-200 rounded-md p-4 cursor-pointer hover:border-ci-green"
          >
            <input
              type="radio"
              name="candidate"
              value={candidate.id}
              checked={selectedId === candidate.id}
              onChange={() => setSelectedId(candidate.id)}
              className="w-5 h-5"
            />
            <span className="text-base">
              {candidate.isBlankOption
                ? "Vote blanc"
                : `N°${candidate.ballotOrder} — ${candidate.displayName}${
                    candidate.partyName ? ` — ${candidate.partyName}` : ""
                  }`}
            </span>
          </label>
        ))}

        <button
          type="button"
          disabled={!selected}
          onClick={() => setStep("confirm")}
          className="min-h-[44px] rounded-md bg-ci-green text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuer
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="electionId" value={electionId} />
      <input type="hidden" name="ballotType" value={selected?.isBlankOption ? "blank" : "valid"} />
      <input type="hidden" name="candidateId" value={selected?.isBlankOption ? "" : selected?.id ?? ""} />

      <div className="border border-gray-200 rounded-md p-4">
        <p className="text-ci-gray text-sm mb-1">Vous avez sélectionné :</p>
        <p className="font-semibold text-ci-dark text-lg">
          {selected?.isBlankOption
            ? "Vote blanc"
            : `N°${selected?.ballotOrder} — ${selected?.displayName}${
                selected?.partyName ? ` — ${selected.partyName}` : ""
              }`}
        </p>
      </div>

      <p role="alert" className="text-sm text-ci-orange">
        ⚠ Après confirmation, ce choix ne pourra plus être modifié.
      </p>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => setStep("select")}
          className="flex-1 min-h-[44px] rounded-md border-2 border-ci-dark text-ci-dark font-semibold"
        >
          Modifier mon choix
        </button>
        <button
          type="submit"
          className="flex-1 min-h-[44px] rounded-md bg-ci-green text-white font-semibold hover:bg-ci-green/90"
        >
          Confirmer le vote
        </button>
      </div>
    </form>
  );
}
