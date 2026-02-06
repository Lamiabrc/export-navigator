import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Sparkles, ShieldCheck } from "lucide-react";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FALLBACK_FEATURES = ["Calcul rapide", "Ventilation détaillée", "Avertissements", "Décision facilitée"];

const FALLBACK_LIMITATIONS = [
  "Les tarifs réels varient selon devis et saison (fret, assurances).",
  "Les droits/TVA dépendent du classement (HS), origine, accords, régimes.",
  "Certains pays/produits nécessitent licences, contrôles, docs spécifiques.",
  "Les sanctions/embargos et règles de conformité doivent être vérifiés.",
];

const FALLBACK_AUDIT = [
  "Montants importants / marge serrée",
  "Nouveau pays ou nouveau produit",
  "Doute HS code / origine / accords préférentiels",
  "Risque sanctions / exigences documentaires",
];

function toStringArray(v: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");

  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return fallback;

    const parts = s.includes("\n") ? s.split("\n") : s.includes("|") ? s.split("|") : null;
    if (parts) {
      const cleaned = parts.map((p) => p.trim()).filter(Boolean);
      return cleaned.length ? cleaned : fallback;
    }

    return [s];
  }

  if (v && typeof v === "object") {
    const vals = Object.values(v).filter((x): x is string => typeof x === "string");
    return vals.length ? vals : fallback;
  }

  return fallback;
}

