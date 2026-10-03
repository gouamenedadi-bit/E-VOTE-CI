import Link from "next/link";

export default function HomePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-16 flex flex-col gap-10 items-center text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="ci-flag-rule" />
        <h1 className="text-4xl sm:text-5xl font-extrabold text-ci-ink tracking-tight">E-VOTE CI</h1>
        <p className="text-lg text-ci-gray max-w-md">
          Plateforme de simulation de vote électronique pour la Côte d&apos;Ivoire
        </p>
      </div>

      <nav className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <Link href="/presentation" className="ci-btn-outline px-6">
          Comment ça fonctionne
        </Link>
        <Link href="/connexion" className="ci-btn-primary px-6">
          Connexion de démonstration
        </Link>
        <Link href="/resultats" className="ci-btn-outline-orange px-6">
          Voir les résultats publics
        </Link>
      </nav>

      <p className="text-base text-ci-gray max-w-xl">
        Toutes les données utilisées ici sont fictives. Cette plateforme ne vérifie aucune
        identité réelle et ne produit aucun résultat ayant une valeur juridique.
      </p>
    </main>
  );
}
