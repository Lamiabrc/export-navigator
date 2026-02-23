import { useNavigate } from "react-router-dom";
import { Bot, MessageCircle, PhoneCall, Radar, Sparkles } from "lucide-react";
import heroExportVideo from "@/assets/hero-export.mp4";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type ActionItem = {
  key: string;
  title: string;
  subtitle: string;
  to: string;
  icon: typeof MessageCircle;
};

export function ArrivalGuide({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const isFr = lang !== "en";

  const actions: ActionItem[] = isFr
    ? [
        {
          key: "chat",
          title: "Poser ma premiere question",
          subtitle: "Chatbot intelligent",
          to: "/copilote",
          icon: MessageCircle,
        },
        {
          key: "tower",
          title: "Suivre mes operations",
          subtitle: "Tour de controle",
          to: "/control-tower",
          icon: Radar,
        },
        {
          key: "human",
          title: "Parler a un expert",
          subtitle: "Conseil humain personnalise",
          to: "/contact",
          icon: PhoneCall,
        },
      ]
    : [
        {
          key: "chat",
          title: "Ask my first question",
          subtitle: "Intelligent chatbot",
          to: "/copilote",
          icon: MessageCircle,
        },
        {
          key: "tower",
          title: "Track my operations",
          subtitle: "Control Tower",
          to: "/control-tower",
          icon: Radar,
        },
        {
          key: "human",
          title: "Talk to an expert",
          subtitle: "Personalized human advice",
          to: "/contact",
          icon: PhoneCall,
        },
      ];

  const bubbleText = isFr
    ? {
        top: "Question export ?",
        left: "Incoterms • Douane • HS",
        right: "Reponse rapide",
        hi: "Salut !",
      }
    : {
        top: "Export question?",
        left: "Incoterms • Customs • HS",
        right: "Fast answer",
        hi: "Hi!",
      };

  return (
    <Card className={cn("h-full overflow-hidden border-0 bg-black text-white", className)}>
      <CardContent className="relative flex h-full flex-col justify-between p-0">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-70"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/videos/hero-export.jpg"
        >
          <source src="/videos/hero-export.webm" type="video/webm" />
          <source src={heroExportVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.35)_0%,rgba(0,0,0,0)_58%)]" />

        <div className="relative z-10 flex h-full flex-col justify-between px-4 py-4 sm:px-8 sm:py-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/35 bg-black/30 px-3 py-1 text-xs font-semibold tracking-wide text-white">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
            MPL EXPORT NAVIGATOR
          </div>

          <div className="relative mx-auto flex w-full max-w-5xl flex-1 items-center justify-center">
            <div className="absolute left-[16%] top-[26%] hidden rounded-2xl border border-white/35 bg-black/35 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur md:block">
              {bubbleText.left}
            </div>
            <div className="absolute right-[14%] top-[24%] hidden rounded-2xl border border-white/35 bg-black/35 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur md:block">
              {bubbleText.right}
            </div>
            <div className="absolute top-[8%] rounded-2xl border border-white/35 bg-black/30 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur">
              {bubbleText.top}
            </div>

            <div className="relative h-40 w-40 sm:h-52 sm:w-52">
              <div className="absolute -inset-8 rounded-full bg-cyan-300/35 blur-3xl" />
              <div className="absolute inset-0 rounded-full border border-white/50 bg-gradient-to-b from-slate-100/95 via-white to-slate-300/95 p-4 shadow-[0_0_35px_rgba(125,211,252,0.55)]">
                <div className="relative flex h-full items-center justify-center rounded-full bg-slate-950">
                  <div className="absolute top-[30%] h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.85)]" />
                  <Bot className="h-11 w-11 text-cyan-200 sm:h-14 sm:w-14" />
                </div>
              </div>
              <div className="absolute -right-8 -top-8 rounded-full border border-white/50 bg-white px-4 py-1 text-lg font-semibold text-slate-900 shadow-md">
                {bubbleText.hi}
              </div>
            </div>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-5xl rounded-2xl border border-white/45 bg-white/95 p-4 text-black shadow-2xl backdrop-blur sm:p-6">
            <h2 className="text-lg font-semibold sm:text-2xl">
              {isFr ? "Bienvenue sur MPL Export Navigator" : "Welcome to MPL Export Navigator"}
            </h2>
            <p className="mt-2 text-sm text-black/85 sm:text-base">
              {isFr
                ? "Tu veux des informations sur des operations de commerce international liees a la France. Choisis ton point de depart."
                : "You need guidance on international trade operations connected to France. Choose your starting point."}
            </p>
            <p className="mt-2 text-sm font-semibold text-black sm:text-base">
              {isFr ? "Tu veux faire quoi ?" : "What do you want to do?"}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {actions.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.key}
                    variant="outline"
                    className="h-auto justify-start border-slate-300 bg-white py-3 text-left text-black hover:bg-slate-50"
                    onClick={() => navigate(item.to)}
                  >
                    <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 via-white to-red-100 text-blue-800">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">{item.title}</span>
                      <span className="text-xs font-normal text-black/70">{item.subtitle}</span>
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
