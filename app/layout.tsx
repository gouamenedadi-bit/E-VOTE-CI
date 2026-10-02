import type { Metadata } from "next";
import { SimulationBanner } from "@/components/SimulationBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "E-VOTE CI — Simulation",
  description:
    "Plateforme de simulation de vote electronique pour la Cote d'Ivoire. Prototype de demonstration, aucune valeur officielle.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col">
        <SimulationBanner />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-gray-200 text-sm text-ci-gray text-center py-4 px-4">
          E-VOTE CI — prototype de démonstration · aucune donnée réelle · ceci n&apos;est pas
          un système officiel
        </footer>
      </body>
    </html>
  );
}
