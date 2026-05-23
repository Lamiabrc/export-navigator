import { Link } from "react-router-dom";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Register() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-50">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col justify-between gap-10">
        <BrandLogo
          className="flex items-center gap-3"
          imageClassName="h-11 drop-shadow-lg"
          titleClassName="text-base font-semibold text-white"
          subtitleClassName="text-sm text-slate-200/80"
        />

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Acces prive
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
                L'espace de publication et d'analyse est reserve a MPL Export Navigator.
              </h1>
              <p className="max-w-2xl text-base text-slate-200/85">
                Les visiteurs peuvent consulter les annonces et demander un accompagnement import-export France-Maghreb. La creation d'annonces, le pilotage et l'analyse restent dans l'acces administrateur.
              </p>
            </div>
          </div>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-emerald-500/10">
            <CardHeader className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-100">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Pas d'inscription publique</CardTitle>
                <CardDescription className="mt-2 text-slate-300">
                  L'offre est maintenant un accompagnement clair, pas une plateforme ouverte a tous les profils.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200">
                Accompagnement import-export France-Maghreb : cadrage du besoin, recherche d'opportunites, verification couts/documents, mise en relation et suivi des actions.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button asChild className="h-11">
                  <Link to="/contact">
                    <Mail className="mr-2 h-4 w-4" />
                    Demander un accompagnement
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-11 border-slate-700 bg-transparent text-white hover:bg-slate-900">
                  <Link to="/login">Acces administrateur</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-xs uppercase tracking-[0.28em] text-slate-500">MPL Export Navigator</div>
      </div>
    </div>
  );
}
