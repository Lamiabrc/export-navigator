import { useNavigate } from "react-router-dom";
import { Bot, BookOpen, CreditCard, MessageCircle, PhoneCall, Radar, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useI18n } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type MainAction = {
  key: string;
  title: string;
  description: string;
  cta: string;
  to: string;
  icon: typeof MessageCircle;
  variant?: "default" | "secondary" | "outline";
};

type MindNode = {
  key: string;
  title: string;
  to: string;
  icon: typeof MessageCircle;
  x: number;
  y: number;
};

export function ArrivalGuide() {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const isFr = lang !== "en";

  const actions: MainAction[] = isFr
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

  const mindNodes: MindNode[] = isFr
    ? [
        { key: "faq", title: "FAQ export", to: "/resources", icon: BookOpen, x: 16, y: 28 },
        { key: "chat", title: "Chatbot IA", to: "/copilote", icon: MessageCircle, x: 16, y: 72 },
        { key: "pricing", title: "Abonnement", to: "/pricing", icon: CreditCard, x: 50, y: 12 },
        { key: "tower", title: "Tour de controle", to: "/control-tower", icon: Radar, x: 84, y: 28 },
        { key: "human", title: "Conseil humain", to: "/contact", icon: PhoneCall, x: 84, y: 72 },
      ]
    : [
        { key: "faq", title: "Export FAQ", to: "/resources", icon: BookOpen, x: 16, y: 28 },
        { key: "chat", title: "AI chatbot", to: "/copilote", icon: MessageCircle, x: 16, y: 72 },
        { key: "pricing", title: "Subscription", to: "/pricing", icon: CreditCard, x: 50, y: 12 },
        { key: "tower", title: "Control Tower", to: "/control-tower", icon: Radar, x: 84, y: 28 },
        { key: "human", title: "Human advice", to: "/contact", icon: PhoneCall, x: 84, y: 72 },
      ];

  return (
    <Card className="overflow-hidden border-blue-200/80 bg-gradient-to-br from-blue-50 via-white to-red-50">
      <CardContent className="space-y-6 p-5 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <Avatar className="h-12 w-12 border border-blue-300 bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.6)]">
            <AvatarFallback className="bg-white text-blue-700">
              <Bot className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold sm:text-2xl">
              {isFr ? "Bienvenue sur MPL Export Navigator" : "Welcome to MPL Export Navigator"}
            </h2>
            <p className="max-w-4xl text-sm text-muted-foreground sm:text-base">
              {isFr
                ? "Si tu es arrive jusqu'ici, tu cherches des infos sur des operations de commerce international liees a la France. Voici une carte mentale pour choisir ton chemin."
                : "If you are here, you probably need support on international trade operations connected to France. I can help you get started quickly."}
            </p>
            <p className="text-sm font-medium text-foreground sm:text-base">
              {isFr ? "Tu veux faire quoi ?" : "What do you want to do?"}
            </p>
          </div>
        </div>

        <div className="relative hidden h-[430px] rounded-2xl border border-blue-200/80 bg-white/80 p-4 lg:block">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="mindline" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#335dd2" />
                <stop offset="50%" stopColor="#c6d4ff" />
                <stop offset="100%" stopColor="#d62839" />
              </linearGradient>
            </defs>
            {mindNodes.map((node) => {
              const anchorX = node.x < 50 ? node.x + 8 : node.x > 50 ? node.x - 8 : node.x;
              const elbowX = node.x < 50 ? 34 : node.x > 50 ? 66 : 50;
              const centerY = 50;
              const d =
                node.x === 50
                  ? `M 50 ${centerY} L 50 ${node.y + 8}`
                  : `M 50 ${centerY} L ${elbowX} ${centerY} L ${elbowX} ${node.y} L ${anchorX} ${node.y}`;
              return (
                <path
                  key={`line-${node.key}`}
                  d={d}
                  fill="none"
                  stroke="url(#mindline)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  opacity="0.95"
                />
              );
            })}
          </svg>

          <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle,_rgba(255,255,255,0.95)_0%,_rgba(117,158,255,0.58)_45%,_rgba(214,40,57,0.48)_85%,transparent_100%)] blur-xl" />
            <div className="absolute inset-2 rounded-[1.8rem] border border-blue-200 bg-gradient-to-br from-blue-800 via-blue-700 to-red-700 p-5 text-white shadow-[0_0_25px_rgba(82,126,255,0.45)]">
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <Bot className="h-8 w-8" />
                <div className="text-3xl font-semibold tracking-wide">AI</div>
                <div className="text-xs text-blue-100">{isFr ? "MPL Navigator" : "MPL Navigator"}</div>
              </div>
            </div>
          </div>

          {mindNodes.map((node) => {
            const Icon = node.icon;
            return (
              <button
                key={node.key}
                type="button"
                onClick={() => navigate(node.to)}
                className={cn(
                  "absolute flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium shadow-sm transition",
                  "border-blue-200 text-slate-800 hover:border-blue-400 hover:shadow-md",
                )}
                style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%, -50%)" }}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 via-white to-red-100 text-blue-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span>{node.title}</span>
              </button>
            );
          })}

          <div className="absolute bottom-4 left-4 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              {isFr ? "Carte mentale interactive" : "Interactive mind map"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:hidden">
          {mindNodes.map((node) => {
            const Icon = node.icon;
            return (
              <Button
                key={`mobile-${node.key}`}
                variant="outline"
                className="justify-start gap-2 border-blue-200 bg-white"
                onClick={() => navigate(node.to)}
              >
                <Icon className="h-4 w-4 text-blue-700" />
                {node.title}
              </Button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {actions.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.key} className="h-full border-blue-200/80 bg-white/90">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 via-white to-red-100 text-blue-700">
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
