import Link from "next/link";

export default function PresentationPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-8">
      <Link href="/" className="text-ci-green font-semibold hover:underline w-fit">
        ← Accueil
      </Link>

      <div className="flex flex-col gap-3">
        <div className="ci-flag-rule" />
        <h1 className="text-2xl sm:text-3xl font-bold text-ci-ink">
          Comment fonctionne la simulation ?
        </h1>
      </div>

      <ol className="flex flex-col sm:flex-row gap-4 list-decimal list-inside">
        <li className="ci-card flex-1 text-ci-ink">
          <strong>Identification démo</strong> — un numéro d&apos;électeur fictif, jamais une
          preuve d&apos;identité à lui seul.
        </li>
        <li className="ci-card flex-1 text-ci-ink">
          <strong>Vote</strong> — un jeton à usage unique, sans lien conservé avec votre
          identité.
        </li>
        <li className="ci-card flex-1 text-ci-ink">
          <strong>Résultats</strong> — décompte vérifiable, publié avec un statut provisoire
          ou définitif.
        </li>
      </ol>

      <section className="ci-card ci-card--accent-green p-5">
        <h2 className="font-semibold text-ci-ink mb-2 text-lg">Le secret du vote : comment c&apos;est garanti</h2>
        <p className="text-ci-gray">
          L&apos;identité de l&apos;électeur et le contenu du bulletin sont stockés dans deux
          systèmes séparés, sans lien exploitable entre eux. Une fois votre jeton utilisé,
          aucune requête — même administrateur — ne peut relier votre choix à votre identité.
        </p>
      </section>

      <section className="ci-card p-5">
        <h2 className="font-semibold text-ci-ink mb-2 text-lg">
          Pourquoi ce n&apos;est pas un système officiel
        </h2>
        <p className="text-ci-gray">
          Cette plateforme ne vérifie aucune identité réelle, n&apos;accède à aucun fichier
          électoral officiel, et ne produit aucun résultat ayant une valeur juridique. Un
          usage officiel nécessiterait l&apos;autorisation de l&apos;autorité électorale
          compétente, un cadre légal validé, et un audit de sécurité indépendant.
        </p>
      </section>

      <section className="ci-card ci-card--accent-green p-5">
        <h2 className="font-semibold text-ci-ink mb-2 text-lg">Qui peut voir quoi</h2>
        <p className="text-ci-gray">
          Les administrateurs gèrent les scrutins mais ne peuvent jamais consulter le choix
          individuel d&apos;un électeur. Les observateurs consultent les résultats publiables
          sans pouvoir les modifier.
        </p>
      </section>
    </main>
  );
}
