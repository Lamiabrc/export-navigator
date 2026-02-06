import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";

import { Database, FileText, Package, Truck, Wrench } from "lucide-react";

// ✅ Adapte si ton projet utilise un autre chemin (ex: "@/lib/supabaseClient")
import { supabase } from "@/integrations/supabase/client";

type Section = {
  key: string;
  title: string;
  description: string;
  hint: string;
  icon: React.ElementType;
  tables: string[];
  href?: string; // routes CRUD futures (si tu les crées)
};

type TableCount = Record<string, number | null>;
type LoadState = "idle" | "loading" | "ready" | "error";

async function fetchTableCount(table: string): Promise<number | null> {
  try {
    // "head: true" => ne récupère pas les lignes, seulement le count
    const { count, error } = await supabase.from(table as any).select("*", { head: true, count: "exact" });
    if (error) return null;
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

export default function Admin() {
  const { user } = useAuth();
  const sections: Section[] = useMemo(
    () => [
      {
        key: "products",
        title: "Produits & couts",
        description: "products ? product_costs ? export_hs_catalog",
        hint: "HS code, couts de revient, OM/OMR par destination + HS.",
        icon: Package,
        tables: ["products", "product_costs", "export_hs_catalog"],
        href: "/app/produits",
      },
      {
        key: "transport",
        title: "Transport & regles",
        description: "transport_rates ? export_destinations ? export_incoterms",
        hint: "Tarifs transport par destination/mode, minimums, surcharge carburant.",
        icon: Truck,
        tables: ["transport_rates", "export_destinations", "export_incoterms"],
        href: "/app/simulator",
      },
      {
        key: "watch",
        title: "Veille & documents",
        description: "watch_sources ? watch_items ? documents ? reg_events",
        hint: "Sources, items, documents et evenements reglementaires.",
        icon: FileText,
        tables: ["watch_sources", "watch_items", "documents", "reg_events"],
        href: "/app/centre-veille/reglementation",
      },
      {
        key: "playbooks",
        title: "Playbooks & contenus",
        description: "playbooks ? playbook_sections",
        hint: "Contenus versionnes pour l'IA, le guide et les playbooks.",
        icon: Wrench,
        tables: ["playbooks", "playbook_sections"],
        href: "/guides/incoterms-ddp",
      },
    ],
    []
  );

  const allTables = useMemo(() => Array.from(new Set(sections.flatMap((s) => s.tables))), [sections]);

  const [counts, setCounts] = useState<TableCount>({});
  const [state, setState] = useState<LoadState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  const isAdmin =
    user?.email?.toLowerCase() === "lamia.brechet@outlook.fr" ||
    user?.role === "admin";

  const totalKnown = useMemo(() => {
    // somme des tables connues (null => non comptée)
    return Object.values(counts).reduce((acc, v) => (typeof v === "number" ? acc + v : acc), 0);
  }, [counts]);

  const anyCountOk = useMemo(() => Object.values(counts).some((v) => typeof v === "number"), [counts]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      setLastError(null);

      try {
        const entries = await Promise.all(
          allTables.map(async (t) => {
            const c = await fetchTableCount(t);
            return [t, c] as const;
          })
        );

        if (cancelled) return;

        const next: TableCount = {};
        for (const [t, c] of entries) next[t] = c;

        setCounts(next);
        setState("ready");

        // si tout est null => on considère “error” (souvent RLS/connexion/import)
        const ok = Object.values(next).some((v) => typeof v === "number");
        if (!ok) {
          setState("error");
          setLastError(
            "Impossible de récupérer les compteurs Supabase (connexion, RLS ou droits de lecture)."
          );
        }
      } catch (e: any) {
        if (cancelled) return;
        setState("error");
        setLastError(e?.message ?? "Erreur inconnue lors du chargement des compteurs.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [allTables]);

  if (!isAdmin) {
    return (
      <AppLayout>
        <Card>
          <CardHeader>
            <CardTitle>Acces reserve</CardTitle>
            <CardDescription>Cette page est reservee aux administrateurs.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/app/control-tower">Retour au cockpit</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/contact?offer=diagnostic">Demander un acces</Link>
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Administration</p>
            <h1 className="text-2xl font-bold">Referentiels & veille (Supabase)</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Centralise les tables cles pour le calcul export, la veille et les contenus IA.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/app/centre-veille/reglementation">Ajouter une source</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/app/produits">Creer un produit</Link>
            </Button>
            <Button asChild>
              <Link to="/resources">Importer un document</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">État des données</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {state === "loading" ? (
                  <Badge variant="outline">Chargement...</Badge>
                ) : anyCountOk ? (
                  <Badge variant="outline">Connecte</Badge>
                ) : (
                  <Badge variant="destructive">A corriger</Badge>
                )}
              </div>
            </div>
            <CardDescription>
              Compteurs par table (lecture head+count). Utile pour voir si les referentiels se remplissent.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {state === "error" && (
              <Alert>
                <AlertTitle>Compteurs indisponibles</AlertTitle>
                <AlertDescription>
                  {lastError ?? "Verifie la configuration Supabase et les policies RLS (read) sur ces tables."}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Total (tables comptees) :</span>
              {state === "loading" ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <span className="font-medium">{totalKnown}</span>
              )}
              <Separator className="mx-2 hidden h-4 sm:block" orientation="vertical" />
              <span className="text-muted-foreground">Tables :</span>
              <span className="font-medium">{allTables.length}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {allTables.map((t) => {
                const v = counts[t];
                const label =
                  state === "loading" ? "…" : typeof v === "number" ? `${v}` : "—";
                return (
                  <Badge key={t} variant="outline" className="gap-2">
                    <span className="font-mono text-xs">{t}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-xs">{label}</span>
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((s) => {
            const Icon = s.icon;
            const hasRoute = Boolean(s.href);

            return (
              <Card key={s.key} className="group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-md border p-2 text-muted-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{s.title}</CardTitle>
                        <CardDescription className="mt-1">{s.description}</CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline">Ecrans admin a venir</Badge>
                      {hasRoute ? (
                        <Button asChild size="sm" variant="secondary" className="opacity-90 group-hover:opacity-100">
                          <Link to={s.href!}>Ouvrir</Link>
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled>
                          Ouvrir
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{s.hint}</p>

                  <div className="flex flex-wrap gap-2">
                    {s.tables.map((t) => {
                      const v = counts[t];
                      const value = state === "loading" ? "…" : typeof v === "number" ? `${v}` : "—";
                      return (
                        <Badge key={t} variant="outline" className="gap-2">
                          <span className="font-mono text-xs">{t}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-xs">{value}</span>
                        </Badge>
                      );
                    })}
                  </div>

                  <Separator />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Astuce : commence par "watch_sources" + "watch_items" pour rendre la veille vivante.
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/resources">Voir le schema</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
