import * as React from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";

export default function HeroVideoPreview() {
  const [hasError, setHasError] = React.useState(false);

  return (
    <PublicLayout>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Debug</p>
          <h1 className="text-3xl font-semibold text-slate-900">Aperçu vidéo Hero</h1>
          <p className="text-sm text-slate-600">Vérifiez le chargement de la vidéo hero-export.webm.</p>
        </div>

        <div className="space-y-3">
          <video
            className="w-full rounded-xl border border-slate-200"
            controls
            preload="metadata"
            onError={() => setHasError(true)}
          >
            <source src="/videos/hero-export.webm" type="video/webm" />
            Votre navigateur ne supporte pas la lecture vidéo.{" "}
            <a href="/videos/hero-export.webm" className="underline">
              Ouvrir le fichier brut
            </a>
            .
          </video>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <a href="/videos/hero-export.webm" target="_blank" rel="noreferrer">
                Ouvrir le fichier brut
              </a>
            </Button>
            <Button asChild variant="ghost">
              <a href="/">Retour à l’accueil</a>
            </Button>
          </div>

          {hasError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              La vidéo ne se charge pas. Vérifiez que le fichier existe bien dans{" "}
              <code className="rounded bg-rose-100 px-1">public/videos/hero-export.webm</code>{" "}
              puis ouvrez-le directement via{" "}
              <a href="/videos/hero-export.webm" className="font-semibold underline">
                /videos/hero-export.webm
              </a>
              .
            </div>
          ) : null}
        </div>
      </main>
    </PublicLayout>
  );
}
