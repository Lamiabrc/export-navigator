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
    <section className="w-full px-4 pb-10 sm:px-6 lg:px-10 lg:pb-14">
      <div className="mx-auto grid w-full max-w-[1400px] gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-slate-200">
          <CardHeader className="space-y-2 pb-3">
            <Headset className="size-5 text-primary" />
            <CardTitle className="text-lg">{isEn ? "Contact an expert" : "Contactez un expert"}</CardTitle>
            <Badge variant="secondary" className="w-fit">{isEn ? "Free" : "Gratuit"}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <p className="text-sm text-slate-600">
              {isEn ? "Manage dossiers, tasks and strategic growth plans." : "Pilotez dossiers, tâches et plan de croissance export."}
            </p>
            <Button asChild className="w-full">
              <Link to="/tour-de-controle">{isEn ? "Open pro tool" : "Accéder à l’outil Pro"}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
