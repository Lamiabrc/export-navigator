import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Headset, Mail, Phone } from "lucide-react";

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
            <Mail className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">{isEn ? "Write to us" : "Écrivez-nous"}</h3>
          </div>
          <Badge variant="outline" className="mb-3 w-fit">{isEn ? "Reply within 24 h" : "Réponse sous 24 h"}</Badge>
          <p className="mb-4 text-sm text-slate-600">
            {isEn ? "Describe your export team and your project." : "Présentez votre équipe export et votre projet."}
          </p>
          <Button asChild variant="outline" className="w-full">
            <a href="mailto:contact@exportfrancefacile.com">contact@exportfrancefacile.com</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
