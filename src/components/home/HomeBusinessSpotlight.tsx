import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, Building2, Globe2, Mail, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listBusinessOpportunities } from "@/services/businessBoard";

type HomeBusinessSpotlightProps = {
  isEn: boolean;
  isAuthenticated: boolean;
};

const TYPE_LABELS = {
  buyer: { fr: "Recherche achat", en: "Buyer request" },
  seller: { fr: "Offre de vente", en: "Seller offer" },
  distributor: { fr: "Distribution", en: "Distribution" },
  partner: { fr: "Partenariat", en: "Partnership" },
  investor: { fr: "Investissement", en: "Investment" },
  service: { fr: "Service", en: "Service" },
} as const;

function formatDate(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function HomeBusinessSpotlight({ isEn, isAuthenticated }: HomeBusinessSpotlightProps) {
  const [items, setItems] = React.useState<Awaited<ReturnType<typeof listBusinessOpportunities>>["items"]>([]);
  const [source, setSource] = React.useState<"server" | "demo">("demo");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const result = await listBusinessOpportunities(3);
        if (!alive) return;
        setItems(result.items);
        setSource(result.source);
      } catch {
        if (!alive) return;
        setItems([]);
        setSource("demo");
      } finally {
        if (alive) setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_48%,#eff6ff_100%)] p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-800">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            {isEn ? "France-Maghreb support" : "Accompagnement France-Maghreb"}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {isEn
                ? "A curated board plus practical support to move from idea to import-export action."
                : "Un board qualifie et un accompagnement concret pour passer de l'idee a l'action import-export."}
            </h2>
            <p className="text-sm text-slate-700 sm:text-base">
              {isEn
                ? "MPL publishes selected opportunities and helps you check the market, costs, documents and next step between France, Morocco, Algeria and Tunisia."
                : "MPL publie les opportunites selectionnees et aide a verifier marche, couts, documents et prochaine action entre France, Maroc, Algerie et Tunisie."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-11 rounded-full px-5">
            <Link to="/coin-business">
              {isEn ? "View announcements" : "Voir les annonces"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-full border-slate-300 bg-white px-5">
            <Link to={isAuthenticated ? "/app/mise-en-relation" : "/contact"}>
              {isAuthenticated
                ? isEn
                  ? "Manage board"
                  : "Gerer le board"
                : isEn
                  ? "Request support"
                  : "Demander un accompagnement"}
            </Link>
          </Button>
        </div>
      </div>

      {source === "demo" ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {isEn
            ? "Demo announcements are shown until the live business board is connected."
            : "Des annonces de demonstration sont affichees tant que le board business live n'est pas connecte."}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`business-skeleton-${index}`} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                <div className="h-4 w-24 rounded-full bg-slate-200" />
                <div className="mt-4 h-6 w-4/5 rounded-full bg-slate-200" />
                <div className="mt-3 h-4 w-full rounded-full bg-slate-100" />
                <div className="mt-2 h-4 w-11/12 rounded-full bg-slate-100" />
                <div className="mt-6 h-10 rounded-2xl bg-slate-100" />
              </div>
            ))
          : items.map((item) => (
              <article key={item.id} className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-800">
                    {TYPE_LABELS[item.opportunity_type][isEn ? "en" : "fr"]}
                  </Badge>
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                    {formatDate(item.created_at, isEn ? "en-US" : "fr-FR")}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.summary}</p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {item.company_name}
                  </span>
                  {item.origin_country ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                      <Globe2 className="h-3.5 w-3.5" />
                      {isEn ? "From" : "Origine"} {item.origin_country}
                    </span>
                  ) : null}
                  {item.target_country ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {isEn ? "To" : "Cible"} {item.target_country}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button asChild size="sm" className="rounded-full">
                    <Link to="/coin-business">{isEn ? "See details" : "Voir le detail"}</Link>
                  </Button>
                  <a
                    href={`mailto:${item.contact_email}`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <Mail className="h-4 w-4" />
                    {isEn ? "Contact" : "Contacter"}
                  </a>
                </div>
              </article>
            ))}
      </div>

      {!loading && items.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-sm text-slate-600">
          <Sparkles className="mx-auto mb-3 h-5 w-5 text-slate-500" />
          {isEn
            ? "No announcement yet. MPL can qualify and publish the first France-Maghreb opportunity."
            : "Aucune annonce pour le moment. MPL peut qualifier et publier la premiere opportunite France-Maghreb."}
        </div>
      ) : null}
    </section>
  );
}
