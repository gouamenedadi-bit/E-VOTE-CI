import Link from "next/link";

export default function HomePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-8 items-center text-center">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-ci-dark">E-VOTE CI</h1>
        <p className="mt-2 text-lg text-ci-gray">
          Plateforme de simulation de vote électronique
        </p>
      </div>

      <nav className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <Link
          href="/presentation"
          className="min-h-[44px] flex items-center justify-center rounded-md border-2 border-ci-dark px-6 py-3 text-base font-semibold text-ci-dark hover:bg-gray-50"
        >
          Comment ça fonctionne
        </Link>
        <Link
          href="/connexion"
          className="min-h-[44px] flex items-center justify-center rounded-md bg-ci-green px-6 py-3 text-base font-semibold text-white hover:bg-ci-green/90"
        >
          Connexion de démonstration
        </Link>
        <Link
          href="/resultats"
          className="min-h-[44px] flex items-center justify-center rounded-md border-2 border-ci-orange px-6 py-3 text-base font-semibold text-ci-orange hover:bg-orange-50"
        >
          Voir les résultats publics
        </Link>
      </nav>

      <p className="text-sm text-ci-gray max-w-xl">
        Toutes les données utilisées ici sont fictives. Cette plateforme ne vérifie aucune
        identité réelle et ne produit aucun résultat ayant une valeur juridique.
      </p>
    </main>
  );
}
