import Link from "next/link";

export default function ResultatsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      <Link href="/" className="text-ci-green font-semibold">
        ← Accueil
      </Link>

      <h1 className="text-2xl font-bold text-ci-dark">Résultats — Simulation</h1>

      <p className="text-ci-gray">
        Aucun résultat n&apos;est publié pour le moment. Les résultats ne sont affichés
        qu&apos;après dépouillement et validation, et restent marqués comme provisoires jusqu&apos;à
        vérification complète (doc 01 §4.4, doc 05 §4).
      </p>

      <p className="text-sm text-ci-gray">
        Le module de dépouillement et de publication des résultats est une prochaine étape du
        prototype.
      </p>
    </main>
  );
}