export default function ToolPage() {
  const { t } = useI18n();
  usePageMeta("meta.tool.title", "meta.tool.description");

  // ✅ détecte "traduction manquante" quand t() renvoie la clé
  const isMissing = (key: string, val: unknown) => typeof val === "string" && val.trim() === key;

  const tr = (key: string, fallback = ""): string => {
    const v = t(key);
    if (isMissing(key, v)) return fallback;
    return typeof v === "string" ? v : fallback;
  };

  const trArray = (key: string, fallback: string[]): string[] => {
    const v = t(key);
    if (isMissing(key, v)) return fallback;
    const arr = toStringArray(v, []);
    return arr.length ? arr : fallback;
  };

  const features = trArray("toolPage.list", FALLBACK_FEATURES);
  const limitations = trArray("toolPage.toolLimitationsList", FALLBACK_LIMITATIONS);

  const limitationsBody = tr("toolPage.toolLimitationsBody", "");
  const limitationsTitle = tr("toolPage.toolLimitationsTitle", "");
  const limitationsCta = tr("toolPage.toolLimitationsCta", "");
  const humanValidationCta = tr("toolPage.humanValidationCta", "");

  const subhead = tr("toolPage.subhead", "Outil gratuit");
  const headline = tr("toolPage.headline", "Calcul rapide du coût export (landed cost)");
  const body = tr(
    "toolPage.body",
    "Estimez votre coût rendu (transport, assurance, droits, TVA, frais) et prenez une décision éclairée en quelques minutes."
  );
  const primaryCta = tr("toolPage.primaryCta", "Lancer une analyse");
  const reassurance = tr(
    "toolPage.reassurance",
    "Sans inscription • Résultat immédiat • Pensé pour les PME qui exportent"
  );

  const safeHumanCta = humanValidationCta || "Demander une validation humaine";

  const steps: { title: string; desc: string; icon: ReactNode }[] = [
    {
      title: tr("toolPage.step1Title", "Saisissez vos paramètres"),
      desc: tr("toolPage.step1Desc", "Destination, incoterm, mode de transport, valeur, quantités et frais."),
      icon: <Sparkles className="h-5 w-5" aria-hidden />,
    },
    {
      title: tr("toolPage.step2Title", "Obtenez un coût rendu"),
      desc: tr("toolPage.step2Desc", "Total + coût unitaire + ventilation détaillée par poste."),
      icon: <CheckCircle2 className="h-5 w-5" aria-hidden />,
    },
    {
      title: tr("toolPage.step3Title", "Sécurisez la décision"),
      desc: tr("toolPage.step3Desc", "En cas de doute : audit / revue humaine (conformité, risques, doc)."),
      icon: <ShieldCheck className="h-5 w-5" aria-hidden />,
    },
  ];

  const whenAuditList = trArray("toolPage.whenAuditList", FALLBACK_AUDIT);

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(900px 500px at 20% 10%, rgba(59,130,246,0.25), transparent 60%), radial-gradient(900px 500px at 80% 0%, rgba(14,165,233,0.18), transparent 55%)",
          }}
          aria-hidden
        />
        {/* ✅ barre neutre (plus de référence FR) */}
        <div
          className="pointer-events-none absolute left-0 top-0 h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(59,130,246,1) 0%, rgba(255,255,255,0.85) 50%, rgba(14,165,233,1) 100%)",
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.45em] text-white/70">{subhead}</p>

          <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">{headline}</h1>

          <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/80">{body}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild className="rounded-full">
              <Link to="/analyse">{primaryCta}</Link>
            </Button>

            <Button asChild variant="secondary" className="rounded-full">
              <Link to="/contact">{safeHumanCta}</Link>
            </Button>

            <span className="text-xs uppercase tracking-[0.35em] text-white/70">{reassurance}</span>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              <div className="flex items-center gap-2 text-white">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                <span className="font-semibold">{tr("toolPage.trust1", "Résultat clair & exploitable")}</span>
              </div>
              <p className="mt-2 text-white/70">
                {tr("toolPage.trust1Body", "Total, coût unitaire, et ventilation des postes pour piloter vos marges.")}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              <div className="flex items-center gap-2 text-white">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                <span className="font-semibold">{tr("toolPage.trust2", "Alerte sur les points sensibles")}</span>
              </div>
              <p className="mt-2 text-white/70">
                {tr("toolPage.trust2Body", "L’outil signale les zones d’incertitude (données manquantes, hypothèses, risques).")}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              <div className="flex items-center gap-2 text-white">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                <span className="font-semibold">{tr("toolPage.trust3", "Option validation humaine")}</span>
              </div>
              <p className="mt-2 text-white/70">
                {tr("toolPage.trust3Body", "Pour sécuriser conformité & documents avant engagement (audit export sur demande).")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900">{tr("toolPage.howTitle", "Comment ça marche")}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              {tr(
                "toolPage.howBody",
                "En 3 étapes : saisie → calcul → décision. Simple, rapide, et utile pour cadrer un prix de vente à l’international."
              )}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <Card key={s.title} className="rounded-3xl border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 text-slate-900">
                    <div className="rounded-xl border border-slate-200 bg-white p-2">{s.icon}</div>
                    <div className="font-semibold">{s.title}</div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900">{tr("toolPage.featuresTitle", "Ce que l’outil vous apporte")}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              {tr(
                "toolPage.featuresBody",
                "Une base solide pour estimer et comparer, avant d’aller plus loin (devis, commissionnaire, conformité)."
              )}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {features.map((feature) => (
              <Card key={feature} className="rounded-3xl border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                <CardContent className="flex gap-3 p-6">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-slate-900" aria-hidden />
                  <div>
                    <p className="text-base font-semibold text-slate-900">{feature}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {tr("toolPage.featureHint", "Pensé pour être compréhensible, pas un tableur incompréhensible.")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild className="rounded-full">
              <Link to="/analyse">{primaryCta}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/contact">{safeHumanCta}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* LIMITATIONS */}
      <section className="bg-white pb-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-3xl border border-slate-900/10 bg-slate-950 p-8 text-white shadow-lg md:p-12">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-3xl font-semibold">{limitationsTitle || "Limites & hypothèses"}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/80">
                  {limitationsBody ||
                    "Cet outil est une estimation. Pour une décision engageante, une revue humaine reste recommandée selon les cas (HS code, conformité, sanctions, licences, exigences documentaires)."}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center gap-2 text-white">
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                  <span className="text-sm font-semibold">{tr("toolPage.limitationsListTitle", "À garder en tête")}</span>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-white/90">
                  {limitations.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-2 w-2 rounded-full bg-white" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center gap-2 text-white">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                  <span className="text-sm font-semibold">{tr("toolPage.whenAuditTitle", "Quand demander un audit")}</span>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-white/90">
                  {whenAuditList.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-2 w-2 rounded-full bg-white" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button asChild className="rounded-full">
                    <Link to="/contact">{safeHumanCta}</Link>
                  </Button>
                  <span className="text-xs uppercase tracking-[0.35em] text-white/70">
                    {limitationsCta || "Réponse sous 24–48h"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
              {tr(
                "toolPage.footerNote",
                "Note : l’outil aide à cadrer une décision, il ne remplace pas un conseil réglementaire ni un devis transport / douane."
              )}
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
