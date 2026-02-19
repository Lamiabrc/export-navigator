import { PublicLayout } from "@/components/layout/PublicLayout";
import { VideoBanner } from "@/components/home/VideoBanner";
import { CopilotChatWide } from "@/components/home/CopilotChatWide";
import { HomeCtas } from "@/components/home/HomeCtas";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useI18n } from "@/contexts/LanguageContext";
import heroExportVideo from "@/assets/hero-export.mp4";
import { HomeHero } from "@/components/home/HomeHero";
import { CheckCircle2, Globe, SearchCheck, Target } from "lucide-react";
import { audiencesByLang, heroByLang, prospectionByLang, stepsByLang, valueCardsByLang } from "@/content/homeContent";

export default function Home() {
  const { lang } = useI18n();
  const isEn = lang === "en";
  const langKey = isEn ? "en" : "fr";
  const audiences = audiencesByLang[langKey];
  const heroLabels = heroByLang[langKey];
  const valueCards = valueCardsByLang[langKey];
  const howItWorksSteps = stepsByLang[langKey];
  const prospectionBullets = prospectionByLang[langKey];
  const privacyLabels = isEn
    ? {
        title: "Your data is confidential.",
        body: "Your information is protected by strict access rules. You can delete your data at any time. Inactive data is automatically purged according to our retention policy.",
        learnMore: "Learn more",
        deleteData: "Delete my data",
      }
    : {
        title: "Vos données sont confidentielles.",
        body: "Vos informations sont protégées par des règles d’accès strictes. Vous pouvez supprimer vos données à tout moment. Les données inactives sont automatiquement purgées selon notre politique de rétention.",
        learnMore: "En savoir plus",
        deleteData: "Supprimer mes données",
      };

  const closingCtaLabels = isEn
    ? {
        title: "Ready to secure your next export deal?",
        subtitle: "Run a Go/No-Go in 60 seconds.",
        primaryCta: "Start now",
        secondaryCta: "View pricing",
      }
    : {
        title: "Prêt à sécuriser votre prochain deal export ?",
        subtitle: "Lancez un Go/No-Go en 60 secondes.",
        primaryCta: "Démarrer maintenant",
        secondaryCta: "Voir les tarifs",
      };

  usePageMeta("meta.home.title", "meta.home.description", {
    brandSuffix: "Export Navigator",
  });

  return (
    <PublicLayout>
      <main className="mx-auto w-full max-w-[96rem] space-y-14 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <HomeHero labels={heroLabels} isEn={isEn} />

        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] lg:gap-8">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{isEn ? "What you get (in 60 seconds)" : "Ce que vous obtenez (en 60 secondes)"}</h2>
            <p className="text-base leading-relaxed text-slate-600">
              {isEn ? "A concise export decision package: risk, actions, and ready-to-send deliverables." : "Un package décisionnel export compact : risque, actions et livrables prêts à l’emploi."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {valueCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="h-full border-slate-200">
                  <CardHeader className="space-y-3 pb-3">
                    <Icon className="size-6 text-primary" />
                    <CardTitle className="text-base">{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-600">
                    <p>{card.line1}</p>
                    <p>{card.line2}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)] lg:gap-8">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{isEn ? "How it works" : "Comment ça marche"}</h2>
            <p className="text-base leading-relaxed text-slate-600">
              {isEn ? "Three guided steps to move from profile to market decision." : "Trois étapes guidées pour passer du profil à la décision marché."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {howItWorksSteps.map((step, index) => (
              <Card key={step} className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">
                    <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-sm text-primary">
                      {index + 1}
                    </span>
                    {isEn ? "Step" : "Étape"} {index + 1}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">{step}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{isEn ? "Who it's for" : "Pour qui"}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {audiences.map((audience) => (
              <Card key={audience} className="border-slate-200">
                <CardContent className="flex items-center gap-3 p-5 text-slate-700">
                  <Target className="size-5 text-primary" />
                  <span className="font-medium">{audience}</span>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-slate-600">
            {isEn ? "Whether you are just starting or already managing multiple countries, the goal stays the same: save time, avoid mistakes, protect margins." : "Que vous débutiez ou que vous gériez déjà plusieurs pays, l’objectif est le même: gagner du temps, éviter les erreurs, sécuriser les marges."}
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">{isEn ? "Prospecting (playbook included)" : "Prospection (playbook inclus)"}</p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            {isEn ? "Find international clients without losing focus." : "Trouver des clients à l’international, sans s’éparpiller."}
          </h2>
          <ul className="grid gap-3 text-slate-700 md:grid-cols-2">
            {prospectionBullets.map((item, idx) => {
              const Icon = idx === 0 ? Globe : idx === 1 ? SearchCheck : CheckCircle2;
              return (
                <li key={item} className="flex gap-2">
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
                  {item}
                </li>
              );
            })}
          </ul>
        </section>

        <section id="hero-video" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{isEn ? "See the tool in video" : "Voir l’outil en vidéo"}</h2>
          <p className="max-w-3xl text-slate-600">
            {isEn ? "Quick demo of control tower, invoice check and export costing." : "Démonstration rapide de la tour de contrôle, de l’analyse facture et du calcul de coûts export."}
          </p>
          <video className="aspect-video w-full max-w-none rounded-xl border border-slate-200" controls preload="metadata">
            <source src={heroExportVideo} type="video/mp4" />
            {isEn ? "Your browser does not support video playback." : "Votre navigateur ne supporte pas la lecture vidéo."}
          </video>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{privacyLabels.title}</h2>
          <p className="max-w-3xl text-slate-600">{privacyLabels.body}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/legal">{privacyLabels.learnMore}</Link>
            </Button>
            <Button asChild variant="ghost" className="text-slate-700">
              <a href="mailto:privacy@exportnavigator.example?subject=Suppression%20de%20mes%20donn%C3%A9es">
                {privacyLabels.deleteData}
              </a>
            </Button>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-slate-900 p-6 text-white md:p-8">
          <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">{closingCtaLabels.title}</h2>
          <p className="text-slate-200">{closingCtaLabels.subtitle}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary" className="w-full sm:min-w-48">
              <Link to="/register">{closingCtaLabels.primaryCta}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 sm:min-w-48">
              <Link to="/pricing">{closingCtaLabels.secondaryCta}</Link>
            </Button>
          </div>
        </section>

      </main>
    </PublicLayout>
  );
}
