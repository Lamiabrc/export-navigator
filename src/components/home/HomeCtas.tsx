import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Headset, Phone, Radar } from "lucide-react";

type Props = {
  isEn: boolean;
};

export function HomeCtas({ isEn }: Props) {
  return (
    <section className="w-full pb-8 sm:pb-10 lg:pb-12">
      <div className="grid w-full gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Headset className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">{isEn ? "Contact an expert" : "Contactez un expert"}</h3>
          </div>
          <Badge variant="secondary" className="mb-3 w-fit">{isEn ? "Free" : "Gratuit"}</Badge>
          <p className="mb-4 text-sm text-slate-600">
            {isEn ? "Send your context and get a human review." : "Envoyez votre contexte et obtenez un retour humain."}
          </p>
          <Button asChild className="w-full">
            <Link to="/contact">{isEn ? "Open contact form" : "Ouvrir le formulaire"}</Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Phone className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">{isEn ? "Call us" : "Appelez"}</h3>
          </div>
          <Badge variant="outline" className="mb-3 w-fit">08:30–18:30</Badge>
          <p className="mb-4 text-sm text-slate-600">
            {isEn ? "Direct support for urgent export decisions." : "Support direct pour vos décisions export urgentes."}
          </p>
          <Button asChild variant="outline" className="w-full">
            <a href="tel:+33676435551">+33 6 76 43 55 51</a>
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Radar className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">{isEn ? "Export control tower" : "Tour de contrôle export"}</h3>
          </div>
          <Badge className="mb-3 w-fit">Pro</Badge>
          <p className="mb-4 text-sm text-slate-600">
            {isEn
              ? "Manage dossiers, tasks and growth plan in one place."
              : "Pilotez dossiers, tâches et plan de croissance export dans un seul espace."}
          </p>
          <Button asChild className="w-full">
            <Link to="/tour-de-controle">{isEn ? "Open Pro tool" : "Accéder à l'outil Pro"}</Link>
          </Button>
    <section className="w-full px-4 pb-10 sm:px-6 lg:px-10 lg:pb-14">
      <div className="mx-auto grid w-full max-w-[1400px] gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-slate-200">
          <CardHeader className="space-y-2 pb-3">
            <Headset className="size-5 text-primary" />
            <CardTitle className="text-lg">{isEn ? "Contact an expert" : "Contactez un expert"}</CardTitle>
            <Badge variant="secondary" className="w-fit">{isEn ? "Free" : "Gratuit"}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-2 p-6 pb-3">
            <Headset className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">{isEn ? "Contact an expert" : "Contactez un expert"}</h3>
            <Badge variant="secondary" className="w-fit">{isEn ? "Free" : "Gratuit"}</Badge>
          </div>
          <div className="space-y-3 px-6 pb-6">
            <p className="text-sm text-slate-600">
              {isEn ? "Send your context and get a human review." : "Envoyez votre contexte et obtenez un retour humain."}
            </p>
            <Button asChild className="w-full">
              <Link to="/contact">{isEn ? "Open contact form" : "Ouvrir le formulaire"}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200">
          <CardHeader className="space-y-2 pb-3">
            <Phone className="size-5 text-primary" />
            <CardTitle className="text-lg">{isEn ? "Call us" : "Appelez"}</CardTitle>
            <Badge variant="outline" className="w-fit">08:30–18:30</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-2 p-6 pb-3">
            <Phone className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">{isEn ? "Call us" : "Appelez"}</h3>
            <Badge variant="outline" className="w-fit">08:30–18:30</Badge>
          </div>
          <div className="space-y-3 px-6 pb-6">
            <p className="text-sm text-slate-600">
              {isEn ? "Direct support for urgent export decisions." : "Support direct pour vos décisions export urgentes."}
            </p>
            <Button asChild variant="outline" className="w-full">
              <a href="tel:+33676435551">+33 6 76 43 55 51</a>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200">
          <CardHeader className="space-y-2 pb-3">
            <Radar className="size-5 text-primary" />
            <CardTitle className="text-lg">{isEn ? "Export tracking & growth tool" : "Outil de suivi & développement export"}</CardTitle>
            <Badge className="w-fit">Pro</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-2 p-6 pb-3">
            <Radar className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">{isEn ? "Export tracking & growth tool" : "Outil de suivi & développement export"}</h3>
            <Badge className="w-fit">Pro</Badge>
          </div>
          <div className="space-y-3 px-6 pb-6">
            <p className="text-sm text-slate-600">
              {isEn ? "Manage dossiers, tasks and strategic growth plans." : "Pilotez dossiers, tâches et plan de croissance export."}
            </p>
            <Button asChild className="w-full">
              <Link to="/tour-de-controle">{isEn ? "Open pro tool" : "Accéder à l’outil Pro"}</Link>
            </Button>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
