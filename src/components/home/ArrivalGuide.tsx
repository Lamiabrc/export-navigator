import { useNavigate } from "react-router-dom";
import { Bot, MessageCircle, Radar, PhoneCall } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useI18n } from "@/contexts/LanguageContext";

type ActionItem = {
  key: string;
  title: string;
  description: string;
  cta: string;
  to: string;
  icon: typeof MessageCircle;
  variant?: "default" | "secondary" | "outline";
};

export function ArrivalGuide() {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const isFr = lang !== "en";

  const actions: ActionItem[] = isFr
    ? [
        {
          key: "chatbot",
          title: "Utiliser le chatbot intelligent",
          description: "Obtiens des reponses rapides sur tes premieres questions export.",
          cta: "Poser ma premiere question",
          to: "/copilote",
          icon: MessageCircle,
          variant: "default",
        },
        {
          key: "subscribe",
          title: "T'abonner + suivre tes operations",
          description: "Active la Tour de controle en ligne pour piloter tes dossiers.",
          cta: "Voir les offres",
          to: "/pricing",
          icon: Radar,
          variant: "secondary",
        },
        {
          key: "human",
          title: "Obtenir un conseil humain",
          description: "Parle a un expert MPL pour un accompagnement personnalise.",
          cta: "Contacter un conseiller",
          to: "/contact",
          icon: PhoneCall,
          variant: "outline",
        },
      ]
    : [
        {
          key: "chatbot",
          title: "Use the intelligent chatbot",
          description: "Get fast answers for your first export questions.",
          cta: "Ask my first question",
          to: "/copilote",
          icon: MessageCircle,
          variant: "default",
        },
        {
          key: "subscribe",
          title: "Subscribe + track operations",
          description: "Activate the online Control Tower to manage your flows.",
          cta: "See plans",
          to: "/pricing",
          icon: Radar,
          variant: "secondary",
        },
        {
          key: "human",
          title: "Get human advice",
          description: "Talk with an MPL expert for tailored guidance.",
          cta: "Contact an advisor",
          to: "/contact",
          icon: PhoneCall,
          variant: "outline",
        },
      ];

  return (
    <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-white via-blue-50/40 to-red-50/40">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <Avatar className="h-12 w-12 border border-primary/20 bg-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold sm:text-2xl">
              {isFr ? "Bienvenue sur MPL Export Navigator" : "Welcome to MPL Export Navigator"}
            </h2>
            <p className="max-w-4xl text-sm text-muted-foreground sm:text-base">
              {isFr
                ? "Si tu es arrive jusqu'ici, tu veux des informations sur des operations de commerce international en lien avec la France. Je peux t'aider a demarrer rapidement."
                : "If you are here, you probably need support on international trade operations connected to France. I can help you get started quickly."}
            </p>
            <p className="text-sm font-medium text-foreground sm:text-base">
              {isFr ? "Tu veux faire quoi ?" : "What do you want to do?"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {actions.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.key} className="h-full border-border/70 bg-background/90">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="min-h-[42px] text-xs text-muted-foreground">{item.description}</p>
                  <Button className="mt-auto w-full" variant={item.variant || "default"} onClick={() => navigate(item.to)}>
                    {item.cta}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

