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
import { isAdminUser } from "@/lib/authz";

import { Database, FileText, Package, Truck, Wrench, BookOpen, UploadCloud } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type Section = {
  key: string;
  title: string;
  description: string;
  hint: string;
  icon: React.ElementType;
  tables: string[];
  href?: string;
};

type TableCount = Record<string, number | null>;
type LoadState = "idle" | "loading" | "ready" | "error";

async function fetchTableCount(table: string): Promise<number | null> {
  try {
    const { count, error } = await supabase.from(table as any).select("*", { head: true, count: "exact" });
    if (error) return null;
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

export default function Admin() {
  const { user } = useAuth();

  const isAdmin = isAdminUser(user);

  const sections: Section[] = useMemo(
    () => [
      {
        key: "kb",
        title: "Base de connaissance",
        description: "kb_articles • kb_documents",
        hint: "Articles FR/EN + documents PDF pour enrichir l’encyclopédie import/export.",
        icon: BookOpen,
        tables: ["kb_articles", "kb_documents"],
        href: "/app/admin/kb-docs",
      },
      {
        key: "pdf",
        title: "Base documentaire (PDF)",
        description: "kb_documents (storage: kb_docs)",
        hint: "Upload, tags, langue, activation (enabled) — puis ingestion plus tard si besoin.",
        icon: UploadCloud,
        tables: ["kb_documents"],
        href: "/app/admin/kb-docs",
      },
      {
        key: "products",
        title: "Produits & coûts",
        description: "products • product_costs • export_hs_catalog",
        hint: "HS code, coûts, données produit. (Optionnel selon ton usage).",
        icon: Package,
        tables: ["products", "product_costs", "export_hs_catalog"],
        href: "/app/produits",
      },
      {
        key: "transport",
        title: "Transport & règles",
        description: "transport_rates • export_destinations • export_incoterms",
        hint: "Tarifs transport par destination/mode, minimums, surcharges.",
        icon: Truck,
        tables: ["transport_rates", "export_destinations", "export_incoterms"],
        href: "/app/simulator",
      },
      {
        key: "watch",
        title: "Veille & documents",
        description: "watch_sources • watch_items • documents • reg_events",
        hint: "Sources, items et événements de veille. (Séparer de la base PDF encyclopédie).",
        icon: FileText,
        tables: ["watch_sources", "watch_items", "documents", "reg_events"],
        href: "/app/centre-veille/reglementation",
      },
      {
        key: "playbooks",
        title: "Playbooks & contenus",
        description: "playbooks • playbook_sections",
        hint: "Contenus versionnés pour guides et playbooks.",
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

  const totalKnown = useMemo(() => {
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

        const ok = Object.values(next).some((v) => typeof v === "number");
        setState(ok ? "ready" : "error");

        if (!ok) {
          setLastError("Impossible de récupérer les compteurs Supabase (connexion, RLS, ou tables absentes).");
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
            <CardTitle>Accès réservé</CardTitle>
            <CardDescription>Cette page est réservée aux administrateurs.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/app/control-tower">Retour au cockpit</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/contact?offer=diagnostic">Demander un accès</Link>
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
            <h1 className="text-2xl font-bold">Référentiels & base documentaire</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gère la base de connaissance (FR/EN), les PDFs et les tables métiers.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/app/admin/kb-docs">Importer un PDF</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/app/centre-veille/reglementation">Ajouter une source veille</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/app/produits">Créer un produit</Link>
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
                  <Badge variant="outline">Chargement…</Badge>
                ) : anyCountOk ? (
                  <Badge variant="outline">Connecté</Badge>
                ) : (
                  <Badge variant="destructive">À corriger</Badge>
                )}
              </div>
            </div>
            <CardDescription>Compteurs par table (lecture head+count).</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {state === "error" && (
              <Alert>
                <AlertTitle>Compteurs indisponibles</AlertTitle>
                <AlertDescription>
                  {lastError ?? "Vérifie Supabase, les policies RLS (read) et l’existence des tables."}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Total (tables comptées) :</span>
              {state === "loading" ? <Skeleton className="h-5 w-16" /> : <span className="font-medium">{totalKnown}</span>}
              <Separator className="mx-2 hidden h-4 sm:block" orientation="vertical" />
              <span className="text-muted-foreground">Tables :</span>
              <span className="font-medium">{allTables.length}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {allTables.map((t) => {
                const v = counts[t];
                const label = state === "loading" ? "…" : typeof v === "number" ? `${v}` : "—";
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
                      Astuce : commence par ajouter des PDFs + des articles FR/EN pour enrichir la recherche de l’assistant.
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/app/admin/kb-docs">Gérer les PDFs</Link>
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
