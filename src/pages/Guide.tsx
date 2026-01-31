import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getGuideBySlug, GUIDES } from "@/data/guides";

export default function Guide() {
  const { slug } = useParams();
  const guide = React.useMemo(() => getGuideBySlug(slug), [slug]);

  return (
    <PublicLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Guides</p>
            <h1 className="text-3xl font-semibold text-white">Ressources pratiques export</h1>
            <p className="mt-2 text-slate-200">
              Des guides courts, actionnables, pour sécuriser tes opérations.
            </p>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline" className="border-white/20 text-slate-100 hover:bg-white/10">
              <Link to="/veille">Veille</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/contact?offer=express">Validation express</Link>
            </Button>
          </div>
        </div>

        {!guide ? (
          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle>Guide introuvable</CardTitle>
              <CardDescription className="text-slate-200">
                Le guide “{slug}” n’existe pas (ou a été déplacé).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-slate-200">Guides disponibles :</div>
              <div className="grid gap-3 md:grid-cols-2">
                {GUIDES.map((g) => (
                  <Link
                    key={g.slug}
                    to={`/guides/${g.slug}`}
                    className="rounded-xl border border-white/15 bg-white/5 p-4 hover:bg-white/10 transition"
                  >
                    <div className="font-semibold text-white">{g.title}</div>
                    <div className="mt-1 text-sm text-slate-200">{g.description}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(g.tags || []).slice(0, 4).map((t) => (
                        <Badge key={t} className="bg-white/5 text-slate-100 border-white/15">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-white/15 bg-white/10 text-white backdrop-blur">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl">{guide.title}</CardTitle>
              {guide.description ? (
                <CardDescription className="text-slate-200">{guide.description}</CardDescription>
              ) : null}
              <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                {guide.readingTime ? <span>⏱ {guide.readingTime}</span> : null}
                {guide.updatedAt ? (
                  <span>🗓 {new Date(guide.updatedAt).toLocaleDateString("fr-FR")}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {(guide.tags || []).map((t) => (
                  <Badge key={t} className="bg-white/5 text-slate-100 border-white/15">
                    {t}
                  </Badge>
                ))}
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-5 text-slate-100 whitespace-pre-line leading-relaxed">
                {guide.content}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild variant="secondary">
                  <Link to="/contact?offer=express">Demander validation express</Link>
                </Button>
                <Button asChild variant="outline" className="border-white/20 text-slate-100 hover:bg-white/10">
                  <Link to="/resources">Voir les ressources</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PublicLayout>
  );
}
