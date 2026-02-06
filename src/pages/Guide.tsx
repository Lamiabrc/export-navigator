import React from "react";
import { Link, useParams } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFeaturedGuides, getGuideBySlug } from "@/data/guides";

export default function Guide() {
  const params = useParams();
  const slug = params.slug || "";
  const content = getGuideBySlug(slug);
  const suggestions = getFeaturedGuides(3, slug);

  // ✅ Route cible (on évite /analyse et on reste cohérent avec le reste du site)
  const toolBase = "/tool";

  if (!content) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-2xl p-6">
          <Card className="rounded-2xl border border-border bg-card/70 text-foreground shadow-lg shadow-foreground/10">
            <CardHeader>
              <CardTitle>Guide introuvable</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/70">
                Le guide demandé n’existe pas (encore) ou a été déplacé.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={toolBase}>Lancer l’analyse</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/guides">Voir les guides</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PublicLayout>
    );
  }

  const mistakes = Array.isArray(content.mistakes) ? content.mistakes : [];
  const ctaUrl = content.incoterm
    ? `${toolBase}?incoterm=${encodeURIComponent(content.incoterm)}`
    : toolBase;

  return (
    <PublicLayout>
      <div className="space-y-10 text-foreground">
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Guide pratique</p>
          <h1 className="text-4xl font-semibold">{content.title}</h1>
          <p className="text-lg text-foreground/80">{content.intro}</p>
        </section>

        <Card className="border border-border bg-card/80 text-foreground shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Erreurs fréquentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mistakes.length ? (
              mistakes.map((mistake) => (
                <div key={mistake} className="flex items-start gap-3 text-foreground/80">
                  <Badge className="rounded-full border border-border bg-muted text-muted-foreground">
                    Point de vigilance
                  </Badge>
                  <span>{mistake}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-foreground/70">
                Aucun point listé pour le moment — ce guide sera enrichi.
              </p>
            )}
          </CardContent>
        </Card>

        <section className="force-white rounded-2xl border border-border bg-gradient-to-r from-primary/90 via-secondary to-primary/50 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/80">Passez à l’action</div>
              <div className="text-2xl font-semibold">{content.ctaLabel}</div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link to={ctaUrl}>Lancer l’analyse</Link>
              </Button>
              <Button asChild variant="outline" className="border-white text-white hover:bg-white/20">
                <Link to="/contact">Demander une revue</Link>
              </Button>
            </div>
          </div>
        </section>

        {suggestions.length > 0 && (
          <section className="space-y-4 rounded-2xl border border-border bg-white/80 p-6 shadow-sm text-foreground">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Explorez d’autres guides</p>
                <h2 className="text-2xl font-semibold">Guides conseils</h2>
              </div>
              <Link to="/guides" className="text-sm font-medium text-primary hover:underline">
                Voir tous les guides
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {suggestions.map((suggestion) => (
                <Link
                  to={`/guides/${suggestion.slug}`}
                  key={suggestion.slug}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card/70 p-4 text-foreground transition hover:border-primary hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold">{suggestion.title}</h3>
                  <p className="mt-2 text-sm text-foreground/70">{suggestion.intro}</p>
                  <span className="mt-auto text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                    {suggestion.ctaLabel}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </PublicLayout>
  );
}
