export function SimulationBanner() {
  return (
    <div
      role="note"
      aria-label="Avertissement : plateforme de simulation"
      className="w-full text-white text-center text-sm sm:text-base font-semibold py-2.5 px-4"
      style={{
        background: "linear-gradient(90deg, var(--color-ci-orange), #ff9a3d, var(--color-ci-orange))",
        boxShadow: "0 2px 10px -2px rgba(242, 118, 12, 0.4)",
      }}
    >
      ⚠ SIMULATION / DÉMONSTRATION — ceci n&apos;est pas un système de vote officiel
    </div>
  );
}
