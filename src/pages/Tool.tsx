import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Sparkles, ShieldCheck } from "lucide-react";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ToolPage() {
  const { t } = useI18n();
  usePageMeta("meta.tool.title", "meta.tool.description");

  const features = (t("toolPage.list") as string[]) ?? [];
  const limitations = (t("toolPage.toolLimitationsList") as string[]) ?? [];
  const limitationsBody = (t("toolPage.toolLimitationsBody") as string) ?? "";
  const limitationsTitle = (t("toolPage.toolLimitationsTitle") as string) ?? "";
  const limitationsCta = (t("toolPage.toolLimitationsCta") as string) ?? "";
  const humanValidationCta = (t("toolPage.humanValidationCta") as string) ?? "";

  // Fallbacks (au cas où les clés n'existent pas dans tes traductions)
  const subhead = (t("toolPage.subhead") as string) ?? "Outil gratuit";
  const headline = (t("toolPage.headline") as string) ?? "Calcul rapide du coût export (landed cost)";
  const body =
    (t("toolPage.body") as string) ??
    "Estimez votre coût rendu (transport, assurance, droits, TVA, frais) et prenez une décision éclairée en quelques minutes.";
  const primaryCta = (t("toolPage.primaryCta") as string) ?? "Lancer une analyse";
  const reassurance =
    (t("toolPage.reassurance") as string) ??
    "Sans inscription • Résultat immédiat • Pensé pour les PME export depuis la France";

  const safeHumanCta = humanValidationCta || "Demander une validation humaine";

  const steps: { title: string; desc: string; icon: React.ReactNode }[] = [
    {
      title: (t("toolPage.step1Title") as string) ?? "Saisissez vos paramètres",
      desc:
        (t("toolPage.step1Desc") as string) ??
        "Destination, incoterm, mode de transport, valeur, quantités et frais.",
      icon: <Sparkles className="h-5 w-5" aria-hidden />,
    },
    {
      title: (t("toolPage.step2Title") as string) ?? "Obtenez un coût rendu",
      desc:
        (t("toolPage.step2Desc") as string) ??
        "Total + coût unitaire + ventilation détaillée par poste.",
      icon: <CheckCircle2 className="h-5 w-5" aria-hidden />,
    },
    {
      title: (t("toolPage.step3Title") as string) ?? "Sécurisez la décision",
      desc:
        (t("toolPage.step3Desc") as string) ??
        "En cas de doute : audit / revue humaine (conformité, risques, doc).",
      icon: <ShieldCheck className="h-5 w-5" aria-hidden />,
    },
  ];

  return (
    <MarketingLayout>
      {/* HERO */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {/* subtle background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(900px 500px at 20% 10%, rgba(59,130,246,0.25), transparent 60%), radial-gradient(900px 500px at 80% 0%, rgba(239,68,68,0.18), transparent 55%)",
          }}
          aria-hidden
        />
        {/* tricolor accent line */}
        <div
          className="pointer-events-none absolute left-0 top-0 h-1 w-full"
          style={{
            background: "linear-gradient(90deg, #2563eb 0%, #ffffff 50%, #ef4444 100%)",
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs uppercase tracking-[0.45em] text-white/70">{subhead}</p>

          <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl">
            {headline}
          </h1>

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

          {/* mini trust row */}
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              <div className="flex items-center gap-2 text-white">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                <span className="font-semibold">
                  {(t("toolPage.trust1") as string) ?? "Résultat clair & exploitable"}
                </span>
              </div>
              <p className="mt-2 text-white/70">
                {(t("toolPage.trust1Body") as string) ??
                  "Total, coût unitaire, et ventilation des postes pour piloter vos marges."}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              <div className="flex items-center gap-2 text-white">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                <span className="font-semibold">
                  {(t("toolPage.trust2") as string) ?? "Alerte sur les points sensibles"}
                </span>
              </div>
              <p className="mt-2 text-white/70">
                {(t("toolPage.trust2Body") as string) ??
                  "L’outil signale les zones d’incertitude (données manquantes, hypothèses, risques)."}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              <div className="flex items-center gap-2 text-white">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                <span className="font-semibold">
                  {(t("toolPage.trust3") as string) ?? "Option validation humaine"}
                </span>
              </div>
              <p className="mt-2 text-white/70">
                {(t("toolPage.trust3Body") as string) ??
                  "Pour sécuriser conformité & documents avant engagement (audit export sur demande)."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900">
              {(t("toolPage.howTitle") as string) ?? "Comment ça marche"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              {(t("toolPage.howBody") as string) ??
                "En 3 étapes : saisie → calcul → décision. Simple, rapide, et utile pour cadrer un prix de vente export."}
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
            <h2 className="text-2xl font-semibold text-slate-900">
              {(t("toolPage.featuresTitle") as string) ?? "Ce que l’outil vous apporte"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              {(t("toolPage.featuresBody") as string) ??
                "Une base solide pour estimer et comparer, avant d’aller plus loin (devis, commissionnaire, conformité)."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(features.length ? features : ["Calcul rapide", "Ventilation détaillée", "Avertissements", "Décision facilitée"]).map(
              (feature) => (
                <Card
                  key={feature}
                  className="rounded-3xl border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <CardContent className="flex gap-3 p-6">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-slate-900" aria-hidden />
                    <div>
                      <p className="text-base font-semibold text-slate-900">{feature}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {(t("toolPage.featureHint") as string) ??
                          "Pensé pour être compréhensible, pas un tableur incompréhensible."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            )}
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
                <h2 className="text-3xl font-semibold">
                  {limitationsTitle || "Limites & hypothèses"}
                </h2>
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
                  <span className="text-sm font-semibold">
                    {(t("toolPage.limitationsListTitle") as string) ?? "À garder en tête"}
                  </span>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-white/90">
                  {(limitations.length
                    ? limitations
                    : [
                        "Les tarifs réels varient selon devis et saison (fret, assurances).",
                        "Les droits/TVA dépendent du classement (HS), origine, accords, régimes.",
                        "Certains pays/produits nécessitent licences, contrôles, docs spécifiques.",
                        "Les sanctions/embargos et règles de conformité doivent être vérifiés.",
                      ]
                  ).map((item) => (
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
                  <span className="text-sm font-semibold">
                    {(t("toolPage.whenAuditTitle") as string) ?? "Quand demander un audit"}
                  </span>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-white/90">
                  {(
                    (t("toolPage.whenAuditList") as string[]) ?? [
                      "Montants importants / marge serrée",
                      "Nouveau pays ou nouveau produit",
                      "Doute HS code / origine / accords préférentiels",
                      "Risque sanctions / exigences documentaires",
                    ]
                  ).map((item) => (
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
              {(t("toolPage.footerNote") as string) ??
                "Note : l’outil aide à cadrer une décision, il ne remplace pas un conseil réglementaire ou un devis transport / douane."}
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
